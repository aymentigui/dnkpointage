"use server"
import { generateVerificationToken, getVerificationTokenByEmail, getVerificationTokenByToken } from "./verification-token";
import { prisma } from "@/lib/db";
import bcrypt from "bcrypt";
import { sendEmail } from "../email";
import { getUserByEmailOrUsername } from "../users/get";
import { getTranslations } from "next-intl/server";

// Constantes pour la limitation
const MAX_ATTEMPTS = 3;
const BLOCK_DURATION_MINUTES = 15;

export async function resetPasswordWithoutConnection(data: { email: string, password?: string, code?: string }): Promise<{ status: number, data: any }> {
    const u = await getTranslations('Users');
    const t = await getTranslations('Settings');
    const e = await getTranslations('Error');
    const s = await getTranslations('System');

    try {
        const { email, password, code } = data;

        if (!email) {
            return { status: 400, data: { message: t("emailorusername") } };
        }

        const user = await getUserByEmailOrUsername(email);
        if (user.status !== 200 || !user.data) {
            return { status: 400, data: { message: e("usernotfound") } };
        }

        // Vérifier si l'utilisateur est bloqué
        let existingResetPassword = await getResetPasswordConfermation(user.data.id);
        if (existingResetPassword.status === 200 && existingResetPassword.data) {
            const resetData = existingResetPassword.data;

            // Vérifier si le compte est bloqué
            if (resetData.blocked_until && new Date(resetData.blocked_until) > new Date()) {
                const remainingTime = Math.ceil((new Date(resetData.blocked_until).getTime() - new Date().getTime()) / (1000 * 60));
                return {
                    status: 429,
                    data: {
                        message: e("account_blocked", { minutes: remainingTime }) || `Compte bloqué. Réessayez dans ${remainingTime} minutes.`
                    }
                };
            }
        }

        const token = await getVerificationTokenByEmail(user.data.email);
        if (code) {
            if (token.status !== 200 || !token.data) {
                // Incrémenter le compteur de tentatives
                await incrementResetAttempt(user.data.id);
                return { status: 400, data: { message: e("invalidcode") } };
            }

            if (token.data.token !== code) {
                // Incrémenter le compteur de tentatives
                await incrementResetAttempt(user.data.id);
                return { status: 400, data: { message: e("invalidcode") } };
            }

            const expiresAt = new Date(token.data.expiresAt) < new Date()
            if (expiresAt) {
                return { status: 400, data: { message: e("codeexpired") } };
            }

            // Réinitialiser les tentatives en cas de succès
            await createResetPasswordConfermation(user.data.id)

            return { status: 200, data: { codeConfirmed: true } };
        }

        if (!password) {
            return { status: 400, data: { message: u("passwordrequired") } };
        }

        existingResetPassword = await getResetPasswordConfermation(user.data.id)
        if (existingResetPassword.status !== 200 || !existingResetPassword.data) {
            return { status: 400, data: { message: e("invalidcode") } };
        }

        const expiresAt = new Date(existingResetPassword.data.expiresAt) < new Date()
        if (expiresAt) {
            return { status: 400, data: { message: e("codeexpired") } };
        }

        const passwordHash = await bcrypt.hash(password, 10);
        await prisma.user.update({
            where: { id: user.data.id },
            data: { password: passwordHash },
        });

        await deleteResetPasswordConfermation(user.data.id)

        return { status: 200, data: { message: s("updatesuccess") } };
    } catch (error) {
        console.error("An error occurred in resetPasswordWithoutConnection");
        return { status: 500, data: { message: e("error") } };
    }
}

export async function getConfirmationCodePasswordChange(emailOrUsername: string): Promise<{ status: number, data: any }> {
    const e = await getTranslations('Error');
    const s = await getTranslations('System');

    try {
        const user = await getUserByEmailOrUsername(emailOrUsername);
        if (user.status !== 200 || !user.data) {
            return { status: 400, data: { message: e("usernotfound") } };
        }

        // Vérifier si l'utilisateur est bloqué
        const existingResetPassword = await getResetPasswordConfermation(user.data.id);
        if (existingResetPassword.status === 200 && existingResetPassword.data) {
            const resetData = existingResetPassword.data;

            // Vérifier si le compte est bloqué
            if (resetData.blocked_until && new Date(resetData.blocked_until) > new Date()) {
                const remainingTime = Math.ceil((new Date(resetData.blocked_until).getTime() - new Date().getTime()) / (1000 * 60));
                return {
                    status: 429,
                    data: {
                        message: e("account_blocked", { minutes: remainingTime }) || `Compte bloqué. Réessayez dans ${remainingTime} minutes.`
                    }
                };
            }

            // Vérifier le nombre de tentatives
            if (resetData.attempts >= MAX_ATTEMPTS) {
                // Bloquer l'utilisateur
                const blockedUntil = new Date(Date.now() + BLOCK_DURATION_MINUTES * 60 * 1000);
                await prisma.resetpasswordconfermation.update({
                    where: { id: resetData.id },
                    data: {
                        blocked_until: blockedUntil,
                        attempts: resetData.attempts + 1
                    }
                });

                return {
                    status: 429,
                    data: {
                        message: e("too_many_attempts") || `Trop de tentatives. Compte bloqué pour ${BLOCK_DURATION_MINUTES} minutes.`
                    }
                };
            }
        }

        const toke = await generateVerificationToken(user.data.email);
        sendEmail(user.data.email, 'Confirmation code', 'Your confirmation code is ' + toke.data.token);

        // Créer ou mettre à jour l'enregistrement de reset
        await createOrUpdateResetPasswordConfermation(user.data.id);

        return { status: 200, data: { message: s("emailsent") } };
    } catch (error) {
        console.error("An error occurred in getConfirmationCode");
        return { status: 500, data: { message: e("error") } };
    }
}

export async function createOrUpdateResetPasswordConfermation(id: string): Promise<{ status: number, data: any }> {
    const e = await getTranslations('Error');
    try {
        const existingResetPassword = await getResetPasswordConfermation(id);

        if (existingResetPassword.status === 200 && existingResetPassword.data) {
            // Mettre à jour l'existant
            const verificationToken = await prisma.resetpasswordconfermation.update({
                where: { id: existingResetPassword.data.id },
                data: {
                    attempts: existingResetPassword.data.attempts + 1,
                    last_attempt: new Date(),
                    expired_at: new Date(new Date().getTime() + 1000 * 60 * 5)
                }
            });
            return { status: 200, data: verificationToken };
        } else {
            // Créer un nouveau
            const verificationToken = await prisma.resetpasswordconfermation.create({
                data: {
                    user_id: id,
                    expired_at: new Date(new Date().getTime() + 1000 * 60 * 5),
                    attempts: 1,
                    last_attempt: new Date()
                }
            });
            return { status: 200, data: verificationToken };
        }
    } catch (error) {
        console.error("An error occurred in createOrUpdateResetPasswordConfermation");
        return { status: 500, data: { message: e("error") } };
    }
}

export async function incrementResetAttempt(id: string): Promise<{ status: number, data: any }> {
    const e = await getTranslations('Error');
    try {
        const existingResetPassword = await getResetPasswordConfermation(id);

        if (existingResetPassword.status === 200 && existingResetPassword.data) {
            const newAttempts = existingResetPassword.data.attempts + 1;
            let blockedUntil = null;

            // Bloquer si trop de tentatives
            if (newAttempts >= MAX_ATTEMPTS) {
                blockedUntil = new Date(Date.now() + BLOCK_DURATION_MINUTES * 60 * 1000);
            }

            const verificationToken = await prisma.resetpasswordconfermation.update({
                where: { id: existingResetPassword.data.id },
                data: {
                    attempts: newAttempts,
                    last_attempt: new Date(),
                    blocked_until: blockedUntil
                }
            });
            return { status: 200, data: verificationToken };
        }
        return { status: 404, data: { message: "Not found" } };
    } catch (error) {
        console.error("An error occurred in incrementResetAttempt");
        return { status: 500, data: { message: e("error") } };
    }
}

export async function createResetPasswordConfermation(id: string): Promise<{ status: number, data: any }> {
    const e = await getTranslations('Error');
    try {
        const existingResetPassword = await getResetPasswordConfermation(id)
        if (existingResetPassword.status === 200 && existingResetPassword.data) {
            await deleteResetPasswordConfermation(id)
        }
        const verificationToken = await prisma.resetpasswordconfermation.create({
            data: {
                user_id: id,
                expired_at: new Date(new Date().getTime() + 1000 * 60 * 5),
                attempts: 0,
                last_attempt: new Date()
            }
        })
        return { status: 200, data: verificationToken };
    } catch (error) {
        console.error("An error occurred in createResetPasswordConfermation");
        return { status: 500, data: { message: e("error") } };
    }
}

export async function getResetPasswordConfermation(id: string): Promise<{ status: number, data: any }> {
    const e = await getTranslations('Error');
    try {
        const verificationToken = await prisma.resetpasswordconfermation.findFirst({
            where: {
                user_id: id
            }
        })
        if (!verificationToken) {
            return { status: 404, data: { message: e("invalidtoken") } };
        }
        return { status: 200, data: verificationToken };
    } catch (error) {
        console.error("An error occurred in getResetPasswordConfermation");
        return { status: 500, data: { message: e("error") } };
    }
}

export async function deleteResetPasswordConfermation(id: string): Promise<{ status: number, data: any }> {
    const e = await getTranslations('Error');
    try {
        const verificationToken = await prisma.resetpasswordconfermation.deleteMany({
            where: {
                user_id: id
            }
        })
        return { status: 200, data: verificationToken };
    } catch (error) {
        console.error("An error occurred in deleteResetPasswordConfermation");
        return { status: 500, data: { message: e("error") } };
    }
}
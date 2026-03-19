// /actions/auth/auth.ts (Server Actions)

"use server"

import { signIn, signOut } from '@/auth';
import { prisma } from '@/lib/db';
import bcrypt from 'bcrypt';
import { z } from 'zod';
// Importez ces fonctions de vos fichiers de logique spécifiques
import { deleteVerificationTokenByEmail, generateVerificationToken, getVerificationTokenByEmail } from './verification-token';
import { send2FACode, sendCode } from '../email'; // Assurez-vous d'avoir une fonction d'envoi de code de base
import { createTowFactorConfermation } from './tow-factor-confermation';
import { getTranslations } from 'next-intl/server';
import { verifySession } from '../permissions';

// --- Types pour la Réponse ---
type AuthResponse = {
    status: number;
    data: any;
};

// --- Schémas de Validation ---

const RegisterSchema = (u: any) => z.object({
    firstname: z.string({ required_error: u("firstnamerequired") }),
    lastname: z.string({ required_error: u("lastnamerequired") }),
    username: z.string({ required_error: u("usernamerequired") })
        .min(3, { message: u("username6") })
        .max(20, { message: u("username20") }),
    email: z.string({ required_error: u("emailrequired") }).email({ message: u("emailinvalid") }),
    password: z.string({ required_error: u("passwordrequired") }).min(6, { message: u("password6") }),
    passwordConfirm: z.string({ required_error: u("confirmpasswordrequired") }).min(6, { message: u("password6") }),
}).refine((data) => data.password === data.passwordConfirm, {
    path: ["passwordConfirm"],
    message: u("confirmpasswordnotmatch"),
});

const LoginSchema = (u: any) => z.object({
    email: z.string({ required_error: u("emailrequired") }), // Permet l'email ou le username
    password: z.string({ required_error: u("passwordrequired") }).min(6, { message: u("password6") }),
    code: z.string().optional(),
});

const ConfirmationSchema = z.object({
    code: z.string(),
});


// ----------------------------------------------------------------------
// Fonctions d'Authentification (Auth Actions)
// ----------------------------------------------------------------------

/**
 * Gère l'inscription d'un nouvel utilisateur.
 */
export async function registerUser(data: any): Promise<AuthResponse> {
    const u = await getTranslations('Users');
    const e = await getTranslations('Error');
    const result = RegisterSchema(u).safeParse(data);

    if (!result.success) {
        return { status: 400, data: result.error.errors };
    }
    const { username, email, password, firstname, lastname } = result.data;

    try {
        const existingUserByUsername = await prisma.user.findUnique({ where: { username } });
        if (existingUserByUsername) {
            return { status: 400, data: { message: u('usernameexists') || 'Username already exists' } };
        }

        const existingUserByEmail = await prisma.user.findUnique({ where: { email } });
        if (existingUserByEmail) {
            return { status: 400, data: { message: u('emailexists') || 'Email already exists' } };
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const newUser = await prisma.user.create({
            data: {
                firstname,
                lastname,
                username,
                email,
                password: passwordHash,
            },
        });

        // Envoi du code de vérification juste après l'inscription (non bloquant)
        await SendVerificationCode(email);

        return { status: 201, data: newUser };
    } catch (error) {
        console.error("Registration error:", error);
        return { status: 500, data: { message: e("errorregistering") } };
    }
}

/**
 * Gère la connexion de l'utilisateur avec gestion du 2FA et de la vérification d'email.
 */
/**
 * Gère la connexion de l'utilisateur avec gestion du 2FA et de la vérification d'email.
 */
export async function loginUser(data: any): Promise<AuthResponse> {
    const u = await getTranslations("Users");
    const s = await getTranslations("System");
    const e = await getTranslations("Error");

    const result = LoginSchema(u).safeParse(data);
    if (!result.success) {
        return { status: 400, data: result.error.errors };
    }
    const { email, password, code } = result.data;

    try {
        const user = await prisma.user.findFirst({
            where: {
                OR: [{ email: email }, { username: email }],
                AND: [{ deleted_at: null }],
            },
        });

        if (!user || !user.password) {
            return { status: 401, data: { message: u('invalidcredentials') || 'Invalid credentials' } };
        }

        // Vérifier le verrouillage du compte principal
        const lockCheck = await checkAndHandleAccountLock(user);
        if (lockCheck.isLocked) {
            return { status: 423, data: { message: lockCheck.message || u("accountlocked") } };
        }

        const isValid = await bcrypt.compare(password, user.password);

        if (!isValid) {
            // Incrémenter le compteur d'échecs
            const updatedFailedAttempts = user.failed_login_attempts + 1;
            let lockedUntil = null;

            // Verrouiller après 5 tentatives échouées
            if (updatedFailedAttempts >= 5) {
                lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
            }

            await prisma.user.update({
                where: { id: user.id },
                data: {
                    failed_login_attempts: updatedFailedAttempts,
                    locked_until: lockedUntil
                }
            });

            const remainingAttempts = 5 - updatedFailedAttempts;
            let errorMessage = u('invalidcredentials') || 'Invalid credentials';

            if (lockedUntil) {
                errorMessage = u('accountlocked') || 'Your account has been locked for 15 minutes due to too many failed attempts.';
            } else if (remainingAttempts > 0) {
                errorMessage = `${u('invalidcredentials')} - ${u('remainingattempts')} ${remainingAttempts}`;
            }

            return { status: 401, data: { message: errorMessage } };
        }

        // Réinitialiser le compteur d'échecs en cas de succès
        if (user.failed_login_attempts > 0) {
            await prisma.user.update({
                where: { id: user.id },
                data: {
                    failed_login_attempts: 0,
                    locked_until: null
                }
            });
        }

        if (user.email_verified === null) {
            return { status: 403, data: { message: u('emailnotverified') || 'You must verify your email', emailNotVerified: true } };
        }

        // --- Logique 2FA ---
        if (user.is_two_factor_enabled && user.email) {
            // Vérifier le blocage 2FA avant de procéder
            const twoFALockCheck = await checkAndHandle2FALock(user);
            if (twoFALockCheck.isLocked) {
                return { status: 429, data: { message: twoFALockCheck.message || u("twofactorblocked") } };
            }

            if (!code) {
                // Étape 1: 2FA requis, envoi du code et demande de confirmation
                const tokenResponse = await generateVerificationToken(user.email);
                await send2FACode({ email: user.email, code: tokenResponse.data.token });
                return { status: 202, data: { twoFactorConfermation: true, message: s('2fa_code_sent') } };
            } else {
                // Étape 2: Vérification du code 2FA
                const token = await getVerificationTokenByEmail(user.email);


                if (token.status !== 200 || !token.data || token.data.token !== code || new Date(token.data.expiredAt) < new Date()) {
                    // Incrémenter le compteur de tentatives 2FA
                    const updatedTwoFactorAttempts = (user.two_factor_attempts || 0) + 1;
                    let twoFactorBlockedUntil = null;

                    // Bloquer après 3 tentatives échouées
                    if (updatedTwoFactorAttempts >= 3) {
                        twoFactorBlockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
                    }

                    await prisma.user.update({
                        where: { id: user.id },
                        data: {
                            two_factor_attempts: updatedTwoFactorAttempts,
                            two_factor_blocked_until: twoFactorBlockedUntil,
                            last_two_factor_attempt: new Date()
                        }
                    });

                    const remainingAttempts = 3 - updatedTwoFactorAttempts;
                    let errorMessage = e('invalideorexpiredcode') || 'Invalid or expired code';

                    if (twoFactorBlockedUntil) {
                        errorMessage = u('twofactorblocked') || '2FA verification blocked for 15 minutes due to too many failed attempts.';
                    } else if (remainingAttempts > 0) {
                        errorMessage = `${e('invalideorexpiredcode')} - ${u('remainingattempts')} ${remainingAttempts}`;
                    }

                    return { status: 401, data: { message: errorMessage } };
                }

                // Réinitialiser le compteur 2FA en cas de succès
                if (user.two_factor_attempts > 0) {
                    await prisma.user.update({
                        where: { id: user.id },
                        data: {
                            two_factor_attempts: 0,
                            two_factor_blocked_until: null
                        }
                    });
                }

                await deleteVerificationTokenByEmail(user.email);
                await createTowFactorConfermation(user.id);
            }
        }

        // --- Connexion finale ---
        await signIn("credentials", { email: user.email, password, redirect: false });
        return { status: 200, data: user };

    } catch (error) {
        console.error("Login error:", error);

        // Gestion spécifique du verrouillage de compte
        if (error instanceof Error && error.message === "ACCOUNT_LOCKED") {
            return { status: 423, data: { message: u('accountlocked') || 'Your account is temporarily locked. Please try again in 15 minutes.' } };
        }

        return { status: 500, data: { message: e("errorinlogin") } };
    }
}
/**
 * Confirme l'inscription en vérifiant le code envoyé par email.
 */
export async function confermationRegister(data: any, email: string): Promise<AuthResponse> {
    const result = ConfirmationSchema.safeParse(data);
    const s = await getTranslations('System');
    const e = await getTranslations('Error');

    if (!result.success) {
        return { status: 400, data: result.error.errors };
    }
    const { code } = result.data;

    try {
        const user = await prisma.user.findFirst({
            where: { email, deleted_at: null }
        });

        if (!user) {
            return { status: 404, data: { message: e("usernotfound") } };
        }

        // Vérifier si l'utilisateur est bloqué pour la vérification
        if (user.verification_blocked_until && new Date(user.verification_blocked_until) > new Date()) {
            const blockedUntil = new Date(user.verification_blocked_until);
            const now = new Date();
            const minutesLeft = Math.ceil((blockedUntil.getTime() - now.getTime()) / (1000 * 60));

            return {
                status: 429,
                data: {
                    message: `${s("accountlocked2")} ${minutesLeft} ${s("minutes")}.`
                }
            };
        }

        const token = await getVerificationTokenByEmail(email);
        if (token.status !== 200 || !token.data || token.data.token !== code || new Date(token.data.expiredAt) < new Date()) {
            return { status: 400, data: { message: e("invalideorexpiredcode") } };
        }

        await deleteVerificationTokenByEmail(email);
        // Mettre à jour l'utilisateur et réinitialiser le compteur
        await prisma.user.update({
            where: { id: user.id },
            data: {
                email_verified: new Date(),
                verification_attempts: 0,
                last_verification_attempt: null,
                verification_blocked_until: null
            }
        });

        return { status: 200, data: { message: s("emailconfirmed") } };

    } catch (error) {
        console.error("Confirmation error:", error);
        return { status: 500, data: { message: e("errorconfirmation") } };
    }
}

// ----------------------------------------------------------------------
// Fonctions de Code de Vérification
// ----------------------------------------------------------------------

/**
 * Envoie un code de vérification pour la confirmation d'email ou autre usage non 2FA.
 */
export const SendVerificationCode = async (email: string): Promise<AuthResponse> => {
    const s = await getTranslations('System');
    const e = await getTranslations('Error');
    const u = await getTranslations('Users');

    try {
        const user = await prisma.user.findFirst({
            where: {
                email,
                deleted_at: null
            }
        });

        if (!user) {
            return { status: 404, data: { message: e("usernotfound") } };
        }

        // Vérifier si l'utilisateur est bloqué
        if (user.verification_blocked_until && new Date(user.verification_blocked_until) > new Date()) {
            const blockedUntil = new Date(user.verification_blocked_until);
            const now = new Date();
            const minutesLeft = Math.ceil((blockedUntil.getTime() - now.getTime()) / (1000 * 60));

            return {
                status: 429,
                data: {
                    message: `${s("accountlocked2")} ${minutesLeft} ${s("minutes")}.`
                }
            };
        }

        const tokenExisting = await getVerificationTokenByEmail(email);
        // Si un token existe et a été créé il y a moins d'une minute, empêcher le renvoi
        if (tokenExisting.status === 200 && tokenExisting.data) {
            const oneMinuteAgo = new Date(Date.now() - 1000 * 60);
            if (new Date(tokenExisting.data.createdAt) > oneMinuteAgo) {
                return { status: 429, data: { message: s("mustwait1minutes") } }; // 429 Too Many Requests
            }
            await deleteVerificationTokenByEmail(email);
        }

        // Incrémenter le compteur de tentatives
        const fifteenMinutesFromNow = new Date(Date.now() + 15 * 60 * 1000);

        await prisma.user.update({
            where: { id: user.id },
            data: {
                verification_attempts: user.verification_attempts + 1,
                last_verification_attempt: new Date(),
                verification_blocked_until: user.verification_attempts + 1 >= 3 ? fifteenMinutesFromNow : null
            }
        });

        // Si c'est la 3ème tentative, bloquer l'utilisateur
        if (user.verification_attempts + 1 >= 3) {
            await prisma.user.update({
                where: { id: user.id },
                data: {
                    verification_blocked_until: fifteenMinutesFromNow
                }
            });

            return {
                status: 429,
                data: {
                    message: u("accountlocked")
                }
            };
        }

        // Création d'un nouveau token (expiration par défaut, e.g., 1 heure)
        const token = await generateVerificationToken(email, 1);
        await sendCode({ email, code: token.data.token });
        return { status: 200, data: { message: s("codesent") } };
    } catch (error) {
        console.error("Error sending verification code:", error);
        return { status: 500, data: { message: e("errorsendcode") } };
    }
};

/**
 * Envoie un code de vérification pour l'authentification à deux facteurs (2FA).
 */
export const SendVerificationCode2FA = async (email: string): Promise<AuthResponse> => {
    const s = await getTranslations('System');
    const e = await getTranslations('Error');
    const u = await getTranslations('Users');

    try {
        const user = await prisma.user.findFirst({
            where: {
                email,
                deleted_at: null
            }
        });

        if (!user) {
            return { status: 404, data: { message: e("usernotfound") } };
        }

        // Vérifier le blocage 2FA
        const twoFALockCheck = await checkAndHandle2FALock(user);
        if (twoFALockCheck.isLocked) {
            return { status: 429, data: { message: twoFALockCheck.message || u("twofactorblocked") } };
        }

        const tokenExisting = await getVerificationTokenByEmail(email);
        // Si un token existe et a été créé il y a moins d'une minute, empêcher le renvoi
        if (tokenExisting.status === 200 && tokenExisting.data) {
            const oneMinuteAgo = new Date(Date.now() - 1000 * 60);
            if (new Date(tokenExisting.data.createdAt) > oneMinuteAgo) {
                return { status: 429, data: { message: s("mustwait1minutes") } };
            }
            await deleteVerificationTokenByEmail(email);
        }

        // Création d'un nouveau token
        const token = await generateVerificationToken(email, 1);
        await send2FACode({ email, code: token.data.token });
        return { status: 200, data: { message: s("codesent") } };

    } catch (error) {
        console.error("Error sending 2FA code:", error);
        return { status: 500, data: { message: e("error2afa") } };
    }
};

// ----------------------------------------------------------------------
// Fonction de Déconnexion
// ----------------------------------------------------------------------

/**
 * Gère la déconnexion de l'utilisateur et met à jour l'état de la session dans la BDD.
 */
export async function logoutUser(): Promise<AuthResponse> {
    const e = await getTranslations("Error");
    try {
        const session = await verifySession(); // Fonction pour vérifier la session actuelle

        if (session.status === 200 && session.data && session.data.session && session.data.session.id) {
            await prisma.session.update({
                where: { id: session.data.session.id },
                data: { active: false }
            });
        }

        await signOut({ redirect: false });
        return { status: 200, data: { message: 'Logout successful' } };
    } catch (error) {
        console.error("An error occurred in logout:", error);
        return { status: 500, data: { message: e("errorlogout") } };
    }
}


// Fonction pour vérifier et gérer le verrouillage du compte
async function checkAndHandleAccountLock(user: any): Promise<{ isLocked: boolean; message?: string }> {
    const u = await getTranslations("Users");
    const s = await getTranslations("System");

    if (user.locked_until && new Date(user.locked_until) > new Date()) {
        const remainingTime = Math.ceil((new Date(user.locked_until).getTime() - Date.now()) / (1000 * 60));
        return {
            isLocked: true,
            message: `${u("accountlocked2")} ${remainingTime} ${s("minutes")}.`
        };
    }

    return { isLocked: false };
}

// Fonction pour vérifier et gérer le blocage 2FA
async function checkAndHandle2FALock(user: any): Promise<{ isLocked: boolean; message?: string }> {
    const u = await getTranslations("Users");
    const s = await getTranslations("System");

    if (user.two_factor_blocked_until && new Date(user.two_factor_blocked_until) > new Date()) {
        const remainingTime = Math.ceil((new Date(user.two_factor_blocked_until).getTime() - Date.now()) / (1000 * 60));
        return {
            isLocked: true,
            message: `${u("twofactorblocked")} ${remainingTime} ${s("minutes")}.`
        };
    }

    return { isLocked: false };
}
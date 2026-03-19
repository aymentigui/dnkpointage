"use client"
import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from "@hookform/resolvers/zod"
import {
    Form, FormField, FormControl, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { loginUser, SendVerificationCode, SendVerificationCode2FA } from '@/actions/auth/auth'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'
import { getConfirmationCodePasswordChange } from '@/actions/auth/password-change'
import { useTranslations } from 'next-intl'
import { Eye, EyeOff, Loader2, Shield, Mail, Lock } from 'lucide-react'
import { useSession } from '@/hooks/use-session'
import Link from 'next/link'
import OAuthButtons from '@/components/myui/OAuthButtons'

// --- Schéma de Validation ---
const LoginSchema = (u: any) => z.object({
    email: z.string({ required_error: u("emailrequired") }),
    password: z.string({ required_error: u("passwordrequired") }).min(6, { message: u("password6") }),
    code: z.string().optional(),
});
type LoginFormData = z.infer<ReturnType<typeof LoginSchema>>;

const LoginForm = () => {
    const [loading, setLoading] = useState(false);
    const [twoFactorConfirmation, setTwoFactorConfirmation] = useState(false);
    const router = useRouter();
    const [hidePassword, setHidePassword] = useState(true);
    const { setSession } = useSession();

    const t = useTranslations("Settings");
    const s = useTranslations("System");
    const u = useTranslations("Users");

    const form = useForm<LoginFormData>({
        resolver: zodResolver(LoginSchema(u)),
        defaultValues: { email: "", password: "", code: "" },
    });

    // --- Gestion du Soumission du Formulaire ---
    const onSubmit = async (values: LoginFormData) => {
        setLoading(true);
        try {
            const res = await loginUser(values);

            if (res.status === 200) {
                toast.success(res.data.message || s("login_success"));
                setSession(res);
                router.push("/");
            } else if (res.status === 202 && res.data.twoFactorConfermation) {
                toast(res.data.message || s("2fa_code_sent"), { icon: '🔑' });
                setTwoFactorConfirmation(true);
            } else if (res.status === 403 && res.data.emailNotVerified) {
                await SendVerificationCode(values.email);
                router.push(`/auth/confermation?email=${encodeURIComponent(values.email)}`);
            } else if (res.status === 423) {
                // Compte verrouillé
                toast.error(res.data.message || s("account_locked"));
            } else {
                toast.error(res.data.message || s("login_error"));
            }
        } catch (error) {
            toast.error(s("unexpected_error"));
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    // --- Mot de passe oublié ---
    const passwordForget = async () => {
        const email = form.getValues().email;
        if (!email) {
            toast.error(t("emailorusername_required"));
            return;
        }
        setLoading(true);
        try {
            const res = await getConfirmationCodePasswordChange(email);
            if (res.status === 200) {
                router.push(`/auth/reset?email=${encodeURIComponent(email)}`);
            } else {
                toast.error(res.data.message || s("password_reset_error"));
            }
        } catch (error) {
            toast.error(s("unexpected_error"));
        } finally {
            setLoading(false);
        }
    };

    // --- Renvoyer le code 2FA/Vérification ---
    const resendTheCode = async () => {
        const email = form.getValues().email;
        if (!email) {
            toast.error(t("emailorusername_required"));
            return;
        }
        setLoading(true);
        try {
            const res = await SendVerificationCode2FA(email);
            if (res.status === 200) {
                toast.success(s("verificationemailsent"));
            } else if (res.status === 429) {
                toast.error(res.data.message || s("twofactorblocked"));
            } else {
                toast.error(res.data.message || s("resend_code_error"));
            }
        } catch (error) {
            toast.error(s("unexpected_error"));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full space-y-6">
            {/* En-tête conditionnel pour 2FA */}
            {twoFactorConfirmation && (
                <div className="text-center p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                    <div className="flex items-center justify-center mb-2">
                        <Shield className="w-6 h-6 text-yellow-400 mr-2" />
                        <h3 className="text-lg font-semibold text-yellow-400">
                            {s("2fa_required")}
                        </h3>
                    </div>
                    <p className="text-yellow-300 text-sm">
                        Un code de vérification a été envoyé à votre email
                    </p>
                </div>
            )}

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    {/* CHAMPS DE CONNEXION */}
                    {!twoFactorConfirmation && (
                        <>
                            <FormField
                                control={form.control}
                                name="email"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className='text-sm font-medium text-foreground/50'>
                                            {t("emailorusername")}
                                        </FormLabel>
                                        <FormControl>
                                            <div className="relative">
                                                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-foreground/70" />
                                                <Input
                                                    placeholder={t("emailorusername")}
                                                    {...field}
                                                    className="w-full pl-10 pr-4 py-3 bg-foreground/5 border border-foreground/10 text-foreground placeholder-foreground/70 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                                />
                                            </div>
                                        </FormControl>
                                        <FormMessage className='text-xs font-semibold text-red-300' />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="password"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className='text-sm font-medium text-foreground/50'>
                                            {t("password")}
                                        </FormLabel>
                                        <FormControl>
                                            <div className='relative'>
                                                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-foreground/70" />
                                                <Input
                                                    type={hidePassword ? "password" : "text"}
                                                    placeholder={t("password")}
                                                    {...field}
                                                    className="w-full pl-10 pr-12 py-3 bg-foreground/5 border border-foreground/10 text-foreground placeholder-foreground/70 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                                />
                                                <div
                                                    onClick={() => setHidePassword(!hidePassword)}
                                                    className='absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer text-foreground/70 hover:text-foreground/40 transition-colors duration-200'
                                                >
                                                    {hidePassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                                </div>
                                            </div>
                                        </FormControl>
                                        <FormMessage className='text-xs font-semibold text-red-300' />
                                    </FormItem>
                                )}
                            />
                        </>
                    )}

                    {/* CHAMP DE CODE 2FA */}
                    {twoFactorConfirmation && (
                        <FormField
                            control={form.control}
                            name="code"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className='text-sm font-medium text-foreground/40'>
                                        {t("codeverification")}
                                    </FormLabel>
                                    <FormControl>
                                        <div className="relative">
                                            <Shield className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-foreground/70" />
                                            <Input
                                                placeholder={t("codeverification")}
                                                {...field}
                                                className="w-full pl-10 pr-4 py-3 bg-foreground/5 border border-foreground/10 text-foreground placeholder-foreground/70 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-center text-lg tracking-widest"
                                            />
                                        </div>
                                    </FormControl>
                                    <FormMessage className='text-xs font-semibold text-red-300' />
                                </FormItem>
                            )}
                        />
                    )}

                    {/* ACTIONS SECONDAIRES */}
                    <div className='flex justify-between items-center pt-2'>
                        <Button
                            variant='link'
                            type='button'
                            onClick={passwordForget}
                            className='p-0 text-sm text-blue-700 hover:text-blue-400 transition duration-150'
                            disabled={loading || twoFactorConfirmation}
                        >
                            {t("forgetpassword")}
                        </Button>
                        {twoFactorConfirmation && (
                            <Button
                                variant='link'
                                type='button'
                                onClick={resendTheCode}
                                className='p-0 text-sm text-blue-700 hover:text-blue-400 transition duration-150'
                                disabled={loading}
                            >
                                {s("resendthecode")}
                            </Button>
                        )}
                    </div>

                    {/* BOUTON PRINCIPAL */}
                    <div className='pt-3'>
                        <Button
                            disabled={loading}
                            type="submit"
                            className={cn(
                                'w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white/80 font-bold rounded-xl hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900 transition-all duration-300 transform hover:scale-[1.02] shadow-lg',
                                loading && 'opacity-70 cursor-not-allowed hover:scale-100',
                            )}
                        >
                            {loading ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : twoFactorConfirmation ? (
                                <Shield className="mr-2 h-4 w-4" />
                            ) : (
                                <Mail className="mr-2 h-4 w-4" />
                            )}
                            {twoFactorConfirmation ? s("confirm") : s("login")}
                        </Button>
                    </div>
                </form>
            </Form>
        </div>
    )
}

export default LoginForm
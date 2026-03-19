"use client"
import React, { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from "@hookform/resolvers/zod"
import {
    Form,
    FormField,
    FormControl,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import { useRouter, useSearchParams } from 'next/navigation'
import { resetPasswordWithoutConnection } from '@/actions/auth/password-change'
import { useTranslations } from 'next-intl'
import { Loader2, Key, Lock, ShieldCheck, Eye, EyeOff } from 'lucide-react'

const ResetForm = () => {
    const [loading, setLoading] = useState(false)
    const [passwordForget, setPasswordForget] = useState(false)
    const [hidePassword, setHidePassword] = useState(true)
    const [hideConfirmPassword, setHideConfirmPassword] = useState(true)
    const router = useRouter()
    const params = useSearchParams()
    const email = params.get('email')

    const u = useTranslations('Users');
    const s = useTranslations('System');
    const st = useTranslations('Settings');    
    const t = useTranslations('Settings');

    // Redirection si email manquant
    useEffect(() => {
        if (!email) {
            toast.error("Email non trouvé");
            router.push('/auth/login');
        }
    }, [email, router]);

    const ResetSchema = z.object({
        password: z.string().min(6, { message: u("password6") }),
        passwordConfermation: z.string(),
        code: z.string().min(1, { message: "Le code de vérification est requis" }),
    }).refine((data) => data.password === data.passwordConfermation, {
        message: u("confirmpasswordnotmatch"),
        path: ["passwordConfermation"],
    });

    const form = useForm<z.infer<typeof ResetSchema>>({
        resolver: zodResolver(ResetSchema),
        defaultValues: {
            passwordConfermation: "",
            password: "",
            code: "",
        },
    })

    async function onSubmit(values: z.infer<typeof ResetSchema>) {
        if (!email) {
            toast.error("Email non trouvé");
            router.push('/auth/login');
            return;
        }
    
        setLoading(true);
        
        try {
            const data = {
                email: email,
                password: values.password,
                code: values.code
            }
            
            const res = await resetPasswordWithoutConnection(data);
            
            if (res.status === 200) {
                if (res.data.codeConfirmed && !passwordForget) {
                    setPasswordForget(true);
                    toast.success("Code vérifié ! Définissez votre nouveau mot de passe");
                    form.resetField('password');
                    form.resetField('passwordConfermation');
                } else if (passwordForget) {
                    toast.success(s("password_reset_success") || "Mot de passe réinitialisé avec succès");
                    router.push('/auth/login');
                }
            } else if (res.status === 429) {
                // Gestion du blocage
                toast.error(res.data.message || "Trop de tentatives. Compte bloqué temporairement.");
            } else {
                toast.error(res.data.message || "Erreur lors de la réinitialisation");
            }
        } catch (error) {
            toast.error(s("unexpected_error") || "Une erreur inattendue est survenue");
            console.error(error);
        } finally {
            setLoading(false);
        }
    }
    
    if (!email) {
        return (
            <div className="flex justify-center items-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    return (
        <div className="w-full space-y-6">
            {/* Indicateur de progression */}
            <div className="flex items-center justify-center space-x-4 mb-6">
                <div className={cn(
                    "flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold transition-all duration-300",
                    !passwordForget 
                        ? "bg-blue-500 text-foreground shadow-lg" 
                        : "bg-green-500 text-foreground shadow-lg"
                )}>
                    1
                </div>
                <div className="w-12 h-1 bg-foreground/80 rounded-full"></div>
                <div className={cn(
                    "flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold transition-all duration-300",
                    passwordForget 
                        ? "bg-green-500 text-foreground shadow-lg" 
                        : "bg-foreground/80 text-foreground/60"
                )}>
                    2
                </div>
            </div>

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    {/* Étape 1: Code de vérification */}
                    {!passwordForget && (
                        <div className="space-y-4">
                            <div className="text-center p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                                <div className="flex items-center justify-center mb-2">
                                    <ShieldCheck className="w-6 h-6 text-blue-400 mr-2" />
                                    <h3 className="text-lg font-semibold text-blue-400">
                                        {s("verificationcode")}
                                    </h3>
                                </div>
                                <p className="text-blue-300 text-sm">
                                    {s("entercode")} {email}
                                </p>
                            </div>

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
                                                <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-foreground/60" />
                                                <Input
                                                    placeholder="XXXXXX"
                                                    {...field}
                                                    className="w-full pl-10 pr-4 py-3 bg-foreground/5 border border-foreground/10 text-foreground placeholder-foreground/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-center text-lg tracking-widest font-mono"
                                                    maxLength={6}
                                                />
                                            </div>
                                        </FormControl>
                                        <FormMessage className='text-xs font-semibold text-red-300' />
                                    </FormItem>
                                )}
                            />
                        </div>
                    )}

                    {/* Étape 2: Nouveau mot de passe */}
                    {passwordForget && (
                        <div className="space-y-4">
                            <div className="text-center p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                                <div className="flex items-center justify-center mb-2">
                                    <Lock className="w-6 h-6 text-green-400 mr-2" />
                                    <h3 className="text-lg font-semibold text-green-400">
                                        {st("newpassword")}
                                    </h3>
                                </div>
                                <p className="text-green-300 text-sm">
                                    {st("selectnewpassword")}
                                </p>
                            </div>

                            <FormField
                                control={form.control}
                                name="password"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className='text-sm font-medium text-foreground/40'>
                                            {t("password")}
                                        </FormLabel>
                                        <FormControl>
                                            <div className="relative">
                                                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-foreground/60" />
                                                <Input
                                                    type={hidePassword ? "password" : "text"}
                                                    placeholder={t("password")}
                                                    {...field}
                                                    className="w-full pl-10 pr-12 py-3 bg-foreground/5 border border-foreground/10 text-foreground placeholder-foreground/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                                />
                                                <div
                                                    onClick={() => setHidePassword(!hidePassword)}
                                                    className='absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer text-foreground/60 hover:text-foreground/40 transition-colors duration-200'
                                                >
                                                    {hidePassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                                </div>
                                            </div>
                                        </FormControl>
                                        <FormMessage className='text-xs font-semibold text-red-300' />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="passwordConfermation"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className='text-sm font-medium text-foreground/40'>
                                            {t("confirmpassword")}
                                        </FormLabel>
                                        <FormControl>
                                            <div className="relative">
                                                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-foreground/60" />
                                                <Input
                                                    type={hideConfirmPassword ? "password" : "text"}
                                                    placeholder={t("confirmpassword")}
                                                    {...field}
                                                    className="w-full pl-10 pr-12 py-3 bg-foreground/5 border border-foreground/10 text-foreground placeholder-foreground/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                                />
                                                <div
                                                    onClick={() => setHideConfirmPassword(!hideConfirmPassword)}
                                                    className='absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer text-foreground/60 hover:text-foreground/40 transition-colors duration-200'
                                                >
                                                    {hideConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                                </div>
                                            </div>
                                        </FormControl>
                                        <FormMessage className='text-xs font-semibold text-red-300' />
                                    </FormItem>
                                )}
                            />
                        </div>
                    )}

                    {/* Bouton de soumission */}
                    <div className='pt-4'>
                        <Button
                            disabled={loading}
                            type="submit"
                            className={cn(
                                'w-full py-3 px-4 bg-gradient-to-r from-green-600 to-blue-600 text-white font-bold rounded-xl hover:from-green-700 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-slate-900 transition-all duration-300 transform hover:scale-[1.02] shadow-lg',
                                loading && 'opacity-70 cursor-not-allowed hover:scale-100',
                            )}
                        >
                            {loading ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : passwordForget ? (
                                <Lock className="mr-2 h-4 w-4" />
                            ) : (
                                <Key className="mr-2 h-4 w-4" />
                            )}
                            {!passwordForget ? s("next") : s("reset")}
                        </Button>
                    </div>
                </form>

                {/* Lien de retour */}
                <div className="mt-6 text-center">
                    <Button
                        variant='link'
                        onClick={() => router.push('/auth/login')}
                        className='p-0 text-sm text-foreground/60 hover:text-foreground transition duration-150'
                    >
                        ← {s("backtologin")}
                    </Button>
                </div>
            </Form>
        </div>
    )
}

export default ResetForm
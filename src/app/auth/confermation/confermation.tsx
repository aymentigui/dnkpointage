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
import { useTranslations } from 'next-intl'
import { confermationRegister, SendVerificationCode } from '@/actions/auth/auth'
import { Loader2, MailCheck, RotateCcw, Shield } from 'lucide-react'

const ConfermationFrom = () => {
    const [loading, setLoading] = useState(false)
    const [resendLoading, setResendLoading] = useState(false)
    const [email, setEmail] = useState<string | null>(null)
    const [isBlocked, setIsBlocked] = useState(false)
    const [blockedUntil, setBlockedUntil] = useState<Date | null>(null)
    const [attempts, setAttempts] = useState(0)
    const router = useRouter()
    const searchParams = useSearchParams()

    const s = useTranslations("System")
    const l = useTranslations("Login")

    // Récupération de l'email depuis les paramètres d'URL
    useEffect(() => {
        const emailParam = searchParams.get("email")
        if (!emailParam) {
            toast.error("Email non trouvé")
            router.push("/auth/login")
            return
        }
        setEmail(emailParam)
    }, [searchParams, router])

    const confermationSchema = z.object({
        code: z.string().min(1, { message: "Le code de vérification est requis" }),
    });

    const form = useForm<z.infer<typeof confermationSchema>>({
        resolver: zodResolver(confermationSchema),
        defaultValues: {
            code: "",
        },
    })

    async function onSubmit(values: z.infer<typeof confermationSchema>) {
        if (!email) {
            toast.error("Email non trouvé")
            router.push("/auth/login")
            return
        }

        setLoading(true)
        try {
            const res = await confermationRegister(values, email)
            if (res.status === 200) {
                toast.success(s("registersuccess") || "Compte vérifié avec succès !")
                router.push("/auth/login")
            } else {
                toast.error(res.data.message || "Erreur lors de la vérification")
            }
        } catch (error) {
            toast.error(s("unexpected_error") || "Une erreur inattendue est survenue")
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    const resendTheCode = async () => {
        if (!email) {
            toast.error("Email non trouvé")
            router.push("/auth/login")
            return
        }

        setResendLoading(true)
        try {
            const res = await SendVerificationCode(email)
            if (res.status === 200) {
                toast.success(s("verificationemailsent") || "Code de vérification renvoyé !")
            } else if (res.status === 429) {
                toast.error(res.data.message || "Trop de tentatives")
                if (res.data.message?.includes('bloqué')) {
                    setIsBlocked(true)
                    // Extraire la date de blocage si disponible
                    const blockedTime = new Date(Date.now() + 15 * 60 * 1000)
                    setBlockedUntil(blockedTime)
                }
            } else {
                toast.error(res.data.message || "Erreur lors de l'envoi du code")
            }
        } catch (error) {
            toast.error(s("unexpected_error") || "Une erreur inattendue est survenue")
            console.error(error)
        } finally {
            setResendLoading(false)
        }
    }

    useEffect(() => {
        if (isBlocked && blockedUntil) {
            const interval = setInterval(() => {
                const now = new Date()
                if (now >= blockedUntil) {
                    setIsBlocked(false)
                    setBlockedUntil(null)
                    setAttempts(0)
                    clearInterval(interval)
                }
            }, 1000)

            return () => clearInterval(interval)
        }
    }, [isBlocked, blockedUntil])

    const getRemainingTime = () => {
        if (!blockedUntil) return 0
        const now = new Date()
        const diff = blockedUntil.getTime() - now.getTime()
        return Math.max(0, Math.ceil(diff / 1000 / 60)) // en minutes
    }

    const remainingMinutes = getRemainingTime()

    if (!email) {
        return (
            <div className="flex justify-center items-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        )
    }

    return (
        <div className="w-full space-y-6">
            {/* Informations sur l'email */}
            <div className="text-center p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <div className="flex items-center justify-center mb-2">
                    <MailCheck className="w-6 h-6 text-blue-400 mr-2" />
                    <h3 className="text-lg font-semibold text-blue-400">
                        {l("verification_pending")}
                    </h3>
                </div>
                <p className="text-blue-300 text-sm mb-2">
                    {l("verification_code_sent")}
                </p>
                <p className="text-foreground font-medium text-sm">{email}</p>
            </div>

            {/* Avertissement tentatives */}
            {attempts > 0 && !isBlocked && (
                <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                    <p className="text-yellow-400 text-sm text-center">
                        {l("attempts_warning", { attempts })}
                    </p>
                </div>
            )}

            {/* Message de blocage */}
            {isBlocked && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <div className="flex items-center justify-center mb-2">
                        <Shield className="w-6 h-6 text-red-400 mr-2" />
                        <h3 className="text-lg font-semibold text-red-400">
                            {l("account_temporarily_blocked")}
                        </h3>
                    </div>
                    <p className="text-red-300 text-sm text-center">
                        {l("too_many_attempts", { minutes: remainingMinutes })}
                    </p>
                </div>
            )}

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                        control={form.control}
                        name="code"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className='text-sm font-medium text-foreground/40'>
                                    {l("code_verification")}
                                </FormLabel>
                                <FormControl>
                                    <div className="relative">
                                        <Shield className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-foreground/60" />
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
                    
                    {/* Bouton de confirmation */}
                    <div className='pt-4'>
                        <Button
                            disabled={loading}
                            type="submit"
                            className={cn(
                                'w-full py-3 px-4 bg-gradient-to-r from-yellow-600 to-orange-600 text-white font-bold rounded-xl hover:from-yellow-700 hover:to-orange-700 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 focus:ring-offset-slate-900 transition-all duration-300 transform hover:scale-[1.02] shadow-lg',
                                loading && 'opacity-70 cursor-not-allowed hover:scale-100'
                            )}
                        >
                            {loading ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <MailCheck className="mr-2 h-4 w-4" />
                            )}
                            {l("confirm")}
                        </Button>
                    </div>
                </form>

                {/* Bouton renvoyer le code */}
                <div className="mt-6 text-center">
                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-foreground/10"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-2 bg-transparent text-foreground/60">
                                {l("did_not_receive_code")}
                            </span>
                        </div>
                    </div>
                    
                    <Button 
                        variant='outline'
                        type='button' 
                        onClick={resendTheCode}
                        disabled={resendLoading || isBlocked}
                        className='w-full mt-4 py-3 border-foreground/20 text-foreground hover:bg-foreground/10 hover:text-foreground transition-all duration-200 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed'
                    >
                        {resendLoading ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <RotateCcw className="mr-2 h-4 w-4" />
                        )}
                        {isBlocked ? l("blocked", { minutes: remainingMinutes }) : l("resend_code")}
                    </Button>
                </div>

                {/* Lien de retour */}
                <div className="mt-4 text-center">
                    <Button
                        variant='link'
                        onClick={() => router.push('/auth/login')}
                        className='p-0 text-sm text-foreground/60 hover:text-foreground transition duration-150'
                    >
                        {l("back_to_login")}
                    </Button>
                </div>
            </Form>
        </div>
    )
}


export default ConfermationFrom
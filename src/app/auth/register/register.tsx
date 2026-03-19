"use client"
import React, { useState } from 'react'
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
import { registerUser } from '@/actions/auth/auth'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Loader2, User, Mail, Lock, Eye, EyeOff, UserPlus } from 'lucide-react'
import OAuthButtons from '@/components/myui/OAuthButtons'

const RegisterForm = () => {
    const [loading, setLoading] = useState(false)
    const [hidePassword, setHidePassword] = useState(true)
    const [hideConfirmPassword, setHideConfirmPassword] = useState(true)
    const u = useTranslations('Users');
    const s = useTranslations('System');
    const t = useTranslations('Settings');
    const router = useRouter()

    const RegisterSchema = z.object({
        firstname: z.string({ required_error: u("firstnamerequired") }),
        lastname: z.string({ required_error: u("lastnamerequired") }),
        username: z
            .string({ required_error: u("usernamerequired") })
            .min(3, { message: u("username6") })
            .max(20, { message: u("username20") }),
        email: z.string({ required_error: u("emailrequired") }).email({ message: u("emailinvalid") }),
        password: z.string({ required_error: u("passwordrequired") }).min(6, { message: u("password6") }),
        passwordConfirm: z.string({ required_error: u("confirmpasswordrequired") }).min(6, { message: u("password6") }),
    }).refine((data) => data.password === data.passwordConfirm, {
        path: ["passwordConfirm"],
        message: u("confirmpasswordnotmatch"),
    });

    const form = useForm<z.infer<typeof RegisterSchema>>({
        resolver: zodResolver(RegisterSchema),
        defaultValues: {
            firstname: "",
            lastname: "",
            username: "",
            email: "",
            password: "",
            passwordConfirm: "",
        },
    })

    async function onSubmit(values: z.infer<typeof RegisterSchema>) {
        setLoading(true)
        try {
            const res = await registerUser(values)
            if (res.status === 201) {
                toast.success("Compte créé avec succès ! Vérifiez votre email.")
                router.push(`/auth/confermation?email=${encodeURIComponent(values.email)}`)
            } else {
                toast.error(res.data.message || "Erreur lors de l'inscription")
            }
        } catch (error) {
            toast.error(s("unexpected_error") || "Une erreur inattendue est survenue")
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="w-full space-y-4">
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    {/* Prénom et Nom */}
                    <div className='flex gap-3'>
                        <FormField
                            control={form.control}
                            name="firstname"
                            render={({ field }) => (
                                <FormItem className='flex-1'>
                                    <FormLabel className='text-sm font-medium text-foreground/40'>{u("firstname")}</FormLabel>
                                    <FormControl>
                                        <div className="relative">
                                            <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-foreground/60" />
                                            <Input 
                                                placeholder={u("firstname")} 
                                                {...field}
                                                className="w-full pl-10 pr-4 py-3 bg-foreground/5 border border-foreground/10 text-foreground placeholder-foreground/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                            />
                                        </div>
                                    </FormControl>
                                    <FormMessage className='text-xs font-semibold text-red-300' />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="lastname"
                            render={({ field }) => (
                                <FormItem className='flex-1'>
                                    <FormLabel className='text-sm font-medium text-foreground/40'>{u("lastname")}</FormLabel>
                                    <FormControl>
                                        <div className="relative">
                                            <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-foreground/60" />
                                            <Input 
                                                placeholder={u("lastname")} 
                                                {...field}
                                                className="w-full pl-10 pr-4 py-3 bg-foreground/5 border border-foreground/10 text-foreground placeholder-foreground/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                            />
                                        </div>
                                    </FormControl>
                                    <FormMessage className='text-xs font-semibold text-red-300' />
                                </FormItem>
                            )}
                        />
                    </div>

                    {/* Nom d'utilisateur */}
                    <FormField
                        control={form.control}
                        name="username"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className='text-sm font-medium text-foreground/40'>{t("username")}</FormLabel>
                                <FormControl>
                                    <div className="relative">
                                        <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-foreground/60" />
                                        <Input 
                                            placeholder={t("username")} 
                                            {...field}
                                            className="w-full pl-10 pr-4 py-3 bg-foreground/5 border border-foreground/10 text-foreground placeholder-foreground/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                        />
                                    </div>
                                </FormControl>
                                <FormMessage className='text-xs font-semibold text-red-300' />
                            </FormItem>
                        )}
                    />

                    {/* Email */}
                    <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className='text-sm font-medium text-foreground/40'>{t("email")}</FormLabel>
                                <FormControl>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-foreground/60" />
                                        <Input 
                                            placeholder={t("email")} 
                                            {...field}
                                            className="w-full pl-10 pr-4 py-3 bg-foreground/5 border border-foreground/10 text-foreground placeholder-foreground/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                        />
                                    </div>
                                </FormControl>
                                <FormMessage className='text-xs font-semibold text-red-300' />
                            </FormItem>
                        )}
                    />

                    {/* Mot de passe */}
                    <FormField
                        control={form.control}
                        name="password"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className='text-sm font-medium text-foreground/40'>{t("password")}</FormLabel>
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

                    {/* Confirmation mot de passe */}
                    <FormField
                        control={form.control}
                        name="passwordConfirm"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className='text-sm font-medium text-foreground/40'>{t("confirmpassword")}</FormLabel>
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

                    {/* Bouton d'inscription */}
                    <div className='pt-4'>
                        <Button
                            disabled={loading}
                            type="submit"
                            className={cn(
                                'w-full py-3 px-4 bg-gradient-to-r from-green-600 to-teal-600 text-white font-bold rounded-xl hover:from-green-700 hover:to-teal-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-slate-900 transition-all duration-300 transform hover:scale-[1.02] shadow-lg',
                                loading && 'opacity-70 cursor-not-allowed hover:scale-100'
                            )}
                        >
                            {loading ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <UserPlus className="mr-2 h-4 w-4" />
                            )}
                            {s("register")}
                        </Button>
                    </div>
                </form>

                <OAuthButtons className="mt-6" />

                {/* Lien vers la connexion */}
                <div className="mt-6 text-center">
                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-foreground/10"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-2 bg-transparent text-foreground/60">
                                {s("haveanaccount")}
                            </span>
                        </div>
                    </div>
                    
                    <Button 
                        variant='outline'
                        type='button' 
                        onClick={() => router.push("/auth/login")}
                        className='w-full mt-4 py-3 border-foreground/20 text-foreground hover:bg-foreground/10 hover:text-foreground transition-all duration-200 rounded-xl'
                    >
                        {t("youhaveaccount")}
                    </Button>
                </div>
            </Form>
        </div>
    )
}

export default RegisterForm
"use client"
import React, { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from "@hookform/resolvers/zod"
import {
    Form, FormField, FormControl, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { loginUser, SendVerificationCode, SendVerificationCode2FA } from '@/actions/auth/auth'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'
import { getConfirmationCodePasswordChange } from '@/actions/auth/password-change'
import {
    Eye, EyeOff, Loader2, Shield, Mail, Lock,
    ArrowRight, CheckCircle2,
} from 'lucide-react'
import { useSession } from '@/hooks/use-session'
import { cn } from '@/lib/utils'

// ─── Schéma ───────────────────────────────────────────────────

const LoginSchema = z.object({
    email: z.string({ required_error: "L'email est requis" }),
    password: z.string({ required_error: "Le mot de passe est requis" }).min(6, { message: "Minimum 6 caractères" }),
    code: z.string().optional(),
});
type LoginFormData = z.infer<typeof LoginSchema>;

// ─── Background décoratif ─────────────────────────────────────

function Background() {
    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full"
                style={{ background: "radial-gradient(circle, rgba(0,143,74,0.08) 0%, transparent 65%)" }} />
            <div className="absolute -bottom-20 -left-20 w-[350px] h-[350px] rounded-full"
                style={{ background: "radial-gradient(circle, rgba(0,143,74,0.05) 0%, transparent 65%)" }} />
            <svg className="absolute inset-0 w-full h-full" style={{ opacity: 0.04 }}>
                <defs>
                    <pattern id="g" width="44" height="44" patternUnits="userSpaceOnUse">
                        <path d="M 44 0 L 0 0 0 44" fill="none" stroke="#008F4A" strokeWidth="0.6" />
                    </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#g)" />
            </svg>
        </div>
    );
}

// ─── InputField ───────────────────────────────────────────────

function InputField({
    icon: Icon, type, placeholder, field, rightElement, hasError,
}: {
    icon: any; type?: string; placeholder: string;
    field: any; rightElement?: React.ReactNode; hasError?: boolean;
}) {
    const [focused, setFocused] = useState(false);
    return (
        <div className={cn(
            "relative flex items-center rounded-xl border bg-white transition-all duration-200",
            focused ? "border-[#008F4A] shadow-[0_0_0_3px_rgba(0,143,74,0.12)]"
                : hasError ? "border-rose-300"
                    : "border-slate-200 hover:border-slate-300 shadow-sm"
        )}>
            <Icon className={cn(
                "absolute left-3.5 w-4 h-4 shrink-0 transition-colors duration-200",
                focused ? "text-[#008F4A]" : "text-slate-400"
            )} />
            <Input
                type={type}
                placeholder={placeholder}
                {...field}
                onFocus={e => { setFocused(true); field.onFocus?.(e); }}
                onBlur={e => { setFocused(false); field.onBlur?.(e); }}
                className="w-full pl-10 pr-11 py-3 bg-transparent border-0 shadow-none focus:ring-0 focus:outline-none text-slate-800 placeholder-slate-400 text-sm"
            />
            {rightElement && <div className="absolute right-3.5">{rightElement}</div>}
        </div>
    );
}

// ─── LoginForm ────────────────────────────────────────────────

const LoginForm = () => {
    const [loading, setLoading] = useState(false);
    const [twoFactor, setTwoFactor] = useState(false);
    const [hidePassword, setHidePassword] = useState(true);
    const [success, setSuccess] = useState(false);
    const [mounted, setMounted] = useState(false);

    const router = useRouter();
    const { setSession } = useSession();

    useEffect(() => { setMounted(true); }, []);

    const form = useForm<LoginFormData>({
        resolver: zodResolver(LoginSchema),
        defaultValues: { email: "", password: "", code: "" },
    });

    const onSubmit = async (values: LoginFormData) => {
        setLoading(true);
        try {
            const res = await loginUser(values);
            if (res.status === 200) {
                setSuccess(true);
                setTimeout(() => { setSession(res); router.push("/workspaces"); }, 700);
            } else if (res.status === 202 && res.data.twoFactorConfermation) {
                toast("Code envoyé par email", { icon: "🔑" });
                setTwoFactor(true);
            } else if (res.status === 403 && res.data.emailNotVerified) {
                await SendVerificationCode(values.email);
                router.push(`/auth/confermation?email=${encodeURIComponent(values.email)}`);
            } else if (res.status === 423) {
                toast.error(res.data.message || "Compte verrouillé temporairement");
            } else {
                toast.error(res.data.message || "Identifiants incorrects");
            }
        } catch {
            toast.error("Erreur inattendue, réessayez");
        } finally { setLoading(false); }
    };

    const passwordForget = async () => {
        const email = form.getValues().email;
        if (!email) { toast.error("Entrez votre email d'abord"); return; }
        setLoading(true);
        try {
            const res = await getConfirmationCodePasswordChange(email);
            if (res.status === 200) router.push(`/auth/reset?email=${encodeURIComponent(email)}`);
            else toast.error(res.data.message || "Erreur");
        } catch { toast.error("Erreur inattendue"); }
        finally { setLoading(false); }
    };

    const resendCode = async () => {
        const email = form.getValues().email;
        if (!email) { toast.error("Email requis"); return; }
        setLoading(true);
        try {
            const res = await SendVerificationCode2FA(email);
            if (res.status === 200) toast.success("Code renvoyé");
            else toast.error(res.data.message || "Erreur");
        } catch { toast.error("Erreur inattendue"); }
        finally { setLoading(false); }
    };

    if (!mounted) return null;

    return (
        <>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
                @keyframes fadeUp {
                    from { opacity: 0; transform: translateY(12px); }
                    to   { opacity: 1; transform: translateY(0);    }
                }
                @keyframes slideBar {
                    0%   { background-position: 0% 0;    }
                    100% { background-position: 200% 0;  }
                }
                @keyframes checkIn {
                    0%  { transform: scale(0); opacity: 0; }
                    70% { transform: scale(1.2);           }
                    100%{ transform: scale(1); opacity: 1; }
                }
                .a1 { animation: fadeUp 0.4s ease forwards;        opacity: 0; }
                .a2 { animation: fadeUp 0.4s .06s ease forwards;   opacity: 0; }
                .a3 { animation: fadeUp 0.4s .12s ease forwards;   opacity: 0; }
                .a4 { animation: fadeUp 0.4s .18s ease forwards;   opacity: 0; }
                .a5 { animation: fadeUp 0.4s .24s ease forwards;   opacity: 0; }
                .a6 { animation: fadeUp 0.4s .30s ease forwards;   opacity: 0; }
            `}</style>

            <div
                className="fixed inset-0 flex items-center justify-center"
                style={{
                    background: "linear-gradient(150deg, #f0faf5 0%, #fafffe 40%, #f4f9ff 100%)",
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                }}
            >
                <Background />

                {/* ── Card ── */}
                <div className="relative z-10 w-full max-w-[400px] mx-4 a1">
                    <div
                        className="rounded-2xl overflow-hidden"
                        style={{
                            background: "rgba(255,255,255,0.95)",
                            border: "1px solid rgba(0,143,74,0.13)",
                            boxShadow: "0 8px 40px rgba(0,143,74,0.07), 0 2px 8px rgba(0,0,0,0.05), 0 0 0 1px rgba(255,255,255,0.8) inset",
                        }}
                    >
                        {/* Barre verte animée en haut */}
                        <div
                            className="h-[3px] w-full"
                            style={{
                                background: "linear-gradient(90deg, #008F4A, #00d46a, #00c25f, #008F4A)",
                                backgroundSize: "200% 100%",
                                animation: "slideBar 2.5s linear infinite",
                            }}
                        />

                        <div className="px-8 py-7 space-y-5">

                            {/* ── En-tête ── */}
                            <div className="a2 flex items-center gap-3.5">
                                <div
                                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                                    style={{ background: "linear-gradient(135deg, #008F4A, #00b85f)", boxShadow: "0 3px 10px rgba(0,143,74,0.3)" }}
                                >
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                        <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="white" strokeWidth="1.8" strokeLinejoin="round" />
                                        <path d="M2 17l10 5 10-5M2 12l10 5 10-5" stroke="rgba(255,255,255,0.65)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                </div>
                                <div>
                                    <h1 className="text-[17px] font-bold text-slate-900 leading-tight">
                                        {twoFactor ? "Vérification" : "Connexion"}
                                    </h1>
                                    <p className="text-[11px] text-slate-400 mt-0.5">
                                        Gestion du planning de présence
                                    </p>
                                </div>
                            </div>

                            {/* ── 2FA notice ── */}
                            {twoFactor && (
                                <div
                                    className="flex items-start gap-3 px-3.5 py-3 rounded-xl"
                                    style={{ background: "rgba(0,143,74,0.06)", border: "1px solid rgba(0,143,74,0.15)" }}
                                >
                                    <Shield className="w-4 h-4 text-[#008F4A] mt-0.5 shrink-0" />
                                    <div>
                                        <p className="text-[12px] font-semibold text-[#007a3d]">Vérification en deux étapes</p>
                                        <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                                            Un code a été envoyé à votre adresse email. Saisissez-le ci-dessous.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* ── Form ── */}
                            <Form {...form}>
                                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

                                    {!twoFactor && (
                                        <>
                                            <FormField
                                                control={form.control}
                                                name="email"
                                                render={({ field }) => (
                                                    <FormItem className="a3 space-y-1.5">
                                                        <FormLabel className="text-[12px] font-semibold text-slate-600">
                                                            Adresse email
                                                        </FormLabel>
                                                        <FormControl>
                                                            <InputField
                                                                icon={Mail}
                                                                type="email"
                                                                placeholder="vous@entreprise.com"
                                                                field={field}
                                                                hasError={!!form.formState.errors.email}
                                                            />
                                                        </FormControl>
                                                        <FormMessage className="text-[11px] text-rose-500" />
                                                    </FormItem>
                                                )}
                                            />

                                            <FormField
                                                control={form.control}
                                                name="password"
                                                render={({ field }) => (
                                                    <FormItem className="a4 space-y-1.5">
                                                        <div className="flex items-center justify-between">
                                                            <FormLabel className="text-[12px] font-semibold text-slate-600">
                                                                Mot de passe
                                                            </FormLabel>
                                                            <button
                                                                type="button"
                                                                onClick={passwordForget}
                                                                disabled={loading}
                                                                className="text-[11px] text-[#008F4A] hover:text-[#006b38] font-medium transition-colors"
                                                            >
                                                                Mot de passe oublié ?
                                                            </button>
                                                        </div>
                                                        <FormControl>
                                                            <InputField
                                                                icon={Lock}
                                                                type={hidePassword ? "password" : "text"}
                                                                placeholder="••••••••"
                                                                field={field}
                                                                hasError={!!form.formState.errors.password}
                                                                rightElement={
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setHidePassword(v => !v)}
                                                                        className="text-slate-400 hover:text-slate-600 transition-colors"
                                                                    >
                                                                        {hidePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                                    </button>
                                                                }
                                                            />
                                                        </FormControl>
                                                        <FormMessage className="text-[11px] text-rose-500" />
                                                    </FormItem>
                                                )}
                                            />
                                        </>
                                    )}

                                    {twoFactor && (
                                        <FormField
                                            control={form.control}
                                            name="code"
                                            render={({ field }) => (
                                                <FormItem className="space-y-1.5">
                                                    <FormLabel className="text-[12px] font-semibold text-slate-600">
                                                        Code de vérification
                                                    </FormLabel>
                                                    <FormControl>
                                                        <div className="relative flex items-center rounded-xl border bg-white border-slate-200 hover:border-slate-300 shadow-sm transition-all duration-200 focus-within:border-[#008F4A] focus-within:shadow-[0_0_0_3px_rgba(0,143,74,0.12)]">
                                                            <Shield className="absolute left-3.5 w-4 h-4 text-slate-400" />
                                                            <Input
                                                                placeholder="0 0 0 0 0 0"
                                                                {...field}
                                                                className="w-full pl-10 pr-4 py-3 bg-transparent border-0 shadow-none focus:ring-0 text-center text-xl tracking-[0.4em] font-mono text-slate-800"
                                                            />
                                                        </div>
                                                    </FormControl>
                                                    <FormMessage className="text-[11px] text-rose-500" />
                                                </FormItem>
                                            )}
                                        />
                                    )}

                                    {/* ── Bouton ── */}
                                    <div className="a5 pt-1">
                                        <button
                                            type="submit"
                                            disabled={loading || success}
                                            className="relative w-full overflow-hidden rounded-xl py-3.5 text-[14px] font-semibold text-white transition-all duration-200 group active:scale-[0.99] disabled:opacity-60"
                                            style={{
                                                background: success
                                                    ? "#006b38"
                                                    : "linear-gradient(135deg, #008F4A 0%, #00a654 100%)",
                                                boxShadow: "0 3px 14px rgba(0,143,74,0.28), 0 1px 0 rgba(255,255,255,0.12) inset",
                                            }}
                                        >
                                            {/* Shimmer */}
                                            <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-600 bg-gradient-to-r from-transparent via-white/10 to-transparent" />

                                            <span className="relative flex items-center justify-center gap-2">
                                                {loading ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : success ? (
                                                    <CheckCircle2 className="w-4 h-4" style={{ animation: "checkIn 0.3s cubic-bezier(0.34,1.56,0.64,1) forwards" }} />
                                                ) : twoFactor ? (
                                                    <Shield className="w-4 h-4" />
                                                ) : (
                                                    <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform duration-150" />
                                                )}
                                                {loading ? "Vérification…" :
                                                    success ? "Connecté !" :
                                                        twoFactor ? "Confirmer" :
                                                            "Se connecter"}
                                            </span>
                                        </button>
                                    </div>

                                    {twoFactor && (
                                        <p className="text-center text-[12px] text-slate-400">
                                            Vous n'avez pas reçu le code ?{" "}
                                            <button
                                                type="button"
                                                onClick={resendCode}
                                                disabled={loading}
                                                className="text-[#008F4A] font-medium hover:underline"
                                            >
                                                Renvoyer
                                            </button>
                                        </p>
                                    )}
                                </form>
                            </Form>

                            {/* ── Footer ── */}
                            <div className="a6 flex items-center justify-between pt-3 border-t border-slate-100">
                                <div className="flex items-center gap-1.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-[#008F4A]" />
                                    <span className="text-[11px] text-slate-400">Connexion sécurisée</span>
                                </div>
                                <span className="text-[11px] text-slate-300">v2.1</span>
                            </div>
                        </div>
                    </div>

                    <p className="text-center text-[11px] text-slate-400 mt-4">
                        © {new Date().getFullYear()} — Système de planning
                    </p>
                </div>
            </div>
        </>
    );
};

export default LoginForm;
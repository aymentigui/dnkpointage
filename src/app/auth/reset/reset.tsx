"use client"
import React, { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from "@hookform/resolvers/zod"
import {
    Form, FormField, FormControl, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import { useRouter, useSearchParams } from 'next/navigation'
import { resetPasswordWithoutConnection } from '@/actions/auth/password-change'
import {
    Loader2, Key, Lock, ShieldCheck, Eye, EyeOff,
    ArrowLeft, CheckCircle2,
} from 'lucide-react'

// ─── Background (identique) ───────────────────────────────────

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

// ─── Schéma ───────────────────────────────────────────────────

// Schéma pour l'étape 1 (seulement le code)
const CodeSchema = z.object({
    code: z.string().min(1, { message: "Le code est requis" }),
    password: z.string().optional(),
    passwordConfermation: z.string().optional(),
});

// Schéma pour l'étape 2 (code + mots de passe)
const ResetSchema = z.object({
    password: z.string().min(6, { message: "Minimum 6 caractères" }),
    passwordConfermation: z.string(),
    code: z.string().min(1, { message: "Le code est requis" }),
}).refine(d => d.password === d.passwordConfermation, {
    message: "Les mots de passe ne correspondent pas",
    path: ["passwordConfermation"],
});


type ResetFormData = z.infer<typeof ResetSchema>;

// ─── ResetForm ────────────────────────────────────────────────

const ResetForm = () => {
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState<1 | 2>(1); // 1 = code, 2 = nouveau mdp
    const [hidePassword, setHidePassword] = useState(true);
    const [hideConfirm, setHideConfirm] = useState(true);
    const [success, setSuccess] = useState(false);
    const [mounted, setMounted] = useState(false);

    const router = useRouter();
    const params = useSearchParams();
    const email = params.get("email");

    useEffect(() => { setMounted(true); }, []);
    useEffect(() => {
        if (!email) { toast.error("Email non trouvé"); router.push("/auth/login"); }
    }, [email, router]);

    const form = useForm<ResetFormData>({
        resolver: zodResolver(step === 1 ? CodeSchema : ResetSchema),
        defaultValues: { code: "", password: "", passwordConfermation: "" },
    });

    const onSubmit = async (values: ResetFormData) => {
        if (!email) { toast.error("Email non trouvé"); router.push("/auth/login"); return; }
        setLoading(true);
        try {
            const res = await resetPasswordWithoutConnection({ email, password: values.password, code: values.code });

            if (res.status === 200) {
                if (res.data.codeConfirmed && step === 1) {
                    // Code validé → passer à l'étape 2
                    setStep(2);
                    toast.success("Code vérifié — définissez votre nouveau mot de passe");
                    form.resetField("password");
                    form.resetField("passwordConfermation");
                } else if (step === 2) {
                    // Mot de passe réinitialisé
                    setSuccess(true);
                    toast.success("Mot de passe réinitialisé avec succès !");
                    setTimeout(() => router.push("/auth/login"), 800);
                }
            } else if (res.status === 429) {
                toast.error(res.data.message || "Trop de tentatives, réessayez plus tard");
            } else {
                toast.error(res.data.message || "Erreur lors de la réinitialisation");
            }
        } catch { toast.error("Erreur inattendue, réessayez"); }
        finally { setLoading(false); }
    };

    if (!mounted || !email) {
        return (
            <div className="fixed inset-0 flex items-center justify-center"
                style={{ background: "linear-gradient(150deg, #f0faf5 0%, #fafffe 40%, #f4f9ff 100%)" }}>
                <Loader2 className="w-6 h-6 animate-spin text-[#008F4A]" />
            </div>
        );
    }

    return (
        <>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
                @keyframes fadeUp {
                    from { opacity: 0; transform: translateY(12px); }
                    to   { opacity: 1; transform: translateY(0);    }
                }
                @keyframes slideBar {
                    0%   { background-position: 0% 0;   }
                    100% { background-position: 200% 0; }
                }
                @keyframes checkIn {
                    0%  { transform: scale(0); opacity: 0; }
                    70% { transform: scale(1.2);           }
                    100%{ transform: scale(1); opacity: 1; }
                }
                @keyframes stepIn {
                    from { opacity: 0; transform: translateX(16px); }
                    to   { opacity: 1; transform: translateX(0);    }
                }
                .a1 { animation: fadeUp 0.4s ease forwards;           opacity: 0; }
                .a2 { animation: fadeUp 0.4s 0.06s ease forwards;     opacity: 0; }
                .a3 { animation: fadeUp 0.4s 0.12s ease forwards;     opacity: 0; }
                .a4 { animation: fadeUp 0.4s 0.18s ease forwards;     opacity: 0; }
                .a5 { animation: fadeUp 0.4s 0.24s ease forwards;     opacity: 0; }
                .a6 { animation: fadeUp 0.4s 0.30s ease forwards;     opacity: 0; }
                .step-in { animation: stepIn 0.35s ease forwards; }
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
                        {/* Barre verte animée */}
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
                                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300"
                                    style={{
                                        background: step === 2
                                            ? "linear-gradient(135deg, #008F4A, #00b85f)"
                                            : "linear-gradient(135deg, #008F4A, #00b85f)",
                                        boxShadow: "0 3px 10px rgba(0,143,74,0.3)",
                                    }}
                                >
                                    {step === 1
                                        ? <Key className="w-5 h-5 text-white" />
                                        : <Lock className="w-5 h-5 text-white" />
                                    }
                                </div>
                                <div>
                                    <h1 className="text-[17px] font-bold text-slate-900 leading-tight">
                                        {step === 1 ? "Réinitialisation" : "Nouveau mot de passe"}
                                    </h1>
                                    <p className="text-[11px] text-slate-400 mt-0.5">
                                        {step === 1
                                            ? "Entrez le code reçu par email"
                                            : "Choisissez un mot de passe sécurisé"}
                                    </p>
                                </div>
                            </div>

                            {/* ── Stepper ── */}
                            <div className="a3 flex items-center gap-2">
                                {/* Étape 1 */}
                                <div className="flex items-center gap-2">
                                    <div
                                        className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-all duration-300"
                                        style={{
                                            background: step >= 1 ? "#008F4A" : "#e2e8f0",
                                            color: step >= 1 ? "white" : "#94a3b8",
                                            boxShadow: step === 1 ? "0 0 0 3px rgba(0,143,74,0.15)" : "none",
                                        }}
                                    >
                                        {step > 1 ? <CheckCircle2 className="w-3.5 h-3.5" /> : "1"}
                                    </div>
                                    <span className={cn(
                                        "text-[11px] font-medium transition-colors duration-200",
                                        step === 1 ? "text-[#008F4A]" : "text-slate-400"
                                    )}>Code</span>
                                </div>

                                {/* Ligne */}
                                <div className="flex-1 h-px mx-1 overflow-hidden rounded-full bg-slate-200">
                                    <div
                                        className="h-full rounded-full transition-all duration-500"
                                        style={{
                                            width: step > 1 ? "100%" : "0%",
                                            background: "#008F4A",
                                        }}
                                    />
                                </div>

                                {/* Étape 2 */}
                                <div className="flex items-center gap-2">
                                    <span className={cn(
                                        "text-[11px] font-medium transition-colors duration-200",
                                        step === 2 ? "text-[#008F4A]" : "text-slate-400"
                                    )}>Mot de passe</span>
                                    <div
                                        className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-all duration-300"
                                        style={{
                                            background: step === 2 ? "#008F4A" : "#e2e8f0",
                                            color: step === 2 ? "white" : "#94a3b8",
                                            boxShadow: step === 2 ? "0 0 0 3px rgba(0,143,74,0.15)" : "none",
                                        }}
                                    >
                                        2
                                    </div>
                                </div>
                            </div>

                            {/* ── Formulaire ── */}
                            <Form {...form}>
                                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

                                    {/* ── ÉTAPE 1 : Code ── */}
                                    {step === 1 && (
                                        <div className="step-in space-y-4">
                                            {/* Info email */}
                                            <div
                                                className="flex items-start gap-3 px-3.5 py-3 rounded-xl"
                                                style={{ background: "rgba(0,143,74,0.05)", border: "1px solid rgba(0,143,74,0.13)" }}
                                            >
                                                <ShieldCheck className="w-4 h-4 text-[#008F4A] mt-0.5 shrink-0" />
                                                <div className="min-w-0">
                                                    <p className="text-[11px] text-slate-500">Code envoyé à</p>
                                                    <p className="text-[13px] font-semibold text-[#007a3d] truncate mt-0.5">{email}</p>
                                                </div>
                                            </div>

                                            <FormField
                                                control={form.control}
                                                name="code"
                                                render={({ field }) => (
                                                    <FormItem className="space-y-1.5">
                                                        <FormLabel className="text-[12px] font-semibold text-slate-600">
                                                            Code de vérification
                                                        </FormLabel>
                                                        <FormControl>
                                                            <div className={cn(
                                                                "relative flex items-center rounded-xl border bg-white transition-all duration-200",
                                                                "border-slate-200 hover:border-slate-300 shadow-sm",
                                                                "focus-within:border-[#008F4A] focus-within:shadow-[0_0_0_3px_rgba(0,143,74,0.12)]"
                                                            )}>
                                                                <Key className="absolute left-3.5 w-4 h-4 text-slate-400 transition-colors duration-200 focus-within:text-[#008F4A]" />
                                                                <Input
                                                                    placeholder="0  0  0  0  0  0"
                                                                    {...field}
                                                                    maxLength={6}
                                                                    className="w-full pl-10 pr-4 py-3.5 bg-transparent border-0 shadow-none focus:ring-0 focus:outline-none text-center text-xl tracking-[0.4em] font-mono text-slate-800 placeholder-slate-300"
                                                                />
                                                            </div>
                                                        </FormControl>
                                                        <FormMessage className="text-[11px] text-rose-500" />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                    )}

                                    {/* ── ÉTAPE 2 : Nouveau mot de passe ── */}
                                    {step === 2 && (
                                        <div className="step-in space-y-4">
                                            <FormField
                                                control={form.control}
                                                name="password"
                                                render={({ field }) => (
                                                    <FormItem className="space-y-1.5">
                                                        <FormLabel className="text-[12px] font-semibold text-slate-600">
                                                            Nouveau mot de passe
                                                        </FormLabel>
                                                        <FormControl>
                                                            <InputField
                                                                icon={Lock}
                                                                type={hidePassword ? "password" : "text"}
                                                                placeholder="Minimum 6 caractères"
                                                                field={field}
                                                                hasError={!!form.formState.errors.password}
                                                                rightElement={
                                                                    <button type="button"
                                                                        onClick={() => setHidePassword(v => !v)}
                                                                        className="text-slate-400 hover:text-slate-600 transition-colors">
                                                                        {hidePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                                    </button>
                                                                }
                                                            />
                                                        </FormControl>
                                                        <FormMessage className="text-[11px] text-rose-500" />
                                                    </FormItem>
                                                )}
                                            />

                                            <FormField
                                                control={form.control}
                                                name="passwordConfermation"
                                                render={({ field }) => (
                                                    <FormItem className="space-y-1.5">
                                                        <FormLabel className="text-[12px] font-semibold text-slate-600">
                                                            Confirmer le mot de passe
                                                        </FormLabel>
                                                        <FormControl>
                                                            <InputField
                                                                icon={Lock}
                                                                type={hideConfirm ? "password" : "text"}
                                                                placeholder="Répétez le mot de passe"
                                                                field={field}
                                                                hasError={!!form.formState.errors.passwordConfermation}
                                                                rightElement={
                                                                    <button type="button"
                                                                        onClick={() => setHideConfirm(v => !v)}
                                                                        className="text-slate-400 hover:text-slate-600 transition-colors">
                                                                        {hideConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                                    </button>
                                                                }
                                                            />
                                                        </FormControl>
                                                        <FormMessage className="text-[11px] text-rose-500" />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                    )}

                                    {/* ── Bouton ── */}
                                    <div className="pt-1">
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
                                            <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                                            <span className="relative flex items-center justify-center gap-2">
                                                {loading ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : success ? (
                                                    <CheckCircle2 className="w-4 h-4" style={{ animation: "checkIn 0.3s cubic-bezier(0.34,1.56,0.64,1) forwards" }} />
                                                ) : step === 1 ? (
                                                    <Key className="w-4 h-4" />
                                                ) : (
                                                    <Lock className="w-4 h-4" />
                                                )}
                                                {loading ? "Vérification…" :
                                                    success ? "Mot de passe mis à jour !" :
                                                        step === 1 ? "Vérifier le code" :
                                                            "Réinitialiser"}
                                            </span>
                                        </button>
                                    </div>
                                </form>
                            </Form>

                            {/* ── Retour connexion + footer ── */}
                            <div className="space-y-3">
                                <button
                                    type="button"
                                    onClick={() => router.push("/auth/login")}
                                    className="w-full flex items-center justify-center gap-1.5 text-[12px] text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                    <ArrowLeft className="w-3.5 h-3.5" />
                                    Retour à la connexion
                                </button>

                                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-1.5 h-1.5 rounded-full bg-[#008F4A]" />
                                        <span className="text-[11px] text-slate-400">Connexion sécurisée</span>
                                    </div>
                                    <span className="text-[11px] text-slate-300">v2.1</span>
                                </div>
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

export default ResetForm;
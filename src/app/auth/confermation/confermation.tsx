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
import { confermationRegister, SendVerificationCode } from '@/actions/auth/auth'
import {
    Loader2, MailCheck, RotateCcw, Shield,
    ArrowLeft, CheckCircle2,
} from 'lucide-react'

// ─── Background (identique au LoginForm) ─────────────────────

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

// ─── Schéma ───────────────────────────────────────────────────

const ConfirmSchema = z.object({
    code: z.string().min(1, { message: "Le code est requis" }),
});
type ConfirmFormData = z.infer<typeof ConfirmSchema>;

// ─── Component ───────────────────────────────────────────────

const ConfermationFrom = () => {
    const [loading, setLoading] = useState(false);
    const [resendLoading, setResendLoading] = useState(false);
    const [email, setEmail] = useState<string | null>(null);
    const [isBlocked, setIsBlocked] = useState(false);
    const [blockedUntil, setBlockedUntil] = useState<Date | null>(null);
    const [success, setSuccess] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [focused, setFocused] = useState(false);

    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => { setMounted(true); }, []);

    useEffect(() => {
        const emailParam = searchParams.get("email");
        if (!emailParam) { toast.error("Email non trouvé"); router.push("/auth/login"); return; }
        setEmail(emailParam);
    }, [searchParams, router]);

    useEffect(() => {
        if (!isBlocked || !blockedUntil) return;
        const interval = setInterval(() => {
            if (new Date() >= blockedUntil) {
                setIsBlocked(false); setBlockedUntil(null);
                clearInterval(interval);
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [isBlocked, blockedUntil]);

    const getRemainingTime = () => {
        if (!blockedUntil) return 0;
        return Math.max(0, Math.ceil((blockedUntil.getTime() - Date.now()) / 60000));
    };

    const form = useForm<ConfirmFormData>({
        resolver: zodResolver(ConfirmSchema),
        defaultValues: { code: "" },
    });

    const onSubmit = async (values: ConfirmFormData) => {
        if (!email) { toast.error("Email non trouvé"); router.push("/auth/login"); return; }
        setLoading(true);
        try {
            const res = await confermationRegister(values, email);
            if (res.status === 200) {
                setSuccess(true);
                toast.success("Compte vérifié avec succès !");
                setTimeout(() => router.push("/auth/login"), 800);
            } else {
                toast.error(res.data.message || "Code invalide ou expiré");
            }
        } catch { toast.error("Erreur inattendue, réessayez"); }
        finally { setLoading(false); }
    };

    const resendCode = async () => {
        if (!email) { toast.error("Email non trouvé"); return; }
        setResendLoading(true);
        try {
            const res = await SendVerificationCode(email);
            if (res.status === 200) {
                toast.success("Code renvoyé !");
            } else if (res.status === 429) {
                toast.error(res.data.message || "Trop de tentatives");
                setIsBlocked(true);
                setBlockedUntil(new Date(Date.now() + 15 * 60 * 1000));
            } else {
                toast.error(res.data.message || "Erreur lors de l'envoi");
            }
        } catch { toast.error("Erreur inattendue"); }
        finally { setResendLoading(false); }
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
                @keyframes dotPulse {
                    0%, 100% { transform: scale(1);   opacity: 1;   }
                    50%       { transform: scale(1.4); opacity: 0.6; }
                }
                .a1 { animation: fadeUp 0.4s ease forwards;             opacity: 0; }
                .a2 { animation: fadeUp 0.4s 0.06s ease forwards;       opacity: 0; }
                .a3 { animation: fadeUp 0.4s 0.12s ease forwards;       opacity: 0; }
                .a4 { animation: fadeUp 0.4s 0.18s ease forwards;       opacity: 0; }
                .a5 { animation: fadeUp 0.4s 0.24s ease forwards;       opacity: 0; }
                .a6 { animation: fadeUp 0.4s 0.30s ease forwards;       opacity: 0; }
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
                                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                                    style={{ background: "linear-gradient(135deg, #008F4A, #00b85f)", boxShadow: "0 3px 10px rgba(0,143,74,0.3)" }}
                                >
                                    <MailCheck className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h1 className="text-[17px] font-bold text-slate-900 leading-tight">
                                        Vérification email
                                    </h1>
                                    <p className="text-[11px] text-slate-400 mt-0.5">
                                        Confirmez votre adresse pour continuer
                                    </p>
                                </div>
                            </div>

                            {/* ── Info email ── */}
                            <div
                                className="a3 flex items-start gap-3 px-3.5 py-3 rounded-xl"
                                style={{ background: "rgba(0,143,74,0.05)", border: "1px solid rgba(0,143,74,0.13)" }}
                            >
                                <div className="mt-1 shrink-0">
                                    <div
                                        className="w-2 h-2 rounded-full bg-[#008F4A]"
                                        style={{ animation: "dotPulse 2s ease-in-out infinite" }}
                                    />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[12px] text-slate-500 leading-relaxed">
                                        Un code de vérification a été envoyé à
                                    </p>
                                    <p className="text-[13px] font-semibold text-[#007a3d] truncate mt-0.5">
                                        {email}
                                    </p>
                                </div>
                            </div>

                            {/* ── Blocage ── */}
                            {isBlocked && (
                                <div
                                    className="flex items-start gap-3 px-3.5 py-3 rounded-xl"
                                    style={{ background: "rgba(244,63,94,0.05)", border: "1px solid rgba(244,63,94,0.15)" }}
                                >
                                    <Shield className="w-4 h-4 text-rose-500 mt-0.5 shrink-0" />
                                    <div>
                                        <p className="text-[12px] font-semibold text-rose-600">Trop de tentatives</p>
                                        <p className="text-[11px] text-slate-500 mt-0.5">
                                            Renvoi bloqué pendant encore ~{getRemainingTime()} min
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* ── Formulaire ── */}
                            <Form {...form}>
                                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

                                    <FormField
                                        control={form.control}
                                        name="code"
                                        render={({ field }) => (
                                            <FormItem className="a4 space-y-1.5">
                                                <FormLabel className="text-[12px] font-semibold text-slate-600">
                                                    Code de vérification
                                                </FormLabel>
                                                <FormControl>
                                                    <div className={cn(
                                                        "relative flex items-center rounded-xl border bg-white transition-all duration-200",
                                                        focused
                                                            ? "border-[#008F4A] shadow-[0_0_0_3px_rgba(0,143,74,0.12)]"
                                                            : "border-slate-200 hover:border-slate-300 shadow-sm"
                                                    )}>
                                                        <Shield className={cn(
                                                            "absolute left-3.5 w-4 h-4 transition-colors duration-200",
                                                            focused ? "text-[#008F4A]" : "text-slate-400"
                                                        )} />
                                                        <Input
                                                            placeholder="0 0 0 0 0 0"
                                                            {...field}
                                                            maxLength={6}
                                                            onFocus={() => setFocused(true)}
                                                            onBlur={() => setFocused(false)}
                                                            className="w-full pl-10 pr-4 py-3.5 bg-transparent border-0 shadow-none focus:ring-0 focus:outline-none text-center text-xl tracking-[0.4em] font-mono text-slate-800 placeholder-slate-300"
                                                        />
                                                    </div>
                                                </FormControl>
                                                <FormMessage className="text-[11px] text-rose-500" />
                                            </FormItem>
                                        )}
                                    />

                                    {/* Bouton confirmer */}
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
                                            <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                                            <span className="relative flex items-center justify-center gap-2">
                                                {loading ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : success ? (
                                                    <CheckCircle2 className="w-4 h-4" style={{ animation: "checkIn 0.3s cubic-bezier(0.34,1.56,0.64,1) forwards" }} />
                                                ) : (
                                                    <MailCheck className="w-4 h-4" />
                                                )}
                                                {loading ? "Vérification…" : success ? "Vérifié !" : "Confirmer le code"}
                                            </span>
                                        </button>
                                    </div>
                                </form>
                            </Form>

                            {/* ── Renvoyer + retour ── */}
                            <div className="a6 space-y-3">
                                {/* Séparateur */}
                                <div className="flex items-center gap-3">
                                    <div className="flex-1 h-px bg-slate-100" />
                                    <span className="text-[11px] text-slate-400">Vous n'avez pas reçu le code ?</span>
                                    <div className="flex-1 h-px bg-slate-100" />
                                </div>

                                {/* Bouton renvoyer */}
                                <button
                                    type="button"
                                    onClick={resendCode}
                                    disabled={resendLoading || isBlocked}
                                    className={cn(
                                        "w-full flex items-center justify-center gap-2 rounded-xl py-3 text-[13px] font-medium transition-all duration-200 border",
                                        isBlocked
                                            ? "border-slate-100 text-slate-300 cursor-not-allowed bg-slate-50"
                                            : "border-slate-200 text-slate-600 hover:border-[#008F4A]/40 hover:text-[#008F4A] hover:bg-[rgba(0,143,74,0.03)] bg-white"
                                    )}
                                >
                                    {resendLoading
                                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        : <RotateCcw className="w-3.5 h-3.5" />
                                    }
                                    {isBlocked
                                        ? `Bloqué (~${getRemainingTime()} min)`
                                        : resendLoading ? "Envoi en cours…" : "Renvoyer le code"
                                    }
                                </button>

                                {/* Retour connexion */}
                                <button
                                    type="button"
                                    onClick={() => router.push("/auth/login")}
                                    className="w-full flex items-center justify-center gap-1.5 text-[12px] text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                    <ArrowLeft className="w-3.5 h-3.5" />
                                    Retour à la connexion
                                </button>
                            </div>

                            {/* Footer */}
                            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
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

export default ConfermationFrom;
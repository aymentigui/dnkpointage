"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { employeesApi, planningApi } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    ArrowLeft, ChevronLeft, ChevronRight, Clock, TrendingUp,
    Calendar, Activity, MapPin, Briefcase, AlertCircle,
    CheckCircle2, XCircle, Coffee, Filter, Pencil, X,
    Stethoscope, RefreshCw, Palmtree, Sparkles, FileText,
    ArrowRight, History,
    Building2,
} from "lucide-react";
import { CycleModal } from "@/components/modals/CycleModal";
import { toast } from "react-hot-toast";
import { cn } from "@/lib/utils";
import { useSession } from "@/hooks/use-session";

// ─── Types ───────────────────────────────────────────────────

interface HistoryEntry {
    id?: string;
    date?: string;
    ancien_statut: string | null;
    nouveau_statut: string | null;
    type_modification: string;
    description?: string | null;
    modifie_par: string | null;
    modifie_par_id?: string | null;
    modifie_le: string;
}

interface JourPlanning {
    date: string;
    statut: string;
    statut_original: string | null;
    source: "bdd" | "calcule";
    annotation: { id?: string; code: string; libelle: string } | null;
    history: HistoryEntry[];
    pointage: { heure_entree: string | null; heure_sortie: string | null; est_nuit: boolean } | null;
}

interface EmployeeDetails {
    id: string; matricule: string; nom: string; prenom: string;
    poste: string; zone: string; cycle: any; departement: string;
    statistiques: {
        presents: number; absents: number; repos: number;
        total_jours: number; taux_presence: number;
        total_heures: string; moyenne_heures_jour: number;
        annotations: Record<string, number>;
    };
}

interface Pointage {
    id: string; date: string;
    heure_entree: string | null; heure_sortie: string | null;
    est_nuit: boolean; duree_minutes: number | null;
    duree: string | null; qualite: "complet" | "incomplet" | "suspect";
}

// ─── Helpers ─────────────────────────────────────────────────

const MOIS_FR = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const JOURS_FR = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

const CELL_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    P: { bg: "#f0fdf4", text: "#15803d", border: "#bbf7d0" },
    A: { bg: "#fff1f2", text: "#be123c", border: "#fecdd3" },
    R: { bg: "#f8fafc", text: "#64748b", border: "#e2e8f0" },
    JF: { bg: "#ecfeff", text: "#0369a1", border: "#cffafe" },
    M: { bg: "#eff6ff", text: "#1d4ed8", border: "#bfdbfe" },
    J: { bg: "#f0fdf4", text: "#059669", border: "#a7f3d0" },
    Md: { bg: "#fef2f2", text: "#dc2626", border: "#fecaca" },
    Rc: { bg: "#f5f3ff", text: "#6d28d9", border: "#ddd6fe" },
    C: { bg: "#fffbeb", text: "#b45309", border: "#fde68a" },
    Ce: { bg: "#fdf2f8", text: "#be185d", border: "#fbcfe8" },
};

function getStatutColors(code: string | null | undefined) {
    return CELL_COLORS[code ?? ""] ?? { bg: "#f8fafc", text: "#94a3b8", border: "#e2e8f0" };
}

function StatutBadge({ code, size = "sm" }: { code: string | null | undefined; size?: "xs" | "sm" }) {
    if (!code) return <span className="text-slate-400 italic text-[10px]">—</span>;
    const c = getStatutColors(code);
    const cls = size === "xs"
        ? "inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold"
        : "inline-flex items-center justify-center w-6 h-6 rounded-md text-xs font-bold";
    return (
        <span className={cls} style={{ backgroundColor: c.bg, color: c.text, border: `1px solid ${c.border}` }}>
            {code}
        </span>
    );
}

function getQualiteConfig(qualite: string) {
    switch (qualite) {
        case "complet": return { icon: CheckCircle2, color: "text-emerald-500", label: "Complet" };
        case "incomplet": return { icon: AlertCircle, color: "text-amber-500", label: "Incomplet" };
        case "suspect": return { icon: XCircle, color: "text-rose-500", label: "Suspect" };
        default: return { icon: AlertCircle, color: "text-slate-400", label: qualite };
    }
}

function formatDateLong(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

function formatDateTime(isoStr: string) {
    const d = new Date(isoStr);
    return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })
        + " " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function getDaysInMonth(year: number, month: number) {
    return new Date(year, month + 1, 0).getDate();
}

function toYMD(date: Date) {
    return date.toISOString().split("T")[0];
}

// ─── Config annotations ───────────────────────────────────────

const ANNOT_BASE = [
    { code: "P", label: "Présent", Icon: CheckCircle2, active: "bg-emerald-500 border-emerald-500 text-white", rest: "bg-emerald-50 border-emerald-200 text-emerald-700" },
    { code: "A", label: "Absent", Icon: XCircle, active: "bg-rose-500 border-rose-500 text-white", rest: "bg-rose-50 border-rose-200 text-rose-700" },
    { code: "R", label: "Repos", Icon: Coffee, active: "bg-slate-700 border-slate-700 text-white", rest: "bg-slate-50 border-slate-200 text-slate-600" },
];

const ANNOT_TYPES = [
    { code: "M", label: "Mission", Icon: FileText, color: "#2563eb", light: "#eff6ff", border: "#bfdbfe" },
    { code: "J", label: "Justifié", Icon: CheckCircle2, color: "#059669", light: "#ecfdf5", border: "#a7f3d0" },
    { code: "Md", label: "Maladie", Icon: Stethoscope, color: "#dc2626", light: "#fef2f2", border: "#fecaca" },
    { code: "Rc", label: "Récupération", Icon: RefreshCw, color: "#7c3aed", light: "#f5f3ff", border: "#ddd6fe" },
    { code: "C", label: "Congé", Icon: Palmtree, color: "#d97706", light: "#fffbeb", border: "#fde68a" },
    { code: "Ce", label: "Congé exceptionnel", Icon: Sparkles, color: "#db2777", light: "#fdf2f8", border: "#fbcfe8" },
    { code: "JF", label: "Férié", Icon: Sparkles, color: "#db2777", light: "#fdf2f8", border: "#fbcfe8" },
];

const ANNOT_LABELS: Record<string, string> = Object.fromEntries(ANNOT_TYPES.map(a => [a.code, a.label]));
function getAnnotLabel(code: string) { return ANNOT_LABELS[code] ?? code; }

// ─── DayTooltip ───────────────────────────────────────────────

interface DayTooltipState {
    visible: boolean;
    jour: JourPlanning | null;
    posX: number;
    posY: number;
}

function DayTooltip({ state }: { state: DayTooltipState }) {
    if (!state.visible || !state.jour) return null;

    const { jour } = state;
    const hasHistory = jour.history.length > 0;
    const wasModified = jour.statut_original && jour.statut_original !== jour.statut;

    return (
        <div
            className="fixed z-[9999] pointer-events-none"
            style={{ left: state.posX, top: state.posY }}
        >
            <div className="bg-slate-900 text-white rounded-xl shadow-2xl p-3 w-[250px] text-[11px]">
                {/* Date */}
                <div className="flex items-center gap-1.5 mb-2.5 pb-2 border-b border-white/10">
                    <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                    <span className="text-slate-200 font-medium capitalize">
                        {formatDateLong(jour.date)}
                    </span>
                </div>

                {/* Statuts */}
                <div className="space-y-1.5 mb-2">
                    <div className="flex items-center justify-between">
                        <span className="text-slate-400">Statut actuel</span>
                        <StatutBadge code={jour.statut} size="xs" />
                    </div>
                    {jour.statut_original && (
                        <div className="flex items-center justify-between">
                            <span className="text-slate-400">
                                Statut {wasModified ? "original" : "calculé"}
                            </span>
                            <div className="flex items-center gap-1.5">
                                <StatutBadge code={jour.statut_original} size="xs" />
                                {wasModified && (
                                    <span className="text-orange-400 text-[9px] font-semibold">modifié</span>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Annotation */}
                {jour.annotation && (
                    <div className="flex items-center gap-1.5 mb-2 py-1 px-2 bg-amber-500/10 rounded-lg border border-amber-500/20">
                        <span className="font-mono font-bold text-amber-400 text-[10px]">{jour.annotation.code}</span>
                        <span className="text-slate-400">{jour.annotation.libelle}</span>
                    </div>
                )}

                {/* Historique des modifications */}
                {hasHistory ? (
                    <div className="pt-2 border-t border-white/10 space-y-2">
                        <p className="text-slate-500 uppercase tracking-wide text-[9px] font-semibold">
                            Historique ({jour.history.length})
                        </p>
                        {jour.history.map((h, idx) => (
                            <div key={idx} className="space-y-0.5">
                                <div className="flex items-center gap-1.5">
                                    <StatutBadge code={h.ancien_statut} size="xs" />
                                    <ArrowRight className="w-2.5 h-2.5 text-slate-500 shrink-0" />
                                    <StatutBadge code={h.nouveau_statut} size="xs" />
                                    <span className="ml-auto text-slate-500 text-[9px]">
                                        {h.type_modification === "annotation" ? "🏷️" : "✏️"}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between text-[9px] text-slate-500 pl-0.5">
                                    <span className="text-slate-400 font-medium truncate max-w-[110px]">
                                        {h.modifie_par ?? "Inconnu"}
                                    </span>
                                    <span className="shrink-0 ml-2">{formatDateTime(h.modifie_le)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="pt-2 border-t border-white/10">
                        <p className="text-slate-500 text-[10px] italic">Aucune modification manuelle</p>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── AnnotModal ───────────────────────────────────────────────

function AnnotModal({
    open, onOpenChange, matricule, id, dates, currentCode, currentStatut, onSuccess, permissions
}: {
    open: boolean; onOpenChange: (v: boolean) => void;
    matricule: string; id: string; dates: string[];
    currentCode?: string; currentStatut?: string; onSuccess: () => void;
    permissions: {
        mission: boolean; justifie: boolean; maladie: boolean;
        recuperation: boolean; conge: boolean; exceptionnel: boolean;
    }
}) {
    const [base, setBase] = useState("");
    const [annot, setAnnot] = useState("");
    const [desc, setDesc] = useState("");
    const [saving, setSaving] = useState(false);
    const isMulti = dates.length > 1;

    // Filtrer les types d'annotations selon les permissions
    const availableAnnotTypes = useMemo(() => {
        return ANNOT_TYPES.filter(a => {
            if (a.code === "M") return permissions.mission;
            if (a.code === "J") return permissions.justifie;
            if (a.code === "Md") return permissions.maladie;
            if (a.code === "Rc") return permissions.recuperation;
            if (a.code === "C") return permissions.conge;
            if (a.code === "Ce") return permissions.exceptionnel;
            return false;
        });
    }, [permissions]);

    useEffect(() => {
        if (!open) return;
        if (!isMulti && currentCode) { setAnnot(currentCode); setBase(currentStatut ?? "A"); }
        else if (!isMulti && currentStatut) { setBase(currentStatut); setAnnot(""); }
        else { setBase(""); setAnnot(""); }
        setDesc("");
    }, [open, isMulti, currentCode, currentStatut]);

    const pickBase = (c: string) => { setBase(c); if (c !== "A") setAnnot(""); };
    const pickAnnot = (c: string) => { setAnnot(a => a === c ? "" : c); setBase("A"); };
    const canSave = base !== "" || annot !== "";

    const handleSave = async () => {
        if (!canSave) return;
        setSaving(true);
        try {
            await Promise.all(dates.map(date =>
                annot
                    ? planningApi.update(id, { date, statut: "A", annotation: { code: annot, libelle: getAnnotLabel(annot), description: desc || undefined } })
                    : planningApi.update(id, { date, statut: base })
            ));
            toast.success(dates.length > 1 ? `${dates.length} jours modifiés` : "Enregistré");
            onSuccess();
            onOpenChange(false);
        } catch {
            toast.error("Erreur lors de la modification");
        } finally { setSaving(false); }
    };

    const dateLabel = dates.length === 1 ? formatDateLong(dates[0]) : `${dates.length} jours sélectionnés`;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[460px] p-0 overflow-hidden gap-0">
                <div className="px-6 pt-6 pb-4 border-b border-slate-100">
                    <DialogTitle className="text-base font-semibold text-slate-900">Modifier le planning</DialogTitle>
                    <p className="text-sm text-slate-500 mt-0.5 capitalize">{matricule} · {dateLabel}</p>
                </div>
                <div className="px-6 py-5 space-y-5 max-h-[60vh] overflow-y-auto">
                    <div>
                        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Statut</p>
                        <div className="grid grid-cols-3 gap-2">
                            {ANNOT_BASE.map(({ code, label, Icon, active, rest }) => {
                                const isOn = base === code && !annot;
                                return (
                                    <button key={code} onClick={() => pickBase(code)}
                                        className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all duration-150 ${isOn ? active + " shadow-sm" : rest + " hover:opacity-80"}`}>
                                        <Icon className="w-5 h-5" /><span className="text-xs font-semibold">{label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    {availableAnnotTypes.length > 0 && (
                        <>
                            <div className="flex items-center gap-3">
                                <div className="flex-1 h-px bg-slate-100" />
                                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">ou annotation</span>
                                <div className="flex-1 h-px bg-slate-100" />
                            </div>
                            <div>
                                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Annotation</p>
                                <div className="grid grid-cols-2 gap-2">
                                    {availableAnnotTypes.map(({ code, label, Icon, color, light, border }) => {
                                        const isOn = annot === code;
                                        return (
                                            <button key={code} onClick={() => pickAnnot(code)}
                                                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border-2 transition-all duration-150 text-left"
                                                style={{ backgroundColor: isOn ? color : light, borderColor: isOn ? color : border }}>
                                                <Icon className="w-4 h-4 shrink-0" style={{ color: isOn ? "#fff" : color }} />
                                                <div>
                                                    <div className="text-[11px] font-bold font-mono leading-none" style={{ color: isOn ? "#fff" : color }}>{code}</div>
                                                    <div className="text-[11px] leading-tight mt-0.5" style={{ color: isOn ? "rgba(255,255,255,0.82)" : color }}>{label}</div>
                                                </div>
                                                {isOn && (
                                                    <div className="ml-auto w-4 h-4 rounded-full bg-white/20 flex items-center justify-center">
                                                        <div className="w-2 h-2 rounded-full bg-white" />
                                                    </div>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </>
                    )}
                    {annot && (
                        <div>
                            <Label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                                Description <span className="font-normal normal-case">(optionnelle)</span>
                            </Label>
                            <Textarea value={desc} onChange={e => setDesc(e.target.value)}
                                placeholder="Préciser les détails..."
                                className="mt-2 text-sm resize-none h-16 bg-slate-50 border-slate-200" />
                        </div>
                    )}
                </div>
                <div className="px-6 py-4 flex items-center justify-between border-t border-slate-100">
                    <span className="text-xs text-slate-400">
                        {annot
                            ? <><span className="font-mono font-bold text-slate-600">{annot}</span>{dates.length > 1 && ` · ${dates.length} jours`}</>
                            : base ? <span className="font-medium text-slate-600">{ANNOT_BASE.find(t => t.code === base)?.label}</span>
                                : "Aucune sélection"}
                    </span>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Annuler</Button>
                        <Button size="sm" onClick={handleSave} disabled={saving || !canSave} className="min-w-[90px]">
                            {saving ? "..." : `Enregistrer${dates.length > 1 ? ` (${dates.length})` : ""}`}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ─── StatCard ─────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, accent }: {
    icon: any; label: string; value: string | number; sub?: string; accent: string;
}) {
    return (
        <Card className="relative overflow-hidden border-0 shadow-sm bg-white">
            <div className={`absolute inset-0 opacity-[0.04] ${accent}`} />
            <CardContent className="p-5">
                <div className="flex items-start justify-between">
                    <div>
                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">{label}</p>
                        <p className="text-3xl font-bold text-slate-900 tracking-tight">{value}</p>
                        {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
                    </div>
                    <div className={`p-2.5 rounded-xl ${accent} bg-opacity-10`}>
                        <Icon className={`w-5 h-5 ${accent.replace("bg-", "text-")}`} />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

// ─── DateFilterBar ────────────────────────────────────────────

function DateFilterBar({ debut, fin, onApply }: { debut: string; fin: string; onApply: (d: string, f: string) => void; }) {
    const [d, setD] = useState(debut);
    const [f, setF] = useState(fin);
    useEffect(() => { setD(debut); setF(fin); }, [debut, fin]);
    const reset = () => {
        const nf = toYMD(new Date());
        const nd = toYMD(new Date(new Date().setMonth(new Date().getMonth() - 3)));
        setD(nd); setF(nf); onApply(nd, nf);
    };
    return (
        <div className="flex flex-wrap items-center gap-3 p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                <Filter className="w-3.5 h-3.5" /><span>Période</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
                <label className="text-[11px] text-slate-400">Du</label>
                <input type="date" value={d} onChange={e => setD(e.target.value)}
                    className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-slate-300" />
                <label className="text-[11px] text-slate-400">Au</label>
                <input type="date" value={f} onChange={e => setF(e.target.value)}
                    className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-slate-300" />
                <button onClick={() => onApply(d, f)} disabled={!d || !f}
                    className="px-3 py-1.5 bg-slate-900 text-white text-xs font-medium rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-40">
                    Appliquer
                </button>
                <button onClick={reset}
                    className="px-3 py-1.5 text-slate-500 text-xs font-medium rounded-lg hover:bg-slate-100 transition-colors">
                    3 derniers mois
                </button>
            </div>
        </div>
    );
}

// ─── HistoriqueGlobal ─────────────────────────────────────────

function HistoriqueGlobal({ entries }: { entries: HistoryEntry[] }) {
    const [showAll, setShowAll] = useState(false);
    const sorted = [...entries].sort((a, b) => new Date(b.modifie_le).getTime() - new Date(a.modifie_le).getTime());
    const visible = showAll ? sorted : sorted.slice(0, 15);

    if (entries.length === 0) {
        return (
            <div className="text-center py-8 text-slate-400">
                <History className="w-7 h-7 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Aucune modification enregistrée</p>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {visible.map((h, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
                    {/* Date du jour modifié */}
                    <div className="w-16 shrink-0 text-center">
                        <div className="text-[10px] font-semibold text-slate-400 uppercase">
                            {new Date(h.date!).toLocaleDateString("fr-FR", { weekday: "short" })}
                        </div>
                        <div className="text-xs font-bold text-slate-700">
                            {new Date(h.date!).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                        </div>
                    </div>

                    {/* Transition statut */}
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                        <StatutBadge code={h.ancien_statut} size="sm" />
                        <ArrowRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                        <StatutBadge code={h.nouveau_statut} size="sm" />
                        <span className="text-slate-300 text-xs ml-1">
                            {h.type_modification === "annotation" ? "🏷️" : "✏️"}
                        </span>
                        {h.description && (
                            <span className="text-xs text-slate-400 italic truncate ml-1">"{h.description}"</span>
                        )}
                    </div>

                    {/* Qui + quand */}
                    <div className="text-right shrink-0 space-y-0.5">
                        <div className="text-[11px] font-medium text-slate-600">
                            {h.modifie_par ?? <span className="italic text-slate-400">Inconnu</span>}
                        </div>
                        <div className="text-[10px] text-slate-400">{formatDateTime(h.modifie_le)}</div>
                    </div>
                </div>
            ))}

            {entries.length > 15 && (
                <button onClick={() => setShowAll(v => !v)}
                    className="w-full py-2 text-xs text-slate-500 hover:text-slate-700 font-medium transition-colors">
                    {showAll ? "Voir moins" : `Voir les ${entries.length - 15} autres…`}
                </button>
            )}
        </div>
    );
}

// ─── PlanningCalendar ─────────────────────────────────────────

function PlanningCalendar({
    jours, year, month, matricule, id, onMonthChange, onPlanningUpdated,
    canUpdatePlanning, annotationPermissions
}: {
    jours: JourPlanning[]; year: number; month: number;
    matricule: string; id: string;
    onMonthChange: (y: number, m: number) => void;
    onPlanningUpdated: () => void;
    canUpdatePlanning: boolean;
    annotationPermissions: {
        mission: boolean; justifie: boolean; maladie: boolean;
        recuperation: boolean; conge: boolean; exceptionnel: boolean;
    }
}) {
    const jourMap = new Map<string, JourPlanning>();
    jours.forEach(j => jourMap.set(j.date, j));

    const daysInMonth = getDaysInMonth(year, month);
    const firstDOW = new Date(year, month, 1).getDay();
    const offset = firstDOW === 0 ? 6 : firstDOW - 1;
    const totalCells = Math.ceil((offset + daysInMonth) / 7) * 7;

    const cells = Array.from({ length: totalCells }, (_, i) => {
        const dayNum = i - offset + 1;
        if (dayNum < 1 || dayNum > daysInMonth) return { dateStr: null as string | null, jour: null as JourPlanning | null };
        const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
        return { dateStr, jour: jourMap.get(dateStr) ?? null };
    });

    const allDates = cells.map(c => c.dateStr).filter((d): d is string => d !== null);

    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [lastClicked, setLastClicked] = useState<string | null>(null);
    const [annotOpen, setAnnotOpen] = useState(false);
    const todayStr = toYMD(new Date());

    // Tooltip
    const [tooltip, setTooltip] = useState<DayTooltipState>({
        visible: false, jour: null, posX: 0, posY: 0,
    });

    useEffect(() => { setSelected(new Set()); setLastClicked(null); }, [year, month]);

    const handleClick = (dateStr: string, e: React.MouseEvent) => {
        // Bloquer le clique si l'utilisateur n'a pas la permission de modifier
        if (!canUpdatePlanning) return;

        setTooltip(t => ({ ...t, visible: false }));
        if (e.shiftKey && lastClicked && allDates.includes(lastClicked)) {
            const a = allDates.indexOf(lastClicked), b = allDates.indexOf(dateStr);
            const [from, to] = a < b ? [a, b] : [b, a];
            setSelected(prev => {
                const next = new Set(prev);
                allDates.slice(from, to + 1).forEach(d => next.add(d));
                return next;
            });
        } else {
            setSelected(prev => {
                const next = new Set(prev);
                next.has(dateStr) ? next.delete(dateStr) : next.add(dateStr);
                return next;
            });
            setLastClicked(dateStr);
        }
    };

    const handleMouseEnter = (e: React.MouseEvent, jour: JourPlanning) => {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const tipHeight = 280;
        const spaceBelow = window.innerHeight - rect.bottom;
        const posY = spaceBelow > tipHeight ? rect.bottom + 6 : rect.top - tipHeight - 6;
        const posX = Math.min(rect.left - 10, window.innerWidth - 270);
        setTooltip({ visible: true, jour, posX, posY });
    };

    const clearSelection = () => { setSelected(new Set()); setLastClicked(null); };

    const selectedArray = Array.from(selected).sort();
    const singleJour = selectedArray.length === 1 ? jourMap.get(selectedArray[0]) : null;

    return (
        <div className="space-y-3">
            {/* Tooltip global */}
            <DayTooltip state={tooltip} />

            {/* Navigation */}
            <div className="flex items-center justify-between">
                <button onClick={() => { const d = new Date(year, month - 1); onMonthChange(d.getFullYear(), d.getMonth()); }}
                    className="p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-600">
                    <ChevronLeft className="w-4 h-4" />
                </button>
                <h3 className="font-semibold text-slate-900 text-sm">{MOIS_FR[month]} {year}</h3>
                <button onClick={() => { const d = new Date(year, month + 1); onMonthChange(d.getFullYear(), d.getMonth()); }}
                    className="p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-600">
                    <ChevronRight className="w-4 h-4" />
                </button>
            </div>

            {selected.size === 0 && canUpdatePlanning && (
                <p className="text-[11px] text-slate-400 text-center pb-0.5">
                    Hover pour l'historique · Clic / Shift+clic pour modifier
                </p>
            )}

            {/* En-tête */}
            <div className="grid grid-cols-7 gap-1">
                {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map(j => (
                    <div key={j} className="text-center text-[10px] font-semibold text-slate-400 uppercase tracking-wider py-1">{j}</div>
                ))}
            </div>

            {/* Grille */}
            <div className="grid grid-cols-7 gap-1" onMouseLeave={() => setTooltip(t => ({ ...t, visible: false }))}>
                {cells.map(({ dateStr, jour }, idx) => {
                    if (!dateStr) return <div key={`e-${idx}`} className="aspect-square" />;

                    const dayNum = parseInt(dateStr.split("-")[2], 10);
                    const isToday = dateStr === todayStr;
                    const isSel = selected.has(dateStr);

                    if (!jour) {
                        return (
                            <div key={dateStr} onClick={e => handleClick(dateStr, e)}
                                className={cn(
                                    "aspect-square rounded-lg flex items-center justify-center",
                                    canUpdatePlanning ? "cursor-pointer" : "cursor-default",
                                    "border-2 transition-all duration-100 select-none",
                                    isSel ? "bg-slate-900 border-slate-900 ring-2 ring-slate-500 ring-offset-1"
                                        : `bg-white border-slate-100 ${canUpdatePlanning ? "hover:border-slate-300" : ""}`,
                                    isToday && !isSel ? "ring-2 ring-offset-1 ring-slate-700" : ""
                                )}>
                                <span className={`text-[11px] font-medium ${isSel ? "text-slate-500" : "text-slate-300"}`}>{dayNum}</span>
                            </div>
                        );
                    }

                    const c = getStatutColors(jour.statut);
                    const hasHistory = jour.history.length > 0;
                    const wasModified = jour.statut_original && jour.statut_original !== jour.statut;

                    return (
                        <div key={dateStr} className="relative">
                            <div
                                onClick={e => handleClick(dateStr, e)}
                                onMouseEnter={e => handleMouseEnter(e, jour)}
                                className={cn(
                                    "aspect-square rounded-lg flex flex-col items-center justify-center",
                                    canUpdatePlanning ? "cursor-pointer hover:scale-[1.03] hover:shadow-sm" : "cursor-default",
                                    "transition-all duration-100 border-2 select-none relative overflow-hidden",
                                    isSel
                                        ? "ring-2 ring-slate-600 ring-offset-1 shadow-md scale-[1.06] z-10"
                                        : "",
                                    isToday && !isSel ? "ring-2 ring-offset-1 ring-slate-700" : ""
                                )}
                                style={isSel
                                    ? { backgroundColor: "rgb(15 23 42)", borderColor: "rgb(15 23 42)" }
                                    : { backgroundColor: c.bg, borderColor: c.border }
                                }
                            >
                                {/* Numéro */}
                                <span className={cn("text-[10px] leading-none", isSel ? "text-slate-500" : "opacity-50")}
                                    style={isSel ? {} : { color: c.text }}>{dayNum}</span>
                                {/* Code statut */}
                                <span className={cn("text-[11px] font-bold leading-tight mt-0.5", isSel ? "text-white" : "")}
                                    style={isSel ? {} : { color: c.text }}>
                                    {jour.statut}
                                </span>
                                {/* Indicateur nuit */}
                                {jour.pointage?.est_nuit && (
                                    <span className="absolute top-0.5 left-0.5 text-[7px] leading-none">🌙</span>
                                )}
                                {/* Point orange si modifié */}
                                {(hasHistory || wasModified) && !isSel && (
                                    <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-orange-400" />
                                )}
                                {/* Check si sélectionné */}
                                {isSel && (
                                    <div className="absolute top-0.5 right-0.5 w-2.5 h-2.5 rounded-full bg-white/20 flex items-center justify-center">
                                        <div className="w-1.5 h-1.5 rounded-full bg-white" />
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Légende */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-2 border-t border-slate-100">
                {[
                    { code: "P", label: "Présent" },
                    { code: "A", label: "Absent" },
                    { code: "R", label: "Repos" },
                    { code: "JF", label: "Jour Férié" },
                ].map(({ code, label }) => {
                    const c = getStatutColors(code);
                    return (
                        <div key={code} className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: c.text }} />
                            <span className="text-[11px] text-slate-500">{label}</span>
                        </div>
                    );
                })}
                <div className="flex items-center gap-1.5 ml-auto">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-400 inline-block" />
                    <span className="text-[11px] text-slate-400">= modifié manuellement</span>
                </div>
            </div>

            {/* Floating bar */}
            {selected.size > 0 && canUpdatePlanning && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-slate-900 text-white px-4 py-2.5 rounded-2xl shadow-2xl animate-in slide-in-from-bottom-3 duration-200">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-white/15 flex items-center justify-center">
                            <span className="text-[11px] font-bold">{selected.size}</span>
                        </div>
                        <span className="text-sm text-slate-300">
                            {selected.size === 1 ? "jour sélectionné" : "jours sélectionnés"}
                        </span>
                    </div>
                    <div className="w-px h-5 bg-white/20" />
                    <button onClick={() => setAnnotOpen(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-slate-900 rounded-xl text-xs font-semibold hover:bg-slate-100 transition-colors">
                        <Pencil className="w-3.5 h-3.5" />Modifier
                    </button>
                    <button onClick={clearSelection}
                        className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-slate-400 hover:text-white">
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            )}

            <AnnotModal
                open={annotOpen}
                onOpenChange={setAnnotOpen}
                matricule={matricule}
                id={id}
                dates={selectedArray}
                currentCode={singleJour?.annotation?.code}
                currentStatut={singleJour?.statut}
                onSuccess={() => { clearSelection(); onPlanningUpdated(); }}
                permissions={annotationPermissions}
            />
        </div>
    );
}

// ─── PointageRow ──────────────────────────────────────────────

function PointageRow({ p }: { p: Pointage }) {
    const qcfg = getQualiteConfig(p.qualite);
    const QIcon = qcfg.icon;
    const d = new Date(p.date);
    return (
        <div className="flex items-center gap-4 py-3 px-4 rounded-xl hover:bg-slate-50 transition-colors">
            <div className="w-16 shrink-0 text-center">
                <div className="text-[10px] font-semibold text-slate-400 uppercase">{JOURS_FR[d.getDay()]}</div>
                <div className="text-sm font-bold text-slate-700">{d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</div>
            </div>
            <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-lg">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span className="text-xs font-mono font-medium text-slate-700">{p.heure_entree ?? "--:--"}</span>
                </div>
                <span className="text-slate-300 text-xs">→</span>
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-lg">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span className="text-xs font-mono font-medium text-slate-700">{p.heure_sortie ?? "--:--"}</span>
                </div>
                {p.est_nuit && <span className="text-[10px] px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded-md font-medium">Nuit</span>}
            </div>
            <div className="w-20 text-right shrink-0">
                {p.duree ? <span className="text-sm font-semibold text-slate-800">{p.duree}</span> : <span className="text-sm text-slate-300">—</span>}
            </div>
            <div className="w-24 flex items-center gap-1.5 justify-end shrink-0">
                <QIcon className={`w-3.5 h-3.5 ${qcfg.color}`} />
                <span className={`text-xs font-medium ${qcfg.color}`}>{qcfg.label}</span>
            </div>
        </div>
    );
}

// ─── Page principale ──────────────────────────────────────────

export default function EmployeeDetailPage() {
    const params = useParams();
    const router = useRouter();
    const id = params?.employeeId as string;

    const now = new Date();
    const [calYear, setCalYear] = useState(now.getFullYear());
    const [calMonth, setCalMonth] = useState(now.getMonth());

    const defaultFin = toYMD(now);
    const defaultDebut = toYMD(new Date(new Date().setMonth(now.getMonth() - 3)));

    const [ptgDebut, setPtgDebut] = useState(defaultDebut);
    const [ptgFin, setPtgFin] = useState(defaultFin);

    const [details, setDetails] = useState<EmployeeDetails | null>(null);
    const [jours, setJours] = useState<JourPlanning[]>([]);
    const [historiqueGlobal, setHistoriqueGlobal] = useState<HistoryEntry[]>([]);
    const [pointages, setPointages] = useState<Pointage[]>([]);
    const [pointageResume, setPointageResume] = useState<any>(null);

    const [loadingDetails, setLoadingDetails] = useState(true);
    const [loadingPlanning, setLoadingPlanning] = useState(true);
    const [loadingPointages, setLoadingPointages] = useState(true);
    const [cycleModalOpen, setCycleModalOpen] = useState(false);

    // Tab management initialisé par défaut sur empty string jusqu'à chargement
    const [activeTab, setActiveTab] = useState<"planning" | "pointages" | "historique" | "">("");

    // permission
    const { session } = useSession();

    const hasPermissionAddAnnotationPresent = useMemo(() => (
        session?.user?.is_admin || session?.user?.permissions.some((p: string[]) => p.includes("add_annotation_present"))
    ), [session]);

    const hasPermissionAddAnnotationAbsent = useMemo(() => (
        session?.user?.is_admin || session?.user?.permissions.some((p: string[]) => p.includes("add_annotation_absent"))
    ), [session]);

    const hasPermissionAddAnnotationRest = useMemo(() => (
        session?.user?.is_admin || session?.user?.permissions.some((p: string[]) => p.includes("add_annotation_rest"))
    ), [session]);

    const hasPermissionAddAnnotationMission = useMemo(() => (
        session?.user?.is_admin || session?.user?.permissions.some((p: string[]) => p.includes("add_annotation_mission"))
    ), [session]);

    const hasPermissionAddAnnotationJustified = useMemo(() => (
        session?.user?.is_admin || session?.user?.permissions.some((p: string[]) => p.includes("add_annotation_justified"))
    ), [session]);

    const hasPermissionAddAnnotationMaladie = useMemo(() => (
        session?.user?.is_admin || session?.user?.permissions.some((p: string[]) => p.includes("add_annotation_maladie"))
    ), [session]);

    const hasPermissionAddAnnotationRecuperation = useMemo(() => (
        session?.user?.is_admin || session?.user?.permissions.some((p: string[]) => p.includes("add_annotation_recuperation"))
    ), [session]);

    const hasPermissionAddAnnotationConge = useMemo(() => (
        session?.user?.is_admin || session?.user?.permissions.some((p: string[]) => p.includes("add_annotation_conge"))
    ), [session]);

    const hasPermissionAddAnnotationCongeExceptionnel = useMemo(() => (
        session?.user?.is_admin || session?.user?.permissions.some((p: string[]) => p.includes("add_annotation_conge_exceptionnel"))
    ), [session]);

    const hasPermissionUpdatePlanning = useMemo(() => (
        session?.user?.is_admin || session?.user?.permissions.some((p: string[]) => p.includes("update_planning"))
    ), [session]);

    const hasPermissionUpdateCycle = useMemo(() => (
        session?.user?.is_admin || session?.user?.permissions.some((p: string[]) => p.includes("update_cycle"))
    ), [session]);

    const hasPermissionViewPlanning = useMemo(() => (
        session?.user?.is_admin || session?.user?.permissions.some((p: string[]) => p.includes("view_planning"))
    ), [session]);

    const hasPermissionViewPointage = useMemo(() => (
        session?.user?.is_admin || session?.user?.permissions.some((p: string[]) => p.includes("view_pointage"))
    ), [session]);

    const hasPermissionViewHistorique = useMemo(() => (
        session?.user?.is_admin || session?.user?.permissions.some((p: string[]) => p.includes("view_history"))
    ), [session]);

    // Grouping annotations permissions to pass easily to children
    const annotationPermissions = useMemo(() => ({
        present: hasPermissionAddAnnotationPresent,
        absent: hasPermissionAddAnnotationAbsent,
        rest: hasPermissionAddAnnotationRest,
        mission: hasPermissionAddAnnotationMission,
        justifie: hasPermissionAddAnnotationJustified,
        maladie: hasPermissionAddAnnotationMaladie,
        recuperation: hasPermissionAddAnnotationRecuperation,
        conge: hasPermissionAddAnnotationConge,
        exceptionnel: hasPermissionAddAnnotationCongeExceptionnel,
    }), [
        hasPermissionAddAnnotationPresent, hasPermissionAddAnnotationAbsent, hasPermissionAddAnnotationRest,
        hasPermissionAddAnnotationMission, hasPermissionAddAnnotationJustified,
        hasPermissionAddAnnotationMaladie, hasPermissionAddAnnotationRecuperation,
        hasPermissionAddAnnotationConge, hasPermissionAddAnnotationCongeExceptionnel
    ]);

    // Dynamically calculate available tabs based on view permissions
    const availableTabs = useMemo(() => {
        const tabs: Array<"planning" | "pointages" | "historique"> = [];
        if (hasPermissionViewPlanning) tabs.push("planning");
        if (hasPermissionViewPointage) tabs.push("pointages");
        if (hasPermissionViewHistorique) tabs.push("historique");
        return tabs;
    }, [hasPermissionViewPlanning, hasPermissionViewPointage, hasPermissionViewHistorique]);

    // Set a valid active tab if the current one is not allowed or empty
    useEffect(() => {
        if (availableTabs.length > 0 && (activeTab === "" || !availableTabs.includes(activeTab as any))) {
            setActiveTab(availableTabs[0]);
        }
    }, [availableTabs, activeTab]);

    useEffect(() => {
        if (!id) return;
        setLoadingDetails(true);
        employeesApi.getDetails(id)
            .then(r => setDetails(r.data))
            .catch(console.error)
            .finally(() => setLoadingDetails(false));
    }, [id]);

    const fetchPlanning = useCallback(() => {
        if (!id || !hasPermissionViewPlanning) return;
        setLoadingPlanning(true);
        const debut = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-01`;
        const fin = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(getDaysInMonth(calYear, calMonth)).padStart(2, "0")}`;
        employeesApi.getPlanning(id, { debut, fin })
            .then(r => {
                setJours(r.data.jours ?? []);
                setHistoriqueGlobal(r.data.historique_global ?? []);
            })
            .catch(console.error)
            .finally(() => setLoadingPlanning(false));
    }, [id, calYear, calMonth, hasPermissionViewPlanning]);

    useEffect(() => { fetchPlanning(); }, [fetchPlanning]);

    const fetchPointages = useCallback((debut: string, fin: string) => {
        if (!id || !hasPermissionViewPointage) return;
        setLoadingPointages(true);
        employeesApi.getPointages(id, { debut, fin })
            .then(r => { setPointages(r.data.pointages ?? []); setPointageResume(r.data.resume ?? null); })
            .catch(console.error)
            .finally(() => setLoadingPointages(false));
    }, [id, hasPermissionViewPointage]);

    useEffect(() => { fetchPointages(ptgDebut, ptgFin); }, [fetchPointages, ptgDebut, ptgFin]);

    const getCycleLabel = (cycle: any) => {
        if (!cycle) return "?";
        if (cycle.type === "weekly") {
            try {
                let days = JSON.parse(cycle.rest_days || "[]");
                if (typeof days === "string") days = JSON.parse(days);
                return `R: ${days.map((d: number) => ["Di", "Lu", "Ma", "Me", "Je", "Ve", "Sa"][d]).join("-")}`;
            } catch { return "?"; }
        }
        if (cycle.type === "rotation") return `${cycle.travail}T/${cycle.repos}R`;
        if (cycle.type === "night") return `Nuit ${cycle.travail}T/${cycle.repos}R`;
        return "?";
    };

    const stats = details?.statistiques;

    return (
        <div className="min-h-screen bg-[#f8f8f6]">
            {/* Header */}
            <div className="bg-white border-b border-slate-100 sticky top-0 z-20">
                <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-4">
                    <button onClick={() => router.back()}
                        className="p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-500">
                        <ArrowLeft className="w-4 h-4" />
                    </button>
                    {loadingDetails ? (
                        <div className="flex gap-3 items-center">
                            <Skeleton className="h-10 w-10 rounded-full" />
                            <div className="space-y-1.5"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-20" /></div>
                        </div>
                    ) : details ? (
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-white font-semibold text-sm">
                                {details.prenom?.[0]}{details.nom?.[0]}
                            </div>
                            <div>
                                <h1 className="font-bold text-slate-900 leading-tight">{details.prenom} {details.nom}</h1>
                                <p className="text-xs text-slate-400 font-mono">{details.matricule}</p>
                            </div>
                            {details.poste && <Badge variant="secondary" className="ml-2 text-xs font-normal">{details.poste}</Badge>}
                            {details.cycle && (
                                <Badge variant="outline" className="ml-2 text-xs font-normal">
                                    Cycle {details.cycle.type} {getCycleLabel(details.cycle)}
                                </Badge>
                            )}
                        </div>
                    ) : null}
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">

                {/* Infos rapides */}
                {!loadingDetails && details && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                        {details.poste && (
                            <div className="flex items-center gap-2.5 text-sm text-slate-600">
                                <Briefcase className="w-4 h-4 text-slate-400 shrink-0" /><span>{details.poste}</span>
                            </div>
                        )}
                        {details.zone && (
                            <div className="flex items-center gap-2.5 text-sm text-slate-600">
                                <MapPin className="w-4 h-4 text-slate-400 shrink-0" /><span>{details.zone}</span>
                            </div>
                        )}
                        {
                            details.departement && (
                                <div className="flex items-center gap-2.5 text-sm text-slate-600">
                                    <Building2 className="w-4 h-4 text-slate-400 shrink-0" /><span>{details.departement}</span>
                                </div>
                            )
                        }
                        {details.cycle && (
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2.5 text-sm text-slate-600">
                                    <Activity className="w-4 h-4 text-slate-400 shrink-0" />
                                    <span className="capitalize">
                                        Cycle {getCycleLabel(details.cycle)}
                                        {details.cycle.travail && ` · ${details.cycle.travail}j / ${details.cycle.repos}j`}
                                        {details.cycle.fiabilite != null && (
                                            <span className="text-slate-400 ml-1">({Math.round(details.cycle.fiabilite * 100)}%)</span>
                                        )}
                                    </span>
                                    {details.cycle.est_manuel && (
                                        <Badge variant="outline" className="text-[10px] py-0 px-1.5 ml-1">Manuel</Badge>
                                    )}
                                </div>
                                {hasPermissionUpdateCycle && (
                                    <button onClick={() => setCycleModalOpen(true)}
                                        className="text-xs text-slate-400 hover:text-slate-700 underline underline-offset-2 transition-colors">
                                        Modifier
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {details && (
                    <CycleModal
                        open={cycleModalOpen}
                        onOpenChange={setCycleModalOpen}
                        employeeIds={[details.id]}
                        employeeMatricule={details.matricule}
                        currentCycle={details.cycle}
                        onSuccess={() => {
                            setLoadingDetails(true);
                            employeesApi.getDetails(id).then(r => setDetails(r.data)).catch(console.error).finally(() => setLoadingDetails(false));
                            fetchPlanning();
                        }}
                    />
                )}

                {/* Stats */}
                {loadingDetails ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {Array(4).fill(0).map((_, i) => (
                            <Card key={i} className="border-0 shadow-sm">
                                <CardContent className="p-5"><Skeleton className="h-3 w-20 mb-3" /><Skeleton className="h-8 w-16" /></CardContent>
                            </Card>
                        ))}
                    </div>
                ) : stats ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <StatCard icon={CheckCircle2} label="Présences" value={stats.presents} sub={`sur ${stats.total_jours} jours`} accent="bg-emerald-500" />
                    </div>
                ) : null}

                {/* Annotations globales */}
                {stats && Object.keys(stats.annotations).length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        {Object.entries(stats.annotations).map(([code, count]) => (
                            <div key={code} className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-full shadow-sm">
                                <span className="text-xs font-mono font-bold text-amber-600">{code}</span>
                                <span className="text-xs text-slate-500">{count}×</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Tabs */}
                {availableTabs.length > 0 && (
                    <div>
                        <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit mb-5">
                            {availableTabs.map(tab => (
                                <button key={tab} onClick={() => setActiveTab(tab)}
                                    className={cn(
                                        "px-5 py-2 rounded-lg text-sm font-medium transition-all duration-150",
                                        activeTab === tab ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"
                                    )}>
                                    <span className="flex items-center gap-2">
                                        {tab === "planning" && <><Calendar className="w-3.5 h-3.5" />Planning</>}
                                        {tab === "pointages" && <><Clock className="w-3.5 h-3.5" />Pointages</>}
                                        {tab === "historique" && (
                                            <>
                                                <History className="w-3.5 h-3.5" />
                                                Historique
                                                {historiqueGlobal.length > 0 && (
                                                    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-orange-100 text-orange-600 text-[9px] font-bold">
                                                        {historiqueGlobal.length}
                                                    </span>
                                                )}
                                            </>
                                        )}
                                    </span>
                                </button>
                            ))}
                        </div>

                        {/* ── Planning ── */}
                        {activeTab === "planning" && hasPermissionViewPlanning && (
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                <Card className="lg:col-span-2 border-0 shadow-sm bg-white">
                                    <CardHeader className="pb-0 pt-5 px-5">
                                        <CardTitle className="text-sm font-semibold text-slate-700">Calendrier mensuel</CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-5">
                                        {loadingPlanning ? (
                                            <div className="space-y-2">
                                                <Skeleton className="h-6 w-32 mx-auto" />
                                                <div className="grid grid-cols-7 gap-1">
                                                    {Array(35).fill(0).map((_, i) => <Skeleton key={i} className="aspect-square rounded-lg" />)}
                                                </div>
                                            </div>
                                        ) : (
                                            <PlanningCalendar
                                                jours={jours}
                                                year={calYear}
                                                month={calMonth}
                                                id={id}
                                                matricule={details?.matricule ?? ""}
                                                onMonthChange={(y, m) => { setCalYear(y); setCalMonth(m); }}
                                                onPlanningUpdated={fetchPlanning}
                                                canUpdatePlanning={hasPermissionUpdatePlanning}
                                                annotationPermissions={annotationPermissions}
                                            />
                                        )}
                                    </CardContent>
                                </Card>

                                {/* Résumé mensuel */}
                                <Card className="border-0 shadow-sm bg-white">
                                    <CardHeader className="pb-0 pt-5 px-5">
                                        <CardTitle className="text-sm font-semibold text-slate-700">Résumé — {MOIS_FR[calMonth]}</CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-5 space-y-4">
                                        {loadingPlanning ? (
                                            <div className="space-y-3">{Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
                                        ) : (
                                            <>
                                                {[
                                                    { code: "P", count: jours.filter(j => j.statut === "P").length },
                                                    { code: "A", count: jours.filter(j => j.statut !== "P" && j.statut !== "R" && j.statut !== "JF").length },
                                                    { code: "R", count: jours.filter(j => j.statut === "R").length },
                                                    { code: "JF", count: jours.filter(j => j.statut === "JF").length },
                                                ].filter(item => item.count > 0 || item.code !== "JF").map(({ code, count }) => {
                                                    const c = getStatutColors(code);
                                                    const pct = jours.length > 0 ? Math.round((count / jours.length) * 100) : 0;
                                                    const lbl = code === "P" ? "Présent" : code === "R" ? "Repos" : code === "JF" ? "Jour Férié" : "Absent";
                                                    return (
                                                        <div key={code} className="p-3 rounded-xl border" style={{ backgroundColor: c.bg, borderColor: c.border }}>
                                                            <div className="flex items-center justify-between mb-2">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: c.text }} />
                                                                    <span className="text-xs font-medium" style={{ color: c.text }}>{lbl}</span>
                                                                </div>
                                                                <span className="text-lg font-bold" style={{ color: c.text }}>{count}</span>
                                                            </div>
                                                            <div className="w-full bg-white rounded-full h-1.5">
                                                                <div className="h-1.5 rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: c.text }} />
                                                            </div>
                                                        </div>
                                                    );
                                                })}

                                                {/* Annotations du mois */}
                                                {jours.some(j => j.annotation) && (
                                                    <div className="pt-2 border-t border-slate-100">
                                                        <p className="text-xs font-medium text-slate-500 mb-2">Annotations du mois</p>
                                                        <div className="space-y-1.5">
                                                            {jours.filter(j => j.annotation).map((j, i) => (
                                                                <div key={i} className="flex items-center gap-2 text-xs">
                                                                    <span className="text-slate-400 font-mono w-14 shrink-0">
                                                                        {new Date(j.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                                                                    </span>
                                                                    <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded font-mono font-bold text-[10px]">
                                                                        {j.annotation!.code}
                                                                    </span>
                                                                    <span className="text-slate-500 truncate">{j.annotation!.libelle}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>
                        )}

                        {/* ── Pointages ── */}
                        {activeTab === "pointages" && hasPermissionViewPointage && (
                            <div className="space-y-4">
                                <DateFilterBar debut={ptgDebut} fin={ptgFin} onApply={(d, f) => { setPtgDebut(d); setPtgFin(f); }} />
                                {pointageResume && (
                                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                        {[
                                            { label: "Total", value: pointageResume.total, color: "text-slate-800" },
                                            { label: "Complets", value: pointageResume.complets, color: "text-emerald-600" },
                                            { label: "Incomplets", value: pointageResume.incomplets, color: "text-amber-600" },
                                            { label: "Suspects", value: pointageResume.suspects, color: "text-rose-600" },
                                            { label: "Heures", value: pointageResume.total_heures, color: "text-violet-600" },
                                        ].map(({ label, value, color }) => (
                                            <div key={label} className="bg-white rounded-xl p-3 border border-slate-100 shadow-sm text-center">
                                                <div className={`text-xl font-bold ${color}`}>{value}</div>
                                                <div className="text-[10px] text-slate-400 uppercase tracking-wide mt-0.5">{label}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <Card className="border-0 shadow-sm bg-white">
                                    <CardHeader className="pb-0 pt-5 px-5">
                                        <CardTitle className="text-sm font-semibold text-slate-700">Détail — {ptgDebut} → {ptgFin}</CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-3">
                                        {loadingPointages ? (
                                            <div className="space-y-1">{Array(8).fill(0).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
                                        ) : pointages.length === 0 ? (
                                            <div className="text-center py-12 text-slate-400">
                                                <Coffee className="w-8 h-8 mx-auto mb-3 opacity-30" />
                                                <p className="text-sm">Aucun pointage sur cette période</p>
                                            </div>
                                        ) : (
                                            <div className="divide-y divide-slate-50">
                                                <div className="flex items-center gap-4 px-4 pb-2">
                                                    <div className="w-16 shrink-0" />
                                                    <div className="flex-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Horaires</div>
                                                    <div className="w-20 text-right shrink-0 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Durée</div>
                                                    <div className="w-24 text-right shrink-0 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Qualité</div>
                                                </div>
                                                {pointages.map(p => <PointageRow key={p.id} p={p} />)}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>
                        )}

                        {/* ── Historique global ── */}
                        {activeTab === "historique" && hasPermissionViewHistorique && (
                            <Card className="border-0 shadow-sm bg-white">
                                <CardHeader className="pt-5 px-5 pb-0">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                                            <History className="w-4 h-4" />
                                            Toutes les modifications
                                        </CardTitle>
                                        <span className="text-xs text-slate-400">
                                            {historiqueGlobal.length} entrée{historiqueGlobal.length > 1 ? "s" : ""}
                                        </span>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-5">
                                    {loadingPlanning ? (
                                        <div className="space-y-2">
                                            {Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}
                                        </div>
                                    ) : (
                                        <HistoriqueGlobal entries={historiqueGlobal} />
                                    )}
                                </CardContent>
                            </Card>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
// components/planning/PlanningTable.tsx
'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import {
    Calendar, ExternalLink, Pencil, RefreshCw, X,
    CheckCircle2, XCircle, Coffee, FileText, Stethoscope,
    Palmtree, Sparkles, Users, ChevronLeft, ChevronRight,
    ArrowRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ZoneColumn } from './ZoneColumn'
import { CycleModal } from '../modals/CycleModal'
import { planningApi } from '@/lib/api'
import toast from 'react-hot-toast'
import { useSession } from '@/hooks/use-session'

// ─── Config annotations ───────────────────────────────────────

const ANNOT_BASE = [
    { code: 'P', label: 'Présent', Icon: CheckCircle2, active: 'bg-emerald-600 border-emerald-600 text-white', rest: 'bg-emerald-100 border-emerald-300 text-emerald-800' },
    { code: 'A', label: 'Absent', Icon: XCircle, active: 'bg-rose-600 border-rose-600 text-white', rest: 'bg-rose-100 border-rose-300 text-rose-800' },
    { code: 'R', label: 'Repos', Icon: Coffee, active: 'bg-slate-800 border-slate-800 text-white', rest: 'bg-slate-100 border-slate-300 text-slate-700' },
]

const ANNOT_TYPES = [
    { code: 'M', label: 'Mission', Icon: FileText, color: '#1e40af', light: '#dbeafe', border: '#bfdbfe' },
    { code: 'J', label: 'Justifié', Icon: CheckCircle2, color: '#047857', light: '#d1fae5', border: '#a7f3d0' },
    { code: 'Md', label: 'Maladie', Icon: Stethoscope, color: '#b91c1c', light: '#fee2e2', border: '#fecaca' },
    { code: 'Rc', label: 'Récupération', Icon: RefreshCw, color: '#6d28d9', light: '#ede9fe', border: '#ddd6fe' },
    { code: 'C', label: 'Congé', Icon: Palmtree, color: '#b45309', light: '#ffedd5', border: '#fde68a' },
    { code: 'Ce', label: 'Congé exceptionnel', Icon: Sparkles, color: '#be185d', light: '#fce7f3', border: '#fbcfe8' },
    // no JF (Géré automatiquement)
]

const ANNOT_LABELS: Record<string, string> = Object.fromEntries(ANNOT_TYPES.map(a => [a.code, a.label]))
const getAnnotLabel = (code: string) => ANNOT_LABELS[code] ?? code

const CELL_COLORS: Record<string, { bg: string; text: string }> = {
    P: { bg: '#dcfce7', text: '#166534' },
    A: { bg: '#ffe4e6', text: '#9f1239' },
    R: { bg: '#f1f5f9', text: '#334155' },
    M: { bg: '#dbeafe', text: '#1e40af' },
    J: { bg: '#d1fae5', text: '#047857' },
    Md: { bg: '#fee2e2', text: '#b91c1c' },
    Rc: { bg: '#ede9fe', text: '#6d28d9' },
    C: { bg: '#ffedd5', text: '#b45309' },
    Ce: { bg: '#fce7f3', text: '#be185d' },
    JF: { bg: '#dbeafe', text: '#1e40af' },
}

const ANNOT_SET = new Set(['M', 'J', 'Md', 'Rc', 'C', 'Ce'])

const PAGE_SIZE_OPTIONS = [10, 30, 50, 200, 300]
const DEFAULT_PAGE_SIZE = 30

// ─── Types ────────────────────────────────────────────────────

interface EmpStats {
    presents: number
    absences: number
    absences_nettes: number
    absences_annotees: number
    repos: number
    jours_feries: number
    presences_supplementaires: number
    total: number
}

interface HistoryEntry {
    ancien_statut: string | null
    nouveau_statut: string | null
    type_modification: string
    modifie_par: string | null
    modifie_le: string
}

// ─── EmployeeInfoTooltip ─────────────────────────────────────
function EmployeeInfoTooltip({ visible, employee, posX, posY }: any) {
    if (!visible) return null
    const getCycleLabel = (cycle: any): string => {
        if (!cycle) return '—'
        if (cycle.type === 'weekly') {
            try {
                let days = JSON.parse(cycle.rest_days || '[]')
                if (typeof days === 'string') days = JSON.parse(days)
                return `Repos: ${days.map((d: number) => ['Di', 'Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa'][d]).join('-')}`
            } catch (e) { return '?' }
        }
        if (cycle.type === 'rotation') return `${cycle.travail}T / ${cycle.repos}R`
        if (cycle.type === 'night') return `🌙 ${cycle.travail}/${cycle.repos}`
        return '?'
    }
    return (
        <div className="fixed z-[9999] pointer-events-none" style={{ left: posX, top: posY }}>
            <div className="bg-slate-900 text-white rounded-xl shadow-2xl p-3 w-[280px] text-[11px] animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-start justify-between gap-3 mb-2 pb-2 border-b border-white/10">
                    <div className="flex-1">
                        <div className="flex items-center gap-1.5 mb-1">
                            <span className="font-mono text-xs font-bold text-emerald-400">{employee.matricule}</span>
                            {employee.cycles?.est_manuel && (
                                <span className="text-[9px] px-1.5 py-0.5 bg-amber-500/20 text-amber-300 rounded border border-amber-500/30 font-medium">Manuel</span>
                            )}
                        </div>
                        <div className="text-sm font-semibold text-white">{employee.prenom} {employee.nom}</div>
                    </div>
                </div>
                <div className="space-y-1.5">
                    {employee.poste && (
                        <div className="flex items-center justify-between">
                            <span className="text-slate-400">Poste</span><span className="text-slate-200 font-medium">{employee.poste}</span>
                        </div>
                    )}
                    {employee.zone && (
                        <div className="flex items-center justify-between">
                            <span className="text-slate-400">Zone</span><span className="text-slate-200 font-medium">{employee.zone}</span>
                        </div>
                    )}
                    <div className="flex items-center justify-between">
                        <span className="text-slate-400">Cycle</span><span className="text-slate-200 font-mono text-[10px]">{getCycleLabel(employee.cycles)}</span>
                    </div>
                </div>
            </div>
        </div>
    )
}

// ─── StatutBadge ─────────────────────────────────────────────
function StatutBadge({ code }: { code: string | null | undefined }) {
    if (!code) return <span className="text-slate-500 italic text-[10px]">—</span>
    const colors = CELL_COLORS[code]
    return (
        <span className="inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold shrink-0"
            style={colors ? { backgroundColor: colors.bg, color: colors.text } : { backgroundColor: '#f1f5f9', color: '#64748b' }}>
            {code}
        </span>
    )
}

// ─── HistoryTooltip ───────────────────────────────────────────
interface TooltipState { visible: boolean; history: HistoryEntry[]; statut: string; statut_original: string | null; date: string; posX: number; posY: number }
function HistoryTooltip({ state }: { state: TooltipState }) {
    if (!state.visible) return null
    const { history, statut, statut_original, date } = state
    const hasHistory = history.length > 0
    const wasModified = statut_original && statut_original !== statut
    return (
        <div className="fixed z-[9999] pointer-events-none" style={{ left: state.posX, top: state.posY }}>
            <div className="bg-slate-900 text-white rounded-xl shadow-2xl p-3 w-[240px] text-[11px]">
                <div className="flex items-center gap-1.5 mb-2.5 pb-2 border-b border-white/10">
                    <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                    <span className="text-slate-300 font-medium">
                        {new Date(date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </span>
                </div>
                <div className="space-y-1.5 mb-2">
                    <div className="flex items-center justify-between"><span className="text-slate-400">Statut actuel</span><StatutBadge code={statut} /></div>
                    {statut_original && (
                        <div className="flex items-center justify-between">
                            <span className="text-slate-400">Statut {wasModified ? 'original' : 'calculé'}</span>
                            <div className="flex items-center gap-1">
                                <StatutBadge code={statut_original} />
                                {wasModified && <span className="text-orange-400 text-[9px] font-semibold">modifié</span>}
                            </div>
                        </div>
                    )}
                </div>
                {hasHistory ? (
                    <div className="pt-2 border-t border-white/10 space-y-2">
                        <p className="text-slate-500 uppercase tracking-wide text-[9px] font-semibold">Historique ({history.length})</p>
                        {history.map((h, idx) => (
                            <div key={idx} className="space-y-0.5">
                                <div className="flex items-center gap-1.5">
                                    <StatutBadge code={h.ancien_statut} /><ArrowRight className="w-2.5 h-2.5 text-slate-500 shrink-0" /><StatutBadge code={h.nouveau_statut} />
                                    <span className="ml-auto text-slate-500 text-[9px]">{h.type_modification === 'annotation' ? '🏷️' : '✏️'}</span>
                                </div>
                                <div className="flex items-center justify-between text-[9px] text-slate-500 pl-0.5">
                                    {h.modifie_par ? <span className="text-slate-400 font-medium truncate max-w-[110px]">{h.modifie_par}</span> : <span className="italic">Inconnu</span>}
                                    <span className="shrink-0 ml-2">
                                        {new Date(h.modifie_le).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}{' '}
                                        {new Date(h.modifie_le).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="pt-2 border-t border-white/10"><p className="text-slate-500 text-[10px] italic">Aucune modification manuelle</p></div>
                )}
            </div>
        </div>
    )
}

// ─── AnnotModal ───────────────────────────────────────────────
interface AnnotModalProps {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    cells: { matricule: string; employeeId: string; date: string }[];
    currentCode?: string;
    currentStatut?: string;
    onOptimisticUpdate: (updates: any) => void;
    onSuccess: () => void;
    onAfterSave?: () => void;
    permissions: {
        mission: boolean;
        justified: boolean;
        maladie: boolean;
        recuperation: boolean;
        conge: boolean;
        congeExceptionnel: boolean;
        updatePlanning: boolean;
    }
}

function AnnotModal({ open, onOpenChange, cells, currentCode, currentStatut, onOptimisticUpdate, onSuccess, onAfterSave, permissions }: AnnotModalProps) {
    const [base, setBase] = useState(''); const [annot, setAnnot] = useState(''); const [desc, setDesc] = useState(''); const [saving, setSaving] = useState(false)
    const isSingle = cells.length === 1
    useEffect(() => {
        if (!open) return
        if (isSingle && currentCode) { setAnnot(currentCode); setBase(currentStatut ?? 'A') }
        else if (isSingle && currentStatut) { setBase(currentStatut); setAnnot('') }
        else { setBase(''); setAnnot('') }
        setDesc('')
    }, [open, isSingle, currentCode, currentStatut])

    const pickBase = (c: string) => { setBase(c); if (c !== 'A') setAnnot('') }
    const pickAnnot = (c: string) => { setAnnot(a => a === c ? '' : c); setBase('A') }
    const canSave = base !== '' || annot !== ''

    const handleSave = async () => {
        if (!canSave) return
        setSaving(true)
        const updates = cells.map(({ matricule, date }) => ({ matricule, date, statut: annot ? 'A' : base, annotCode: annot || undefined, annotLibelle: annot ? getAnnotLabel(annot) : undefined }))
        onOptimisticUpdate(updates)
        onOpenChange(false)
        toast.success(cells.length > 1 ? `${cells.length} cellules modifiées` : 'Enregistré')
        try {
            await Promise.all(cells.map(({ employeeId, date }) => annot ? planningApi.update(employeeId, { date, statut: 'A', annotation: { code: annot, libelle: getAnnotLabel(annot), description: desc || undefined } }) : planningApi.update(employeeId, { date, statut: base })))
            onSuccess(); if (onAfterSave) onAfterSave()
        } catch { toast.error('Erreur serveur — rechargement recommandé') } finally { setSaving(false) }
    }

    const label = cells.length === 1 ? `${cells[0].matricule} · ${new Date(cells[0].date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}` : `${cells.length} cellules sélectionnées`

    const canUseAnnot = (code: string) => {
        if (!permissions.updatePlanning) return false;
        if (code === 'M') return permissions.mission;
        if (code === 'J') return permissions.justified;
        if (code === 'Md') return permissions.maladie;
        if (code === 'Rc') return permissions.recuperation;
        if (code === 'C') return permissions.conge;
        if (code === 'Ce') return permissions.congeExceptionnel;
        return true;
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[460px] p-0 overflow-hidden gap-0">
                <div className="px-6 pt-6 pb-4 border-b border-slate-100">
                    <DialogTitle className="text-base font-semibold text-slate-900">Modifier le planning</DialogTitle>
                    <p className="text-sm text-slate-500 mt-0.5">{label}</p>
                </div>
                <div className="px-6 py-5 space-y-5 max-h-[60vh] overflow-y-auto">
                    <div>
                        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Statut</p>
                        <div className="grid grid-cols-3 gap-2">
                            {ANNOT_BASE.map(({ code, label, Icon, active, rest }) => {
                                const isOn = base === code && !annot
                                const hasPerm = permissions.updatePlanning;
                                return (
                                    <button
                                        key={code}
                                        onClick={() => hasPerm && pickBase(code)}
                                        disabled={!hasPerm}
                                        className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all duration-150 ${isOn ? active + ' shadow-sm' : rest + ' hover:opacity-80'} ${!hasPerm ? 'opacity-40 cursor-not-allowed' : ''}`}>
                                        <Icon className="w-5 h-5" /><span className="text-xs font-semibold">{label}</span>
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex-1 h-px bg-slate-100" /><span className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">ou annotation</span><div className="flex-1 h-px bg-slate-100" />
                    </div>
                    <div>
                        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Annotation</p>
                        <div className="grid grid-cols-2 gap-2">
                            {ANNOT_TYPES.map(({ code, label, Icon, color, light, border }) => {
                                const isOn = annot === code
                                const hasPerm = canUseAnnot(code);
                                return (
                                    <button
                                        key={code}
                                        onClick={() => hasPerm && pickAnnot(code)}
                                        disabled={!hasPerm}
                                        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border-2 transition-all duration-150 text-left ${!hasPerm ? 'opacity-40 cursor-not-allowed' : ''}`}
                                        style={{ backgroundColor: isOn ? color : light, borderColor: isOn ? color : border }}>
                                        <Icon className="w-4 h-4 shrink-0" style={{ color: isOn ? '#fff' : color }} />
                                        <div>
                                            <div className="text-[11px] font-bold font-mono leading-none" style={{ color: isOn ? '#fff' : color }}>{code}</div>
                                            <div className="text-[11px] leading-tight mt-0.5" style={{ color: isOn ? 'rgba(255,255,255,0.82)' : color }}>{label}</div>
                                        </div>
                                        {isOn && <div className="ml-auto w-4 h-4 rounded-full bg-white/20 flex items-center justify-center"><div className="w-2 h-2 rounded-full bg-white" /></div>}
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                    {annot && (
                        <div>
                            <Label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Description <span className="font-normal normal-case">(optionnelle)</span></Label>
                            <Textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="Préciser les détails..." className="mt-2 text-sm resize-none h-16 bg-slate-50 border-slate-200" />
                        </div>
                    )}
                </div>
                <div className="px-6 py-4 flex items-center justify-between border-t border-slate-100">
                    <span className="text-xs text-slate-400">
                        {annot ? <><span className="font-mono font-bold text-slate-600">{annot}</span>{cells.length > 1 && ` · ${cells.length} cellules`}</> : base ? <span className="font-medium text-slate-600">{ANNOT_BASE.find(t => t.code === base)?.label}</span> : 'Aucune sélection'}
                    </span>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Annuler</Button>
                        <Button size="sm" onClick={handleSave} disabled={saving || !canSave} className="min-w-[90px]">{saving ? '...' : `Enregistrer${cells.length > 1 ? ` (${cells.length})` : ''}`}</Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}

// ─── StatsCell ────────────────────────────────────────────────
function StatsCell({ stats }: { stats: EmpStats }) {
    return (
        <div className="flex flex-wrap items-center gap-0.5 justify-center py-0.5">
            <span title="Présences" className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-bold leading-none">
                <span className="text-[9px] font-normal opacity-60">P</span>{stats.presents}
            </span>
            <span title="Absences non justifiées"
                className={cn('inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[10px] font-bold leading-none',
                    stats.absences_nettes > 5 ? 'bg-rose-100 text-rose-700' :
                        stats.absences_nettes > 0 ? 'bg-amber-50 text-amber-700' :
                            'bg-slate-100 text-slate-400')}>
                <span className="text-[9px] font-normal opacity-60">A</span>{stats.absences_nettes}
            </span>
            {stats.absences_annotees > 0 && (
                <span title="Absences justifiées" className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-blue-50 text-blue-600 text-[10px] font-bold leading-none">
                    <span className="text-[9px] font-normal opacity-60">J</span>{stats.absences_annotees}
                </span>
            )}
            <span title="Repos" className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-slate-100 text-slate-500 text-[10px] font-bold leading-none">
                <span className="text-[9px] font-normal opacity-60">R</span>{stats.repos}
            </span>
            {stats.jours_feries > 0 && (
                <span title="Jours Fériés" className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-cyan-50 text-cyan-700 text-[10px] font-bold leading-none">
                    <span className="text-[9px] font-normal opacity-60">JF</span>{stats.jours_feries}
                </span>
            )}
            {stats.presences_supplementaires > 0 && (
                <span title="Présent un jour de repos" className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-violet-50 text-violet-700 text-[10px] font-bold leading-none">
                    <span className="text-[9px] font-normal opacity-60">+</span>{stats.presences_supplementaires}
                </span>
            )}
        </div>
    )
}

// ─── Helpers ─────────────────────────────────────────────────

function getCycleLabel(cycle: any): string {
    if (!cycle) return '—'
    if (cycle.type === 'weekly') {
        try {
            let days = JSON.parse(cycle.rest_days || '[]')
            if (typeof days === 'string') days = JSON.parse(days)
            return `R:${days.map((d: number) => ['Di', 'Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa'][d]).join('-')}`
        } catch (e) {
            console.error(e)
            return '?'
        }
    }
    if (cycle.type === 'rotation') return `${cycle.travail}T/${cycle.repos}R`
    if (cycle.type === 'night') return `🌙${cycle.travail}/${cycle.repos}`
    return '?'
}

const EMPTY_STATS: EmpStats = {
    presents: 0, absences: 0, absences_nettes: 0,
    absences_annotees: 0, repos: 0, jours_feries: 0, presences_supplementaires: 0, total: 0,
}

// ─── Props ────────────────────────────────────────────────────

interface PlanningTableProps {
    employees: any[]
    planningData: Record<string, any>
    onPlanningDataChange: (newData: Record<string, any>) => void
    dates: string[]
    selectedMat: string | null
    onSelectMat: (mat: string | null) => void
    workspaceId: string
    onUpdate: () => void
}

// ─── PlanningTable ────────────────────────────────────────────

export function PlanningTable({
    employees, planningData, onPlanningDataChange, dates,
    selectedMat, onSelectMat, workspaceId, onUpdate,
}: PlanningTableProps) {
    const router = useRouter()

    // ── Pagination ────────────────────────────────────────────
    const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
    const [page, setPage] = useState(0)
    const totalPages = Math.ceil(employees.length / pageSize)
    const pagedEmployees = useMemo(
        () => employees.slice(page * pageSize, (page + 1) * pageSize),
        [employees, page, pageSize]
    )

    useEffect(() => { setPage(0) }, [pageSize])
    useEffect(() => { setPage(0) }, [employees.length])
    const handlePageSizeChange = (newSize: number) => { setPageSize(newSize) }
    const goToFirstPage = useCallback(() => { setPage(0) }, [])
    const goToLastPage = useCallback(() => { setPage(totalPages - 1) }, [totalPages])

    // ── Sélection ─────────────────────────────────────────────
    const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(new Set())
    const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set())
    const [lastClickedCell, setLastClickedCell] = useState<string | null>(null)

    const [cycleModalOpen, setCycleModalOpen] = useState(false)
    const [annotModalOpen, setAnnotModalOpen] = useState(false)
    const [annotModalCells, setAnnotModalCells] = useState<{ matricule: string; employeeId: string; date: string }[]>([])
    const [annotSingleCode, setAnnotSingleCode] = useState<string | undefined>()
    const [annotSingleStatut, setAnnotSingleStatut] = useState<string | undefined>()

    // permission
    const { session } = useSession();

    const hasPermissionAddAnnotationMission = useMemo(() => (
        session?.user?.is_admin ||
        session?.user?.permissions.some((p: string) => p === "add_annotation_mission")
    ), [session]);

    const hasPermissionAddAnnotationJustified = useMemo(() => (
        session?.user?.is_admin ||
        session?.user?.permissions.some((p: string) => p === "add_annotation_justified")
    ), [session]);

    const hasPermissionAddAnnotationMaladie = useMemo(() => (
        session?.user?.is_admin ||
        session?.user?.permissions.some((p: string) => p === "add_annotation_maladie")
    ), [session]);

    const hasPermissionAddAnnotationRecuperation = useMemo(() => (
        session?.user?.is_admin ||
        session?.user?.permissions.some((p: string) => p === "add_annotation_recuperation")
    ), [session]);

    const hasPermissionAddAnnotationConge = useMemo(() => (
        session?.user?.is_admin ||
        session?.user?.permissions.some((p: string) => p === "add_annotation_conge")
    ), [session]);

    const hasPermissionAddAnnotationCongeExceptionnel = useMemo(() => (
        session?.user?.is_admin ||
        session?.user?.permissions.some((p: string) => p === "add_annotation_conge_exceptionnel")
    ), [session]);

    const hasPermissionUpdateCycle = useMemo(() => (
        session?.user?.is_admin ||
        session?.user?.permissions.some((p: string) => p === "update_cycle")
    ), [session]);

    const hasPermissionViewCycle = useMemo(() => (
        session?.user?.is_admin ||
        session?.user?.permissions.some((p: string) => p === "view_cycle")
    ), [session]);

    const hasPermissionUpdatePlanning = useMemo(() => (
        session?.user?.is_admin ||
        session?.user?.permissions.some((p: string) => p === "update_planning")
    ), [session]);

    const hasPermissionViewPlanning = useMemo(() => (
        session?.user?.is_admin ||
        session?.user?.permissions.some((p: string) => p === "view_planning")
    ), [session]);

    const firstSelectedEmp = employees.find(e => selectedEmployees.has(e.matricule))

    // ── Tooltip ───────────────────────────────────────────────
    const TOOLTIP_EMPTY: TooltipState = { visible: false, history: [], statut: '', statut_original: null, date: '', posX: 0, posY: 0 }
    const [tooltip, setTooltip] = useState<TooltipState>(TOOLTIP_EMPTY)
    const [employeeTooltip, setEmployeeTooltip] = useState<{ visible: boolean; employee: any; posX: number; posY: number }>({ visible: false, employee: null, posX: 0, posY: 0 })

    const hideTooltip = useCallback(() => {
        setTooltip(t => ({ ...t, visible: false }))
        setEmployeeTooltip(prev => ({ ...prev, visible: false }))
    }, [])

    const showTooltip = useCallback((e: React.MouseEvent, history: HistoryEntry[], statut: string, statut_original: string | null, date: string) => {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
        const tipHeight = 260
        const spaceBelow = window.innerHeight - rect.bottom
        const posY = spaceBelow > tipHeight ? rect.bottom + 6 : rect.top - tipHeight - 6
        const posX = Math.min(rect.left, window.innerWidth - 260)
        setTooltip({ visible: true, history, statut, statut_original, date, posX, posY })
    }, [])

    const showEmployeeTooltip = useCallback((e: React.MouseEvent, employee: any) => {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
        const tipHeight = 200
        const spaceBelow = window.innerHeight - rect.bottom
        const posY = spaceBelow > tipHeight ? rect.bottom + 6 : rect.top - tipHeight - 6
        const posX = Math.min(rect.left, window.innerWidth - 280)
        setEmployeeTooltip({ visible: true, employee, posX, posY })
    }, [])

    // ── Optimistic update ─────────────────────────────────────
    const handleOptimisticUpdate = useCallback((
        updates: { matricule: string; date: string; statut: string; annotCode?: string; annotLibelle?: string }[]
    ) => {
        const newData = { ...planningData }

        updates.forEach(({ matricule, date, statut, annotCode, annotLibelle }) => {
            if (!newData[matricule]) return
            const empData = { ...newData[matricule] }

            const plannings = [...(empData.plannings ?? [])]
            const pIdx = plannings.findIndex((p: any) => (p.date?.split?.('T')?.[0] ?? p.date) === date)
            if (pIdx >= 0) plannings[pIdx] = { ...plannings[pIdx], statut }
            else plannings.push({ id: null, date, statut, annotation_id: null, history: [], statut_original: statut })
            empData.plannings = plannings

            let annotations = [...(empData.annotations ?? [])]
            const aIdx = annotations.findIndex((a: any) => (a.date?.split?.('T')?.[0] ?? a.date) === date)
            if (annotCode) {
                const newAnnot = { id: null, date, code: annotCode, libelle: annotLibelle ?? annotCode }
                if (aIdx >= 0) annotations[aIdx] = newAnnot
                else annotations.push(newAnnot)
            } else {
                if (aIdx >= 0) annotations.splice(aIdx, 1)
            }
            empData.annotations = annotations
            empData.stats = recalculerStats(empData)
            newData[matricule] = empData
        })

        onPlanningDataChange(newData)
    }, [planningData, onPlanningDataChange])

    // ── Data helpers ──────────────────────────────────────────

    const getDisplayCode = (matricule: string, date: string): string => {
        const empData = planningData[matricule]
        if (!empData) return ''
        const annot = empData.annotations?.find((a: any) => (a.date?.split?.('T')?.[0] ?? a.date) === date)
        if (annot) return annot.code
        return empData.plannings?.find((p: any) => (p.date?.split?.('T')?.[0] ?? p.date) === date)?.statut || ''
    }

    const getDisplayStatut = (matricule: string, date: string): string => {
        const empData = planningData[matricule]
        if (!empData) return ''
        return empData.plannings?.find((p: any) => (p.date?.split?.('T')?.[0] ?? p.date) === date)?.statut || ''
    }

    const getCellMeta = (matricule: string, date: string): { history: HistoryEntry[]; statut_original: string | null } => {
        const empData = planningData[matricule]
        if (!empData) return { history: [], statut_original: null }
        const plan = empData.plannings?.find((p: any) => (p.date?.split?.('T')?.[0] ?? p.date) === date)
        return { history: plan?.history ?? [], statut_original: plan?.statut_original ?? null }
    }

    const getStats = (matricule: string): EmpStats => planningData[matricule]?.stats ?? EMPTY_STATS

    // ── Sélection employés ────────────────────────────────────
    const toggleEmployee = (matricule: string, e: React.MouseEvent) => {
        e.stopPropagation()
        setSelectedEmployees(prev => {
            const next = new Set(prev)
            next.has(matricule) ? next.delete(matricule) : next.add(matricule)
            return next
        })
        onSelectMat(matricule)
    }
    const clearEmployeeSelection = () => { setSelectedEmployees(new Set()); onSelectMat(null) }

    // ── Sélection cellules ────────────────────────────────────
    const allCellKeys = pagedEmployees.flatMap(emp => dates.map(date => `${emp.matricule}__${date}`))

    const handleCellClick = (matricule: string, date: string, e: React.MouseEvent) => {
        e.stopPropagation()

        // 🛡️ Vérification de la permission
        if (!hasPermissionUpdatePlanning) {
            toast.error("Vous n'avez pas la permission de modifier le planning.", { position: 'bottom-center' })
            return
        }

        hideTooltip()
        const key = `${matricule}__${date}`

        if (e.shiftKey && lastClickedCell) {
            const a = allCellKeys.indexOf(lastClickedCell)
            const b = allCellKeys.indexOf(key)
            const [from, to] = a < b ? [a, b] : [b, a]
            setSelectedCells(prev => {
                const next = new Set(prev)
                allCellKeys.slice(from, to + 1).forEach(k => next.add(k))
                return next
            })
        } else if (e.ctrlKey || e.metaKey) {
            setSelectedCells(prev => {
                const next = new Set(prev)
                next.has(key) ? next.delete(key) : next.add(key)
                return next
            })
            setLastClickedCell(key)
        } else {
            const emp = employees.find(em => em.matricule === matricule)
            const code = getDisplayCode(matricule, date)
            const statut = getDisplayStatut(matricule, date)
            setAnnotModalCells([{ matricule, employeeId: emp?.id ?? '', date }])
            setAnnotSingleCode(ANNOT_TYPES.some(a => a.code === code) ? code : undefined)
            setAnnotSingleStatut(['P', 'A', 'R'].includes(code) ? code : statut || undefined)
            setAnnotModalOpen(true)
            setLastClickedCell(key)
        }
    }

    const clearCellSelection = () => { setSelectedCells(new Set()); setLastClickedCell(null) }

    const openAnnotModalForSelected = () => {
        const cells = Array.from(selectedCells).map(key => {
            const [mat, date] = key.split('__')
            const emp = employees.find(e => e.matricule === mat)
            return { matricule: mat, employeeId: emp?.id ?? '', date }
        })
        setAnnotModalCells(cells)
        setAnnotSingleCode(undefined)
        setAnnotSingleStatut(undefined)
        setAnnotModalOpen(true)
    }

    const handleAfterSave = useCallback(() => { }, [])

    // ── En-têtes ──────────────────────────────────────────────
    const renderMonthHeaders = () => {
        const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']
        const groups: { name: string; count: number }[] = []
        let cur = '', count = 0
        dates.forEach(date => {
            const [y, m] = date.split('-'), key = `${y}-${m}`
            if (key !== cur) {
                if (cur) { const [yr, mo] = cur.split('-'); groups.push({ name: `${months[+mo - 1]} ${yr}`, count }) }
                cur = key; count = 1
            } else count++
        })
        if (cur) { const [yr, mo] = cur.split('-'); groups.push({ name: `${months[+mo - 1]} ${yr}`, count }) }

        return (
            <TableRow className="border-b border-slate-200">
                <TableHead className="sticky left-0 bg-white z-20 w-[40px]" />
                <TableHead className="sticky left-[40px] bg-white z-20 w-[200px]" />
                <TableHead className="sticky left-[240px] bg-white z-20 w-[70px]" />
                <TableHead className="sticky left-[310px] bg-white z-20 w-[140px]" />
                {groups.map((g, i) => (
                    <TableHead key={i} colSpan={g.count} className="text-center bg-slate-50 border-x border-slate-100 py-1.5 px-0">
                        <span className="text-[11px] font-semibold text-slate-600">{g.name}</span>
                    </TableHead>
                ))}
            </TableRow>
        )
    }

    const renderDayHeaders = () => {
        const days = ['Di', 'Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa']
        return (
            <TableRow className="border-b-2 border-slate-200">
                <TableHead className="sticky left-0 bg-white z-20 w-[40px] text-center text-[10px] font-semibold text-slate-400">#</TableHead>
                <TableHead className="sticky left-[40px] bg-white z-20 w-[200px] text-xs font-semibold text-slate-500 px-3">Employé</TableHead>
                <TableHead className="sticky left-[240px] bg-white z-20 w-[70px] text-xs font-semibold text-slate-500 text-center">Zone</TableHead>
                <TableHead className="sticky left-[310px] bg-white z-20 w-[140px] text-center">
                    <div className="flex items-center justify-center gap-1 flex-wrap py-0.5">
                        {[
                            { key: 'P', label: 'Présences', color: 'bg-emerald-50 text-emerald-700' },
                            { key: 'A', label: 'Absences nettes', color: 'bg-rose-50 text-rose-600' },
                            { key: 'J', label: 'Justifiées', color: 'bg-blue-50 text-blue-600' },
                            { key: 'R', label: 'Repos', color: 'bg-slate-100 text-slate-500' },
                            { key: 'JF', label: 'Jours Fériés', color: 'bg-cyan-50 text-cyan-700' },
                        ].map(({ key, label, color }) => (
                            <span key={key} title={label} className={`inline-flex px-1 py-0.5 rounded text-[9px] font-bold ${color}`}>{key}</span>
                        ))}
                    </div>
                </TableHead>
                {dates.map(date => {
                    const [y, m, d] = date.split('-')
                    const dow = new Date(+y, +m - 1, +d).getDay()
                    const isWE = dow === 5 || dow === 6
                    return (
                        <TableHead key={date} className={cn('text-center p-0.5 min-w-[36px]', isWE && 'bg-slate-50')}>
                            <div className={cn('text-[10px] font-semibold', isWE ? 'text-slate-400' : 'text-slate-600')}>{d}</div>
                            <div className={cn('text-[9px]', isWE ? 'text-slate-300' : 'text-slate-400')}>{days[dow]}</div>
                        </TableHead>
                    )
                })}
            </TableRow>
        )
    }

    if (employees.length === 0) {
        return (
            <div className="text-center py-16 border border-dashed border-slate-200 rounded-2xl bg-white">
                <Calendar className="h-10 w-10 mx-auto text-slate-300 mb-3" />
                <h3 className="text-sm font-semibold text-slate-600">Aucune donnée</h3>
                <p className="text-xs text-slate-400 mt-1">Importez un fichier Excel pour commencer</p>
            </div>
        )
    }

    const nbCellsSelected = selectedCells.size

    return (
        <>
            <HistoryTooltip state={tooltip} />
            <EmployeeInfoTooltip visible={employeeTooltip.visible} employee={employeeTooltip.employee} posX={employeeTooltip.posX} posY={employeeTooltip.posY} />

            <div className="border border-slate-200 rounded-2xl overflow-auto relative bg-white shadow-sm" onMouseLeave={hideTooltip}>
                <Table className="min-w-max">
                    <TableHeader className="sticky top-0 z-10">
                        {renderMonthHeaders()}
                        {renderDayHeaders()}
                    </TableHeader>

                    <TableBody>
                        {pagedEmployees.map((emp, empIdx) => {
                            const isEmpSel = selectedEmployees.has(emp.matricule)
                            const stats = getStats(emp.matricule)
                            const rowNumber = page * pageSize + empIdx + 1

                            return (
                                <TableRow key={emp.id}
                                    className={cn(
                                        'border-b border-slate-50 transition-colors',
                                        isEmpSel ? 'bg-slate-900/[0.03]' : 'hover:bg-slate-50/50',
                                        empIdx % 2 !== 0 && 'bg-slate-50/30'
                                    )}>

                                    <TableCell className={cn('sticky left-0 z-10 p-0 w-[40px] text-center', isEmpSel ? 'bg-slate-900/[0.04]' : 'bg-white')} onMouseEnter={(e) => showEmployeeTooltip(e, emp)} onMouseLeave={hideTooltip}>
                                        <div className="flex items-center justify-center h-full min-h-[36px]">
                                            <span className="text-[11px] font-mono text-slate-400">{rowNumber}</span>
                                        </div>
                                    </TableCell>

                                    <TableCell className={cn('sticky left-[40px] z-10 p-0 w-[200px]', isEmpSel ? 'bg-slate-900/[0.04]' : 'bg-white')} onMouseEnter={(e) => showEmployeeTooltip(e, emp)} onMouseLeave={hideTooltip}>
                                        <div className="flex items-stretch h-full min-h-[36px]">
                                            <button onClick={e => toggleEmployee(emp.matricule, e)} className={cn('w-7 flex items-center justify-center shrink-0 transition-colors border-r border-slate-100', isEmpSel ? 'bg-slate-900' : 'hover:bg-slate-100')}>
                                                <div className={cn('w-3 h-3 rounded border transition-all', isEmpSel ? 'bg-white border-white' : 'border-slate-300')} />
                                            </button>
                                            <div className="flex-1 px-2 py-1.5 min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="font-mono text-xs font-semibold text-slate-700">{emp.matricule}</span>
                                                    {emp.cycles?.est_manuel && <span className="text-[9px] px-1 py-0.5 bg-amber-50 text-amber-600 rounded border border-amber-200 font-medium">M</span>}
                                                </div>
                                                <div className="text-[11px] text-slate-500 truncate max-w-[130px]">{emp.prenom} {emp.nom}</div>
                                                <div className="text-[11px] text-slate-500 truncate max-w-[130px]">{emp.poste}</div>
                                                {(!hasPermissionViewCycle) ? null : <div className="text-[10px] text-slate-400 font-mono">{getCycleLabel(emp.cycles)}</div>}
                                            </div>
                                            <button onClick={e => { e.stopPropagation(); router.push(`/workspaces/${workspaceId}/employees/${emp.id}`) }} className="w-7 flex items-center justify-center shrink-0 text-slate-300 hover:text-slate-600 hover:bg-slate-100 transition-colors border-l border-slate-100" title="Voir le détail">
                                                <ExternalLink className="w-3 h-3" />
                                            </button>
                                        </div>
                                    </TableCell>

                                    <TableCell className={cn('sticky left-[240px] z-10 text-center p-1 w-[70px]', isEmpSel ? 'bg-slate-900/[0.04]' : 'bg-white')} onMouseEnter={(e) => showEmployeeTooltip(e, emp)} onMouseLeave={hideTooltip}>
                                        <ZoneColumn zone={emp.zone} />
                                    </TableCell>

                                    <TableCell className={cn('sticky left-[310px] z-10 p-1 w-[140px]', isEmpSel ? 'bg-slate-900/[0.04]' : 'bg-white')}>
                                        <StatsCell stats={stats} />
                                    </TableCell>

                                    {dates.map(date => {
                                        const code = getDisplayCode(emp.matricule, date)
                                        const cellKey = `${emp.matricule}__${date}`
                                        const isCellSel = selectedCells.has(cellKey)
                                        const colors = code ? CELL_COLORS[code] : null
                                        const [y, m, d] = date.split('-')
                                        const isWE = [5, 6].includes(new Date(+y, +m - 1, +d).getDay())
                                        const { history, statut_original } = getCellMeta(emp.matricule, date)
                                        const hasHistory = history.length > 0
                                        const wasModified = statut_original && statut_original !== code

                                        return (
                                            <TableCell key={cellKey} onClick={e => handleCellClick(emp.matricule, date, e)} onMouseEnter={e => showTooltip(e, history, code, statut_original, date)} onMouseLeave={hideTooltip}
                                                className={cn('text-center p-0 transition-all min-w-[36px] h-8 select-none relative', isWE && !colors && 'bg-slate-50/60', isCellSel && 'ring-2 ring-inset ring-slate-700 z-10', hasPermissionUpdatePlanning ? 'cursor-pointer' : 'cursor-default')}
                                                style={colors ? { backgroundColor: colors.bg } : {}}>
                                                <span className="text-[11px] font-bold leading-none" style={colors ? { color: colors.text } : { color: '#cbd5e1' }}>
                                                    {code || (isWE ? '·' : '')}
                                                </span>
                                                {(hasHistory || wasModified) && <span className="absolute top-0.5 right-0.5 w-1 h-1 rounded-full bg-orange-400 opacity-80" />}
                                            </TableCell>
                                        )
                                    })}
                                </TableRow>
                            )
                        })}
                    </TableBody>
                </Table>
            </div>

            {employees.length > 0 && (
                <div className="flex items-center justify-between px-1 mt-4">
                    <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-400">{page * pageSize + 1}–{Math.min((page + 1) * pageSize, employees.length)} sur {employees.length} employés</span>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500">Afficher :</span>
                            <select value={pageSize} onChange={(e) => handlePageSizeChange(Number(e.target.value))} className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400">
                                {PAGE_SIZE_OPTIONS.map(size => (<option key={size} value={size}>{size}</option>))}
                            </select>
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        <button onClick={goToFirstPage} disabled={page === 0} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"><ChevronLeft className="w-3.5 h-3.5" /><ChevronLeft className="w-3.5 h-3.5 -ml-1" />Première</button>
                        <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"><ChevronLeft className="w-3.5 h-3.5" />Précédent</button>
                        {(() => {
                            const maxVisible = 5; const halfVisible = Math.floor(maxVisible / 2)
                            let start = Math.max(0, page - halfVisible); let end = Math.min(totalPages - 1, start + maxVisible - 1)
                            if (end - start + 1 < maxVisible) start = Math.max(0, end - maxVisible + 1)
                            const pages = []
                            if (start > 0) { pages.push(0); if (start > 1) pages.push('...') }
                            for (let i = start; i <= end; i++) pages.push(i)
                            if (end < totalPages - 1) { if (end < totalPages - 2) pages.push('...'); pages.push(totalPages - 1) }

                            return pages.map((item, idx) => {
                                if (item === '...') return <span key={`ellipsis-${idx}`} className="px-1 text-slate-400 text-xs">...</span>
                                const pageNum = item as number
                                return <button key={pageNum} onClick={() => setPage(pageNum)} className={cn('w-7 h-7 rounded-lg text-xs font-medium transition-colors', pageNum === page ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100')}>{pageNum + 1}</button>
                            })
                        })()}
                        <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">Suivant<ChevronRight className="w-3.5 h-3.5" /></button>
                        <button onClick={goToLastPage} disabled={page === totalPages - 1} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">Dernière<ChevronRight className="w-3.5 h-3.5" /><ChevronRight className="w-3.5 h-3.5 -ml-1" /></button>
                    </div>
                </div>
            )}

            {nbCellsSelected > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-slate-900 text-white px-4 py-2.5 rounded-2xl shadow-2xl animate-in slide-in-from-bottom-3 duration-200">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-white/15 flex items-center justify-center"><span className="text-[11px] font-bold">{nbCellsSelected}</span></div>
                        <span className="text-sm text-slate-300">{nbCellsSelected === 1 ? 'cellule sélectionnée' : 'cellules sélectionnées'}</span>
                    </div>
                    <div className="w-px h-5 bg-white/20" />
                    <button onClick={openAnnotModalForSelected} className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-slate-900 rounded-xl text-xs font-semibold hover:bg-slate-100 transition-colors"><Pencil className="w-3.5 h-3.5" />Modifier</button>
                    <button onClick={clearCellSelection} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-slate-400 hover:text-white"><X className="w-3.5 h-3.5" /></button>
                </div>
            )}

            {selectedEmployees.size > 0 && nbCellsSelected === 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-indigo-950 text-white px-4 py-2.5 rounded-2xl shadow-2xl animate-in slide-in-from-bottom-3 duration-200">
                    <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-indigo-300" />
                        <span className="text-sm text-indigo-200">{selectedEmployees.size} employé{selectedEmployees.size > 1 ? 's' : ''} sélectionné{selectedEmployees.size > 1 ? 's' : ''}</span>
                    </div>

                    {hasPermissionUpdateCycle && (
                        <>
                            <div className="w-px h-5 bg-white/20" />
                            <button onClick={() => setCycleModalOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-indigo-900 rounded-xl text-xs font-semibold hover:bg-indigo-50 transition-colors"><RefreshCw className="w-3.5 h-3.5" />Modifier le cycle</button>
                        </>
                    )}

                    <button onClick={clearEmployeeSelection} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-indigo-400 hover:text-white"><X className="w-3.5 h-3.5" /></button>
                </div>
            )}

            <CycleModal open={cycleModalOpen} onOpenChange={setCycleModalOpen} employeeIds={Array.from(selectedEmployees).map(mat => employees.find(e => e.matricule === mat)?.id).filter(Boolean) as string[]} employeeMatricule={selectedEmployees.size > 1 ? `${selectedEmployees.size} employés` : firstSelectedEmp?.matricule ?? ''} currentCycle={selectedEmployees.size === 1 ? firstSelectedEmp?.cycles : undefined} onSuccess={() => { setCycleModalOpen(false); clearEmployeeSelection(); onUpdate() }} />

            <AnnotModal
                open={annotModalOpen}
                onOpenChange={setAnnotModalOpen}
                cells={annotModalCells}
                currentCode={annotSingleCode}
                currentStatut={annotSingleStatut}
                onOptimisticUpdate={handleOptimisticUpdate}
                onSuccess={clearCellSelection}
                onAfterSave={handleAfterSave}
                permissions={{
                    mission: hasPermissionAddAnnotationMission,
                    justified: hasPermissionAddAnnotationJustified,
                    maladie: hasPermissionAddAnnotationMaladie,
                    recuperation: hasPermissionAddAnnotationRecuperation,
                    conge: hasPermissionAddAnnotationConge,
                    congeExceptionnel: hasPermissionAddAnnotationCongeExceptionnel,
                    updatePlanning: hasPermissionUpdatePlanning
                }}
            />
        </>
    )
}

// ─── recalculerStats ─────────────────────────────────────────

function recalculerStats(empData: any): EmpStats {
    let presents = 0, absences = 0, absences_annotees = 0, repos = 0, jours_feries = 0

    empData.plannings?.forEach((p: any) => {
        const dateStr = p.date?.split?.('T')?.[0] ?? p.date
        const statut = p.statut
        if (statut === 'P') { presents++ }
        else if (statut === 'R') { repos++ }
        else if (statut === 'JF') { jours_feries++ }
        else if (ANNOT_SET.has(statut)) { absences++; absences_annotees++ }
        else { absences++ }
    })

    return {
        presents, absences,
        absences_nettes: absences - absences_annotees,
        absences_annotees, repos, jours_feries,
        presences_supplementaires: 0,
        total: empData.plannings?.length ?? 0,
    }
}
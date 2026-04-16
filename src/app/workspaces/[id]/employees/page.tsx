'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { AppShell } from '@/components/layout/AppShell'
import { CycleModal } from '@/components/modals/CycleModal2'
import { EmployeeFormModal } from '@/components/modals/EmployeeFormModal'
import { EmployeeStats } from '@/components/employees/EmployeeStats'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
    Select, SelectContent, SelectItem,
    SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
    ArrowLeft, Users, RefreshCw, Search, Filter, X,
    ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
    Download, CheckSquare, Square, Settings2,
    UserPlus, Pencil, Trash2, AlertTriangle,
} from 'lucide-react'
import { employeesApi, cyclesApi } from '@/lib/api'
import { toast } from 'react-hot-toast'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import {
    Dialog, DialogContent, DialogTitle,
} from '@/components/ui/dialog'
import { usePermissions } from '@/hooks/use-permissions'
import { useSession } from '@/hooks/use-session'

// ─── Helpers filtrage ─────────────────────────────────────────

function parseTokens(t: string) {
    return t.split(',').map(x => x.trim().toLowerCase()).filter(Boolean)
}
function matchesAny(v: string | null | undefined, tokens: string[]) {
    return !tokens.length || tokens.some(t => (v ?? '').toLowerCase().includes(t))
}
function matchesExact(v: string | null | undefined, tokens: string[]) {
    return !tokens.length || tokens.some(t => (v ?? '').toLowerCase() === t)
}

// ─── Config ───────────────────────────────────────────────────

const PAGE_SIZE = 30

const PRESENCE_OPTIONS = [
    { value: 'all', label: 'Tous les employés' },
    { value: '1m', label: '✅ Au moins 1 présence — 1 mois' },
    { value: '2m', label: '✅ Au moins 1 présence — 2 mois' },
    { value: '3m', label: '✅ Au moins 1 présence — 3 mois' },
    { value: 'absent_1m', label: '❌ Absent ce mois-ci' },
    { value: 'absent_2m', label: '❌ Absent ces 2 derniers mois' },
    { value: 'absent_3m', label: '❌ Absent ces 3 derniers mois' },
    { value: 'never', label: '⛔ Jamais de présence' },
]

const CYCLE_TYPES = [
    { value: 'all', label: 'Tous les cycles' },
    { value: 'weekly', label: 'Hebdomadaire' },
    { value: 'rotation', label: 'Rotation' },
    { value: 'night', label: 'Nuit' },
    { value: 'unknown', label: 'Inconnu' },
]

// ─── Confirm delete dialog ────────────────────────────────────

function DeleteConfirmDialog({
    open, onOpenChange, count, onConfirm, loading,
}: {
    open: boolean; onOpenChange: (v: boolean) => void
    count: number; onConfirm: () => void; loading: boolean
}) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[360px] p-0 gap-0">
                <div className="px-6 pt-6 pb-4 border-b border-slate-100 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center shrink-0 mt-0.5">
                        <AlertTriangle className="w-4 h-4 text-rose-500" />
                    </div>
                    <div>
                        <DialogTitle className="text-[15px] font-semibold text-slate-900">
                            Confirmer la suppression
                        </DialogTitle>
                        <p className="text-[12px] text-slate-500 mt-1">
                            {count === 1
                                ? 'Cet employé sera définitivement supprimé avec tous ses pointages et annotations.'
                                : `Ces ${count} employés seront définitivement supprimés avec tous leurs pointages et annotations.`
                            }
                        </p>
                    </div>
                </div>
                <div className="px-6 py-4 flex items-center justify-end gap-2">
                    <button onClick={() => onOpenChange(false)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors">
                        Annuler
                    </button>
                    <button onClick={onConfirm} disabled={loading}
                        className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-rose-500 hover:bg-rose-600 transition-colors disabled:opacity-50">
                        {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        {loading ? 'Suppression…' : `Supprimer${count > 1 ? ` (${count})` : ''}`}
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    )
}

// ─────────────────────────────────────────────────────────────
// EmployeesPage
// ─────────────────────────────────────────────────────────────

export default function EmployeesPage() {
    const params = useParams()
    const router = useRouter()
    const workspaceId = params.id as string

    // ── Data ──────────────────────────────────────────────────
    const [employees, setEmployees] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [exporting, setExporting] = useState(false)
    const [deleting, setDeleting] = useState(false)

    // ── Modals ────────────────────────────────────────────────
    const [formModalOpen, setFormModalOpen] = useState(false)
    const [editingEmployee, setEditingEmployee] = useState<any>(null)
    const [cycleModalOpen, setCycleModalOpen] = useState(false)
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [idsToDelete, setIdsToDelete] = useState<string[]>([])

    // ── Sélection ─────────────────────────────────────────────
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

    // ── Filtres backend ───────────────────────────────────────
    const [presenceFilter, setPresenceFilter] = useState('all')

    // ── Filtres frontend ──────────────────────────────────────
    const [searchText, setSearchText] = useState('')
    const [posteSearch, setPosteSearch] = useState('')
    const [zoneSearch, setZoneSearch] = useState('')
    const [zoneExact, setZoneExact] = useState(false)
    const [cycleType, setCycleType] = useState('all')

    // ── Pagination ────────────────────────────────────────────
    const [page, setPage] = useState(0)

    // ── UI ────────────────────────────────────────────────────
    const [filtersExpanded, setFiltersExpanded] = useState(true)

    // permissions
    const { session } = useSession();

    const hasPermissionDeleteEmployees = useMemo(() => (
        session?.user?.is_admin ||
        session?.user?.permissions.some((p: string) => p === "delete_employe")
    ), [session]);

    const hasPermissionUpdateEmployees = useMemo(() => (
        session?.user?.is_admin ||
        session?.user?.permissions.some((p: string) => p === "update_employe")
    ), [session]);

    const hasPermissionCreateEmployees = useMemo(() => (
        session?.user?.is_admin ||
        session?.user?.permissions.some((p: string) => p === "create_employe")
    ), [session]);

    const hasPermissionExportEmployees = useMemo(() => (
        session?.user?.is_admin ||
        session?.user?.permissions.some((p: string) => p === "export_employe")
    ), [session]);

    const hasPermissionDetectCycles = useMemo(() => (
        session?.user?.is_admin ||
        session?.user?.permissions.some((p: string) => p === "detect_cycles")
    ), [session]);
    // ─────────────────────────────────────────────────────────
    // Load
    // ─────────────────────────────────────────────────────────

    const loadEmployees = useCallback(async () => {
        setLoading(true)
        try {
            const p: any = { workspace_id: workspaceId }
            if (presenceFilter !== 'all') p.presence = presenceFilter
            const { data } = await employeesApi.getAll(p)
            setEmployees(data.data || [])
            setSelectedIds(new Set())
        } catch { toast.error('Erreur lors du chargement') }
        finally { setLoading(false) }
    }, [workspaceId, presenceFilter])

    useEffect(() => { loadEmployees() }, [loadEmployees])

    // ─────────────────────────────────────────────────────────
    // Filtrage frontend
    // ─────────────────────────────────────────────────────────

    const filteredEmployees = useMemo(() => {
        const sT = parseTokens(searchText)
        const pT = parseTokens(posteSearch)
        const zT = parseTokens(zoneSearch)
        return employees.filter(emp => {
            if (sT.length > 0 && !matchesAny(emp.matricule, sT) && !matchesAny(emp.nom, sT) && !matchesAny(emp.prenom, sT)) return false
            if (pT.length > 0 && !matchesAny(emp.poste, pT)) return false
            if (zT.length > 0 && !(zoneExact ? matchesExact(emp.zone, zT) : matchesAny(emp.zone, zT))) return false
            if (cycleType !== 'all' && (emp.cycles?.type ?? 'unknown') !== cycleType) return false
            return true
        })
    }, [employees, searchText, posteSearch, zoneSearch, zoneExact, cycleType])

    useMemo(() => { setPage(0); setSelectedIds(new Set()) }, [filteredEmployees])

    // ─────────────────────────────────────────────────────────
    // Pagination
    // ─────────────────────────────────────────────────────────

    const totalPages = Math.ceil(filteredEmployees.length / PAGE_SIZE)
    const pagedEmployees = useMemo(
        () => filteredEmployees.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
        [filteredEmployees, page]
    )

    // ─────────────────────────────────────────────────────────
    // Sélection
    // ─────────────────────────────────────────────────────────

    const toggleSelect = (id: string) =>
        setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

    const allFilteredSelected = filteredEmployees.length > 0 && filteredEmployees.every(e => selectedIds.has(e.id))
    const someSelected = selectedIds.size > 0 && !allFilteredSelected

    const toggleSelectAll = () => {
        if (allFilteredSelected) {
            setSelectedIds(prev => { const n = new Set(prev); filteredEmployees.forEach(e => n.delete(e.id)); return n })
        } else {
            setSelectedIds(prev => { const n = new Set(prev); filteredEmployees.forEach(e => n.add(e.id)); return n })
        }
    }

    const selectedEmployees = employees.filter(e => selectedIds.has(e.id))
    const selectedEmployeeIds = selectedEmployees.map(e => e.id)
    const selectedEmployeeMatricules = selectedEmployees.map(e => e.matricule)
    const firstSelectedCycle = selectedEmployees.length === 1 ? selectedEmployees[0].cycles : undefined

    // ─────────────────────────────────────────────────────────
    // Actions
    // ─────────────────────────────────────────────────────────

    const openCreateModal = () => { setEditingEmployee(null); setFormModalOpen(true) }

    const openEditModal = (emp: any) => { setEditingEmployee(emp); setFormModalOpen(true) }

    const openDeleteDialog = (ids: string[]) => { setIdsToDelete(ids); setDeleteDialogOpen(true) }

    const handleDelete = async () => {
        if (idsToDelete.length === 0) return
        setDeleting(true)
        try {
            if (idsToDelete.length === 1) {
                await employeesApi.deleteOne(idsToDelete[0])
            } else {
                await employeesApi.deleteMany(idsToDelete)
            }
            toast.success(`${idsToDelete.length} employé(s) supprimé(s)`)
            setDeleteDialogOpen(false)
            setSelectedIds(new Set())
            loadEmployees()
        } catch { toast.error('Erreur lors de la suppression') }
        finally { setDeleting(false) }
    }

    const handleExport = async () => {
        if (selectedIds.size === 0) { toast.error('Sélectionnez au moins un employé'); return }
        setExporting(true)
        try {
            const ids = Array.from(selectedIds)
            const response = await fetch('/api/employees/export', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids, workspaceId }),
            })
            if (!response.ok) { toast.error('Erreur export'); return }
            const blob = await response.blob()
            const a = document.createElement('a')
            a.href = URL.createObjectURL(blob)
            a.download = `employes_${new Date().toISOString().split('T')[0]}.xlsx`
            document.body.appendChild(a); a.click(); document.body.removeChild(a)
            URL.revokeObjectURL(a.href)
            toast.success(`${ids.length} employé(s) exporté(s)`)
        } catch { toast.error('Erreur export') }
        finally { setExporting(false) }
    }

    const handleDetectCycles = async () => {
        try { await cyclesApi.detect(workspaceId); toast.success('Détection lancée'); loadEmployees() }
        catch { toast.error('Erreur') }
    }

    const clearFilters = () => {
        setSearchText(''); setPosteSearch(''); setZoneSearch('')
        setZoneExact(false); setCycleType('all'); setPresenceFilter('all')
    }

    const hasActiveFilters = !!(searchText || posteSearch || zoneSearch || cycleType !== 'all' || presenceFilter !== 'all')
    const activeFilterCount = [searchText, posteSearch, zoneSearch, cycleType !== 'all' ? '1' : '', presenceFilter !== 'all' ? '1' : ''].filter(Boolean).length

    // ─────────────────────────────────────────────────────────
    // Render
    // ─────────────────────────────────────────────────────────

    return (
        <AppShell workspaceName="Employés" onDashboardClick={() => router.push(`/workspaces/${workspaceId}`)}>
            <div className="space-y-6">

                {/* ── Header page ── */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button onClick={() => router.back()}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:bg-slate-100 transition-colors">
                            <ArrowLeft className="w-3.5 h-3.5" />Retour
                        </button>
                        <div>
                            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                <Users className="w-5 h-5" />Employés
                            </h1>
                            <p className="text-[12px] text-slate-400">
                                <span className="font-semibold text-slate-700">{filteredEmployees.length}</span>{' '}
                                affiché(s){employees.length !== filteredEmployees.length && ` sur ${employees.length}`}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {hasPermissionDetectCycles && (
                            <button onClick={handleDetectCycles}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 border border-slate-200 hover:bg-slate-50 transition-colors">
                                <RefreshCw className="w-3.5 h-3.5" />Détecter cycles
                            </button>
                        )}
                        {hasPermissionCreateEmployees && (
                            <button onClick={openCreateModal}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-colors"
                                style={{ background: 'linear-gradient(135deg, #008F4A, #00a654)', boxShadow: '0 2px 8px rgba(0,143,74,0.25)' }}>
                                <UserPlus className="w-3.5 h-3.5" />Nouvel employé
                            </button>
                        )}
                    </div>
                </div>

                <EmployeeStats employees={filteredEmployees} />

                {/* ── Filtres ── */}
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                    <button
                        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-slate-50 transition-colors"
                        onClick={() => setFiltersExpanded(v => !v)}
                    >
                        <div className="flex items-center gap-2">
                            <Filter className="h-3.5 w-3.5 text-slate-400" />
                            <span className="text-slate-700">Filtres</span>
                            {activeFilterCount > 0 && (
                                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold text-white"
                                    style={{ background: '#008F4A' }}>
                                    {activeFilterCount}
                                </span>
                            )}
                        </div>
                        {filtersExpanded ? <ChevronUp className="h-3.5 w-3.5 text-slate-400" /> : <ChevronDown className="h-3.5 w-3.5 text-slate-400" />}
                    </button>

                    {filtersExpanded && (
                        <div className="px-4 pb-4 pt-1 space-y-4 border-t border-slate-100">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">

                                {/* Matricule / Nom / Prénom */}
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">
                                        Matricule / Nom / Prénom
                                    </Label>
                                    <div className="relative">
                                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                                        <Input placeholder="mat1, dupont…" value={searchText}
                                            onChange={e => setSearchText(e.target.value)} className="pl-8 h-8 text-sm" />
                                    </div>
                                    <p className="text-[10px] text-slate-400">Virgule = OR</p>
                                </div>

                                {/* Poste */}
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">Poste</Label>
                                    <div className="relative">
                                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                                        <Input placeholder="tech, agent…" value={posteSearch}
                                            onChange={e => setPosteSearch(e.target.value)} className="pl-8 h-8 text-sm" />
                                    </div>
                                    <p className="text-[10px] text-slate-400">Virgule = OR</p>
                                </div>

                                {/* Zone */}
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">Zone</Label>
                                    <div className="relative">
                                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                                        <Input placeholder="zone1, zone2…" value={zoneSearch}
                                            onChange={e => setZoneSearch(e.target.value)} className="pl-8 h-8 text-sm" />
                                    </div>
                                    <label className="flex items-center gap-1.5 cursor-pointer">
                                        <Checkbox id="zone-exact" checked={zoneExact}
                                            onCheckedChange={v => setZoneExact(!!v)} className="h-3 w-3" />
                                        <span className="text-[10px] text-slate-400 select-none">Exacte</span>
                                    </label>
                                </div>

                                {/* Type cycle */}
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">Type de cycle</Label>
                                    <Select value={cycleType} onValueChange={setCycleType}>
                                        <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {CYCLE_TYPES.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Présence */}
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">Présence</Label>
                                    <Select value={presenceFilter} onValueChange={setPresenceFilter}>
                                        <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {PRESENCE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-[10px] text-slate-400">Requête serveur</p>
                                </div>
                            </div>

                            <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                                <p className="text-xs text-slate-400">
                                    <span className="font-semibold text-slate-700">{filteredEmployees.length}</span> sur <span className="font-semibold text-slate-700">{employees.length}</span>
                                </p>
                                {hasActiveFilters && (
                                    <button onClick={clearFilters}
                                        className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 transition-colors">
                                        <X className="w-3 h-3" />Effacer
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Tout sélectionner ── */}
                {!loading && filteredEmployees.length > 0 && (
                    <div className="flex items-center justify-between px-1">
                        <button onClick={toggleSelectAll}
                            className="flex items-center gap-2 text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors">
                            {allFilteredSelected ? <CheckSquare className="w-4 h-4 text-slate-900" />
                                : someSelected ? (
                                    <div className="w-4 h-4 rounded border-2 border-slate-900 bg-slate-200 flex items-center justify-center">
                                        <div className="w-1.5 h-0.5 bg-slate-700 rounded" />
                                    </div>
                                ) : <Square className="w-4 h-4 text-slate-400" />
                            }
                            {allFilteredSelected ? `Tout désélectionner (${filteredEmployees.length})` : `Tout sélectionner (${filteredEmployees.length})`}
                        </button>
                        {selectedIds.size > 0 && (
                            <span className="text-xs text-slate-400">{selectedIds.size} sélectionné{selectedIds.size > 1 ? 's' : ''}</span>
                        )}
                    </div>
                )}

                {/* ── Table ── */}
                {loading ? (
                    <div className="space-y-2">
                        {Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}
                    </div>
                ) : (
                    <>
                        <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="w-10 px-3 py-2.5">
                                            <button onClick={toggleSelectAll} className="flex items-center justify-center mx-auto">
                                                {allFilteredSelected ? <CheckSquare className="w-4 h-4 text-slate-800" />
                                                    : someSelected ? (
                                                        <div className="w-4 h-4 rounded border-2 border-slate-500 bg-slate-200 flex items-center justify-center">
                                                            <div className="w-1.5 h-0.5 bg-slate-600 rounded" />
                                                        </div>
                                                    ) : <Square className="w-4 h-4 text-slate-300" />
                                                }
                                            </button>
                                        </th>
                                        {['Matricule', 'Nom complet', 'Poste', 'Zone', 'Cycle', 'Pointages', 'Actions'].map(h => (
                                            <th key={h} className={cn(
                                                'px-3 py-2.5 text-[10px] font-semibold text-slate-400 uppercase tracking-widest',
                                                h === 'Actions' || h === 'Pointages' ? 'text-center' : 'text-left'
                                            )}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {pagedEmployees.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="text-center py-16 text-slate-400 text-sm">
                                                Aucun employé correspondant
                                            </td>
                                        </tr>
                                    ) : pagedEmployees.map(emp => {
                                        const isSel = selectedIds.has(emp.id)
                                        return (
                                            <tr key={emp.id} className={cn(
                                                'transition-colors group',
                                                isSel ? 'bg-slate-900/[0.025]' : 'hover:bg-slate-50/70'
                                            )}>
                                                {/* Checkbox */}
                                                <td className="px-3 py-3">
                                                    <button onClick={() => toggleSelect(emp.id)} className="flex items-center justify-center mx-auto">
                                                        {isSel
                                                            ? <CheckSquare className="w-4 h-4 text-slate-900" />
                                                            : <Square className="w-4 h-4 text-slate-300 group-hover:text-slate-400" />}
                                                    </button>
                                                </td>
                                                {/* Matricule */}
                                                <td className="px-3 py-3">
                                                    <span className="font-mono text-xs font-bold text-slate-700">{emp.matricule}</span>
                                                </td>
                                                {/* Nom complet */}
                                                <td className="px-3 py-3">
                                                    <span className="text-sm text-slate-700">
                                                        {[emp.prenom, emp.nom].filter(Boolean).join(' ') || <span className="text-slate-300 italic">—</span>}
                                                    </span>
                                                </td>
                                                {/* Poste */}
                                                <td className="px-3 py-3 text-sm text-slate-500">{emp.poste ?? '—'}</td>
                                                {/* Zone */}
                                                <td className="px-3 py-3 text-sm text-slate-500">{emp.zone ?? '—'}</td>
                                                {/* Cycle */}
                                                <td className="px-3 py-3">
                                                    {emp.cycles && emp.cycles.type !== 'unknown' ? (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600">
                                                            {emp.cycles.est_manuel && (
                                                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title="Manuel" />
                                                            )}
                                                            {emp.cycles.type === 'weekly' && 'Hebdo'}
                                                            {emp.cycles.type === 'rotation' && `${emp.cycles.travail}T/${emp.cycles.repos}R`}
                                                            {emp.cycles.type === 'night' && `🌙 ${emp.cycles.travail}/${emp.cycles.repos}`}
                                                        </span>
                                                    ) : (
                                                        <span className="text-[11px] text-slate-300 italic">Inconnu</span>
                                                    )}
                                                </td>
                                                {/* Pointages */}
                                                <td className="px-3 py-3 text-center">
                                                    <span className="text-xs font-medium text-slate-500">{emp._count?.pointages ?? 0}</span>
                                                </td>
                                                {/* Actions */}
                                                <td className="px-3 py-3">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <button
                                                            onClick={() => router.push(`/workspaces/${workspaceId}/employees/${emp.id}`)}
                                                            className="px-2 py-1 rounded-lg text-[11px] text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors font-medium">
                                                            Voir
                                                        </button>
                                                        {hasPermissionUpdateEmployees && (
                                                            <button
                                                                onClick={() => openEditModal(emp)}
                                                                className="p-1.5 rounded-lg text-slate-300 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                                                                title="Modifier">
                                                                <Pencil className="w-3 h-3" />
                                                            </button>
                                                        )}
                                                        {hasPermissionDeleteEmployees && (
                                                            <button
                                                                onClick={() => openDeleteDialog([emp.id])}
                                                                className="p-1.5 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors"
                                                                title="Supprimer">
                                                                <Trash2 className="w-3 h-3" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-between px-1">
                                <span className="text-xs text-slate-400">
                                    {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filteredEmployees.length)} sur {filteredEmployees.length}
                                </span>
                                <div className="flex items-center gap-1">
                                    <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:bg-slate-100 disabled:opacity-30 transition-colors">
                                        <ChevronLeft className="w-3.5 h-3.5" />Précédent
                                    </button>
                                    {(() => {
                                        const ws = 3
                                        let s = Math.max(0, Math.min(page - 1, totalPages - ws))
                                        const e = Math.min(totalPages - 1, s + ws - 1)
                                        s = Math.max(0, e - ws + 1)
                                        return Array.from({ length: e - s + 1 }, (_, i) => s + i).map(i => (
                                            <button key={i} onClick={() => setPage(i)}
                                                className={cn('w-7 h-7 rounded-lg text-xs font-medium transition-colors',
                                                    i === page ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100')}>
                                                {i + 1}
                                            </button>
                                        ))
                                    })()}
                                    <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1}
                                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:bg-slate-100 disabled:opacity-30 transition-colors">
                                        Suivant<ChevronRight className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}

                {/* ── Floating bar (sélection multi) ── */}
                {selectedIds.size > 0 && (
                    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-slate-900 text-white px-4 py-2.5 rounded-2xl shadow-2xl animate-in slide-in-from-bottom-3 duration-200">
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-white/15 flex items-center justify-center">
                                <span className="text-[11px] font-bold">{selectedIds.size}</span>
                            </div>
                            <span className="text-sm text-slate-300">employé{selectedIds.size > 1 ? 's' : ''}</span>
                        </div>
                        <div className="w-px h-5 bg-white/20" />

                        {/* Modifier cycle */}
                        {hasPermissionUpdateEmployees && (
                            <button onClick={() => setCycleModalOpen(true)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white transition-colors"
                                style={{ background: '#008F4A' }}>
                                <Settings2 className="w-3.5 h-3.5" />Modifier cycle
                            </button>
                        )}

                        {/* Exporter */}
                        {hasPermissionExportEmployees && (
                            <button onClick={handleExport} disabled={exporting}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-slate-900 rounded-xl text-xs font-semibold hover:bg-slate-100 transition-colors disabled:opacity-50">
                                {exporting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                                Exporter
                            </button>
                        )}

                        {/* Supprimer */}
                        {hasPermissionDeleteEmployees && (
                            <button onClick={() => openDeleteDialog(Array.from(selectedIds))}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500 text-white rounded-xl text-xs font-semibold hover:bg-rose-600 transition-colors">
                                <Trash2 className="w-3.5 h-3.5" />Supprimer
                            </button>
                        )}

                        {/* Clear */}
                        <button onClick={() => setSelectedIds(new Set())}
                            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-slate-400 hover:text-white">
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                )}

                {/* ── Modals ── */}
                <EmployeeFormModal
                    open={formModalOpen}
                    onOpenChange={setFormModalOpen}
                    workspaceId={workspaceId}
                    employee={editingEmployee}
                    onSuccess={loadEmployees}
                />

                <CycleModal
                    open={cycleModalOpen}
                    onOpenChange={setCycleModalOpen}
                    employeeIds={selectedEmployeeIds}
                    employeeMatricules={selectedEmployeeMatricules}
                    currentCycle={firstSelectedCycle}
                    onSuccess={() => { setCycleModalOpen(false); setSelectedIds(new Set()); loadEmployees() }}
                />

                <DeleteConfirmDialog
                    open={deleteDialogOpen}
                    onOpenChange={setDeleteDialogOpen}
                    count={idsToDelete.length}
                    onConfirm={handleDelete}
                    loading={deleting}
                />
            </div>
        </AppShell>
    )
}
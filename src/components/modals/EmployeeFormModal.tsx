'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { employeesApi } from '@/lib/api'
import { toast } from 'react-hot-toast'
import { cn } from '@/lib/utils'
import { User, RefreshCw, CheckCircle2, Loader2, Moon } from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────

type CycleType = 'weekly' | 'rotation' | 'night' | 'unknown'

interface CycleForm {
    type: CycleType
    rest_days: number[]
    travail: number
    repos: number
    start_phase: number
}

interface EmployeeFormModalProps {
    open: boolean
    onOpenChange: (v: boolean) => void
    workspaceId: string
    employee?: any   // si fourni → mode édition
    onSuccess: () => void
}

interface Departement {
    id: string
    name: string
}

interface Zone {
    id: string
    name: string
}

// ─── Constants ────────────────────────────────────────────────

const DAYS = [
    { id: 1, label: 'Lundi' },
    { id: 2, label: 'Mardi' },
    { id: 3, label: 'Mercredi' },
    { id: 4, label: 'Jeudi' },
    { id: 5, label: 'Vendredi' },
    { id: 6, label: 'Samedi' },
    { id: 0, label: 'Dimanche' },
]

const DEFAULT_CYCLE: CycleForm = {
    type: 'weekly', rest_days: [], travail: 2, repos: 2, start_phase: 0,
}

// ─── Parse cycle depuis BDD ───────────────────────────────────

function parseCycle(raw?: any): { form: CycleForm; defined: boolean } {
    if (!raw || raw.type === 'unknown') {
        return { form: DEFAULT_CYCLE, defined: false }
    }
    const rest_days = (() => {
        try {
            let days = JSON.parse(raw.rest_days || '[]')
            if (Array.isArray(days)) {
                return days.map(d => parseInt(d, 10)).filter(n => !isNaN(n))
            }
            return []
        } catch { return [] }
    })()
    return {
        form: {
            type: raw.type ?? 'weekly',
            rest_days,
            travail: raw.travail ?? 2,
            repos: raw.repos ?? 2,
            start_phase: raw.start_phase ?? 0,
        },
        defined: true,
    }
}

// ─────────────────────────────────────────────────────────────
// EmployeeFormModal
// ─────────────────────────────────────────────────────────────

export function EmployeeFormModal({
    open, onOpenChange, workspaceId, employee, onSuccess,
}: EmployeeFormModalProps) {
    const isEdit = !!employee

    // ── Champs employé ────────────────────────────────────────
    const [matricule, setMatricule] = useState('')
    const [nom, setNom] = useState('')
    const [prenom, setPrenom] = useState('')
    const [poste, setPoste] = useState('')
    const [departementId, setDepartementId] = useState<string>('')
    const [selectedZoneIds, setSelectedZoneIds] = useState<string[]>([])
    const [active, setActive] = useState<boolean>(true) // 🔥 NOUVEAU : State pour le statut

    // ── Data dynamiques ───────────────────────────────────────
    const [departements, setDepartements] = useState<Departement[]>([])
    const [zones, setZones] = useState<Zone[]>([])
    const [loadingData, setLoadingData] = useState(false)

    // ── Cycle ─────────────────────────────────────────────────
    const [cycle, setCycle] = useState<CycleForm>(DEFAULT_CYCLE)
    const [defineCycle, setDefineCycle] = useState(false)
    const [loading, setLoading] = useState(false)

    // ── Charger les départements et zones ─────────────────────
    useEffect(() => {
        if (!open || !workspaceId) return

        const fetchData = async () => {
            setLoadingData(true)
            try {
                const [departementsRes, zonesRes] = await Promise.all([
                    fetch(`/api/workspaces/${workspaceId}/departements`),
                    fetch(`/api/workspaces/${workspaceId}/zones`)
                ])

                if (departementsRes.ok) {
                    const deps = await departementsRes.json()
                    setDepartements(deps)
                }
                if (zonesRes.ok) {
                    const zns = await zonesRes.json()
                    setZones(zns)
                }
            } catch (error) {
                console.error('Error fetching data:', error)
                toast.error('Erreur lors du chargement des données')
            } finally {
                setLoadingData(false)
            }
        }

        fetchData()
    }, [open, workspaceId])

    // ── Sync à l'ouverture (mode édition) ────────────────────
    useEffect(() => {
        if (!open) return

        if (isEdit && employee) {
            setMatricule(employee.matricule ?? '')
            setNom(employee.nom ?? '')
            setPrenom(employee.prenom ?? '')
            setPoste(employee.poste ?? '')
            setDepartementId(employee.departmenet_id ?? '')
            setActive(employee.active ?? true) // 🔥 NOUVEAU : Récupération du statut

            // Récupérer les zones de l'employé
            const zoneIds = employee.zoneEmployes?.map((ze: any) => ze.zone_id) ?? []
            setSelectedZoneIds(zoneIds)

            const { form, defined } = parseCycle(employee.cycles)
            setCycle(form)
            setDefineCycle(defined)
        } else {
            setMatricule('')
            setNom('')
            setPrenom('')
            setPoste('')
            setDepartementId('')
            setActive(true) // 🔥 NOUVEAU : Statut par défaut à "Actif"
            setSelectedZoneIds([])
            setCycle(DEFAULT_CYCLE)
            setDefineCycle(false)
        }
    }, [open, employee, isEdit])

    // ─── Helpers ───────────────────────────────────────────────
    const updateCycle = (patch: Partial<CycleForm>) =>
        setCycle(prev => ({ ...prev, ...patch }))

    const toggleDay = (id: number) =>
        updateCycle({
            rest_days: cycle.rest_days.includes(id)
                ? cycle.rest_days.filter(d => d !== id)
                : [...cycle.rest_days, id],
        })

    const toggleZone = (zoneId: string) => {
        setSelectedZoneIds(prev =>
            prev.includes(zoneId)
                ? prev.filter(id => id !== zoneId)
                : [...prev, zoneId]
        )
    }

    // ── Validation ────────────────────────────────────────────
    const isCycleValid = !defineCycle
        || cycle.type === 'unknown'
        || (cycle.type === 'weekly' && cycle.rest_days.length >= 1)
        || (cycle.type !== 'weekly' && cycle.travail >= 1 && cycle.repos >= 1)

    const isFormValid = matricule.trim() !== '' && isCycleValid

    // ── Build payload cycle ───────────────────────────────────
    const buildCyclePayload = () => {
        if (!defineCycle) return null
        if (cycle.type === 'weekly') return { type: 'weekly', rest_days: cycle.rest_days }
        return { type: cycle.type, travail: cycle.travail, repos: cycle.repos, start_phase: cycle.start_phase }
    }

    // ── Soumission ────────────────────────────────────────────
    const handleSave = async () => {
        if (!isFormValid) {
            if (!matricule.trim()) toast.error('Le matricule est requis')
            else toast.error(cycle.type === 'weekly' ? 'Sélectionnez au moins un jour de repos' : 'Jours ≥ 1')
            return
        }

        setLoading(true)
        try {
            const cyclePayload = buildCyclePayload()

            if (isEdit) {
                await employeesApi.update(employee.id, {
                    nom: nom || undefined,
                    prenom: prenom || undefined,
                    poste: poste || undefined,
                    departement: departementId || undefined,
                    zones: selectedZoneIds.length > 0 ? selectedZoneIds : undefined,
                    active, // 🔥 NOUVEAU : Envoi du statut
                    cycle: cyclePayload as any,
                })
                toast.success('Employé modifié')
            } else {
                await employeesApi.create({
                    matricule: matricule.trim(),
                    nom: nom || undefined,
                    prenom: prenom || undefined,
                    poste: poste || undefined,
                    departmenet_id: departementId || undefined,
                    zone_ids: selectedZoneIds.length > 0 ? selectedZoneIds : undefined,
                    workspace_id: workspaceId,
                    active, // 🔥 NOUVEAU : Envoi du statut
                    cycle: cyclePayload as any,
                })
                toast.success('Employé créé')
            }
            onOpenChange(false)
            onSuccess()
        } catch (err: any) {
            toast.error(err?.response?.data?.error ?? 'Erreur lors de la sauvegarde')
        } finally {
            setLoading(false)
        }
    }

    // ── Résumé cycle (footer) ─────────────────────────────────
    const cycleResume = (() => {
        if (!defineCycle) return 'Cycle automatique'
        if (cycle.type === 'weekly') {
            if (cycle.rest_days.length === 0) return 'Aucun jour sélectionné'
            return `Repos: ${cycle.rest_days.map(d => DAYS.find(x => x.id === d)?.label.slice(0, 3) ?? '?').join(', ')}`
        }
        return `${cycle.travail}T / ${cycle.repos}R · phase ${cycle.start_phase}`
    })()

    // ─────────────────────────────────────────────────────────
    // Render
    // ─────────────────────────────────────────────────────────

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden gap-0">

                {/* Header */}
                <div className="px-6 pt-5 pb-4 border-b border-slate-100">
                    <DialogTitle className="text-[15px] font-semibold text-slate-900 flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                            style={{ background: 'linear-gradient(135deg, #008F4A, #00b85f)', boxShadow: '0 2px 6px rgba(0,143,74,0.25)' }}>
                            <User className="w-3.5 h-3.5 text-white" />
                        </div>
                        {isEdit ? 'Modifier l\'employé' : 'Nouvel employé'}
                    </DialogTitle>
                    {isEdit && (
                        <p className="text-[11px] text-slate-400 mt-0.5 font-mono ml-[38px]">{employee.matricule}</p>
                    )}
                </div>

                <div className="px-6 py-5 space-y-5 max-h-[72vh] overflow-y-auto">

                    {/* ── Informations ── */}
                    <div className="space-y-3">
                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Informations</p>

                        <div className="grid grid-cols-2 gap-3">
                            {/* Matricule */}
                            <div className="space-y-1.5">
                                <Label className="text-[12px] font-semibold text-slate-600">
                                    Matricule {!isEdit && <span className="text-rose-400">*</span>}
                                </Label>
                                <Input
                                    value={matricule}
                                    onChange={e => setMatricule(e.target.value)}
                                    placeholder="MAT001"
                                    disabled={isEdit}
                                    className={cn(
                                        'h-9 text-sm font-mono',
                                        isEdit && 'bg-slate-50 text-slate-400 cursor-not-allowed'
                                    )}
                                />
                            </div>
                            {/* Poste */}
                            <div className="space-y-1.5">
                                <Label className="text-[12px] font-semibold text-slate-600">Poste</Label>
                                <Input value={poste} onChange={e => setPoste(e.target.value)}
                                    placeholder="Technicien" className="h-9 text-sm" />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-[12px] font-semibold text-slate-600">Prénom</Label>
                                <Input value={prenom} onChange={e => setPrenom(e.target.value)}
                                    placeholder="Prénom" className="h-9 text-sm" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[12px] font-semibold text-slate-600">Nom</Label>
                                <Input value={nom} onChange={e => setNom(e.target.value)}
                                    placeholder="Nom" className="h-9 text-sm" />
                            </div>
                        </div>

                        {/* 🔥 MODIFIÉ : Département et Statut dans la même grille */}
                        <div className="grid grid-cols-2 gap-3">
                            {/* Département - Select */}
                            <div className="space-y-1.5">
                                <Label className="text-[12px] font-semibold text-slate-600">Département</Label>
                                <Select value={departementId} onValueChange={setDepartementId}>
                                    <SelectTrigger className="h-9 text-sm">
                                        <SelectValue placeholder="Sélectionner un département" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="null">Aucun département</SelectItem>
                                        {departements.map((dep) => (
                                            <SelectItem key={dep.id} value={dep.id}>
                                                {dep.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {loadingData && (
                                    <p className="text-[10px] text-slate-400">Chargement des départements...</p>
                                )}
                            </div>

                            {/* 🔥 NOUVEAU : Statut - Select */}
                            <div className="space-y-1.5">
                                <Label className="text-[12px] font-semibold text-slate-600">Statut</Label>
                                <Select value={active ? 'true' : 'false'} onValueChange={v => setActive(v === 'true')}>
                                    <SelectTrigger className="h-9 text-sm">
                                        <SelectValue placeholder="Statut de l'employé" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="true">
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                                Actif
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="false">
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full bg-rose-500"></div>
                                                Inactif
                                            </div>
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Zones - Multi-select avec checkboxes */}
                        <div className="space-y-1.5">
                            <Label className="text-[12px] font-semibold text-slate-600">Zones</Label>
                            {zones.length === 0 && !loadingData ? (
                                <p className="text-[12px] text-slate-400 italic">Aucune zone disponible</p>
                            ) : (
                                <div className="border border-slate-200 rounded-lg p-3 space-y-2 max-h-32 overflow-y-auto">
                                    {zones.map((zone) => (
                                        <div
                                            key={zone.id}
                                            onClick={() => toggleZone(zone.id)}
                                            className={cn(
                                                'flex items-center gap-2.5 px-2 py-1.5 rounded-lg cursor-pointer transition-colors',
                                                selectedZoneIds.includes(zone.id)
                                                    ? 'bg-[rgba(0,143,74,0.07)] hover:bg-[rgba(0,143,74,0.1)]'
                                                    : 'hover:bg-slate-50'
                                            )}
                                        >
                                            <Checkbox
                                                checked={selectedZoneIds.includes(zone.id)}
                                                onCheckedChange={() => toggleZone(zone.id)}
                                                className="h-3.5 w-3.5 pointer-events-none"
                                            />
                                            <span className="text-[12px] text-slate-700">{zone.name}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {selectedZoneIds.length > 0 && (
                                <p className="text-[11px] text-[#008F4A] font-medium">
                                    {selectedZoneIds.length} zone(s) sélectionnée(s)
                                </p>
                            )}
                        </div>
                    </div>

                    {/* ── Cycle ── */}
                    <div className="space-y-3 pt-1 border-t border-slate-100">
                        <div className="flex items-center justify-between">
                            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
                                Cycle de travail
                            </p>
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                                <Checkbox
                                    checked={defineCycle}
                                    onCheckedChange={v => {
                                        setDefineCycle(!!v)
                                        if (!v) setCycle(DEFAULT_CYCLE)
                                        else if (cycle.type === 'unknown') updateCycle({ type: 'weekly' })
                                    }}
                                    className="h-3.5 w-3.5"
                                />
                                <span className="text-[12px] text-slate-600 font-medium">Définir un cycle manuel</span>
                            </label>
                        </div>

                        {!defineCycle ? (
                            <div className="flex items-center gap-2.5 px-3 py-3 rounded-xl bg-slate-50 border border-slate-200">
                                <RefreshCw className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <p className="text-[12px] text-slate-500">
                                    Cycle automatique — détecté depuis les pointages
                                </p>
                            </div>
                        ) : (
                            <Tabs
                                value={cycle.type === 'unknown' ? 'weekly' : cycle.type}
                                onValueChange={v => updateCycle({ type: v as CycleType })}
                            >
                                <TabsList className="grid w-full grid-cols-3 bg-slate-100 h-8">
                                    <TabsTrigger value="weekly" className="text-[11px] font-medium">Hebdomadaire</TabsTrigger>
                                    <TabsTrigger value="rotation" className="text-[11px] font-medium">Rotation</TabsTrigger>
                                    <TabsTrigger value="night" className="text-[11px] font-medium">Nuit</TabsTrigger>
                                </TabsList>

                                {/* ── Weekly ── */}
                                <TabsContent value="weekly" className="pt-3 space-y-2">
                                    <p className="text-[11px] text-slate-500">Jours de repos hebdomadaires</p>
                                    <div className="grid grid-cols-2 gap-1.5">
                                        {DAYS.map(day => (
                                            <div key={day.id}
                                                onClick={() => toggleDay(day.id)}
                                                className={cn(
                                                    'flex items-center gap-2.5 px-3 py-2.5 rounded-xl border cursor-pointer transition-all duration-100 select-none',
                                                    cycle.rest_days.includes(day.id)
                                                        ? 'bg-[rgba(0,143,74,0.07)] border-[#008F4A]/35 text-[#007a3d]'
                                                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                                                )}
                                            >
                                                <Checkbox
                                                    checked={cycle.rest_days.includes(day.id)}
                                                    onCheckedChange={() => toggleDay(day.id)}
                                                    className="h-3 w-3 pointer-events-none"
                                                />
                                                <span className="text-[12px] font-medium">{day.label}</span>
                                            </div>
                                        ))}
                                    </div>
                                    {cycle.rest_days.length > 0 && (
                                        <p className="text-[11px] text-[#008F4A] font-medium">
                                            {cycle.rest_days.length} jour{cycle.rest_days.length > 1 ? 's' : ''} de repos sélectionné{cycle.rest_days.length > 1 ? 's' : ''}
                                        </p>
                                    )}
                                </TabsContent>

                                {/* ── Rotation + Night ── */}
                                {(['rotation', 'night'] as const).map(t => (
                                    <TabsContent key={t} value={t} className="pt-3 space-y-3">
                                        {t === 'night' && (
                                            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-50 border border-indigo-100">
                                                <Moon className="w-3.5 h-3.5 text-indigo-500" />
                                                <p className="text-[11px] text-indigo-700 font-medium">Cycle adapté pour le travail de nuit</p>
                                            </div>
                                        )}
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <Label className="text-[11px] font-semibold text-slate-600">Jours travail</Label>
                                                <Input type="number" min={1} max={30}
                                                    value={cycle.travail}
                                                    onChange={e => updateCycle({ travail: parseInt(e.target.value) || 1 })}
                                                    className="h-8 text-sm" />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-[11px] font-semibold text-slate-600">Jours repos</Label>
                                                <Input type="number" min={1} max={30}
                                                    value={cycle.repos}
                                                    onChange={e => updateCycle({ repos: parseInt(e.target.value) || 1 })}
                                                    className="h-8 text-sm" />
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-[11px] font-semibold text-slate-600">
                                                Phase de départ
                                                <span className="text-slate-400 font-normal ml-1">(0 = début du cycle)</span>
                                            </Label>
                                            <Input type="number" min={0} max={cycle.travail + cycle.repos - 1}
                                                value={cycle.start_phase}
                                                onChange={e => updateCycle({ start_phase: parseInt(e.target.value) || 0 })}
                                                className="h-8 text-sm" />
                                        </div>
                                        {/* Aperçu visuel */}
                                        <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                                            <p className="text-[10px] text-slate-400 font-medium">Aperçu</p>
                                            <div className="flex flex-wrap gap-1">
                                                {Array.from({ length: Math.min(cycle.travail + cycle.repos, 21) }, (_, i) => {
                                                    const pos = (i + cycle.start_phase) % (cycle.travail + cycle.repos)
                                                    const isWork = pos < cycle.travail
                                                    return (
                                                        <span key={i}
                                                            className={cn(
                                                                'w-6 h-6 rounded flex items-center justify-center text-[9px] font-bold',
                                                                isWork
                                                                    ? 'bg-[rgba(0,143,74,0.12)] text-[#008F4A] border border-[rgba(0,143,74,0.2)]'
                                                                    : 'bg-slate-200 text-slate-500'
                                                            )}>
                                                            {isWork ? 'T' : 'R'}
                                                        </span>
                                                    )
                                                })}
                                                {(cycle.travail + cycle.repos) > 21 && (
                                                    <span className="text-[10px] text-slate-400 self-center ml-1">
                                                        +{cycle.travail + cycle.repos - 21}…
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </TabsContent>
                                ))}
                            </Tabs>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 flex items-center justify-between border-t border-slate-100">
                    <span className="text-[11px] text-slate-400 truncate max-w-[200px]">{cycleResume}</span>
                    <div className="flex gap-2 shrink-0">
                        <button
                            onClick={() => onOpenChange(false)}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors"
                        >
                            Annuler
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={loading || !isFormValid}
                            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{
                                background: 'linear-gradient(135deg, #008F4A, #00a654)',
                                boxShadow: '0 2px 8px rgba(0,143,74,0.25)',
                            }}
                        >
                            {loading
                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                : <CheckCircle2 className="w-3.5 h-3.5" />
                            }
                            {loading ? 'Enregistrement…' : isEdit ? 'Enregistrer' : 'Créer l\'employé'}
                        </button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
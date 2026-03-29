'use client'

import { useState, useEffect } from 'react'
import {
    Dialog, DialogContent, DialogHeader,
    DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import { cyclesApi } from '@/lib/api'
import { toast } from 'react-hot-toast'
import { Users, User } from 'lucide-react'

interface CycleModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    // ── Un seul employé (ancienne API, rétrocompatible) ────────
    employeeId?: string
    employeeMatricule?: string
    currentCycle?: any
    // ── Plusieurs employés (nouveau) ───────────────────────────
    employeeIds?: string[]
    employeeMatricules?: string[]
    onSuccess: (newCycle?: any) => void
}

const DAYS = [
    { id: 0, label: 'Dimanche' },
    { id: 1, label: 'Lundi'    },
    { id: 2, label: 'Mardi'    },
    { id: 3, label: 'Mercredi' },
    { id: 4, label: 'Jeudi'    },
    { id: 5, label: 'Vendredi' },
    { id: 6, label: 'Samedi'   },
]

export function CycleModal({
    open, onOpenChange,
    employeeId, employeeMatricule, currentCycle,
    employeeIds = [], employeeMatricules = [],
    onSuccess,
}: CycleModalProps) {

    // Normaliser : si mode single, utiliser les arrays
    const ids        = employeeIds.length > 0  ? employeeIds        : employeeId ? [employeeId] : []
    const matricules = employeeMatricules.length > 0 ? employeeMatricules : employeeMatricule ? [employeeMatricule] : []
    const isMulti    = ids.length > 1

    const [type, setType]             = useState('weekly')
    const [restDays, setRestDays]     = useState<number[]>([])
    const [travail, setTravail]       = useState(2)
    const [repos, setRepos]           = useState(2)
    const [startPhase, setStartPhase] = useState(0)
    const [loading, setLoading]       = useState(false)

    // Sync state à chaque ouverture
    useEffect(() => {
        if (!open) return
        if (currentCycle && !isMulti) {
            setType(currentCycle.type || 'weekly')
            setTravail(currentCycle.travail || 2)
            setRepos(currentCycle.repos || 2)
            setStartPhase(currentCycle.start_phase ?? 0)
            const raw = currentCycle.rest_days ?? currentCycle.restDays ?? '[]'
            try {
                let parsed = JSON.parse(raw)
                if (typeof parsed === 'string') parsed = JSON.parse(parsed)
                setRestDays(parsed)
            } catch { setRestDays([]) }
        } else {
            // Multi : reset — on applique un nouveau cycle commun
            setType('weekly')
            setRestDays([])
            setTravail(2)
            setRepos(2)
            setStartPhase(0)
        }
    }, [open, currentCycle, isMulti])

    const toggleDay = (id: number) =>
        setRestDays(prev => prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id])

    const isValid = () => {
        if (type === 'weekly')   return restDays.length >= 1
        if (type === 'rotation' || type === 'night') return travail >= 1 && repos >= 1
        return false
    }

    const handleSave = async () => {
        if (!isValid()) {
            toast.error(type === 'weekly'
                ? 'Sélectionnez au moins un jour de repos'
                : 'Jours de travail et repos doivent être ≥ 1')
            return
        }
        if (ids.length === 0) { toast.error('Aucun employé sélectionné'); return }

        setLoading(true)
        try {
            const cycleData: any = { type, est_manuel: true }
            if (type === 'weekly') {
                cycleData.rest_days = JSON.stringify(restDays)
            } else {
                cycleData.travail    = Number(travail)
                cycleData.repos      = Number(repos)
                cycleData.start_phase = startPhase
            }

            // Envoyer en parallèle pour tous les employés
            await Promise.all(ids.map(id => cyclesApi.update(id, cycleData)))

            toast.success(isMulti
                ? `${ids.length} cycles mis à jour`
                : 'Cycle modifié avec succès')
            onOpenChange(false)
            onSuccess(cycleData)
        } catch {
            toast.error('Erreur lors de la modification')
        } finally {
            setLoading(false)
        }
    }

    // Label titre
    const titleLabel = isMulti
        ? `${ids.length} employés sélectionnés`
        : (matricules[0] ?? '—')

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden gap-0">

                {/* ── Header ── */}
                <div className="px-6 pt-6 pb-4 border-b border-slate-100">
                    <DialogTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
                        {isMulti
                            ? <Users className="w-4 h-4 text-[#008F4A]" />
                            : <User  className="w-4 h-4 text-[#008F4A]" />
                        }
                        Modifier le cycle
                    </DialogTitle>
                    <p className="text-sm text-slate-500 mt-0.5">
                        {isMulti ? (
                            <>
                                <span className="font-semibold text-slate-700">{ids.length} employés</span>
                                {' — le même cycle sera appliqué à tous'}
                            </>
                        ) : (
                            <span className="font-mono font-medium text-slate-700">{titleLabel}</span>
                        )}
                    </p>

                    {/* Badges matricules si multi (max 5) */}
                    {isMulti && matricules.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                            {matricules.slice(0, 5).map(m => (
                                <span key={m}
                                    className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-[rgba(0,143,74,0.08)] text-[#008F4A] border border-[rgba(0,143,74,0.15)]">
                                    {m}
                                </span>
                            ))}
                            {matricules.length > 5 && (
                                <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500">
                                    +{matricules.length - 5} autres
                                </span>
                            )}
                        </div>
                    )}
                </div>

                {/* ── Tabs ── */}
                <div className="px-6 py-5">
                    <Tabs value={type} onValueChange={setType} className="w-full">
                        <TabsList className="grid w-full grid-cols-3 bg-slate-100">
                            <TabsTrigger value="weekly">Hebdomadaire</TabsTrigger>
                            <TabsTrigger value="rotation">Rotation</TabsTrigger>
                            <TabsTrigger value="night">Nuit</TabsTrigger>
                        </TabsList>

                        {/* Weekly */}
                        <TabsContent value="weekly" className="space-y-3 pt-4">
                            <Label className="text-[12px] font-semibold text-slate-600">Jours de repos</Label>
                            <div className="grid grid-cols-2 gap-2">
                                {DAYS.map(day => (
                                    <div key={day.id}
                                        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border-2 cursor-pointer transition-all duration-150 ${
                                            restDays.includes(day.id)
                                                ? 'bg-[rgba(0,143,74,0.06)] border-[#008F4A]/40'
                                                : 'bg-white border-slate-200 hover:border-slate-300'
                                        }`}
                                        onClick={() => toggleDay(day.id)}
                                    >
                                        <Checkbox
                                            id={`day-${day.id}`}
                                            checked={restDays.includes(day.id)}
                                            onCheckedChange={() => toggleDay(day.id)}
                                            className="pointer-events-none"
                                        />
                                        <label htmlFor={`day-${day.id}`}
                                            className={`text-[12px] font-medium cursor-pointer ${
                                                restDays.includes(day.id) ? 'text-[#007a3d]' : 'text-slate-600'
                                            }`}>
                                            {day.label}
                                        </label>
                                    </div>
                                ))}
                            </div>
                            {restDays.length > 0 && (
                                <p className="text-[11px] text-[#008F4A] font-medium">
                                    {restDays.length} jour{restDays.length > 1 ? 's' : ''} de repos sélectionné{restDays.length > 1 ? 's' : ''}
                                </p>
                            )}
                        </TabsContent>

                        {/* Rotation + Night partagent la même logique */}
                        {(['rotation', 'night'] as const).map(tabType => (
                            <TabsContent key={tabType} value={tabType} className="space-y-4 pt-4">
                                {tabType === 'night' && (
                                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-50 border border-indigo-100">
                                        <span className="text-base">🌙</span>
                                        <p className="text-[11px] text-indigo-700 font-medium">Cycle adapté pour le travail de nuit</p>
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <Label className="text-[12px] font-semibold text-slate-600">Jours de travail</Label>
                                        <Input
                                            type="number" min={1} max={30}
                                            value={travail}
                                            onChange={e => setTravail(parseInt(e.target.value) || 1)}
                                            className="h-9 text-sm focus:border-[#008F4A] focus:ring-[#008F4A]/20"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-[12px] font-semibold text-slate-600">Jours de repos</Label>
                                        <Input
                                            type="number" min={1} max={30}
                                            value={repos}
                                            onChange={e => setRepos(parseInt(e.target.value) || 1)}
                                            className="h-9 text-sm focus:border-[#008F4A] focus:ring-[#008F4A]/20"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <Label className="text-[12px] font-semibold text-slate-600">
                                        Phase de départ
                                        <span className="text-slate-400 text-[10px] font-normal ml-1.5">(décalage dans le cycle, 0 = début)</span>
                                    </Label>
                                    <Input
                                        type="number" min={0} max={travail + repos - 1}
                                        value={startPhase}
                                        onChange={e => setStartPhase(parseInt(e.target.value) || 0)}
                                        className="h-9 text-sm focus:border-[#008F4A] focus:ring-[#008F4A]/20"
                                    />
                                </div>

                                {/* Aperçu cycle */}
                                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                                    <p className="text-[11px] text-slate-500 mb-1.5">Aperçu du cycle</p>
                                    <div className="flex flex-wrap gap-1">
                                        {Array.from({ length: Math.min(travail + repos, 20) }, (_, i) => {
                                            const pos = (i + startPhase) % (travail + repos)
                                            const isWork = pos < travail
                                            return (
                                                <span key={i}
                                                    className={`w-6 h-6 rounded flex items-center justify-center text-[9px] font-bold ${
                                                        isWork
                                                            ? 'bg-[rgba(0,143,74,0.12)] text-[#008F4A] border border-[rgba(0,143,74,0.25)]'
                                                            : 'bg-slate-200 text-slate-500'
                                                    }`}>
                                                    {isWork ? 'T' : 'R'}
                                                </span>
                                            )
                                        })}
                                        {(travail + repos) > 20 && (
                                            <span className="text-[10px] text-slate-400 self-center ml-1">+{travail + repos - 20}</span>
                                        )}
                                    </div>
                                </div>
                            </TabsContent>
                        ))}
                    </Tabs>
                </div>

                {/* ── Footer ── */}
                <div className="px-6 py-4 flex items-center justify-between border-t border-slate-100">
                    <span className="text-[11px] text-slate-400">
                        {isMulti && `${ids.length} employés · `}
                        {type === 'weekly'
                            ? restDays.length > 0
                                ? `Repos: ${restDays.map(d => DAYS[d].label.slice(0,3)).join(', ')}`
                                : 'Aucun jour sélectionné'
                            : `${travail}T / ${repos}R · phase ${startPhase}`
                        }
                    </span>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                            Annuler
                        </Button>
                        <Button
                            size="sm"
                            onClick={handleSave}
                            disabled={loading || !isValid()}
                            className="min-w-[100px]"
                            style={{
                                background: !loading && isValid() ? "linear-gradient(135deg, #008F4A, #00a654)" : undefined,
                                boxShadow:  !loading && isValid() ? "0 2px 8px rgba(0,143,74,0.25)" : undefined,
                            }}
                        >
                            {loading ? 'Enregistrement…' : isMulti ? `Appliquer (${ids.length})` : 'Enregistrer'}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
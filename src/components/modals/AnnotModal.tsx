'use client'

import { useState, useEffect } from 'react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { planningApi } from '@/lib/api'
import { toast } from 'react-hot-toast'
import { getAnnotColor, getAnnotLabel } from '@/lib/utils'
import { CheckCircle2, XCircle, Coffee, FileText, Stethoscope, RefreshCw, Palmtree, Sparkles, X } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────

interface AnnotModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    // Supporte un seul jour OU plusieurs jours sélectionnés
    id: string
    matricule: string
    dates: string[]          // tableau de dates YYYY-MM-DD
    currentCode?: string     // si un seul jour avec annotation existante
    currentStatut?: string   // si un seul jour
    onSuccess: () => void
}

// ─── Config des statuts et annotations ───────────────────────

const BASE_TYPES = [
    {
        code: 'P',
        label: 'Présent',
        icon: CheckCircle2,
        bg: 'bg-emerald-50',
        border: 'border-emerald-200',
        activeBg: 'bg-emerald-500',
        activeBorder: 'border-emerald-500',
        text: 'text-emerald-700',
        activeText: 'text-white',
        dot: 'bg-emerald-500',
    },
    {
        code: 'A',
        label: 'Absent',
        icon: XCircle,
        bg: 'bg-rose-50',
        border: 'border-rose-200',
        activeBg: 'bg-rose-500',
        activeBorder: 'border-rose-500',
        text: 'text-rose-700',
        activeText: 'text-white',
        dot: 'bg-rose-500',
    },
    {
        code: 'R',
        label: 'Repos',
        icon: Coffee,
        bg: 'bg-slate-50',
        border: 'border-slate-200',
        activeBg: 'bg-slate-700',
        activeBorder: 'border-slate-700',
        text: 'text-slate-600',
        activeText: 'text-white',
        dot: 'bg-slate-400',
    },
]

const ANNOT_TYPES = [
    { code: 'M', label: 'Mission', icon: FileText, color: '#2563eb', light: '#eff6ff', border: '#bfdbfe' },
    { code: 'J', label: 'Justifié', icon: CheckCircle2, color: '#059669', light: '#ecfdf5', border: '#a7f3d0' },
    { code: 'Md', label: 'Maladie', icon: Stethoscope, color: '#dc2626', light: '#fef2f2', border: '#fecaca' },
    { code: 'Rc', label: 'Récupération', icon: RefreshCw, color: '#7c3aed', light: '#f5f3ff', border: '#ddd6fe' },
    { code: 'C', label: 'Congé', icon: Palmtree, color: '#d97706', light: '#fffbeb', border: '#fde68a' },
    { code: 'Ce', label: 'Congé exceptionnel', icon: Sparkles, color: '#db2777', light: '#fdf2f8', border: '#fbcfe8' },
]

// ─── Helpers ──────────────────────────────────────────────────

function formatDates(dates: string[]): string {
    if (dates.length === 0) return ''
    if (dates.length === 1) {
        return new Date(dates[0]).toLocaleDateString('fr-FR', {
            weekday: 'long', day: 'numeric', month: 'long'
        })
    }
    return `${dates.length} jours sélectionnés`
}

// ─── Component ────────────────────────────────────────────────

export function AnnotModal({
    open,
    onOpenChange,
    id,
    matricule,
    dates,
    currentCode,
    currentStatut,
    onSuccess,
}: AnnotModalProps) {
    const [selectedBase, setSelectedBase] = useState<string>('')
    const [selectedAnnot, setSelectedAnnot] = useState<string>('')
    const [description, setDescription] = useState('')
    const [loading, setLoading] = useState(false)

    const isMulti = dates.length > 1


    // Quand on choisit une annotation → forcer statut A
    const handleAnnotSelect = (code: string) => {
        if (selectedAnnot === code) {
            setSelectedAnnot('')
        } else {
            setSelectedAnnot(code)
            setSelectedBase('A')
        }
    }

    // Quand on choisit un statut de base → effacer annotation si P ou R
    const handleBaseSelect = (code: string) => {
        setSelectedBase(code)
        if (code === 'P' || code === 'R') setSelectedAnnot('')
    }

    const canSave = selectedBase !== '' || selectedAnnot !== ''

    const handleSave = async () => {
        if (!canSave) {
            toast.error('Sélectionnez un statut ou une annotation')
            return
        }

        setLoading(true)
        try {
            const isAnnotation = selectedAnnot !== ''

            // Appels en parallèle pour multi-sélection
            await Promise.all(
                dates.map((date) => {
                    if (isAnnotation) {
                        return planningApi.update(id, {
                            date,
                            statut: 'A',
                            annotation: {
                                code: selectedAnnot,
                                libelle: getAnnotLabel(selectedAnnot),
                                description: description || undefined,
                            },
                        })
                    } else {
                        return planningApi.update(id, {
                            date,
                            statut: selectedBase,
                        })
                    }
                })
            )

            toast.success(
                dates.length > 1
                    ? `${dates.length} jours modifiés`
                    : 'Modification enregistrée'
            )
            onSuccess()
            onOpenChange(false)
        } catch {
            toast.error('Erreur lors de la modification')
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden gap-0">
                {/* Header */}
                <div className="px-6 pt-6 pb-4 border-b border-slate-100">
                    <DialogTitle className="text-base font-semibold text-slate-900">
                        Modifier le planning aaaaaaaaa
                    </DialogTitle>
                    <p className="text-sm text-slate-500 mt-0.5 capitalize">
                        {matricule} · {formatDates(dates)}
                    </p>
                </div>

                <div className="px-6 py-5 space-y-6">

                    {/* ── Section 1: Statuts de base ── */}
                    <div>
                        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">
                            Statut
                        </p>
                        <div className="grid grid-cols-3 gap-2">
                            {BASE_TYPES.map((t) => {
                                const Icon = t.icon
                                const isActive = selectedBase === t.code && !selectedAnnot
                                return (
                                    <button
                                        key={t.code}
                                        onClick={() => handleBaseSelect(t.code)}
                                        className={`
                                            relative flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all duration-150
                                            ${isActive
                                                ? `${t.activeBg} ${t.activeBorder} shadow-sm`
                                                : `${t.bg} ${t.border} hover:border-opacity-60`
                                            }
                                        `}
                                    >
                                        <Icon className={`w-5 h-5 ${isActive ? t.activeText : t.text}`} />
                                        <span className={`text-xs font-semibold ${isActive ? t.activeText : t.text}`}>
                                            {t.label}
                                        </span>
                                        {isActive && (
                                            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-white/60" />
                                        )}
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {/* Séparateur avec label */}
                    <div className="flex items-center gap-3">
                        <div className="flex-1 h-px bg-slate-100" />
                        <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">ou annotation</span>
                        <div className="flex-1 h-px bg-slate-100" />
                    </div>

                    {/* ── Section 2: Annotations ── */}
                    <div>
                        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">
                            Annotation détaillée
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                            {ANNOT_TYPES.map((t) => {
                                const Icon = t.icon
                                const isActive = selectedAnnot === t.code
                                return (
                                    <button
                                        key={t.code}
                                        onClick={() => handleAnnotSelect(t.code)}
                                        className={`
                                            flex items-center gap-2.5 px-3 py-2.5 rounded-xl border-2 transition-all duration-150 text-left
                                            ${isActive ? 'shadow-sm' : 'hover:border-opacity-80'}
                                        `}
                                        style={{
                                            backgroundColor: isActive ? t.color : t.light,
                                            borderColor: isActive ? t.color : t.border,
                                        }}
                                    >
                                        <Icon
                                            className="w-4 h-4 shrink-0"
                                            style={{ color: isActive ? '#fff' : t.color }}
                                        />
                                        <div>
                                            <div
                                                className="text-[11px] font-bold font-mono leading-none"
                                                style={{ color: isActive ? '#fff' : t.color }}
                                            >
                                                {t.code}
                                            </div>
                                            <div
                                                className="text-[11px] leading-tight mt-0.5"
                                                style={{ color: isActive ? 'rgba(255,255,255,0.85)' : t.color }}
                                            >
                                                {t.label}
                                            </div>
                                        </div>
                                        {isActive && (
                                            <div className="ml-auto">
                                                <div className="w-4 h-4 rounded-full bg-white/25 flex items-center justify-center">
                                                    <div className="w-2 h-2 rounded-full bg-white" />
                                                </div>
                                            </div>
                                        )}
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {/* Description — seulement si annotation sélectionnée */}
                    {selectedAnnot && (
                        <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                            <Label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                                Description <span className="font-normal normal-case">(optionnelle)</span>
                            </Label>
                            <Textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Préciser les détails..."
                                className="mt-2 text-sm resize-none h-20 bg-slate-50 border-slate-200 focus:border-slate-400"
                            />
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 pb-6 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
                    {/* Résumé de la sélection */}
                    <div className="text-xs text-slate-400">
                        {selectedAnnot ? (
                            <span>
                                Absent + <span className="font-mono font-bold text-slate-600">{selectedAnnot}</span>
                            </span>
                        ) : selectedBase ? (
                            <span className="font-medium text-slate-600">
                                {BASE_TYPES.find(t => t.code === selectedBase)?.label}
                            </span>
                        ) : (
                            <span>Aucune sélection</span>
                        )}
                        {dates.length > 1 && (
                            <span className="ml-1 text-slate-400">sur {dates.length} jours</span>
                        )}
                    </div>

                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                            Annuler
                        </Button>
                        <Button
                            size="sm"
                            onClick={handleSave}
                            disabled={loading || !canSave}
                            className="min-w-[100px]"
                        >
                            {loading ? 'Enregistrement...' : `Enregistrer${dates.length > 1 ? ` (${dates.length})` : ''}`}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
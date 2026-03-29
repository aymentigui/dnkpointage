'use client'

import { useState, useEffect } from 'react'
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import { cyclesApi } from '@/lib/api'
import { toast } from 'react-hot-toast'

interface CycleModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    employeeIds: string[] // ← On accepte maintenant un tableau d'IDs
    employeeMatricule: string
    currentCycle?: any
    onSuccess: (newCycle?: any) => void
}

export function CycleModal({
    open,
    onOpenChange,
    employeeIds,
    employeeMatricule,
    currentCycle,
    onSuccess
}: CycleModalProps) {
    const [type, setType] = useState<string>('weekly')
    const [restDays, setRestDays] = useState<number[]>([])
    const [travail, setTravail] = useState<number>(2)
    const [repos, setRepos] = useState<number>(2)
    const [startPhase, setStartPhase] = useState<number>(0)
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (!open) return

        if (currentCycle) {
            setType(currentCycle.type || 'weekly')
            setTravail(currentCycle.travail || 2)
            setRepos(currentCycle.repos || 2)
            setStartPhase(currentCycle.start_phase ?? 0)

            const rawRestDays = currentCycle.rest_days ?? currentCycle.restDays ?? '[]'
            try {
                let parsedRestDays = JSON.parse(rawRestDays)
                if (typeof parsedRestDays === 'string') {
                    parsedRestDays = JSON.parse(parsedRestDays)
                }
                setRestDays(parsedRestDays)
            } catch {
                setRestDays([])
            }
        } else {
            setType('weekly')
            setRestDays([])
            setTravail(2)
            setRepos(2)
            setStartPhase(0)
        }
    }, [open, currentCycle])

    const days = [
        { id: 0, label: 'Dimanche' }, { id: 1, label: 'Lundi' },
        { id: 2, label: 'Mardi' }, { id: 3, label: 'Mercredi' },
        { id: 4, label: 'Jeudi' }, { id: 5, label: 'Vendredi' },
        { id: 6, label: 'Samedi' },
    ]

    const handleToggleDay = (dayId: number) => {
        setRestDays(prev =>
            prev.includes(dayId) ? prev.filter(d => d !== dayId) : [...prev, dayId]
        )
    }

    const isValid = (): boolean => {
        if (type === 'weekly') return restDays.length >= 1
        if (type === 'rotation' || type === 'night') {
            return travail >= 1 && repos >= 1 && travail <= 30 && repos <= 30
        }
        return false
    }

    const handleSave = async () => {
        if (!isValid()) {
            if (type === 'weekly') toast.error('Sélectionnez au moins un jour de repos')
            else toast.error('Jours de travail et repos doivent être entre 1 et 30')
            return
        }

        if (employeeIds.length === 0) {
            toast.error('Aucun employé sélectionné')
            return
        }

        setLoading(true)
        try {
            const cycleData: any = { type, est_manuel: true }
            if (type === 'weekly') {
                cycleData.rest_days = JSON.stringify(restDays)
            } else {
                cycleData.travail = Number(travail)
                cycleData.repos = Number(repos)
                cycleData.start_phase = startPhase
            }

            // Exécuter l'API pour tous les employés sélectionnés en parallèle
            await Promise.all(
                employeeIds.map(id => cyclesApi.update(id, cycleData))
            )

            toast.success(employeeIds.length > 1 ? `${employeeIds.length} cycles modifiés avec succès` : 'Cycle modifié avec succès')
            onOpenChange(false)
            onSuccess(cycleData)
        } catch {
            toast.error('Erreur lors de la modification')
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>
                        Modifier le cycle — {employeeMatricule}
                    </DialogTitle>
                </DialogHeader>

                <Tabs value={type} onValueChange={setType} className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="weekly">Hebdomadaire</TabsTrigger>
                        <TabsTrigger value="rotation">Rotation</TabsTrigger>
                        <TabsTrigger value="night">Nuit</TabsTrigger>
                    </TabsList>

                    <TabsContent value="weekly" className="space-y-4 py-4">
                        <div>
                            <Label>Jours de repos</Label>
                            <div className="grid grid-cols-2 gap-2 mt-2">
                                {days.map(day => (
                                    <div key={day.id} className="flex items-center space-x-2">
                                        <Checkbox
                                            id={`day-${day.id}`}
                                            checked={restDays.includes(day.id)}
                                            onCheckedChange={() => handleToggleDay(day.id)}
                                        />
                                        <Label htmlFor={`day-${day.id}`}>{day.label}</Label>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </TabsContent>

                    {(['rotation', 'night'] as const).map((tabType) => (
                        <TabsContent key={tabType} value={tabType} className="space-y-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Jours de travail</Label>
                                    <Input
                                        type="number" min={1} max={30}
                                        value={travail}
                                        onChange={(e) => setTravail(parseInt(e.target.value) || 1)}
                                        className="mt-2"
                                    />
                                </div>
                                <div>
                                    <Label>Jours de repos</Label>
                                    <Input
                                        type="number" min={1} max={30}
                                        value={repos}
                                        onChange={(e) => setRepos(parseInt(e.target.value) || 1)}
                                        className="mt-2"
                                    />
                                </div>
                            </div>

                            <div>
                                <Label>
                                    Phase de départ
                                    <span className="text-muted-foreground text-xs ml-2">
                                        (décalage dans le cycle, 0 = début)
                                    </span>
                                </Label>
                                <Input
                                    type="number" min={0} max={travail + repos - 1}
                                    value={startPhase}
                                    onChange={(e) => setStartPhase(parseInt(e.target.value) || 0)}
                                    className="mt-2"
                                />
                            </div>

                            {tabType === 'night' && (
                                <p className="text-sm text-muted-foreground">
                                    Cycle adapté pour le travail de nuit
                                </p>
                            )}
                        </TabsContent>
                    ))}
                </Tabs>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
                    <Button onClick={handleSave} disabled={loading || !isValid()}>
                        {loading ? 'Enregistrement...' : 'Enregistrer'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
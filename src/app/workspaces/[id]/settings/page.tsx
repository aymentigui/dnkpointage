'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { AppShell } from '@/components/layout/AppShell'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
    ArrowLeft, Save, Trash2, Download, Upload,
    Database, RefreshCw, CheckCircle2, XCircle,
    FileJson, AlertTriangle, Users, CalendarDays,
    BookMarked, RotateCcw,
} from 'lucide-react'
import { workspacesApi, exportApi, cyclesApi } from '@/lib/api'
import { ConfirmModal } from '@/components/modals/ConfirmModal'
import { useDropzone } from 'react-dropzone'
import { toast } from 'react-hot-toast'
import { downloadFile, cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────

interface ImportSummary {
    total: number
    crees: number
    existants: number
    cycles_crees: number
    plannings_crees: number
    annotations_crees: number
    erreurs: string[]
    erreurs_total: number
}

interface ImportState {
    status: 'idle' | 'reading' | 'uploading' | 'done' | 'error'
    fileName: string
    fileSize: number
    preview: { employees: number; planning: number; annotations: number; manualCycles: number } | null
    summary: ImportSummary | null
    error: string | null
}

// ─── SettingsPage ─────────────────────────────────────────────

export default function SettingsPage() {
    const params = useParams()
    const router = useRouter()
    const workspaceId = params.id as string

    const [workspace, setWorkspace] = useState<any>(null)
    const [workspaceName, setWorkspaceName] = useState('')
    const [loading, setLoading] = useState(false)
    const [deleteModalOpen, setDeleteModalOpen] = useState(false)
    // const [resetModalOpen, setResetModalOpen] = useState(false)

    const [importState, setImportState] = useState<ImportState>({
        status: 'idle',
        fileName: '',
        fileSize: 0,
        preview: null,
        summary: null,
        error: null,
    })

    useEffect(() => { loadWorkspace() }, [workspaceId])

    const loadWorkspace = async () => {
        try {
            const { data } = await workspacesApi.get(workspaceId)
            setWorkspace(data)
            setWorkspaceName(data.nom)
        } catch {
            toast.error('Erreur lors du chargement')
        }
    }

    // ── Workspace actions ─────────────────────────────────────

    const handleUpdateName = async () => {
        if (!workspaceName.trim()) return
        setLoading(true)
        try {
            await workspacesApi.update(workspaceId, { nom: workspaceName })
            toast.success('Nom modifié')
            loadWorkspace()
        } catch { toast.error('Erreur') }
        finally { setLoading(false) }
    }

    const handleDelete = async () => {
        setLoading(true)
        try {
            await workspacesApi.delete(workspaceId)
            toast.success('Workspace supprimé')
            router.push('/workspaces')
        } catch { toast.error('Erreur') }
        finally { setLoading(false); setDeleteModalOpen(false) }
    }

    // const handleReset = async () => {
    //     setLoading(true)
    //     try {
    //         toast.success('Workspace réinitialisé')
    //     } catch { toast.error('Erreur') }
    //     finally { setLoading(false); setResetModalOpen(false) }
    // }

    const handleExport = async (format: 'json' | 'excel') => {
        try {
            if (format === 'excel') {
                const { data } = await exportApi.excel({ workspaceId })
                downloadFile(data, `workspace_${workspaceId}_${new Date().toISOString().split('T')[0]}.xlsx`)
            } else {
                const { data } = await workspacesApi.exportWorkspace(workspaceId, 'json')
                downloadFile(data, `workspace_${workspaceId}_${new Date().toISOString().split('T')[0]}.json`)
            }
            toast.success('Export réussi')
        } catch { toast.error("Erreur lors de l'export") }
    }

    // ── Import JSON ───────────────────────────────────────────

    const resetImport = () => {
        setImportState({
            status: 'idle', fileName: '', fileSize: 0,
            preview: null, summary: null, error: null,
        })
    }

    const processFile = useCallback(async (file: File) => {
        setImportState(s => ({ ...s, status: 'reading', fileName: file.name, fileSize: file.size, error: null, summary: null }))

        // 1. Lire et parser le JSON
        let parsed: any
        try {
            const text = await file.text()
            parsed = JSON.parse(text)
        } catch {
            setImportState(s => ({ ...s, status: 'error', error: 'Fichier JSON invalide ou corrompu' }))
            return
        }

        // 2. Valider la structure
        if (!parsed.employees || typeof parsed.employees !== 'object') {
            setImportState(s => ({
                ...s, status: 'error',
                error: "Format non reconnu — le fichier doit contenir un champ 'employees'. Assurez-vous d'exporter depuis pc-planning.html."
            }))
            return
        }

        // 3. Calculer le preview
        const empCount = Object.keys(parsed.employees ?? {}).length
        const planCount = Object.values(parsed.planning ?? {}).reduce((acc: number, days: any) => acc + Object.keys(days).length, 0) as number
        const annotCount = Object.values(parsed.annotations ?? {}).reduce((acc: number, days: any) => acc + Object.keys(days).length, 0) as number
        const manualCount = (parsed.manualCycles ?? []).length

        setImportState(s => ({
            ...s,
            status: 'uploading',
            preview: { employees: empCount, planning: planCount, annotations: annotCount, manualCycles: manualCount },
        }))

        // 4. Envoyer à l'API
        try {
            const res = await fetch('/api/import/planning-json', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...parsed, workspace_id: workspaceId }),
            })

            const data = await res.json()

            if (!res.ok) {
                setImportState(s => ({ ...s, status: 'error', error: data.error ?? 'Erreur serveur' }))
                return
            }

            setImportState(s => ({ ...s, status: 'done', summary: data.summary }))

            if ((data.summary?.erreurs_total ?? 0) === 0) {
                toast.success(`Import réussi — ${data.summary.crees} employé(s) créé(s)`)
            } else {
                toast(`Import terminé avec ${data.summary.erreurs_total} erreur(s)`, { icon: '⚠️' })
            }

        } catch (err: any) {
            setImportState(s => ({ ...s, status: 'error', error: err.message ?? 'Erreur réseau' }))
        }
    }, [workspaceId])

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop: (files) => files[0] && processFile(files[0]),
        accept: { 'application/json': ['.json'] },
        maxFiles: 1,
        disabled: importState.status === 'reading' || importState.status === 'uploading',
        noClick: importState.status === 'done' || importState.status === 'error',
    })

    const isImporting = importState.status === 'reading' || importState.status === 'uploading'

    return (
        <AppShell workspaceName="Paramètres" onDashboardClick={() => router.push(`/workspaces/${workspaceId}`)}>
            <div className="space-y-6 max-w-3xl">
                <Button variant="ghost" onClick={() => router.back()}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Retour
                </Button>

                <div>
                    <h1 className="text-3xl font-bold">Paramètres</h1>
                    <p className="text-muted-foreground">Gérez les paramètres du workspace</p>
                </div>

                <Tabs defaultValue="general">
                    <TabsList>
                        <TabsTrigger value="general">Général</TabsTrigger>
                        <TabsTrigger value="import">Import JSON</TabsTrigger>
                        <TabsTrigger value="backup">Export</TabsTrigger>
                        <TabsTrigger value="advanced">Avancé</TabsTrigger>
                    </TabsList>

                    {/* ── GÉNÉRAL ── */}
                    <TabsContent value="general" className="mt-6 space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Informations générales</CardTitle>
                                <CardDescription>Modifier le nom et les informations du workspace</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <Label>Nom du workspace</Label>
                                    <div className="flex gap-2 mt-2">
                                        <Input
                                            value={workspaceName}
                                            onChange={e => setWorkspaceName(e.target.value)}
                                            className="flex-1"
                                        />
                                        <Button onClick={handleUpdateName} disabled={loading}>
                                            <Save className="h-4 w-4 mr-2" />
                                            Enregistrer
                                        </Button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                                    <div>
                                        <p className="text-sm text-muted-foreground">Créé le</p>
                                        <p className="font-medium">
                                            {workspace?.created_at
                                                ? new Date(workspace.created_at).toLocaleDateString('fr-FR')
                                                : '—'}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Dernière modification</p>
                                        <p className="font-medium">
                                            {workspace?.updated_at
                                                ? new Date(workspace.updated_at).toLocaleDateString('fr-FR')
                                                : '—'}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* ── IMPORT JSON ── */}
                    <TabsContent value="import" className="mt-6 space-y-6">
                        <Card>
                            <CardHeader>
                                <div className="flex items-start justify-between">
                                    <div>
                                        <CardTitle className="flex items-center gap-2">
                                            <FileJson className="h-5 w-5 text-blue-500" />
                                            Import depuis pc-planning
                                        </CardTitle>
                                        <CardDescription className="mt-1">
                                            Importez un fichier <span className="font-mono text-xs bg-slate-100 px-1 py-0.5 rounded">planning-*.json</span> exporté depuis l'application HTML
                                        </CardDescription>
                                    </div>
                                    {(importState.status === 'done' || importState.status === 'error') && (
                                        <Button variant="ghost" size="sm" onClick={resetImport} className="text-slate-500">
                                            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                                            Recommencer
                                        </Button>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">

                                {/* Zone de dépôt */}
                                {(importState.status === 'idle' || isImporting) && (
                                    <div
                                        {...getRootProps()}
                                        className={cn(
                                            'relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200',
                                            isDragActive
                                                ? 'border-blue-400 bg-blue-50 scale-[1.01]'
                                                : isImporting
                                                    ? 'border-slate-200 bg-slate-50 cursor-default'
                                                    : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50 cursor-pointer'
                                        )}
                                    >
                                        <input {...getInputProps()} />

                                        {isImporting ? (
                                            <div className="flex flex-col items-center gap-3">
                                                {/* Spinner animé */}
                                                <div className="relative w-12 h-12">
                                                    <div className="absolute inset-0 rounded-full border-4 border-slate-100" />
                                                    <div className="absolute inset-0 rounded-full border-4 border-blue-500 border-t-transparent animate-spin" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-slate-700">
                                                        {importState.status === 'reading' ? 'Lecture du fichier...' : 'Import en cours...'}
                                                    </p>
                                                    <p className="text-xs text-slate-400 mt-0.5">{importState.fileName}</p>
                                                </div>
                                                {importState.preview && (
                                                    <div className="flex gap-4 text-xs text-slate-500 bg-white rounded-lg px-4 py-2 border border-slate-100">
                                                        <span><strong className="text-slate-700">{importState.preview.employees}</strong> employés</span>
                                                        <span><strong className="text-slate-700">{importState.preview.planning.toLocaleString()}</strong> jours</span>
                                                        <span><strong className="text-slate-700">{importState.preview.annotations}</strong> annotations</span>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center gap-3">
                                                <div className={cn(
                                                    'w-12 h-12 rounded-full flex items-center justify-center transition-colors',
                                                    isDragActive ? 'bg-blue-100' : 'bg-slate-100'
                                                )}>
                                                    <Upload className={cn('h-5 w-5', isDragActive ? 'text-blue-500' : 'text-slate-400')} />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-slate-700">
                                                        {isDragActive ? 'Déposez le fichier ici' : 'Glissez ou cliquez pour importer'}
                                                    </p>
                                                    <p className="text-xs text-slate-400 mt-0.5">
                                                        Fichier <span className="font-mono">planning-*.json</span> exporté depuis pc-planning.html
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Résultat — Erreur */}
                                {importState.status === 'error' && (
                                    <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 flex gap-4">
                                        <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                                            <XCircle className="h-5 w-5 text-rose-500" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-rose-800 text-sm">Import échoué</p>
                                            <p className="text-xs text-rose-600 mt-1">{importState.error}</p>
                                        </div>
                                    </div>
                                )}

                                {/* Résultat — Succès */}
                                {importState.status === 'done' && importState.summary && (
                                    <div className="space-y-4">
                                        {/* Header résultat */}
                                        <div className={cn(
                                            'rounded-xl border p-4 flex items-center gap-3',
                                            importState.summary.erreurs_total === 0
                                                ? 'border-emerald-200 bg-emerald-50'
                                                : 'border-amber-200 bg-amber-50'
                                        )}>
                                            {importState.summary.erreurs_total === 0
                                                ? <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                                                : <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
                                            }
                                            <div>
                                                <p className={cn(
                                                    'font-medium text-sm',
                                                    importState.summary.erreurs_total === 0 ? 'text-emerald-800' : 'text-amber-800'
                                                )}>
                                                    {importState.summary.erreurs_total === 0
                                                        ? 'Import terminé avec succès'
                                                        : `Import terminé avec ${importState.summary.erreurs_total} erreur(s)`
                                                    }
                                                </p>
                                                <p className="text-xs opacity-70 mt-0.5">{importState.fileName}</p>
                                            </div>
                                        </div>

                                        {/* Stats grid */}
                                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                                            {[
                                                { icon: Users, label: 'Employés créés', value: importState.summary.crees, color: 'text-blue-600', bg: 'bg-blue-50' },
                                                { icon: Users, label: 'Déjà existants', value: importState.summary.existants, color: 'text-slate-500', bg: 'bg-slate-50' },
                                                { icon: RefreshCw, label: 'Cycles créés', value: importState.summary.cycles_crees, color: 'text-violet-600', bg: 'bg-violet-50' },
                                                { icon: CalendarDays, label: 'Jours de planning', value: importState.summary.plannings_crees, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                                                { icon: BookMarked, label: 'Annotations', value: importState.summary.annotations_crees, color: 'text-amber-600', bg: 'bg-amber-50' },
                                                { icon: XCircle, label: 'Erreurs', value: importState.summary.erreurs_total, color: 'text-rose-600', bg: 'bg-rose-50' },
                                            ].map(({ icon: Icon, label, value, color, bg }) => (
                                                <div key={label} className={cn('rounded-lg p-3 border', bg, 'border-transparent')}>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <Icon className={cn('h-3.5 w-3.5', color)} />
                                                        <span className="text-[11px] text-slate-500 font-medium uppercase tracking-wide">{label}</span>
                                                    </div>
                                                    <p className={cn('text-2xl font-bold', color)}>{value.toLocaleString()}</p>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Erreurs détaillées */}
                                        {importState.summary.erreurs.length > 0 && (
                                            <div className="rounded-lg border border-rose-100 bg-rose-50 p-3">
                                                <p className="text-xs font-semibold text-rose-700 mb-2 uppercase tracking-wide">
                                                    Détail des erreurs (max 20)
                                                </p>
                                                <div className="space-y-1 max-h-32 overflow-y-auto">
                                                    {importState.summary.erreurs.map((err, i) => (
                                                        <p key={i} className="text-[11px] font-mono text-rose-600 bg-white/60 rounded px-2 py-0.5">
                                                            {err}
                                                        </p>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Légende */}
                                {importState.status === 'idle' && (
                                    <div className="rounded-lg bg-slate-50 border border-slate-100 p-4 space-y-2">
                                        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Ce qui sera importé</p>
                                        <div className="grid grid-cols-1 gap-1.5 text-xs text-slate-600">
                                            {[
                                                { icon: '👤', text: 'Employés non existants (créés avec nom/prénom/poste/zone)' },
                                                { icon: '🔄', text: 'Cycles manuels uniquement (les cycles auto seront recalculés)' },
                                                { icon: '📅', text: 'Planning complet (P/A/R pour chaque jour)' },
                                                { icon: '🏷️', text: 'Annotations détaillées (M, J, Md, Rc, C, Ce)' },
                                            ].map(({ icon, text }) => (
                                                <div key={text} className="flex items-start gap-2">
                                                    <span className="shrink-0">{icon}</span>
                                                    <span>{text}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* ── EXPORT ── */}
                    <TabsContent value="backup" className="mt-6 space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Export des données</CardTitle>
                                <CardDescription>Télécharger une copie de vos données</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-2 gap-4">
                                    <button
                                        onClick={() => handleExport('excel')}
                                        className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 transition-all group"
                                    >
                                        <div className="w-12 h-12 rounded-xl bg-emerald-50 group-hover:bg-emerald-100 flex items-center justify-center transition-colors">
                                            <Download className="h-6 w-6 text-emerald-600" />
                                        </div>
                                        <div className="text-center">
                                            <p className="font-semibold text-sm">Excel</p>
                                            <p className="text-xs text-slate-400 mt-0.5">Planning + récapitulatif</p>
                                        </div>
                                    </button>

                                    <button
                                        onClick={() => handleExport('json')}
                                        className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-all group"
                                    >
                                        <div className="w-12 h-12 rounded-xl bg-blue-50 group-hover:bg-blue-100 flex items-center justify-center transition-colors">
                                            <Database className="h-6 w-6 text-blue-600" />
                                        </div>
                                        <div className="text-center">
                                            <p className="font-semibold text-sm">JSON</p>
                                            <p className="text-xs text-slate-400 mt-0.5">Sauvegarde complète</p>
                                        </div>
                                    </button>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* ── AVANCÉ ── */}
                    <TabsContent value="advanced" className="mt-6 space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Actions avancées</CardTitle>
                                <CardDescription>Opérations de maintenance</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200 hover:border-slate-300 transition-colors">
                                    <div>
                                        <p className="font-medium text-sm">Recalculer tous les cycles</p>
                                        <p className="text-xs text-slate-500 mt-0.5">
                                            Lancer la détection automatique pour tous les employés sans cycle manuel
                                        </p>
                                    </div>
                                    <Button variant="outline" size="sm" onClick={async () => {
                                        try {
                                            await cyclesApi.detect(workspaceId)
                                            toast.success('Détection lancée')
                                        } catch { toast.error('Erreur') }
                                    }}>
                                        <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                                        Lancer
                                    </Button>
                                </div>

                                {/* <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200 hover:border-slate-300 transition-colors">
                                    <div>
                                        <p className="font-medium text-sm">Réinitialiser le workspace</p>
                                        <p className="text-xs text-slate-500 mt-0.5">Supprimer toutes les données (irréversible)</p>
                                    </div>
                                    <Button variant="outline" size="sm" className="border-rose-200 text-rose-600 hover:bg-rose-50" onClick={() => setResetModalOpen(true)}>
                                        <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                                        Réinitialiser
                                    </Button>
                                </div> */}

                                <div className="flex items-center justify-between p-4 rounded-xl border border-rose-200 bg-rose-50/50">
                                    <div>
                                        <p className="font-medium text-sm text-rose-700">Supprimer le workspace</p>
                                        <p className="text-xs text-rose-400 mt-0.5">Action définitive et irréversible</p>
                                    </div>
                                    <Button variant="destructive" size="sm" onClick={() => setDeleteModalOpen(true)}>
                                        <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                                        Supprimer
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>

                {/* Modals */}
                <ConfirmModal
                    open={deleteModalOpen}
                    onOpenChange={setDeleteModalOpen}
                    title="Supprimer le workspace"
                    description="Êtes-vous sûr de vouloir supprimer ce workspace ? Toutes les données seront perdues définitivement."
                    confirmText="Supprimer"
                    variant="destructive"
                    onConfirm={handleDelete}
                    loading={loading}
                />
                {/* <ConfirmModal
                    open={resetModalOpen}
                    onOpenChange={setResetModalOpen}
                    title="Réinitialiser le workspace"
                    description="Êtes-vous sûr de vouloir supprimer toutes les données de ce workspace ?"
                    confirmText="Réinitialiser"
                    variant="destructive"
                    onConfirm={handleReset}
                    loading={loading}
                /> */}
            </div>
        </AppShell>
    )
}
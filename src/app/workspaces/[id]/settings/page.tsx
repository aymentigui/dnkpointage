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
    BookMarked, RotateCcw, PackageOpen,
} from 'lucide-react'
import { workspacesApi, exportApi, cyclesApi } from '@/lib/api'
import { ConfirmModal } from '@/components/modals/ConfirmModal'
import { useDropzone } from 'react-dropzone'
import { toast } from 'react-hot-toast'
import { downloadFile, cn } from '@/lib/utils'
import { importWorkspace } from '@/actions/workspace/import'

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

interface WorkspaceImportState {
    status: 'idle' | 'reading' | 'uploading' | 'done' | 'error'
    fileName: string
    preview: { employees: number } | null
    result: {
        workspace_id: string
        employees_imported: number
        pointages_imported: number
        plannings_imported: number
        annotations_imported: number
        cycles_imported: number
        histories_imported: number
        errors: string[]
    } | null
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

    const [importState, setImportState] = useState<ImportState>({
        status: 'idle', fileName: '', fileSize: 0,
        preview: null, summary: null, error: null,
    })

    const [wsImportState, setWsImportState] = useState<WorkspaceImportState>({
        status: 'idle', fileName: '', preview: null, result: null, error: null,
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

    const handleExport = async () => {
        try {
            const { data } = await workspacesApi.exportWorkspace(workspaceId, 'json')
            downloadFile(data, `workspace_${workspaceId}_${new Date().toISOString().split('T')[0]}.json`)
            toast.success('Export réussi')
        } catch { toast.error("Erreur lors de l'export") }
    }

    // ── Import pc-planning JSON ───────────────────────────────

    const resetImport = () => setImportState({
        status: 'idle', fileName: '', fileSize: 0,
        preview: null, summary: null, error: null,
    })

    const processFile = useCallback(async (file: File) => {
        setImportState(s => ({ ...s, status: 'reading', fileName: file.name, fileSize: file.size, error: null, summary: null }))

        let parsed: any
        try {
            parsed = JSON.parse(await file.text())
        } catch {
            setImportState(s => ({ ...s, status: 'error', error: 'Fichier JSON invalide ou corrompu' }))
            return
        }

        if (!parsed.employees || typeof parsed.employees !== 'object') {
            setImportState(s => ({
                ...s, status: 'error',
                error: "Format non reconnu — le fichier doit contenir un champ 'employees'. Assurez-vous d'exporter depuis pc-planning.html."
            }))
            return
        }

        const empCount = Object.keys(parsed.employees ?? {}).length
        const planCount = Object.values(parsed.planning ?? {}).reduce((acc: number, days: any) => acc + Object.keys(days).length, 0) as number
        const annotCount = Object.values(parsed.annotations ?? {}).reduce((acc: number, days: any) => acc + Object.keys(days).length, 0) as number
        const manualCount = (parsed.manualCycles ?? []).length

        setImportState(s => ({
            ...s, status: 'uploading',
            preview: { employees: empCount, planning: planCount, annotations: annotCount, manualCycles: manualCount },
        }))

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

    // ── Import workspace backup — fetch direct, pas axios ─────

    const resetWsImport = () => setWsImportState({
        status: 'idle', fileName: '', preview: null, result: null, error: null,
    })

    const processWorkspaceFile = useCallback(async (file: File) => {
        setWsImportState(s => ({ ...s, status: 'reading', fileName: file.name, error: null, result: null }))

        // 1. Lire le fichier une seule fois
        let parsed: any
        try {
            const fileContent = await file.text()
            parsed = JSON.parse(fileContent)
        } catch {
            setWsImportState(s => ({ ...s, status: 'error', error: 'Fichier JSON invalide ou corrompu' }))
            return
        }

        // 2. Valider le format
        if (!parsed.workspace || !Array.isArray(parsed.employees)) {
            setWsImportState(s => ({
                ...s, status: 'error',
                error: "Format non reconnu — ce fichier ne semble pas être une sauvegarde workspace. Utilisez un fichier exporté depuis l'onglet Export."
            }))
            return
        }

        // 3. Afficher la preview
        setWsImportState(s => ({
            ...s, status: 'uploading',
            preview: { employees: parsed.employees.length },
        }))
        // 4. Envoyer le contenu parsé directement (pas besoin de refaire FormData)
        try {
            const formData = new FormData();
            formData.append('file', file); // On envoie le fichier direct

            // On appelle l'action avec le FormData
            const res = await importWorkspace(formData, workspaceId);

            if (res.status !== 200) {
                setWsImportState(s => ({ ...s, status: 'error', error: res.data.error ?? 'Erreur serveur' }))
                return
            }

            // @ts-ignore
            setWsImportState(s => ({ ...s, status: 'done', result: res.data.summary }))

            if (res.status === 200 && res.data) {
                toast(`Import terminé avec ${res.data.error?.length ?? 0} erreur(s)`, { icon: '⚠️' })
            }
        } catch (err: any) {
            setWsImportState(s => ({ ...s, status: 'error', error: err.message ?? 'Erreur réseau' }))
        }
    }, [])

    const {
        getRootProps: getWsRootProps,
        getInputProps: getWsInputProps,
        isDragActive: isWsDragActive,
    } = useDropzone({
        onDrop: (files) => files[0] && processWorkspaceFile(files[0]),
        accept: { 'application/json': ['.json'] },
        maxFiles: 1,
        disabled: wsImportState.status === 'reading' || wsImportState.status === 'uploading',
        noClick: wsImportState.status === 'done' || wsImportState.status === 'error',
    })

    const isImporting = importState.status === 'reading' || importState.status === 'uploading'
    const isWsImporting = wsImportState.status === 'reading' || wsImportState.status === 'uploading'

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
                        <TabsTrigger value="backup">Export / Restauration</TabsTrigger>
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
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* ── IMPORT JSON (pc-planning HTML) ── */}
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

                                {importState.status === 'done' && importState.summary && (
                                    <div className="space-y-4">
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
                                                        : `Import terminé avec ${importState.summary.erreurs_total} erreur(s)`}
                                                </p>
                                                <p className="text-xs opacity-70 mt-0.5">{importState.fileName}</p>
                                            </div>
                                        </div>
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
                                        {importState.summary.erreurs.length > 0 && (
                                            <div className="rounded-lg border border-rose-100 bg-rose-50 p-3">
                                                <p className="text-xs font-semibold text-rose-700 mb-2 uppercase tracking-wide">Détail des erreurs (max 20)</p>
                                                <div className="space-y-1 max-h-32 overflow-y-auto">
                                                    {importState.summary.erreurs.map((err, i) => (
                                                        <p key={i} className="text-[11px] font-mono text-rose-600 bg-white/60 rounded px-2 py-0.5">{err}</p>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

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

                    {/* ── EXPORT / RESTAURATION ── */}
                    <TabsContent value="backup" className="mt-6 space-y-6">

                        {/* Export */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Database className="h-5 w-5 text-blue-500" />
                                    Exporter le workspace
                                </CardTitle>
                                <CardDescription>Télécharger une sauvegarde complète du workspace</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <button
                                    onClick={handleExport}
                                    className="w-full flex items-center gap-4 p-5 rounded-xl border-2 border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-all group text-left"
                                >
                                    <div className="w-11 h-11 rounded-xl bg-blue-50 group-hover:bg-blue-100 flex items-center justify-center transition-colors shrink-0">
                                        <Download className="h-5 w-5 text-blue-600" />
                                    </div>
                                    <div>
                                        <p className="font-semibold text-sm">Sauvegarde JSON</p>
                                        <p className="text-xs text-slate-400 mt-0.5">
                                            Employés, pointages, plannings, annotations, cycles et historique
                                        </p>
                                    </div>
                                </button>
                            </CardContent>
                        </Card>

                        {/* Import workspace backup */}
                        <Card>
                            <CardHeader>
                                <div className="flex items-start justify-between">
                                    <div>
                                        <CardTitle className="flex items-center gap-2">
                                            <PackageOpen className="h-5 w-5 text-violet-500" />
                                            Restaurer depuis une sauvegarde
                                        </CardTitle>
                                        <CardDescription className="mt-1">
                                            Importez un fichier <span className="font-mono text-xs bg-slate-100 px-1 py-0.5 rounded">workspace_*.json</span> exporté depuis cette application.
                                            Un nouveau workspace sera créé.
                                        </CardDescription>
                                    </div>
                                    {(wsImportState.status === 'done' || wsImportState.status === 'error') && (
                                        <Button variant="ghost" size="sm" onClick={resetWsImport} className="text-slate-500">
                                            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                                            Recommencer
                                        </Button>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">

                                {(wsImportState.status === 'idle' || isWsImporting) && (
                                    <div
                                        {...getWsRootProps()}
                                        className={cn(
                                            'relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200',
                                            isWsDragActive
                                                ? 'border-violet-400 bg-violet-50 scale-[1.01]'
                                                : isWsImporting
                                                    ? 'border-slate-200 bg-slate-50 cursor-default'
                                                    : 'border-slate-200 hover:border-violet-300 hover:bg-slate-50 cursor-pointer'
                                        )}
                                    >
                                        <input {...getWsInputProps()} />
                                        {isWsImporting ? (
                                            <div className="flex flex-col items-center gap-3">
                                                <div className="relative w-12 h-12">
                                                    <div className="absolute inset-0 rounded-full border-4 border-slate-100" />
                                                    <div className="absolute inset-0 rounded-full border-4 border-violet-500 border-t-transparent animate-spin" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-slate-700">
                                                        {wsImportState.status === 'reading' ? 'Lecture du fichier...' : 'Restauration en cours...'}
                                                    </p>
                                                    <p className="text-xs text-slate-400 mt-0.5">{wsImportState.fileName}</p>
                                                </div>
                                                {wsImportState.preview && (
                                                    <div className="flex gap-4 text-xs text-slate-500 bg-white rounded-lg px-4 py-2 border border-slate-100">
                                                        <span><strong className="text-slate-700">{wsImportState.preview.employees}</strong> employés détectés</span>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center gap-3">
                                                <div className={cn(
                                                    'w-12 h-12 rounded-full flex items-center justify-center transition-colors',
                                                    isWsDragActive ? 'bg-violet-100' : 'bg-slate-100'
                                                )}>
                                                    <Upload className={cn('h-5 w-5', isWsDragActive ? 'text-violet-500' : 'text-slate-400')} />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-slate-700">
                                                        {isWsDragActive ? 'Déposez le fichier ici' : 'Glissez ou cliquez pour restaurer'}
                                                    </p>
                                                    <p className="text-xs text-slate-400 mt-0.5">
                                                        Fichier <span className="font-mono">workspace_*.json</span> exporté depuis cette application
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {wsImportState.status === 'error' && (
                                    <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 flex gap-4">
                                        <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                                            <XCircle className="h-5 w-5 text-rose-500" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-rose-800 text-sm">Restauration échouée</p>
                                            <p className="text-xs text-rose-600 mt-1">{wsImportState.error}</p>
                                        </div>
                                    </div>
                                )}

                                {wsImportState.status === 'done' && wsImportState.result && (
                                    <div className="space-y-4">
                                        <div className={cn(
                                            'rounded-xl border p-4 flex items-center gap-3',
                                            wsImportState.result.errors.length === 0
                                                ? 'border-emerald-200 bg-emerald-50'
                                                : 'border-amber-200 bg-amber-50'
                                        )}>
                                            {wsImportState.result.errors.length === 0
                                                ? <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                                                : <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
                                            }
                                            <div>
                                                <p className={cn(
                                                    'font-medium text-sm',
                                                    wsImportState.result.errors.length === 0 ? 'text-emerald-800' : 'text-amber-800'
                                                )}>
                                                    {wsImportState.result.errors.length === 0
                                                        ? 'Workspace restauré avec succès'
                                                        : `Restauration terminée avec ${wsImportState.result.errors.length} erreur(s)`}
                                                </p>
                                                <p className="text-xs opacity-70 mt-0.5">{wsImportState.fileName}</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                                            {[
                                                { icon: Users, label: 'Employés', value: wsImportState.result.employees_imported, color: 'text-blue-600', bg: 'bg-blue-50' },
                                                { icon: CalendarDays, label: 'Pointages', value: wsImportState.result.pointages_imported, color: 'text-slate-600', bg: 'bg-slate-50' },
                                                { icon: CalendarDays, label: 'Plannings', value: wsImportState.result.plannings_imported, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                                                { icon: BookMarked, label: 'Annotations', value: wsImportState.result.annotations_imported, color: 'text-amber-600', bg: 'bg-amber-50' },
                                                { icon: RefreshCw, label: 'Cycles', value: wsImportState.result.cycles_imported, color: 'text-violet-600', bg: 'bg-violet-50' },
                                                { icon: XCircle, label: 'Erreurs', value: wsImportState.result.errors.length, color: 'text-rose-600', bg: 'bg-rose-50' },
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

                                        {wsImportState.result.errors.length > 0 && (
                                            <div className="rounded-lg border border-rose-100 bg-rose-50 p-3">
                                                <p className="text-xs font-semibold text-rose-700 mb-2 uppercase tracking-wide">Détail des erreurs</p>
                                                <div className="space-y-1 max-h-32 overflow-y-auto">
                                                    {wsImportState.result.errors.map((err, i) => (
                                                        <p key={i} className="text-[11px] font-mono text-rose-600 bg-white/60 rounded px-2 py-0.5">{err}</p>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        <Button
                                            className="w-full"
                                            onClick={() => router.push(`/workspaces/${wsImportState.result!.workspace_id}`)}
                                        >
                                            Ouvrir le workspace restauré →
                                        </Button>
                                    </div>
                                )}

                                {wsImportState.status === 'idle' && (
                                    <div className="rounded-lg bg-amber-50 border border-amber-100 p-4 flex gap-3">
                                        <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                                        <p className="text-xs text-amber-700">
                                            L'import crée un <strong>nouveau workspace indépendant</strong>. Vos données actuelles ne seront pas affectées.
                                        </p>
                                    </div>
                                )}
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
            </div>
        </AppShell>
    )
}
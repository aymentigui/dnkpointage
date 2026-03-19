'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { AppShell } from '@/components/layout/AppShell'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
    Users,
    Calendar,
    AlertTriangle,
    Download,
    Upload,
    RefreshCw,
    BarChart3,
    FileText,
    Settings,
    History,
    Clock,
    CheckCircle2,
    XCircle,
    LogOut
} from 'lucide-react'
import { workspacesApi, employeesApi, planningApi, cyclesApi, historyApi } from '@/lib/api'
import { downloadFile } from '@/lib/utils'
import { toast } from 'react-hot-toast'
import Link from 'next/link'
import { logoutUser } from '@/actions/auth/auth'

export default function WorkspaceDetailPage() {
    const params = useParams()
    const router = useRouter()
    const workspaceId = params.id as string

    const [workspace, setWorkspace] = useState<any>(null)
    const [stats, setStats] = useState<any>(null)
    const [recentHistory, setRecentHistory] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [detecting, setDetecting] = useState(false)
    const [activeTab, setActiveTab] = useState('apercu')

    const logout = async () => {
        const response = await logoutUser();
        if (response.status === 200) {
            window.location.href = '/auth/login';
        }
    };

    useEffect(() => {
        loadWorkspaceData()
    }, [workspaceId])

    const loadWorkspaceData = async () => {
        try {
            const [wsRes, historyRes] = await Promise.all([
                workspacesApi.get(workspaceId),
                historyApi.getAll({ limit: 10 })
            ])

            setWorkspace(wsRes.data)
            setRecentHistory(historyRes.data.data || [])

            // Récupérer les stats via employees
            const employeesRes = await employeesApi.getAll({ limit: 100000, workspace_id: workspaceId })
            setStats({
                totalEmployes: employeesRes.data.data.length || 0,
                totalJours: wsRes.data.daysCount || 0,
            })
        } catch (error) {
            toast.error('Erreur lors du chargement')
        } finally {
            setLoading(false)
        }
    }

    const handleDetectCycles = async () => {
        setDetecting(true)
        try {
            const { data } = await cyclesApi.detect(workspaceId)
            toast.success(`Détection terminée: ${data.results?.length || 0} cycles détectés`)
            await loadWorkspaceData()
        } catch (error) {
            toast.error('Erreur lors de la détection')
        } finally {
            setDetecting(false)
        }
    }

    const handleExport = async (format: 'json' | 'excel') => {
        try {
            const { data } = await workspacesApi.exportWorkspace(workspaceId, format)
            const filename = `workspace_${workspace?.nom}_${new Date().toISOString().split('T')[0]}.${format}`
            downloadFile(data, filename)
            toast.success(`Export ${format.toUpperCase()} réussi`)
        } catch (error) {
            toast.error("Erreur lors de l'export")
        }
    }

    const handleSetCurrent = async () => {
        try {
            await workspacesApi.setCurrent(workspaceId)
            toast.success('Workspace actif défini')
        } catch (error) {
            toast.error('Erreur')
        }
    }

    if (loading) {
        return (
            <AppShell workspaceName="Chargement...">
                <div className="space-y-6">
                    <Skeleton className="h-8 w-[250px]" />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {[1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}
                    </div>
                </div>
            </AppShell>
        )
    }

    return (
        <AppShell workspaceName={workspace?.nom} onDashboardClick={() => router.push('/workspaces')}>
            <div className="space-y-6">
                {/* Header avec actions */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold">{workspace?.nom}</h1>
                        <p className="text-muted-foreground">
                            Créé le {new Date(workspace?.createdAt).toLocaleDateString('fr-FR')}
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button variant="outline" onClick={handleSetCurrent}>
                            <CheckCircle2 className="h-4 w-4 mr-2" />
                            Définir actif
                        </Button>
                        <Button variant="outline" onClick={handleDetectCycles} disabled={detecting}>
                            <RefreshCw className={`h-4 w-4 mr-2 ${detecting ? 'animate-spin' : ''}`} />
                            Détecter cycles
                        </Button>
                    </div>
                </div>

                {/* Tabs */}
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="grid w-full max-w-2xl grid-cols-3">
                        <TabsTrigger value="apercu">Aperçu</TabsTrigger>
                        <TabsTrigger value="import">Import</TabsTrigger>
                        <TabsTrigger value="export">Export</TabsTrigger>
                        {/* <TabsTrigger value="historique">Historique</TabsTrigger> */}
                        {/* <TabsTrigger value="parametres">Paramètres</TabsTrigger> */}
                    </TabsList>

                    {/* TAB 1: Aperçu */}
                    <TabsContent value="apercu" className="mt-6 space-y-6">
                        {/* Stats Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
                                        <Users className="h-4 w-4 mr-1" /> Employés
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">{stats?.totalEmployes || 0}</div>
                                    <Progress value={65} className="mt-2" />
                                </CardContent>
                            </Card>

                            {/* <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
                                        <Calendar className="h-4 w-4 mr-1" /> Jours
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">{stats?.totalJours || 0}</div>
                                    <p className="text-xs text-muted-foreground mt-1">Période analysée</p>
                                </CardContent>
                            </Card> */}
                            {/* 
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
                                        <Clock className="h-4 w-4 mr-1" /> Dernière activité
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-sm font-medium">
                                        {workspace?.savedAt
                                            ? new Date(workspace.savedAt).toLocaleString('fr-FR')
                                            : 'Jamais'}
                                    </div>
                                </CardContent>
                            </Card> */}

                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
                                        <History className="h-4 w-4 mr-1" /> Modifications
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">{recentHistory.length}</div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Quick Actions Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <Link href={`/workspaces/${workspaceId}/import`}>
                                <Card className="hover:bg-accent/50 cursor-pointer transition-colors">
                                    <CardContent className="flex flex-col items-center justify-center py-6">
                                        <Upload className="h-8 w-8 mb-2 text-primary" />
                                        <p className="font-medium">Importer</p>
                                        <p className="text-xs text-muted-foreground">Excel pointages</p>
                                    </CardContent>
                                </Card>
                            </Link>

                            <Link href={`/workspaces/${workspaceId}/export`}>
                                <Card className="hover:bg-accent/50 cursor-pointer transition-colors">
                                    <CardContent className="flex flex-col items-center justify-center py-6">
                                        <Download className="h-8 w-8 mb-2 text-primary" />
                                        <p className="font-medium">Exporter</p>
                                        <p className="text-xs text-muted-foreground">Excel/JSON</p>
                                    </CardContent>
                                </Card>
                            </Link>

                            <Link href={`/workspaces/${workspaceId}/employees`}>
                                <Card className="hover:bg-accent/50 cursor-pointer transition-colors">
                                    <CardContent className="flex flex-col items-center justify-center py-6">
                                        <Users className="h-8 w-8 mb-2 text-primary" />
                                        <p className="font-medium">Employés</p>
                                        <p className="text-xs text-muted-foreground">Liste & filtres</p>
                                    </CardContent>
                                </Card>
                            </Link>

                            <Link href={`/workspaces/${workspaceId}/planning`}>
                                <Card className="hover:bg-accent/50 cursor-pointer transition-colors">
                                    <CardContent className="flex flex-col items-center justify-center py-6">
                                        <Calendar className="h-8 w-8 mb-2 text-primary" />
                                        <p className="font-medium">Planning</p>
                                        <p className="text-xs text-muted-foreground">Tableau de présence</p>
                                    </CardContent>
                                </Card>
                            </Link>
                            <Card onClick={logout} className="hover:bg-accent/50 cursor-pointer transition-colors">
                                <CardContent className="flex flex-col items-center justify-center py-6">
                                    <LogOut className="h-8 w-8 mb-2 text-primary" />
                                    <p className="font-medium">Déconnexion</p>
                                    <p className="text-xs text-muted-foreground">Déconnexion de l'application</p>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Recent Activity */}
                        {/* <Card>
                            <CardHeader>
                                <CardTitle>Activité récente</CardTitle>
                                <CardDescription>
                                    Dernières actions dans ce workspace
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {recentHistory.length > 0 ? (
                                        recentHistory.map((item: any, idx: number) => (
                                            <div key={idx} className="flex items-center gap-4">
                                                <Badge variant="outline">
                                                    {item.typeModification === 'base' ? '📝' :
                                                        item.typeModification === 'annotation' ? '🏷️' : '🔄'}
                                                </Badge>
                                                <div className="flex-1">
                                                    <p className="text-sm">{item.description || 'Modification'}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {new Date(item.createdAt).toLocaleString('fr-FR')}
                                                    </p>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-center py-4 text-muted-foreground">
                                            Aucune activité récente
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card> */}

                        {/* Alert if no data */}
                        {(!workspace?.savedAt && stats?.totalEmployes === 0) && (
                            <Alert>
                                <AlertTriangle className="h-4 w-4" />
                                <AlertTitle>Workspace vide</AlertTitle>
                                <AlertDescription>
                                    Ce workspace ne contient aucune donnée.
                                    <Button variant="link" className="px-1" asChild>
                                        <Link href={`/workspaces/${workspaceId}/import`}>
                                            Importez un fichier Excel
                                        </Link>
                                    </Button>
                                    pour commencer.
                                </AlertDescription>
                            </Alert>
                        )}
                    </TabsContent>

                    {/* TAB 2: Import */}
                    <TabsContent value="import" className="mt-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Import de données</CardTitle>
                                <CardDescription>
                                    Choisissez le type de fichier à importer
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Link href={`/workspaces/${workspaceId}/import?type=pointages`}>
                                        <Card className="hover:bg-accent/50 cursor-pointer">
                                            <CardContent className="flex flex-col items-center py-6">
                                                <FileText className="h-12 w-12 mb-2 text-primary" />
                                                <p className="font-medium">Pointages</p>
                                                <p className="text-xs text-muted-foreground">Excel (Matricule, Date, Entrée, Sortie)</p>
                                            </CardContent>
                                        </Card>
                                    </Link>
                                    <Link href={`/workspaces/${workspaceId}/import?type=staff`}>
                                        <Card className="hover:bg-accent/50 cursor-pointer">
                                            <CardContent className="flex flex-col items-center py-6">
                                                <Users className="h-12 w-12 mb-2 text-primary" />
                                                <p className="font-medium">Base personnel</p>
                                                <p className="text-xs text-muted-foreground">Excel (Matricule, Nom, Prénom, Poste, Zone)</p>
                                            </CardContent>
                                        </Card>
                                    </Link>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* TAB 3: Export */}
                    <TabsContent value="export" className="mt-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Export de données</CardTitle>
                                <CardDescription>
                                    Téléchargez les données du workspace
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Card className="hover:bg-accent/50 cursor-pointer" onClick={() => handleExport('excel')}>
                                        <CardContent className="flex flex-col items-center py-6">
                                            <Download className="h-12 w-12 mb-2 text-primary" />
                                            <p className="font-medium">Export Excel</p>
                                            <p className="text-xs text-muted-foreground">Planning + Récapitulatif + Annotations</p>
                                        </CardContent>
                                    </Card>
                                    <Card className="hover:bg-accent/50 cursor-pointer" onClick={() => handleExport('json')}>
                                        <CardContent className="flex flex-col items-center py-6">
                                            <FileText className="h-12 w-12 mb-2 text-primary" />
                                            <p className="font-medium">Export JSON</p>
                                            <p className="text-xs text-muted-foreground">Sauvegarde complète</p>
                                        </CardContent>
                                    </Card>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* TAB 4: Historique */}
                    {/* <TabsContent value="historique" className="mt-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Historique des modifications</CardTitle>
                                <CardDescription>
                                    Toutes les actions effectuées
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2 max-h-96 overflow-y-auto">
                                    {recentHistory.map((item: any, idx: number) => (
                                        <div key={idx} className="flex items-center justify-between p-2 border rounded">
                                            <div>
                                                <p className="text-sm font-medium">{item.description || 'Modification'}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {new Date(item.createdAt).toLocaleString('fr-FR')}
                                                </p>
                                            </div>
                                            <Badge>{item.typeModification}</Badge>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent> */}

                    {/* TAB 5: Paramètres */}
                    {/* <TabsContent value="parametres" className="mt-6">
                        <Card className="border-destructive">
                            <CardHeader>
                                <CardTitle className="text-destructive">Zone dangereuse</CardTitle>
                                <CardDescription>
                                    Actions irréversibles
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center justify-between p-4 border rounded">
                                    <div>
                                        <p className="font-medium">Réinitialiser le workspace</p>
                                        <p className="text-sm text-muted-foreground">
                                            Supprimer toutes les données et recommencer à zéro
                                        </p>
                                    </div>
                                    <Button variant="destructive" onClick={async () => {
                                        if (confirm('Êtes-vous sûr ? Cette action est irréversible.')) {
                                            try {
                                                await workspacesApi.delete(workspaceId)
                                                toast.success('Workspace supprimé')
                                                router.push('/workspaces')
                                            } catch {
                                                toast.error('Erreur')
                                            }
                                        }
                                    }}>
                                        <XCircle className="h-4 w-4 mr-2" />
                                        Supprimer
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent> */}
                </Tabs>
            </div>
        </AppShell>
    )
}
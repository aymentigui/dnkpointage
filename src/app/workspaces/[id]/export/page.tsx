'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { AppShell } from '@/components/layout/AppShell'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Download, FileSpreadsheet, FileJson, ArrowLeft, Loader2 } from 'lucide-react'
import { workspacesApi, exportApi } from '@/lib/api'
import { downloadFile } from '@/lib/utils'
import { toast } from 'react-hot-toast'

export default function ExportPage() {
    const params = useParams()
    const router = useRouter()
    const workspaceId = params.id as string

    const [exporting, setExporting] = useState<string | null>(null)

    const handleExport = async (format: 'excel' | 'json') => {
        setExporting(format)
        try {
            if (format === 'excel') {
                const { data } = await exportApi.excel({ workspaceId })
                downloadFile(data, `planning_${new Date().toISOString().split('T')[0]}.xlsx`)
            } else {
                const { data } = await workspacesApi.exportWorkspace(workspaceId, 'json')
                downloadFile(data, `workspace_${workspaceId}_${new Date().toISOString().split('T')[0]}.json`)
            }
            toast.success(`Export ${format.toUpperCase()} réussi`)
        } catch (error) {
            toast.error(`Erreur lors de l'export ${format}`)
        } finally {
            setExporting(null)
        }
    }

    return (
        <AppShell workspaceName="Export" onDashboardClick={() => router.push(`/workspaces/${workspaceId}`)}>
            <div className="space-y-6">
                <Button variant="ghost" onClick={() => router.back()} className="w-fit">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Retour
                </Button>

                <div>
                    <h1 className="text-3xl font-bold">Export de données</h1>
                    <p className="text-muted-foreground">
                        Téléchargez les données du workspace
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="hover:shadow-lg transition-shadow">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <FileSpreadsheet className="h-5 w-5 text-green-500" />
                                Export Excel
                            </CardTitle>
                            <CardDescription>
                                Planning complet avec plusieurs feuilles :
                                <ul className="list-disc list-inside mt-2 text-sm">
                                    <li>Planning détaillé</li>
                                    <li>Récapitulatif par employé</li>
                                    <li>Annotations</li>
                                    <li>Résumé des absences</li>
                                </ul>
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button
                                className="w-full"
                                onClick={() => handleExport('excel')}
                                disabled={exporting !== null}
                            >
                                {exporting === 'excel' ? (
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                    <Download className="h-4 w-4 mr-2" />
                                )}
                                Télécharger Excel
                            </Button>
                        </CardContent>
                    </Card>

                    <Card className="hover:shadow-lg transition-shadow">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <FileJson className="h-5 w-5 text-blue-500" />
                                Export JSON
                            </CardTitle>
                            <CardDescription>
                                Sauvegarde complète au format JSON :
                                <ul className="list-disc list-inside mt-2 text-sm">
                                    <li>Tous les employés</li>
                                    <li>Cycles détectés</li>
                                    <li>Annotations</li>
                                    <li>Planning complet</li>
                                </ul>
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button
                                className="w-full"
                                variant="outline"
                                onClick={() => handleExport('json')}
                                disabled={exporting !== null}
                            >
                                {exporting === 'json' ? (
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                    <Download className="h-4 w-4 mr-2" />
                                )}
                                Télécharger JSON
                            </Button>
                        </CardContent>
                    </Card>
                </div>

                <Alert>
                    <AlertDescription>
                        Les exports incluent toutes les données du workspace.
                        Pour une période spécifique, utilisez les filtres dans la vue planning.
                    </AlertDescription>
                </Alert>
            </div>
        </AppShell>
    )
}
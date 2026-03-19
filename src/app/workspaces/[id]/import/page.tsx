'use client'

import { useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { AppShell } from '@/components/layout/AppShell'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Upload, FileSpreadsheet, Users, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react'
import { useDropzone } from 'react-dropzone'
import { importApi } from '@/lib/api'
import { formatBytes } from '@/lib/utils'
import { toast } from 'react-hot-toast'

export default function ImportPage() {
    const params = useParams()
    const router = useRouter()
    const searchParams = useSearchParams()
    const workspaceId = params.id as string
    const importType = searchParams.get('type') || 'pointages'

    const [uploading, setUploading] = useState(false)
    const [result, setResult] = useState<any>(null)
    const [fileInfo, setFileInfo] = useState<{ name: string; size: number } | null>(null)

    const onDrop = async (acceptedFiles: File[]) => {
        const file = acceptedFiles[0]
        if (!file) return

        setFileInfo({ name: file.name, size: file.size })
        setUploading(true)
        setResult(null)

        try {
            const { data } = await importApi.uploadExcel(
                file,
                'fusion',
                importType,
                workspaceId
            )

            setResult({ success: true, data })
            toast.success('Import réussi')
        } catch (error) {
            setResult({ success: false, error: (error as any).response?.data?.error || 'Erreur inconnue' })
            toast.error('Erreur lors de l\'import')
        } finally {
            setUploading(false)
        }
    }

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
            'application/vnd.ms-excel': ['.xls']
        },
        maxFiles: 1,
        disabled: uploading
    })

    const titles = {
        pointages: { icon: FileSpreadsheet, title: 'Import des pointages', desc: 'Format: Matricule, Date, Heure entrée, Heure sortie' },
        staff: { icon: Users, title: 'Import base personnel', desc: 'Format: Matricule, Nom, Prénom, Poste, Zone' }
    }

    const current = titles[importType as keyof typeof titles] || titles.pointages
    const Icon = current.icon

    return (
        <AppShell workspaceName="Import" onDashboardClick={() => router.push(`/workspaces/${workspaceId}`)}>
            <div className="space-y-6">
                <Button variant="ghost" onClick={() => router.back()} className="w-fit">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Retour
                </Button>

                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-2">
                        <Icon className="h-8 w-8" />
                        {current.title}
                    </h1>
                    <p className="text-muted-foreground">{current.desc}</p>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Sélectionner un fichier</CardTitle>
                        <CardDescription>
                            Glissez-déposez ou cliquez pour choisir un fichier Excel
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div
                            {...getRootProps()}
                            className={`
                border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
                transition-colors
                ${isDragActive ? 'border-primary bg-primary/5' : 'border-border'}
                ${uploading ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary'}
              `}
                        >
                            <input {...getInputProps()} />
                            <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />

                            {isDragActive ? (
                                <p className="text-lg">Déposez le fichier ici...</p>
                            ) : uploading ? (
                                <div>
                                    <p className="text-lg font-medium">Upload en cours...</p>
                                    {fileInfo && (
                                        <p className="text-sm text-muted-foreground">
                                            {fileInfo.name} ({formatBytes(fileInfo.size)})
                                        </p>
                                    )}
                                </div>
                            ) : (
                                <div>
                                    <p className="text-lg font-medium mb-1">
                                        Glissez ou cliquez pour importer
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        .xlsx ou .xls
                                    </p>
                                </div>
                            )}
                        </div>

                        {result?.success && (
                            <Alert className="mt-4 bg-green-500/10 border-green-500">
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                                <AlertDescription>
                                    Import terminé avec succès<br />
                                    {result.data.stats && (
                                        <span className="text-sm">
                                            ✓ {result.data.stats.nouveaux || 0} nouveaux ·
                                            ↻ {result.data.stats.misAJour || 0} mis à jour ·
                                            ⚠ {result.data.stats.ignores || 0} ignorés
                                        </span>
                                    )}
                                </AlertDescription>
                            </Alert>
                        )}

                        {result?.success === false && (
                            <Alert className="mt-4 bg-destructive/10 border-destructive">
                                <AlertCircle className="h-4 w-4 text-destructive" />
                                <AlertDescription>
                                    Erreur: {result.error}
                                </AlertDescription>
                            </Alert>
                        )}
                    </CardContent>
                </Card>
            </div>
        </AppShell>
    )
}
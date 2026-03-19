'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/layout/AppShell'
import { DashboardGrid } from '@/components/layout/DashboardGrid'
import { workspacesApi } from '@/lib/api'
import toast from 'react-hot-toast'
import { useWorkspace } from '@/hooks/use-workspace'

export default function WorkspacesPage() {
    const router = useRouter()
    const [workspaces, setWorkspaces] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const { setWorkspaceId } = useWorkspace();

    useEffect(() => {
        loadWorkspaces()
    }, [])

    const loadWorkspaces = async () => {
        try {
            const { data } = await workspacesApi.getAll()
            setWorkspaces(data)
        } catch (error) {
            toast.error('Erreur lors du chargement des workspaces')
        } finally {
            setLoading(false)
        }
    }

    const handleCreateNew = () => {
        const name = prompt('Nom du workspace:')
        if (name?.trim()) {
            workspacesApi.create({ nom: name })
                .then(({ data }) => {
                    toast.success('Workspace créé')
                    loadWorkspaces()
                })
                .catch(() => toast.error('Erreur lors de la création'))
        }
    }

    const handleOpen = (id: string) => {
        setWorkspaceId(id);
        router.push(`/workspaces/${id}`)
    }

    const handleRename = async (id: string) => {
        const ws = workspaces.find((w: any) => w.id === id)
        const name = prompt('Nouveau nom:', ws?.nom)
        if (name?.trim() && name !== ws?.nom) {
            try {
                await workspacesApi.update(id, { nom: name })
                toast.success('Workspace renommé')
                loadWorkspaces()
            } catch {
                toast.error('Erreur lors du renommage')
            }
        }
    }

    const handleDelete = async (id: string) => {
        if (confirm('Supprimer ce workspace ?')) {
            try {
                await workspacesApi.delete(id)
                toast.success('Workspace supprimé')
                loadWorkspaces()
            } catch {
                toast.error('Erreur lors de la suppression')
            }
        }
    }

    if (loading) {
        return (
            <AppShell>
                <div className="flex items-center justify-center h-64">
                    <p>Chargement...</p>
                </div>
            </AppShell>
        )
    }

    return (
        <AppShell showSidebar={false} onDashboardClick={() => router.push('/workspaces')}>
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold">Workspaces</h1>
                    <p className="text-muted-foreground">
                        Gérez vos espaces de travail
                    </p>
                </div>

                <DashboardGrid
                    workspaces={workspaces}
                    onCreateNew={handleCreateNew}
                    onOpen={handleOpen}
                    onRename={handleRename}
                    onDelete={handleDelete}
                />
            </div>
        </AppShell>
    )
}
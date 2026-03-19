'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Folder, MoreVertical } from 'lucide-react'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface Workspace {
    id: string
    nom: string
    empCount?: number
    daysCount?: number
    savedAt?: string
}

interface DashboardGridProps {
    workspaces: Workspace[]
    onCreateNew: () => void
    onOpen: (id: string) => void
    onRename: (id: string) => void
    onDelete: (id: string) => void
}

export function DashboardGrid({
    workspaces,
    onCreateNew,
    onOpen,
    onRename,
    onDelete
}: DashboardGridProps) {

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return 'Jamais sauvegardé'
        const d = new Date(dateStr)
        return d.toLocaleDateString('fr-FR') + ' ' +
            d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* New Workspace Card */}
            <Card
                className="border-dashed hover:border-primary cursor-pointer transition-colors"
                onClick={onCreateNew}
            >
                <CardContent className="flex flex-col items-center justify-center h-[180px]">
                    <Plus className="h-8 w-8 text-muted-foreground mb-2" />
                    <p className="font-medium">Nouveau workspace</p>
                    <p className="text-sm text-muted-foreground">Créer un espace de travail</p>
                </CardContent>
            </Card>

            {/* Existing Workspaces */}
            {workspaces.map((ws) => (
                <Card key={ws.id} className="relative group">
                    <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                            <CardTitle className="text-lg">{ws.nom}</CardTitle>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                        <MoreVertical className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => onRename(ws.id)}>
                                        Renommer
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        onClick={() => onDelete(ws.id)}
                                        className="text-destructive"
                                    >
                                        Supprimer
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                        <CardDescription>
                            {ws.empCount ? `${ws.empCount} employé(s)` : '0 employé'} ·
                            {ws.daysCount ? ` ${ws.daysCount} jour(s)` : ' 0 jour'}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">
                                💾 {formatDate(ws.savedAt)}
                            </span>
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => onOpen(ws.id)}
                            >
                                Ouvrir
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    )
}
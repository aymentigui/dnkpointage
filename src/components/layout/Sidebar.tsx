'use client'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
    ChevronLeft,
    ChevronRight,
    Filter,
    Users,
    Calendar,
    Settings,
    BarChart3,
    FileText,
    History,
    Car,
    DoorOpen,
    Syringe,
} from 'lucide-react'
import { useState, useEffect, useMemo } from 'react'
import { usePathname } from 'next/navigation'
import { useWorkspace } from '@/hooks/use-workspace'
import { useSession } from '@/hooks/use-session'

interface SidebarProps {
    collapsed?: boolean
    onToggle?: () => void
}

export function Sidebar({ collapsed = false, onToggle }: SidebarProps) {
    const [isCollapsed, setIsCollapsed] = useState(collapsed)
    const pathname = usePathname()
    const { workspaceId } = useWorkspace();
    const [currentWorkspaceId, setCurrentWorkspaceId] = useState(workspaceId);

    useEffect(() => {
        setIsCollapsed(collapsed)
    }, [collapsed])

    useEffect(() => {
        if (!workspaceId) {
            // recuperer from pathname
            const path = pathname.split('/')
            const workspaceId = path[2]
            setCurrentWorkspaceId(workspaceId)
        }
    }, [workspaceId])

    const handleToggle = () => {
        setIsCollapsed(!isCollapsed)
        onToggle?.()
    }

    // permission
    const { session } = useSession();
    // console.log(session)
    const hasPermissionViewJourFerie = useMemo(() => (
        session?.user?.is_admin || session?.user?.permissions.some((p: string[]) => p.includes("view_jour_ferie"))
    ), [session]);

    const hasPermissionViewEmploye = useMemo(() => (
        session?.user?.is_admin || session?.user?.permissions.some((p: string[]) => p.includes("view_employe"))
    ), [session]);

    const hasPermissionViewPlanning = useMemo(() => (
        session?.user?.is_admin || session?.user?.permissions.some((p: string[]) => p.includes("view_planning"))
    ), [session]);

    const hasPermissionViewHistory = useMemo(() => (
        session?.user?.is_admin || session?.user?.permissions.some((p: string[]) => p.includes("view_history"))
    ), [session]);

    const hasPermissionViewImport = useMemo(() => (
        session?.user?.is_admin || session?.user?.permissions.some((p: string[]) => p.includes("view_import"))
    ), [session]);

    const hasPermissionViewSettings = useMemo(() => (
        session?.user?.is_admin || session?.user?.permissions.some((p: string[]) => p.includes("view_settings"))
    ), [session]);

    const hasPermissionViewMission = useMemo(() => (
        session?.user?.is_admin || session?.user?.permissions.some((p: string[]) => p.includes("mission_view"))
    ), [session]);

    const hasPermissionViewSortie = useMemo(() => (
        session?.user?.is_admin || session?.user?.permissions.some((p: string[]) => p.includes("sortie_view"))
    ), [session]);


    const hasPermissionViewMaladie = useMemo(() => (
        session?.user?.is_admin || session?.user?.permissions.some((p: string[]) => p.includes("maladie_view"))
    ), [session]);

    const menuItems = [
        { icon: Users, label: 'Employés', href: '/employees', permission: hasPermissionViewEmploye },
        { icon: Calendar, label: 'Planning', href: '/planning', permission: hasPermissionViewPlanning },
        // { icon: BarChart3, label: 'Statistiques', href: '/stats' },
        { icon: FileText, label: 'Import/Export', href: '/import', permission: hasPermissionViewImport },
        { icon: Calendar, label: 'Jours Fériés', href: '/jours-feries', permission: hasPermissionViewJourFerie },
        { icon: History, label: 'Historique', href: '/history', permission: hasPermissionViewHistory },
        { icon: Settings, label: 'Paramètres', href: '/settings', permission: hasPermissionViewSettings },
        { icon: Car, label: 'Missions', href: '/missions', permission: hasPermissionViewMission },
        { icon: DoorOpen, label: 'Bons de Sortie', href: '/bon_sortie', permission: hasPermissionViewSortie },
        { icon: Syringe, label: 'Maladies', href: '/maladie', permission: hasPermissionViewMaladie },
    ]

    return (
        <div className={cn(
            "relative h-full border-r border-border bg-background transition-all duration-300",
            isCollapsed ? "w-[60px]" : "w-[240px]"
        )}>
            {/* Toggle Button */}
            {/* <Button
                variant="ghost"
                size="icon"
                className="absolute -right-3 top-6 h-6 w-6 rounded-full border bg-background"
                onClick={handleToggle}
            >
                {isCollapsed ? (
                    <ChevronRight className="h-3 w-3" />
                ) : (
                    <ChevronLeft className="h-3 w-3" />
                )}
            </Button> */}

            <ScrollArea className="h-full py-4">
                <div className="space-y-1 px-2">
                    {/* Filter Section */}
                    {!isCollapsed && (
                        <div className="mb-4 px-2">
                            <h3 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                                <Filter className="h-3 w-3" /> FILTRES
                            </h3>
                            {/* Filters will be added here later */}
                        </div>
                    )}

                    {/* Menu Items */}
                    <div className="space-y-1">
                        {menuItems.filter((item) => item.permission).map((item) => (
                            <Button
                                key={item.label}
                                variant="ghost"
                                className={cn(
                                    "w-full justify-start",
                                    isCollapsed ? "px-2" : "px-3",
                                    pathname === item.href ? "bg-muted" : ""
                                )}
                                asChild
                            >
                                <a href={"/workspaces/" + currentWorkspaceId + "/" + item.href}>
                                    <item.icon className={cn("h-4 w-4", !isCollapsed && "mr-2")} />
                                    {!isCollapsed && <span>{item.label}</span>}
                                </a>
                            </Button>
                        ))}
                    </div>
                </div>
            </ScrollArea>
        </div>
    )
}
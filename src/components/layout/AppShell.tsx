'use client'

import { ReactNode, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Header } from './Header'
import { Sidebar } from './Sidebar'
import { workspacesApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import { ChevronRight } from 'lucide-react'

interface AppShellProps {
    children: ReactNode
    workspaceName?: string
    onDashboardClick?: () => void
    showCurrentWorkspace?: boolean // NOUVEAU
    showSidebar?: boolean
}

export function AppShell({
    children,
    workspaceName,
    onDashboardClick,
    showCurrentWorkspace = false, // NOUVEAU
    showSidebar = true
}: AppShellProps) {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
    const [currentWorkspace, setCurrentWorkspace] = useState<any>(null) // NOUVEAU
    const router = useRouter()

    // NOUVEAU: Récupérer le workspace actif au chargement
    useEffect(() => {
        if (showCurrentWorkspace) {
            checkCurrentWorkspace()
        }
    }, [showCurrentWorkspace])

    const checkCurrentWorkspace = async () => {
        try {
            const { data } = await workspacesApi.getCurrent()
            if (data.workspace) {
                setCurrentWorkspace(data.workspace)
            }
        } catch (error) {
            console.error('Erreur chargement workspace actif:', error)
        }
    }

    return (
        <div className="flex h-screen flex-col bg-background">
            <Header
                workspaceName={workspaceName || currentWorkspace?.nom} // MODIFIÉ
                onDashboardClick={onDashboardClick}
            />

            <div className="flex flex-1 overflow-hidden">
                {showSidebar && (
                    <Sidebar
                        collapsed={sidebarCollapsed}
                        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
                    />
                )}

                <main className={cn(
                    "flex-1 overflow-auto transition-all duration-300",
                    sidebarCollapsed ? "ml-[60px]" : "ml-[60px]"
                )}>
                    <div className="container mx-auto p-4 md:p-6">
                        {children}
                    </div>
                </main>
            </div>

            {/* Hidden Indicator when sidebar is collapsed */}
            {sidebarCollapsed && showSidebar && (
                <div
                    className="fixed left-0 top-1/2 -translate-y-1/2 bg-muted p-1 rounded-r cursor-pointer"
                    onClick={() => setSidebarCollapsed(false)}
                >
                    <ChevronRight className="h-4 w-4" />
                </div>
            )}
        </div>
    )
}
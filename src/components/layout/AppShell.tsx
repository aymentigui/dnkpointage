'use client'

import { ReactNode, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Header } from './Header'
import { Sidebar } from './Sidebar'
import { workspacesApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import { ChevronRight, Menu } from 'lucide-react'

interface AppShellProps {
    children: ReactNode
    workspaceName?: string
    onDashboardClick?: () => void
    showCurrentWorkspace?: boolean
    showSidebar?: boolean
}

export function AppShell({
    children,
    workspaceName,
    onDashboardClick,
    showCurrentWorkspace = false,
    showSidebar = true,
}: AppShellProps) {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
    const [currentWorkspace, setCurrentWorkspace] = useState<any>(null)
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
        if (showCurrentWorkspace) {
            workspacesApi.getCurrent()
                .then(({ data }) => { if (data.workspace) setCurrentWorkspace(data.workspace) })
                .catch(console.error)
        }
    }, [showCurrentWorkspace])

    const displayName = workspaceName || currentWorkspace?.nom

    return (
        <>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');

                .app-shell-root {
                    font-family: 'Plus Jakarta Sans', sans-serif;
                }

                /* Sidebar */
                .app-sidebar {
                    width: 220px;
                    min-width: 220px;
                    transition: width 0.25s cubic-bezier(0.4,0,0.2,1),
                                min-width 0.25s cubic-bezier(0.4,0,0.2,1);
                    background: #ffffff;
                    border-right: 1px solid #e8f5ee;
                    box-shadow: 2px 0 12px rgba(0,143,74,0.04);
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                    position: relative;
                    z-index: 20;
                }
                .app-sidebar.collapsed {
                    width: 60px;
                    min-width: 60px;
                }

                /* Header */
                .app-header {
                    height: 56px;
                    background: #ffffff;
                    border-bottom: 1px solid #e8f5ee;
                    box-shadow: 0 1px 8px rgba(0,143,74,0.05);
                    display: flex;
                    align-items: center;
                    padding: 0 20px;
                    gap: 12px;
                    position: sticky;
                    top: 0;
                    z-index: 30;
                }

                /* Header accent line */
                .app-header::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    height: 2px;
                    background: linear-gradient(90deg, #008F4A, #00c466, #008F4A);
                    background-size: 200% 100%;
                    animation: headerBar 3s linear infinite;
                }
                @keyframes headerBar {
                    0%   { background-position: 0% 0;   }
                    100% { background-position: 200% 0; }
                }

                /* Logo mark */
                .app-logo {
                    width: 32px;
                    height: 32px;
                    border-radius: 8px;
                    background: linear-gradient(135deg, #008F4A, #00b85f);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                    box-shadow: 0 2px 8px rgba(0,143,74,0.25);
                }

                /* Toggle button */
                .sidebar-toggle-btn {
                    width: 32px;
                    height: 32px;
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    background: transparent;
                    color: #64748b;
                    flex-shrink: 0;
                }
                .sidebar-toggle-btn:hover {
                    background: #f1f5f9;
                    color: #008F4A;
                }

                /* Workspace breadcrumb */
                .app-breadcrumb {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 13px;
                    color: #64748b;
                }
                .app-breadcrumb .sep {
                    color: #cbd5e1;
                    font-size: 11px;
                }
                .app-breadcrumb .active {
                    color: #0f172a;
                    font-weight: 600;
                }

                /* Main content */
                .app-main {
                    flex: 1;
                    overflow: auto;
                    background: #f8faf9;
                    transition: margin-left 0.25s cubic-bezier(0.4,0,0.2,1);
                    position: relative;
                }

                /* Subtle grid background */
                .app-main::before {
                    content: '';
                    position: fixed;
                    inset: 0;
                    pointer-events: none;
                    z-index: 0;
                    opacity: 0.025;
                    background-image:
                        linear-gradient(#008F4A 1px, transparent 1px),
                        linear-gradient(90deg, #008F4A 1px, transparent 1px);
                    background-size: 32px 32px;
                }

                .app-content {
                    position: relative;
                    z-index: 1;
                    padding: 24px;
                    max-width: 1400px;
                    margin: 0 auto;
                }

                /* Sidebar toggle tab - only visible when sidebar is collapsed */
                .sidebar-tab {
                    position: fixed;
                    left: 0;
                    top: 50%;
                    transform: translateY(-50%);
                    width: 14px;
                    height: 40px;
                    background: #008F4A;
                    border-radius: 0 6px 6px 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    z-index: 25;
                    box-shadow: 2px 0 8px rgba(0,143,74,0.3);
                    transition: width 0.15s ease, background 0.15s ease;
                }
                .sidebar-tab:hover {
                    width: 18px;
                    background: #006b38;
                }
                .sidebar-tab svg {
                    width: 10px;
                    height: 10px;
                    color: white;
                }

                /* Fade-in on mount */
                @keyframes shellFadeIn {
                    from { opacity: 0; }
                    to   { opacity: 1; }
                }
                .app-shell-root {
                    animation: shellFadeIn 0.3s ease forwards;
                }
            `}</style>

            <div className={cn("app-shell-root flex flex-col h-screen overflow-hidden", !mounted && "opacity-0")}>

                {/* ── Header ── */}
                <header className="app-header">
                    {/* Toggle button - always visible */}
                    {showSidebar && (
                        <button
                            className="sidebar-toggle-btn"
                            onClick={() => setSidebarCollapsed(prev => !prev)}
                            title={sidebarCollapsed ? "Ouvrir le menu" : "Fermer le menu"}
                        >
                            <Menu size={18} />
                        </button>
                    )}

                    {/* Logo */}
                    <div className="app-logo">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                            <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="white" strokeWidth="1.8" strokeLinejoin="round" />
                            <path d="M2 17l10 5 10-5M2 12l10 5 10-5" stroke="rgba(255,255,255,0.65)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </div>

                    {/* Breadcrumb */}
                    <div className="app-breadcrumb flex-1 min-w-0">
                        <span
                            className={cn(
                                "truncate",
                                onDashboardClick
                                    ? "cursor-pointer hover:text-[#008F4A] transition-colors duration-150"
                                    : ""
                            )}
                            onClick={onDashboardClick}
                        >
                            Planning
                        </span>
                        {displayName && (
                            <>
                                <span className="sep">/</span>
                                <span className="active truncate max-w-[200px]">{displayName}</span>
                            </>
                        )}
                    </div>

                    {/* Slot Header original */}
                    <Header
                        workspaceName={displayName}
                        onDashboardClick={onDashboardClick}
                        headerOnly
                    />
                </header>

                {/* ── Body ── */}
                <div className="flex flex-1 overflow-hidden">

                    {/* Sidebar */}
                    {showSidebar && (
                        <aside className={cn("app-sidebar", sidebarCollapsed && "collapsed")}>
                            <Sidebar
                                collapsed={sidebarCollapsed}
                                onToggle={() => setSidebarCollapsed(v => !v)}
                            />
                        </aside>
                    )}

                    {/* Main */}
                    <main className="app-main flex-1">
                        <div className="app-content">
                            {children}
                        </div>
                    </main>
                </div>

                {/* Sidebar re-open tab (only when collapsed) */}
                {sidebarCollapsed && showSidebar && (
                    <div
                        className="sidebar-tab"
                        onClick={() => setSidebarCollapsed(false)}
                        title="Ouvrir le menu"
                    >
                        <ChevronRight />
                    </div>
                )}
            </div>
        </>
    )
}
'use client'

import { useRouter } from 'next/navigation'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Menu, Home, Settings, LayoutDashboard, ArrowLeft, Layers } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface HeaderProps {
    workspaceName?: string
    onDashboardClick?: () => void
    /** Mode intégré dans AppShell — n'affiche que les actions droite */
    headerOnly?: boolean
}

export function Header({ workspaceName, onDashboardClick, headerOnly = false }: HeaderProps) {
    const router = useRouter()

    // ── Actions droite (utilisateur, settings…) ──────────────
    // Slot partagé entre mode standalone et mode headerOnly
    const RightSlot = () => (
        <div className="flex items-center gap-1 ml-auto">
            <Link href="/workspaces"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-all duration-150">
                <Layers className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Workspaces</span>
            </Link>
            {/* <Link href="/settings"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-all duration-150">
                <Settings className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Paramètres</span>
            </Link> */}
        </div>
    )

    // ── Mode headerOnly : juste le slot droit dans AppShell ───
    if (headerOnly) {
        return <RightSlot />
    }

    // ── Mode standalone (header complet) ─────────────────────
    return (
        <>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
                .header-root { font-family: 'Plus Jakarta Sans', sans-serif; }
                @keyframes headerBar {
                    0%   { background-position: 0% 0;   }
                    100% { background-position: 200% 0; }
                }
            `}</style>

            <header className="header-root relative border-b border-[#e8f5ee] bg-white shadow-[0_1px_8px_rgba(0,143,74,0.05)] sticky top-0 z-30">

                {/* Barre verte animée */}
                <div
                    className="absolute top-0 left-0 right-0 h-[2px]"
                    style={{
                        background: "linear-gradient(90deg, #008F4A, #00c466, #008F4A)",
                        backgroundSize: "200% 100%",
                        animation: "headerBar 3s linear infinite",
                    }}
                />

                <div className="flex h-14 items-center px-4 md:px-5 gap-3">

                    {/* Mobile menu */}
                    <Sheet>
                        <SheetTrigger asChild>
                            <button className="md:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors">
                                <Menu className="h-4 w-4" />
                            </button>
                        </SheetTrigger>
                        <SheetContent side="left" className="w-[260px] p-0 border-r border-[#e8f5ee]">
                            <div className="p-5 border-b border-[#e8f5ee]">
                                <div className="flex items-center gap-2.5">
                                    <div
                                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                                        style={{ background: "linear-gradient(135deg, #008F4A, #00b85f)", boxShadow: "0 2px 8px rgba(0,143,74,0.25)" }}
                                    >
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                            <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="white" strokeWidth="1.8" strokeLinejoin="round" />
                                            <path d="M2 17l10 5 10-5M2 12l10 5 10-5" stroke="rgba(255,255,255,0.65)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    </div>
                                    <div>
                                        <p className="text-[13px] font-bold text-slate-900">Planning</p>
                                        {workspaceName && (
                                            <p className="text-[11px] text-[#008F4A] font-medium truncate max-w-[160px]">{workspaceName}</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <nav className="p-3 space-y-1">
                                {[
                                    { href: "/workspaces", icon: Layers, label: "Workspaces" },
                                    { href: "/settings", icon: Settings, label: "Paramètres" },
                                ].map(({ href, icon: Icon, label }) => (
                                    <Link key={href} href={href}
                                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-600 hover:bg-[rgba(0,143,74,0.05)] hover:text-[#008F4A] transition-all duration-150 font-medium">
                                        <Icon className="w-4 h-4" />
                                        {label}
                                    </Link>
                                ))}
                                {onDashboardClick && (
                                    <button
                                        onClick={onDashboardClick}
                                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-600 hover:bg-[rgba(0,143,74,0.05)] hover:text-[#008F4A] transition-all duration-150 font-medium"
                                    >
                                        <LayoutDashboard className="w-4 h-4" />
                                        Dashboard
                                    </button>
                                )}
                            </nav>
                        </SheetContent>
                    </Sheet>

                    {/* Logo */}
                    <Link href="/workspaces" className="flex items-center gap-2.5 shrink-0">
                        <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center"
                            style={{ background: "linear-gradient(135deg, #008F4A, #00b85f)", boxShadow: "0 2px 8px rgba(0,143,74,0.25)" }}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="white" strokeWidth="1.8" strokeLinejoin="round" />
                                <path d="M2 17l10 5 10-5M2 12l10 5 10-5" stroke="rgba(255,255,255,0.65)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </div>
                        <span className="text-[14px] font-bold text-slate-900 hidden sm:block">
                            Présence<span style={{ color: "#008F4A" }}>.planning</span>
                        </span>
                    </Link>

                    {/* Séparateur + workspace + back */}
                    {(workspaceName || onDashboardClick) && (
                        <div className="hidden md:flex items-center gap-2 ml-1">
                            <span className="text-slate-200 text-lg font-light">/</span>

                            {onDashboardClick ? (
                                <button
                                    onClick={onDashboardClick}
                                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-semibold hover:bg-[rgba(0,143,74,0.06)] transition-colors duration-150"
                                    style={{ color: "#008F4A" }}
                                >
                                    <ArrowLeft className="w-3 h-3" />
                                    {workspaceName ?? "Dashboard"}
                                </button>
                            ) : workspaceName ? (
                                <span
                                    className="text-[13px] font-semibold max-w-[200px] truncate"
                                    style={{ color: "#008F4A" }}
                                >
                                    {workspaceName}
                                </span>
                            ) : null}
                        </div>
                    )}

                    {/* Slot droit */}
                    <RightSlot />
                </div>
            </header>
        </>
    )
}
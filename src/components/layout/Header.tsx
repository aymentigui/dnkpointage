'use client'

import { useRouter } from 'next/navigation'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Menu, Home, Settings, Download, Upload } from 'lucide-react'
import Link from 'next/link'

interface HeaderProps {
    workspaceName?: string
    onDashboardClick?: () => void
}

export function Header({ workspaceName, onDashboardClick }: HeaderProps) {
    const router = useRouter()

    return (
        <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex h-16 items-center px-4 md:px-6">
                {/* Mobile Menu */}
                <Sheet>
                    <SheetTrigger asChild>
                        <Button variant="ghost" size="icon" className="md:hidden">
                            <Menu className="h-5 w-5" />
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="w-[240px] sm:w-[300px]">
                        <nav className="flex flex-col gap-4 mt-8">
                            <Link href="/workspaces" className="flex items-center gap-2 text-sm">
                                <Home className="h-4 w-4" /> Workspaces
                            </Link>
                            <Link href="/settings" className="flex items-center gap-2 text-sm">
                                <Settings className="h-4 w-4" /> Paramètres
                            </Link>
                            <Separator />
                            <span className="text-xs text-muted-foreground">Workspace actuel</span>
                            <span className="text-sm font-medium">{workspaceName || 'Aucun'}</span>
                        </nav>
                    </SheetContent>
                </Sheet>

                {/* Logo */}
                <div className="flex items-center gap-2 ml-2 md:ml-0">
                    <Link href="/workspaces" className="font-bold text-lg md:text-xl">
                        Présence<span className="text-primary">.planning</span>
                    </Link>
                </div>

                {/* Dashboard Button */}
                {onDashboardClick && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onDashboardClick}
                        className="ml-4 hidden md:flex"
                    >
                        ← Dashboard
                    </Button>
                )}

                {/* Workspace Name */}
                {workspaceName && (
                    <>
                        <Separator orientation="vertical" className="mx-4 h-6 hidden md:block" />
                        <span className="text-primary text-sm font-medium hidden md:block">
                            {workspaceName}
                        </span>
                    </>
                )}

            </div>

            {/* Storage Status Bar */}
            <div className="h-1 bg-muted">
                <div className="h-full w-0 bg-primary transition-all" style={{ width: '0%' }} />
            </div>
        </header>
    )
}
"use client"
import React from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useTranslations } from 'next-intl'
import { signIn } from 'next-auth/react'
import { FcGoogle } from 'react-icons/fc'

interface OAuthButtonsProps {
    className?: string
    variant?: "default" | "outline"
}

const OAuthButtons = ({ className, variant = "outline" }: OAuthButtonsProps) => {
    const t = useTranslations("Settings")
    const s = useTranslations("System")

    const handleOAuthSignIn = (provider: "google") => {
        signIn(provider, {
            callbackUrl: "/",
            redirect: true
        })
    }

    return (
        <div className={cn("space-y-3", className)}>
            {/* Séparateur */}
            <div className="relative">
                <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-foreground/10"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-transparent text-foreground/70">
                        {s("or_continue_with")}
                    </span>
                </div>
            </div>

            {/* Boutons OAuth */}
            <div className="grid grid-cols-1 gap-3">
                <Button
                    type="button"
                    variant={variant}
                    onClick={() => handleOAuthSignIn("google")}
                    className="w-full py-3 border-foreground/20 text-foreground hover:bg-foreground/5 transition-all duration-200 rounded-xl flex items-center justify-center gap-2"
                >
                    <FcGoogle className="w-5 h-5" />
                    <span className="text-sm font-medium">Google</span>
                </Button>
            </div>
        </div>
    )
}

export default OAuthButtons
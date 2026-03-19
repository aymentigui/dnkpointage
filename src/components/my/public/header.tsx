"use client"
import React, { useState } from 'react'
import LanguageSwitcher from '../language-switcher'
import { ModeToggle } from '@/components/ui/mode-toggle'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { UserRegisterLogin } from '@/components/ui/user-register-login'
import Image from 'next/image'

const HeaderPublic = ({ children }: { children?: React.ReactNode }) => {
    const header = useTranslations("Header")
    const [openMenu, setOpenMenu] = useState(false)

    const toggleMenu = () => {
        setOpenMenu((p => {
            if (!p) {
                document.body.style.overflow = 'hidden';
            } else {
                document.body.style.overflow = 'auto';
            }
            return !p;
        }))

    }

    return (
        <div className='w-full fixed top-0 left-0 z-50 p-2 bg-sidebar flex justify-between items-center border-b shadow'>
            {children}
            <div className='flex items-center'>
                {/* Button to toggle the menu on small screens */}
                <button className="lg:hidden p-2" onClick={toggleMenu} >
                    {/* Icon for the menu, can be a hamburger icon */}
                    &#9776;
                </button>
                <Link href="/" className='block lg:hidden'><Image src="/logo.png" className="w-8 h-8 rounded-full" alt="logo" width={100} height={100} loading="lazy" /></Link>
                <nav className={cn("flex flex-col lg:flex-row absolute lg:relative top-0 w-full lg:w-auto h-screen lg:h-auto bg-border lg:bg-transparent justify-center lg:justify-end items-center gap-4 px-8",
                    openMenu ? "left-0" : " left-[-100%] lg:left-0",
                    "transition-all duration-300 ease-in-out z-50",
                )}>
                    <button className="lg:hidden p-2" onClick={toggleMenu} >
                        <X className="w-6 h-6 absolute top-8 right-8" />
                    </button>
                    <Link onClick={toggleMenu} href="/" className='hidden lg:block'><Image src="/logo.png" className="w-16 h-16 rounded-full" alt="logo" width={100} height={100} loading="lazy" /></Link>
                    <Link onClick={toggleMenu} href="/#" className="hover:underline">{header("home")}</Link>
                    <Link onClick={toggleMenu} href="/contact" className="hover:underline">{header("contactus")}</Link>
                    <Link onClick={toggleMenu} href="/about" className="hover:underline">{header("aboutus")}</Link>
                </nav>
            </div>
            <div className='flex flex-wrap gap-2'>
                <LanguageSwitcher />
                <ModeToggle />
                <UserRegisterLogin />
            </div>
        </div>
    )
}

export default HeaderPublic

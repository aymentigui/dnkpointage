import React from 'react'
import LanguageSwitcher from '../language-switcher'
import { ModeToggle } from '@/components/ui/mode-toggle'

const HeaderAdmin = ({ children }: { children?: React.ReactNode }) => {
    return (
        <div className='w-full p-2 bg-sidebar flex justify-between'>
            {children}
            <div className='flex gap-2'>
                <LanguageSwitcher />
                <ModeToggle />
            </div>
        </div>
    )
}

export default HeaderAdmin

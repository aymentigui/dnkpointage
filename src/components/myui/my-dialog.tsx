"use client"
import { cn } from '@/lib/utils'
import { X } from 'lucide-react'
import React from 'react'

const MyDialog = ({ children, title, width, onClose }: any) => {

    const handleOutsideClick = (event: React.MouseEvent<HTMLDivElement>) => {
        if (event.target === event.currentTarget) {
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div  onClick={handleOutsideClick} className='absolute inset-0 h-full w-full  bg-gray-500 bg-opacity-50'></div>
            <div className={cn(
                "relative bg-white p-6 rounded-md shadow-lg",
                width??"max-w-[400px] "
            )}
            >
                <div className='top-4 right-4 absolute cursor-pointer' onClick={onClose}>
                    <X className="h-4 w-4" />
                </div>
                {title && <p>{title}</p>}
                <div className="mt-4">
                </div>
                {children}
            </div>
        </div>
    )
}

export default MyDialog

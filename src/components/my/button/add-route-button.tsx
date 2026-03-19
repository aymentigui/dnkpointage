"use client"
import { Button } from '@/components/ui/button'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import React from 'react'

interface AddRouteButtonProps {
    translationName: string
    translationButton: string
    route: string
}

const AddRouteButton = ({translationName,translationButton,route}: AddRouteButtonProps) => {
    const translate=useTranslations(translationName)
    const router=useRouter()

    return (
        <Button onClick={() => router.push(route)} className='w-max'>{translate(translationButton)}</Button>
    )
}

export default AddRouteButton

"use client"
import React from 'react'
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

interface AddModalButtonProps {
    translationName: string
    translationButton: string
    useModal: any
}
const AddModalButton = ({translationName,translationButton,useModal}: AddModalButtonProps) => {
    const translate = useTranslations(translationName)
    const { openDialog } = useModal();

    const handleOpenDialogWithTitle = () => {
        openDialog()
    };
    return (
        <Button className='w-max' onClick={handleOpenDialogWithTitle}>
            {translate(translationButton)}
        </Button>
    )
}

export default AddModalButton

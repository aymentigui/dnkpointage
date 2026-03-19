"use client"
import React from 'react'
import { useAddUpdateUserDialog } from '@/context/add-update-dialog-context';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

const AddUpdateUserButton = () => {
    const u = useTranslations("Users")
    const { openDialog } = useAddUpdateUserDialog();

    const handleOpenDialogWithTitle = () => {
        openDialog()
    };
    return (
        <Button className='w-max' onClick={handleOpenDialogWithTitle}>
            {u("adduser")}
        </Button>
    )
}

export default AddUpdateUserButton

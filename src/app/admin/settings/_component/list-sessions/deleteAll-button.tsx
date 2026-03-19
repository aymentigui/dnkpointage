"use client"
import { deleteAllSessions } from '@/actions/accont-settings/update'
import { Button } from '@/components/ui/button'
import { Trash } from 'lucide-react'
import React from 'react'
import toast from 'react-hot-toast'
import { useTranslations } from 'use-intl'

const DeleteAllButton = () => {
    const tss=useTranslations('Sessions')

    const deleteAll = async () => {
        const response = await deleteAllSessions()
        if (response.status == 200) {
            window.location.reload()
        }else{
            toast.error(response.data.message)
        }
    }
    return (
        <Button onClick={deleteAll} variant={"destructive"} >
            {tss('deleteallsessions')} <Trash />
        </Button>
    )
}

export default DeleteAllButton

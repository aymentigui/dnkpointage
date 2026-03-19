"use client"
import { deleteSession } from '@/actions/accont-settings/update'
import { Button } from '@/components/ui/button'
import { Trash } from 'lucide-react'
import React from 'react'
import toast from 'react-hot-toast'

const DeleteButton = ({id}:{id:string}) => {
    const deleteS = async () =>{
        const response = await deleteSession(id) 
        if(response.status==200) 
            window.location.reload()
        else 
            toast.error(response.data.message)

    }

    return (
        <Button onClick={deleteS} variant={"outline"} className='hover:bg-red-400 hover:text-white'>
            <Trash />
        </Button>
    )
}

export default DeleteButton

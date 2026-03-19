"use client"
import React from 'react'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '../ui/button';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

interface ConfirmDialogProps {
    open: boolean;
    setOpen: React.Dispatch<React.SetStateAction<boolean>>;
    selectedIds: string[];
    textToastSelect: string;
    triggerText: string;
    titleText: string;
    descriptionText: string;
    deleteAction: (ids:any) => any
}

const ConfirmDialogDelete = ({ open, setOpen, selectedIds, textToastSelect, triggerText, titleText, descriptionText, deleteAction }: ConfirmDialogProps) => {
    const translateSystem = useTranslations("System")

    const locale = useLocale()

    const hadnleConfirmDelete = async () => {
        if (selectedIds.length === 0) {
            toast.error(textToastSelect)
            return
        }
        setOpen(!open)
    }

    const handleDelete = async () => {
        if (selectedIds.length === 0) return
        const res = await deleteAction(selectedIds)
        if (res.status === 200 && res.data.message) {
          toast.success(translateSystem("deletesuccess"))
          setOpen(false)
          window.location.reload()
        } else {
          toast.success(translateSystem("deletefail"))
        }
      }

    return (
        <AlertDialog open={open} onOpenChange={hadnleConfirmDelete}>
            <AlertDialogTrigger asChild>
                <Button variant="destructive">{triggerText}</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle className={cn(locale=="ar"?"text-right":"text-left")}>{titleText}</AlertDialogTitle>
                    <AlertDialogDescription className={cn(locale=="ar"?"text-right":"text-left")}>
                        {descriptionText}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel className='mx-2' onClick={() => setOpen(false)}>{translateSystem("cancel")}</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete}>{translateSystem("confirm")}</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}

export default ConfirmDialogDelete

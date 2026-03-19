"use client"
import React, { useRef, useState } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { updateTwoFactorConfermation } from '@/actions/accont-settings/update'
import toast from 'react-hot-toast'
import { useTranslations } from 'next-intl'


const TwoFactorConfermationForm = ({ twoFactorConfermation }: { twoFactorConfermation: boolean }) => {
    const [twoFacotorConfermationState, setTwoFacotorConfermationState] = useState(twoFactorConfermation)
    const [loading, setLoading] = useState(false)
    const t=useTranslations("Settings")

    const twoFactorConfermationRef = useRef<HTMLButtonElement>(null)

    const handlerUpdateTwoFactorConfermation = async () => {
        const res = await updateTwoFactorConfermation(!twoFacotorConfermationState)
        if (res.status === 200) {
            toast.success(res.data.message)
            setTwoFacotorConfermationState(!twoFacotorConfermationState)
        } else {
            toast.error(res.data.message)
        }

    }

    const onChanged = async () => {
        setLoading(true)
        await handlerUpdateTwoFactorConfermation()
        setLoading(false)
    }

    return (
        <div className='my-4 border rounded-md p-4'>
            <Checkbox
                checked={twoFacotorConfermationState}
                onCheckedChange={() => onChanged()}
                id="twoFactorConfermation"
                ref={twoFactorConfermationRef} />
            <div className="grid gap-1.5 leading-none">
                <label
                    htmlFor="twoFactorConfermation"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                    {t("twofactor")}
                </label>
                <p className="text-sm text-muted-foreground">
                    {t("twofactordescription")}
                </p>
            </div>
        </div>
    )
}

export default TwoFactorConfermationForm

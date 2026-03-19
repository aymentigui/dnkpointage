"use client"
import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { useForm } from 'react-hook-form'
import { set, z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'
import { updatePassword } from '@/actions/accont-settings/update'
import { useTranslations } from 'next-intl'


const ResetPasswordForm = () => {
    const [showForm, setShowForm] = useState(false)
    const [loading, setLoading] = useState(false)
    const u=useTranslations("Users")
    const t=useTranslations("Settings")
    const ts = useTranslations('System');

    const ResetPasswordScema = z.object({
        currentPassword: z.string({ required_error: u("currentpasswordrequired")}).min(6, { message: u("password6") }),
        password: z.string({ required_error: u("newpasswordrequired")}).min(6, { message: u("password6") }),
        passwordConfermation: z.string({ required_error: u("confirmpasswordrequired")}).min(6, { message: u("password6")}),
    }).refine((data) => data.password === data.passwordConfermation, {
        path: ["passwordConfermation"],
        message: u("confirmpasswordnotmatch"),
    })
    

    const form = useForm<z.infer<typeof ResetPasswordScema>>({
        resolver: zodResolver(ResetPasswordScema),
        defaultValues: {
            currentPassword: "",
            password: "",
            passwordConfermation: "",
        },
    })

    const onSubmit = async (data: z.infer<typeof ResetPasswordScema>) => {
        setLoading(true)
        if (form.getValues().password === form.getValues().currentPassword) {
            toast.error(u("currentpasswordinvalid"))
            setLoading(false)
            return
        }
        updatePassword(form.getValues().currentPassword, form.getValues().password).then((res) => {
            if (res.status === 200) {
                toast.success(ts("updatesuccess"))
                setShowForm(false)
                form.reset()
            }else{
                toast.error(res.data.message)
            }
        })        
        setLoading(false)
    }

    const onCancel = () => {
        setShowForm(false)
        form.reset()
    }

    return (
        <div className='my-4'>
            {showForm ? (
                <div>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="flex-col justify-between items-center flex-nowrap gap-4">
                            <div className='w-full'>
                                <FormField
                                    control={form.control}
                                    name="currentPassword"
                                    render={({ field }) => (
                                        <FormItem className='w-full'>
                                            <FormLabel>{t("currentpassword")}</FormLabel>
                                            <FormControl>
                                                <Input placeholder={t("currentpassword")} {...field} />
                                            </FormControl>
                                            <FormMessage className='font-bold' />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="password"
                                    render={({ field }) => (
                                        <FormItem className='w-full'>
                                            <FormLabel>{t("newpassword")}</FormLabel>
                                            <FormControl>
                                                <Input placeholder={t("newpassword")} {...field} />
                                            </FormControl>
                                            <FormMessage className='font-bold' />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="passwordConfermation"
                                    render={({ field }) => (
                                        <FormItem className='w-full'>
                                            <FormLabel>{t("confirmpassword")}</FormLabel>
                                            <FormControl>
                                                <Input placeholder={t("confirmpassword")} {...field} />
                                            </FormControl>
                                            <FormMessage className='font-bold' />
                                        </FormItem>
                                    )}
                                />
                            </div>
                            <div className='flex justify-end gap-2 pt-6'>
                                <Button variant={'outline'} onClick={onCancel}>Annuler</Button>
                                <Button
                                    disabled={loading} className={cn('font-bold', loading && 'cursor-wait')} type='submit'>{loading ? ts("loading") : ts("save")}</Button>
                            </div>
                        </form>
                    </Form>
                </div>
            ) : (
                <div>
                    <h1 className="text-l justify-between gap-2 flex-wrap font-bold mb-4">{t("resetpassword")}</h1>
                    <div className="flex justify-end items-center mb-4">
                        <Button variant={'outline'} onClick={() => setShowForm(true)}>{t("change password")}</Button>
                    </div>
                </div>
            )}
        </div>
    )
}

export default ResetPasswordForm

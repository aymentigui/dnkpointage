"use client"
import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { cn } from '@/lib/utils'
import { updateInfo } from '@/actions/accont-settings/update'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'

const InfoForm = ({ user }: { user: any }) => {
    const [showForm, setShowForm] = useState(false)
    const [loading, setLoading] = useState(false)
    const router = useRouter()
    const u = useTranslations("Users")
    const t = useTranslations("Settings")
    const ts = useTranslations('System');

    const Scema = z.object({
        firstname: z.string().min(1, { message: u("firstnamerequired") }),
        lastname: z.string().min(1, { message: u("lastnamerequired") }),
    })


    const form = useForm<z.infer<typeof Scema>>({
        resolver: zodResolver(Scema),
        defaultValues: {
            firstname: user.firstname || '',
            lastname: user.lastname || '',
        },
    })

    const onSubmit = async (data: z.infer<typeof Scema>) => {
        setLoading(true)
        if (data.firstname === user.firstname && data.lastname === user.lastname) {
            setShowForm(false)
            setLoading(false)
            return
        }
        updateInfo(data.firstname, data.lastname).then((res) => {
            if (res.status === 200) {
                toast.success(ts("updatesuccess"))
                setShowForm(false)
                router.refresh()
            } else {
                toast.error(res.data.message)
            }
        })
        setLoading(false)
    }

    return (
        <div className='my-4'>
            {showForm ? (
                <div>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="flex justify-between items-center flex-nowrap gap-4">
                            <FormField
                                control={form.control}
                                name="firstname"
                                render={({ field }) => (
                                    <FormItem className='w-full'>
                                        <FormLabel>{u("firstname")}</FormLabel>
                                        <FormControl>
                                            <Input placeholder={u("firstname")} {...field} />
                                        </FormControl>
                                        <FormMessage className='font-bold' />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="lastname"
                                render={({ field }) => (
                                    <FormItem className='w-full'>
                                        <FormLabel>{u("lastname")}</FormLabel>
                                        <FormControl>
                                            <Input placeholder={u("lastname")} {...field} />
                                        </FormControl>
                                        <FormMessage className='font-bold' />
                                    </FormItem>
                                )}
                            />
                            <div className='pt-6'>
                                <Button
                                    disabled={loading} className={cn('font-bold w-full', loading && 'cursor-wait')} type="submit">{ts("save")}</Button>
                            </div>
                        </form>
                    </Form>
                </div>
            ) : (
                <div>
                    <h1 className="text-l justify-between gap-2 flex-wrap font-bold mb-4">{t("personalinfo")}</h1>
                    <div className="flex gap-5 flex-wrap items-center mb-4">
                        <div>
                            <span className='font-bold'>{u("firstname")} : </span>
                            <span>{user.firstname}</span>
                        </div>
                        <div>
                            <span className='font-bold'>{u("lastname")} : </span>
                            <span>{user.lastname}</span>
                        </div>
                    </div>
                    <div className='flex justify-end'>
                        <Button variant={'outline'} onClick={() => setShowForm(true)}>{t("change info")}</Button>
                    </div>
                </div>
            )}
        </div>
    )
}

export default InfoForm

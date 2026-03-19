"use client"
import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { cn } from '@/lib/utils'
import { updateUsername } from '@/actions/accont-settings/update'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'

const UsernameForm = ({ username }: { username: string }) => {
    const [showForm, setShowForm] = useState(false)
    const [loading, setLoading] = useState(false)
    const router=useRouter()
    const u=useTranslations("Users")
    const t=useTranslations("Settings")
    const ts = useTranslations('System');

    const EmailScema = z.object({
        username: z.string({message:u("usernamerequired")}).min(6,{ message: u("username6") }),
    })
    

    const form = useForm<z.infer<typeof EmailScema>>({
        resolver: zodResolver(EmailScema),
        defaultValues: {
            username: username,
        },
    })

    const onSubmit = async (data: z.infer<typeof EmailScema>) => {
        setLoading(true)
        if(data.username === username) {
            setShowForm(false)
            setLoading(false)
            return
        }
        updateUsername(data.username).then((res) => {
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
                                name="username"
                                render={({ field }) => (
                                    <FormItem className='w-full'>
                                        <FormLabel>{t("username")}</FormLabel>
                                        <FormControl>
                                            <Input placeholder={t("username")} {...field} />
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
                    <h1 className="text-l justify-between gap-2 flex-wrap font-bold mb-4">{t("username")}</h1>
                    <div className="flex justify-between gap-2 flex-wrap items-center mb-4">
                        <div>
                            <span>{username}</span>
                        </div>
                        <Button variant={'outline'} onClick={() => setShowForm(true)}>{t("change username")}</Button>
                    </div>
                </div>
            )}
        </div>
    )
}

export default UsernameForm

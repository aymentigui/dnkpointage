import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { permissions } from '@/db/permissions'
import { useTranslations } from 'next-intl'
import React, { useEffect, useState } from 'react'

const PermissionsViewForm = ({ isPublicView,
    setIsPublicView,
    isJustMeView,
    setIsJustMeView,
    permissionsView,
    setPermissionsView,
    usersView,
    setUsersView,
    users
}: any) => {
    const f = useTranslations("Files")
    const p = useTranslations("Permissions")
    const s = useTranslations("System")

    const [filteredUsers, setFilteredUsers] = useState(users)
    const [search, setSearch] = useState("")


    useEffect(() => {
        const filtered = users
            .sort((a:any, b:any) => (usersView.includes(a.id) ? -1 : usersView.includes(b.id) ? 1 : 0))
            .filter((user: any) => {
                const name = `${user.firstname ?? ""} ${user.lastname ?? ""} ${user.username ?? ""} ${user.email ?? ""}`.toLowerCase()
                return name.includes(search.toLowerCase())
            })
        setFilteredUsers(filtered)
    }, [search, users,usersView])

    return (
        <div className='flex flex-col gap-2'>
            <div className='font-semibold mb-2'>{f("viewpermissions")}</div>
            <div className='flex gap-2'>
                <Checkbox
                    checked={isPublicView}
                    onCheckedChange={() => setIsPublicView(!isPublicView)}
                />
                <Label>{f("public")}</Label>
            </div>
            {
                !isPublicView && <div className='flex gap-2'>
                    <Checkbox
                        checked={isJustMeView}
                        onCheckedChange={() => setIsJustMeView(!isJustMeView)}
                    />
                    <Label>{f("justme")}</Label>
                </div>
            }
            {
                !isJustMeView && !isPublicView && <div className='border rounded p-4'>
                    <div className='mb-2'>{f("havepermission")}</div>
                    <div className='flex flex-col h-36 gap-2 overflow-auto'>
                        {permissions.map((permission: any) => (
                            <div
                                key={permission.name}
                                className='flex items-center gap-2'
                            >
                                <Checkbox
                                    checked={permissionsView.includes(permission.name)}
                                    onCheckedChange={() => setPermissionsView((prev: any) => prev.includes(permission.name) ? prev.filter((p: any) => p !== permission.name) : [...prev, permission.name])}
                                />
                                <Label>{p(permission.name)}</Label>
                            </div>
                        ))}
                    </div>
                </div>
            }
            {
                !isJustMeView && !isPublicView && <div className='border rounded p-4'>
                    <div className='mb-2'>{f("users")}</div>
                    <Input
                        type="text"
                        placeholder={s("search")}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className='mb-2'
                    />
                    <div className='flex flex-col h-36 gap-2 overflow-auto'>
                        {filteredUsers.map((user: any) => (
                            <div
                                key={user.id}
                                className='flex items-center gap-2'
                            >
                                <Checkbox
                                    checked={usersView.includes(user.id)}
                                    onCheckedChange={() => setUsersView((prev: any) => prev.includes(user.id) ? prev.filter((p: any) => p !== user.id) : [...prev, user.id])}
                                />
                                <Label>{(user.firstname ?? "-") + " " + (user.lastname ?? "-") + " (" + (user.email ?? "-") + ")"}</Label>
                            </div>
                        ))}
                    </div>
                </div>
            }
        </div>
    )
}

export default PermissionsViewForm

import { getUsersPublic } from '@/actions/users/get'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { permissions } from '@/db/permissions'
import { useTranslations } from 'next-intl'
import React, { useEffect, useState } from 'react'

const PermissionsDeleteForm = ({ 
    isPublicDelete,
    setIsPublicDelete,
    isJustMeDelete,
    setIsJustMeDelete,
    permissionsDelete,
    setPermissionsDelete,
    usersDelete,
    setUsersDelete,
    users
}: any) => {
    const f = useTranslations("Files")
    const p = useTranslations("Permissions")
    const s = useTranslations("System")

    const [filteredUsers, setFilteredUsers] = useState(users)
    const [search, setSearch] = useState("")


    useEffect(() => {
        const filtered = users
        .sort((a:any, b:any) => (usersDelete.includes(a.id) ? -1 : usersDelete.includes(b.id) ? 1 : 0))
        .filter((user: any) => {
            const name = `${user.firstname ?? ""} ${user.lastname ?? ""} ${user.username ?? ""} ${user.email ?? ""}`.toLowerCase()
            return name.includes(search.toLowerCase())
        })
        setFilteredUsers(filtered)
    }, [search, users,usersDelete])

    return (
        <div className='flex flex-col gap-2'>
            <div className='font-semibold mb-2'>{f("deletepermissions")}</div>
            <div className='flex gap-2'>
                <Checkbox
                    checked={isPublicDelete}
                    onCheckedChange={() => setIsPublicDelete(!isPublicDelete)}
                />
                <Label>{f("allusers")}</Label>
            </div>
            {
                !isPublicDelete && <div className='flex gap-2'>
                    <Checkbox
                        checked={isJustMeDelete}
                        onCheckedChange={() => setIsJustMeDelete(!isJustMeDelete)}
                    />
                    <Label>{f("justme")}</Label>
                </div>
            }
            {
                !isPublicDelete && !isJustMeDelete && <div className='border rounded p-4'>
                    <div className='mb-2'>{f("havepermission")}</div>
                    <div className='flex flex-col h-36 gap-2 overflow-auto'>
                        {permissions.map((permission: any) => (
                            <div
                                key={permission.name}
                                className='flex items-center gap-2'
                            >
                                <Checkbox
                                    checked={permissionsDelete.includes(permission.name)}
                                    onCheckedChange={() => setPermissionsDelete((prev: any) => prev.includes(permission.name) ? prev.filter((p: any) => p !== permission.name) : [...prev, permission.name])}
                                />
                                <Label>{p(permission.name)}</Label>
                            </div>
                        ))}
                    </div>
                </div>
            }
            {
                !isJustMeDelete && !isPublicDelete && <div className='border rounded p-4'>
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
                                    checked={usersDelete.includes(user.id)}
                                    onCheckedChange={() => setUsersDelete((prev: any) => prev.includes(user.id) ? prev.filter((p: any) => p !== user.id) : [...prev, user.id])}
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

export default PermissionsDeleteForm

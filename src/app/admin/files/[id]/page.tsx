"use server"
import { Card } from '@/components/ui/card';
import React from 'react'
import { prisma } from '@/lib/db';
import UpdateFiles from '../_component/forms/update-files';
import { verifySession } from '@/actions/permissions';

const FilePreview = async ({ params }: any) => {
    const paramsID = await params;

    if (!paramsID.id)
        return null

    const session = await verifySession()

    if (session.status !== 200 || !session || !session.data.user || !session.data.user.id) {
        return null;
    }

    const file = await prisma.files.findUnique({
        where: {
            id: paramsID.id
        }
    })

    if (!file)
        return null

    let havePermission=true
    const canDeletePermissions = file.can_delete_permissions ? file.can_delete_permissions.split(',') : []
    const canDeleteUsers = file.can_delete_users ? file.can_delete_users.split(',') : []
    if (!session && (canDeleteUsers.length > 0 || canDeletePermissions.length > 0)) {
        havePermission = false
    }
    if (!session.data.user.is_admin) {
        havePermission = canDeletePermissions.length === 0 || canDeletePermissions.some((p: any) => session.data.user.permissions.includes(p)) || canDeleteUsers.includes(session.data.user.id)
    }
    if(file.added_from===session.data.user.id)
        havePermission=true

    if(!havePermission)
        return null

    return (
        <Card className='p-4'>
        <UpdateFiles
            getFile={file}
            isJustMeViewProps={file.admin_view_only}
            isJustMeDownloadProps={file.admin_download_only}
            isJustMeDeleteProps={file.admin_delete_only}
            usersViewProps={file.can_view_users?file.can_view_users.split(','):[]}
            usersDownloadProps={file.can_download_users?file.can_download_users.split(','):[]}
            usersDeleteProps={file.can_delete_users?file.can_delete_users.split(','):[]}
            permissionsViewProps={file.can_view_permissions?file.can_view_permissions.split(','):[]}
            permissionsDownloadProps={file.can_download_users?file.can_download_users.split(','):[]}
            permissionsDeleteProps={file.can_delete_users?file.can_delete_users.split(','):[]}
        />
      </Card>
    )
}

export default FilePreview

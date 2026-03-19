"use client"
import { useTranslations } from 'next-intl'
import React, { useEffect, useState } from 'react'
import PermissionsViewForm from './permissions-view-form'
import PermissionsDownloadForm from './permissions-download-form'
import PermissionsDeleteForm from './permissions-delete-form'
import { Button } from '@/components/ui/button'
import { getUsersPublic } from '@/actions/users/get'
import { updateFilePermissionsDB } from '@/actions/localstorage/update-db'
import toast from 'react-hot-toast'
import { deleteFileFromLocalHost, getFileFromLocalHost, ViewFileFromLocalHost } from '@/actions/localstorage/util-client'
import { useOrigin } from '@/hooks/use-origin'
import FilePreview from '@/components/myui/file-preview'
import FilePreview2 from '@/components/myui/file-preview2'
import { useRouter } from 'next/navigation'
import MyDialogConfirm from '@/components/myui/my-dialog-confirm'

interface UpdateFilesProps {
    getFile: any;

    isJustMeViewProps?: boolean
    isJustMeDownloadProps?: boolean
    isJustMeDeleteProps?: boolean

    usersViewProps?: any[]
    usersDownloadProps?: any[]
    usersDeleteProps?: any[]

    permissionsViewProps?: any[]
    permissionsDownloadProps?: any[]
    permissionsDeleteProps?: any[]
}

const UpdateFiles = ({
    getFile,
    isJustMeViewProps = false,
    isJustMeDownloadProps = false,
    isJustMeDeleteProps = false,

    usersViewProps = [],
    usersDownloadProps = [],
    usersDeleteProps = [],

    permissionsViewProps = [],
    permissionsDownloadProps = [],
    permissionsDeleteProps = [],
}: UpdateFilesProps) => {
    const f = useTranslations("Files")
    const s = useTranslations("System")
    const origin = useOrigin()
    const router=useRouter()

    const [showConfirmDialog, setShowConfirmDialog] = useState<boolean>(false)
    const [fileToDelete, setFileToDelete] = useState<any | null>(null)

    const [file, setFile] = useState<any>(getFile)
    const [loading, setLoading] = useState(false)
    const [users, setUsers] = useState([])

    const [isPublicView, setIsPublicView] = useState((isJustMeViewProps ? false : usersViewProps.length === 0 ? true : permissionsViewProps.length === 0 ? true : false))
    const [isJustMeView, setIsJustMeView] = useState(isJustMeViewProps)
    const [permissionsView, setPermissionsView] = useState<string[]>(permissionsViewProps.length === 0 ? [] : permissionsViewProps)
    const [usersView, setUsersView] = useState<string[]>(usersViewProps.length === 0 ? [] : usersViewProps)

    const [isPublicDownload, setIsPublicDownload] = useState((isJustMeDownloadProps ? false : usersDownloadProps.length === 0 ? true : permissionsDownloadProps.length === 0 ? true : false))
    const [isJustMeDownload, setIsJustMeDownload] = useState(isJustMeDownloadProps)
    const [permissionsDownload, setPermissionsDownload] = useState<string[]>(permissionsDownloadProps.length === 0 ? [] : permissionsDownloadProps)
    const [usersDownload, setUsersDownload] = useState<string[]>(usersDownloadProps.length === 0 ? [] : usersDownloadProps)

    const [isPublicDelete, setIsPublicDelete] = useState((isJustMeDeleteProps ? false : usersDeleteProps.length === 0 ? true : permissionsDeleteProps.length === 0 ? true : false))
    const [isJustMeDelete, setIsJustMeDelete] = useState(isJustMeDeleteProps)
    const [permissionsDelete, setPermissionsDelete] = useState<string[]>(permissionsDeleteProps.length === 0 ? [] : permissionsDeleteProps)
    const [usersDelete, setUsersDelete] = useState<string[]>(usersDeleteProps.length === 0 ? [] : usersDeleteProps)


    useEffect(() => {
        if (!origin) return
        getUsersPublic().then((res: any) => {
            if (res.status === 200 && res.data) {
                setUsers(res.data)
            }
        })
        if (getFile.size > 5242880) return
        getFileFromLocalHost(getFile.id, origin + "/api/files/").then((val) => {
            if (val) {
                setFile({ ...file, file: val })
            }
        })
    }, [origin])

    const handleView = async (id: string) => {
        if (!origin) return
        ViewFileFromLocalHost(id, origin + "/api/files/")
    }

    const openConfirmDialog = (file: any) => {
        setFileToDelete(file)
        setShowConfirmDialog(true)
    }

    const handleDelete = async () => {
        if (!origin || !fileToDelete) return
        deleteFileFromLocalHost(fileToDelete.id, origin + "/api/files/").then((val) => {
            if (val && val.status === 200) {
                router.push("/admin/files")
            }
        })
        setShowConfirmDialog(false)
        setFileToDelete(null)
    }

    const handleCancelDelete = () => {
        setShowConfirmDialog(false)
        setFileToDelete(null)
    }

    const handleSave = async () => {
        setLoading(true)
        const data = new FormData()
        data.append("isPublicView", String(isPublicView))
        const res = await updateFilePermissionsDB(
            getFile.id,
            "",
            isPublicView || isJustMeView ? undefined : usersView.length === 0 ? undefined : usersView,
            isPublicView || isJustMeView ? undefined : permissionsView.length === 0 ? undefined : permissionsView,
            !isPublicView && isJustMeView,
            isPublicDownload || isJustMeDownload ? undefined : usersDownload.length === 0 ? undefined : usersDownload,
            isPublicDownload || isJustMeDownload ? undefined : permissionsDownload.length === 0 ? undefined : permissionsDownload,
            !isPublicDownload && isJustMeDownload,
            isPublicDelete || isJustMeDelete ? undefined : usersDelete.length === 0 ? undefined : usersDelete,
            isPublicDelete || isJustMeDelete ? undefined : permissionsDelete.length === 0 ? undefined : permissionsDelete,
            !isPublicDelete && isJustMeDelete
        )
        if (res.status === 200) {
            toast.success(s("updatesuccess"))
        }
        setLoading(false)
        window.location.reload()
    }

    return (
        <div>
            <div>
                { /* File preview */}
                <div className='flex items-center p-4'>
                    {
                        file.file ?
                            <FilePreview
                                file={file.file}
                                size='w-64 h-72'
                                fileId={file.id}
                                onRemove2={ () => openConfirmDialog(file)}
                                onView={() => handleView(file.id)}
                            />
                            :
                            <FilePreview2
                                file={{ fileid: file.id, filename: file.name, filetype: file.mime_type }}
                                size='w-64 h-72'
                                onRemove={ () => openConfirmDialog(file)}
                                onView={() => handleView(file.id)}
                            />
                    }
                </div>

                { /* permissions */}

                <div className='font-bold mb-2'>{f("filespermission")}</div>
                <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2'>
                    <PermissionsViewForm
                        isPublicView={isPublicView}
                        setIsPublicView={setIsPublicView}
                        isJustMeView={isJustMeView}
                        setIsJustMeView={setIsJustMeView}
                        permissionsView={permissionsView}
                        setPermissionsView={setPermissionsView}
                        usersView={usersView}
                        setUsersView={setUsersView}
                        users={users}
                    />
                    <PermissionsDownloadForm
                        isPublicDownload={isPublicDownload}
                        setIsPublicDownload={setIsPublicDownload}
                        isJustMeDownload={isJustMeDownload}
                        setIsJustMeDownload={setIsJustMeDownload}
                        permissionsDownload={permissionsDownload}
                        setPermissionsDownload={setPermissionsDownload}
                        usersDownload={usersDownload}
                        setUsersDownload={setUsersDownload}
                        users={users}
                    />
                    <PermissionsDeleteForm
                        isPublicDelete={isPublicDelete}
                        setIsPublicDelete={setIsPublicDelete}
                        isJustMeDelete={isJustMeDelete}
                        setIsJustMeDelete={setIsJustMeDelete}
                        permissionsDelete={permissionsDelete}
                        setPermissionsDelete={setPermissionsDelete}
                        usersDelete={usersDelete}
                        setUsersDelete={setUsersDelete}
                        users={users}
                    />
                </div>
            </div>
            <Button onClick={handleSave} type="submit" disabled={loading} className="relative my-4">
                {loading ? (
                    <>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-5 h-5 border-t-2 border-b-2 border-blue-500 rounded-full animate-spin"></div>
                        </div>
                    </>
                ) : (
                    s("update")
                )}
            </Button>
            {showConfirmDialog && (
                <MyDialogConfirm
                    open={showConfirmDialog}
                    onClose={handleCancelDelete}
                    onConfirm={handleDelete}
                    message={f("confermationdeletemessage")}
                />
            )}
        </div>
    )
}

export default UpdateFiles

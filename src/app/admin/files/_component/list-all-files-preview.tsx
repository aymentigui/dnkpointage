"use client"
import React, { useEffect, useState } from 'react'
import { useOrigin } from '@/hooks/use-origin'
import axios from 'axios'
import FilePreview from '@/components/myui/file-preview'
import FilePreview2 from '@/components/myui/file-preview2'
import { deleteFileFromLocalHost, downloadFileFromLocalHost, getFileFromLocalHost, getImageFileFromLocalHost, ViewFileFromLocalHost } from '@/actions/localstorage/util-client'
import { useSession } from '@/hooks/use-session'
import { hasPermissionDeleteFile, hasPermissionDownloadFile } from '@/actions/util/util-public'
import MyDialogConfirm from '@/components/myui/my-dialog-confirm'
import { useTranslations } from 'next-intl'
import SelectFetch from '@/components/myui/select-fetch'
import Pagination from '@/components/myui/pagination'
import { cn } from '@/lib/utils'

interface ListFilesWithPreviewProps {
    havetype?: string;
    filesSelected?: any[];
    setFilesSelected?: any;
    multiple?: boolean;
    notAllFile?: boolean;
    allImage?: boolean;
}

const ListFilesWithPreview = (
    { havetype,
        filesSelected,
        setFilesSelected,
        multiple = true,
        notAllFile = false,
        allImage = false
    }: ListFilesWithPreviewProps
) => {
    const [files, setFiles] = useState<any[] | []>([])
    const [showConfirmDialog, setShowConfirmDialog] = useState<boolean>(false)
    const [fileToDelete, setFileToDelete] = useState<any | null>(null)
    const origin = useOrigin()
    const { session } = useSession()
    const translate = useTranslations("Files")
    const translateSystem = useTranslations("System")

    const [pageSize, setPageSize] = useState("10")
    const [page, setPage] = useState(1)
    const [count, setCount] = useState(0)
    const [type, setType] = useState(havetype ?? "")

    useEffect(() => {
        if (!session || !session.user || !session.user.id) return
        fetchFile()
    }, [origin, session, pageSize, page, type])

    const fetchFile = async () => {
        if (!origin) return
        const res = await axios(origin + "/api/files", { params: { page: page ?? 1, pageSize: pageSize ?? 10, type: type === "all" ? "" : type } })
        const res2 = await axios(origin + "/api/files", { params: { type: type === "all" ? "" : type, count: true } })
        if (res.status === 200 && res2.status === 200) {
            setFiles(res.data.data)
            setCount(res2.data.data)
            if (!notAllFile)
                res.data.data.forEach((file: any) => {
                    // if (file.size > 5242880) return
                    getFileFromLocalHost(file.id, origin + "/api/files/").then((val) => {
                        if (val) {
                            setFiles((p) => p.map((f: any) => f.id === file.id ? { ...f, file: val } : f))
                        }
                    })
                })
            else if(allImage) {
                res.data.data.forEach((file: any) => {
                    if (file.mime_type.startsWith("image/")) {
                        getImageFileFromLocalHost(file.id, origin + "/api/files/").then((val) => {
                            if (val) {
                                setFiles((p) => p.map((f: any) => f.id === file.id ? { ...f, file: val } : f))
                            }
                        })
                    }
                })
            }
        }
    }

    const handleDownloadDirect = async (id: string) => {
        if (!origin) return
        const file = files.find((f: any) => f.id === id)
        let havePermission = hasPermissionDownloadFile(file, session)

        if (!havePermission) return
        downloadFileFromLocalHost(id, origin + "/api/files/")
    }

    const handleEdit = async (id: string) => {
        if (!origin) return
        window.open(origin + "/admin/files/" + id, "_blank")
    }

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
                setFiles((p) => p.filter((file: any) => file.id !== fileToDelete.id));
            }
        })
        setShowConfirmDialog(false)
        setFileToDelete(null)
    }

    const handleCancelDelete = () => {
        setShowConfirmDialog(false)
        setFileToDelete(null)
    }

    const handleSelect = (file: any) => {
        if (filesSelected && setFilesSelected) {
            if (multiple) {
                if (filesSelected.find((f: any) => f.id === file.id)) {
                    setFilesSelected((p: any) => p.filter((f: any) => f.id !== file.id))
                } else {
                    setFilesSelected((p: any) => [...p, file])
                }
            } else {
                setFilesSelected([file])
            }
        }
    }

    return (
        <div className='h-full flex flex-col'>
            <div className='w-full flex gap-2 p-2 flex-wrap'>
                <div className='w-48'>
                    <SelectFetch
                        value={pageSize}
                        onChange={(val) => setPageSize(val)}
                        label={translateSystem("pagesize")}
                        placeholder={translateSystem("pagesizeplaceholder")}
                        options={[
                            { value: "10", label: "10" },
                            { value: "20", label: "20" },
                            { value: "50", label: "50" },
                            { value: "100", label: "100" },
                        ]}
                    />
                </div>
                {!havetype && <div className='w-48'>
                    <SelectFetch
                        value={type}
                        onChange={(val) => setType(val)}
                        label={translate("filetype")}
                        placeholder={translateSystem("selectoption")}
                        options={[
                            { value: "image", label: translateSystem("image") },
                            { value: "video", label: translateSystem("video") },
                            { value: "audio", label: translateSystem("audio") },
                            { value: "text", label: translateSystem("text") },
                            { value: "document", label: translateSystem("document") },
                        ]}
                    />
                </div>}
            </div>
            <div>
                {
                    filesSelected &&
                    <div className='p-2 font-semibold text-sm'>
                        {filesSelected.length} {translateSystem("selected")}
                    </div>
                }
            </div>
            {files.length > 0 && (
                <div className='flex flex-wrap gap-2 p-2 overflow-auto'>
                    {files.map((file: any, index) => (
                        <div
                            key={index}
                            onClick={setFilesSelected ? () => handleSelect(file) : undefined}
                            className={cn(
                                setFilesSelected ? "cursor-pointer" : "",
                                filesSelected && filesSelected.length > 0 && filesSelected.find((f: any) => f.id === file.id) ? "border border-blue-600 rounded-xl" : "",
                            )}
                        >
                            {file.file ? (
                                <FilePreview
                                    file={file.file}
                                    size='w-32 h-36'
                                    onRemove2={!setFilesSelected && hasPermissionDeleteFile(file, session) ? () => openConfirmDialog(file) : undefined}
                                    onDownload={hasPermissionDownloadFile(file, session) ? () => handleDownloadDirect(file.id) : undefined}
                                    onEdit={!setFilesSelected && hasPermissionDeleteFile(file, session) ? () => handleEdit(file.id) : undefined}
                                    fileId={file.id}
                                    onView={() => handleView(file.id)}
                                />)
                                : (
                                    <FilePreview2

                                        file={{ fileid: file.id, filename: file.name, filetype: file.mime_type }}
                                        size='w-32 h-36'
                                        onRemove={!setFilesSelected && hasPermissionDeleteFile(file, session) ? () => openConfirmDialog(file) : undefined}
                                        onDownload={hasPermissionDownloadFile(file, session) ? () => handleDownloadDirect(file.id) : undefined}
                                        onEdit={!setFilesSelected && hasPermissionDeleteFile(file, session) ? () => handleEdit(file.id) : undefined}
                                        onView={() => handleView(file.id)}
                                    />
                                )
                            }
                        </div>
                    ))}

                </div>
            )}


            <div className='flex grow-[1] justify-end mx-2 my-4 items-end'>
                {pageSize !== 'all' && <Pagination
                    currentPage={page}
                    totalPages={count > 0 && typeof parseInt(pageSize) === 'number' ? Math.ceil(count / parseInt(pageSize)) : 0}
                    onPageChange={(page) => setPage(page)}
                />}
            </div>

            {showConfirmDialog && (
                <MyDialogConfirm
                    open={showConfirmDialog}
                    onClose={handleCancelDelete}
                    onConfirm={handleDelete}
                    message={translate("confermationdeletemessage")}
                />
            )}
        </div>
    )
}

export default ListFilesWithPreview

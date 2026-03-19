"use client"
import React, { useEffect, useState } from 'react'
import FilePreview from '@/components/myui/file-preview'
import FilePreview2 from '@/components/myui/file-preview2'
import { useTranslations } from 'next-intl'
import { Plus } from 'lucide-react'
import ListFilesWithPreview from './list-all-files-preview'
import MyDialog from '@/components/myui/my-dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import FileUploadForm from './forms/upload-files'

interface ListFilesFormProps {
    havetype?: string;
    filesSelected: any[];
    setFilesSelected: any;
    multiple?: boolean;
    acceptedFileTypes?: Record<string, string[]>;
    notAllFiles?: boolean;
    allImage?: boolean;
}

const ListFilesForm = (
    { havetype,
        filesSelected,
        setFilesSelected,
        multiple,
        acceptedFileTypes,
        notAllFiles,
        allImage
    }: ListFilesFormProps
) => {
    const translate = useTranslations("Files")
    const translateSystem = useTranslations("System")

    const [open, setOpen] = useState(false)

    const handleDelete = async (id: string) => {
        setFilesSelected((p: any) => p.filter((file: any) => file.id !== id));
    }


    return (
        <div>
            <div className='p-2 border rounded-md'>
                <div>
                    {
                        filesSelected &&
                        <div className='p-2 font-semibold text-sm'>
                            {filesSelected.length} {translateSystem("selected")}
                        </div>
                    }
                </div>

                <div className='flex flex-wrap gap-2 p-2'>
                    <div onClick={() => setOpen(true)} className='flex justify-center items-center bg-border w-28 h-36 rounded-md shadow border cursor-pointer hover:shadow-lg hover:bg-sidebar-border'>
                        <Plus size={32} />
                    </div>
                    {filesSelected.length > 0 && filesSelected.map((file: any, index) => (
                        file.file ? (
                            <FilePreview
                                key={index}
                                file={file.file}
                                size='w-28 h-36'
                                onRemove2={handleDelete}
                                fileId={file.id}
                            />)
                            : (
                                <FilePreview2
                                    key={index}
                                    file={{ fileid: file.id, filename: file.name, filetype: file.mimeType }}
                                    size='w-28 h-36'
                                    onRemove={handleDelete}
                                />
                            )
                    ))}
                </div>

            </div>
            {open && <MyDialog width="w-2/3" onClose={() => setOpen(false)}>
                <div className='max-h-[70vh]'>
                    <Tabs defaultValue="files" className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="files">{translate("title")}</TabsTrigger>
                            <TabsTrigger value="uploadfiles">{translate("uploadfile")}</TabsTrigger>
                        </TabsList>
                        <TabsContent value="files" className=''>
                            <Card className='h-[63vh]  overflow-auto'>
                                <CardContent className="space-y-2 h-full">
                                    <ListFilesWithPreview allImage={allImage} notAllFile={notAllFiles} havetype={havetype} filesSelected={filesSelected} setFilesSelected={setFilesSelected} multiple={multiple} />
                                </CardContent>
                            </Card>
                        </TabsContent>
                        <TabsContent value="uploadfiles">
                            <Card className='h-[63vh]  overflow-auto'>
                                <CardContent className="space-y-2 h-full">
                                    <FileUploadForm acceptedFileTypes={acceptedFileTypes} showPermissions={false} />
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </div>
            </MyDialog>}
        </div>
    )
}

export default ListFilesForm

'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import toast from 'react-hot-toast'
import { FileDropzone } from '@/components/myui/file-dropzone'
import { useTranslations } from 'next-intl'
import Loading from '@/components/myui/loading-line'
import axios from 'axios'
import PermissionsViewForm from './permissions-view-form'
import PermissionsDownloadForm from './permissions-download-form'
import { getUsersPublic } from '@/actions/users/get'
import PermissionsDeleteForm from './permissions-delete-form'

const formSchema = z.object({
  files: z.array(z.instanceof(File)).refine((files) => files.length > 0, {
    message: "Veuillez sélectionner au moins un fichier.",
  }),
})

interface FileUploadProps {
  acceptedFileTypes?: Record<string, string[]>
  multiple?: boolean

  isJustMeViewProps?: boolean
  isJustMeDownloadProps?: boolean
  isJustMeDeleteProps?: boolean

  usersViewProps?: any[]
  usersDownloadProps?: any[]
  usersDeleteProps?: any[]

  permissionsViewProps?: any[]
  permissionsDownloadProps?: any[]
  permissionsDeleteProps?: any[]

  showPermissions?: boolean
}

export default function FileUploadForm({
  acceptedFileTypes,
  multiple = true ,

  isJustMeViewProps = false,
  isJustMeDownloadProps = false,
  isJustMeDeleteProps = false,

  usersViewProps = [],
  usersDownloadProps = [],
  usersDeleteProps = [], 

  permissionsViewProps = [],
  permissionsDownloadProps = [],
  permissionsDeleteProps = [],
  showPermissions = true
}: FileUploadProps) {
  // acceptedFileTypes = {
  //   'image/*': ['.png', '.gif', '.jpeg', '.jpg'],
  //   'video/*': ['.mp4', '.avi', '.mov', '.webm']
  // }
  const [uploading, setUploading] = useState(false)
  const f = useTranslations("Files")
  const s = useTranslations("System")

  const [users, setUsers] = useState([])

  const [isPublicView, setIsPublicView] = useState((isJustMeViewProps ? false : usersViewProps.length === 0? true : permissionsViewProps.length === 0? true : false))
  const [isJustMeView, setIsJustMeView] = useState(isJustMeViewProps)
  const [permissionsView, setPermissionsView] = useState(permissionsViewProps.length === 0? [] : permissionsViewProps)
  const [usersView, setUsersView] = useState<any[]>(usersViewProps.length === 0? [] : usersViewProps)

  const [isPublicDownload, setIsPublicDownload] = useState((isJustMeDownloadProps ? false : usersDownloadProps.length === 0? true : permissionsDownloadProps.length === 0? true : false))
  const [isJustMeDownload, setIsJustMeDownload] = useState(isJustMeDownloadProps)
  const [permissionsDownload, setPermissionsDownload] = useState<any[]>(permissionsDownloadProps.length === 0? [] : permissionsDownloadProps)
  const [usersDownload, setUsersDownload] = useState<any[]>(usersDownloadProps.length === 0? [] : usersDownloadProps)

  const [isPublicDelete, setIsPublicDelete] = useState((isJustMeDeleteProps ? false : usersDeleteProps.length === 0? true : permissionsDeleteProps.length === 0? true : false))
  const [isJustMeDelete, setIsJustMeDelete] = useState(isJustMeDeleteProps)
  const [permissionsDelete, setPermissionsDelete] = useState(permissionsDeleteProps.length === 0? [] : permissionsDeleteProps)
  const [usersDelete, setUsersDelete] = useState(usersDeleteProps.length === 0? [] : usersDeleteProps)

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      files: [],
    },
  })

  useEffect(() => {
    getUsersPublic().then((res: any) => {
      if (res.status === 200 && res.data) {
        setUsers(res.data)
      }
    })
  }, [])

  function onSubmit(values: z.infer<typeof formSchema>) {
    setUploading(true)
    try {
      handleUpload(values.files)
    } catch (error) {
      console.error('Error uploading files:', error)
    } finally {
      setUploading(false)
    }
  }
  const handleUpload = async (file: File[]) => {
    if (file) {
      const data = new FormData()
      data.append("isPublicView", String(isPublicView))
      data.append("isJustMeView", String(isJustMeView))
      data.append("permissionsView", JSON.stringify(permissionsView))
      data.append("usersView", JSON.stringify(usersView))

      data.append("isPublicDownload", String(isPublicDownload))
      data.append("isJustMeDownload", String(isJustMeDownload))
      data.append("permissionsDownload", JSON.stringify(permissionsDownload))
      data.append("usersDownload", JSON.stringify(usersDownload))

      data.append("isPublicDelete", String(isPublicDelete))
      data.append("isJustMeDelete", String(isJustMeDelete))
      data.append("permissionsDelete", JSON.stringify(permissionsDelete))
      data.append("usersDelete", JSON.stringify(usersDelete))

      file.forEach((file) => {
        data.append("file", file)
      })

      const config = {
        onUploadProgress: (progressEvent: any) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          //console.log(percentCompleted);
        }
      }

      axios.post('/api/files', data, config).then((res) => {
        if (res.data.every((s: any) => s.status === 200)) {
          toast.success("File uploaded successfully")
          form.reset()
        } else {
          res.data.forEach((file: any) => {
            file.status !== 200 && toast.error(file.data.message)
          })
        }
      })
    }
  }
  const handleRemoveFile = (event: React.MouseEvent, file: File) => {
    event.stopPropagation()
    form.setValue('files', form.getValues('files').filter(f => f.name !== file.name))
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="files"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{f("title")}</FormLabel>
              <FormControl>
                <FileDropzone
                  onFilesSelected={(files) => field.onChange(
                    field.value.find(file => file.name === files[0].name) ? field.value : [...field.value, ...files]
                  )}
                  value={field.value}
                  accept={acceptedFileTypes}
                  multiple={multiple}
                  onRemove={handleRemoveFile}
                />
              </FormControl>
              <FormDescription>
                {multiple ? f("selectoneormorefiles") : f("selectonefile")}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        {showPermissions &&<div>
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
        </div>}
        <Button type="submit" disabled={uploading} className="relative">
          {uploading ? (
            <>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-5 h-5 border-t-2 border-b-2 border-blue-500 rounded-full animate-spin"></div>
              </div>
            </>
          ) : (
            s("save")
          )}
        </Button>
      </form>
      {uploading && (
        <Loading />
      )}
    </Form>
  )
}
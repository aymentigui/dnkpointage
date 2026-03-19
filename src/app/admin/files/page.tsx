"use client"
import React, { useEffect, useState } from 'react'
import ListFilesWithPreview from './_component/list-all-files-preview'
import { Card } from '@/components/ui/card'
import { getTranslations } from 'next-intl/server'
import ListFilesForm from './_component/list-files-form'
import { useTranslations } from 'next-intl'
import axios from 'axios'
import { useSession } from '@/hooks/use-session'
import { getFileFromLocalHost } from '@/actions/localstorage/util-client'
import { useOrigin } from '@/hooks/use-origin'

const Files = () => {
  // const { session } = useSession()
  const translate = useTranslations("Files")
  // const [files, setFiles] = useState<any[] | []>([])

  // const origin = useOrigin()
  // const [pageSize, setPageSize] = useState("10")
  // const [page, setPage] = useState(1)
  // const [count, setCount] = useState(0)
  // const [type, setType] = useState("")

  // useEffect(() => {
  //   if (!session || !session.user || !session.user.id) return
  //   fetchFile()
  // }, [origin, session, pageSize, page, type])

  // const fetchFile = async () => {
  //   if (!origin) return
  //   const res = await axios(origin + "/api/files", { params: { page: page ?? 1, pageSize: pageSize ?? 10, type: type === "all" ? "" : type } })
  //   const res2 = await axios(origin + "/api/files", { params: { type: type === "all" ? "" : type, count: true } })
  //   if (res.status === 200 && res2.status === 200) {
  //     setFiles(res.data.data)
  //     setCount(res2.data.data)
  //     res.data.data.forEach((file: any) => {
  //       if (file.size > 5242880) return
  //       getFileFromLocalHost(file.id, origin + "/api/files/").then((val) => {
  //         if (val) {
  //           setFiles((p) => p.map((f: any) => f.id === file.id ? { ...f, file: val } : f))
  //         }
  //       })
  //     })
  //   }
  // }

  return (
    <Card className='p-4'>
      {/* <ListFilesSansPreview /> */}
      <div className='text-2xl font-bold p-4'>{translate("title")}</div>
      <div className='p-4'>

      </div>
      <ListFilesWithPreview notAllFile={true} allImage={true} /> 
      {/* <ListFilesForm havetype='image' filesSelected={files} setFilesSelected={setFiles} /> */}
    </Card>
  )
}
 
export default Files

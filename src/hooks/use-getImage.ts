"use client"
import { getImageFromLocalHost } from '@/actions/localstorage/util-client'
import { useEffect, useState } from 'react'

const GetImage = (id:string) => {
    const [src, setSrc] = useState<string | null>(null)

    useEffect(()=>{
        fetch()
    },[])

    const fetch=async ()=>{
        if(!id || id.length===0) return
        setSrc(await getImageFromLocalHost(id)??"no_image")
    }

    if(src==="no_image")
        return "/placeholder.png"

    return src
}

export default GetImage

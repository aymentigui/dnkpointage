import { cn } from '@/lib/utils'
import React from 'react'

interface LoadingProps{
  classSizeProps?:string
}

const Loading = ( {classSizeProps}:LoadingProps ) => {
  return (
    <div className={cn("animate-spin rounded-full border-t-2 border-b-2 border-foreground",classSizeProps?classSizeProps:"h-10 w-10")}></div>
  )
}

export default Loading

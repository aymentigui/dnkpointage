"use server"
import React from 'react'
import { Card } from '@/components/ui/card'
import FileUploadForm from '../_component/forms/upload-files'

const Files = () => {

  return (
    <Card className='p-4'>
      <FileUploadForm />
    </Card>
  )
}

export default Files

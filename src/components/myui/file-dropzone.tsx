import { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload } from 'lucide-react'
import FilePreview from './file-preview'
import { useTranslations } from 'next-intl'

interface FileDropzoneProps {
    onFilesSelected: (files: File[]) => void
    value: File[]
    accept?: Record<string, string[]> | undefined
    multiple?: boolean,
    onRemove?: ( event: React.MouseEvent, file: File ) => void
}

export function FileDropzone({ onFilesSelected, value, accept, multiple = true, onRemove }: FileDropzoneProps) {
    const onDrop = useCallback((acceptedFiles: File[]) => {
        onFilesSelected(multiple ? acceptedFiles : [acceptedFiles[0]])
    }, [onFilesSelected, multiple])

    const f= useTranslations("Files")

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept,
        multiple
    })

    return (
        <div
            {...getRootProps()}
            className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-gray-400 transition-colors"
        >
            <input {...getInputProps()} />
            {isDragActive ? (
                <p>{multiple ? f("drop"): f("drop1") }</p>
            ) : (
                <div>
                    {value && value.length > 0 ? (
                        <div className="flex gap-2 flex-wrap">
                            {value.map((file) => (
                            <FilePreview size='w-20 h-24' key={file.name} file={file} onRemove={onRemove} />
                            ))}
                        </div>
                    ) : (
                        <div>

                            <Upload className="mx-auto h-12 w-12 text-gray-400" />
                            <p>{multiple ? f("draganddrop"): f("draganddrop1") }</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
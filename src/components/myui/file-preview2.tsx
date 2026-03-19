import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, FileImage, FileVideo, Paperclip, FileX, File, X, Trash2, Archive, Type, Camera, Download, SquareArrowOutUpRight, Pen } from "lucide-react";
import "pdfjs-dist/build/pdf.worker";
import { Button } from "../ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";

interface FilePreviewProps {
    file: { fileid: string, filename: string, filetype: string };
    size?: string;
    compact?: boolean;
    onRemove?: (fileid: string) => void;
    onDownload?: (fileid: string) => void;
    onView?: (fileid: string) => void;
    onEdit?: (fileid: string) => void;
}

const FilePreview: React.FC<FilePreviewProps> = ({ file, size = "w-40 h-48", compact = false, onRemove, onDownload, onView, onEdit }) => {
    const [type, setType] = useState<string>("file");
    const [isHovered, setIsHovered] = useState<boolean>(false);

    useEffect(() => {
        if (!file) return;
        const fileType = file.filetype;
        setType(fileType);

    }, [file]);

    const renderIcon = () => {
        const iconSize = compact ? 20 : 32;
        if (type.startsWith("image")) return <Camera size={iconSize} />;
        if (type.startsWith("video")) return <FileVideo size={iconSize} />;
        if (type === "application/pdf") return <Paperclip size={iconSize} />;
        if (type.includes("spreadsheet") || file.filetype.endsWith(".csv")) return <FileX size={iconSize} />;
        if (type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return <FileText size={iconSize} />;
        if (type === "text/plain" || file.filetype.endsWith(".txt")) return <Type size={iconSize} />; // Icône pour les fichiers texte
        if (type === "application/zip" || file.filetype.endsWith(".zip")) return <Archive size={iconSize} />; // Icône pour les fichiers ZIP
        return <File size={iconSize} />;
    };

    return (
        <Card
            className={`${size} flex flex-col items-center shadow-lg relative`}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* <div className={"absolute bottom-2 right-2 flex flex-col gap-2"+ " " + (isHovered ? 'flex' : 'lg:hidden') }> */}
            <div className={"absolute bottom-2 right-2 flex flex-col gap-2" }>
            {onRemove && (
                    <Button
                        type="button"
                        variant={"link"}
                        className={"p-2 bg-red-500 z-40 text-white rounded-md hover:bg-red-600 shadow-md" + " " + (compact ? 'w-8 h-8' : 'w-3 h-3')}
                        onClick={() => onRemove(file.fileid)}
                    >
                        <Trash2 className={compact ? '!w-8 !h-8' : '!w-3 !h-3'} />
                    </Button>
                )}
                {onDownload && (
                    <Button
                        type="button"
                        variant={"link"}
                        className={"p-2 bg-green-500 z-40 text-white rounded-md hover:bg-green-600 shadow-md" + " " + (compact ? 'w-8 h-8' : 'w-3 h-3')}
                        onClick={() => onDownload(file.fileid)}
                    >
                        <Download className={compact ? '!w-8 !h-8' : '!w-3 !h-3'} />
                    </Button>
                )}
                {onView && (
                    <Button
                        type="button"
                        variant={"link"}
                        className={"p-2 bg-gray-500 z-40 text-white rounded-md hover:bg-gray-600 shadow-md" + " " + (compact ? 'w-8 h-8' : 'w-3 h-3')}
                        onClick={() => onView(file.fileid)}
                    >
                        <SquareArrowOutUpRight  className={compact ? '!w-8 !h-8' : '!w-3 !h-3'} />
                    </Button>
                )}
                {onEdit && (
                    <Button
                        type="button"
                        variant={"link"}
                        className={"p-2 bg-orange-500 z-40 text-white rounded-md hover:bg-orange-600 shadow-md" + " " + (compact ? 'w-8 h-8' : 'w-3 h-3')}
                        onClick={() => onEdit(file.fileid)}
                    >
                        <Pen className={compact ? '!w-8 !h-8' : '!w-3 !h-3'} />
                    </Button>
                )}
            </div>
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger
                        className={`${size} flex flex-col items-center relative`}
                    >
                        <p className={`${compact ? 'text-xs' : 'text-sm'} font-semibold mb-1 truncate max-w-full`}>
                            {file.filename}
                        </p>
                        <CardContent className="flex-1 w-full h-full flex items-center justify-center p-1">
                            {(
                                <div className={`${compact ? 'w-12 h-12' : 'w-20 h-20'} flex items-center justify-center`}>
                                    {renderIcon()}
                                </div>
                            )}
                        </CardContent>
                        {isHovered && (
                            <div className="absolute bottom-0 left-0 right-0 bg-foreground bg-opacity-75 text-background text-center p-1 text-xs overflow-hidden">
                                {file.filename}
                            </div>
                        )}
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>{file.filename + " (" + file.filetype + ")"}</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        </Card >
    );
};

export default FilePreview;
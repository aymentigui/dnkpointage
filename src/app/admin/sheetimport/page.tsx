"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { Card, CardTitle } from "@/components/ui/card";
import { useTranslations } from "next-intl";
import ImportSheetsStructure from "@/components/myui/import-sheets-structure";
import { parseSheetFile } from "@/actions/util/importSheets";
import { useImportSheetsStore } from "@/hooks/use-import-csv";

export default function ImportPage() {
    const [file, setFile] = useState<File | null>(null);
    const [previewData, setPreviewData] = useState<any[]>([]);
    const [errors, setErrors] = useState<string[]>([]);
    const { columns, setData } = useImportSheetsStore();
    const refInputFile = useRef<HTMLInputElement>(null);

    const router = useRouter();
    const s = useTranslations("System");
    const e = useTranslations("Error")
    const f = useTranslations("Files")

    useEffect(() => {
        if (!columns || columns.length === 0) {
            router.back();
        }
    }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setFile(e.target.files[0]);
        }
    };

    const handleFileUpload = async () => {
        if (!file) return;
        await parseSheetFile(file, setErrors, setPreviewData, columns);
    };

    const handleConfirm = () => {
        setData(previewData);
        router.back();
    };

    return (
        <Card className='p-4'>
            <CardTitle className="text-2xl font-bold">
                <div className="flex justify-between">
                    <div>
                        {s("import_data")}
                    </div>
                    <Button onClick={() => router.back()} >{s("back")}</Button>
                </div>
            </CardTitle>
            <div className="container mx-auto p-6">
                <div className="m-2 border rounded-lg p-2">
                    <div>
                        <div className="flex gap-4 items-center mb-4">
                            <div onClick={() => refInputFile.current?.click()} className="px-4 py-2 bg-blue-700 text-white w-fit rounded-md cursor-pointer">{f("selectfilesheet")}</div>
                            <div className="px-4 py-2 rounded-md border border-sidebar bg-border">{file && f("title") + " : " + file?.name}</div>
                            <input ref={refInputFile} type="file" accept=".csv,.xls,.xlsx,.ods" onChange={handleFileChange} className="mb-4 hidden" />
                            <Button onClick={handleFileUpload} disabled={!file}>{s("check")}</Button>
                        </div>
                        {errors.length > 0 && (
                            <div className="mt-4 p-4 bg-red-200 text-red-700 rounded">
                                <h2 className="font-bold">{e("errors")}</h2>
                                <ul className="list-disc pl-5">
                                    {errors.map((error, index) => (
                                        <li key={index}>{error}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                    {previewData.length > 0 && (
                        <div className="">
                            <Button variant={"default"} onClick={handleConfirm} className="mt-4 text-white font-bold">{s("confirm")}</Button>
                        </div>
                    )}
                </div>
                <ImportSheetsStructure data={previewData} columns={columns} />
            </div>
        </Card>
    );
}

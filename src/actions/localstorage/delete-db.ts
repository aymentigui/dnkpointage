"use server"
import { prisma } from "@/lib/db";
import { getTranslations } from "next-intl/server";
import { deleteFile } from "./delete";

export const deleteFileDb = async (fileId: string) => {
    const e = await getTranslations('Error');
    const f = await getTranslations('Files')
    const s = await getTranslations('System')

    try {
        const fileexists = await prisma.files.findFirst({ where: { id: fileId } })
        if (!fileexists) {
            return { status: 404, data: { message: f("filedoesnotexist") } }
        }

        await prisma.files.delete({ where: { id: fileId } })

        await deleteFile(fileexists.path)

        return { status: 200, data: { message: s("deletesuccess") } }

    } catch (error) {
        //console.log("error in deleteFileDB");
        return { status: 500, data: { message: e("error") } }

    }
}
"use server"
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { uploadFile } from "./upload";
import { generateRandomFilename, getFileExtension } from "../util/util-public";

export async function uploadFileDB(
    file: File,
    userId: string,
    canViewUsers?: string[],
    canViewPermissions?: string[],
    adminViewOnly?: boolean,

    canDownloadUsers?: string[],
    canDownloadPermissions?: string[],
    adminDownloadOnly?: boolean,

    canDeleteUsers?: string[],
    canDeletePermissions?: string[],
    adminDeleteOnly?: boolean,

): Promise<{ status: number, data: { message?: string, file?: any } }> {

    const s = await getTranslations("System");
    const f = await getTranslations("Files");
    const e = await getTranslations('Error');

    try {
        if (!file) {
            return { status: 400, data: { message: e('badrequest') } }
        }

        const filename = generateRandomFilename()

        if (file.size > 10000000) {
            return { status: 400, data: { message: f('filesizemax') + "10 mo" } }
        }

        const fileUploaded = await uploadFile("uploads/" + filename + "." + getFileExtension(file.name), file)
        if (fileUploaded.status !== 200 || !fileUploaded.data?.path) {
            if (fileUploaded.status === 409) {
                return { status: 409, data: { message: f("fileexists") } };
            }
            return { status: 500, data: { message: e('error') } };
        }

        const fileCreated = await prisma.files.create({
            data: {
                name: filename,
                mime_type: file.type,
                size: file.size,
                extention: getFileExtension(file.name),
                path: fileUploaded.data.path,
                added_from: userId,
                can_view_users: canViewUsers ? canViewUsers.join(",") : null,
                can_download_users: canDownloadUsers ? canDownloadUsers.join(",") : null,
                can_delete_users: canDeleteUsers ? canDeleteUsers.join(",") : null,

                admin_delete_only: adminDeleteOnly ?? false,
                admin_download_only: adminDownloadOnly ?? false,
                admin_view_only: adminViewOnly ?? false,

                can_delete_permissions: canDeletePermissions ? canDeletePermissions.join(",") : null,
                can_download_permissions: canDownloadPermissions ? canDownloadPermissions.join(",") : null,
                can_view_permissions: canViewPermissions ? canViewPermissions.join(",") : null,
            },
        })

        return { status: 200, data: { message: s("createsuccess"), file: fileCreated } };
    } catch (error) {
        console.error("An error occurred in uploadFileDB" + error);
        return { status: 500, data: { message: s("createfail") } };
    }
}

export async function uploadFileDB2(
    data: {
        file: File,
        filename?: string,
        userId: string,
        canViewUsers?: string[],
        canViewPermissions?: string[],
        adminViewOnly?: boolean,

        canDownloadUsers?: string[],
        canDownloadPermissions?: string[],
        adminDownloadOnly?: boolean,

        canDeleteUsers?: string[],
        canDeletePermissions?: string[],
        adminDeleteOnly?: boolean,
    }
): Promise<{ status: number, data: { message?: string, file?: any } }> {

    const s = await getTranslations("System");
    const f = await getTranslations("Files");
    const e = await getTranslations('Error');

    try {
        if (!data.file) {
            return { status: 400, data: { message: e('badrequest') } }
        }

        const filename = data.filename || generateRandomFilename()

        if (data.file.size > 10000000) {
            return { status: 400, data: { message: f('filesizemax') + "10 mo" } }
        }

        const fileUploaded = await uploadFile("uploads/" + filename + "." + getFileExtension(data.file.name), data.file)
        if (fileUploaded.status !== 200 || !fileUploaded.data?.path) {
            if (fileUploaded.status === 409) {
                return { status: 409, data: { message: f("fileexists") } };
            }
            return { status: 500, data: { message: e('error') } };
        }

        const fileCreated = await prisma.files.create({
            data: {
                name: filename,
                mime_type: data.file.type,
                size: data.file.size,
                extention: getFileExtension(data.file.name),
                path: fileUploaded.data.path,
                added_from: data.userId,
                can_view_users: data.canViewUsers ? data.canViewUsers.join(",") : null,
                can_download_users: data.canDownloadUsers ? data.canDownloadUsers.join(",") : null,
                can_delete_users: data.canDeleteUsers ? data.canDeleteUsers.join(",") : null,

                admin_delete_only: data.adminDeleteOnly ?? false,
                admin_download_only: data.adminDownloadOnly ?? false,
                admin_view_only: data.adminViewOnly ?? false,

                can_delete_permissions: data.canDeletePermissions ? data.canDeletePermissions.join(",") : null,
                can_download_permissions: data.canDownloadPermissions ? data.canDownloadPermissions.join(",") : null,
                can_view_permissions: data.canViewPermissions ? data.canViewPermissions.join(",") : null,
            },
        })

        return { status: 200, data: { message: s("createsuccess"), file: fileCreated } };
    } catch (error) {
        console.error("An error occurred in uploadFileDB" + error);
        return { status: 500, data: { message: s("createfail") } };
    }
}
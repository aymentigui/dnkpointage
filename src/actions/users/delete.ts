"use server"

import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { withAuthorizationPermission,verifySession } from "../permissions";
import { deleteFileDb } from "../localstorage/delete-db";

export async function deleteUsers(ids: string[]): Promise<{ status: number, data: any }> {
    const e = await getTranslations('Error');
    const s = await getTranslations('System');
    try {
        const session = await verifySession()
        if (!session || session.status != 200) {
            return { status: 401, data: { message: e('unauthorized') } }
        }
        const hasPermissionAdd = await withAuthorizationPermission(['users_delete']);

        if (hasPermissionAdd.status != 200 || !hasPermissionAdd.data.hasPermission) {
            return { status: 403, data: { message: e('forbidden') } };
        }

        const users = await prisma.user.findMany({
            where: {
                id: {
                    in: ids
                }
            }
        })

        users.map(async (user) => {
            user.image && await deleteFileDb(user.image)
            user.image_compressed && await deleteFileDb(user.image_compressed)
        })

        await prisma.user.updateMany({
            where: {
                id: {
                    in: ids
                }
            },
            data: {
                deleted_at: new Date(),
            }
        })
        return { status: 200, data: { message: s('deletesuccess') } }
    } catch (error) {
        // @ts-ignore
        console.error(error.message);
        return { status: 500, data: { message: e('error') } }
    }
}
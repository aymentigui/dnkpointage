"use server"
import { prisma } from "@/lib/db";
import { getTranslations } from "next-intl/server";
import { withAuthorizationPermission, verifySession } from "../permissions";

export async function AddRole(name: string, permission: string) {
    const e = await getTranslations('Error');
    const s = await getTranslations('System');
    try {
        const session = await verifySession();
        if (!session?.data?.user) {
            return { status: 401, data: { message: e("unauthorized") } };
        }
        const hasPermissionAdd = await withAuthorizationPermission(['roles_create'],session.data.user.id);
        
        if(hasPermissionAdd.status != 200 || !hasPermissionAdd.data.hasPermission) {
            return { status: 403, data: { message: e('forbidden') } };
        }
        
        await prisma.role.create({
            data: {
                name: name.toLowerCase().trim(),
                permissions: permission,
            },
        })
        return { status: 200, data: { message: s("createsuccess") } };
    } catch (error) {
        console.error("An error occurred in AddRolePermission");
        return { status: 500, data: { message: e("error") } };
    }
}

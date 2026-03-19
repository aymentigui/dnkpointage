"use server"

import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { withAuthorizationPermission,verifySession } from "../permissions";

export async function getRoles(): Promise<{ status: number, data: any }> {
    const e = await getTranslations('Error');
    try {
        const session = await verifySession();
        if (!session?.data?.user) {
            return { status: 401, data: { message: e("unauthorized") } };
        }
        const hasPermission = await withAuthorizationPermission(['roles_view'],session.data.user.id);

        if(hasPermission.status != 200 || !hasPermission.data.hasPermission) {
            return { status: 403, data: { message: e('forbidden') } };
        }

        const roles = await prisma.role.findMany({
            where: {
                public : true 
            },
            include: {
                users: {
                    select: {
                        user_id: true
                    }
                }
            }
        });

        const formattedRoles = roles.map(role => ({
            id: role.id,
            name: role.name,
            userCount: role.users.length
        }));

        return { status: 200, data: formattedRoles };
    } catch (error) {
        console.error("An error occurred in getRoles");
        return { status: 500, data: { message: e("error") } };
    }
}

// Get a single role
// muste have permission update
export async function getRole(id: string): Promise<{ status: number, data: any }> {
    const e = await getTranslations('Error');
    try {
        const session = await verifySession();
        if (!session?.data?.user) {
            return { status: 401, data: { message: e("unauthorized") } };
        }
        const hasPermissionAdd = await withAuthorizationPermission(['roles_view'],session.data.user.id);
        
        if(hasPermissionAdd.status != 200 || !hasPermissionAdd.data.hasPermission) {
            return { status: 403, data: { message: e('forbidden') } };
        }
        const role = await prisma.role.findUnique({ where: { id } });
        return { status: 200, data: role };
    } catch (error) {
        console.error("An error occurred in getRole");
        return { status: 500, data: { message: e("error") } };
    }
}
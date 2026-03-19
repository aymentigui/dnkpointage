"use server"

import { prisma } from "@/lib/db";
import { getTranslations } from "next-intl/server";
import { logoutUser } from "./auth/auth";
import { redirect } from "next/navigation";
import { auth } from "@/auth";


//----------------------------------------------
//----------------------------------------------
// we don't use it (use verifySession instead)
//----------------------------------------------
//----------------------------------------------
export async function getSession(): Promise<{ status: number, data: any }> {
    const e = await getTranslations('Error');
    try {
        const session = await auth();
        if (!session) {
            return { status: 401, data: { message: e("unauthorized") } };
        }
        return { status: 200, data: session };
    } catch (error) {
        console.error("An error occurred in getSession");
        return { status: 500, data: { message: e("error") } };
    }
}


export async function verifySession(): Promise<{ status: number, data: any }> {
    const e = await getTranslations('Error');
    try {
        const session = await auth();
        // @ts-ignore
        if (!session || !session.user || !session.session) {
            return { status: 401, data: { message: e("unauthorized") } }
        }

        const existingSession = await prisma.session.findFirst({
            where: {
                // @ts-ignore
                id: session.session.id,
                user_id: session.user.id,
                // @ts-ignore
                browser: session.session.browser,
                // @ts-ignore
                os: session.session.os,
                // @ts-ignore
                deviceType: session.session.deviceType,
                // @ts-ignore
                deviceName: session.session.deviceName,
                // @ts-ignore
                userAgent: session.session.userAgent,
                expires: {
                    gt: new Date()
                }
            }
        })
        if (!existingSession) {
            return { status: 401, data: { message: e("unauthorized") } }
        }

        return { status: 200, data: session }
    } catch (error) {
        console.log("An error occurred in verifySession");
        return { status: 500, data: { message: e("error") } }
    }
}

export async function haveSession() {
    const session = await verifySession();

    if (session.status !== 200 || !session.data || !session.data.user) {
        const LogoutUser = await logoutUser();
        if (LogoutUser.status === 200)
            return redirect('/auth/login');
    }

    return session.data;
}

//----------------------------------------------
//----------------------------------------------

export async function accessPage(requiredPermission: string[], id?: string) {
    try {
        let userId = id;
        if (!userId) {
            const session = await verifySession();
            if (session.status !== 200 || !session.data || !session.data.user || !session.data.user.id) {
                return redirect('/');
            }
            userId = session.data.user.id as string;
        }

        const hasPermission = await withAuthorizationPermission(requiredPermission, userId);

        if (hasPermission.status !== 200 || !hasPermission.data || !hasPermission.data.hasPermission) {
            return redirect('/admin');
        }

        return true;
    } catch (error) {
        console.error("An error occurred in accessPage");
        return redirect('/');
    }
}



//--------------------------------------------------------------
//--------------------------------------------------------------
//--------------------------------------------------------------

export async function getUserPermissions(id: string): Promise<{ status: number, data: any }> {
    const e = await getTranslations('Error');
    try {
        const userPermissions = await prisma.userrole.findMany({
            where: { user_id: id },
            include: { role: true },
        })

        const permissions = userPermissions.flatMap((role) => role.role.permissions.split(","));

        return { status: 200, data: permissions };

    } catch (error) {
        console.error("An error occurred in getUserPermissions");
        return { status: 500, data: { message: e("error") } };
    }
}

export async function getUserRolesNames(id: string): Promise<{ status: number, data: any }> {
    const e = await getTranslations('Error');
    try {
        const userRoles = await prisma.userrole.findMany({
            where: { user_id: id },
            include: { role: true },
        });

        const roles = userRoles.flatMap((role) => role.role.name);

        return { status: 200, data: roles };
    } catch (error) {
        console.error("An error occurred in getUserRoles");
        return { status: 500, data: { message: e("error") } };
    }
}

export async function getUserRolesId(id: string): Promise<{ status: number, data: any }> {
    const e = await getTranslations('Error');
    try {
        const userRoles = await prisma.userrole.findMany({
            where: { user_id: id }
        });

        const roles = userRoles.flatMap((role) => role.role_id);

        return { status: 200, data: roles };
    } catch (error) {
        console.error("An error occurred in getUserRoles");
        return { status: 500, data: { message: e("error") } };
    }
}

export async function withAuthorizationPermission(
    requiredPermission: string[],
    id?: string,
    requireAdmin?: boolean,
) {
    const e = await getTranslations('Error');
    try {
        let userId = id;
        if (!userId) {
            const session = await verifySession();
            if (session.status !== 200 || !session.data || !session.data.user || !session.data.user.id) {
                return { status: 401, data: { message: e("unauthorized") } };
            }
            userId = session.data.user.id as string;
        }

        const is_admin = await ISADMIN(userId);

        if (is_admin.status === 200 && is_admin.data.is_admin) {
            return { status: 200, data: { hasPermission: true } };
        }

        if (requireAdmin) {
            return { status: 403, data: { message: e("forbidden") } };
        }

        const permissions = await getUserPermissions(userId);
        if (permissions.status !== 200 || !permissions.data) {
            return { status: 401, data: { message: e("unauthorized") } };
        }
        if (!requiredPermission.every((permission) => permissions.data.includes(permission))) {
            return { status: 403, data: { message: e("forbidden") } };
        }
        return { status: 200, data: { hasPermission: true } };
    } catch (error) {
        console.error("An error occurred in withAuthorization");
        return { status: 500, data: { message: e("error") } };
    }
}

export async function withAuthorizationRole(
    requiredRole: string[],
    id?: string,
) {
    const e = await getTranslations('Error');
    try {
        let userId = id;
        if (!userId) {
            const session = await verifySession();
            if (session.status !== 200 || !session.data || !session.data.user || !session.data.user.id) {
                return { status: 401, data: { message: e("unauthorized") } };
            }
            userId = session.data.user.id as string;
        }

        const roles = await getUserRolesNames(userId);
        if (roles.status !== 200 || !roles.data) {
            return { status: 401, data: { message: e("unauthorized") } };
        }
        if (!requiredRole.every((role) => roles.data.includes(role))) {
            return { status: 403, data: { message: e("forbidden") } };
        }
        return { status: 200, data: true };
    } catch (error) {
        console.error("An error occurred in withAuthorization");
        return { status: 500, data: { message: e("error") } };
    }
}


export async function ISADMIN(id?: string): Promise<{ status: number, data: any }> {
    const e = await getTranslations('Error');
    try {
        let userId = id;
        if (!userId) {
            const session = await verifySession();
            if (session.status !== 200 || !session.data || !session.data.user || !session.data.user.id) {
                return { status: 401, data: { message: e("unauthorized") } };
            }
            userId = session.data.user.id as string;
        }
        const is_admin = await prisma.user.findUnique({ where: { id: userId } });
        return { status: 200, data: { is_admin: is_admin?.is_admin ? true : false } };
    } catch (error) {
        console.error("An error occurred in ISADMIN");
        return { status: 500, data: { message: e("error") } };
    }
}






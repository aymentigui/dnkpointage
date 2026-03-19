"use server"

import { prisma } from "@/lib/db";
import { getTranslations } from "next-intl/server";
import { withAuthorizationPermission, verifySession } from "../permissions";


export async function getUsers(page: number = 1, pageSize: number = 10, searchQuery?: string): Promise<{ status: number, data: any }> {
    const e = await getTranslations('Error');
    try {
        const session = await verifySession()
        if (!session || session.status != 200) {
            return { status: 401, data: { message: e('unauthorized') } }
        }
        const hasPermissionAdd = await withAuthorizationPermission(['users_view']);

        if (hasPermissionAdd.status != 200 || !hasPermissionAdd.data.hasPermission) {
            return { status: 403, data: { message: e('forbidden') } };
        }

        // Calculer le nombre d'éléments à sauter
        const skip = (page - 1) * pageSize;

        const searchConditions = searchQuery && searchQuery !== ""
            ? {
                OR: [
                    { firstname: { contains: searchQuery } },
                    { lastname: { contains: searchQuery } },
                    { username: { contains: searchQuery } },
                    { email: { contains: searchQuery } },
                ],
                AND: [
                    { public: true }, // Filtrer les utilisateurs non supprimés
                    { deleted_at: null }
                ],
            }
            : {
                AND: [
                    { public: true }, // Filtrer les utilisateurs non supprimés
                    { deleted_at: null } // Filtrer les utilisateurs non supprimés
                ]
            };

        const users = await prisma.user.findMany({
            skip: skip, // Nombre d'éléments à sauter
            take: pageSize === 0 ? undefined : pageSize, // Nombre d'éléments à prendre
            where: searchConditions,
            select: {
                id: true,
                firstname: true,
                lastname: true,
                username: true,
                email: true,
                image: true,
                image_compressed: true,
                is_admin: true,
                roles: {
                    where: {
                        role: {
                            public: true,
                        },
                    },
                    select: {
                        role: {
                            select: {
                                name: true,
                            },
                        },
                    },
                },
            },
        });

        const formattedUsers = users.map((user) => ({
            ...user,
            roles: user.roles.map((role) => role.role.name),
        }));

        return { status: 200, data: formattedUsers };
    } catch (error) {
        console.error("Error fetching users:", error);
        return { status: 500, data: null };
    }
}

export async function getUsersPublic(): Promise<{ status: number, data: any }> {
    const e = await getTranslations('Error');
    try {
        const users = await prisma.user.findMany({
            where: {
                deleted_at: null,
            },
            select: {
                id: true,
                firstname: true,
                lastname: true,
                username: true,
                email: true,
                image_compressed: true,
                roles: {
                    where: {
                        role: {
                            public: true,
                        },
                    },
                    select: {
                        role: {
                            select: {
                                name: true,
                            },
                        },
                    },
                },
            },
        });

        const formattedUsers = users.map((user) => ({
            ...user,
            roles: user.roles.map((role) => role.role.name).join(", "),
        }))

        return { status: 200, data: formattedUsers };
    } catch (error) {
        console.error("Error fetching users:", error);
        return { status: 500, data: null };
    }
}

export async function getAllUsers(): Promise<{ status: number, data: any }> {
    const e = await getTranslations('Error');
    try {
        const session = await verifySession()
        if (!session || session.status != 200) {
            return { status: 401, data: { message: e('unauthorized') } }
        }
        const hasPermissionAdd = await withAuthorizationPermission(['users_view']);

        if (hasPermissionAdd.status != 200 || !hasPermissionAdd.data.hasPermission) {
            return { status: 403, data: { message: e('forbidden') } };
        }
        const users = await prisma.user.findMany({
            where: {
                deleted_at: null,
            },
            select: {
                id: true,
                firstname: true,
                lastname: true,
                username: true,
                email: true,
                image_compressed: true,
                roles: {
                    where: {
                        role: {
                            public: true,
                        },
                    },
                    select: {
                        role: {
                            select: {
                                name: true,
                            },
                        },
                    },
                },
            },
        });

        const formattedUsers = users.map((user) => ({
            ...user,
            roles: user.roles.map((role) => role.role.name).join(", "),
        }))

        return { status: 200, data: formattedUsers };
    } catch (error) {
        console.error("Error fetching users:", error);
        return { status: 500, data: { message: e("badrequest") } };
    }
}

export async function getUsersWithIds(userIds: string[]): Promise<{ status: number, data: any }> {

    const e = await getTranslations('Error');
    try {
        const session = await verifySession()
        if (!session || session.status != 200) {
            return { status: 401, data: { message: e('unauthorized') } }
        }
        const hasPermissionAdd = await withAuthorizationPermission(['users_view']);

        if (hasPermissionAdd.status != 200 || !hasPermissionAdd.data.hasPermission) {
            return { status: 403, data: { message: e('forbidden') } };
        }
        const users = await prisma.user.findMany({
            where: {
                id: {
                    in: userIds,
                },
                deleted_at: null,
            },
            select: {
                id: true,
                firstname: true,
                lastname: true,
                username: true,
                email: true,
                image_compressed: true,
                image: true,
                roles: {
                    where: {
                        role: {
                            public: true,
                        },
                    },
                    select: {
                        role: {
                            select: {
                                name: true,
                            },
                        },
                    },
                },
            },
        });

        const formattedUsers = users.map((user) => ({
            ...user,
            roles: user.roles.map((role) => role.role.name).join(", "),
        }))

        return { status: 200, data: formattedUsers };
    } catch (error) {
        console.error("Error fetching users:", error);
        return { status: 500, data: null };
    }
}


export async function getUser(userId?: string): Promise<{ status: number, data: any }> {

    const e = await getTranslations('Error');
    try {

        const session = await verifySession()
        if (!session || session.status != 200) {
            return { status: 401, data: { message: e('unauthorized') } }
        }

        const id = userId ?? session.data.user.id

        const user = await prisma.user.findUnique({ 
            where: { id },
            select: {
                id: true,
                firstname: true,
                lastname: true,
                username: true,
                email: true,
                image_compressed: true,
                image: true,
                roles: {
                    where: {
                        role: {
                            public: true,
                        },
                    },
                    select: {
                        role: {
                            select: {
                                name: true,
                            },
                        },
                    },
                },
            },
         });
        if (!user) {
            return { status: 400, data: { message: e("usernotfound") } };
        }

        const formattedUser = {
            ...user,
            roles: user.roles.map((role) => role.role.name).join(", "),
        }

        return { status: 200, data: formattedUser };
    } catch (error) {
        console.error("An error occurred in getUserByid");
        return { status: 500, data: { message: e("error") } };
    }
}


export async function getCountUsers(searchQuery?: string): Promise<{ status: number, data: any }> {

    const searchConditions = searchQuery && searchQuery !== ""
        ? {
            OR: [
                { firstname: { contains: searchQuery } },
                { lastname: { contains: searchQuery } },
                { username: { contains: searchQuery } },
                { email: { contains: searchQuery } },
            ],
            AND: [
                { public: true }, // Filtrer les utilisateurs non supprimés
                { deleted_at: null } // Filtrer les utilisateurs non supprimés
            ]
        }
        : {
            AND: [
                { public: true }, // Filtrer les utilisateurs non supprimés
                { deleted_at: null } // Filtrer les utilisateurs non supprimés
            ]
        };

    const e = await getTranslations('Error');
    try {
        const count = await prisma.user.count(
            {
                where: searchConditions,
            }
        );
        return { status: 200, data: count };
    } catch (error) {
        console.error("Error fetching count users:", error);
        return { status: 500, data: null };
    }
}

export async function getUserByid(id: string): Promise<{ status: number, data: any }> {
    const e = await getTranslations('Error');
    try {
        const user = await prisma.user.findUnique({ where: { id } });
        if (!user) {
            return { status: 400, data: { message: e("usernotfound") } };
        }
        return { status: 200, data: user };
    } catch (error) {
        console.error("An error occurred in getUserByid");
        return { status: 500, data: { message: e("error") } };
    }
}



export async function getUserByEmailOrUsername(emailOrUsername: string): Promise<{ status: number, data: any }> {
    const e = await getTranslations('Error');
    try {
        const user = await prisma.user.findFirst(
            { where: { OR: [{ email: emailOrUsername }, { username: emailOrUsername }] } }
        );
        if (!user) {
            return { status: 400, data: { message: e("usernotfound") } };
        }
        return { status: 200, data: user };
    } catch (error) {
        console.error("An error occurred in getUserByid");
        return { status: 500, data: { message: e("error") } };
    }
}

export async function getUserName(id:string){
    try {
        if(!id)
            return ""
        
        const user = await prisma.user.findFirst(
            { where: {id} } 
        );
        if (!user) {
            return ""
        }
        return user.firstname+" "+ user.lastname 
    } catch (error) {
        console.error("An error occurred in getUserByid");
        return "";
    }
}
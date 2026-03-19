import { getTranslations } from "next-intl/server";
import { withAuthorizationPermission, verifySession } from "../permissions";
import { prisma } from "@/lib/db";
import { getTemporaryUrl } from "../superbase/download";
import { addStringToFilenameWithNewExtension } from "../util/util-public";

export async function getUsers(page: number = 1, pageSize: number = 10, searchQuery?: string): Promise<{ status: number, data: any }> {
    const e = await getTranslations('Error');
    try {
        const session = await verifySession()
        if (!session || session.status != 200) {
            return { status: 401, data: { message: e('unauthorized') } }
        }
        const hasPermissionAdd = await withAuthorizationPermission(['users_delete']);

        if (hasPermissionAdd.status != 200 || !hasPermissionAdd.data.hasPermission) {
            return { status: 403, data: { message: e('forbidden') } };
        }

        // Calculer le nombre d'éléments à sauter
        const skip = (page - 1) * pageSize;

        const searchConditions = searchQuery
            ? {
                OR: [
                    { firstname: { contains: searchQuery } },
                    { lastname: { contains: searchQuery } },
                    { username: { contains: searchQuery } },
                    { email: { contains: searchQuery } },
                ],
                AND: [
                    { deleted_at: null }, // S'assurer que l'utilisateur n'est pas supprimé
                    { public: true }
                ]
            }
            : {
                AND: [
                    { deleted_at: null }, // S'assurer que l'utilisateur n'est pas supprimé
                    { public: true }
                ]
            };

        const users = await prisma.user.findMany({
            skip: skip, // Nombre d'éléments à sauter
            take: pageSize, // Nombre d'éléments à prendre
            where: searchConditions,
            select: {
                id: true,
                firstname: true,
                lastname: true,
                username: true,
                email: true,
                image: true,
                is_admin: true,
                roles: {
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

        for (const user of users) {
            if (user.image) {
                const urlImage = await getTemporaryUrl(user.image);
                const urlImageCompressed = await getTemporaryUrl(addStringToFilenameWithNewExtension(user.image, "compressed", "jpg"));
                if (urlImage && urlImage.status === 200 && urlImage.data.url && urlImageCompressed && urlImageCompressed.status === 200 && urlImageCompressed.data.url) {
                    user.image = urlImage.data.url as string;
                    (user as any).imageCompressed = urlImageCompressed.data.url
                } else {
                    user.image = null as never
                    (user as any).imageCompressed = null
                }
            }
        }

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



export async function getUser(): Promise<{ status: number, data: any }> {
    const e = await getTranslations('Error');
    try {

        const session = await verifySession()
        if (!session || session.status != 200) {
            return { status: 401, data: { message: e('unauthorized') } }
        }

        const id=session.data.user.id

        const user = await prisma.user.findUnique({ where: { id } });
        if (!user) {
            return { status: 400, data: { message: e("usernotfound") } };
        }

        if (user.image) {
            const urlImage = await getTemporaryUrl(user.image);
            const urlImageCompressed = await getTemporaryUrl(addStringToFilenameWithNewExtension(user.image, "compressed", "jpg"));
            if (urlImage && urlImage.status === 200 && urlImage.data.url && urlImageCompressed && urlImageCompressed.status === 200 && urlImageCompressed.data.url) {
                user.image = urlImage.data.url as string;
                (user as any).imageCompressed = urlImageCompressed.data.url
            } else {
                user.image = null as never
                (user as any).imageCompressed = null
            }
        }

        return { status: 200, data: user };
    } catch (error) {
        console.error("An error occurred in getUsers");
        return { status: 500, data: { message: e("error") } };
    }
}
"use server"

import { prisma } from "@/lib/db";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import bcrypt from "bcrypt";
import { withAuthorizationPermission, verifySession } from "../permissions";
import { uploadFile } from "../superbase/upload";
import { compressImage } from "../util/util";
import { addStringToFilename } from "../util/util-public";


export async function createUser(data: any) {
    const u = await getTranslations("Users");
    const s = await getTranslations("System");
    const e = await getTranslations('Error');

    const userSchema = z.object({
        firstname: z.string().min(1, u("firstnamerequired")),
        lastname: z.string().min(1, u("lastnamerequired")),
        username: z.string().min(1, u("usernamerequired")),
        email: z.string().email(u("emailinvalid")),
        password: z.string().min(6, u("password6")),
        is_admin: z.boolean().default(false),
        roles: z.array(z.string()).optional(),
        image: z.instanceof(File, { message: u("avatarinvalid") }).optional().refine((file) => !file || file.type.startsWith("image/"), {
            message: u("avatarinvalid")
        })
    });
    try {
        const session = await verifySession()
        if (!session || session.status != 200) {
            return { status: 401, data: { message: e('unauthorized') } }
        }
        const hasPermissionAdd = await withAuthorizationPermission( ['users_create']);

        if (hasPermissionAdd.status != 200 || !hasPermissionAdd.data.hasPermission) {
            return { status: 403, data: { message: e('forbidden') } };
        }
        const result = userSchema.safeParse(data);

        if (!result.success) {
            //console.log(result.error.errors);
            return { status: 400, data: { errors: result.error.errors } };
        }
        const { firstname, lastname, username, email, password, is_admin, roles, image } = result.data;

        const usernameExists = await prisma.user.findUnique({ where: { username } });
        if (usernameExists) {
            return { status: 400, data: { message: u("usernameexists") } };
        }

        const emailExists = await prisma.user.findUnique({ where: { email } });
        if (emailExists) {
            return { status: 400, data: { message: u("emailexists") } };
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await prisma.user.create({
            data: {
                firstname,
                lastname,
                username,
                email,
                password: hashedPassword,
                is_admin: (is_admin && session.data.user.is_admin) ? true : false,
            },
        });

        if (!is_admin) {
            const rolesFound = await prisma.role.findMany({ where: { id: { in: roles } } });
            await prisma.userrole.createMany({
                data: rolesFound.map((role: any) => ({
                    user_id: user.id,
                    role_id: role.id,
                })),
            })
        }

        let imageUrl = null
        let imageCompressedUrl = null
        if (image) {
            if (image?.size > 1000000) {
                return { status: 400, data: { message: u("avatarinvalid") } };
            }

            const arrayBuffer = await image.arrayBuffer();
            // Appeler la Server Action pour compresser l'image
            const result = await compressImage(arrayBuffer, 0.1);
            if (result===null) return { status: 500, data: { message: e("error") } };

            imageUrl = await uploadFile(image, `${user.id}`, "profile-images")
            imageCompressedUrl = await uploadFile(result, `${addStringToFilename(user.id, "compressed")}`, "profile-images")
            
            if (imageUrl.status != 200 || !imageUrl.data.path) return { status: 500, data: { message: e("error") } };
            if (imageCompressedUrl.status != 200 || !imageCompressedUrl.data.path) return { status: 500, data: { message: e("error") } };
            
            await prisma.user.update({
                where: { id: user.id },
                data: {
                    image: imageUrl.data.path,
                }
            })
        }

        return { status: 200, data: { message: s("createsuccess") } };
    } catch (error) {
        console.error("An error occurred in createUser" + error);
        return { status: 500, data: { message: s("createfail") } };
    }
}
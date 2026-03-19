"use server"
import { prisma } from "@/lib/db";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import bcrypt from "bcrypt";
import {  } from "../auth/auth";
import { withAuthorizationPermission,verifySession } from "../permissions";
import { compressImage } from "../util/util";
import { uploadFile } from "../superbase/upload";
import { addStringToFilename, addStringToFilenameWithNewExtension } from "../util/util-public";
import { deleteFile } from "../superbase/delete";

export async function updateUser(id: string, data: any): Promise<{ status: number, data: any }> {
    const u = await getTranslations("Users");
    const s = await getTranslations("System");
    const e = await getTranslations('Error');
    try {
        const session = await verifySession()
        if (!session || session.status != 200) {
            return { status: 401, data: { message: e('unauthorized') } }
        }
        const hasPermissionAdd = await withAuthorizationPermission(['users_update']);

        if (hasPermissionAdd.status != 200 || !hasPermissionAdd.data.hasPermission) {
            return { status: 403, data: { message: e('forbidden') } };
        }
        const userSchema = z.object({
            firstname: z.string().min(1, u("firstnamerequired")),
            lastname: z.string().min(1, u("lastnamerequired")),
            username: z.string().min(1, u("usernamerequired")),
            email: z.string().email(u("emailinvalid")),
            password: z.string().optional(),
            is_admin: z.boolean().default(false),
            roles: z.array(z.string()).optional(),
            image: z.instanceof(File, { message: u("avatarinvalid") }).optional().refine((file) => !file || file.type.startsWith("image/"), {
                message: u("avatarinvalid")
            })
        }).refine((data) => {
            if (!(!data.password || data.password === "" || data.password === null)) {
                return true;
            } else {
                return String(data.password).length < 6;
            }
        }, {
            path: ["password"],
            message: u("password6"),
        });

        if (id == "" || id == undefined) return { status: 400, data: { message: u("usernotfound") } }

        const userExisting = await prisma.user.findUnique({
            where: { id },
        });

        if (!userExisting) {
            return { status: 404, data: { message: u("usernotfound") } };
        }


        const result = userSchema.safeParse(data);
        if (!result.success) {
            //console.log(result.error.errors);
            return { status: 400, data: { errors: result.error.errors } };
        }

        const { firstname, lastname, username, email, password, is_admin, roles, image } = result.data;

        const emailExists = await prisma.user.findUnique({ where: { email } });
        if (emailExists && emailExists.id !== id) {
            return { status: 400, data: { message: u("emailexists") } };
        }

        const usernameExists = await prisma.user.findUnique({ where: { username } });
        if (usernameExists && usernameExists.id !== id) {
            return { status: 400, data: { message: u("usernameexists") } };
        }

        const user = await prisma.user.update({
            where: { id },
            data: {
                firstname,
                lastname,
                username,
                email,
                is_admin: (is_admin && session.data.user.is_admin) ? true : false,
            },
        })

        if (password  && password !== "") {
            const hashedPassword = await bcrypt.hash(password, 10);
            await prisma.user.update({
                where: { id },
                data: {
                    password: hashedPassword,
                },
            })
        }

        await prisma.userrole.deleteMany({ where: { user_id: id } })
        if (is_admin) {
            if (roles && roles.length > 0) {
                await prisma.userrole.createMany({
                    data: roles.map((role: string) => ({
                        user_id: id,
                        role_id: role,
                    })),
                })
            }
        }

        let imageUrl = null
        let imageCompressedUrl = null
        if (image && image.size > 0) {
            if (user.image){
                const success1 = await deleteFile(user.image)
                if(success1.status != 200) return { status: 500, data: { message: e("error") } };
                const success2 = await deleteFile(addStringToFilenameWithNewExtension(user.image, "compressed","jpg"))
                if(success2.status != 200) return { status: 500, data: { message: e("error") } };
            }
            
            if (image?.size > 10000000) {
                return { status: 400, data: { message: u("avatarinvalid") } };
            }

            const arrayBuffer = await image.arrayBuffer();

            // Appeler la Server Action pour compresser l'image
            const result = await compressImage(arrayBuffer, 0.1);
            if (result === null) return { status: 500, data: { message: e("error") } };
            

            imageUrl = await uploadFile(image, `${id}`, "profile-images")

            imageCompressedUrl = await uploadFile(result, `${addStringToFilename(id, "compressed")}`, "profile-images")

            if (imageUrl.status != 200 || !imageUrl.data.path) return { status: 500, data: { message: e("error") } };
            if (imageCompressedUrl.status != 200 || !imageCompressedUrl.data.path) return { status: 500, data: { message: e("error") } };

            await prisma.user.update({
                where: { id: id },
                data: {
                    image: imageUrl.data.path,
                }
            })
        }
        return { status: 200, data: { message: s("updatesuccess") } }
    } catch (error) {
        console.error("An error occurred in updateUser")
        return { status: 500, data: { message: e("error") } }
    }
}

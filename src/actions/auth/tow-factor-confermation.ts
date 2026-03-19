"use server"
import { prisma } from "@/lib/db";
import { getTranslations } from "next-intl/server";

export async function createTowFactorConfermation(id: string) : Promise<{ status: number, data: any }> {
    const e=await getTranslations('Error');
    try {
        const existingTwoFactorConfermation=await getTowFactorConfermationByUserId(id);
        if(existingTwoFactorConfermation.status===200 && existingTwoFactorConfermation.data){
            await deleteTowFactorConfermationByUserId(id);
        }
        const verificationToken=await prisma.twofactorconfermation.create({
            data : {
                user_id: id,
                expired_at: new Date(new Date().getTime() + 1000 * 60 * 5)
            }
        })
        return { status: 200, data: verificationToken };
    } catch (error) {
        console.error("An error occurred in createTowFactorConfermation");
        return { status: 500, data: { message: e("error") } };  
    }
}

export async function getTowFactorConfermationByUserId(id: string) : Promise<{ status: number, data: any }> {
    const e=await getTranslations('Error');

    try {
        const verificationToken=await prisma.twofactorconfermation.findFirst({
            where : {
                user_id: id
            }
        })
        if(!verificationToken){
            return { status: 404, data: { message: e("verificationtokennotfound") } };
        }
        return { status: 200, data: verificationToken };
    } catch (error) {
        console.error("An error occurred in getTowFactorConfermationByUserId");
        return { status: 500, data: { message: 'An error occurred in getTowFactorConfermationByUserId' } };  
    }
}

export async function deleteTowFactorConfermationByUserId(id: string) : Promise<{ status: number, data: any }> {
    const e=await getTranslations('Error');
    try {
        const verificationToken=await prisma.twofactorconfermation.deleteMany({
            where : {
                user_id: id
            }
        })
        return { status: 200, data: verificationToken };
    } catch (error) {
        console.error("An error occurred in deleteTowFactorConfermation");
        return { status: 500, data: { message: e("error") } };  
    }
}

"use server"
import { prisma } from "@/lib/db";
import { user } from "@prisma/client";
import { getTranslations } from "next-intl/server";

export async function getSessions(user:user): Promise<{ status: number, data: any }> {
    const e = await getTranslations('Error');
    try {
        const sessions = await prisma.session.findMany(
            {
                where: {
                    user_id: user.id
                }
            }
        );

        const sessionsFormatted = sessions.map((session) => ({
            id: session.id,
            deviceType: session.device_type ?? "Unknown",
            deviceName: session.device_name ?? "Unknown",
            browser: session.browser ?? "Unknown",
            os: session.os ?? "Unknown",
            createdAt: session.expires.toISOString(),
        }));

        return { status: 200, data: sessionsFormatted }
    } catch (error) {
        console.error("An error occurred in getInfo");
        return { status: 500, data: { message: e("getInfo") } }
    }
}
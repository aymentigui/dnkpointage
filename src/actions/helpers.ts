"use server";
import { prisma } from "@/lib/db";
import { getTranslations } from "next-intl/server";

export async function getUserByid(
  id: string,
): Promise<{ status: number; data: any }> {
  const e = await getTranslations("Error");
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

export async function getUserByEmailOrUsername(
  emailOrUsername: string,
): Promise<{ status: number; data: any }> {
  const e = await getTranslations("Error");
  try {
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: emailOrUsername }, { username: emailOrUsername }],
      },
    });
    if (!user) {
      return { status: 400, data: { message: e("usernotfound") } };
    }
    return { status: 200, data: user };
  } catch (error) {
    console.error("An error occurred in getUserByid");
    return { status: 500, data: { message: e("error") } };
  }
}

export async function findExistingSession(
  userId: string,
  deviceName: string,
  deviceType: string,
  browser: string,
  os: string,
) {
  try {
    console.log("userId", userId);
    console.log("deviceName", deviceName);
    console.log("deviceType", deviceType);
    console.log("browser", browser);
    console.log("os", os);
    const existingSession = await prisma.session.findFirst({
      where: {
        user_id: userId || "Unknown",
        device_name: deviceName || "Unknown",
        device_type: deviceType,
        browser: browser,
        os: os,
        OR: [
          {
            active: false,
          },
          {
            active: true,
            expires: {
              gte: new Date(),
            },
          },
        ],
      },
    });
    return existingSession;
  } catch (error) {
    console.error("An error occurred in findExistingSession", error);
    return null;
  }
}

export async function createNewSession(
  userId: string,
  sessionToken: string,
  deviceName: string,
  deviceType: string,
  browser: string,
  os: string,
) {
  try {
    const newSession = await prisma.session.create({
      data: {
        session_token: sessionToken,
        user_id: userId || "Unknown",
        expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        device_name: deviceName || "Unknown",
        device_type: deviceType,
        browser: browser,
        os: os,
        active: true,
      },
    });
    return newSession;
  } catch (error) {
    console.error("An error occurred in createNewSession");
    return null;
  }
}

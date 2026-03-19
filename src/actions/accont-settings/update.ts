"use server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import bcrypt from "bcrypt";
import { verifySession } from "../permissions";
import { getTranslations } from "next-intl/server";
import { compressImage } from "../util/util";
import { deleteFileDb } from "../localstorage/delete-db";
import { uploadFileDB } from "../localstorage/upload-db";

export async function updateEmail(
  email: string,
): Promise<{ status: number; data: { message: string } }> {
  const EmailSchema = z.string().email({ message: "Adresse e-mail invalide" });
  const e = await getTranslations("Error");
  const u = await getTranslations("Users");
  const s = await getTranslations("System");

  const session = await verifySession();
  if (!session || session.status != 200) {
    return { status: 401, data: { message: e("unauthorized") } };
  }

  try {
    if (!email) {
      return { status: 400, data: { message: u("emailrequired") } };
    }

    if (!EmailSchema.safeParse(email).success) {
      return { status: 400, data: { message: u("emailinvalid") } };
    }
    const userExists = await prisma.user.findUnique({
      where: { email },
    });
    if (userExists) {
      return { status: 400, data: { message: u("emailexists") } };
    }
    const user = await prisma.user.update({
      where: { id: session.data.user.id },
      data: { email },
    });

    return { status: 200, data: { message: s("updatesuccess") } };
  } catch (error) {
    console.error("An error occurred in updateEmail");
    return { status: 500, data: { message: s("updatefail") } };
  }
}
export async function updateUsername(
  username: string,
): Promise<{ status: number; data: { message: string } }> {
  const e = await getTranslations("Error");
  const u = await getTranslations("Users");
  const s = await getTranslations("System");

  const UsernameSchema = z.string().min(6, { message: u("username6") });

  const session = await verifySession();
  if (!session || session.status != 200) {
    return { status: 401, data: { message: e("unauthorized") } };
  }

  try {
    if (!username) {
      return { status: 400, data: { message: u("usernamerequired") } };
    }

    if (!UsernameSchema.safeParse(username).success) {
      return { status: 400, data: { message: u("usernameinvalid") } };
    }
    const userExists = await prisma.user.findUnique({
      where: { username },
    });
    if (userExists) {
      return { status: 400, data: { message: u("usernameexists") } };
    }
    await prisma.user.update({
      where: { id: session.data.user.id },
      data: { username },
    });

    return { status: 200, data: { message: s("updatesuccess") } };
  } catch (error) {
    console.error(s("updatefail"));
    return {
      status: 500,
      data: { message: "An error occurred in updateUsername" },
    };
  }
}

export async function updateInfo(
  firstname: string,
  lastname: string,
): Promise<{ status: number; data: { message: string } }> {
  const e = await getTranslations("Error");
  const u = await getTranslations("Users");
  const s = await getTranslations("System");

  const Scema = z.object({
    firstname: z.string().min(1, { message: u("firstnamerequired") }),
    lastname: z.string().min(1, { message: u("lastnamerequired") }),
  });
  const session = await verifySession();
  if (!session || session.status != 200) {
    return { status: 401, data: { message: e("unauthorized") } };
  }

  try {
    if (!firstname) {
      return { status: 400, data: { message: u("firstnamerequired") } };
    }
    if (!lastname) {
      return { status: 400, data: { message: u("lastnamerequired") } };
    }

    if (!Scema.safeParse({ firstname, lastname }).success) {
      return { status: 400, data: { message: u("firstnamerequired") } };
    }
    await prisma.user.update({
      where: { id: session.data.user.id },
      data: { firstname, lastname },
    });

    return { status: 200, data: { message: s("updatesuccess") } };
  } catch (error) {
    console.error(s("updatefail"));
    return {
      status: 500,
      data: { message: "An error occurred in updateUserInfo" },
    };
  }
}

export async function updateTwoFactorConfermation(
  twoFactorConfermation: boolean,
): Promise<{ status: number; data: { message: string } }> {
  const e = await getTranslations("Error");
  const s = await getTranslations("System");

  const session = await verifySession();
  if (!session || session.status != 200) {
    return { status: 401, data: { message: e("unauthorized") } };
  }

  try {
    await prisma.user.update({
      where: { id: session.data.user.id },
      data: { is_two_factor_enabled: twoFactorConfermation },
    });

    return { status: 200, data: { message: s("updatesuccess") } };
  } catch (error) {
    console.error("An error occurred in updateTwoFactorConfermation");
    return { status: 500, data: { message: s("updatefail") } };
  }
}

export async function updatePassword(
  currentPassword: string,
  newPassword: string,
): Promise<{ status: number; data: { message: string } }> {
  const e = await getTranslations("Error");
  const s = await getTranslations("System");
  const u = await getTranslations("Users");
  const t = await getTranslations("Settings");

  const ResetPasswordSchema = z.string().min(6, { message: u("password6") });

  const session = await verifySession();
  if (!session || session.status != 200) {
    return { status: 401, data: { message: e("unauthorized") } };
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.data.user.id },
    });
    if (!user) {
      return { status: 400, data: { message: e("usernotfound") } };
    }

    const passwordMatch = await bcrypt.compare(currentPassword, user.password!);
    if (!passwordMatch) {
      return { status: 400, data: { message: u("currentpasswordinvalid") } };
    }

    if (!ResetPasswordSchema.safeParse(newPassword).success) {
      return { status: 400, data: { message: t("passwordinvalid") } };
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: session.data.user.id },
      data: { password: hashedPassword },
    });

    return { status: 200, data: { message: s("updatesuccess") } };
  } catch (error) {
    console.error("An error occurred in updatePassword");
    return { status: 500, data: { message: s("updatefail") } };
  }
}

export async function deleteSession(id: string) {
  const session = await verifySession();
  const e = await getTranslations("Error");
  const ss = await getTranslations("Sessions");
  const s = await getTranslations("System");

  if (!session || session.status != 200) {
    return { status: 401, data: { message: e("unauthorized") } };
  }

  const sessionExisting = await prisma.session.findFirst({
    where: {
      id: id,
      user_id: session.data.user.id,
    },
  });

  if (!sessionExisting) {
    return { status: 400, data: { message: ss("sessionnotfound") } };
  }
  await prisma.session.deleteMany({
    where: {
      id: id,
      user_id: session.data.user.id,
    },
  });
  return { status: 200, data: { message: s("deletesuccess") } };
}

export async function deleteAllSessions() {
  const session = await verifySession();
  const s = await getTranslations("System");
  const e = await getTranslations("Error");
  const ss = await getTranslations("Sessions");

  if (!session || session.status != 200) {
    return { status: 401, data: { message: e("unauthorized") } };
  }

  const sessionExisting = await prisma.session.findFirst({
    where: {
      user_id: session.data.user.id,
    },
  });

  if (!sessionExisting) {
    return { status: 400, data: { message: ss("sessionnotfound") } };
  }
  await prisma.session.deleteMany({
    where: {
      user_id: session.data.user.id,
    },
  });

  return { status: 200, data: { message: s("deletesuccess") } };
}

export async function updateImage(
  image: File,
): Promise<{ status: number; data: { message: string } }> {
  const e = await getTranslations("Error");
  const s = await getTranslations("System");
  const u = await getTranslations("Users");
  const f = await getTranslations("Files");

  const ImageScema = z.object({
    image: z
      .instanceof(File, { message: u("avatarinvalid") })
      .optional()
      .refine((file) => !file || file.type.startsWith("image/"), {
        message: u("onlyimagesallowed"),
      }),
  });

  const session = await verifySession();
  if (!session || session.status != 200) {
    return { status: 401, data: { message: e("unauthorized") } };
  }

  try {
    if (!image || image.size === 0) {
      const user = await prisma.user.findUnique({
        where: { id: session.data.user.id },
      });
      await prisma.user.update({
        where: { id: session.data.user.id },
        data: { image: "", image_compressed: "" },
      });
      if (user?.image) await deleteFileDb(user?.image);
      if (user?.image_compressed) await deleteFileDb(user?.image_compressed);
      return { status: 200, data: { message: s("updatesuccess") } };
    }

    if (!ImageScema.safeParse(image).success) {
      return { status: 400, data: { message: u("onlyimagesallowed") } };
    }

    if (image.size > 10000000) {
      return { status: 400, data: { message: f("filesizemax") + " 10Mo" } };
    }
    const userExists = await prisma.user.findUnique({
      where: { id: session.data.user.id },
    });

    userExists?.image && (await deleteFileDb(userExists.image));
    userExists?.image_compressed &&
      (await deleteFileDb(userExists.image_compressed));

    const arrayBuffer = await image.arrayBuffer();

    // Appeler la Server Action pour compresser l'image
    const result = await compressImage(arrayBuffer, 0.1);
    if (result === null) return { status: 500, data: { message: e("error") } };

    const res1 = await uploadFileDB(image, session.data.user.id);
    const res2 = await uploadFileDB(result, session.data.user.id);

    let imageId, imageCompressedId;

    if (res1.status === 200 || res1.data.file.id) imageId = res1.data.file.id;
    if (res2.status === 200 || res2.data.file.id)
      imageCompressedId = res2.data.file.id;

    await prisma.user.update({
      where: { id: userExists?.id },
      data: {
        image: imageId,
        image_compressed: imageCompressedId,
      },
    });

    return { status: 200, data: { message: s("updatesuccess") } };
  } catch (error) {
    console.error(s("updatefail") + error);
    return {
      status: 500,
      data: { message: "An error occurred in updateImage" },
    };
  }
}

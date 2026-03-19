"use server";

import { supabase } from "@/lib/supabase";

export async function deleteFile(filePath: string, bucketName = "private"): Promise<{ status: number, data: { message?: string, succes?: boolean } }> {
    if (!filePath)
        return { status: 400, data: { message: "Aucun chemin fourni" } };

    const { error } = await supabase.storage
        .from(bucketName)
        .remove([filePath]);

    if (error)
        return { status: 500, data: { message: error.message } };
    return { status: 200, data: { succes: true } };
}

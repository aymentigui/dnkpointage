"use server";

import { supabase } from "@/lib/supabase";
import { getFileExtension } from "../util/util-public";

export async function uploadFile(file: File, filename: string, filePath: string, bucketName = "private") : Promise<{ status: number, data: { message?: string, succes?: boolean, path?: string } }> {
    if (!file)
        return { status: 400, data: { message: "Aucun chemin fourni" } };

    const fileExtension = getFileExtension(file.name);
    const { error } = await supabase.storage
        .from(bucketName)
        .upload(filePath+"/"+filename+"."+fileExtension, file, {
            upsert: false,
        });
    if (error){
        //console.log(error);
        return { status: 500, data: { message: error.message } };
    }
    return { status: 200, data: { succes : true, path: filePath+"/"+filename+"."+fileExtension,} };
}

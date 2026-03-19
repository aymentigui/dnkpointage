"use server";

import { supabase } from "@/lib/supabase";

export async function getTemporaryUrl(filePath: string, bucketName = "private", expireIn = 60) : Promise<{ status: number, data: { message?: string, url?: string } }> {
  if (!filePath)
    return { status: 400, data: { message: "Aucun chemin fourni" } };

  const { data, error } = await supabase.storage
    .from(bucketName)
    .createSignedUrl(filePath, expireIn); // Lien valide pour 60 secondes

  if (error){
    //console.log(error);
    return { status: 500, data: { message: error.message } };
  }

  return { status: 200, data: { url: data.signedUrl } };
}

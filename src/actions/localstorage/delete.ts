"use server"
import path from 'path';
import fs from 'fs';

/**
 * deleteFile
 *
 * Supprime un fichier du stockage local.
 *
 * @param {string} filename Le nom du fichier à supprimer avec son chemin avec extention
 * @returns {Promise<{status: number}>} Retourne un objet avec un status. 
 * Le status est 200 si le fichier est supprimé avec succès, 404 si le fichier n'existe pas, 
 * et 400 si le nom du dossier ou du fichier n'est pas fourni.
 */


export const deleteFile = async (filename : string) => {
    if (!filename) 
        return { status: 400 }

    const filePath = path.join(process.cwd(),filename);
    
    if(!fs.existsSync(filePath)) 
        return { status: 404 }

    fs.unlinkSync(filePath);
    return { status: 200 }
}
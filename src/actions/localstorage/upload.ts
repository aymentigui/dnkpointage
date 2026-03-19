"use server"
import path from 'path';
import * as fs from 'fs';
/**
 * uploadFile
 *
 * @param {string} filePathNameExtension Le nom du fichier avec son chemin sans extention
 * @param {File} file Le fichier a uploader
 * @returns {Promise<{status: number, data: {message?: string, succes?: boolean, path?: string}}>} Retourne un objet avec un status  et un message. Si le fichier est upload avec succes, le status est a 200 et le message contient le chemin du fichier.
 */

export const uploadFile = async (filePathNameExtension: string, file: File) => {
    if (!filePathNameExtension) {
        return { status: 400 };
    }

    const folderPath = path.dirname(path.join(process.cwd(), filePathNameExtension));

    if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
    }
    const filePath = path.join(process.cwd(), filePathNameExtension);

    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, Buffer.from(await file.arrayBuffer()));
        return { status: 200, data: { path: filePathNameExtension} };
    } else {
        return { status: 409 };
    }
};
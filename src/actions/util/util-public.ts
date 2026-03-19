export const getFileExtension = (filename: string): string => {
    const parts = filename.split(".");
    return parts.length > 1 ? parts.pop() || "" : "";
};

export const addStringToFilename = (filePath: string, str: string): string => {
    const pathParts = filePath.split("/"); // Séparer le chemin du fichier
    const filename = pathParts.pop() || ""; // Récupérer le nom du fichier

    const nameParts = filename.split(".");
    if (nameParts.length > 1) {
        const extension = nameParts.pop(); // Récupère l'extension
        return `${pathParts.join("/")}/${nameParts.join(".")}_${str}.${extension}`;
    }

    return `${pathParts.join("/")}/${filename}_${str}`; // Si pas d'extension
};

export const addStringToFilenameWithNewExtension = (filePath: string, str: string, newExtension: string): string => {
    const pathParts = filePath.split("/"); // Séparer le chemin du fichier
    const filename = pathParts.pop() || ""; // Récupérer le nom du fichier

    const nameParts = filename.split(".");
    nameParts.pop(); // Supprime l'ancienne extension

    return `${pathParts.join("/")}/${nameParts.join(".")}_${str}.${newExtension}`;
};


export function generateToken4Chiffres(): string {
    const min = 1000; // Le minimum à 4 chiffres
    const max = 9999; // Le maximum à 4 chiffres
    const token = Math.floor(Math.random() * (max - min + 1)) + min;
    return token.toString();
}

const mimeTypes: { [key: string]: string } = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    pdf: "application/pdf",
    txt: "text/plain",
    csv: "text/csv",
    json: "application/json",
    zip: "application/zip",
    mp4: "video/mp4",
    mp3: "audio/mpeg",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export function getMimeType(extension: string): string {
    return mimeTypes[extension.toLowerCase()] || "application/octet-stream";
}

export function generateRandomFilename() {
    const timestamp = Date.now(); // Obtenir un timestamp unique
    const randomString = Math.random().toString(36).substring(2, 10); // Chaîne aléatoire
    return `file_${timestamp}_${randomString}`;
}


export function hasPermissionDeleteFile(file: any,session:any) {
    let havePermission=true
    const canDeletePermissions = file.can_delete_permissions ? file.can_delete_permissions.split(',') : []
    const canDeleteUsers = file.can_delete_users ? file.can_delete_users.split(',') : []
    if (!session && (canDeleteUsers.length > 0 || canDeletePermissions.length > 0)) {
        havePermission = false
    }
    if (session && session.user && !session.user.is_admin) {
        havePermission = canDeletePermissions.length === 0 || canDeletePermissions.some((p: any) => session.user.permissions.includes(p)) || canDeleteUsers.includes(session.user.id)
    }
    if(session && session.user && file.added_from===session.user.id)
        havePermission=true
    return havePermission
}

export function hasPermissionDownloadFile(file: any,session:any) {
    let havePermission=true
    
    const canDownloadPermissions = file.can_download_permissions ? file.can_download_permissions.split(',') : []
    const canDownloadUsers = file.can_download_users ? file.can_download_users.split(',') : []
    if (!session && (canDownloadPermissions.length > 0 || canDownloadUsers.length > 0)) {
        havePermission = false
    }
    if (session && session.user && !session.user.is_admin) {
        havePermission = canDownloadPermissions.length === 0 || canDownloadPermissions.some((p: any) => session.user.permissions.includes(p)) || canDownloadUsers.includes(session.user.id)
    }
    if(session && session.user && file.added_from===session.user.id)
        havePermission=true
    return havePermission
}


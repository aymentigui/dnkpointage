
/**
 * This function downloads a file from a given URL and triggers a download with the specified file name.
 * It creates a temporary anchor element, sets its href to the URL, and initiates a download.
 * The temporary URL created for the blob is revoked after the download to release memory.
 *
 * @param {string} url - The URL of the file to be downloaded.
 * @param {string} fileName - The name to be used for the downloaded file.
 */

import axios from "axios";

export const downloadFile = async (url: string, filename: string) => {
    //window.open("/api/files/cm6wn8z1m0001v8h87h9s05ve", "_blank");
    const link = document.createElement("a");
    link.href = url; // Lien vers ton API Next.js
    link.setAttribute("download", filename); // Nom du fichier
    link.style.display = "none"; // Masquer le lien
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// --------------------------------------------------------

export const downloadFileFromLocalHost = async (idFile: string, filename?: string, origin = "/api/files/") => {
    //window.open("/api/files/cm6wn8z1m0001v8h87h9s05ve", "_blank");
    const link = document.createElement("a");
    link.href = origin + idFile + "?allFile=true"; // Lien vers mon API Next.js
    link.setAttribute("download", filename ?? "file"); // Nom du fichier
    link.style.display = "none"; // Masquer le lien
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

export const ViewFileFromLocalHost = async (idFile: string, origin = "/api/files/") => {
    //window.open("/api/files/cm6wn8z1m0001v8h87h9s05ve", "_blank");
    window.open(origin + idFile + "?allFile=true", "_blank");
}

export const deleteFileFromLocalHost = async (idFile: string, origin = "/api/files/") => {
    const response = await axios.delete(origin + idFile);
    if (response.status !== 200) {
        //console.log("Erreur lors du suppression de l'image");
        return;
    }
    return response
};


// --------------------------------------------------------

export const getFileBlobFromLocalHost = async (idFile: string, allFile = "false", origin = "/api/files/", type?: string) => {
    try {
        const response = type === "image"
            ? await fetch(origin + idFile)
            : await fetch(origin + idFile + "?allFile=" + allFile);
        if (!response.ok) {
            //console.log("Erreur lors du téléchargement de l'image");
            return;
        }
        let metadata = null
        if (response.headers.get("X-File-Metadata")) {
            metadata = JSON.parse(response.headers.get("X-File-Metadata") || '{}')
        }
        if (!metadata) return
        const blob = await response.blob();
        return { blob, metadata };
    }catch(erreur){
        return null
    }
};

export const getImageFromLocalHost = async (idFile: string, origin = "/api/files/",) => {
    const blob = await getFileBlobFromLocalHost(idFile, "true", origin + "image/", "image");
    if (!blob) return null;
    const url = URL.createObjectURL(blob.blob);
    return url ?? null
};

export const getImageFileFromLocalHost = async (idFile: string, origin = "/api/files/",) => {
    const blob = await getFileBlobFromLocalHost(idFile, "true", origin + "image/", "image");
    if (!blob) return "null";
    const file = new File([blob?.blob], blob.metadata.name ?? "file", { type: blob.metadata.mime_type });
    return file;
};

export const getFileFromLocalHost = async (idFile: string, origin = "/api/files/") => {
    const blob = await getFileBlobFromLocalHost(idFile, "true", origin);
    if (!blob) return null;
    const file = new File([blob?.blob], blob.metadata.name ?? "file", { type: blob.metadata.mime_type });
    return file;
};


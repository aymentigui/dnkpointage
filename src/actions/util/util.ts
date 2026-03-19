import sharp from "sharp";

/**
 * Compresse une image et retourne le buffer compressé.
 * @param file - Le fichier sous forme de Buffer ou ArrayBuffer.
 * @param compressRatio - Le ratio de compression (entre 0 et 1).
 * @returns Le buffer de l'image compressée ou null si ce n'est pas une image.
 */
export async function compressImage(
  file: Buffer | ArrayBuffer,
  compressRatio: number,
): Promise<File | null> {
  // Convertir ArrayBuffer en Buffer si nécessaire
  const buffer = Buffer.isBuffer(file) ? file : Buffer.from(file);

  // Vérifier si le fichier est une image
  const isImage = await checkIfImage(buffer);
  if (!isImage) {
    return null; // Retourne null si ce n'est pas une image
  }

  // Valider le ratio de compression
  if (compressRatio < 0 || compressRatio > 1) {
    throw new Error("Le ratio de compression doit être entre 0 et 1.");
  }

  // Compresser l'image avec sharp
  const compressedImageBuffer = await sharp(buffer)
    .jpeg({ quality: Math.floor(compressRatio * 100) }) // Convertir le ratio en pourcentage de qualité
    .toBuffer();

  // Convertir le buffer en fichier (File)
  const compressedImageFile = new File(
    [new Uint8Array(compressedImageBuffer)],
    "compressed-image.jpg",
    {
      type: "image/jpeg",
    },
  );

  return compressedImageFile;
}

/**
 * Vérifie si un fichier est une image.
 * @param buffer - Le fichier sous forme de Buffer.
 * @returns true si c'est une image, sinon false.
 */
async function checkIfImage(buffer: Buffer): Promise<boolean> {
  try {
    const metadata = await sharp(buffer).metadata();
    return !!metadata.format; // Retourne true si le format est détecté
  } catch (error) {
    return false; // Retourne false en cas d'erreur
  }
}

export function formatDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function parseDate(dateStr: string): Date | null {
  // Format DD/MM/YYYY
  const match = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (match) {
    return new Date(`${match[3]}-${match[2]}-${match[1]}`);
  }
  return null;
}

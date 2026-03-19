import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ==================== AJOUTER À LA FIN ====================

/**
 * Formater la taille d'un fichier
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

/**
 * Télécharger un fichier (blob)
 */
export function downloadFile(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

/**
 * Grouper un tableau par propriété
 */
export function groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
  return array.reduce(
    (result, item) => {
      const groupKey = String(item[key]);
      if (!result[groupKey]) result[groupKey] = [];
      result[groupKey].push(item);
      return result;
    },
    {} as Record<string, T[]>,
  );
}

/**
 * Debounce pour les recherches
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Récupérer le libellé d'une annotation
 */
export function getAnnotLabel(code: string): string {
  const labels: Record<string, string> = {
    M: "Mission",
    J: "Justifié",
    Md: "Maladie",
    Rc: "Récupération",
    C: "Congé",
    Ce: "Congé exceptionnel",
  };
  return labels[code] || code;
}

/**
 * Récupérer la couleur d'une annotation
 */
export function getAnnotColor(code: string): string {
  const colors: Record<string, string> = {
    M: "#f5d764",
    J: "#a8d8a8",
    Md: "#f5a0c8",
    Rc: "#a0c8f5",
    C: "#c8a0f5",
    Ce: "#f5c8a0",
    P: "#c8f564",
    A: "#f56464",
    R: "#6488f5",
  };
  return colors[code] || "#888899";
}

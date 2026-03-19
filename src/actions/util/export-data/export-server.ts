import fs from 'fs';
import { Parser } from 'json2csv';
import ExcelJS from 'exceljs';

interface Selector {
  title: string;
  selector: string;
}

interface Data {
  [key: string]: any;
}

/**
 * Generates and downloads a file (CSV or Excel) based on the provided data and selectors.
 *
 * @param selectors - An array of objects defining the column titles and the corresponding keys in the data.
 * @param data - An array of objects containing the data to be exported.
 * @param type - The type of file to generate:
 *               - `1` for CSV
 *               - Any other value for Excel
 * @param path - The file path where the generated file will be saved.
 *
 * The function extracts the column titles from the `selectors` parameter and maps the data accordingly.
 * If `type` is `1`, it generates a CSV file using `json2csv` and saves it to the specified path.
 * Otherwise, it generates an Excel file using `ExcelJS` and saves it to the specified path.
 */

export async function generateFileServer(selectors: Selector[], data: Data[], type: number, path: string): Promise<string> {
  // Vérification de la validité des données
//   if (selectors.length !== Object.keys(data[0]).length) {
//     throw new Error('Le nombre d\'éléments dans selectors doit être égal au nombre d\'éléments dans chaque objet de data');
//   }

  // Extraire les titres des colonnes à partir de selectors
  const columns = selectors.map((selector) => selector.title);

  if (type === 1) {
    // Générer un fichier CSV
    const csvParser = new Parser({ fields: columns });
    const csv = csvParser.parse(data);

    // Sauvegarder le fichier CSV sur le serveur
    fs.writeFileSync(path, csv);
    return path; // Retourne le chemin du fichier enregistré
  } else {
    // Générer un fichier Excel
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Data');

    // Ajouter la première ligne (titres des colonnes)
    worksheet.addRow(columns);

    // Ajouter les lignes de données
    data.forEach((item) => {
      const row = selectors.map((selector) => item[selector.selector]);
      worksheet.addRow(row);
    });

    // Sauvegarder le fichier Excel
    await workbook.xlsx.writeFile(path);
    return path; // Retourne le chemin du fichier enregistré
  }
}

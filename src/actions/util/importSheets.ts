import ExcelJS from "exceljs";
import Papa from "papaparse";
import moment from "moment";

export interface ColumnCvcImport {
  title: string;
  require?: { req: boolean; message?: string };
  type?: { tp: "string" | "number" | "date"; message: string };
  condition?: { cond: (value: any) => boolean; message: string }[];
}

export const parseSheetFile = async (
  file: File | null,
  setErrors: (errors: string[]) => void,
  setPreviewData: (data: any[]) => void,
  columns: ColumnCvcImport[]
): Promise<void> => {
  if (!file) return;

  const fileType = file.name.split(".").pop()?.toLowerCase();

  if (fileType === "csv") {
    parseCSV(file, setErrors, setPreviewData, columns);
  } else if (["xlsx", "xls", "ods"].includes(fileType!)) {
    parseExcel(file, setErrors, setPreviewData, columns);
  } else {
    setErrors(["Format de fichier non supporté"]);
    setPreviewData([]);
  }
};

// ✅ Gérer les fichiers CSV
const parseCSV = (file: File, setErrors: (errors: string[]) => void, setPreviewData: (data: any[]) => void, columns: ColumnCvcImport[]) => {
  const reader = new FileReader();
  reader.onload = (event) => {
    const text = event.target?.result as string;
    Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        validateData(result.data, setErrors, setPreviewData, columns);
      },
    });
  };
  reader.readAsText(file);
};

// ✅ Gérer les fichiers Excel (XLSX, XLS, ODS)
const parseExcel = async (file: File, setErrors: (errors: string[]) => void, setPreviewData: (data: any[]) => void, columns: ColumnCvcImport[]) => {
  const reader = new FileReader();
  reader.onload = async (event) => {
    const data = event.target?.result as ArrayBuffer;
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(data);
    const worksheet = workbook.worksheets[0];

    let jsonData: any[] = [];
    worksheet.eachRow((row, rowIndex) => {
      if (rowIndex === 1) return; // Ignorer la première ligne (entêtes)

      let rowData: any = {};
      columns.forEach((col, colIndex) => {
        let cellValue = row.getCell(colIndex + 1).value;

        // Si la colonne est de type date, la formater correctement
        if (col.type?.tp === "date" && cellValue) {
          if (cellValue instanceof Date) {
            // Convertir la date au format "DD/MM/YYYY"
            cellValue = moment(cellValue).format("DD/MM/YYYY");
          } else if (typeof cellValue === "number") {
            // Excel stocke les dates comme des nombres, il faut les convertir
            const excelDate = new Date((cellValue - 25569) * 86400 * 1000);
            cellValue = moment(excelDate).format("DD/MM/YYYY");
          }
        }

        rowData[col.title] = cellValue;
      });

      jsonData.push(rowData);
    });

    validateData(jsonData, setErrors, setPreviewData, columns);
  };

  reader.readAsArrayBuffer(file);
};


// ✅ Vérification des données pour tous les fichiers
const validateData = (data: any[], setErrors: (errors: string[]) => void, setPreviewData: (data: any[]) => void, columns: ColumnCvcImport[]) => {
  let errorMessages: string[] = [];

  data.forEach((row, index) => {
    columns.forEach((col) => {
      const value = row[col.title];

      if (col.require?.req && (!value || value.toString().trim() === "")) {
        errorMessages.push(`Ligne ${index + 1}: ${col.require.message}`);
      }

      if (col.type) {
        if (col.type.tp === "number" && isNaN(Number(value))) {
          errorMessages.push(`Ligne ${index + 1}: ${col.type.message}`);
        }
        if (col.type.tp === "date" && value && !moment(value, ["DD/MM/YYYY", "MM-DD-YYYY", "YYYY.MM.DD", "YYYY-MM-DD", "D/M/YYYY", "M/D/YYYY"], true).isValid()) {
          errorMessages.push(`Ligne ${index + 1}: ${col.type.message}`);
        }
      }

      if (col.condition && value) {
        col.condition.forEach((condObj) => {
          if (!condObj.cond(value)) {
            errorMessages.push(`Ligne ${index + 1}: ${condObj.message}`);
          }
        });
      }
    });
  });

  if (errorMessages.length > 0) {
    setErrors(errorMessages);
    setPreviewData([]);
  } else {
    setErrors([]);
    setPreviewData(data);
  }
};

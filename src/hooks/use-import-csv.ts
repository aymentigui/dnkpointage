import { create } from "zustand";

export interface ColumnSheetsImport {
    title: string;
    require?: { req: boolean; message?: string };
    type?: { tp: "string" | "number" | "date"; message: string };
    condition?: { cond: (value: any) => boolean; message: string }[];
  }
  

interface ImportSheetsStore {
  columns: ColumnSheetsImport[];
  data: any[];
  setColumns: (columns: ColumnSheetsImport[]) => void;
  setData: (data: any[]) => void;
}

export const useImportSheetsStore = create<ImportSheetsStore>((set) => ({
  columns: [],
  data: [],
  setColumns: (columns) => set({ columns }),
  setData: (data) => set({ data }),
}));
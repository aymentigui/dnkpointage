import { ColumnSheetsImport } from "@/hooks/use-import-csv";

export const columns: ColumnSheetsImport[] = [
    {
        title: "nom",
        require: { req: true, message: "Ce champ est obligatoire" },
        type: { tp: "string", message: "Ce champ doit être une chaîne de caractères" },
        condition: [],
    },
    {
        title: "age",
        require: { req: false },
        type: { tp: "number", message: "Ce champ doit être un entier" },
        condition: [
            { cond: (val: number) => Number(val) > 0, message: "L'âge doit être supérieur à 0" },
        ],
    },
    {
        title: "date",
        require: { req: false },
        type: { tp: "date", message: "Ce champ doit être une date valide" },
        condition: [
            // { cond: (val: string) => moment(val, "YYYY-MM-DD").isAfter(moment()), message: "La date doit être supérieure à aujourd'hui" },
        ],
    },
];

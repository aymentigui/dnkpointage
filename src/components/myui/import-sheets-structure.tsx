import { FC } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { ColumnCvcImport } from "@/actions/util/importSheets";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { AlertCircle } from "lucide-react";


interface ImportSheetsStructureProps {
  columns: ColumnCvcImport[];
  data?: any
}

const ImportSheetsStructure: FC<ImportSheetsStructureProps> = ({ columns, data }) => {
  return (
    <div className="space-y-6 m-2">
      <div className="border rounded-lg p-2">
        <Table className="border">
          <TableHeader>
            <TableRow>
              {columns.map((col, index) => (
                <TableHead key={index}>{col.title}  {col.require?.req && <span style={{ color: "red", fontWeight: "bold" }}> *</span>} </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.map((row: any, index: number) => (
              <TableRow key={index}>
                {columns.map((col, colIndex) => (
                  <TableCell key={colIndex}>
                    {row[col.title] instanceof Date
                      ? row[col.title].toLocaleDateString()  // format localisé
                      : row[col.title]}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {!(data.length > 0) && columns.some(col => col.require?.message || col.type?.message || col.condition?.length) && (
        <Card className="p-4">
          {columns.map((col, index) => (
            (col.require?.message || col.type?.message || col.condition?.length) && (
              <div key={index} className="mt-2">
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>{col.title}</AlertTitle>
                  <AlertDescription>
                    {col.require?.message && <li>{col.require.message}</li>}
                    {col.type?.message && <li>{col.type.message}</li>}
                    {col.condition?.map((cond, i) => <li key={i}>{cond.message}</li>)}
                  </AlertDescription>
                </Alert>
              </div>
            )
          ))}
        </Card>
      )}
    </div>
  );
};

export default ImportSheetsStructure;
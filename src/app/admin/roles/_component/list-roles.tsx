import { DataTable } from "./data-table/data-table-role";
import { columns } from "./data-table/columns-role";
import { getTranslations } from "next-intl/server";


export default async function RolesPage() {
  const r=await getTranslations("Roles")

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-2xl font-bold mb-4">{r("title")}</h1>
      <DataTable columns={columns}  />
    </div>
  );
}
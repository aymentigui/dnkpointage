"use client";
import { ColumnDef } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import { useTranslations } from "next-intl";

export type Permission = {
    name: string;
    group: string; // Nouvelle propriété ajoutée
};

const headerColumn = ( )=>{
    const p=useTranslations("Permissions")
    return p("title")
}

const cellColumn = ( value: string )=>{
    const p=useTranslations("Permissions")
    return p(value)
}


export const columns: ColumnDef<Permission>[] = [
    {
        accessorKey: "name",
        header: headerColumn,
        cell: (info) => (
            <div className="font-medium text-sm text-gray-700">
                {cellColumn(info.getValue() as string)}
            </div>
        ),
    },
    {
        id: "select", // Changement d'ID de "actions" à "select" pour plus de clarté dans une table de sélection
        header: ({ table }) => {
            const allSelected = table.getIsAllRowsSelected();

            return (
                <Checkbox
                    checked={allSelected}
                    onCheckedChange={(value) => {
                        table.toggleAllRowsSelected(!!value);
                    }}
                    aria-label="Select all"
                />
            );
        },
        cell: ({ row }) => {
            return (
                <Checkbox
                    checked={row.getIsSelected()}
                    onCheckedChange={(value) => row.toggleSelected(!!value)}
                    aria-label="Select row"
                />
            );
        },
    },
];

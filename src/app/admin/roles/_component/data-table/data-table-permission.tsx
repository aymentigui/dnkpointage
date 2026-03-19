"use client";

import * as React from "react";
import {
    flexRender,
    getCoreRowModel,
    useReactTable,
} from "@tanstack/react-table";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { columns, Permission } from "./columns-permission"; // Importez les colonnes
import { useEffect, useState } from "react";
import Cookies from 'js-cookie';
import { useTranslations } from "next-intl";

interface DataTableProps {
    permissions: Permission[];
    selectedPermissions: string[];
    selectedPermissionNames?: string[];
    setSelectedPermissions: (permissions: string[]) => void;
    setSelectedPermissionsName: (permissions: string[]) => void;
}

// Fonction utilitaire pour regrouper les permissions
interface GroupedPermission {
    group: string;
    items: Permission[];
}

const getGroupedPermissions = (permissions: Permission[]): GroupedPermission[] => {
    const grouped = permissions.reduce((acc, permission) => {
        const groupKey = permission.group || 'other';
        if (!acc[groupKey]) {
            acc[groupKey] = [];
        }
        acc[groupKey].push(permission);
        return acc;
    }, {} as Record<string, Permission[]>);

    return Object.entries(grouped).map(([group, items]) => ({ group, items }));
};

export function DataTable({
    permissions,
    selectedPermissions,
    selectedPermissionNames,
    setSelectedPermissions,
    setSelectedPermissionsName
}: DataTableProps) {

    const [selectedLanguage, setSelectedLanguage] = useState("");
    const s = useTranslations('System');
    const p = useTranslations('Permissions'); // Pour les traductions de groupe

    useEffect(() => {
        setSelectedLanguage(Cookies.get('lang') || 'en')
    }, [])

    const table = useReactTable({
        data: permissions,
        columns,
        getCoreRowModel: getCoreRowModel(),
        enableRowSelection: true,
        state: {
            // Logique de sélection basée sur le nom de la permission (name)
            rowSelection: selectedPermissionNames
                ? selectedPermissionNames.reduce((acc, name) => {
                      const index = permissions.findIndex((permission) => permission.name === name);
                      if (index !== -1) {
                          // TanStack Table utilise l'index de la ligne comme clé par défaut
                          acc[index] = true; 
                      }
                      return acc;
                  }, {} as Record<string, boolean>)
                : {}, // Si on n'utilise pas les noms, on initialise vide (devrait toujours utiliser les noms ici)
        },
        onRowSelectionChange: (updaterOrValue) => {
            const newRowSelection =
                typeof updaterOrValue === "function"
                    ? updaterOrValue(table.getState().rowSelection)
                    : updaterOrValue;

            const selectedIndices = Object.keys(newRowSelection).filter(
                (index) => newRowSelection[index]
            );

            // Récupère les objets Permission originaux via l'index de la ligne
            const selectedItems = selectedIndices.map(index => table.getRowModel().rows[parseInt(index, 10)].original);
            
            // Met à jour les états avec les noms de permission
            const names = selectedItems.map(item => item.name);
            const ids = selectedItems.map(item => item.name); // En l'absence d'ID unique, on utilise le nom
            
            setSelectedPermissionsName(names)
            setSelectedPermissions(ids);
        },
    });
    
    // Regroupement des données pour l'affichage
    const groupedData = React.useMemo(() => getGroupedPermissions(permissions), [permissions]);

    // Fonction pour trouver la ligne TanStack correspondante à une Permission
    const findRow = (permission: Permission) => {
        return table.getRowModel().rows.find(r => r.original.name === permission.name);
    }

    return (
        <div className="rounded-xl border shadow-sm">
            <Table>
                <TableHeader>
                    {table.getHeaderGroups().map((headerGroup) => (
                        <TableRow key={headerGroup.id} className="hover:bg-transparent">
                            {headerGroup.headers.map((header) => (
                                <TableHead key={header.id}
                                    className={`
                                        bg-gray-50/70 text-xs font-bold uppercase text-gray-500
                                        ${selectedLanguage === "ar" ? "text-right" : "text-left"}
                                    `}>
                                    {flexRender(
                                        header.column.columnDef.header,
                                        header.getContext()
                                    )}
                                </TableHead>
                            ))}
                        </TableRow>
                    ))}
                </TableHeader>
                <TableBody>
                    {table.getRowModel().rows?.length ? (
                        groupedData.map(({ group, items }) => (
                            <React.Fragment key={group}>
                                {/* Ligne de Titre de Groupe */}
                                <TableRow className="bg-primary/10 hover:bg-primary/10 transition-colors">
                                    <TableCell 
                                        colSpan={columns.length} 
                                        className="font-extrabold uppercase text-primary text-sm py-2"
                                    >
                                        {p(group)} {/* Traduction du nom du groupe (ex: roles -> Rôles) */}
                                    </TableCell>
                                </TableRow>

                                {/* Lignes de Permissions du Groupe */}
                                {items.map((permission) => {
                                    const row = findRow(permission);
                                    if (!row) return null;

                                    return (
                                        <TableRow 
                                            key={row.id} 
                                            data-state={row.getIsSelected() && "selected"}
                                            className="hover:bg-gray-50/50"
                                        >
                                            {row.getVisibleCells().map((cell) => (
                                                <TableCell key={cell.id} className="py-2">
                                                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                </TableCell>
                                            ))}
                                        </TableRow>
                                    );
                                })}
                            </React.Fragment>
                        ))
                    ) : (
                        <TableRow>
                            <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                                {s("noresults")}
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    );
}

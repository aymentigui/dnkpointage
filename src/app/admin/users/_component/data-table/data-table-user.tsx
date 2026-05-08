// src/components/data-table.tsx
"use client";

import * as React from "react";
import {
    flexRender,
    getCoreRowModel,
    getSortedRowModel,
    useReactTable,
    SortingState,
} from "@tanstack/react-table";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslations } from "next-intl";
import Cookies from 'js-cookie';

import { Columns, columns as baseColumns } from "./columns-table"; // Renommé 'columns' en 'baseColumns' pour éviter la confusion
import SearchTable from "@/components/myui/table/search-table";
import TablePagination from "@/components/myui/table/table-pagination";
import { useSession } from "@/hooks/use-session";
import { Badge } from "@/components/ui/badge";

// --- Interfaces et Types ---

interface DataTableProps {
    data: Columns[];
    selectedIds: string[];
    setSelectedIds: (ids: string[]) => void;
    isLoading: boolean;
    debouncedSearchQuery?: string;
    setDebouncedSearchQuery: (query: string) => void;
    page?: number;
    setPage?: (page: number) => void; // Changé any à number pour une meilleure type safety
    pageSize: number;
    count: number;
    showPagination?: boolean;
    showSearch?: boolean;
}

// --- Composant Principal ---

export function DataTable({
    data,
    selectedIds,
    setSelectedIds,
    isLoading,
    debouncedSearchQuery,
    setDebouncedSearchQuery,
    page,
    setPage,
    pageSize,
    count,
    showPagination = false,
    showSearch = false,
}: DataTableProps) {
    const t = useTranslations('System');
    const [sorting, setSorting] = React.useState<SortingState>([]);
    const [selectedLanguage, setSelectedLanguage] = React.useState<string>('en');

    // Récupérer la session utilisateur
    const { session } = useSession();

    // Déterminer si l'utilisateur a la permission d'afficher la colonne "Actions"
    const hasPermissionAction = React.useMemo(() => (
        session?.user?.is_admin ||
        session?.user?.permissions.some((permission: string[]) =>
            permission.includes("users_update") || permission.includes("users_delete")
        )
    ), [session]);

    // Définir les colonnes à afficher en filtrant la colonne 'actions' si l'utilisateur n'a pas la permission
    const columns = React.useMemo(() => {
        if (!hasPermissionAction) {
            return baseColumns.filter(col => col.id !== "actions");
        }
        return baseColumns;
    }, [hasPermissionAction]);

    // Mettre à jour la langue au montage du composant
    React.useEffect(() => {
        setSelectedLanguage(Cookies.get('lang') || 'en');
    }, []);


    // Convertir les IDs sélectionnés (string[]) en un format `rowSelection` pour `useReactTable`
    const rowSelectionState = React.useMemo(() => {
        return selectedIds.reduce((acc, id) => {
            // Trouver l'index de la donnée dans le tableau pour React Table
            const index = data.findIndex((element) => element.id === id);
            if (index !== -1) {
                // L'index doit être une string pour le state de React Table
                acc[String(index)] = true;
            }
            return acc;
        }, {} as Record<string, boolean>);
    }, [selectedIds, data]);

    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        onSortingChange: setSorting,
        state: {
            sorting,
            rowSelection: rowSelectionState, // Utiliser l'état dérivé
        },
        onRowSelectionChange: (updaterOrValue) => {
            const newRowSelection =
                typeof updaterOrValue === "function"
                    ? updaterOrValue(table.getState().rowSelection)
                    : updaterOrValue;

            // Récupérer les index des lignes sélectionnées
            const selectedIndexes = Object.keys(newRowSelection).filter(
                (index) => newRowSelection[index]
            );

            // Mapper les index sélectionnés aux IDs d'origine
            const newSelectedIds = selectedIndexes.map((index) => {
                // Chercher la ligne par son index dans le modèle de lignes de la table
                const row = table.getRowModel().rows.find((r) => r.index === Number(index));
                // Retourner l'ID d'origine (fallback à une chaîne vide si non trouvé)
                return row?.original.id || '';
            }).filter(id => id !== ''); // Filtrer les IDs vides

            setSelectedIds(newSelectedIds);
        },
    });

    // --- Rendu ---

    return (
        <div className="space-y-4">
            {showSearch && (
                <SearchTable
                    setPage={setPage}
                    page={page}
                    debouncedSearchQuery={debouncedSearchQuery}
                    setDebouncedSearchQuery={setDebouncedSearchQuery}
                />
            )}

            <Card className="shadow-sm">
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="p-4 space-y-2">
                            <Skeleton className="h-6 w-1/4" />
                            <div className="border rounded-md">
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-12 w-full" />
                                <Skeleton className="h-12 w-full" />
                                <Skeleton className="h-12 w-full" />
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="p-4 border-b">
                                <Badge variant="secondary" className="text-xs font-semibold">
                                    {t("total")}: {count}
                                </Badge>
                                {selectedIds.length > 0 && (
                                    <Badge variant="default" className="ml-2 text-xs font-semibold bg-blue-500 hover:bg-blue-600">
                                        {t("selected")}: {selectedIds.length}
                                    </Badge>
                                )}
                            </div>
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        {table.getHeaderGroups().map((headerGroup) => (
                                            <TableRow key={headerGroup.id}>
                                                {headerGroup.headers.map((header) => {
                                                    // Ne pas afficher l'en-tête "actions" si l'utilisateur n'a pas la permission
                                                    const isActionHeader = header.id === "actions";
                                                    if (isActionHeader && !hasPermissionAction) {
                                                        return null;
                                                    }

                                                    return (
                                                        <TableHead
                                                            key={header.id}
                                                            className={`${selectedLanguage === "ar" ? "text-right" : "text-left"} ${isActionHeader ? "w-[130px]" : ""}`}
                                                        >
                                                            {header.isPlaceholder
                                                                ? null
                                                                : flexRender(
                                                                    header.column.columnDef.header,
                                                                    header.getContext()
                                                                )}
                                                        </TableHead>
                                                    );
                                                })}
                                            </TableRow>
                                        ))}
                                    </TableHeader>
                                    <TableBody>
                                        {table.getRowModel().rows?.length ? (
                                            table.getRowModel().rows.map((row) => (
                                                <TableRow
                                                    key={row.id}
                                                    data-state={row.getIsSelected() && "selected"}
                                                    className="hover:bg-muted/50 transition-colors"
                                                >
                                                    {row.getVisibleCells().map((cell) => {
                                                        // Ne pas afficher la cellule "actions" si la colonne est masquée
                                                        if (cell.column.id === "actions" && !hasPermissionAction) {
                                                            return null;
                                                        }

                                                        return (
                                                            <TableCell key={cell.id}>
                                                                {flexRender(
                                                                    cell.column.columnDef.cell,
                                                                    cell.getContext()
                                                                )}
                                                            </TableCell>
                                                        )
                                                    })}
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                                                    {t("noresults")} 🤷‍♂️
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Pagination */}
            {!isLoading && showPagination && setPage && (
                <TablePagination
                    page={page}
                    setPage={setPage}
                    count={count}
                    pageSize={pageSize}
                    isLoading={isLoading}
                    debouncedSearchQuery={debouncedSearchQuery}
                />
            )}
        </div>
    );
}
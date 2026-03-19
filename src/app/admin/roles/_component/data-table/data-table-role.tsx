"use client";

import * as React from "react";
import {
    ColumnDef,
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getSortedRowModel,
    useReactTable,
    SortingState,
} from "@tanstack/react-table";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle } from "lucide-react";

import { useTranslations } from "next-intl";
import Cookies from 'js-cookie';
import { useSession } from "@/hooks/use-session";
import { useOrigin } from "@/hooks/use-origin";
import axios from "axios";
import toast from "react-hot-toast";

// Types
interface DataTableProps<TData, TValue> {
    columns: ColumnDef<TData, TValue>[];
}

interface RoleData {
    id: string;
    name: string;
    userCount: number;
}

// Composant principal
export function DataTable<TData extends RoleData, TValue>({
    columns: allColumns,
}: DataTableProps<TData, TValue>) {

    const t = useTranslations('System');
    const r = useTranslations('Roles');

    const [data, setData] = React.useState<TData[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [sorting, setSorting] = React.useState<SortingState>([]);
    const [globalFilter, setGlobalFilter] = React.useState('');
    const [selectedLanguage, setSelectedLanguage] = React.useState<string>('en');

    const origin = useOrigin();
    const { session } = useSession();

    // Permissions check
    const hasPermissionAction = React.useMemo(() => (
        session?.user?.is_admin ||
        session?.user?.permissions.some((permission: string) =>
            permission === "roles_update" || permission === "roles_delete"
        )
    ), [session]);

    // Filtrer les colonnes si l'utilisateur n'a pas la permission d'action
    const columns = React.useMemo(() => {
        if (!hasPermissionAction) {
            return allColumns.filter(col => col.id !== "actions");
        }
        return allColumns;
    }, [hasPermissionAction, allColumns]);

    // Fetch data
    React.useEffect(() => {
        if (!origin) return;

        setSelectedLanguage(Cookies.get('lang') || 'en');
        setIsLoading(true);

        const fetchRoles = async () => {
            try {
                const response = await axios.get(origin + "/api/admin/roles");
                setData(response.data as TData[]);
            } catch (error: any) {
                toast.error(error.message || t('data_fetch_error'));
            } finally {
                setIsLoading(false);
            }
        };

        fetchRoles();
    }, [origin, t]);

    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getSortedRowModel: getSortedRowModel(),
        onSortingChange: setSorting,
        onGlobalFilterChange: setGlobalFilter,
        state: {
            sorting,
            globalFilter,
        },
    });

    // --- Rendu du composant ---

    const isEmpty = table.getRowModel().rows?.length === 0 && !isLoading && globalFilter === '';
    const isFilteredEmpty = table.getRowModel().rows?.length === 0 && !isLoading && globalFilter !== '';

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <Input
                    placeholder={r("searchroles")}
                    value={globalFilter}
                    onChange={(event) => setGlobalFilter(event.target.value)}
                    className="max-w-sm rounded-lg shadow-sm focus-visible:ring-2 focus-visible:ring-primary/50"
                />
            </div>

            <Card className="shadow-lg">
                <CardHeader className="p-4 border-b">
                    <CardTitle className="text-lg font-bold">{r("title")}</CardTitle>
                </CardHeader>
                <CardContent className="p-0 overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-muted/50">
                            {table.getHeaderGroups().map((headerGroup) => (
                                <TableRow key={headerGroup.id}>
                                    {headerGroup.headers.map((header) => {
                                        // On vérifie de nouveau la permission pour le rendu de l'en-tête
                                        const isActionHeader = header.id === "actions";
                                        if (isActionHeader && !hasPermissionAction) {
                                            return null;
                                        }

                                        return (
                                            <TableHead
                                                key={header.id}
                                                className={`
                                                    ${selectedLanguage === "ar" ? "text-right" : "text-left"}
                                                    ${isActionHeader ? "w-[130px]" : "w-auto"}
                                                    font-semibold text-xs uppercase text-muted-foreground
                                                `}
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
                            {isLoading ? (
                                // Affichage du squelette de chargement
                                Array.from({ length: 5 }).map((_, index) => (
                                    <TableRow key={index}>
                                        {columns.map((col, cellIndex) => (
                                            <TableCell key={cellIndex} className="py-4">
                                                <Skeleton className="h-6 w-full" />
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            ) : isEmpty ? (
                                // Aucun résultat initial
                                <TableRow>
                                    <TableCell colSpan={columns.length} className="h-40 text-center text-muted-foreground">
                                        <AlertTriangle className="h-6 w-6 mx-auto mb-2 text-primary" />
                                        {r("no_roles_found")}
                                    </TableCell>
                                </TableRow>
                            ) : isFilteredEmpty ? (
                                // Aucun résultat pour le filtre
                                <TableRow>
                                    <TableCell colSpan={columns.length} className="h-40 text-center text-muted-foreground">
                                        {r("no_match_filter")}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                // Affichage des données
                                table.getRowModel().rows.map((row) => (
                                    <TableRow key={row.id} data-state={row.getIsSelected() && "selected"} className="hover:bg-muted/50 transition-colors">
                                        {row.getVisibleCells().map((cell) => {
                                            // On vérifie de nouveau la permission pour le rendu de la cellule
                                            if (cell.column.id === "actions" && !hasPermissionAction) {
                                                return null;
                                            }
                                            return (
                                                <TableCell key={cell.id} className="py-3">
                                                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                </TableCell>
                                            )
                                        })}
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}

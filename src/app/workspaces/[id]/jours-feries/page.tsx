// app/jours-feries/page.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
    Plus,
    Search,
    Edit,
    Trash2,
    X,
    Calendar as CalendarIcon,
} from "lucide-react";

// Composants shadcn/ui
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Pagination,
    PaginationContent,
    PaginationEllipsis,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
} from "@/components/ui/pagination";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Calendar } from "@/components/ui/calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

// API
import { joursFeriesApi } from "@/lib/api";
import toast from "react-hot-toast";
import { AppShell } from "@/components/layout/AppShell";
import { useSession } from "@/hooks/use-session";

// Types
interface JourFerie {
    id: string;
    nom: string;
    date_debut: string;
    date_fin: string;
    recurrent: boolean;
    type: string;
    description: string;
    created_at: string;
    created_by?: string;
}

interface FormData {
    nom: string;
    date_debut: Date;
    date_fin: Date;
    recurrent: boolean;
    type: string;
    description: string;
}

export default function JoursFeriesPage() {
    const [joursFeries, setJoursFeries] = useState<JourFerie[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);

    const params = useParams()
    const router = useRouter()
    const searchParams = useSearchParams()
    const workspaceId = params.id as string

    // Dialog states
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<JourFerie | null>(null);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<string | null>(null);

    // permission
    const { session } = useSession();

    const hasPermissionAddJourFerie = useMemo(() => (
        session?.user?.is_admin || session?.user?.permissions.some((p: string[]) => p.includes("add_jour_ferie"))
    ), [session]);

    const hasPermissionUpdateJourFerie = useMemo(() => (
        session?.user?.is_admin || session?.user?.permissions.some((p: string[]) => p.includes("update_jour_ferie"))
    ), [session]);

    const hasPermissionDeleteJourFerie = useMemo(() => (
        session?.user?.is_admin || session?.user?.permissions.some((p: string[]) => p.includes("delete_jour_ferie"))
    ), [session]);

    const hasPermissionViewJourFerie = useMemo(() => (
        session?.user?.is_admin || session?.user?.permissions.some((p: string[]) => p.includes("view_jour_ferie"))
    ), [session]);

    // Form state
    const [formData, setFormData] = useState<FormData>({
        nom: "",
        date_debut: new Date(),
        date_fin: new Date(),
        recurrent: false,
        type: "",
        description: "",
    });

    const [formErrors, setFormErrors] = useState({
        nom: "",
        date_debut: "",
        date_fin: "",
    });

    // Fetch data
    const fetchJoursFeries = async () => {
        setLoading(true);
        try {
            const response = await joursFeriesApi.getAll({
                page,
                search: searchTerm,
                limit: 10,
            });

            const data = response.data.data || response.data;
            setJoursFeries(Array.isArray(data) ? data : data.items || []);
            setTotalPages(response.data.totalPages || Math.ceil((response.data.total || 0) / 10));
            setTotalItems(response.data.total || 0);
        } catch (error) {
            console.error("Error fetching jours feries:", error);
            toast.error("Impossible de charger les jours fériés");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchJoursFeries();
    }, [page, searchTerm]);

    // Form validation
    const validateForm = () => {
        const errors = {
            nom: formData.nom ? "" : "Le nom est requis",
            date_debut: formData.date_debut ? "" : "La date de début est requise",
            date_fin: formData.date_fin ? "" : "La date de fin est requise",
        };
        setFormErrors(errors);
        return !errors.nom && !errors.date_debut && !errors.date_fin;
    };

    // Submit form
    const handleSubmit = async () => {
        if (!validateForm()) return;

        setLoading(true);
        try {
            const dataToSend = {
                nom: formData.nom,
                date_debut: formData.date_debut.toISOString(),
                date_fin: formData.date_fin.toISOString(),
                recurrent: formData.recurrent,
                type: formData.type,
                description: formData.description,
            };

            if (editingItem) {
                await joursFeriesApi.update(editingItem.id, dataToSend);
                toast("Jour férié modifié avec succès");
            } else {
                await joursFeriesApi.create(dataToSend);
                toast("Jour férié ajouté avec succès");
            }

            handleCloseDialog();
            fetchJoursFeries();
        } catch (error) {
            console.error("Error saving jour ferie:", error);
            toast("Une erreur est survenue");
        } finally {
            setLoading(false);
        }
    };

    // Delete item
    const handleDelete = async () => {
        if (!itemToDelete) return;

        setLoading(true);
        try {
            await joursFeriesApi.delete(itemToDelete);
            toast("Jour férié supprimé avec succès");
            fetchJoursFeries();
        } catch (error) {
            console.error("Error deleting jour ferie:", error);
            toast.error("Impossible de supprimer ce jour férié");
        } finally {
            setLoading(false);
            setDeleteDialogOpen(false);
            setItemToDelete(null);
        }
    };

    // Open edit dialog
    const handleEdit = (item: JourFerie) => {
        setEditingItem(item);
        setFormData({
            nom: item.nom,
            date_debut: new Date(item.date_debut),
            date_fin: new Date(item.date_fin),
            recurrent: item.recurrent,
            type: item.type || "",
            description: item.description || "",
        });
        setIsDialogOpen(true);
    };

    // Open add dialog
    const handleAddNew = () => {
        setEditingItem(null);
        setFormData({
            nom: "",
            date_debut: new Date(),
            date_fin: new Date(),
            recurrent: false,
            type: "",
            description: "",
        });
        setFormErrors({ nom: "", date_debut: "", date_fin: "" });
        setIsDialogOpen(true);
    };

    const handleCloseDialog = () => {
        setIsDialogOpen(false);
        setEditingItem(null);
    };

    // Get badge color for type
    const getTypeBadgeVariant = (type: string): "default" | "secondary" | "destructive" | "outline" => {
        switch (type) {
            case "national": return "default";
            case "religieux": return "secondary";
            case "regional": return "outline";
            default: return "secondary";
        }
    };

    const getTypeLabel = (type: string) => {
        switch (type) {
            case "national": return "National";
            case "religieux": return "Religieux";
            case "regional": return "Régional";
            default: return "Non spécifié";
        }
    };

    return (
        <AppShell workspaceName="Planning" onDashboardClick={() => router.push(`/workspaces/${workspaceId}`)}>
            <div className="container mx-auto py-8 px-4">
                <Card>
                    <CardHeader>
                        <div className="flex justify-between items-center">
                            <CardTitle className="text-2xl font-bold">
                                Gestion des Jours Fériés
                            </CardTitle>
                            {hasPermissionAddJourFerie && (
                                <Button onClick={handleAddNew} className="gap-2">
                                    <Plus className="h-4 w-4" />
                                    Ajouter un jour férié
                                </Button>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent>
                        {/* Search Bar */}
                        <div className="mb-6">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
                                <Input
                                    placeholder="Rechercher par nom, type ou description..."
                                    value={searchTerm}
                                    onChange={(e) => {
                                        setSearchTerm(e.target.value);
                                        setPage(1);
                                    }}
                                    className="pl-10 pr-10"
                                />
                                {searchTerm && (
                                    <button
                                        onClick={() => setSearchTerm("")}
                                        className="absolute right-3 top-1/2 transform -translate-y-1/2"
                                    >
                                        <X className="h-4 w-4 text-gray-500 hover:text-gray-700" />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Stats */}
                        <div className="mb-4 text-sm text-gray-500">
                            {totalItems > 0 && (
                                <span>{totalItems} jour(s) férié(s) trouvé(s)</span>
                            )}
                        </div>

                        {/* Table */}
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Nom</TableHead>
                                        <TableHead>Date début</TableHead>
                                        <TableHead>Date fin</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Récurrent</TableHead>
                                        <TableHead>Description</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loading && joursFeries.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={7} className="text-center py-8">
                                                <div className="flex justify-center">
                                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : joursFeries.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                                                Aucun jour férié trouvé
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        joursFeries.map((item) => (
                                            <TableRow key={item.id}>
                                                <TableCell className="font-medium">{item.nom}</TableCell>
                                                <TableCell>{format(new Date(item.date_debut), "dd/MM/yyyy HH:mm")}</TableCell>
                                                <TableCell>{format(new Date(item.date_fin), "dd/MM/yyyy HH:mm")}</TableCell>
                                                <TableCell>
                                                    <Badge variant={getTypeBadgeVariant(item.type)}>
                                                        {getTypeLabel(item.type)}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    {item.recurrent ? (
                                                        <Badge variant="default">Oui</Badge>
                                                    ) : (
                                                        <Badge variant="secondary">Non</Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell className="max-w-[200px] truncate">
                                                    {item.description || "-"}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-2">
                                                        {hasPermissionUpdateJourFerie && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => handleEdit(item)}
                                                            >
                                                                <Edit className="h-4 w-4" />
                                                            </Button>
                                                        )}
                                                        {hasPermissionDeleteJourFerie && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => {
                                                                    setItemToDelete(item.id);
                                                                    setDeleteDialogOpen(true);
                                                                }}
                                                            >
                                                                <Trash2 className="h-4 w-4 text-red-500" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="mt-4">
                                <Pagination>
                                    <PaginationContent>
                                        <PaginationItem>
                                            <PaginationPrevious
                                                href="#"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    if (page > 1) setPage(page - 1);
                                                }}
                                            />
                                        </PaginationItem>
                                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                            let pageNum = page;
                                            if (totalPages > 5) {
                                                if (page <= 3) pageNum = i + 1;
                                                else if (page >= totalPages - 2) pageNum = totalPages - 4 + i;
                                                else pageNum = page - 2 + i;
                                            } else {
                                                pageNum = i + 1;
                                            }

                                            if (pageNum <= totalPages) {
                                                return (
                                                    <PaginationItem key={pageNum}>
                                                        <PaginationLink
                                                            href="#"
                                                            isActive={page === pageNum}
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                setPage(pageNum);
                                                            }}
                                                        >
                                                            {pageNum}
                                                        </PaginationLink>
                                                    </PaginationItem>
                                                );
                                            }
                                            return null;
                                        })}
                                        <PaginationItem>
                                            <PaginationNext
                                                href="#"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    if (page < totalPages) setPage(page + 1);
                                                }}
                                            />
                                        </PaginationItem>
                                    </PaginationContent>
                                </Pagination>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Add/Edit Dialog */}
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogContent className="max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>
                                {editingItem ? "Modifier le jour férié" : "Ajouter un nouveau jour férié"}
                            </DialogTitle>
                            <DialogDescription>
                                {editingItem
                                    ? "Modifiez les informations du jour férié"
                                    : "Remplissez les informations pour ajouter un nouveau jour férié"}
                            </DialogDescription>
                        </DialogHeader>

                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="nom">Nom du jour férié *</Label>
                                <Input
                                    id="nom"
                                    value={formData.nom}
                                    onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                                    placeholder="Ex: Aïd El Fitr, Jour de l'An..."
                                />
                                {formErrors.nom && (
                                    <p className="text-sm text-red-500">{formErrors.nom}</p>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label>Date de début *</Label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                className="justify-start text-left font-normal"
                                            >
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {formData.date_debut ? (
                                                    format(formData.date_debut, "dd/MM/yyyy HH:mm")
                                                ) : (
                                                    <span>Sélectionner une date</span>
                                                )}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0">
                                            <Calendar
                                                mode="single"
                                                selected={formData.date_debut}
                                                onSelect={(date) => date && setFormData({ ...formData, date_debut: date })}
                                                initialFocus
                                            />
                                        </PopoverContent>
                                    </Popover>
                                    {formErrors.date_debut && (
                                        <p className="text-sm text-red-500">{formErrors.date_debut}</p>
                                    )}
                                </div>

                                <div className="grid gap-2">
                                    <Label>Date de fin *</Label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                className="justify-start text-left font-normal"
                                            >
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {formData.date_fin ? (
                                                    format(formData.date_fin, "dd/MM/yyyy HH:mm")
                                                ) : (
                                                    <span>Sélectionner une date</span>
                                                )}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0">
                                            <Calendar
                                                mode="single"
                                                selected={formData.date_fin}
                                                onSelect={(date) => date && setFormData({ ...formData, date_fin: date })}
                                                initialFocus
                                            />
                                        </PopoverContent>
                                    </Popover>
                                    {formErrors.date_fin && (
                                        <p className="text-sm text-red-500">{formErrors.date_fin}</p>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="type">Type</Label>
                                    <Select
                                        value={formData.type}
                                        onValueChange={(value) => setFormData({ ...formData, type: value })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Sélectionner un type" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="null">Aucun</SelectItem>
                                            <SelectItem value="national">National</SelectItem>
                                            <SelectItem value="religieux">Religieux</SelectItem>
                                            <SelectItem value="regional">Régional</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="flex items-center justify-between">
                                    <Label htmlFor="recurrent">Récurrent (chaque année)</Label>
                                    <Switch
                                        id="recurrent"
                                        checked={formData.recurrent}
                                        onCheckedChange={(checked) => setFormData({ ...formData, recurrent: checked })}
                                    />
                                </div>
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="description">Description</Label>
                                <Textarea
                                    id="description"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Description optionnelle..."
                                    rows={3}
                                />
                            </div>
                        </div>

                        <DialogFooter>
                            <Button variant="outline" onClick={handleCloseDialog}>
                                Annuler
                            </Button>
                            <Button onClick={handleSubmit} disabled={loading}>
                                {loading ? "Chargement..." : editingItem ? "Modifier" : "Ajouter"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Delete Confirmation Dialog */}
                <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Êtes-vous sûr ?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Cette action est irréversible. Cela supprimera définitivement ce jour férié.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Annuler</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
                                Supprimer
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </AppShell>

    );
}
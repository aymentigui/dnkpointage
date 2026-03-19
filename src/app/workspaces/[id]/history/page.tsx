// app/workspaces/[id]/history/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
    ArrowLeft,
    History,
    Filter,
    X,
    ChevronLeft,
    ChevronRight,
    Calendar,
    User,
    Users,
    FileText,
    RefreshCw,
    Stethoscope,
    Palmtree,
    Sparkles,
    CheckCircle2,
    XCircle,
    Coffee,
    AlertCircle,
    ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "react-hot-toast";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Search, ChevronDown } from "lucide-react";
// ─── Types ───────────────────────────────────────────────────

interface HistoryEntry {
    id: string;
    date: string;
    employee: {
        id: string;
        matricule: string;
        nom: string | null;
        prenom: string | null;
        label: string;
    };
    ancien_statut: string | null;
    nouveau_statut: string | null;
    type_modification: string;
    description?: string | null;
    modifie_par: string | null;
    modifie_par_id: string | null;
    modifie_le: string;
}

interface Worskpace {
    id: string;
    nom: string;
}

interface FilterOption {
    id: string;
    label: string;
}

interface UserOption {
    id: string;
    name: string;
}

interface FiltersData {
    employees: FilterOption[];
    users: UserOption[];
    workspace: Worskpace;
}

interface Pagination {
    page: number;
    limit: number;
    total: number;
    pages: number;
}

interface Stats {
    total_modifications: number;
    par_type: {
        base: number;
        annotation: number;
        cycle: number;
    };
}

// ─── Helpers ─────────────────────────────────────────────────

const STATUT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    P: { bg: "#f0fdf4", text: "#15803d", border: "#bbf7d0" },
    A: { bg: "#fff1f2", text: "#be123c", border: "#fecdd3" },
    R: { bg: "#f8fafc", text: "#64748b", border: "#e2e8f0" },
    M: { bg: "#eff6ff", text: "#1d4ed8", border: "#bfdbfe" },
    J: { bg: "#f0fdf4", text: "#059669", border: "#a7f3d0" },
    Md: { bg: "#fef2f2", text: "#dc2626", border: "#fecaca" },
    Rc: { bg: "#f5f3ff", text: "#6d28d9", border: "#ddd6fe" },
    C: { bg: "#fffbeb", text: "#b45309", border: "#fde68a" },
    Ce: { bg: "#fdf2f8", text: "#be185d", border: "#fbcfe8" },
};

const TYPE_LABELS: Record<string, string> = {
    base: "Modification base",
    annotation: "Annotation",
    cycle: "Modification cycle",
};

const TYPE_ICONS: Record<string, any> = {
    base: FileText,
    annotation: RefreshCw,
    cycle: Calendar,
};

// Nouveau composant pour la recherche d'employés
function EmployeeSearchSelect({
    employees,
    selectedEmployee,
    onEmployeeChange,
    isLoading = false,
}: {
    employees: FilterOption[];
    selectedEmployee: string;
    onEmployeeChange: (v: string) => void;
    isLoading?: boolean;
}) {
    const [open, setOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    // Filtrer les employés côté client basé sur la recherche
    const filteredEmployees = employees.filter(emp =>
        emp.label.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const selectedEmployeeObj = employees.find(emp => emp.id === selectedEmployee);

    return (
        <div className="space-y-1.5">
            <Label className="text-xs text-slate-500 flex items-center gap-1">
                <Users className="w-3.5 h-3.5" /> Employé
            </Label>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="w-full justify-between h-9 text-sm font-normal"
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <span className="text-slate-400">Chargement...</span>
                        ) : selectedEmployee && selectedEmployee !== "all" && selectedEmployeeObj ? (
                            <span className="truncate">{selectedEmployeeObj.label}</span>
                        ) : (
                            <span className="text-slate-400">Rechercher un employé...</span>
                        )}
                        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0" align="start">
                    <Command shouldFilter={false}>
                        <CommandInput
                            placeholder="Nom, prénom ou matricule..."
                            value={searchQuery}
                            onValueChange={setSearchQuery}
                            className="h-9"
                        />
                        <CommandList>
                            <CommandEmpty>
                                {searchQuery.length > 0
                                    ? "Aucun employé trouvé."
                                    : "Commencez à taper pour rechercher..."}
                            </CommandEmpty>
                            <CommandGroup>
                                <CommandItem
                                    onSelect={() => {
                                        onEmployeeChange("all");
                                        setOpen(false);
                                        setSearchQuery("");
                                    }}
                                    className="cursor-pointer"
                                >
                                    <Users className="w-4 h-4 mr-2 text-slate-400" />
                                    <span className={cn(
                                        "flex-1",
                                        selectedEmployee === "all" && "font-medium text-slate-900"
                                    )}>
                                        Tous les employés
                                    </span>
                                </CommandItem>
                                {filteredEmployees.map((emp) => (
                                    <CommandItem
                                        key={emp.id}
                                        onSelect={() => {
                                            onEmployeeChange(emp.id);
                                            setOpen(false);
                                            setSearchQuery("");
                                        }}
                                        className="cursor-pointer"
                                    >
                                        <User className="w-4 h-4 mr-2 text-slate-400 shrink-0" />
                                        <span className={cn(
                                            "flex-1 truncate",
                                            selectedEmployee === emp.id && "font-medium text-slate-900"
                                        )}>
                                            {emp.label}
                                        </span>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
        </div>
    );
}


function getStatutColors(code: string | null | undefined) {
    if (!code) return { bg: "#f8fafc", text: "#94a3b8", border: "#e2e8f0" };
    return STATUT_COLORS[code] ?? { bg: "#f8fafc", text: "#94a3b8", border: "#e2e8f0" };
}

function StatutBadge({ code }: { code: string | null | undefined }) {
    if (!code) return <span className="text-slate-400 italic text-xs">—</span>;
    const c = getStatutColors(code);
    return (
        <span
            className="inline-flex items-center justify-center w-6 h-6 rounded-md text-xs font-bold"
            style={{ backgroundColor: c.bg, color: c.text, border: `1px solid ${c.border}` }}
        >
            {code}
        </span>
    );
}

function formatDateLong(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
    });
}

function formatDateTime(isoStr: string) {
    const d = new Date(isoStr);
    return d.toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    }) +
        " " +
        d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function toYMD(date: Date) {
    return date.toISOString().split("T")[0];
}

// ─── Composants ──────────────────────────────────────────────

function FilterBar({
    filters,
    selectedEmployee,
    selectedUser,
    dateDebut,
    dateFin,
    onEmployeeChange,
    onUserChange,
    onDateDebutChange,
    onDateFinChange,
    onApply,
    onReset,
    isLoadingEmployees = false,
}: {
    filters: FiltersData | null;
    selectedEmployee: string;
    selectedUser: string;
    dateDebut: string;
    dateFin: string;
    onEmployeeChange: (v: string) => void;
    onUserChange: (v: string) => void;
    onDateDebutChange: (v: string) => void;
    onDateFinChange: (v: string) => void;
    onApply: () => void;
    onReset: () => void;
    isLoadingEmployees?: boolean;
}) {
    const hasActiveFilters = selectedEmployee !== "all" || selectedUser !== "all" || dateDebut || dateFin;

    return (
        <Card className="border-0 shadow-sm bg-white">
            <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-4">
                    <Filter className="w-4 h-4 text-slate-400" />
                    <span className="text-sm font-medium text-slate-700">Filtres</span>
                    {hasActiveFilters && (
                        <Badge variant="secondary" className="ml-auto text-xs">
                            Filtres actifs
                        </Badge>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    {/* Employé avec recherche */}
                    <EmployeeSearchSelect
                        employees={filters?.employees || []}
                        selectedEmployee={selectedEmployee}
                        onEmployeeChange={onEmployeeChange}
                        isLoading={isLoadingEmployees}
                    />

                    {/* Utilisateur */}
                    <div className="space-y-1.5">
                        <Label className="text-xs text-slate-500 flex items-center gap-1">
                            <User className="w-3.5 h-3.5" /> Modifié par
                        </Label>
                        <Select value={selectedUser} onValueChange={onUserChange}>
                            <SelectTrigger className="h-9 text-sm">
                                <SelectValue placeholder="Tous les utilisateurs" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Tous les utilisateurs</SelectItem>
                                {filters?.users.map((user) => (
                                    <SelectItem key={user.id} value={user.id}>
                                        {user.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Date début */}
                    <div className="space-y-1.5">
                        <Label className="text-xs text-slate-500 flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" /> Date début
                        </Label>
                        <Input
                            type="date"
                            value={dateDebut}
                            onChange={(e) => onDateDebutChange(e.target.value)}
                            className="h-9 text-sm"
                        />
                    </div>

                    {/* Date fin */}
                    <div className="space-y-1.5">
                        <Label className="text-xs text-slate-500 flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" /> Date fin
                        </Label>
                        <Input
                            type="date"
                            value={dateFin}
                            onChange={(e) => onDateFinChange(e.target.value)}
                            className="h-9 text-sm"
                        />
                    </div>

                    {/* Boutons */}
                    <div className="flex items-end gap-2">
                        <Button
                            onClick={onApply}
                            className="flex-1 h-9 bg-slate-900 hover:bg-slate-800 text-white"
                        >
                            Appliquer
                        </Button>
                        {hasActiveFilters && (
                            <Button
                                onClick={onReset}
                                variant="outline"
                                size="icon"
                                className="h-9 w-9"
                            >
                                <X className="w-4 h-4" />
                            </Button>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}


function StatsCards({ stats }: { stats: Stats | null }) {
    if (!stats) return null;

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border-0 shadow-sm bg-white">
                <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-slate-500 mb-1">Total modifications</p>
                            <p className="text-2xl font-bold text-slate-900">
                                {stats.total_modifications}
                            </p>
                        </div>
                        <div className="p-2.5 bg-slate-100 rounded-xl">
                            <History className="w-5 h-5 text-slate-600" />
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card className="border-0 shadow-sm bg-white">
                <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-slate-500 mb-1">Base</p>
                            <p className="text-2xl font-bold text-slate-900">{stats.par_type.base}</p>
                        </div>
                        <div className="p-2.5 bg-blue-50 rounded-xl">
                            <FileText className="w-5 h-5 text-blue-600" />
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card className="border-0 shadow-sm bg-white">
                <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-slate-500 mb-1">Annotations</p>
                            <p className="text-2xl font-bold text-slate-900">{stats.par_type.annotation}</p>
                        </div>
                        <div className="p-2.5 bg-amber-50 rounded-xl">
                            <RefreshCw className="w-5 h-5 text-amber-600" />
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card className="border-0 shadow-sm bg-white">
                <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-slate-500 mb-1">Cycles</p>
                            <p className="text-2xl font-bold text-slate-900">{stats.par_type.cycle}</p>
                        </div>
                        <div className="p-2.5 bg-purple-50 rounded-xl">
                            <Calendar className="w-5 h-5 text-purple-600" />
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

function HistoryEntry({ entry }: { entry: HistoryEntry }) {
    const TypeIcon = TYPE_ICONS[entry.type_modification] || FileText;

    return (
        <div className="flex items-start gap-4 p-4 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
            {/* Date */}
            <div className="w-24 shrink-0">
                <div className="text-[10px] font-semibold text-slate-400 uppercase">
                    {new Date(entry.date).toLocaleDateString("fr-FR", { weekday: "short" })}
                </div>
                <div className="text-xs font-bold text-slate-700">
                    {new Date(entry.date).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "short",
                    })}
                </div>
            </div>

            {/* Employé */}
            <div className="w-48 shrink-0">
                <div className="text-xs font-medium text-slate-700">{entry.employee.label}</div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                    {entry.employee.matricule}
                </div>
            </div>

            {/* Type */}
            <div className="w-28 shrink-0">
                <Badge
                    variant="outline"
                    className={cn(
                        "text-[10px] font-medium",
                        entry.type_modification === "base" && "border-blue-200 bg-blue-50 text-blue-700",
                        entry.type_modification === "annotation" &&
                        "border-amber-200 bg-amber-50 text-amber-700",
                        entry.type_modification === "cycle" &&
                        "border-purple-200 bg-purple-50 text-purple-700"
                    )}
                >
                    <TypeIcon className="w-3 h-3 mr-1" />
                    {TYPE_LABELS[entry.type_modification] || entry.type_modification}
                </Badge>
            </div>

            {/* Changement */}
            <div className="flex items-center gap-2 flex-1 min-w-0">
                <StatutBadge code={entry.ancien_statut} />
                <ArrowRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                <StatutBadge code={entry.nouveau_statut} />
                {entry.description && (
                    <span className="text-xs text-slate-400 italic truncate ml-2">
                        "{entry.description}"
                    </span>
                )}
            </div>

            {/* Qui + Quand */}
            <div className="text-right shrink-0 space-y-0.5 min-w-[180px]">
                <div className="text-[11px] font-medium text-slate-600">
                    {entry.modifie_par ?? "Système"}
                </div>
                <div className="text-[10px] text-slate-400">{formatDateTime(entry.modifie_le)}</div>
            </div>
        </div>
    );
}

function PaginationBar({
    pagination,
    onPageChange,
}: {
    pagination: Pagination;
    onPageChange: (page: number) => void;
}) {
    return (
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
            <div className="text-xs text-slate-500">
                Affichage {((pagination.page - 1) * pagination.limit) + 1} -{" "}
                {Math.min(pagination.page * pagination.limit, pagination.total)} sur{" "}
                {pagination.total} entrées
            </div>
            <div className="flex items-center gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onPageChange(pagination.page - 1)}
                    disabled={pagination.page <= 1}
                >
                    <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-xs text-slate-600 px-2">
                    Page {pagination.page} / {pagination.pages}
                </span>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onPageChange(pagination.page + 1)}
                    disabled={pagination.page >= pagination.pages}
                >
                    <ChevronRight className="w-4 h-4" />
                </Button>
            </div>
        </div>
    );
}

// ─── Page principale ─────────────────────────────────────────

export default function WorkspaceHistoryPage() {
    const params = useParams();
    const router = useRouter();
    const workspaceId = params?.id as string;

    // États des filtres
    const [selectedEmployee, setSelectedEmployee] = useState<string>("all");
    const [selectedUser, setSelectedUser] = useState<string>("all");
    const [dateDebut, setDateDebut] = useState<string>("");
    const [dateFin, setDateFin] = useState<string>("");
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [loadingEmployees, setLoadingEmployees] = useState(false);
    const [employeeSearch, setEmployeeSearch] = useState("");

    // États des données
    const [filters, setFilters] = useState<FiltersData | null>(null);
    const [histories, setHistories] = useState<HistoryEntry[]>([]);
    const [pagination, setPagination] = useState<Pagination | null>(null);
    const [stats, setStats] = useState<Stats | null>(null);
    const [loadingFilters, setLoadingFilters] = useState(true);
    const [loadingHistory, setLoadingHistory] = useState(true);

    // Charger les filtres au montage
    useEffect(() => {
        if (!workspaceId) return;

        setLoadingFilters(true);
        fetch(`/api/workspaces/${workspaceId}/filters`)
            .then((res) => res.json())
            .then((data) => setFilters(data))
            .catch((err) => {
                console.error("Erreur chargement filtres:", err);
                toast.error("Erreur lors du chargement des filtres");
            })
            .finally(() => setLoadingFilters(false));
    }, [workspaceId]);

    // Charger l'historique
    const fetchHistory = useCallback(
        async (page: number = 1) => {
            if (!workspaceId) return;

            setLoadingHistory(true);
            const params = new URLSearchParams({
                page: page.toString(),
                limit: "50",
            });

            if (selectedEmployee && selectedEmployee !== "all") {
                params.append("employeeId", selectedEmployee);
            }
            if (selectedUser && selectedUser !== "all") {
                params.append("userId", selectedUser);
            }
            if (dateDebut) params.append("dateDebut", dateDebut);
            if (dateFin) params.append("dateFin", dateFin);

            try {
                const res = await fetch(`/api/workspaces/${workspaceId}/history?${params}`);
                const data = await res.json();
                setHistories(data.histories);
                setPagination(data.pagination);
                setStats(data.stats);
            } catch (err) {
                console.error("Erreur chargement historique:", err);
                toast.error("Erreur lors du chargement de l'historique");
            } finally {
                setLoadingHistory(false);
            }
        },
        [workspaceId, selectedEmployee, selectedUser, dateDebut, dateFin]
    );

    // Effet pour charger l'historique au changement de page
    useEffect(() => {
        fetchHistory(currentPage);
    }, [fetchHistory, currentPage]);

    const handleApplyFilters = () => {
        setCurrentPage(1);
        fetchHistory(1);
    };

    const handleResetFilters = () => {
        setSelectedEmployee("all");
        setSelectedUser("all");
        setDateDebut("");
        setDateFin("");
        setCurrentPage(1);
        setTimeout(() => fetchHistory(1), 0);
    };

    return (
        <div className="min-h-screen bg-[#f8f8f6]">
            {/* Header */}
            <div className="bg-white border-b border-slate-100 sticky top-0 z-20">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4">
                    <button
                        onClick={() => router.back()}
                        className="p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-500"
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center">
                            <History className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="font-bold text-slate-900">Historique des modifications</h1>
                            <p className="text-xs text-slate-400">Espace de travail · {filters?.workspace.nom}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
                {/* Barre de filtres */}
                {loadingFilters ? (
                    <Card className="border-0 shadow-sm bg-white">
                        <CardContent className="p-5">
                            <Skeleton className="h-6 w-32 mb-4" />
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                                {Array(5)
                                    .fill(0)
                                    .map((_, i) => (
                                        <Skeleton key={i} className="h-9 w-full" />
                                    ))}
                            </div>
                        </CardContent>
                    </Card>
                ) : (
                    <FilterBar
                        filters={filters}
                        selectedEmployee={selectedEmployee}
                        selectedUser={selectedUser}
                        dateDebut={dateDebut}
                        dateFin={dateFin}
                        onEmployeeChange={setSelectedEmployee}
                        onUserChange={setSelectedUser}
                        onDateDebutChange={setDateDebut}
                        onDateFinChange={setDateFin}
                        onApply={handleApplyFilters}
                        onReset={handleResetFilters}
                        isLoadingEmployees={loadingEmployees}
                    />
                )}

                {/* Statistiques */}
                <StatsCards stats={stats} />

                {/* Liste des modifications */}
                <Card className="border-0 shadow-sm bg-white">
                    <CardHeader className="pb-0 pt-5 px-5">
                        <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                            <History className="w-4 h-4" />
                            Modifications
                            {pagination && (
                                <Badge variant="secondary" className="ml-2 text-[10px]">
                                    {pagination.total} entrées
                                </Badge>
                            )}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3">
                        {loadingHistory ? (
                            <div className="space-y-2">
                                {Array(8)
                                    .fill(0)
                                    .map((_, i) => (
                                        <Skeleton key={i} className="h-16 rounded-xl" />
                                    ))}
                            </div>
                        ) : histories.length === 0 ? (
                            <div className="text-center py-12 text-slate-400">
                                <History className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                <p className="text-sm">Aucune modification trouvée</p>
                                <p className="text-xs mt-1">Essayez de modifier vos filtres</p>
                            </div>
                        ) : (
                            <>
                                {/* En-tête (caché sur mobile) */}
                                <div className="hidden lg:flex items-center gap-4 px-4 pb-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                                    <div className="w-24">Date</div>
                                    <div className="w-48">Employé</div>
                                    <div className="w-28">Type</div>
                                    <div className="flex-1">Modification</div>
                                    <div className="w-[180px] text-right">Utilisateur</div>
                                </div>

                                {/* Liste */}
                                <div className="divide-y divide-slate-50">
                                    {histories.map((entry) => (
                                        <HistoryEntry key={entry.id} entry={entry} />
                                    ))}
                                </div>

                                {/* Pagination */}
                                {pagination && pagination.pages > 1 && (
                                    <PaginationBar pagination={pagination} onPageChange={setCurrentPage} />
                                )}
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
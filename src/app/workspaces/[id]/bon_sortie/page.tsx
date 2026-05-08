"use client";

import { useState, useEffect, useMemo } from "react";
import { Search, MapPin, Plus, X, Loader2, Edit, CheckSquare, Save, Calendar, Hash, RefreshCcw, Printer, Building2, Download, FileSpreadsheet, Clock, FileText } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { useSession } from "@/hooks/use-session";

export default function SortiesPage() {
    const [sorties, setSorties] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [isLoading, setIsLoading] = useState(true);
    const [directions, setDirections] = useState<any[]>([]);

    // Système de déclenchement de fetch
    const [fetchTrigger, setFetchTrigger] = useState(0);

    // Filtres avec limite
    const [filters, setFilters] = useState({
        sansRetour: false,
        motif: "",
        direction: "",
        dateDebut: "",
        dateFin: "",
        employeeId: "",
        limit: "10"
    });

    // Lignes sélectionnées pour l'export (Mode "Tous")
    const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSortie, setEditingSortie] = useState<any>(null);

    // Print state
    const [sortieToPrint, setSortieToPrint] = useState<any>(null);

    // Export Excel state
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [selectedExportColumns, setSelectedExportColumns] = useState<string[]>([]);

    // Form state
    const [formData, setFormData] = useState({
        numero: "", employee_id: "", direction: "", date: "", heure_sortie: "", heure_entree: "", motif: ""
    });

    // Autocomplete Employés (Pour le Formulaire)
    const [empSearch, setEmpSearch] = useState("");
    const [empResults, setEmpResults] = useState<any[]>([]);
    const [selectedEmpDisplay, setSelectedEmpDisplay] = useState("");

    // Autocomplete Employés (Pour les Filtres)
    const [filterEmpSearch, setFilterEmpSearch] = useState("");
    const [filterEmpResults, setFilterEmpResults] = useState<any[]>([]);
    const [filterSelectedEmpDisplay, setFilterSelectedEmpDisplay] = useState("");

    // permissions
    const { session } = useSession();

    const hasPermissionView = useMemo(() => (
        session?.user?.is_admin || session?.user?.permissions.some((p: string[]) => p.includes("sortie_view"))
    ), [session]);

    const hasPermissionAdd = useMemo(() => (
        session?.user?.is_admin || session?.user?.permissions.some((p: string[]) => p.includes("sortie_create"))
    ), [session]);

    const hasPermissionUpdate = useMemo(() => (
        session?.user?.is_admin || session?.user?.permissions.some((p: string[]) => p.includes("sortie_edit"))
    ), [session]);

    const hasPermissionDelete = useMemo(() => (
        session?.user?.is_admin || session?.user?.permissions.some((p: string[]) => p.includes("sortie_delete"))
    ), [session]);

    const hasPermissionExport = useMemo(() => (
        session?.user?.is_admin || session?.user?.permissions.some((p: string[]) => p.includes("sortie_export")) // A adapter si tu as une permission spécifique
    ), [session]);

    const hasPermissionPrint = useMemo(() => (
        session?.user?.is_admin || session?.user?.permissions.some((p: string[]) => p.includes("sortie_print")) // A adapter si tu as une permission spécifique
    ), [session]);

    // Définition dynamique des colonnes d'export
    const getExportColumns = () => {
        return [
            { id: 'numero', label: 'N° Sortie' },
            { id: 'employee', label: 'Employé (Nom & Prénom)' },
            { id: 'matricule', label: 'Matricule' },
            { id: 'fonction', label: 'Fonction' },
            { id: 'direction', label: 'Direction / Affectation' },
            { id: 'motif', label: 'Motif' },
            { id: 'date', label: 'Date' },
            { id: 'heure_sortie', label: 'Heure de Sortie' },
            { id: 'heure_entree', label: 'Heure de Retour' }
        ];
    };

    useEffect(() => {
        setSelectedExportColumns(getExportColumns().map(c => c.id));
    }, []);

    const fetchSorties = async () => {
        setIsLoading(true);
        const query = new URLSearchParams({
            page: filters.limit === 'all' ? "1" : page.toString(),
            limit: filters.limit === 'all' ? '999999' : filters.limit,
            sansRetour: filters.sansRetour.toString(),
            ...(filters.motif && { motif: filters.motif }),
            ...(filters.direction && { direction: filters.direction }),
            ...(filters.dateDebut && { dateDebut: filters.dateDebut }),
            ...(filters.dateFin && { dateFin: filters.dateFin }),
            ...(filters.employeeId && { employeeId: filters.employeeId }),
        });

        const res = await fetch(`/api/sorties?${query}`);
        const data = await res.json();
        setSorties(data.sorties || []);
        setTotal(data.pages || 1);
        setIsLoading(false);
    };

    const fetchDirections = async () => {
        const res = await fetch(`/api/missions/directions`); // On garde l'API missions comme demandé
        const data = await res.json();
        setDirections(data || []);
    };

    useEffect(() => {
        fetchDirections();
    }, []);

    useEffect(() => {
        fetchSorties();
    }, [fetchTrigger]);

    const updateFilter = (updates: any) => {
        setFilters(prev => ({ ...prev, ...updates }));
        setPage(1);
        setSelectedRowIds([]);
        setFetchTrigger(prev => prev + 1);
    };

    const handlePageChange = (newPage: number) => {
        setPage(newPage);
        if (filters.limit !== 'all') {
            setFetchTrigger(prev => prev + 1);
        }
    };

    const toggleRowSelection = (id: string) => {
        setSelectedRowIds(prev =>
            prev.includes(id) ? prev.filter(rowId => rowId !== id) : [...prev, id]
        );
    };

    const toggleAllRows = () => {
        if (selectedRowIds.length === sorties.length) {
            setSelectedRowIds([]);
        } else {
            setSelectedRowIds(sorties.map(m => m.id));
        }
    };

    // Recherche employé (Formulaire)
    useEffect(() => {
        if (empSearch.length >= 2 && !formData.employee_id) {
            fetch(`/api/missions/employees/search?q=${empSearch}`) // On garde l'API missions comme demandé
                .then(res => res.json())
                .then(data => { setEmpResults(data) });
        } else {
            setEmpResults([]);
        }
    }, [empSearch, formData.employee_id]);

    // Recherche employé (Filtres)
    useEffect(() => {
        if (filterEmpSearch.length >= 2 && !filters.employeeId) {
            fetch(`/api/missions/employees/search?q=${filterEmpSearch}`)
                .then(res => res.json())
                .then(data => setFilterEmpResults(data));
        } else {
            setFilterEmpResults([]);
        }
    }, [filterEmpSearch, filters.employeeId]);

    const handleSave = async (e: any) => {
        e.preventDefault();

        const url = editingSortie ? `/api/sorties/${editingSortie.id}` : "/api/sorties";
        const method = editingSortie ? "PUT" : "POST";

        await fetch(url, {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formData)
        });

        setIsModalOpen(false);
        setFetchTrigger(prev => prev + 1);
    };

    const handleDelete = async (id: string) => {
        if (confirm("Êtes-vous sûr de vouloir supprimer ce bon de sortie ?")) {
            await fetch(`/api/sorties/${id}`, {
                method: "DELETE"
            });
            setFetchTrigger(prev => prev + 1);
        }
    };

    const handleTerminer = async (sortie: any) => {
        const heureEntree = prompt("Heure de retour (Format HH:MM) ?");
        if (!heureEntree || !heureEntree.match(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/)) {
            if (heureEntree) alert("Format d'heure invalide. Veuillez utiliser HH:MM.");
            return;
        }

        await fetch(`/api/sorties/${sortie.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...sortie, heure_entree: heureEntree })
        });
        setFetchTrigger(prev => prev + 1);
    };

    const openModal = (sortie: any = null) => {
        if (!hasPermissionAdd && !hasPermissionUpdate) return;
        if (sortie) {
            setEditingSortie(sortie);
            setFormData({
                numero: sortie.numero || "",
                employee_id: sortie.employee_id,
                direction: sortie.direction || "",
                date: sortie.date.split('T')[0],
                heure_sortie: sortie.heure_sortie || "",
                heure_entree: sortie.heure_entree || "",
                motif: sortie.motif || ""
            });
            setSelectedEmpDisplay(`${sortie.employee.nom} ${sortie.employee.prenom}`);
        } else {
            setEditingSortie(null);
            setFormData({ numero: "", employee_id: "", direction: "", date: new Date().toISOString().split('T')[0], heure_sortie: "", heure_entree: "", motif: "" });
            setEmpSearch("");
            setSelectedEmpDisplay("");
        }
        setIsModalOpen(true);
    };

    const handlePrint = (sortie: any) => {
        if (!hasPermissionPrint) return;
        setSortieToPrint(sortie);
        setTimeout(() => {
            window.print();
        }, 300);
    };

    const handleGenerateExport = async () => {
        setIsExporting(true);
        try {
            const query = new URLSearchParams({
                page: "1",
                limit: "999999",
                sansRetour: filters.sansRetour.toString(),
                ...(filters.motif && { motif: filters.motif }),
                ...(filters.direction && { direction: filters.direction }),
                ...(filters.dateDebut && { dateDebut: filters.dateDebut }),
                ...(filters.dateFin && { dateFin: filters.dateFin }),
                ...(filters.employeeId && { employeeId: filters.employeeId }),
            });

            const res = await fetch(`/api/sorties?${query}`);
            const data = await res.json();
            let exportSorties = data.sorties || [];

            if (filters.limit === 'all' && selectedRowIds.length > 0) {
                exportSorties = exportSorties.filter((s: any) => selectedRowIds.includes(s.id));
            }

            const colsToExport = getExportColumns().filter(c => selectedExportColumns.includes(c.id));
            const headers = colsToExport.map(c => `"${c.label}"`).join(";");

            const rows = exportSorties.map((s: any) => {
                return colsToExport.map(c => {
                    let val: any = "";
                    if (c.id === 'numero') val = s.numero;
                    if (c.id === 'employee') val = `${s.employee?.nom} ${s.employee?.prenom}`;
                    if (c.id === 'matricule') val = s.employee?.matricule;
                    if (c.id === 'fonction') val = s.employee?.poste || "";
                    if (c.id === 'direction') val = s.direction || s.employee?.zoneEmployes?.[0]?.zone?.name || "";
                    if (c.id === 'motif') val = s.motif || "";
                    if (c.id === 'date') val = new Date(s.date).toLocaleDateString('fr-FR');
                    if (c.id === 'heure_sortie') val = s.heure_sortie || "";
                    if (c.id === 'heure_entree') val = s.heure_entree || "En cours";

                    return `"${String(val).replace(/"/g, '""')}"`;
                }).join(";");
            });

            const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers, ...rows].join("\n");
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", `Export_Sorties_${new Date().toISOString().slice(0, 10)}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setIsExportModalOpen(false);
        } catch (error) {
            console.error("Erreur lors de l'export", error);
        } finally {
            setIsExporting(false);
        }
    };

    const resetFilters = () => {
        setFilters({ sansRetour: false, motif: "", direction: "", dateDebut: "", dateFin: "", employeeId: "", limit: "10" });
        setFilterEmpSearch("");
        setFilterSelectedEmpDisplay("");
        setPage(1);
        setSelectedRowIds([]);
        setFetchTrigger(prev => prev + 1);
    };

    const formatDateForPrint = (dateString: string) => {
        if (!dateString) return "_____________";
        const date = new Date(dateString);
        return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    const displayedSorties = filters.limit === 'all'
        ? sorties.slice((page - 1) * 20, page * 20)
        : sorties;

    const displayedTotalPages = filters.limit === 'all'
        ? Math.max(1, Math.ceil(sorties.length / 20))
        : total;

    return (
        <>
            <div className="print:hidden">
                <AppShell>
                    <div className="max-w-7xl mx-auto p-4 sm:p-8 min-h-screen bg-[#F8FAFC] font-sans">
                        {/* Header */}
                        <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div>
                                <h1 className="text-3xl font-extrabold text-slate-900 flex items-center gap-3 tracking-tight">
                                    <div className="bg-blue-600 p-2.5 rounded-xl shadow-lg shadow-blue-200">
                                        <Clock className="w-6 h-6 text-white" />
                                    </div>
                                    Bons de Sortie
                                </h1>
                                <p className="text-slate-500 mt-2 font-medium">Gérez et suivez les sorties temporaires des collaborateurs.</p>
                            </div>
                            <div className="flex gap-3">
                                {hasPermissionExport && (
                                    <button onClick={() => setIsExportModalOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all shadow-md shadow-emerald-200">
                                        <Download className="w-5 h-5" /> Exporter Excel {filters.limit === 'all' && selectedRowIds.length > 0 ? `(${selectedRowIds.length})` : ''}
                                    </button>
                                )}
                                {(hasPermissionAdd || hasPermissionUpdate) && (
                                    <button onClick={() => openModal()} className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all shadow-md shadow-slate-200">
                                        <Plus className="w-5 h-5" /> Nouveau Bon
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Zone des Filtres Avancés */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                                    <Search className="w-4 h-4 text-blue-600" />
                                    Recherche & Filtres
                                </h3>
                                <button onClick={resetFilters} className="text-sm font-medium text-slate-500 hover:text-slate-800 flex items-center gap-1">
                                    <RefreshCcw className="w-3.5 h-3.5" /> Réinitialiser
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                {/* Filtre Employé */}
                                <div className="relative">
                                    {filters.employeeId ? (
                                        <div className="flex justify-between items-center p-2.5 bg-blue-50 border border-blue-200 rounded-xl h-[42px]">
                                            <span className="text-blue-900 font-medium text-sm truncate">{filterSelectedEmpDisplay}</span>
                                            <button onClick={() => { updateFilter({ employeeId: "" }); setFilterEmpSearch(""); }} className="text-blue-500 hover:text-blue-700"><X className="w-4 h-4" /></button>
                                        </div>
                                    ) : (
                                        <>
                                            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                                            <input type="text" placeholder="Chercher un employé..." value={filterEmpSearch} onChange={(e) => setFilterEmpSearch(e.target.value)} className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50" />
                                            {filterEmpResults.length > 0 && (
                                                <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                                                    {filterEmpResults.map(emp => (
                                                        <div key={emp.id} onClick={() => { updateFilter({ employeeId: emp.id }); setFilterSelectedEmpDisplay(`${emp.nom} ${emp.prenom}`); setFilterEmpResults([]); }} className="p-3 hover:bg-slate-50 cursor-pointer text-sm border-b border-slate-50">
                                                            <div className="font-medium text-slate-800">{emp.nom} {emp.prenom}</div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>

                                {/* Filtre Dates */}
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                                    <input type="date" value={filters.dateDebut} onChange={(e) => updateFilter({ dateDebut: e.target.value })} className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50 text-slate-600" title="Date de début" />
                                </div>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                                    <input type="date" value={filters.dateFin} onChange={(e) => updateFilter({ dateFin: e.target.value })} className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50 text-slate-600" title="Date de fin" />
                                </div>

                                {/* Filtre Motif */}
                                <div className="relative">
                                    <FileText className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                                    <input type="text" placeholder="Motif..." value={filters.motif} onChange={(e) => updateFilter({ motif: e.target.value })} className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50" />
                                </div>

                                {/* Filtre Direction */}
                                <div className="relative lg:col-span-4 max-w-xs">
                                    <Building2 className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                                    <select value={filters.direction} onChange={(e) => updateFilter({ direction: e.target.value })} className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50">
                                        <option value="">Toutes les directions</option>
                                        {directions.map((direction) => (
                                            <option key={direction.id} value={direction.name}>
                                                {direction.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-slate-100 items-center justify-between">
                                <div className="flex gap-4">
                                    <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 cursor-pointer bg-slate-50 px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors">
                                        <input type="checkbox" checked={filters.sansRetour} onChange={(e) => updateFilter({ sansRetour: e.target.checked })} className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500" />
                                        ⏳ Sorties en cours (Non rentré)
                                    </label>
                                </div>

                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-semibold text-slate-500">Afficher :</span>
                                    <select value={filters.limit} onChange={(e) => updateFilter({ limit: e.target.value })} className="border border-slate-200 rounded-lg text-sm px-3 py-2 outline-none bg-white font-medium text-slate-700 hover:bg-slate-50 focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer">
                                        <option value="10">10 / page</option>
                                        <option value="30">30 / page</option>
                                        <option value="100">100 / page</option>
                                        <option value="all">Tous (Local)</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Tableau */}
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50/80 border-b border-slate-100 text-slate-500 text-xs uppercase tracking-wider font-semibold">
                                            {filters.limit === 'all' && (
                                                <th className="p-4 w-12 text-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={sorties.length > 0 && selectedRowIds.length === sorties.length}
                                                        onChange={toggleAllRows}
                                                        className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                                                        title="Tout sélectionner"
                                                    />
                                                </th>
                                            )}
                                            <th className="p-4 w-24">N°</th>
                                            <th className="p-4">Employé</th>
                                            <th className="p-4">Direction</th>
                                            <th className="p-4">Motif</th>
                                            <th className="p-4">Date</th>
                                            <th className="p-4 text-center">Heures (Sortie → Retour)</th>
                                            <th className="p-4 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {isLoading ? (
                                            <tr><td colSpan={filters.limit === 'all' ? 8 : 7} className="p-12 text-center text-slate-400"><Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" /></td></tr>
                                        ) : displayedSorties.length === 0 ? (
                                            <tr>
                                                <td colSpan={filters.limit === 'all' ? 8 : 7} className="p-12 text-center text-slate-500">
                                                    <Clock className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                                                    <p className="font-medium text-lg">Aucune sortie trouvée</p>
                                                    <p className="text-sm text-slate-400">Modifiez vos filtres ou créez un nouveau bon de sortie.</p>
                                                </td>
                                            </tr>
                                        ) : (
                                            displayedSorties.map((s) => (
                                                <tr key={s.id} className="hover:bg-blue-50/30 transition-colors group">
                                                    {filters.limit === 'all' && (
                                                        <td className="p-4 text-center">
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedRowIds.includes(s.id)}
                                                                onChange={() => toggleRowSelection(s.id)}
                                                                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                                                            />
                                                        </td>
                                                    )}
                                                    <td className="p-4">
                                                        <span className="font-mono text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded-md border border-slate-200">{s.numero}</span>
                                                    </td>
                                                    <td className="p-4">
                                                        <div className="font-bold text-slate-800">{s.employee.nom} {s.employee.prenom}</div>
                                                        <div className="text-xs text-slate-500 font-medium">{s.employee.matricule}</div>
                                                    </td>
                                                    <td className="p-4 text-sm font-medium text-slate-700">
                                                        {s.direction || s.employee.zoneEmployes?.[0]?.zone?.name || "-"}
                                                    </td>
                                                    <td className="p-4 font-medium text-slate-700 max-w-[200px] truncate" title={s.motif}>{s.motif}</td>
                                                    <td className="p-4">
                                                        <span className="font-semibold text-slate-600">{new Date(s.date).toLocaleDateString()}</span>
                                                    </td>
                                                    <td className="p-4 text-center">
                                                        <div className="flex items-center justify-center gap-2 text-sm text-slate-600">
                                                            <span className="font-bold text-slate-800 bg-slate-100 px-2 py-1 rounded">{s.heure_sortie}</span>
                                                            <span className="text-slate-300">→</span>
                                                            {s.heure_entree ? (
                                                                <span className="font-bold text-slate-800 bg-slate-100 px-2 py-1 rounded">{s.heure_entree}</span>
                                                            ) : (
                                                                <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-xs font-bold animate-pulse">En cours</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="p-4">
                                                        <div className="flex gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                                                            {hasPermissionPrint && <button onClick={() => handlePrint(s)} className="p-2 bg-slate-50 text-slate-600 rounded-lg hover:bg-slate-200 border border-slate-200" title="Imprimer Bon de Sortie">
                                                                <Printer className="w-4 h-4" />
                                                            </button>}
                                                            {/* {!s.heure_entree && hasPermissionUpdate && (
                                                                <button onClick={() => handleTerminer(s)} className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 border border-emerald-100" title="Marquer le retour">
                                                                    <CheckSquare className="w-4 h-4" />
                                                                </button>
                                                            )} */}
                                                            {(hasPermissionAdd || hasPermissionUpdate) && <button onClick={() => openModal(s)} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 border border-blue-100" title="Modifier">
                                                                <Edit className="w-4 h-4" />
                                                            </button>}
                                                            {hasPermissionDelete && <button onClick={() => handleDelete(s.id)} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 border border-red-100" title="Supprimer">
                                                                <X className="w-4 h-4" />
                                                            </button>}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination */}
                            <div className="p-4 border-t border-slate-100 flex justify-between items-center bg-slate-50/50">
                                <button disabled={page === 1} onClick={() => handlePageChange(page - 1)} className="px-5 py-2 text-sm font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl disabled:opacity-40 hover:bg-slate-50 shadow-sm transition-all">Précédent</button>
                                <span className="text-sm font-medium text-slate-500 bg-slate-100 px-3 py-1 rounded-lg">Page {page} sur {displayedTotalPages}</span>
                                <button disabled={page >= displayedTotalPages} onClick={() => handlePageChange(page + 1)} className="px-5 py-2 text-sm font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl disabled:opacity-40 hover:bg-slate-50 shadow-sm transition-all">Suivant</button>
                            </div>
                        </div>

                        {/* Modal Création/Edition */}
                        {isModalOpen && (
                            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                                <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-100 transform transition-all">
                                    <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                            {editingSortie ? <Edit className="w-5 h-5 text-blue-600" /> : <Plus className="w-5 h-5 text-blue-600" />}
                                            {editingSortie ? "Modifier le bon de sortie" : "Nouveau Bon de Sortie"}
                                        </h2>
                                        <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 p-2 rounded-full transition-colors"><X className="w-5 h-5" /></button>
                                    </div>

                                    <form onSubmit={handleSave} className="p-6 space-y-5 max-h-[calc(80vh-2rem)] overflow-y-auto">

                                        {/* Ligne 1: Numéro & Employé */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                            <div>
                                                <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5"><Hash className="w-4 h-4 text-slate-400" /> N° Bon de sortie</label>
                                                <input type="text" placeholder="Ex: S-2026-001" value={formData.numero} onChange={(e) => setFormData({ ...formData, numero: e.target.value })} className="w-full p-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50" required />
                                            </div>

                                            <div className="relative">
                                                <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">Employé assigné</label>
                                                {formData.employee_id ? (
                                                    <div className="flex justify-between items-center p-2.5 bg-blue-50 border border-blue-200 rounded-xl h-[42px]">
                                                        <span className="text-blue-900 font-bold text-sm">{selectedEmpDisplay}</span>
                                                        {!editingSortie && (
                                                            <button type="button" onClick={() => { setFormData({ ...formData, employee_id: "" }); setEmpSearch(""); }} className="text-blue-600 hover:text-blue-800 text-xs font-bold px-2 py-1 bg-blue-100 rounded-md">Changer</button>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <>
                                                        <input type="text" placeholder="Rechercher (Nom, Matricule)..." value={empSearch} onChange={(e) => setEmpSearch(e.target.value)} className="w-full p-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50" required />
                                                        {empResults.length > 0 && (
                                                            <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                                                                {empResults.map(emp => (
                                                                    <div key={emp.id} onClick={() => { setFormData({ ...formData, employee_id: emp.id }); setSelectedEmpDisplay(`${emp.nom} ${emp.prenom}`); setEmpResults([]); }} className="p-3 hover:bg-slate-50 cursor-pointer text-sm border-b border-slate-50 last:border-0">
                                                                        <div className="font-bold text-slate-800">{emp.nom} {emp.prenom}</div>
                                                                        <div className="text-xs text-slate-500 font-medium">{emp.matricule}</div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        {/* Ligne 2: Direction & Date */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                            <div>
                                                <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5"><Building2 className="w-4 h-4 text-slate-400" /> Direction / Affectation</label>
                                                <select value={formData.direction} onChange={(e) => setFormData({ ...formData, direction: e.target.value })} className="w-full p-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50">
                                                    <option value="">Sélectionner une direction</option>
                                                    {directions.map((direction) => (
                                                        <option key={direction.id} value={direction.name}>{direction.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Date</label>
                                                <input type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} className="w-full p-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50" required />
                                            </div>
                                        </div>

                                        {/* Ligne 3: Motif */}
                                        <div>
                                            <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5"><FileText className="w-4 h-4 text-slate-400" /> Motif de la sortie</label>
                                            <input type="text" placeholder="Raison de la sortie..." value={formData.motif} onChange={(e) => setFormData({ ...formData, motif: e.target.value })} className="w-full p-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50" required />
                                        </div>

                                        {/* Ligne 4: Heures */}
                                        <div className="grid grid-cols-2 gap-5 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                            <div>
                                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Heure de sortie</label>
                                                <input type="time" value={formData.heure_sortie} onChange={(e) => setFormData({ ...formData, heure_sortie: e.target.value })} className="w-full p-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none" required />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-semibold text-slate-700 mb-1.5 text-slate-500">Heure de retour <span className="font-normal text-xs">(Optionnel)</span></label>
                                                <input type="time" value={formData.heure_entree} onChange={(e) => setFormData({ ...formData, heure_entree: e.target.value })} className="w-full p-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                                            </div>
                                        </div>

                                        <div className="pt-6 mt-2 border-t border-slate-100 flex justify-end gap-3">
                                            <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors">Annuler</button>
                                            <button type="submit" className="px-6 py-2.5 bg-slate-900 text-white text-sm font-bold rounded-xl hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 flex items-center gap-2">
                                                <Save className="w-4 h-4" /> {editingSortie ? "Sauvegarder" : "Créer le bon"}
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        )}

                        {/* Modal Export Excel */}
                        {isExportModalOpen && (
                            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                                <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100">
                                    <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-emerald-50">
                                        <h2 className="text-xl font-bold text-emerald-900 flex items-center gap-2">
                                            <FileSpreadsheet className="w-6 h-6 text-emerald-600" />
                                            Exporter les bons de sortie
                                        </h2>
                                        <button onClick={() => setIsExportModalOpen(false)} className="text-emerald-400 hover:text-emerald-700 bg-white p-2 rounded-full transition-colors"><X className="w-5 h-5" /></button>
                                    </div>
                                    <div className="p-6">
                                        <p className="text-sm text-slate-500 mb-4 font-medium">Sélectionnez les colonnes à inclure dans votre fichier Excel :</p>
                                        <div className="flex items-center gap-3 mb-4 pb-4 border-b border-slate-100">
                                            <button
                                                onClick={() => setSelectedExportColumns(selectedExportColumns.length === getExportColumns().length ? [] : getExportColumns().map(c => c.id))}
                                                className="text-xs font-bold px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
                                            >
                                                {selectedExportColumns.length === getExportColumns().length ? "Tout décocher" : "Tout sélectionner"}
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3 max-h-64 overflow-y-auto pr-2">
                                            {getExportColumns().map((col) => (
                                                <label key={col.id} className="flex items-center gap-3 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-50 p-2 rounded-lg transition-colors border border-transparent hover:border-slate-100">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedExportColumns.includes(col.id)}
                                                        onChange={(e) => {
                                                            if (e.target.checked) setSelectedExportColumns([...selectedExportColumns, col.id]);
                                                            else setSelectedExportColumns(selectedExportColumns.filter(id => id !== col.id));
                                                        }}
                                                        className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                                                    />
                                                    {col.label}
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
                                        <button onClick={() => setIsExportModalOpen(false)} className="px-6 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-200 rounded-xl transition-colors">Annuler</button>
                                        <button
                                            onClick={handleGenerateExport}
                                            disabled={isExporting || selectedExportColumns.length === 0}
                                            className="px-6 py-2.5 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 flex items-center gap-2 disabled:opacity-50"
                                        >
                                            {isExporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                                            {isExporting ? "Génération..." : "Télécharger CSV"}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </AppShell>
            </div>

            {/* CSS d'impression */}
            <style dangerouslySetInnerHTML={{
                __html: `
    @media print {
        @page {
            margin: 0; 
        }
        body {
            padding: 1cm; 
        }
    }
`}} />

            {/* ZONE D'IMPRESSION */}
            {sortieToPrint && (
                <div className="hidden print:block bg-white text-black text-sm w-full font-serif" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
                    <div className="">
                        {/* En-tête */}
                        <div className="flex justify-between items-start mb-8">
                            <img src="/DNK.png" alt="Logo" className="w-48 object-contain" />
                            <div className="text-center text-xs font-bold leading-snug border border-black p-2">
                                <p>الجمهورية الجزائرية الديمقراطية الشعبية</p>
                                <p>République Algérienne Démocratique et Populaire</p>
                                <p>Ministère des Transports</p>
                                <p>EPE "EL DJAMIAYA LINAKL OUA EL KHADAMATES" SPA</p>
                            </div>
                        </div>

                        {/* Références */}
                        <div className="flex justify-between mb-6 font-bold text-sm">
                            <div className="underline">
                                DIRECTION : {sortieToPrint.direction || sortieToPrint.employee?.zoneEmployes?.[0]?.zone?.name || ".............................."}
                            </div>
                            <div className="uppercase">LE : {formatDateForPrint(sortieToPrint.date)}</div>
                        </div>

                        {/* Titre */}
                        <div className="text-center mb-12">
                            <h1 className="text-3xl font-bold border-4 border-black inline-block px-10 py-3 uppercase tracking-widest">BON DE SORTIE</h1>
                            <p className="mt-2 font-bold text-lg">N° {sortieToPrint.numero}</p>
                        </div>

                        {/* Informations */}
                        <div className="space-y-8 text-lg font-bold pl-8 mb-16">
                            <p className="uppercase">IL EST AUTORISÉ À MR / MME : <span className="border-b-2 border-black  w-2/3 text-center">{sortieToPrint.employee?.nom} {sortieToPrint.employee?.prenom}</span></p>
                            <p className="uppercase">FONCTION : <span className="border-b-2 border-black inline-block w-3/4 text-center">{sortieToPrint.employee?.poste || "................................................"}</span></p>
                            <p className="uppercase">MATRICULE : <span className="border-b-2 border-black inline-block w-1/3 text-center">{sortieToPrint.employee?.matricule}</span></p>

                            <p className="uppercase pt-6">MOTIF DE LA SORTIE : <span className="border-b-2 border-black inline-block w-2/3 text-center">{sortieToPrint.motif}</span></p>

                            <div className="flex justify-between pt-6 pr-12">
                                <p className="uppercase">HEURE DE DÉPART : <span className="border-b-2 border-black w-32 text-center">{sortieToPrint.heure_sortie}</span></p>
                            </div>
                            <div className="flex justify-between pt-6 pr-12">
                                <p className="uppercase">HEURE DE RETOUR : <span className="border-b-2 border-black w-32 text-center">{sortieToPrint.heure_entree || "........ : ........ "}</span></p>
                            </div>
                        </div>

                        {/* Signatures Pied de page */}
                        <div className="flex justify-between items-start font-bold text-lg px-12 mt-20 mb-2">
                            <div className="text-center">
                                <p className="underline mb-12">SIGNATURE DE L'INTÉRESSÉ(E)</p>
                            </div>
                            <div className="text-center">
                                <p className="underline mb-12">LE RESPONSABLE HIÉRARCHIQUE</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
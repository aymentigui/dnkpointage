"use client";

import { useState, useEffect, useMemo } from "react";
import { Search, Plus, X, Loader2, Edit, CheckSquare, Save, Calendar, RefreshCcw, Download, FileSpreadsheet, Activity, ShieldPlus, Trash } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { useSession } from "@/hooks/use-session";

export default function MaladiesPage() {
    const [maladies, setMaladies] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [isLoading, setIsLoading] = useState(true);

    // Système de déclenchement de fetch
    const [fetchTrigger, setFetchTrigger] = useState(0);

    // Filtres avec limite
    const [filters, setFilters] = useState({
        sansRetour: false,
        type_maladie: "",
        dateDebut: "",
        dateFin: "",
        employeeId: "",
        limit: "10"
    });

    // Lignes sélectionnées pour l'export (Mode "Tous")
    const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingMaladie, setEditingMaladie] = useState<any>(null);

    // Export Excel state
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [selectedExportColumns, setSelectedExportColumns] = useState<string[]>([]);

    // Form state
    const [formData, setFormData] = useState({
        employee_id: "", date: "", duree: "1", date_retour: "", type_maladie: "", caisse_assurance: ""
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
        session?.user?.is_admin || session?.user?.permissions.some((p: string[]) => p.includes("maladie_view"))
    ), [session]);

    const hasPermissionAdd = useMemo(() => (
        session?.user?.is_admin || session?.user?.permissions.some((p: string[]) => p.includes("maladie_create"))
    ), [session]);

    const hasPermissionUpdate = useMemo(() => (
        session?.user?.is_admin || session?.user?.permissions.some((p: string[]) => p.includes("maladie_update"))
    ), [session]);

    const hasPermissionExport = useMemo(() => (
        session?.user?.is_admin || session?.user?.permissions.some((p: string[]) => p.includes("maladie_export"))
    ), [session]);

    const hasPermissionDelete = useMemo(() => (
        session?.user?.is_admin || session?.user?.permissions.some((p: string[]) => p.includes("maladie_delete"))
    ), [session]);

    // Définition dynamique des colonnes d'export
    const getExportColumns = () => {
        return [
            { id: 'employee', label: 'Employé (Nom & Prénom)' },
            { id: 'matricule', label: 'Matricule' },
            { id: 'fonction', label: 'Fonction' },
            { id: 'type_maladie', label: 'Type de Maladie' },
            { id: 'caisse_assurance', label: 'Caisse d\'Assurance' },
            { id: 'date_debut', label: 'Date de Début' },
            { id: 'duree', label: 'Durée (Jours)' },
            { id: 'date_retour', label: 'Date de Retour' }
        ];
    };

    useEffect(() => {
        setSelectedExportColumns(getExportColumns().map(c => c.id));
    }, []);

    const fetchMaladies = async () => {
        setIsLoading(true);
        const query = new URLSearchParams({
            page: filters.limit === 'all' ? "1" : page.toString(),
            limit: filters.limit === 'all' ? '999999' : filters.limit,
            sansRetour: filters.sansRetour.toString(),
            ...(filters.type_maladie && { type_maladie: filters.type_maladie }),
            ...(filters.dateDebut && { dateDebut: filters.dateDebut }),
            ...(filters.dateFin && { dateFin: filters.dateFin }),
            ...(filters.employeeId && { employeeId: filters.employeeId }),
        });

        const res = await fetch(`/api/maladies?${query}`);
        const data = await res.json();
        setMaladies(data.maladies || []);
        setTotal(data.pages || 1);
        setIsLoading(false);
    };

    useEffect(() => {
        fetchMaladies();
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
        if (selectedRowIds.length === maladies.length) {
            setSelectedRowIds([]);
        } else {
            setSelectedRowIds(maladies.map(m => m.id));
        }
    };

    // Recherche employé (Formulaire)
    useEffect(() => {
        if (empSearch.length >= 2 && !formData.employee_id) {
            fetch(`/api/missions/employees/search?q=${empSearch}`)
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

        const url = editingMaladie ? `/api/maladies/${editingMaladie.id}` : "/api/maladies";
        const method = editingMaladie ? "PUT" : "POST";

        await fetch(url, {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formData)
        });

        setIsModalOpen(false);
        setFetchTrigger(prev => prev + 1);
    };

    const handleDelete = async (id: string) => {
        if (confirm("Êtes-vous sûr de vouloir supprimer cette maladie ?")) {
            await fetch(`/api/maladies/${id}`, {
                method: "DELETE",
            });
            setFetchTrigger(prev => prev + 1);
        }
    };

    const handleTerminer = async (maladie: any) => {
        const dateRetour = prompt("Date de retour (YYYY-MM-DD) ?");
        if (!dateRetour || !dateRetour.match(/^\d{4}-\d{2}-\d{2}$/)) {
            if (dateRetour) alert("Format de date invalide. Veuillez utiliser YYYY-MM-DD.");
            return;
        }

        await fetch(`/api/maladies/${maladie.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            // La route PUT /api/maladies/[id] demande toutes les infos
            body: JSON.stringify({ ...maladie, date_retour: dateRetour })
        });
        setFetchTrigger(prev => prev + 1);
    };

    const openModal = (maladie: any = null) => {
        if (!hasPermissionAdd && !hasPermissionUpdate) return;
        if (maladie) {
            setEditingMaladie(maladie);
            setFormData({
                employee_id: maladie.employee_id,
                date: maladie.date.split('T')[0],
                duree: maladie.duree.toString(),
                date_retour: maladie.date_retour ? maladie.date_retour.split('T')[0] : "",
                type_maladie: maladie.type_maladie || "",
                caisse_assurance: maladie.caisse_assurance || ""
            });
            setSelectedEmpDisplay(`${maladie.employee.nom} ${maladie.employee.prenom}`);
        } else {
            setEditingMaladie(null);
            setFormData({ employee_id: "", date: new Date().toISOString().split('T')[0], duree: "1", date_retour: "", type_maladie: "", caisse_assurance: "" });
            setEmpSearch("");
            setSelectedEmpDisplay("");
        }
        setIsModalOpen(true);
    };

    const handleGenerateExport = async () => {
        setIsExporting(true);
        try {
            const query = new URLSearchParams({
                page: "1",
                limit: "999999",
                sansRetour: filters.sansRetour.toString(),
                ...(filters.type_maladie && { type_maladie: filters.type_maladie }),
                ...(filters.dateDebut && { dateDebut: filters.dateDebut }),
                ...(filters.dateFin && { dateFin: filters.dateFin }),
                ...(filters.employeeId && { employeeId: filters.employeeId }),
            });

            const res = await fetch(`/api/maladies?${query}`);
            const data = await res.json();
            let exportData = data.maladies || [];

            if (filters.limit === 'all' && selectedRowIds.length > 0) {
                exportData = exportData.filter((s: any) => selectedRowIds.includes(s.id));
            }

            const colsToExport = getExportColumns().filter(c => selectedExportColumns.includes(c.id));
            const headers = colsToExport.map(c => `"${c.label}"`).join(";");

            const rows = exportData.map((m: any) => {
                return colsToExport.map(c => {
                    let val: any = "";
                    if (c.id === 'employee') val = `${m.employee?.nom} ${m.employee?.prenom}`;
                    if (c.id === 'matricule') val = m.employee?.matricule;
                    if (c.id === 'fonction') val = m.employee?.poste || "";
                    if (c.id === 'type_maladie') val = m.type_maladie || "";
                    if (c.id === 'caisse_assurance') val = m.caisse_assurance || "";
                    if (c.id === 'date_debut') val = new Date(m.date).toLocaleDateString('fr-FR');
                    if (c.id === 'duree') val = m.duree;
                    if (c.id === 'date_retour') val = m.date_retour ? new Date(m.date_retour).toLocaleDateString('fr-FR') : "Non clôturé";

                    return `"${String(val).replace(/"/g, '""')}"`;
                }).join(";");
            });

            const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers, ...rows].join("\n");
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", `Export_Maladies_${new Date().toISOString().slice(0, 10)}.csv`);
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
        setFilters({ sansRetour: false, type_maladie: "", dateDebut: "", dateFin: "", employeeId: "", limit: "10" });
        setFilterEmpSearch("");
        setFilterSelectedEmpDisplay("");
        setPage(1);
        setSelectedRowIds([]);
        setFetchTrigger(prev => prev + 1);
    };

    const displayedMaladies = filters.limit === 'all'
        ? maladies.slice((page - 1) * 20, page * 20)
        : maladies;

    const displayedTotalPages = filters.limit === 'all'
        ? Math.max(1, Math.ceil(maladies.length / 20))
        : total;

    return (
        <AppShell>
            <div className="max-w-7xl mx-auto p-4 sm:p-8 min-h-screen bg-[#F8FAFC] font-sans">
                {/* Header */}
                <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-extrabold text-slate-900 flex items-center gap-3 tracking-tight">
                            <div className="bg-red-500 p-2.5 rounded-xl shadow-lg shadow-red-200">
                                <Activity className="w-6 h-6 text-white" />
                            </div>
                            Arrêts Maladie
                        </h1>
                        <p className="text-slate-500 mt-2 font-medium">Gérez et suivez les arrêts de travail et congés maladie.</p>
                    </div>
                    <div className="flex gap-3">
                        {hasPermissionExport && (
                            <button onClick={() => setIsExportModalOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all shadow-md shadow-emerald-200">
                                <Download className="w-5 h-5" /> Exporter Excel {filters.limit === 'all' && selectedRowIds.length > 0 ? `(${selectedRowIds.length})` : ''}
                            </button>
                        )}
                        {(hasPermissionAdd || hasPermissionUpdate) && (
                            <button onClick={() => openModal()} className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all shadow-md shadow-slate-200">
                                <Plus className="w-5 h-5" /> Ajouter un Arrêt
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

                        {/* Filtre Type Maladie */}
                        <div className="relative">
                            <Activity className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                            <input type="text" placeholder="Type (Ex: AT, Congé Maternité)..." value={filters.type_maladie} onChange={(e) => updateFilter({ type_maladie: e.target.value })} className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50" />
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-slate-100 items-center justify-between">
                        <div className="flex gap-4">
                            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 cursor-pointer bg-slate-50 px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors">
                                <input type="checkbox" checked={filters.sansRetour} onChange={(e) => updateFilter({ sansRetour: e.target.checked })} className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500" />
                                ⏳ Non clôturé (Sans Retour)
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
                                                checked={maladies.length > 0 && selectedRowIds.length === maladies.length}
                                                onChange={toggleAllRows}
                                                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                                                title="Tout sélectionner"
                                            />
                                        </th>
                                    )}
                                    <th className="p-4">Employé</th>
                                    <th className="p-4">Type / Assurance</th>
                                    <th className="p-4">Date de Début</th>
                                    <th className="p-4 text-center">Durée</th>
                                    <th className="p-4 text-center">Date de Retour</th>
                                    <th className="p-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {isLoading ? (
                                    <tr><td colSpan={filters.limit === 'all' ? 7 : 6} className="p-12 text-center text-slate-400"><Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" /></td></tr>
                                ) : displayedMaladies.length === 0 ? (
                                    <tr>
                                        <td colSpan={filters.limit === 'all' ? 7 : 6} className="p-12 text-center text-slate-500">
                                            <Activity className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                                            <p className="font-medium text-lg">Aucun arrêt maladie trouvé</p>
                                            <p className="text-sm text-slate-400">Modifiez vos filtres ou créez une nouvelle entrée.</p>
                                        </td>
                                    </tr>
                                ) : (
                                    displayedMaladies.map((m) => (
                                        <tr key={m.id} className="hover:bg-blue-50/30 transition-colors group">
                                            {filters.limit === 'all' && (
                                                <td className="p-4 text-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedRowIds.includes(m.id)}
                                                        onChange={() => toggleRowSelection(m.id)}
                                                        className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                                                    />
                                                </td>
                                            )}
                                            <td className="p-4">
                                                <div className="font-bold text-slate-800">{m.employee.nom} {m.employee.prenom}</div>
                                                <div className="text-xs text-slate-500 font-medium">{m.employee.matricule}</div>
                                            </td>
                                            <td className="p-4">
                                                <div className="font-medium text-slate-700">{m.type_maladie || "Non spécifié"}</div>
                                                <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mt-0.5">{m.caisse_assurance}</div>
                                            </td>
                                            <td className="p-4">
                                                <span className="font-semibold text-slate-600">{new Date(m.date).toLocaleDateString()}</span>
                                            </td>
                                            <td className="p-4 text-center">
                                                <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded font-bold text-sm">{m.duree} Jours</span>
                                            </td>
                                            <td className="p-4 text-center">
                                                {m.date_retour ? (
                                                    <span className="font-semibold text-slate-800">{new Date(m.date_retour).toLocaleDateString()}</span>
                                                ) : (
                                                    <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-xs font-bold animate-pulse">En cours</span>
                                                )}
                                            </td>
                                            <td className="p-4">
                                                <div className="flex gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {!m.date_retour && hasPermissionUpdate && (
                                                        <button onClick={() => handleTerminer(m)} className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 border border-emerald-100" title="Marquer le retour">
                                                            <CheckSquare className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    {(hasPermissionAdd || hasPermissionUpdate) && <button onClick={() => openModal(m)} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 border border-blue-100" title="Modifier">
                                                        <Edit className="w-4 h-4" />
                                                    </button>}
                                                    {hasPermissionDelete && <button onClick={() => handleDelete(m.id)} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 border border-red-100" title="Supprimer">
                                                        <Trash className="w-4 h-4" />
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
                                    {editingMaladie ? <Edit className="w-5 h-5 text-blue-600" /> : <Plus className="w-5 h-5 text-blue-600" />}
                                    {editingMaladie ? "Modifier l'arrêt maladie" : "Nouvel Arrêt Maladie"}
                                </h2>
                                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 p-2 rounded-full transition-colors"><X className="w-5 h-5" /></button>
                            </div>

                            <form onSubmit={handleSave} className="p-6 space-y-5 max-h-[calc(80vh-2rem)] overflow-y-auto">

                                {/* Ligne 1: Employé */}
                                <div className="grid grid-cols-1 gap-5">
                                    <div className="relative">
                                        <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">Employé concerné</label>
                                        {formData.employee_id ? (
                                            <div className="flex justify-between items-center p-2.5 bg-blue-50 border border-blue-200 rounded-xl h-[42px]">
                                                <span className="text-blue-900 font-bold text-sm">{selectedEmpDisplay}</span>
                                                {!editingMaladie && (
                                                    <button type="button" onClick={() => { setFormData({ ...formData, employee_id: "" }); setEmpSearch(""); }} className="text-blue-600 hover:text-blue-800 text-xs font-bold px-2 py-1 bg-blue-100 rounded-md">Changer</button>
                                                )}
                                            </div>
                                        ) : (
                                            <>
                                                <Search className="absolute left-3 top-8 h-4 w-4 text-slate-400" />
                                                <input type="text" placeholder="Rechercher (Nom, Matricule)..." value={empSearch} onChange={(e) => setEmpSearch(e.target.value)} className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50" required />
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

                                {/* Ligne 2: Assurance et Type */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5"><ShieldPlus className="w-4 h-4 text-slate-400" /> Caisse d'Assurance</label>
                                        <input type="text" placeholder="Ex: CNAS, CASNOS..." value={formData.caisse_assurance} onChange={(e) => setFormData({ ...formData, caisse_assurance: e.target.value })} className="w-full p-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50" required />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5"><Activity className="w-4 h-4 text-slate-400" /> Type de Maladie</label>
                                        <input type="text" placeholder="Ex: Accident de travail, Maternité..." value={formData.type_maladie} onChange={(e) => setFormData({ ...formData, type_maladie: e.target.value })} className="w-full p-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50" />
                                    </div>
                                </div>

                                {/* Ligne 3: Dates et Durée */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 p-4 bg-slate-50 rounded-2xl border border-slate-100 items-end">
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Date Début</label>
                                        <input type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} className="w-full p-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none" required />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Durée (Jours)</label>
                                        <input type="number" min="1" value={formData.duree} onChange={(e) => setFormData({ ...formData, duree: e.target.value })} className="w-full p-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none" required />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-1.5 text-slate-500">Date Retour <span className="font-normal text-xs">(Optionnel)</span></label>
                                        <input type="date" min={formData.date} value={formData.date_retour} onChange={(e) => setFormData({ ...formData, date_retour: e.target.value })} className="w-full p-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                                    </div>
                                </div>

                                <div className="pt-6 mt-2 border-t border-slate-100 flex justify-end gap-3">
                                    <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors">Annuler</button>
                                    <button type="submit" className="px-6 py-2.5 bg-slate-900 text-white text-sm font-bold rounded-xl hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 flex items-center gap-2">
                                        <Save className="w-4 h-4" /> {editingMaladie ? "Sauvegarder" : "Créer l'arrêt"}
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
                                    Exporter les Arrêts Maladie
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
    );
}
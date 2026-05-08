"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Search, MapPin, Car, Plus, X, Loader2, Edit, CheckSquare, Save, Calendar, Hash, RefreshCcw, Navigation, Printer, Building2, Download, FileSpreadsheet } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { useSession } from "@/hooks/use-session";

export default function MissionsPage() {
    const [missions, setMissions] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [isLoading, setIsLoading] = useState(true);
    const [directions, setDirections] = useState<any[]>([]);

    // Système de déclenchement de fetch (pour éviter les doubles requêtes avec la pagination locale)
    const [fetchTrigger, setFetchTrigger] = useState(0);

    // Filtres avec nouveaux champs et limite
    const [filters, setFilters] = useState({
        sansRetour: false,
        plus80km: false,
        matricule: "",
        direction: "",
        dateDebut: "",
        dateRetour: "",
        employeeId: "",
        limit: "10"
    });

    // Lignes sélectionnées pour l'export (Mode "Tous")
    const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingMission, setEditingMission] = useState<any>(null);

    // Print state
    const [missionToPrint, setMissionToPrint] = useState<any>(null);

    // Export Excel state
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [selectedExportColumns, setSelectedExportColumns] = useState<string[]>([]);

    // Form state
    const [formData, setFormData] = useState({
        numero: "", destination: "", employee_id: "", date_debut: "", date_retour: "", plus_80km: false, drahem: "0", vehicule_matricule: "", drahem_lidahom: "0", direction: "",
    });

    // Autocomplete Employés (Pour le Formulaire)
    const [empSearch, setEmpSearch] = useState("");
    const [empResults, setEmpResults] = useState<any[]>([]);
    const [selectedEmpDisplay, setSelectedEmpDisplay] = useState("");

    // Autocomplete Employés (Pour les Filtres)
    const [filterEmpSearch, setFilterEmpSearch] = useState("");
    const [filterEmpResults, setFilterEmpResults] = useState<any[]>([]);
    const [filterSelectedEmpDisplay, setFilterSelectedEmpDisplay] = useState("");

    // permission
    const { session } = useSession();

    const hasPermissionMissionView = useMemo(() => (
        session?.user?.is_admin || session?.user?.permissions.some((p: string[]) => p.includes("mission_view"))
    ), [session]);

    const hasPermissionMissionAdd = useMemo(() => (
        session?.user?.is_admin || session?.user?.permissions.some((p: string[]) => p.includes("mission_create"))
    ), [session]);

    const hasPermissionMissionUpdate = useMemo(() => (
        session?.user?.is_admin || session?.user?.permissions.some((p: string[]) => p.includes("mission_update"))
    ), [session]);

    const hasPermissionMissionDelete = useMemo(() => (
        session?.user?.is_admin || session?.user?.permissions.some((p: string[]) => p.includes("mission_delete"))
    ), [session]);

    const hasPermissionMissionExport = useMemo(() => (
        session?.user?.is_admin || session?.user?.permissions.some((p: string[]) => p.includes("mission_export"))
    ), [session]);

    const hasPermissionMissionEditDrahem = useMemo(() => (
        session?.user?.is_admin || session?.user?.permissions.some((p: string[]) => p.includes("mission_edit_drahem"))
    ), [session]);

    const hasPermissionMissionEditDrahemLidahom = useMemo(() => (
        session?.user?.is_admin || session?.user?.permissions.some((p: string[]) => p.includes("mission_edit_drahem_lidahom"))
    ), [session]);

    const hasPermissionMissionViewDrahem = useMemo(() => (
        session?.user?.is_admin || session?.user?.permissions.some((p: string[]) => p.includes("mission_view_drahem"))
    ), [session]);

    const hasPermissionMissionViewDrahemLidahom = useMemo(() => (
        session?.user?.is_admin || session?.user?.permissions.some((p: string[]) => p.includes("mission_view_drahem_lidahom"))
    ), [session]);

    const hasPermissionMissionPrint = useMemo(() => (
        session?.user?.is_admin || session?.user?.permissions.some((p: string[]) => p.includes("mission_print"))
    ), [session]);

    // Définition dynamique des colonnes d'export selon les permissions
    const getExportColumns = () => {
        const cols = [
            { id: 'numero', label: 'N° Mission' },
            { id: 'employee', label: 'Employé (Nom & Prénom)' },
            { id: 'matricule', label: 'Matricule' },
            { id: 'fonction', label: 'Fonction' },
            { id: 'direction', label: 'Direction / Affectation' },
            { id: 'destination', label: 'Destination' },
            { id: 'date_debut', label: 'Date Début' },
            { id: 'date_retour', label: 'Date Retour' },
            { id: 'plus_80km', label: 'Distance > 80km' },
            { id: 'vehicule', label: 'Véhicule (Matricule)' }
        ];
        if (hasPermissionMissionViewDrahem) cols.push({ id: 'drahem', label: 'Frais (DA)' });
        if (hasPermissionMissionViewDrahemLidahom) cols.push({ id: 'drahem_lidahom', label: 'Frais Alloué (DA)' });
        return cols;
    };

    useEffect(() => {
        setSelectedExportColumns(getExportColumns().map(c => c.id));
    }, [hasPermissionMissionViewDrahem, hasPermissionMissionViewDrahemLidahom]);

    const fetchMissions = async () => {
        setIsLoading(true);
        const query = new URLSearchParams({
            page: filters.limit === 'all' ? "1" : page.toString(),
            limit: filters.limit === 'all' ? '999999' : filters.limit,
            sansRetour: filters.sansRetour.toString(),
            plus80km: filters.plus80km.toString(),
            ...(filters.matricule && { matricule: filters.matricule }),
            ...(filters.direction && { direction: filters.direction }),
            ...(filters.dateDebut && { dateDebut: filters.dateDebut }),
            ...(filters.dateRetour && { dateRetour: filters.dateRetour }),
            ...(filters.employeeId && { employeeId: filters.employeeId }),
        });

        const res = await fetch(`/api/missions?${query}`);
        const data = await res.json();
        setMissions(data.missions || []);
        setTotal(data.pages || 1);
        setIsLoading(false);
    };

    const fetchDirections = async () => {
        const res = await fetch(`/api/missions/directions`);
        const data = await res.json();
        setDirections(data || []);
    };

    // Premier chargement
    useEffect(() => {
        fetchDirections();
    }, []);

    // Déclencheur contrôlé pour la recherche
    useEffect(() => {
        fetchMissions();
    }, [fetchTrigger]);

    // Gestion centralisée des changements de filtres pour reset la page et fetcher
    const updateFilter = (updates: any) => {
        setFilters(prev => ({ ...prev, ...updates }));
        setPage(1);
        setSelectedRowIds([]); // On vide la sélection si on change un filtre
        setFetchTrigger(prev => prev + 1);
    };

    // Gestion du changement de page
    const handlePageChange = (newPage: number) => {
        setPage(newPage);
        if (filters.limit !== 'all') {
            setFetchTrigger(prev => prev + 1);
        }
    };

    // --- Gestion de la sélection multiple (Mode Tous) ---
    const toggleRowSelection = (id: string) => {
        setSelectedRowIds(prev =>
            prev.includes(id) ? prev.filter(rowId => rowId !== id) : [...prev, id]
        );
    };

    const toggleAllRows = () => {
        if (selectedRowIds.length === missions.length) {
            setSelectedRowIds([]); // Tout décocher
        } else {
            setSelectedRowIds(missions.map(m => m.id)); // Tout cocher (sur la base de données locale fetchée)
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

        const finalData = {
            ...formData,
            drahem: formData.plus_80km ? formData.drahem : "0",
            drahem_lidahom: formData.plus_80km ? formData.drahem_lidahom : "0"
        };

        const url = editingMission ? `/api/missions/${editingMission.id}` : "/api/missions";
        const method = editingMission ? "PUT" : "POST";

        await fetch(url, {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(finalData)
        });

        setIsModalOpen(false);
        setFetchTrigger(prev => prev + 1);
    };

    const handleTerminer = async (mission: any) => {
        const dateRetour = prompt("Date de fin (YYYY-MM-DD) ?");
        if (!dateRetour) return;

        await fetch(`/api/missions/${mission.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...mission, date_retour: dateRetour })
        });
        setFetchTrigger(prev => prev + 1);
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Voulez-vous vraiment supprimer cette mission ?")) return;
        await fetch(`/api/missions/${id}`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
        });
        setFetchTrigger(prev => prev + 1);
    };

    const openModal = (mission: any = null) => {
        if (!hasPermissionMissionAdd && !hasPermissionMissionUpdate) return;
        if (mission) {
            setEditingMission(mission);
            setFormData({
                numero: mission.numero || "",
                destination: mission.destination || "",
                employee_id: mission.employee_id,
                date_debut: mission.date_debut.split('T')[0],
                date_retour: mission.date_retour ? mission.date_retour.split('T')[0] : "",
                plus_80km: mission.plus_80km,
                drahem: mission.drahem.toString(),
                drahem_lidahom: mission.drahem_lidahom?.toString() || "0",
                vehicule_matricule: mission.vehicule_matricule || "",
                direction: mission.direction || ""
            });
            setSelectedEmpDisplay(`${mission.employee.nom} ${mission.employee.prenom}`);
        } else {
            setEditingMission(null);
            setFormData({ numero: "", destination: "", employee_id: "", date_debut: "", date_retour: "", plus_80km: false, drahem: "0", vehicule_matricule: "", drahem_lidahom: "0", direction: "" });
            setEmpSearch("");
            setSelectedEmpDisplay("");
        }
        setIsModalOpen(true);
    };

    const handlePrint = (mission: any) => {
        if (!hasPermissionMissionPrint) return;
        setMissionToPrint(mission);
        setTimeout(() => {
            window.print();
        }, 300);
    };

    const handleGenerateExport = async () => {
        setIsExporting(true);
        try {
            // On fetch les données avec les filtres
            const query = new URLSearchParams({
                page: "1",
                limit: "999999",
                sansRetour: filters.sansRetour.toString(),
                plus80km: filters.plus80km.toString(),
                ...(filters.matricule && { matricule: filters.matricule }),
                ...(filters.direction && { direction: filters.direction }),
                ...(filters.dateDebut && { dateDebut: filters.dateDebut }),
                ...(filters.dateRetour && { dateRetour: filters.dateRetour }),
                ...(filters.employeeId && { employeeId: filters.employeeId }),
            });

            const res = await fetch(`/api/missions?${query}`);
            const data = await res.json();
            let exportMissions = data.missions || [];

            // Si le mode 'Tous' est activé ET qu'on a sélectionné des missions spécifiques, on filtre l'export
            if (filters.limit === 'all' && selectedRowIds.length > 0) {
                exportMissions = exportMissions.filter((m: any) => selectedRowIds.includes(m.id));
            }

            const colsToExport = getExportColumns().filter(c => selectedExportColumns.includes(c.id));
            const headers = colsToExport.map(c => `"${c.label}"`).join(";");

            const rows = exportMissions.map((m: any) => {
                return colsToExport.map(c => {
                    let val: any = "";
                    if (c.id === 'numero') val = m.numero;
                    if (c.id === 'employee') val = `${m.employee?.nom} ${m.employee?.prenom}`;
                    if (c.id === 'matricule') val = m.employee?.matricule;
                    if (c.id === 'fonction') val = m.employee?.poste || "";
                    if (c.id === 'direction') val = m.direction || m.employee?.zoneEmployes?.[0]?.zone?.name || "";
                    if (c.id === 'destination') val = m.destination || "";
                    if (c.id === 'date_debut') val = new Date(m.date_debut).toLocaleDateString('fr-FR');
                    if (c.id === 'date_retour') val = m.date_retour ? new Date(m.date_retour).toLocaleDateString('fr-FR') : "En cours";
                    if (c.id === 'plus_80km') val = m.plus_80km ? "Oui" : "Non";
                    if (c.id === 'drahem') val = m.drahem;
                    if (c.id === 'drahem_lidahom') val = m.drahem_lidahom;
                    if (c.id === 'vehicule') val = m.vehicule_matricule || "";

                    return `"${String(val).replace(/"/g, '""')}"`;
                }).join(";");
            });

            const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers, ...rows].join("\n");
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", `Export_Missions_${new Date().toISOString().slice(0, 10)}.csv`);
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
        setFilters({ sansRetour: false, plus80km: false, matricule: "", direction: "", dateDebut: "", dateRetour: "", employeeId: "", limit: "10" });
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

    // Calculs d'affichage local (Pagination Frontend pour le mode "Tous")
    const displayedMissions = filters.limit === 'all'
        ? missions.slice((page - 1) * 20, page * 20)
        : missions;

    const displayedTotalPages = filters.limit === 'all'
        ? Math.max(1, Math.ceil(missions.length / 20))
        : total;

    return (
        <>
            {/* Contenu principal (caché lors de l'impression) */}
            <div className="print:hidden">
                <AppShell>
                    <div className="max-w-7xl mx-auto p-4 sm:p-8 min-h-screen bg-[#F8FAFC] font-sans">
                        {/* Header */}
                        <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div>
                                <h1 className="text-3xl font-extrabold text-slate-900 flex items-center gap-3 tracking-tight">
                                    <div className="bg-blue-600 p-2.5 rounded-xl shadow-lg shadow-blue-200">
                                        <Navigation className="w-6 h-6 text-white" />
                                    </div>
                                    Gestion des Missions
                                </h1>
                                <p className="text-slate-500 mt-2 font-medium">Pilotez les déplacements de vos collaborateurs en temps réel.</p>
                            </div>
                            <div className="flex gap-3">
                                {hasPermissionMissionExport && (
                                    <button onClick={() => setIsExportModalOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all shadow-md shadow-emerald-200">
                                        <Download className="w-5 h-5" /> Exporter Excel {filters.limit === 'all' && selectedRowIds.length > 0 ? `(${selectedRowIds.length})` : ''}
                                    </button>
                                )}
                                {(hasPermissionMissionAdd || hasPermissionMissionUpdate) && (
                                    <button onClick={() => openModal()} className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all shadow-md shadow-slate-200">
                                        <Plus className="w-5 h-5" /> Créer une mission
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
                                    <input type="date" value={filters.dateDebut} onChange={(e) => updateFilter({ dateDebut: e.target.value })} className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50 text-slate-600" title="Date de départ" />
                                </div>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                                    <input type="date" value={filters.dateRetour} onChange={(e) => updateFilter({ dateRetour: e.target.value })} className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50 text-slate-600" title="Date de retour" />
                                </div>

                                {/* Filtre Matricule */}
                                <div className="relative">
                                    <Car className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                                    <input type="text" placeholder="Matricule..." value={filters.matricule} onChange={(e) => updateFilter({ matricule: e.target.value })} className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50" />
                                </div>

                                {/* Filtre Direction */}
                                <div className="relative">
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
                                        ⏳ Missions en cours
                                    </label>
                                    <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 cursor-pointer bg-slate-50 px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors">
                                        <input type="checkbox" checked={filters.plus80km} onChange={(e) => updateFilter({ plus80km: e.target.checked })} className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500" />
                                        🌍 Distance {'>'} 80km
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
                                            {/* CASE A COCHER "TOUT SELECTIONNER" (Visible que si mode "Tous") */}
                                            {filters.limit === 'all' && (
                                                <th className="p-4 w-12 text-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={missions.length > 0 && selectedRowIds.length === missions.length}
                                                        onChange={toggleAllRows}
                                                        className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                                                        title="Tout sélectionner"
                                                    />
                                                </th>
                                            )}
                                            <th className="p-4 w-24">N° Mission</th>
                                            <th className="p-4">Employé</th>
                                            <th className="p-4">Destination</th>
                                            <th className="p-4">Dates</th>
                                            {hasPermissionMissionViewDrahem && <th className="p-4 text-center">Frais</th>}
                                            {hasPermissionMissionViewDrahemLidahom && <th className="p-4 text-center">Frais Alloué</th>}
                                            <th className="p-4 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {isLoading ? (
                                            <tr><td colSpan={filters.limit === 'all' ? 8 : 7} className="p-12 text-center text-slate-400"><Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" /></td></tr>
                                        ) : displayedMissions.length === 0 ? (
                                            <tr>
                                                <td colSpan={filters.limit === 'all' ? 8 : 7} className="p-12 text-center text-slate-500">
                                                    <MapPin className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                                                    <p className="font-medium text-lg">Aucune mission trouvée</p>
                                                    <p className="text-sm text-slate-400">Modifiez vos filtres ou créez une nouvelle mission.</p>
                                                </td>
                                            </tr>
                                        ) : (
                                            displayedMissions.map((m) => (
                                                <tr key={m.id} className="hover:bg-blue-50/30 transition-colors group">
                                                    {/* CASE A COCHER PAR LIGNE (Visible que si mode "Tous") */}
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
                                                        <span className="font-mono text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded-md border border-slate-200">{m.numero}</span>
                                                    </td>
                                                    <td className="p-4">
                                                        <div className="font-bold text-slate-800">{m.employee.nom} {m.employee.prenom}</div>
                                                        <div className="text-xs text-slate-500 font-medium">{m.employee.matricule}</div>
                                                    </td>
                                                    <td className="p-4 font-medium text-slate-700">{m.destination}</td>
                                                    <td className="p-4">
                                                        <div className="flex items-center gap-2 text-sm text-slate-600">
                                                            <span className="font-semibold">{new Date(m.date_debut).toLocaleDateString()}</span>
                                                            <span className="text-slate-300">→</span>
                                                            {m.date_retour ? (
                                                                <span className="font-semibold">{new Date(m.date_retour).toLocaleDateString()}</span>
                                                            ) : (
                                                                <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-xs font-bold animate-pulse">En cours</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    {hasPermissionMissionViewDrahem && <td className="p-4 text-center">
                                                        <div className={`font-bold ${m.plus_80km ? 'text-emerald-600' : 'text-slate-400'}`}>{m.plus_80km ? `${m.drahem} DA` : '-'}</div>
                                                        {m.plus_80km && <div className="text-[10px] uppercase font-bold text-blue-500 tracking-wider mt-0.5">{'>'} 80km</div>}
                                                    </td>}
                                                    {hasPermissionMissionViewDrahemLidahom && <td className="p-4 text-center">
                                                        <div className={`font-bold ${m.plus_80km ? 'text-emerald-600' : 'text-slate-400'}`}>{m.plus_80km ? `${m.drahem_lidahom} DA` : '-'}</div>
                                                    </td>}
                                                    <td className="p-4">
                                                        <div className="flex gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                                                            {hasPermissionMissionPrint && <button onClick={() => handlePrint(m)} className="p-2 bg-slate-50 text-slate-600 rounded-lg hover:bg-slate-200 border border-slate-200" title="Imprimer Ordre de Mission">
                                                                <Printer className="w-4 h-4" />
                                                            </button>}
                                                            {!m.date_retour && hasPermissionMissionUpdate && (
                                                                <button onClick={() => handleTerminer(m)} className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 border border-emerald-100" title="Marquer comme terminée">
                                                                    <CheckSquare className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                            {hasPermissionMissionDelete && (
                                                                <button onClick={() => handleDelete(m.id)} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 border border-red-100" title="Supprimer">
                                                                    <X className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                            {(hasPermissionMissionAdd || hasPermissionMissionUpdate) && <button onClick={() => openModal(m)} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 border border-blue-100" title="Modifier">
                                                                <Edit className="w-4 h-4" />
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
                                            {editingMission ? <Edit className="w-5 h-5 text-blue-600" /> : <Plus className="w-5 h-5 text-blue-600" />}
                                            {editingMission ? "Modifier la mission" : "Nouvelle Mission"}
                                        </h2>
                                        <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 p-2 rounded-full transition-colors"><X className="w-5 h-5" /></button>
                                    </div>

                                    <form onSubmit={handleSave} className="p-6 space-y-5 max-h-[calc(80vh-2rem)] overflow-y-auto">

                                        {/* Ligne 1: Numéro & Employé */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                            <div>
                                                <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5"><Hash className="w-4 h-4 text-slate-400" /> N° Mission</label>
                                                <input type="text" placeholder="Ex: M-2026-001" value={formData.numero} onChange={(e) => setFormData({ ...formData, numero: e.target.value })} className="w-full p-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50" required />
                                            </div>

                                            <div className="relative">
                                                <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">Employé assigné</label>
                                                {formData.employee_id ? (
                                                    <div className="flex justify-between items-center p-2.5 bg-blue-50 border border-blue-200 rounded-xl h-[42px]">
                                                        <span className="text-blue-900 font-bold text-sm">{selectedEmpDisplay}</span>
                                                        {!editingMission && (
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

                                        {/* Ligne 2: Direction */}
                                        <div>
                                            <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5"><Building2 className="w-4 h-4 text-slate-400" /> Direction / Affectation</label>
                                            <select value={formData.direction} onChange={(e) => setFormData({ ...formData, direction: e.target.value })} className="w-full p-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50" required>
                                                <option value="">Sélectionner une direction</option>
                                                {directions.map((direction) => (
                                                    <option key={direction.id} value={direction.name}>{direction.name}</option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Ligne 2-2: Destination */}
                                        <div>
                                            <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5"><MapPin className="w-4 h-4 text-slate-400" /> Destination</label>
                                            <input type="text" placeholder="Lieu de la mission..." value={formData.destination} onChange={(e) => setFormData({ ...formData, destination: e.target.value })} className="w-full p-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50" required />
                                        </div>

                                        {/* Ligne 3: Dates */}
                                        <div className="grid grid-cols-2 gap-5 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                            <div>
                                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Date Début</label>
                                                <input type="date" value={formData.date_debut} onChange={(e) => setFormData({ ...formData, date_debut: e.target.value })} className="w-full p-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none" required />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-semibold text-slate-700 mb-1.5 text-slate-500">Date Retour <span className="font-normal text-xs">(Optionnel)</span></label>
                                                <input type="date" min={formData.date_debut} value={formData.date_retour} onChange={(e) => setFormData({ ...formData, date_retour: e.target.value })} className="w-full p-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                                            </div>
                                        </div>

                                        {/* Ligne 4: Checkbox distance */}
                                        <div className="grid grid-cols-1 gap-5">
                                            <label className="flex items-center gap-3 text-sm font-bold text-slate-700 cursor-pointer bg-slate-50 p-3 rounded-xl border border-slate-200 w-full hover:bg-slate-100 transition-colors">
                                                <input type="checkbox" checked={formData.plus_80km} onChange={(e) => setFormData({ ...formData, plus_80km: e.target.checked })} className="w-5 h-5 text-blue-600 rounded border-slate-300 focus:ring-blue-500" />
                                                Distance supérieure à 80km
                                            </label>
                                        </div>

                                        {/* CONDITION : Champs d'argent visibles SEULEMENT si plus de 80km */}
                                        {formData.plus_80km && (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                                <div className="space-y-4">
                                                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Avance / Montant alloué (DA)</label>
                                                    <input disabled={!hasPermissionMissionUpdate} type="number" value={formData.drahem_lidahom} onChange={(e) => setFormData({ ...formData, drahem_lidahom: e.target.value })} className="w-full p-2.5 border border-slate-200 rounded-xl text-sm font-bold text-emerald-600 focus:ring-2 focus:ring-blue-500 outline-none bg-emerald-50/30" required min="0" />
                                                </div>
                                                <div className="space-y-4">
                                                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Montant des frais (DA)</label>
                                                    <input disabled={!hasPermissionMissionUpdate} type="number" value={formData.drahem} onChange={(e) => setFormData({ ...formData, drahem: e.target.value })} className="w-full p-2.5 border border-slate-200 rounded-xl text-sm font-bold text-emerald-600 focus:ring-2 focus:ring-blue-500 outline-none bg-emerald-50/30" required min="0" />
                                                </div>
                                            </div>
                                        )}

                                        {/* Ligne 6: Véhicule */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                            <div>
                                                <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5"><Car className="w-4 h-4 text-slate-400" /> Véhicule (Matricule)</label>
                                                <input type="text" placeholder="Ex: 12345-115-16" value={formData.vehicule_matricule} onChange={(e) => setFormData({ ...formData, vehicule_matricule: e.target.value })} className="w-full p-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50" />
                                            </div>
                                        </div>

                                        <div className="pt-6 mt-2 border-t border-slate-100 flex justify-end gap-3">
                                            <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors">Annuler</button>
                                            <button type="submit" className="px-6 py-2.5 bg-slate-900 text-white text-sm font-bold rounded-xl hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 flex items-center gap-2">
                                                <Save className="w-4 h-4" /> {editingMission ? "Sauvegarder" : "Créer la mission"}
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
                                            Exporter les missions
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

            {/* BALISE A AJOUTER POUR CACHER L'URL ET LA DATE DU NAVIGATEUR (Impression) */}
            <style dangerouslySetInnerHTML={{
                __html: `
    @media print {
        @page {
            margin: 0; 
        }
        body {
            padding: 1.5cm; 
        }
    }
`}} />

            {/* ZONE D'IMPRESSION (Strictement cachée à l'écran, visible uniquement pour l'imprimante) */}
            {missionToPrint && (
                <div className="hidden print:block bg-white text-black text-sm w-full font-serif" style={{ fontFamily: '"Times New Roman", Times, serif' }}>

                    {/* PAGE 1 : ORDRE DE MISSION (RECTO) */}
                    {(<div className="p-8">
                        {/* En-tête (Logo et République) */}
                        <div className="flex justify-between items-start mb-12">
                            <img src="/DNK.png" alt="Logo" className="w-48 object-contain" />
                            <div className="text-center text-xs font-bold leading-snug border border-black p-2">
                                <p>الجمهورية الجزائرية الديمقراطية الشعبية</p>
                                <p>République Algérienne Démocratique et Populaire</p>
                                <p>Ministère des Transports</p>
                                <p>Groupe Transports Terrestre Voyageurs TRANSTEV spa</p>
                                <p>EPE "EL DJAMIAYA LINAKL OUA EL KHADAMATES" SPA</p>
                                <p>EL DJAMIAYA LINAKL OUA EL KHADAMATES</p>
                            </div>
                        </div>

                        {/* Références */}
                        <div className="flex justify-between mb-8 font-bold">
                            <div className="underline">
                                {missionToPrint.direction || "DIRECTION GENERALE"}<br />
                                Réf/ : N° <span className="inline-block border-b border-black px-4">{missionToPrint.numero}</span>.
                            </div>
                            <div className="uppercase">ALGER LE : {new Date().toLocaleDateString('fr-FR')}</div>
                        </div>

                        {/* Titre */}
                        <div className="text-center mb-12">
                            <h1 className="text-2xl font-bold border-2 border-black inline-block px-6 py-2 uppercase tracking-wide">ORDRE DE MISSION</h1>
                        </div>

                        {/* Informations */}
                        <div className="space-y-6 text-base font-bold pl-8">
                            <p className="uppercase">NOM : {missionToPrint.employee?.nom}</p>
                            <p className="uppercase">PRENOM : {missionToPrint.employee?.prenom}</p>
                            <p className="uppercase">MATRICULE : {missionToPrint.employee?.matricule}</p>
                            <p className="uppercase">FONCTION : {missionToPrint.employee?.poste || ".............................."}</p>
                            <p className="uppercase">ADRESSE ADMINISTRATIVE : {missionToPrint.employee?.zoneEmployes.map((zone: any) => zone.zone.name)[0] || ".............................."}</p>
                            <p className="uppercase">OBJET DE LA MISSION : MISSION DE TRAVAIL</p>
                            <p className="uppercase">DATE DE DEPART : {formatDateForPrint(missionToPrint.date_debut)}</p>
                            <p className="uppercase">DATE DE RETOUR : {formatDateForPrint(missionToPrint.date_retour)}</p>
                            <p className="uppercase">DESTINATION : {missionToPrint.destination}</p>
                            <p className="uppercase">MODE DE TRANSPORT : {missionToPrint.vehicule_matricule ? "VEHICULE DE SERVICE" : ".............................."}</p>
                            <p className="uppercase">IMMATRICULATION : {missionToPrint.vehicule_matricule || ".............................."}</p>
                        </div>
                    </div>)}


                    {/* PAGE 2 : ACCUSE DE RECEPTION (VERSO) */}
                    <div className="break-before-page p-8 pt-16">
                        <div className="flex justify-between mb-6 font-semibold">
                            <p>Départ le : {formatDateForPrint(missionToPrint.date_debut)} à : ........</p>
                            <p>Retour le : {formatDateForPrint(missionToPrint.date_retour)} à : ........</p>
                        </div>

                        <div className="space-y-4 font-semibold mb-8">
                            <p>Montant d'avance sur frais de mission : ..............................................</p>
                            <p>Restauration: -Déjeuner: ........ Repas - Dîner: ........ repas - Découcher: ........ Nuitée</p>
                            <p>Total frais : ..............................................</p>
                        </div>

                        <div className="text-right italic mb-16 underline pr-8">
                            Signature de l'intéressé(e)
                        </div>

                        <div className="font-bold underline mb-4">Accuse réception</div>

                        {/* Boîtes d'accusé */}
                        <div className="space-y-4">
                            {[1, 2, 3].map((box) => (
                                <div key={box} className="border border-black p-4 h-40">
                                    <p className="underline mb-2">Date de la réception :</p>
                                    <p className="underline">Cachet et signature de l'entreprise</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* PAGE 3 : ETAT D'AVANCE (Affichée UNIQUEMENT si > 80km) */}
                    {missionToPrint.plus_80km && (
                        <div className="break-before-page p-8">
                            {/* En-tête (Logo et République) */}
                            <div className="flex justify-between items-start mb-12">
                                <img src="/DNK.png" alt="Logo" className="w-48 object-contain" />
                                <div className="text-center text-[10px] font-bold leading-snug border border-black p-2">
                                    <p>الجمهورية الجزائرية الديمقراطية الشعبية</p>
                                    <p>République Algérienne Démocratique et Populaire</p>
                                    <p>Ministère des Transports</p>
                                    <p>Groupe Transports Terrestre Voyageurs TRANSTEV spa</p>
                                    <p>EPE "EL DJAMIAYA LINAKL OUA EL KHADAMATES" SPA</p>
                                    <p>EL DJAMIAYA LINAKL OUA EL KHADAMATES</p>
                                </div>
                            </div>

                            <div className="text-right font-bold mb-8">
                                ALGER LE : {new Date().toLocaleDateString('fr-FR')}
                            </div>

                            <div className="text-center mb-12">
                                <h2 className="text-xl font-bold border border-black inline-block px-4 py-2 uppercase tracking-wide">ETAT D'AVANCE SUR FRAIS DE MISSION</h2>
                            </div>

                            <div className="space-y-6 text-sm font-bold pl-8">
                                <p className="uppercase">SERVICE EMETTEUR : {missionToPrint.direction}</p>
                                <p className="uppercase">BENIFICIERE : {missionToPrint.employee?.nom} {missionToPrint.employee?.prenom}</p>
                                <p className="uppercase">QUALITE : {missionToPrint.employee?.poste || ".............................."}</p>
                                <p className="uppercase">AFFECTATION : {missionToPrint.employee?.zoneEmployes.map((zone: any) => zone.zone.name)[0] || ".............................."}</p>

                                <div className="flex justify-between w-3/4">
                                    <p className="uppercase">ORDRE DE MISSION N° : {missionToPrint.numero} </p>
                                    <p className="uppercase">DATE : {new Date().toLocaleDateString('fr-FR')}</p>
                                </div>

                                <p className="uppercase">OBJET : MISSION DE TRAVAIL</p>
                                <p className="uppercase">DATE DE DEPART : {formatDateForPrint(missionToPrint.date_debut)}</p>
                                <p className="uppercase">DATE DE RETOUR : {formatDateForPrint(missionToPrint.date_retour)}</p>
                                <p className="uppercase">DESTINATION : {missionToPrint.destination}</p>

                                <p className="uppercase pt-4">MONTANT DES FRAIS DE MISSION : {missionToPrint.drahem} DA</p>
                                <p className="uppercase">AVANCE SUR FRAIS DE MISSION ACCORDE : {missionToPrint.drahem_lidahom} DA</p>

                                <p className="uppercase pt-4 pb-12">RESTE A PAYER : {missionToPrint.drahem - missionToPrint.drahem_lidahom} DA </p>
                            </div>

                            {/* Signatures Pied de page */}
                            <div className="flex justify-between items-start font-bold text-sm underline px-8">
                                <div>L'INTERESSE (E)</div>
                                <div>CHEF DEPT DU PERSONNEL</div>
                                <div className="text-center">CHEF DEPARTEMENT<br />COMPTABILITE</div>
                            </div>
                        </div>
                    )}

                </div>
            )}
        </>
    );
}
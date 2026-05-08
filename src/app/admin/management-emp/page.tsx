"use client";

import { useState, useEffect } from "react";
import { Search, ShieldCheck, Users, Building, CheckCircle2, User, Loader2, Save } from "lucide-react";

export default function ManagementPage() {
    const [data, setData] = useState({ users: [], departments: [], employees: [] });
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

    // États pour les cases cochées
    const [selectedDepts, setSelectedDepts] = useState<string[]>([]);
    const [selectedEmps, setSelectedEmps] = useState<string[]>([]);

    // États pour les filtres de recherche
    const [searchUser, setSearchUser] = useState("");
    const [searchDept, setSearchDept] = useState("");
    const [searchEmp, setSearchEmp] = useState("");

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error", text: string } | null>(null);

    // Charger les données au montage
    useEffect(() => {
        fetch("/api/management-user")
            .then((res) => res.json())
            .then((json) => {
                setData(json);
                setIsLoading(false);
            })
            .catch(() => {
                setIsLoading(false);
                alert("Erreur de connexion à l'API.");
            });
    }, []);

    // Mettre à jour les cases cochées quand on sélectionne un nouvel utilisateur
    useEffect(() => {
        if (selectedUserId) {
            const user: any = data.users.find((u: any) => u.id === selectedUserId);
            if (user) {
                // Utilisation des clés camelCase renvoyées par Prisma
                setSelectedDepts(user.userManagedDepartmenets?.map((d: any) => d.departmenet_id) || []);
                setSelectedEmps(user.userManagedEmployees?.map((e: any) => e.employee_id) || []);
            }
        } else {
            setSelectedDepts([]);
            setSelectedEmps([]);
        }
        setSaveMessage(null);
    }, [selectedUserId, data.users]);

    // Gérer le changement des cases (toggle)
    const toggleSelection = (id: string, type: "dept" | "emp") => {
        if (type === "dept") {
            setSelectedDepts(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
        } else {
            setSelectedEmps(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
        }
    };

    // Sauvegarder les modifications
    const handleSave = async () => {
        if (!selectedUserId) return;
        setIsSaving(true);
        setSaveMessage(null);
        try {
            const res = await fetch("/api/management-user", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId: selectedUserId,
                    departmentIds: selectedDepts,
                    employeeIds: selectedEmps
                }),
            });
            if (res.ok) {
                setSaveMessage({ type: "success", text: "Permissions mises à jour avec succès !" });
                setTimeout(() => setSaveMessage(null), 3000);
            } else {
                throw new Error("Erreur API");
            }
        } catch (error) {
            setSaveMessage({ type: "error", text: "Erreur lors de la sauvegarde." });
        } finally {
            setIsSaving(false);
        }
    };

    // Filtrage
    const filteredUsers = data.users.filter((u: any) =>
        `${u.firstname} ${u.lastname} ${u.email}`.toLowerCase().includes(searchUser.toLowerCase())
    );

    const filteredDepts = data.departments.filter((d: any) =>
        d.name.toLowerCase().includes(searchDept.toLowerCase())
    );

    // Afficher les employés SEULEMENT si recherche >= 2 caractères OU si déjà sélectionné
    const filteredEmps = data.employees.filter((e: any) => {
        const isSelected = selectedEmps.includes(e.id);
        const isSearchValid = searchEmp.length >= 2;
        const matchesSearch = isSearchValid && `${e.nom} ${e.prenom} ${e.matricule}`.toLowerCase().includes(searchEmp.toLowerCase());

        return isSelected || matchesSearch;
    });

    if (isLoading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
                <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
                <p className="text-slate-500 font-medium">Chargement de l'interface...</p>
            </div>
        );
    }

    const selectedUser: any = data.users.find((u: any) => u.id === selectedUserId);

    return (
        <div className="max-w-7xl mx-auto p-4 sm:p-8 min-h-screen bg-slate-50 font-sans">

            {/* Header de la page */}
            <div className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
                        <ShieldCheck className="w-8 h-8 text-blue-600" />
                        Permissions Managers
                    </h1>
                    <p className="text-slate-500 mt-2 text-sm">
                        Sélectionnez un utilisateur pour lui attribuer des droits sur des départements ou des employés.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                {/* --- COLONNE GAUCHE : UTILISATEURS --- */}
                <div className="lg:col-span-4 flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden h-[800px]">
                    <div className="p-5 border-b border-slate-100 bg-white z-10">
                        <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                            <Users className="w-5 h-5 text-slate-400" />
                            Managers
                        </h2>
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Rechercher un manager..."
                                value={searchUser}
                                onChange={(e) => setSearchUser(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-3 space-y-1 custom-scrollbar">
                        {filteredUsers.length === 0 ? (
                            <p className="text-center text-slate-400 text-sm mt-4">Aucun résultat</p>
                        ) : (
                            filteredUsers.map((user: any) => {
                                const isSelected = selectedUserId === user.id;
                                return (
                                    <button
                                        key={user.id}
                                        onClick={() => setSelectedUserId(user.id)}
                                        className={`w-full flex items-center text-left p-3 rounded-xl transition-all duration-200 ${isSelected
                                                ? "bg-blue-50 border-blue-200 shadow-sm border"
                                                : "hover:bg-slate-50 border border-transparent"
                                            }`}
                                    >
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center mr-3 font-bold text-sm ${isSelected ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"}`}>
                                            {user.firstname?.charAt(0) || <User className="w-4 h-4" />}
                                        </div>
                                        <div className="flex-1 overflow-hidden">
                                            <div className={`font-semibold truncate text-sm ${isSelected ? "text-blue-900" : "text-slate-700"}`}>
                                                {user.firstname || "Sans"} {user.lastname || "Nom"}
                                            </div>
                                            <div className={`text-xs truncate ${isSelected ? "text-blue-600" : "text-slate-400"}`}>
                                                {user.email}
                                            </div>
                                        </div>
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* --- COLONNE DROITE : PERMISSIONS --- */}
                <div className="lg:col-span-8 flex flex-col h-[800px]">
                    {!selectedUserId ? (
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex-1 flex flex-col items-center justify-center text-slate-400 p-10">
                            <ShieldCheck className="w-20 h-20 text-slate-200 mb-6" />
                            <h3 className="text-xl font-medium text-slate-500">Aucun manager sélectionné</h3>
                            <p className="text-sm mt-2">Veuillez choisir un profil dans la liste de gauche pour configurer ses accès.</p>
                        </div>
                    ) : (
                        <div className="flex flex-col h-full gap-6">

                            {/* Header de l'utilisateur sélectionné & Bouton Save */}
                            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-800">
                                        Permissions pour {selectedUser?.firstname} {selectedUser?.lastname}
                                    </h3>
                                    <p className="text-sm text-slate-500">Cochez les éléments qu'il est autorisé à gérer.</p>
                                </div>
                                <div className="flex items-center gap-3 w-full sm:w-auto">
                                    {saveMessage && (
                                        <span className={`text-sm font-medium flex items-center gap-1 ${saveMessage.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                                            <CheckCircle2 className="w-4 h-4" />
                                            {saveMessage.text}
                                        </span>
                                    )}
                                    <button
                                        onClick={handleSave}
                                        disabled={isSaving}
                                        className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 text-white font-medium py-2.5 px-6 rounded-xl shadow-sm transition-all disabled:opacity-70 flex items-center justify-center gap-2"
                                    >
                                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                        {isSaving ? "Enregistrement..." : "Enregistrer"}
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1 min-h-0">

                                {/* --- PANNEAU DÉPARTEMENTS --- */}
                                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col h-full overflow-hidden">
                                    <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                                        <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2 uppercase tracking-wider">
                                            <Building className="w-4 h-4 text-slate-500" />
                                            Départements ({selectedDepts.length})
                                        </h3>
                                        <div className="relative">
                                            <Search className="absolute left-3 top-2 h-4 w-4 text-slate-400" />
                                            <input
                                                type="text"
                                                placeholder="Filtrer les départements..."
                                                value={searchDept}
                                                onChange={(e) => setSearchDept(e.target.value)}
                                                className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-3 space-y-1 custom-scrollbar">
                                        {filteredDepts.map((dept: any) => {
                                            const isChecked = selectedDepts.includes(dept.id);
                                            return (
                                                <label key={dept.id} className={`flex items-center p-3 border rounded-xl cursor-pointer transition-all ${isChecked ? 'bg-blue-50/50 border-blue-200' : 'hover:bg-slate-50 border-slate-100'}`}>
                                                    <input
                                                        type="checkbox"
                                                        checked={isChecked}
                                                        onChange={() => toggleSelection(dept.id, "dept")}
                                                        className="w-5 h-5 text-blue-600 rounded border-slate-300 focus:ring-blue-500 accent-blue-600 cursor-pointer"
                                                    />
                                                    <span className={`ml-3 text-sm font-medium ${isChecked ? 'text-blue-900' : 'text-slate-700'}`}>
                                                        {dept.name}
                                                    </span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* --- PANNEAU EMPLOYÉS --- */}
                                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col h-full overflow-hidden">
                                    <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                                        <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2 uppercase tracking-wider">
                                            <Users className="w-4 h-4 text-slate-500" />
                                            Employés isolés ({selectedEmps.length})
                                        </h3>
                                        <div className="relative">
                                            <Search className="absolute left-3 top-2 h-4 w-4 text-slate-400" />
                                            <input
                                                type="text"
                                                placeholder="Filtrer les employés (Nom, Matricule)..."
                                                value={searchEmp}
                                                onChange={(e) => setSearchEmp(e.target.value)}
                                                className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-3 space-y-1 custom-scrollbar">

                                        {searchEmp.length < 2 && selectedEmps.length === 0 && (
                                            <div className="text-center text-slate-400 text-sm mt-10">
                                                Tapez au moins 2 caractères pour chercher un employé...
                                            </div>
                                        )}

                                        {searchEmp.length >= 2 && filteredEmps.length === 0 && (
                                            <div className="text-center text-slate-400 text-sm mt-10">
                                                Aucun employé trouvé pour "{searchEmp}"
                                            </div>
                                        )}

                                        {filteredEmps.map((emp: any) => {
                                            const isChecked = selectedEmps.includes(emp.id);
                                            return (
                                                <label key={emp.id} className={`flex items-center p-3 border rounded-xl cursor-pointer transition-all ${isChecked ? 'bg-blue-50/50 border-blue-200' : 'hover:bg-slate-50 border-slate-100'}`}>
                                                    <input
                                                        type="checkbox"
                                                        checked={isChecked}
                                                        onChange={() => toggleSelection(emp.id, "emp")}
                                                        className="w-5 h-5 text-blue-600 rounded border-slate-300 focus:ring-blue-500 accent-blue-600 cursor-pointer"
                                                    />
                                                    <div className="ml-3 flex-1">
                                                        <div className={`text-sm font-medium ${isChecked ? 'text-blue-900' : 'text-slate-700'}`}>
                                                            {emp.nom} {emp.prenom}
                                                        </div>
                                                        <div className="text-xs text-slate-400 mt-0.5">
                                                            Matricule: {emp.matricule}
                                                        </div>
                                                    </div>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>

                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Styles pour customiser la scrollbar */}
            <style dangerouslySetInnerHTML={{
                __html: `
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background-color: #cbd5e1;
                    border-radius: 20px;
                }
            `}} />
        </div>
    );
}
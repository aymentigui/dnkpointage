'use client'

import { useState, useEffect, useMemo } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { AppShell } from '@/components/layout/AppShell'
import { PlanningTable } from '@/components/planning/PlanningTable'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
    ArrowLeft, Calendar, Filter, Download,
    Search, X, ChevronDown, ChevronUp,
    Trash2,
} from 'lucide-react'
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { employeesApi, planningApi } from '@/lib/api'
import { toast } from 'react-hot-toast'
import { useSession } from '@/hooks/use-session'
import * as XLSX from 'xlsx'

// ─────────────────────────────────────────────────────────────
// Helpers de filtrage
// ─────────────────────────────────────────────────────────────

function parseTokens(text: string): string[] {
    return text
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean)
}

function matchesAny(value: string | null | undefined, tokens: string[]): boolean {
    if (!tokens.length) return true
    const v = (value ?? '').toLowerCase()
    return tokens.some((t) => v.includes(t))
}

function matchesExact(value: string | null | undefined, tokens: string[]): boolean {
    if (!tokens.length) return true
    const v = (value ?? '').toLowerCase()
    return tokens.some((t) => v === t)
}

// ─────────────────────────────────────────────────────────────
// PlanningPage
// ─────────────────────────────────────────────────────────────

export default function PlanningPage() {
    const params = useParams()
    const router = useRouter()
    const searchParams = useSearchParams()
    const workspaceId = params.id as string
    const selectedMatricule = searchParams.get('matricule')

    // ── Data ──────────────────────────────────────────────────
    const [loading, setLoading] = useState(true)
    const [allEmployees, setAllEmployees] = useState<any[]>([])
    const [planningData, setPlanningData] = useState<Record<string, any>>({})
    const [dates, setDates] = useState<string[]>([])

    // États pour les dates
    const [tempDateDebut, setTempDateDebut] = useState(() => {
        const now = new Date()
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    })
    const [tempDateFin, setTempDateFin] = useState(() => {
        const now = new Date()
        const last = new Date(now.getFullYear(), now.getMonth() + 1, 0)
        return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`
    })

    const [dateDebut, setDateDebut] = useState(tempDateDebut)
    const [dateFin, setDateFin] = useState(tempDateFin)
    const [selectedMat, setSelectedMat] = useState<string | null>(selectedMatricule)

    // État global pour les employés sélectionnés
    const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(new Set())

    // ── Filtres ───────────────────────────────────────────────
    const [searchText, setSearchText] = useState('')
    const [posteSearch, setPosteSearch] = useState('')
    const [departmentSearch, setDepartmentSearch] = useState('')
    const [zoneSearch, setZoneSearch] = useState('')
    const [zoneExact, setZoneExact] = useState(false)
    const [presenceFilter, setPresenceFilter] = useState<'all' | 'has' | 'none'>('all')
    const [cycleFilter, setCycleFilter] = useState<'all' | 'with_cycle' | 'without_cycle'>('all')
    const [activeFilter, setActiveFilter] = useState('true')
    const [filtersExpanded, setFiltersExpanded] = useState(true)

    // permission
    const { session } = useSession();

    const hasPermissionExportPointage = useMemo(() => (
        session?.user?.is_admin ||
        session?.user?.permissions.some((p: string[]) => p.includes("export_pointage"))
    ), [session]);

    // ── Load ──────────────────────────────────────────────────
    useEffect(() => {
        if (dateDebut && dateFin) {
            loadData()
        }
    }, [workspaceId, dateDebut, dateFin, activeFilter])

    const loadData = async () => {
        try {
            setLoading(true)
            const empRes = await employeesApi.getAll({ workspace_id: workspaceId, active: activeFilter })
            const employeesData = empRes.data.data || []
            setAllEmployees(employeesData)

            if (employeesData.length === 0) {
                setPlanningData({})
                setDates([])
                return
            }

            const qParams: any = {}
            if (dateDebut) qParams.debut = dateDebut
            if (dateFin) qParams.fin = dateFin

            const planningRes = await planningApi.getAllForWorkspace(workspaceId, qParams)
            const data = planningRes.data || {}
            setPlanningData(data)

            const allDates = new Set<string>()
            Object.values(data).forEach((empData: any) => {
                empData.plannings?.forEach((p: any) => {
                    allDates.add(p.date.split('T')[0])
                })
            })
            setDates(Array.from(allDates).sort())

        } catch {
            toast.error('Erreur lors du chargement')
        } finally {
            setLoading(false)
        }
    }

    const handlePeriodSearch = () => {
        setDateDebut(tempDateDebut)
        setDateFin(tempDateFin)
    }

    const handleResetDates = () => {
        const now = new Date()
        const firstDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
        const lastDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()).padStart(2, '0')}`

        setTempDateDebut(firstDay)
        setTempDateFin(lastDay)
        setDateDebut(firstDay)
        setDateFin(lastDay)
    }

    // ── Filtrage ──────────────────────────────────────────────
    const filteredEmployees = useMemo(() => {
        const searchTokens = parseTokens(searchText)
        const posteTokens = parseTokens(posteSearch)
        const zoneTokens = parseTokens(zoneSearch)
        const deptTokens = parseTokens(departmentSearch)

        return allEmployees.filter((emp) => {
            if (searchTokens.length > 0) {
                const matchesMat = matchesAny(emp.matricule, searchTokens)
                const matchesNom = matchesAny(emp.nom, searchTokens)
                const matchesPrenom = matchesAny(emp.prenom, searchTokens)
                if (!matchesMat && !matchesNom && !matchesPrenom) return false
            }

            if (posteTokens.length > 0) {
                if (!matchesAny(emp.poste, posteTokens)) return false
            }

            if (deptTokens.length > 0) {
                const depName = emp.departmenet?.name || ''
                if (!matchesAny(depName, deptTokens)) return false
            }

            if (zoneTokens.length > 0) {
                if (zoneExact) {
                    const hasExact = emp.zoneEmployes?.some((ze: any) => matchesExact(ze.zone?.name, zoneTokens))
                    if (!hasExact) return false
                } else {
                    const allZonesStr = emp.zoneEmployes?.map((ze: any) => ze.zone?.name).join(' ') || ''
                    if (!matchesAny(allZonesStr, zoneTokens)) return false
                }
            }

            if (presenceFilter !== 'all') {
                const stats = planningData[emp.matricule]?.stats
                const nbPresents = stats?.presents ?? 0
                if (presenceFilter === 'has' && nbPresents === 0) return false
                if (presenceFilter === 'none' && nbPresents > 0) return false
            }

            if (cycleFilter !== 'all') {
                if (cycleFilter === 'with_cycle' && (!emp.cycles || emp.cycles.type === "unknown")) return false
                if (cycleFilter === 'without_cycle' && (emp.cycles && emp.cycles.type !== "unknown")) return false
            }

            return true
        })
    }, [allEmployees, planningData, searchText, posteSearch, departmentSearch, zoneSearch, zoneExact, presenceFilter, cycleFilter])

    const clearFilters = () => {
        setSearchText('')
        setPosteSearch('')
        setDepartmentSearch('')
        setZoneSearch('')
        setZoneExact(false)
        setPresenceFilter('all')
        setCycleFilter('all')
        setActiveFilter('true')
    }

    const hasActiveFilters =
        searchText || posteSearch || departmentSearch || zoneSearch || presenceFilter !== 'all' || cycleFilter !== 'all' || activeFilter !== 'true'

    // ── Export Local (Frontend) ────────────────────────────────────────────────
    const handleExportLocal = () => {
        try {
            const employeesToExport = selectedEmployees.size > 0
                ? filteredEmployees.filter(emp => selectedEmployees.has(emp.matricule))
                : filteredEmployees;

            if (employeesToExport.length === 0) {
                toast.error("Aucune donnée à exporter");
                return;
            }

            const excelData = employeesToExport.map(emp => {
                const rowData: any = {
                    "Matricule": emp.matricule,
                    "Nom": emp.nom,
                    "Prénom": emp.prenom,
                    "Fonction": emp.poste || '',
                    "Département": emp.departmenet?.name || '',
                    "Zone(s)": emp.zoneEmployes?.map((ze: any) => ze.zone?.name).join(', ') || '',
                };

                const stats = planningData[emp.matricule]?.stats || { presents: 0, absences_nettes: 0, absences_annotees: 0, repos: 0, jours_feries: 0 };

                rowData["Présences (P)"] = stats.presents;
                rowData["Absences Nettes (A)"] = stats.absences_nettes;
                rowData["Absences Just. (Globale)"] = stats.absences_annotees;

                // Compteurs d'annotations détaillés
                const annotCounts = { M: 0, J: 0, Md: 0, Rc: 0, C: 0, Ce: 0 };
                const dailyCodes: Record<string, string> = {};
                let hasPositiveDay = stats.presents > 0;

                dates.forEach(date => {
                    const empData = planningData[emp.matricule];
                    let code = '';

                    if (empData) {
                        // Chercher l'annotation en priorité (identique à l'affichage du tableau)
                        const annot = empData.annotations?.find((a: any) => (a.date?.split?.('T')?.[0] ?? a.date) === date);
                        if (annot) {
                            code = annot.code;
                        } else {
                            const plan = empData.plannings?.find((p: any) => (p.date?.split?.('T')?.[0] ?? p.date) === date);
                            code = plan?.statut || '';
                        }
                    }

                    dailyCodes[date] = code;

                    // Incrémenter les colonnes de détails des annotations
                    const codeKey = code as keyof typeof annotCounts;
                    if (annotCounts[codeKey] !== undefined) {
                        annotCounts[codeKey]++;
                    }

                    // Évaluer le jour positif pour la PC Paie
                    if (!hasPositiveDay && code) {
                        const upperCode = code.toUpperCase();
                        if (['P', 'M', 'CE', 'C', 'RC'].includes(upperCode) ||
                            upperCode.includes('MISSION') || upperCode.includes('EXCEP') ||
                            upperCode.includes('CONGE') || upperCode.includes('RECUP')
                        ) {
                            hasPositiveDay = true;
                        }
                    }
                });

                // Assigner les compteurs spécifiques à la ligne
                rowData["Mission (M)"] = annotCounts.M;
                rowData["Justifié (J)"] = annotCounts.J;
                rowData["Maladie (Md)"] = annotCounts.Md;
                rowData["Récupération (Rc)"] = annotCounts.Rc;
                rowData["Congé (C)"] = annotCounts.C;
                rowData["Congé Excep. (Ce)"] = annotCounts.Ce;

                rowData["Repos (R)"] = stats.repos;
                rowData["Jours Fériés (JF)"] = stats.jours_feries;

                // Règle de l'absence PC Paie :
                // On additionne les Absences Nettes (A) + Maladies (Md) + Absences Justifiées non payées (J)
                const absencesNonPayees = stats.absences_nettes + annotCounts.Md + annotCounts.J;

                rowData["Absence PC Paie"] = hasPositiveDay ? Math.min(absencesNonPayees, 30) : Math.min(dates.length, 30);

                // Injecter les dates et leur code d'affichage final
                dates.forEach(date => {
                    rowData[date] = dailyCodes[date];
                });

                return rowData;
            });

            const worksheet = XLSX.utils.json_to_sheet(excelData);
            const workbook = XLSX.utils.book_new();

            // Ajustement des largeurs de colonnes
            const wscols = [
                { wch: 15 }, // Matricule
                { wch: 20 }, // Nom
                { wch: 20 }, // Prenom
                { wch: 20 }, // Fonction
                { wch: 20 }, // Dept
                { wch: 25 }, // Zone
                { wch: 15 }, // Presences
                { wch: 20 }, // Absences
                { wch: 25 }, // Absences Just Globale
                { wch: 15 }, // M
                { wch: 15 }, // J
                { wch: 15 }, // Md
                { wch: 20 }, // Rc
                { wch: 15 }, // C
                { wch: 20 }, // Ce
                { wch: 10 }, // Repos
                { wch: 15 }, // JF
                { wch: 20 }, // Absence PC Paie
                ...dates.map(() => ({ wch: 10 })) // Toutes les dates
            ];
            worksheet['!cols'] = wscols;

            XLSX.utils.book_append_sheet(workbook, worksheet, "Planning");

            const fileName = `planning_${selectedEmployees.size > 0 ? 'selection_' : ''}${dateDebut}_au_${dateFin}.xlsx`;
            XLSX.writeFile(workbook, fileName);
            toast.success(`Export réussi — ${employeesToExport.length} employé(s)`);

        } catch (error) {
            console.error(error);
            toast.error("Erreur lors de la génération de l'Excel");
        }
    }

    return (
        <AppShell workspaceName="Planning" onDashboardClick={() => router.push(`/workspaces/${workspaceId}`)}>
            <div className="space-y-4">

                {/* ── Header ── */}
                <div className="flex items-center justify-between">
                    <Button variant="ghost" onClick={() => router.back()} className="w-fit">
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Retour
                    </Button>
                    {hasPermissionExportPointage && (
                        <Button variant="outline" onClick={handleExportLocal}>
                            <Download className="h-4 w-4 mr-2" />
                            {selectedEmployees.size > 0
                                ? `Exporter la sélection (${selectedEmployees.size})`
                                : 'Exporter tout'}
                        </Button>
                    )}
                </div>

                <h1 className="text-3xl font-bold flex items-center gap-2">
                    <Calendar className="h-8 w-8" />
                    Planning de présence
                </h1>

                {/* ── Filtre période avec bouton de recherche ── */}
                <div className="flex flex-wrap items-center gap-3 bg-card p-4 rounded-xl border">
                    <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Du</span>
                        <Input
                            type="date"
                            value={tempDateDebut}
                            onChange={(e) => setTempDateDebut(e.target.value)}
                            className="w-auto h-8 text-sm"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">au</span>
                        <Input
                            type="date"
                            value={tempDateFin}
                            onChange={(e) => setTempDateFin(e.target.value)}
                            className="w-auto h-8 text-sm"
                        />
                    </div>

                    <Button size="sm" onClick={handlePeriodSearch} className="h-8 gap-1">
                        <Search className="h-3.5 w-3.5" />
                        Rechercher
                    </Button>

                    {(tempDateDebut !== dateDebut || tempDateFin !== dateFin ||
                        (tempDateDebut && dateDebut && tempDateDebut !== dateDebut) ||
                        (tempDateFin && dateFin && tempDateFin !== dateFin)) && (
                            <Button variant="ghost" size="sm" onClick={handleResetDates} className="h-8">
                                <X className="h-3.5 w-3.5 mr-1" />
                                Réinitialiser
                            </Button>
                        )}
                </div>

                {/* ── Filtres employés ── */}
                <div className="bg-card border rounded-xl overflow-hidden">
                    <button
                        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/30 transition-colors"
                        onClick={() => setFiltersExpanded((v) => !v)}
                    >
                        <div className="flex items-center gap-2">
                            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>Filtres employés</span>
                            {hasActiveFilters && (
                                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                                    {[searchText, posteSearch, departmentSearch, zoneSearch, presenceFilter !== 'all' ? '1' : '', cycleFilter !== 'all' ? '1' : '', activeFilter !== 'true' ? '1' : ''].filter(Boolean).length}
                                </span>
                            )}
                        </div>
                        {filtersExpanded
                            ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                            : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                        }
                    </button>

                    {filtersExpanded && (
                        <div className="px-4 pb-4 pt-1 space-y-4 border-t">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3 mt-3">

                                <div className="space-y-1.5 xl:col-span-2">
                                    <Label className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">Matricule / Nom / Prénom</Label>
                                    <div className="relative">
                                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                        <Input placeholder="matricule, nom, prenom…" value={searchText} onChange={(e) => setSearchText(e.target.value)} className="pl-8 h-8 text-sm" />
                                    </div>
                                    <p className="text-[10px] text-muted-foreground">Séparer par virgule pour OR</p>
                                </div>

                                <div className="space-y-1.5">
                                    <Label className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">Fonction</Label>
                                    <div className="relative">
                                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                        <Input placeholder="chauffeur, agent…" value={posteSearch} onChange={(e) => setPosteSearch(e.target.value)} className="pl-8 h-8 text-sm" />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <Label className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">Département</Label>
                                    <div className="relative">
                                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                        <Input placeholder="IT, RH…" value={departmentSearch} onChange={(e) => setDepartmentSearch(e.target.value)} className="pl-8 h-8 text-sm" />
                                    </div>
                                </div>

                                <div className="space-y-1.5 xl:col-span-1">
                                    <Label className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">Zone(s)</Label>
                                    <div className="relative">
                                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                        <Input placeholder="Parc 08, siège…" value={zoneSearch} onChange={(e) => setZoneSearch(e.target.value)} className="pl-8 h-8 text-sm" />
                                    </div>
                                    <div className="flex items-center gap-1.5 mt-1">
                                        <Checkbox id="zone-exact" checked={zoneExact} onCheckedChange={(v) => setZoneExact(!!v)} className="h-3 w-3" />
                                        <label htmlFor="zone-exact" className="text-[10px] text-muted-foreground cursor-pointer select-none">Correspondance exacte</label>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <Label className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">Statut</Label>
                                    <Select value={activeFilter} onValueChange={setActiveFilter}>
                                        <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Tous</SelectItem>
                                            <SelectItem value="true">🟢 Actifs</SelectItem>
                                            <SelectItem value="false">🔴 Inactifs</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-1.5">
                                    <Label className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">Présences</Label>
                                    <Select value={presenceFilter} onValueChange={(v) => setPresenceFilter(v as any)}>
                                        <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Tous les employés</SelectItem>
                                            <SelectItem value="has">Avec au moins 1 présence</SelectItem>
                                            <SelectItem value="none">Sans aucune présence</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-1.5">
                                    <Label className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">Cycle de travail</Label>
                                    <Select value={cycleFilter} onValueChange={(v) => setCycleFilter(v as any)}>
                                        <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Tous</SelectItem>
                                            <SelectItem value="with_cycle">Avec cycle</SelectItem>
                                            <SelectItem value="without_cycle">Sans cycle</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="flex items-center justify-between pt-1 border-t mt-4">
                                <p className="text-xs text-muted-foreground">
                                    <span className="font-semibold text-foreground">{filteredEmployees.length}</span> employé(s) affiché(s) sur <span className="font-semibold text-foreground">{allEmployees.length}</span>
                                </p>
                                {hasActiveFilters && (
                                    <Button variant="outline" size="sm" onClick={clearFilters} className="h-7 border-red-400 text-xs gap-1.5 text-red-500 hover:text-red-600 hover:bg-red-50 transition-colors">
                                        <Trash2 className="h-3 w-3" />
                                        Effacer les filtres
                                    </Button>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Table ── */}
                {loading ? (
                    <div className="w-full rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                        <div className="border-b border-slate-200 p-3 flex gap-2">
                            <div className="h-5 w-44 rounded-md bg-slate-100 animate-pulse" />
                            <div className="h-5 w-14 rounded-md bg-slate-100 animate-pulse" />
                            <div className="h-5 w-32 rounded-md bg-slate-100 animate-pulse" />
                        </div>
                        <div className="divide-y divide-slate-50">
                            {Array.from({ length: 10 }, (_, i) => (
                                <div key={i} className="flex items-center gap-2 px-3 py-2" style={{ opacity: 1 - i * 0.07 }}>
                                    <div className="w-44 shrink-0">
                                        <div className="h-3 w-24 rounded bg-slate-100 animate-pulse mb-1.5" />
                                        <div className="h-2.5 w-32 rounded bg-slate-50 animate-pulse" />
                                    </div>
                                    <div className="w-14 shrink-0 flex justify-center">
                                        <div className="h-5 w-10 rounded-full bg-slate-100 animate-pulse" />
                                    </div>
                                    <div className="w-32 shrink-0 flex gap-1 justify-center">
                                        {Array.from({ length: 4 }, (_, j) => (
                                            <div key={j} className="h-4 w-7 rounded bg-slate-100 animate-pulse" />
                                        ))}
                                    </div>
                                    <div className="flex gap-1 flex-1">
                                        {Array.from({ length: 28 }, (_, j) => (
                                            <div key={j} className="h-7 w-8 shrink-0 rounded-sm animate-pulse"
                                                style={{ backgroundColor: j % 7 === 5 || j % 7 === 6 ? '#f1f5f9' : '#f8fafc', animationDelay: `${(i * 4 + j) * 12}ms` }} />
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <PlanningTable
                        employees={filteredEmployees}
                        planningData={planningData}
                        onPlanningDataChange={setPlanningData}
                        dates={dates}
                        selectedMat={selectedMat}
                        onSelectMat={setSelectedMat}
                        workspaceId={workspaceId}
                        onUpdate={loadData}
                        selectedEmployees={selectedEmployees}
                        onSelectEmployees={setSelectedEmployees}
                    />
                )}
            </div>
        </AppShell>
    )
}
// app/api/export/route.ts
//
// Paramètres de filtrage acceptés :
//   workspaceId    : string
//   debut          : YYYY-MM-DD
//   fin            : YYYY-MM-DD
//   search         : "mat1,nom ,prenom"   → matricule OU nom OU prénom contient
//   poste          : "tech,agent"         → poste contient (OR)
//   zone           : "zone1,zone2"        → zone contient OU exact selon zoneExact
//   zoneExact      : "true"               → zone = exact match
//   presenceFilter : "all" | "has" | "none"
//   cycleFilter    : "all" | "with_cycle" | "without_cycle"

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import * as XLSX from "xlsx";
// import { verifySession } from "@/actions/permissions"; // À décommenter si besoin

const SEUIL_BADGEUSE_UNIQUE_MIN = 15;
const SEUIL_SORTIE_MATIN_MAX_H = 8;
const SEUIL_ENTREE_NUIT_MIN_H = 14;
const SEUIL_SORTIE_NUIT_MAX_H = 10;

// 🔥 AJOUT DE "A" ET "P" POUR FORCER LES ABSENCES ET PRÉSENCES VIA ANNOTATION
const ANNOT_CODES = new Set(["M", "J", "Md", "Rc", "C", "Ce"]);

// ─────────────────────────────────────────────────────────────
// Helpers filtrage texte (identiques au frontend)
// ─────────────────────────────────────────────────────────────

function parseTokens(text: string): string[] {
  return text
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
}

function matchesAny(
  value: string | null | undefined,
  tokens: string[],
): boolean {
  if (!tokens.length) return true;
  const v = (value ?? "").toLowerCase();
  return tokens.some((t) => v.includes(t));
}

function matchesExact(
  value: string | null | undefined,
  tokens: string[],
): boolean {
  if (!tokens.length) return true;
  const v = (value ?? "").toLowerCase();
  return tokens.some((t) => v === t);
}

// ─────────────────────────────────────────────────────────────
// GET handler
// ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    // const session = await verifySession();
    // if (!session?.data?.user) return NextResponse.json({ message: "Vous devez être connecté" }, { status: 401 });

    const sp = request.nextUrl.searchParams;

    const dateDebut = sp.get("debut");
    const dateFin = sp.get("fin");
    const workspaceId = sp.get("workspaceId");
    const searchParam = sp.get("search") ?? "";
    const posteParam = sp.get("poste") ?? "";
    const zoneParam = sp.get("zone") ?? "";
    const zoneExact = sp.get("zoneExact") === "true";
    const presenceFilter = sp.get("presenceFilter") ?? "all"; // all | has | none
    const cycleFilter = sp.get("cycleFilter") ?? "all"; // all | with_cycle | without_cycle

    const searchTokens = parseTokens(searchParam);
    const posteTokens = parseTokens(posteParam);
    const zoneTokens = parseTokens(zoneParam);

    const dateCondition: any = {};
    if (dateDebut || dateFin) {
      dateCondition.date = {};
      if (dateDebut) dateCondition.date.gte = new Date(dateDebut);
      if (dateFin) dateCondition.date.lte = new Date(dateFin);
    }

    // ── 1. Charger tous les employés du workspace ─────────────
    const allEmployees = await prisma.employee.findMany({
      where: workspaceId ? { workspace_id: workspaceId } : {},
      include: { cycles: true },
    });

    if (allEmployees.length === 0) {
      return NextResponse.json({ error: "Aucun employé" }, { status: 404 });
    }

    const allEmployeeIds = allEmployees.map((e: any) => e.id);

    // ── 2. Charger pointages, annotations et jours fériés ────────────
    const [allPointages, allAnnotations, allJoursFeries] = await Promise.all([
      prisma.pointage.findMany({
        where: {
          employee_id: { in: allEmployeeIds },
          ...(dateDebut && dateFin
            ? {
                date: {
                  gte: new Date(new Date(dateDebut).getTime() - 86400000),
                  lte: new Date(dateFin),
                },
              }
            : {}),
        },
        select: {
          employee_id: true,
          date: true,
          heure_entree: true,
          heure_sortie: true,
          est_nuit: true,
        },
      }),
      // On remonte la récupération des annotations ici pour pouvoir filtrer dessus
      prisma.annotation.findMany({
        where: { employee_id: { in: allEmployeeIds }, ...dateCondition },
        include: { employee: { select: { matricule: true } } },
      }),
      // 🔥 NOUVEAU : Récupération des jours fériés
      prisma.jour_ferie.findMany({
        where: workspaceId
          ? {
              OR: [{ workspace_id: workspaceId }, { workspace_id: null }],
            }
          : {},
      }),
    ]);

    // ── 3. Construire presenceMap et annotMap pour les stats ─
    const cycleParEmp = new Map<string, any>();
    allEmployees.forEach((e: any) => cycleParEmp.set(e.id, e.cycles ?? null));

    const toMinutes = (h: string) => {
      const [hh, mm] = h.split(":").map(Number);
      return hh * 60 + mm;
    };
    const decalerJour = (dateStr: string, jours: number) =>
      new Date(new Date(dateStr).getTime() + jours * 86400000)
        .toISOString()
        .split("T")[0];

    const presenceMap = new Map<string, boolean>();
    const finNuitMap = new Map<string, boolean>();

    const marquerPresent = (empId: string, d: string) =>
      presenceMap.set(`${empId}_${d}`, true);
    const marquerFinNuit = (empId: string, d: string) =>
      finNuitMap.set(`${empId}_${d}`, true);

    allPointages.forEach((p: any) => {
      const dateStr = p.date.toISOString().split("T")[0];
      const empId = p.employee_id;
      const cycle = cycleParEmp.get(empId);
      const isNuit = cycle?.type === "night" || (p.est_nuit ?? false);
      const entree = p.heure_entree;
      const sortie = p.heure_sortie;

      if (entree && sortie) {
        const minE = toMinutes(entree),
          minS = toMinutes(sortie);
        const ecart = Math.abs(minS - minE);

        if (
          minS < minE ||
          (minE >= SEUIL_ENTREE_NUIT_MIN_H * 60 &&
            minS <= SEUIL_SORTIE_NUIT_MAX_H * 60)
        ) {
          marquerPresent(empId, dateStr);
          marquerFinNuit(empId, decalerJour(dateStr, +1));
          return;
        }
        if (
          minE < SEUIL_SORTIE_MATIN_MAX_H * 60 &&
          minS >= SEUIL_ENTREE_NUIT_MIN_H * 60 &&
          isNuit
        ) {
          marquerPresent(empId, dateStr);
          marquerFinNuit(empId, decalerJour(dateStr, +1));
          return;
        }
        if (
          ecart < SEUIL_BADGEUSE_UNIQUE_MIN &&
          minS < SEUIL_SORTIE_MATIN_MAX_H * 60 &&
          isNuit
        ) {
          marquerFinNuit(empId, dateStr);
          marquerPresent(empId, decalerJour(dateStr, -1));
          return;
        }
        marquerPresent(empId, dateStr);
      } else if (!entree && sortie) {
        const minS = toMinutes(sortie);
        if (minS < SEUIL_SORTIE_MATIN_MAX_H * 60 && isNuit) {
          marquerFinNuit(empId, dateStr);
          marquerPresent(empId, decalerJour(dateStr, -1));
        } else marquerPresent(empId, dateStr);
      } else if (entree && !sortie) {
        const minE = toMinutes(entree);
        if (minE >= SEUIL_ENTREE_NUIT_MIN_H * 60 && isNuit) {
          marquerPresent(empId, dateStr);
          marquerFinNuit(empId, decalerJour(dateStr, +1));
        } else marquerPresent(empId, dateStr);
      } else {
        marquerPresent(empId, dateStr);
      }
    });

    // Compter présences par employé
    const nbPresencesParEmp = new Map<string, number>();
    allEmployees.forEach((emp: any) => {
      let count = 0;
      presenceMap.forEach((_, key) => {
        if (key.startsWith(`${emp.id}_`)) count++;
      });
      nbPresencesParEmp.set(emp.id, count);
    });

    // Compter annotations par employé
    const nbAnnotationsParEmp = new Map<string, number>();
    allAnnotations.forEach((a: any) => {
      const current = nbAnnotationsParEmp.get(a.employee_id) ?? 0;
      nbAnnotationsParEmp.set(a.employee_id, current + 1);
    });

    // ── 4. Appliquer tous les filtres ─────────────────────────
    const employees = allEmployees.filter((emp: any) => {
      if (searchTokens.length > 0) {
        if (
          !matchesAny(emp.matricule, searchTokens) &&
          !matchesAny(emp.nom, searchTokens) &&
          !matchesAny(emp.prenom, searchTokens)
        )
          return false;
      }
      if (posteTokens.length > 0) {
        if (!matchesAny(emp.poste, posteTokens)) return false;
      }
      if (zoneTokens.length > 0) {
        const ok = zoneExact
          ? matchesExact(emp.zone, zoneTokens)
          : matchesAny(emp.zone, zoneTokens);
        if (!ok) return false;
      }

      // Présence = (Pointage OU Annotation)
      if (presenceFilter !== "all") {
        const nbP = nbPresencesParEmp.get(emp.id) ?? 0;
        const nbA = nbAnnotationsParEmp.get(emp.id) ?? 0;
        const totalActivity = nbP + nbA;

        if (presenceFilter === "has" && totalActivity === 0) return false;
        if (presenceFilter === "none" && totalActivity > 0) return false;
      }

      // 🔥 NOUVEAU : Filtre Cycle
      if (cycleFilter !== "all") {
        if (
          cycleFilter === "with_cycle" &&
          (!emp.cycles || emp.cycles.type === "unknown")
        )
          return false;
        if (
          cycleFilter === "without_cycle" &&
          emp.cycles &&
          emp.cycles.type !== "unknown"
        )
          return false;
      }

      return true;
    });

    if (employees.length === 0) {
      return NextResponse.json(
        { error: "Aucun employé ne correspond aux filtres" },
        { status: 404 },
      );
    }

    const employeeIds = employees.map((e: any) => e.id);

    // Filtrer la liste globale des annotations pour le rendu Excel
    // afin de ne pas fausser la génération de colonnes
    const filteredAnnotations = allAnnotations.filter((a: any) =>
      employeeIds.includes(a.employee_id),
    );

    // ── 5. Charger plannings BDD et ANCRE ABSOLUE ──
    const [allPlannings, premiersPointages] = await Promise.all([
      prisma.planning.findMany({
        where: { employee_id: { in: employeeIds }, ...dateCondition },
        include: {
          employee: { select: { matricule: true } },
          annotation: true,
        },
        orderBy: { date: "asc" },
      }),
      prisma.pointage.groupBy({
        by: ["employee_id"],
        _min: { date: true },
        where: { employee_id: { in: employeeIds } },
      }),
    ]);

    // ── Map d'ancrage des cycles (Date de référence absolue) ──
    const anchorMap = new Map<string, Date>();
    premiersPointages.forEach((p) => {
      if (p._min.date) anchorMap.set(p.employee_id, p._min.date);
    });

    // ── 6. Dates de la période ────────────────────────────────
    let toutesLesDates: string[] = [];

    if (dateDebut && dateFin) {
      const start = new Date(dateDebut),
        end = new Date(dateFin),
        current = new Date(start);
      while (current <= end) {
        toutesLesDates.push(current.toISOString().split("T")[0]);
        current.setDate(current.getDate() + 1);
      }
    } else {
      const datesSet = new Set<string>();
      allPlannings.forEach((p: any) =>
        datesSet.add(p.date.toISOString().split("T")[0]),
      );
      filteredAnnotations.forEach((a: any) =>
        datesSet.add(a.date.toISOString().split("T")[0]),
      );
      allPointages.forEach((p: any) =>
        datesSet.add(p.date.toISOString().split("T")[0]),
      );
      toutesLesDates = Array.from(datesSet).sort();
    }

    // ── 7. Maps ───────────────────────────────────────────────
    const planningMap = new Map<string, any>();
    allPlannings.forEach((p: any) =>
      planningMap.set(
        `${p.employee.matricule}_${p.date.toISOString().split("T")[0]}`,
        p,
      ),
    );

    const annotMap = new Map<string, any>();
    filteredAnnotations.forEach((a: any) =>
      annotMap.set(
        `${a.employee.matricule}_${a.date.toISOString().split("T")[0]}`,
        a,
      ),
    );

    // ── 8. Construire les rows ────────────────────────────────
    type EmpRow = {
      matricule: string;
      nom: string;
      prenom: string;
      poste: string;
      zone: string;
      cycle: string;
      jours: Record<string, string>;
      stats: Record<string, number>;
    };

    const rows: EmpRow[] = [];

    for (const emp of employees) {
      const jours: Record<string, string> = {};
      const anchorDate = anchorMap.get(emp.id) || null;

      const stats: Record<string, number> = {
        P: 0,
        A: 0,
        R: 0,
        JF: 0, // 🔥 NOUVEAU
        M: 0,
        J: 0,
        Md: 0,
        Rc: 0,
        C: 0,
        Ce: 0,
        absences_nettes: 0,
        absences_annotees: 0,
        presences_supplementaires: 0,
      };

      toutesLesDates.forEach((dateStr) => {
        const annotKey = `${emp.matricule}_${dateStr}`;
        const presenceKey = `${emp.id}_${dateStr}`;
        const veilleDateStr = decalerJour(dateStr, -1);
        const veilleKey = `${emp.id}_${veilleDateStr}`;
        const planKey = `${emp.matricule}_${dateStr}`;
        const finNuitKey = `${emp.id}_${dateStr}`;

        const annot = annotMap.get(annotKey) ?? null;
        const hadPointage = presenceMap.has(presenceKey);

        const estFinNuit =
          finNuitMap.has(finNuitKey) || finNuitMap.has(veilleKey);
        const devraitRepos =
          estJourRepos(new Date(dateStr), emp.cycles, anchorDate) || estFinNuit;

        let code = "";

        // 1. PRIORITÉ ABSOLUE : Les annotations explicites
        if (annot && ANNOT_CODES.has(annot.code)) {
          code = annot.code;
        }
        // 2. PRIORITÉ SECONDAIRE : Le planning BDD
        else if (planningMap.has(planKey)) {
          const plan = planningMap.get(planKey);
          const pa = plan.annotation ?? null;
          if (pa && ANNOT_CODES.has(pa.code)) {
            code = pa.code;
          } else {
            code = plan.statut;
          }
        }
        // 3. LOGIQUE AUTOMATIQUE (Badgeuse, Cycles & Jours Fériés)
        else if (estFinNuit) {
          code = "R";
        } else if (hadPointage) {
          code = "P";
        } else {
          // 🔥 NOUVELLE LOGIQUE JOURS FÉRIÉS
          if (estJourRepos(new Date(dateStr), emp.cycles, anchorDate)) {
            code = "R";
          } else if (
            emp.cycles?.type === "weekly" &&
            verifierJourFerie(new Date(dateStr), allJoursFeries)
          ) {
            code = "JF";
          } else {
            code = "A";
          }
        }

        jours[dateStr] = code;

        // ── 9. Calcul des Statistiques ──
        if (code === "P") {
          stats.P++;
          if (devraitRepos) stats.presences_supplementaires++;
          if (!hadPointage && !devraitRepos) {
            stats.A++;
            stats.absences_annotees++;
          }
        } else if (code === "R") {
          stats.R++;
          if (!hadPointage && !devraitRepos) {
            stats.A++;
            stats.absences_annotees++;
          }
        } else if (code === "JF") {
          stats.JF++; // 🔥 NOUVEAU
        } else if (ANNOT_CODES.has(code)) {
          stats.P++;
          if (code in stats) {
            stats[code as keyof typeof stats]++;
          }
          if (devraitRepos) {
            stats.presences_supplementaires++;
          } else {
            stats.A++;
            stats.absences_annotees++;
          }
        } else {
          stats.A++; // Les "A" par défaut
        }
      });

      stats.absences_nettes = stats.A - stats.absences_annotees;

      rows.push({
        matricule: emp.matricule,
        nom: emp.nom ?? "",
        prenom: emp.prenom ?? "",
        poste: emp.poste ?? "",
        zone: emp.zone ?? "",
        cycle: getCycleLabel(emp.cycles),
        jours,
        stats,
      });
    }

    // ── 10. Excel ──────────────────────────────────────────────
    const months = [
      "Jan",
      "Fév",
      "Mar",
      "Avr",
      "Mai",
      "Jun",
      "Jul",
      "Aoû",
      "Sep",
      "Oct",
      "Nov",
      "Déc",
    ];
    const daysLabel = ["Di", "Lu", "Ma", "Me", "Je", "Ve", "Sa"];

    // 🔥 AJOUT DE LA COLONNE JOURS FÉRIÉS
    const STAT_COLS = [
      "Matricule",
      "Nom",
      "Prénom",
      "Poste",
      "Zone",
      "Cycle",
      "Présences",
      "Absences",
      "Repos",
      "Jours Fériés", // <-- Ajout ici
      "Abs. nettes",
      "Abs. justif.",
      "Mission",
      "Justifié",
      "Maladie",
      "Récup.",
      "Congé",
      "Congé excep.",
    ];

    const headerMonth: string[] = [...STAT_COLS];
    let lastMonthKey = "";
    toutesLesDates.forEach((d) => {
      const [y, m] = d.split("-"),
        key = `${y}-${m}`;
      headerMonth.push(key !== lastMonthKey ? `${months[+m - 1]} ${y}` : "");
      lastMonthKey = key;
    });

    const headerDay: (string | number)[] = [...STAT_COLS];
    toutesLesDates.forEach((d) => {
      const [y, m, dd] = d.split("-");
      headerDay.push(`${dd} ${daysLabel[new Date(+y, +m - 1, +dd).getDay()]}`);
    });

    const planningSheet: any[][] = [headerMonth, headerDay];
    rows.forEach((row) => {
      planningSheet.push([
        row.matricule,
        row.nom,
        row.prenom,
        row.poste,
        row.zone,
        row.cycle,
        row.stats.P,
        row.stats.A,
        row.stats.R,
        row.stats.JF, // <-- Insertion de la donnée JF
        row.stats.absences_nettes,
        row.stats.absences_annotees,
        row.stats.M,
        row.stats.J,
        row.stats.Md,
        row.stats.Rc,
        row.stats.C,
        row.stats.Ce,
        ...toutesLesDates.map((d) => row.jours[d] ?? ""),
      ]);
    });

    const recapSheet: any[][] = [
      [
        "Matricule",
        "Nom",
        "Prénom",
        "Poste",
        "Zone",
        "Cycle",
        "Présences",
        "Absences totales",
        "Repos",
        "Jours Fériés", // <-- Ajout ici
        "Absences nettes",
        "Absences justifiées",
        "Mission (M)",
        "Justifié (J)",
        "Maladie (Md)",
        "Récupération (Rc)",
        "Congé (C)",
        "Congé excep. (Ce)",
        "Taux présence",
      ],
    ];
    rows.forEach((row) => {
      const total = row.stats.P + row.stats.A + row.stats.R + row.stats.JF; // On peut inclure JF dans le total si on veut, à voir selon tes règles RH
      recapSheet.push([
        row.matricule,
        row.nom,
        row.prenom,
        row.poste,
        row.zone,
        row.cycle,
        row.stats.P,
        row.stats.A,
        row.stats.R,
        row.stats.JF, // <-- Insertion de la donnée JF
        row.stats.absences_nettes,
        row.stats.absences_annotees,
        row.stats.M,
        row.stats.J,
        row.stats.Md,
        row.stats.Rc,
        row.stats.C,
        row.stats.Ce,
        total > 0 ? `${Math.round((row.stats.P / total) * 100)}%` : "0%",
      ]);
    });

    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.aoa_to_sheet(planningSheet);
    const ws2 = XLSX.utils.aoa_to_sheet(recapSheet);

    // Ajustement des colonnes suite à l'ajout de Jours Fériés
    ws1["!cols"] = [
      { wch: 12 },
      { wch: 16 },
      { wch: 16 },
      { wch: 16 },
      { wch: 10 },
      { wch: 14 },
      { wch: 8 }, // P
      { wch: 8 }, // A
      { wch: 8 }, // R
      { wch: 10 }, // JF (Nouveau)
      { wch: 10 },
      { wch: 10 },
      { wch: 8 },
      { wch: 8 },
      { wch: 8 },
      { wch: 8 },
      { wch: 8 },
      { wch: 8 },
      ...toutesLesDates.map(() => ({ wch: 5 })),
    ];
    ws2["!cols"] = [
      { wch: 12 },
      { wch: 16 },
      { wch: 16 },
      { wch: 16 },
      { wch: 10 },
      { wch: 14 },
      { wch: 10 }, // P
      { wch: 14 }, // A
      { wch: 8 }, // R
      { wch: 12 }, // JF (Nouveau)
      { wch: 14 },
      { wch: 14 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 14 },
      { wch: 10 },
      { wch: 14 },
      { wch: 12 },
    ];

    XLSX.utils.book_append_sheet(wb, ws1, "Planning");
    XLSX.utils.book_append_sheet(wb, ws2, "Récapitulatif");

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const dateStr = new Date().toISOString().split("T")[0];

    return new NextResponse(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="planning_${dateStr}.xlsx"`,
      },
    });
  } catch (error) {
    console.error("Erreur export:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'export" },
      { status: 500 },
    );
  }
}

// 🔥 FONCTION POUR VÉRIFIER LES JOURS FÉRIÉS
function verifierJourFerie(targetDate: Date, joursFeries: any[]): boolean {
  if (!joursFeries || joursFeries.length === 0) return false;

  const tDate = new Date(targetDate.toISOString().split("T")[0]);
  const tTime = tDate.getTime();

  for (const jf of joursFeries) {
    const debut = new Date(jf.date_debut);
    const fin = new Date(jf.date_fin);

    if (jf.recurrent) {
      const startRecurrent = new Date(debut);
      startRecurrent.setFullYear(tDate.getFullYear());

      const endRecurrent = new Date(fin);
      endRecurrent.setFullYear(tDate.getFullYear());

      const sTime = new Date(
        startRecurrent.toISOString().split("T")[0],
      ).getTime();
      const eTime = new Date(
        endRecurrent.toISOString().split("T")[0],
      ).getTime();

      if (tTime >= sTime && tTime <= eTime) {
        return true;
      }
    } else {
      const sTime = new Date(debut.toISOString().split("T")[0]).getTime();
      const eTime = new Date(fin.toISOString().split("T")[0]).getTime();

      if (tTime >= sTime && tTime <= eTime) {
        return true;
      }
    }
  }

  return false;
}

function getCycleLabel(cycle: any): string {
  if (!cycle) return "?";
  if (cycle.type === "weekly") {
    try {
      let days = JSON.parse(cycle.rest_days || "[]");
      if (typeof days === "string") days = JSON.parse(days);
      return `Repos: ${days.map((d: number) => ["Di", "Lu", "Ma", "Me", "Je", "Ve", "Sa"][d]).join("+")}`;
    } catch {
      return "?";
    }
  }
  if (cycle.type === "rotation") return `${cycle.travail}T/${cycle.repos}R`;
  if (cycle.type === "night") return `🌙${cycle.travail}N/${cycle.repos}R`;
  return "Inconnu";
}

// 🔥 LOGIQUE ABSOLUE POUR LES ROTATIONS
function estJourRepos(
  date: Date,
  cycle: any,
  anchorDate: Date | null,
): boolean {
  if (!cycle || cycle.type === "unknown") return [5, 6].includes(date.getDay());

  if (cycle.type === "weekly") {
    try {
      return JSON.parse(cycle.rest_days || "[]").includes(date.getDay());
    } catch {
      return false;
    }
  }

  if (cycle.type === "rotation" || cycle.type === "night") {
    if (!anchorDate) return false;

    const targetMs = new Date(date.toISOString().split("T")[0]).getTime();
    const anchorMs = new Date(anchorDate.toISOString().split("T")[0]).getTime();
    const diffDays = Math.round((targetMs - anchorMs) / 86400000);

    const cl = (cycle.travail || 2) + (cycle.repos || 2);

    let position = (diffDays + (cycle.start_phase || 0)) % cl;
    if (position < 0) position += cl;

    return position >= (cycle.travail || 2);
  }

  return false;
}

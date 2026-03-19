// app/api/export/route.ts
//
// Paramètres de filtrage acceptés :
//   workspaceId    : string
//   debut          : YYYY-MM-DD
//   fin            : YYYY-MM-DD
//   search         : "mat1,dupont,jean"   → matricule OU nom OU prénom contient
//   poste          : "tech,agent"         → poste contient (OR)
//   zone           : "zone1,zone2"        → zone contient OU exact selon zoneExact
//   zoneExact      : "true"              → zone = exact match
//   presenceFilter : "all" | "has" | "none"

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import * as XLSX from "xlsx";

const SEUIL_BADGEUSE_UNIQUE_MIN = 15;
const SEUIL_SORTIE_MATIN_MAX_H = 8;
const SEUIL_ENTREE_NUIT_MIN_H = 14;
const SEUIL_SORTIE_NUIT_MAX_H = 10;
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
    const sp = request.nextUrl.searchParams;

    const dateDebut = sp.get("debut");
    const dateFin = sp.get("fin");
    const workspaceId = sp.get("workspaceId");
    const searchParam = sp.get("search") ?? "";
    const posteParam = sp.get("poste") ?? "";
    const zoneParam = sp.get("zone") ?? "";
    const zoneExact = sp.get("zoneExact") === "true";
    const presenceFilter = sp.get("presenceFilter") ?? "all"; // all | has | none

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

    const allEmployeeIds = allEmployees.map((e) => e.id);

    // ── 2. Charger pointages pour calcul présences ────────────
    //    (nécessaire pour le filtre presenceFilter)
    const allPointages = await prisma.pointage.findMany({
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
    });

    // ── 3. Construire presenceMap (nombre présences par empId) ─
    const cycleParEmp = new Map<string, any>();
    allEmployees.forEach((e) => cycleParEmp.set(e.id, e.cycles ?? null));

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

    allPointages.forEach((p) => {
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
    allEmployees.forEach((emp) => {
      let count = 0;
      presenceMap.forEach((_, key) => {
        if (key.startsWith(`${emp.id}_`)) count++;
      });
      nbPresencesParEmp.set(emp.id, count);
    });

    // ── 4. Appliquer tous les filtres ─────────────────────────
    const employees = allEmployees.filter((emp) => {
      // Filtre search (matricule / nom / prénom)
      if (searchTokens.length > 0) {
        if (
          !matchesAny(emp.matricule, searchTokens) &&
          !matchesAny(emp.nom, searchTokens) &&
          !matchesAny(emp.prenom, searchTokens)
        )
          return false;
      }

      // Filtre poste
      if (posteTokens.length > 0) {
        if (!matchesAny(emp.poste, posteTokens)) return false;
      }

      // Filtre zone (exact ou contains)
      if (zoneTokens.length > 0) {
        const ok = zoneExact
          ? matchesExact(emp.zone, zoneTokens)
          : matchesAny(emp.zone, zoneTokens);
        if (!ok) return false;
      }

      // Filtre présences
      if (presenceFilter !== "all") {
        const nb = nbPresencesParEmp.get(emp.id) ?? 0;
        if (presenceFilter === "has" && nb === 0) return false;
        if (presenceFilter === "none" && nb > 0) return false;
      }

      return true;
    });

    if (employees.length === 0) {
      return NextResponse.json(
        { error: "Aucun employé ne correspond aux filtres" },
        { status: 404 },
      );
    }

    const employeeIds = employees.map((e) => e.id);

    // ── 5. Charger annotations + plannings BDD pour les employés filtrés ──
    const [allAnnotations, allPlannings] = await Promise.all([
      prisma.annotation.findMany({
        where: { employee_id: { in: employeeIds }, ...dateCondition },
        include: { employee: { select: { matricule: true } } },
      }),
      prisma.planning.findMany({
        where: { employee_id: { in: employeeIds }, ...dateCondition },
        include: {
          employee: { select: { matricule: true } },
          annotation: true,
        },
        orderBy: { date: "asc" },
      }),
    ]);

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
      allPlannings.forEach((p) =>
        datesSet.add(p.date.toISOString().split("T")[0]),
      );
      allAnnotations.forEach((a) =>
        datesSet.add(a.date.toISOString().split("T")[0]),
      );
      allPointages.forEach((p) =>
        datesSet.add(p.date.toISOString().split("T")[0]),
      );
      toutesLesDates = Array.from(datesSet).sort();
    }

    // ── 7. Maps ───────────────────────────────────────────────
    const planningMap = new Map<string, any>();
    allPlannings.forEach((p) =>
      planningMap.set(
        `${p.employee.matricule}_${p.date.toISOString().split("T")[0]}`,
        p,
      ),
    );

    const annotMap = new Map<string, any>();
    allAnnotations.forEach((a) =>
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
      const stats: Record<string, number> = {
        P: 0,
        A: 0,
        R: 0,
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

      toutesLesDates.forEach((dateStr, i) => {
        const annotKey = `${emp.matricule}_${dateStr}`;
        const presenceKey = `${emp.id}_${dateStr}`;
        const veilleKey = `${emp.id}_${decalerJour(dateStr, -1)}`;
        const planKey = `${emp.matricule}_${dateStr}`;
        const finNuitKey = `${emp.id}_${dateStr}`;

        const annot = annotMap.get(annotKey) ?? null;
        const hadPointage = presenceMap.has(presenceKey);
        const devraitRepos = estJourRepos(new Date(dateStr), emp.cycles, i);

        let code = "";
        if (finNuitMap.has(finNuitKey)) code = "R";
        else if (finNuitMap.has(veilleKey)) code = "R";
        else if (hadPointage)
          code = annot && ANNOT_CODES.has(annot.code) ? annot.code : "P";
        else if (annot && ANNOT_CODES.has(annot.code)) code = annot.code;
        else if (planningMap.has(planKey)) {
          const plan = planningMap.get(planKey);
          const pa = plan.annotation ?? null;
          code = pa && ANNOT_CODES.has(pa.code) ? pa.code : plan.statut;
        } else code = devraitRepos ? "R" : "A";

        jours[dateStr] = code;

        if (code === "P") {
          stats.P++;
          if (devraitRepos) stats.presences_supplementaires++;
        } else if (code === "R") {
          stats.R++;
        } else if (ANNOT_CODES.has(code)) {
          if (hadPointage) {
            stats.P++;
            if (devraitRepos) stats.presences_supplementaires++;
          } else {
            stats.A++;
            stats[code as keyof typeof stats]++;
            stats.absences_annotees++;
          }
        } else {
          stats.A++;
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

    // ── 9. Excel ──────────────────────────────────────────────
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
      const total = row.stats.P + row.stats.A + row.stats.R;
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

    ws1["!cols"] = [
      { wch: 12 },
      { wch: 16 },
      { wch: 16 },
      { wch: 16 },
      { wch: 10 },
      { wch: 14 },
      { wch: 8 },
      { wch: 8 },
      { wch: 8 },
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
      { wch: 10 },
      { wch: 14 },
      { wch: 8 },
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

function estJourRepos(date: Date, cycle: any, index: number): boolean {
  if (!cycle || cycle.type === "unknown") return [5, 6].includes(date.getDay());
  if (cycle.type === "weekly") {
    try {
      return JSON.parse(cycle.rest_days || "[]").includes(date.getDay());
    } catch {
      return false;
    }
  }
  if (cycle.type === "rotation" || cycle.type === "night") {
    const cl = (cycle.travail || 2) + (cycle.repos || 2);
    return (index + (cycle.start_phase || 0)) % cl >= (cycle.travail || 2);
  }
  return false;
}

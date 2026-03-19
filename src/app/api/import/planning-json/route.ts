// app/api/import/planning-json/route.ts
//
// Importe un fichier JSON exporté depuis pc-planning.html
//
// Structure JSON attendue :
// {
//   employees: {
//     "MAT001": {
//       presentDates: ["2024-01-01", ...],
//       nightDates:   ["2024-01-01", ...],
//       cycle: { type, restDays?, work?, rest?, startPhase?, accuracy? }
//     }
//   },
//   planning:    { "MAT001": { "2024-01-01": "P"|"A"|"R" } },
//   annotations: { "MAT001": { "2024-01-01": "M"|"J"|"Md"|"Rc"|"C"|"Ce" } },
//   staffDb:     { "MAT001": { nom, prenom, poste, zone } },
//   manualCycles: ["MAT001", ...]
// }

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifySession } from "@/actions/permissions";

// ─── Constantes ───────────────────────────────────────────────

const ANNOT_LABELS: Record<string, string> = {
  M: "Mission",
  J: "Justifié",
  Md: "Maladie",
  Rc: "Récupération",
  C: "Congé",
  Ce: "Congé exceptionnel",
};

// ─── POST handler ─────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const session = await verifySession();
    if (!session?.data?.user) {
      return NextResponse.json(
        { message: "Vous devez être connecté" },
        { status: 401 },
      );
    }
    const body = await request.json();

    // ── Validation basique ─────────────────────────────────
    if (!body.employees || typeof body.employees !== "object") {
      return NextResponse.json(
        { error: "Format invalide — champ 'employees' manquant" },
        { status: 400 },
      );
    }

    const employees: Record<string, any> = body.employees ?? {};
    const planning: Record<string, any> = body.planning ?? {};
    const annotations: Record<string, any> = body.annotations ?? {};
    const staffDb: Record<string, any> = body.staffDb ?? {};
    const manualCycles: string[] = body.manualCycles ?? [];
    const workspace_id: string = body.workspace_id ?? "";

    const manualSet = new Set(manualCycles);

    // ── Résumé de l'import ─────────────────────────────────
    const summary = {
      total: 0,
      crees: 0,
      existants: 0,
      cycles_crees: 0,
      plannings_crees: 0,
      annotations_crees: 0,
      erreurs: [] as string[],
    };

    const matricules = Object.keys(employees);
    summary.total = matricules.length;

    // ── Récupérer les employés existants ───────────────────
    const existingEmployees = await prisma.employee.findMany({
      where: { matricule: { in: matricules } },
      include: { cycles: true },
    });

    const existingMap = new Map(existingEmployees.map((e) => [e.matricule, e]));

    // ══════════════════════════════════════════════════════
    // BOUCLE PRINCIPALE — un employé à la fois
    // ══════════════════════════════════════════════════════
    for (const mat of matricules) {
      try {
        const empData = employees[mat];
        const staff = staffDb[mat] ?? {};
        const empCycle = empData.cycle ?? { type: "unknown" };
        const isManual = manualSet.has(mat);

        // ── 1. Créer l'employé s'il n'existe pas ──────────
        let employee = existingMap.get(mat);

        if (!employee) {
          employee = await prisma.employee.create({
            data: {
              matricule: mat,
              nom: staff.nom ?? null,
              prenom: staff.prenom ?? null,
              poste: staff.poste ?? null,
              zone: staff.zone ?? null,
              workspace_id: workspace_id,
            },
            include: { cycles: true },
          });
          summary.crees++;
        } else {
          summary.existants++;
        }

        // ── 2. Cycle ──────────────────────────────────────
        // Règle : si manuel → créer tel quel
        //         si non manuel → ne rien créer (detect plus tard)

        if (isManual) {
          // Construire le cycle selon le type
          const cycleData = buildCycleData(empCycle, isManual);
          await prisma.cycle.upsert({
            where: { employee_id: employee.id },
            update: {
              ...cycleData,
              created_by: session.data.user.id,
            },
            create: {
              employee_id: employee.id,
              ...cycleData,
              created_by: session.data.user.id,
            },
          });
          summary.cycles_crees++;
        }
        // Si cycle non manuel et pas déjà existant → on laisse vide
        // (la détection auto se fera après)

        // ── 3. Plannings + Annotations ────────────────────
        const empPlanning = planning[mat] ?? {};
        const empAnnotations = annotations[mat] ?? {};

        const dates = Object.keys(empPlanning);

        for (const dateStr of dates) {
          const statut = empPlanning[dateStr];
          const annotCode = empAnnotations[dateStr] ?? null;

          if (!["P", "A", "R"].includes(statut)) continue;

          const date = new Date(dateStr);
          if (isNaN(date.getTime())) continue;

          try {
            // ── Upsert annotation si elle existe ──────────
            let annotationId: string | null = null;

            if (annotCode && ANNOT_LABELS[annotCode]) {
              const annot = await prisma.annotation.upsert({
                where: { employee_id_date: { employee_id: employee.id, date } },
                update: {
                  code: annotCode,
                  libelle: ANNOT_LABELS[annotCode],
                  updated_at: new Date(),
                },
                create: {
                  employee_id: employee.id,
                  date,
                  code: annotCode,
                  libelle: ANNOT_LABELS[annotCode],
                  created_by: session.data.user.id,
                },
              });
              annotationId = annot.id;
              summary.annotations_crees++;
            }

            // ── Upsert planning ───────────────────────────
            // await prisma.planning.upsert({
            //   where: { employee_id_date: { employee_id: employee.id, date } },
            //   update: {
            //     statut,
            //     annotation_id: annotationId,
            //     updated_at: new Date(),
            //   },
            //   create: {
            //     employee_id: employee.id,
            //     date,
            //     statut,
            //     annotation_id: annotationId,
            //     created_by: session.data.user.id,
            //   },
            // });
            summary.plannings_crees++;
          } catch (dateErr: any) {
            // Erreur sur une date spécifique → on continue
            summary.erreurs.push(`${mat}/${dateStr}: ${dateErr.message}`);
          }
        }
      } catch (empErr: any) {
        summary.erreurs.push(`${mat}: ${empErr.message}`);
      }
    }

    return NextResponse.json({
      message: "Import terminé",
      summary: {
        ...summary,
        // Limiter les erreurs affichées à 20
        erreurs: summary.erreurs.slice(0, 20),
        erreurs_total: summary.erreurs.length,
      },
    });
  } catch (error: any) {
    console.error("Erreur import JSON:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'import", detail: error.message },
      { status: 500 },
    );
  }
}

// ─────────────────────────────────────────────────────────────
// buildCycleData
// Convertit le format HTML (work/rest/restDays/startPhase)
// vers le format BDD (travail/repos/rest_days/start_phase)
// ─────────────────────────────────────────────────────────────

function buildCycleData(cycle: any, isManual: boolean) {
  const base = {
    type: cycle.type ?? "unknown",
    est_manuel: isManual,
    fiabilite: cycle.accuracy ?? cycle.score ?? null,
  };

  if (cycle.type === "weekly") {
    // HTML: restDays: [5, 6]
    // BDD:  rest_days: "[5,6]"
    const restDays = cycle.restDays ?? cycle.rest_days ?? [];
    return {
      ...base,
      rest_days: JSON.stringify(restDays),
      travail: null,
      repos: null,
      start_phase: null,
    };
  }

  if (cycle.type === "rotation" || cycle.type === "night") {
    // HTML: work/rest/startPhase
    // BDD:  travail/repos/start_phase
    return {
      ...base,
      rest_days: null,
      travail: cycle.work ?? cycle.travail ?? null,
      repos: cycle.rest ?? cycle.repos ?? null,
      start_phase: cycle.startPhase ?? cycle.start_phase ?? 0,
    };
  }

  // unknown
  return {
    ...base,
    rest_days: null,
    travail: null,
    repos: null,
    start_phase: 0,
  };
}

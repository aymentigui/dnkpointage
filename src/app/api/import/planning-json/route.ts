// app/api/import/planning-json/route.ts
//
// Importe uniquement les annotations depuis un fichier JSON exporté depuis pc-planning.html
// - Si l'employé (matricule) existe dans la base → on insère ses annotations (sans écraser)
// - Si l'employé n'existe pas → on skip (aucune création)
//
// Structure JSON attendue :
// {
//   annotations: { "MAT001": { "2024-01-01": "M"|"J"|"Md"|"Rc"|"C"|"Ce" } },
//   staffDb:     { "MAT001": { nom, prenom, poste, zone } },   // optionnel, juste pour les logs
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

const ANNOT_CODES = new Set(Object.keys(ANNOT_LABELS));

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

    const annotations: Record<string, any> = body.annotations ?? {};
    const workspace_id: string = body.workspace_id ?? "";

    // ── Résumé de l'import ─────────────────────────────────
    const summary = {
      total_matricules: 0,
      trouves: 0,
      skipped: 0,
      annotations_crees: 0,
      erreurs: [] as string[],
    };

    const matricules = Object.keys(annotations);
    summary.total_matricules = matricules.length;

    if (matricules.length === 0) {
      return NextResponse.json(
        { error: "Aucune annotation trouvée dans le fichier" },
        { status: 400 },
      );
    }

    // ── Récupérer uniquement les employés existants ────────
    const existingEmployees = await prisma.employee.findMany({
      where: {
        matricule: { in: matricules },
        workspace_id: workspace_id,
      },
      select: { id: true, matricule: true },
    });

    const existingMap = new Map(existingEmployees.map((e) => [e.matricule, e]));

    summary.trouves = existingMap.size;
    summary.skipped = matricules.length - existingMap.size;

    // ══════════════════════════════════════════════════════
    // BOUCLE PRINCIPALE — uniquement les employés trouvés
    // ══════════════════════════════════════════════════════
    for (const mat of matricules) {
      const employee = existingMap.get(mat);

      // Employé introuvable dans la base → on skip
      if (!employee) continue;

      const empAnnotations = annotations[mat] ?? {};
      const dates = Object.keys(empAnnotations);

      for (const dateStr of dates) {
        const annotCode = empAnnotations[dateStr];

        // Code annotation invalide → on skip
        if (!annotCode || !ANNOT_CODES.has(annotCode)) continue;

        const date = new Date(dateStr);
        if (isNaN(date.getTime())) {
          summary.erreurs.push(`${mat}/${dateStr}: date invalide`);
          continue;
        }

        try {
          // ── Vérifier si une annotation existe déjà ──────
          const existing = await prisma.annotation.findUnique({
            where: { employee_id_date: { employee_id: employee.id, date } },
          });

          // Si déjà présente → on ne touche pas
          if (existing) continue;

          // ── Insérer uniquement si elle n'existe pas ─────
          await prisma.annotation.create({
            data: {
              employee_id: employee.id,
              date,
              code: annotCode,
              libelle: ANNOT_LABELS[annotCode],
              created_by: session.data.user.id,
            },
          });

          await prisma.modification_history.create({
            data: {
              employee_id: employee.id,
              date: date,
              nouveau_statut: annotCode,
              type_modification: "annotation",
              created_by: session.data.user.id,
            },
          });

          summary.annotations_crees++;
        } catch (err: any) {
          summary.erreurs.push(`${mat}/${dateStr}: ${err.message}`);
        }
      }
    }

    return NextResponse.json({
      message: "Import des annotations terminé",
      summary: {
        ...summary,
        erreurs: summary.erreurs.slice(0, 20),
        erreurs_total: summary.erreurs.length,
      },
    });
  } catch (error: any) {
    console.error("Erreur import annotations:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'import", detail: error.message },
      { status: 500 },
    );
  }
}

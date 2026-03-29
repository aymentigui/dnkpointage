// app/api/workspace/[id]/export/route.ts

import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/actions/permissions";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest, { params }: any) {
  try {
    const session = await verifySession();
    if (!session?.data?.user) {
      return NextResponse.json(
        { message: "Vous devez être connecté" },
        { status: 401 },
      );
    }
    const paramsId = await params;
    const workspaceId = paramsId.id;

    // 1. Récupère le workspace
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      return NextResponse.json(
        { error: "Workspace introuvable" },
        { status: 404 },
      );
    }

    // 2. Récupère tous les employés avec toutes leurs données liées
    const employees = await prisma.employee.findMany({
      where: { workspace_id: workspaceId },
      include: {
        pointages: true,
        plannings: {
          include: {
            annotation: true, // inclut l'annotation liée au planning
          },
        },
        annotations: true,
        cycles: true,
        modification_histories: true,
      },
    });

    // 3. Construit le payload d'export
    const exportPayload = {
      version: "1.0",
      exported_at: new Date().toISOString(),
      workspace: {
        // On exclut l'id pour permettre la ré-importation propre
        nom: workspace.nom,
        emp_count: workspace.emp_count,
        days_count: workspace.days_count,
        saved_at: workspace.saved_at,
        created_at: workspace.created_at,
      },
      employees: employees.map((emp) => ({
        // Données employé (sans id ni workspace_id, ils seront régénérés à l'import)
        matricule: emp.matricule,
        nom: emp.nom,
        prenom: emp.prenom,
        poste: emp.poste,
        zone: emp.zone,
        created_at: emp.created_at,

        pointages: emp.pointages.map((p) => ({
          date: p.date,
          heure_entree: p.heure_entree,
          heure_sortie: p.heure_sortie,
          est_nuit: p.est_nuit,
          type_creation: p.type_creation,
          created_at: p.created_at,
          created_by: p.created_by,
        })),

        plannings: emp.plannings.map((pl) => ({
          date: pl.date,
          statut: pl.statut,
          created_at: pl.created_at,
          created_by: pl.created_by,
          // L'annotation est embarquée directement dans le planning
          annotation: pl.annotation
            ? {
                code: pl.annotation.code,
                libelle: pl.annotation.libelle,
                date: pl.annotation.date,
                description: pl.annotation.description,
                created_at: pl.annotation.created_at,
                created_by: pl.annotation.created_by,
              }
            : null,
        })),

        // Annotations sans planning (annotations standalone)
        annotations_standalone: emp.annotations
          .filter(
            (a) => !emp.plannings.some((pl) => pl.annotation?.id === a.id),
          )
          .map((a) => ({
            code: a.code,
            libelle: a.libelle,
            date: a.date,
            description: a.description,
            created_at: a.created_at,
            created_by: a.created_by,
          })),

        cycle: emp.cycles
          ? {
              type: emp.cycles.type,
              rest_days: emp.cycles.rest_days,
              travail: emp.cycles.travail,
              repos: emp.cycles.repos,
              start_phase: emp.cycles.start_phase,
              fiabilite: emp.cycles.fiabilite,
              est_manuel: emp.cycles.est_manuel,
              created_at: emp.cycles.created_at,
              created_by: emp.cycles.created_by,
            }
          : null,

        modification_histories: emp.modification_histories.map((mh) => ({
          date: mh.date,
          ancien_statut: mh.ancien_statut,
          nouveau_statut: mh.nouveau_statut,
          type_modification: mh.type_modification,
          description: mh.description,
          created_by: mh.created_by,
          created_at: mh.created_at,
        })),
      })),
    };

    // 4. Retourne le JSON comme fichier téléchargeable
    const filename = `workspace_${workspace.nom.replace(/\s+/g, "_")}_${new Date()
      .toISOString()
      .slice(0, 10)}.json`;

    return new NextResponse(JSON.stringify(exportPayload, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("[WORKSPACE_EXPORT]", error);
    return NextResponse.json(
      { error: "Erreur serveur lors de l'export" },
      { status: 500 },
    );
  }
}

// ─────────────────────────────────────────────────────────────
// app/api/employees/[id]/route.ts
// GET /api/employees/[id]
// → infos de base + statistiques complètes
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest, { params }: any) {
  try {
    const paramsId = await params;
    const { id } = paramsId;
    const searchParams = request.nextUrl.searchParams;
    const dateDebut = searchParams.get("debut");
    const dateFin = searchParams.get("fin");
    const employee = await prisma.employee.findUnique({
      where: { id },
      include: {
        cycles: true,
      },
    });
    if (!employee) {
      return NextResponse.json(
        { error: "Employé non trouvé" },
        { status: 404 },
      );
    }

    // Condition de date optionnelle
    const dateCondition: any = {};
    if (dateDebut || dateFin) {
      dateCondition.date = {};
      if (dateDebut) dateCondition.date.gte = new Date(dateDebut);
      if (dateFin) dateCondition.date.lte = new Date(dateFin);
    }

    // Récupérer plannings + pointages en parallèle
    const [plannings, pointages] = await Promise.all([
      prisma.planning.findMany({
        where: { employee_id: id, ...dateCondition },
        include: { annotation: true },
        orderBy: { date: "asc" },
      }),
      prisma.pointage.findMany({
        where: { employee_id: id, ...dateCondition },
        orderBy: { date: "asc" },
      }),
    ]);

    // ── Calcul des statistiques ──
    const statutCount = { P: 0, A: 0, R: 0 };
    for (const p of plannings) {
      const s = p.statut as keyof typeof statutCount;
      if (s in statutCount) statutCount[s]++;
    }

    const totalJoursTravailPrevus = statutCount.P + statutCount.A;
    const tauxPresence =
      totalJoursTravailPrevus > 0
        ? Math.round((statutCount.P / totalJoursTravailPrevus) * 100)
        : 0;

    // Calcul des heures travaillées
    let totalMinutes = 0;
    let joursAvecHeures = 0;
    for (const p of pointages) {
      if (p.heure_entree && p.heure_sortie) {
        const [hE, mE] = p.heure_entree.split(":").map(Number);
        const [hS, mS] = p.heure_sortie.split(":").map(Number);
        const entreeMin = hE * 60 + mE;
        const sortieMin = hS * 60 + mS;
        // Gère les nuits (sortie < entrée)
        const duree =
          sortieMin < entreeMin
            ? 1440 - entreeMin + sortieMin
            : sortieMin - entreeMin;
        if (duree > 5) {
          // ignorer les pointages incomplets (< 5 min)
          totalMinutes += duree;
          joursAvecHeures++;
        }
      }
    }

    const totalHeures = Math.floor(totalMinutes / 60);
    const totalMinutesReste = totalMinutes % 60;
    const moyenneHeuresParJour =
      joursAvecHeures > 0
        ? Math.round((totalMinutes / joursAvecHeures / 60) * 10) / 10
        : 0;

    // Compter les annotations par code
    const annotationsCount: Record<string, number> = {};
    for (const p of plannings) {
      if (p.annotation?.code) {
        annotationsCount[p.annotation.code] =
          (annotationsCount[p.annotation.code] || 0) + 1;
      }
    }

    return NextResponse.json({
      // Infos de base
      id: employee.id,
      matricule: employee.matricule,
      nom: employee.nom,
      prenom: employee.prenom,
      poste: employee.poste,
      zone: employee.zone,
      created_at: employee.created_at,

      // Cycle de travail
      cycle: employee.cycles,

      // Statistiques
      statistiques: {
        presents: statutCount.P,
        absents: statutCount.A,
        repos: statutCount.R,
        total_jours: plannings.length,
        taux_presence: tauxPresence,
        total_heures: `${totalHeures}h${String(totalMinutesReste).padStart(2, "0")}`,
        moyenne_heures_jour: moyenneHeuresParJour,
        annotations: annotationsCount,
      },
    });
  } catch (error) {
    console.error("Erreur API employee:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

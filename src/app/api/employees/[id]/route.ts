// ─────────────────────────────────────────────────────────────
// app/api/employees/[id]/route.ts
// GET /api/employees/[id]
// → infos de base + statistiques complètes
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifySession } from "@/actions/permissions";

export async function GET(request: NextRequest, { params }: any) {
  try {
    const session = await verifySession();
    if (!session?.data?.user) {
      return NextResponse.json(
        { message: "Vous devez être connecté" },
        { status: 401 },
      );
    }
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

// ─── Helper cycle update ──────────────────────────────────────

function buildCycleUpdate(cycle: any) {
  if (!cycle || cycle.type === "unknown") {
    return {
      type: "unknown",
      est_manuel: false,
      rest_days: null,
      travail: null,
      repos: null,
      start_phase: 0,
    };
  }
  if (cycle.type === "weekly") {
    return {
      type: "weekly",
      est_manuel: true,
      rest_days: JSON.stringify(cycle.rest_days ?? []),
      travail: null,
      repos: null,
      start_phase: 0,
    };
  }
  return {
    type: cycle.type, // 'rotation' | 'night'
    est_manuel: true,
    rest_days: null,
    travail: Number(cycle.travail ?? 2),
    repos: Number(cycle.repos ?? 2),
    start_phase: Number(cycle.start_phase ?? 0),
  };
}

// ─────────────────────────────────────────────────────────────
// PATCH /api/employees/[id]
// body: { nom?, prenom?, poste?, zone?, cycle? }
// ─────────────────────────────────────────────────────────────
export async function PATCH(request: NextRequest, { params }: any) {
  try {
    const session = await verifySession();
    if (!session?.data?.user) {
      return NextResponse.json(
        { message: "Vous devez être connecté" },
        { status: 401 },
      );
    }
    const { id } = await params;
    const body = await request.json();
    const { nom, prenom, poste, zone, cycle } = body;

    const employee = await prisma.employee.findUnique({
      where: { id },
      include: { cycles: true },
    });
    if (!employee)
      return NextResponse.json(
        { error: "Employé non trouvé" },
        { status: 404 },
      );

    // Mettre à jour l'employé
    await prisma.employee.update({
      where: { id },
      data: {
        ...(nom !== undefined && { nom: nom || null }),
        ...(prenom !== undefined && { prenom: prenom || null }),
        ...(poste !== undefined && { poste: poste || null }),
        ...(zone !== undefined && { zone: zone || null }),
      },
    });

    // Mettre à jour le cycle si fourni
    if (cycle !== undefined) {
      const cycleData = buildCycleUpdate(cycle);
      if (employee.cycles) {
        await prisma.cycle.update({
          where: { employee_id: id },
          data: cycleData,
        });
      } else {
        await prisma.cycle.create({ data: { employee_id: id, ...cycleData } });
      }
    }

    const result = await prisma.employee.findUnique({
      where: { id },
      include: {
        cycles: true,
        _count: { select: { pointages: true, annotations: true } },
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("PATCH /employees/[id]:", error);
    return NextResponse.json(
      { error: "Erreur lors de la modification" },
      { status: 500 },
    );
  }
}

// ─────────────────────────────────────────────────────────────
// DELETE /api/employees/[id]
// ─────────────────────────────────────────────────────────────
export async function DELETE(request: NextRequest, { params }: any) {
  try {
    const session = await verifySession();
    if (!session?.data?.user) {
      return NextResponse.json(
        { message: "Vous devez être connecté" },
        { status: 401 },
      );
    }
    const { id } = await params;

    const employee = await prisma.employee.findUnique({ where: { id } });
    if (!employee)
      return NextResponse.json(
        { error: "Employé non trouvé" },
        { status: 404 },
      );

    await prisma.$transaction([
      prisma.modification_history.deleteMany({ where: { employee_id: id } }),
      prisma.planning.deleteMany({ where: { employee_id: id } }),
      prisma.annotation.deleteMany({ where: { employee_id: id } }),
      prisma.pointage.deleteMany({ where: { employee_id: id } }),
      prisma.cycle.deleteMany({ where: { employee_id: id } }),
      prisma.employee.delete({ where: { id } }),
    ]);

    return NextResponse.json({ deleted: 1 });
  } catch (error) {
    console.error("DELETE /employees/[id]:", error);
    return NextResponse.json(
      { error: "Erreur lors de la suppression" },
      { status: 500 },
    );
  }
}

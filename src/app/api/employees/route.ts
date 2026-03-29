// app/api/employees/route.ts

import { verifySession } from "@/actions/permissions";
import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

function getPeriodeDates(mois: number): { gte: Date; lte: Date } {
  const now = new Date();
  const gte = new Date(now);
  gte.setMonth(gte.getMonth() - mois);
  gte.setHours(0, 0, 0, 0);
  return { gte, lte: now };
}

// ─────────────────────────────────────────────────────────────
// GET /api/employees
//
// presence :
//   "1m"        → au moins 1 pointage dans les 30 derniers jours
//   "2m"        → au moins 1 pointage dans les 2 derniers mois
//   "3m"        → au moins 1 pointage dans les 3 derniers mois
//   "never"     → jamais de pointage
//   "absent_1m" → aucun pointage ce mois-ci
//   "absent_2m" → aucun pointage ces 2 derniers mois
//   "absent_3m" → aucun pointage ces 3 derniers mois
// ─────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const session = await verifySession();
    if (!session?.data?.user) {
      return NextResponse.json(
        { message: "Vous devez être connecté" },
        { status: 401 },
      );
    }
    const sp = request.nextUrl.searchParams;
    const search = sp.get("search") || "";
    const zone = sp.get("zone") || "";
    const page = parseInt(sp.get("page") || "1");
    const limit = parseInt(sp.get("limit") || "50000");
    const workspace_id = sp.get("workspace_id") || sp.get("workspaceId") || "";
    const presenceFilter = sp.get("presence") || "";
    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.OR = [
        { matricule: { contains: search } },
        { nom: { contains: search } },
        { prenom: { contains: search } },
        { poste: { contains: search } },
      ];
    }

    if (zone) where.zone = { contains: zone };
    if (workspace_id) where.workspace_id = workspace_id;

    // ── Filtre présence / absence ─────────────────────────
    if (presenceFilter && presenceFilter !== "all" && presenceFilter !== "") {
      if (presenceFilter === "never") {
        // Aucun pointage du tout
        where.pointages = { none: {} };
      } else if (presenceFilter.startsWith("absent_")) {
        // Absent sur la période = aucun pointage dans la période
        const nbMois =
          presenceFilter === "absent_1m"
            ? 1
            : presenceFilter === "absent_2m"
              ? 2
              : presenceFilter === "absent_3m"
                ? 3
                : null;

        if (nbMois) {
          const { gte, lte } = getPeriodeDates(nbMois);
          where.pointages = {
            none: {
              date: { gte, lte },
            },
          };
        }
      } else {
        // Présent sur la période = au moins 1 pointage dans la période
        const nbMois =
          presenceFilter === "1m"
            ? 1
            : presenceFilter === "2m"
              ? 2
              : presenceFilter === "3m"
                ? 3
                : null;

        if (nbMois) {
          const { gte, lte } = getPeriodeDates(nbMois);
          where.pointages = {
            some: {
              date: { gte, lte },
            },
          };
        }
      }
    }

    const [employees, total] = await Promise.all([
      prisma.employee.findMany({
        where,
        include: {
          cycles: true,
          _count: {
            select: {
              pointages: true,
              annotations: true,
            },
          },
        },
        orderBy: { matricule: "asc" },
        skip,
        take: limit,
      }),
      prisma.employee.count({ where }),
    ]);

    return NextResponse.json({
      data: employees,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("Erreur GET /employees:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des employés" },
      { status: 500 },
    );
  }
}

// ─────────────────────────────────────────────────────────────
// POST /api/employees — Créer un employé + cycle optionnel
// ─────────────────────────────────────────────────────────────
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
    const { matricule, nom, prenom, poste, zone, workspace_id, cycle } = body;

    if (!matricule?.trim()) {
      return NextResponse.json({ error: "Matricule requis" }, { status: 400 });
    }

    const existing = await prisma.employee.findFirst({
      where: { matricule: matricule.trim() },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Matricule déjà existant" },
        { status: 400 },
      );
    }

    const employee = await prisma.employee.create({
      data: {
        matricule: matricule.trim(),
        nom: nom || null,
        prenom: prenom || null,
        poste: poste || null,
        zone: zone || null,
        workspace_id,
        cycles: { create: buildCycleCreate(cycle) },
      },
      include: { cycles: true },
    });

    return NextResponse.json(employee, { status: 201 });
  } catch (error) {
    console.error("POST /employees:", error);
    return NextResponse.json(
      { error: "Erreur lors de la création" },
      { status: 500 },
    );
  }
}

// ─────────────────────────────────────────────────────────────
// DELETE /api/employees — Supprimer plusieurs employés
// body: { ids: string[] }
// ─────────────────────────────────────────────────────────────
export async function DELETE(request: NextRequest) {
  try {
    const session = await verifySession();
    if (!session?.data?.user) {
      return NextResponse.json(
        { message: "Vous devez être connecté" },
        { status: 401 },
      );
    }
    const body = await request.json();
    const { ids } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "ids[] requis" }, { status: 400 });
    }

    await prisma.$transaction([
      prisma.modification_history.deleteMany({
        where: { employee_id: { in: ids } },
      }),
      prisma.planning.deleteMany({ where: { employee_id: { in: ids } } }),
      prisma.annotation.deleteMany({ where: { employee_id: { in: ids } } }),
      prisma.pointage.deleteMany({ where: { employee_id: { in: ids } } }),
      prisma.cycle.deleteMany({ where: { employee_id: { in: ids } } }),
      prisma.employee.deleteMany({ where: { id: { in: ids } } }),
    ]);

    return NextResponse.json({ deleted: ids.length });
  } catch (error) {
    console.error("DELETE /employees:", error);
    return NextResponse.json(
      { error: "Erreur lors de la suppression" },
      { status: 500 },
    );
  }
}

// ─── Helper cycle create ──────────────────────────────────────

function buildCycleCreate(cycle?: any) {
  if (!cycle || !cycle.type || cycle.type === "unknown") {
    return { type: "unknown", est_manuel: false };
  }
  if (cycle.type === "weekly") {
    return {
      type: "weekly",
      est_manuel: true,
      rest_days: JSON.stringify(cycle.rest_days ?? []),
    };
  }
  return {
    type: cycle.type,
    est_manuel: true,
    travail: Number(cycle.travail ?? 2),
    repos: Number(cycle.repos ?? 2),
    start_phase: Number(cycle.start_phase ?? 0),
  };
}

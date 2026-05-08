// app/api/employees/route.ts

import {
  verifySession,
  withAuthorizationPermission,
} from "@/actions/permissions";
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

    const hasPermissionAdd = await withAuthorizationPermission([
      "view_employe",
    ]);
    if (
      hasPermissionAdd.status != 200 ||
      !hasPermissionAdd.data.hasPermission
    ) {
      return NextResponse.json(
        { message: "Vous n'avez pas la permission de voir les employés" },
        { status: 403 },
      );
    }

    const sp = request.nextUrl.searchParams;
    const search = sp.get("search") || "";
    const zone_id = sp.get("zone") || sp.get("zone_id") || "";
    const departmenet_id = sp.get("departmenet_id") || "";

    // ── NOUVEAU: Filtre active (par défaut à "true") ──
    const activeFilter = sp.get("active") || "true";

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

    if (workspace_id) where.workspace_id = workspace_id;
    if (departmenet_id) where.departmenet_id = departmenet_id;

    // Application du filtre active
    if (activeFilter !== "all") {
      where.active = activeFilter === "true"; // Devient true ou false selon la valeur
    }

    // Filtre par zone via la table de liaison zone_employe
    if (zone_id) {
      where.zoneEmployes = {
        some: {
          zone_id: zone_id,
        },
      };
    }

    // ── Filtre présence / absence ─────────────────────────
    if (presenceFilter && presenceFilter !== "all" && presenceFilter !== "") {
      if (presenceFilter === "never") {
        where.pointages = { none: {} };
      } else if (presenceFilter.startsWith("absent_")) {
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
          departmenet: true,
          zoneEmployes: {
            include: {
              zone: true,
            },
          },
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
// POST /api/employees — Créer un employé + cycle + relations
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

    const hasPermissionAdd = await withAuthorizationPermission(["add_employe"]);

    if (
      hasPermissionAdd.status != 200 ||
      !hasPermissionAdd.data.hasPermission
    ) {
      return NextResponse.json(
        { message: "Vous n'avez pas la permission d'ajouter un employé" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const {
      matricule,
      nom,
      prenom,
      poste,
      active, // Optionnel, Prisma le met à true par défaut
      departmenet_id,
      zone_ids,
      workspace_id,
      cycle,
    } = body;

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
        active: active !== undefined ? active : true, // Prise en compte ici aussi
        workspace_id,
        departmenet_id: departmenet_id || null,
        cycles: { create: buildCycleCreate(cycle) },
        ...(zone_ids && Array.isArray(zone_ids) && zone_ids.length > 0
          ? {
              zoneEmployes: {
                create: zone_ids.map((id: string) => ({ zone_id: id })),
              },
            }
          : {}),
      },
      include: {
        cycles: true,
        departmenet: true,
        zoneEmployes: { include: { zone: true } },
      },
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
      prisma.zone_employe.deleteMany({ where: { employee_id: { in: ids } } }),
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

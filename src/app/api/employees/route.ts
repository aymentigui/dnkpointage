import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// GET /api/employees - Liste des employés avec filtres
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search") || "";
    const zone = searchParams.get("zone") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50000");
    const workspace_id = searchParams.get("workspace_id") || "";
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

    if (zone) {
      where.zone = { contains: zone };
    }

    if (workspace_id) {
      where.workspace_id = workspace_id;
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
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Erreur lors de la récupération des employés" },
      { status: 500 },
    );
  }
}

// POST /api/employees - Créer un nouvel employé
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { matricule, nom, prenom, poste, zone, workspace_id } = body;

    // Vérifier si l'employé existe déjà
    const existing = await prisma.employee.findFirst({
      where: { matricule },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Un employé avec ce matricule existe déjà" },
        { status: 400 },
      );
    }

    const employee = await prisma.employee.create({
      data: {
        matricule,
        nom,
        prenom,
        poste,
        zone,
        workspace_id,
        // Créer un cycle par défaut
        cycles: {
          create: {
            type: "unknown",
            est_manuel: false,
          },
        },
      },
      include: { cycles: true },
    });

    return NextResponse.json(employee, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Erreur lors de la création de l'employé" },
      { status: 500 },
    );
  }
}

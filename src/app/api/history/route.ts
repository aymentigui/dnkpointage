import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/history - Historique global des modifications
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const employeeId = searchParams.get("employeeId");
    const dateDebut = searchParams.get("debut");
    const dateFin = searchParams.get("fin");
    const type = searchParams.get("type"); // 'base', 'annotation', 'cycle'
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const skip = (page - 1) * limit;

    const where: any = {};

    if (employeeId) {
      where.employeeId = employeeId;
    }

    if (type) {
      where.typeModification = type;
    }

    if (dateDebut || dateFin) {
      where.date = {};
      if (dateDebut) where.date.gte = new Date(dateDebut);
      if (dateFin) where.date.lte = new Date(dateFin);
    }

    const [history, total] = await Promise.all([
      prisma.modification_history.findMany({
        where,
        include: {
          employee: {
            select: {
              matricule: true,
              nom: true,
              prenom: true,
            },
          },
        },
        orderBy: { created_at: "desc" },
        skip,
        take: limit,
      }),
      prisma.modification_history.count({ where }),
    ]);

    // Statistiques par type
    const stats = await prisma.modification_history.groupBy({
      by: ["type_modification"],
      where,
      _count: true,
    });

    // Timeline (derniers 30 jours)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const timeline = await prisma.modification_history.groupBy({
      by: ["created_at"],
      where: {
        ...where,
        created_at: { gte: thirtyDaysAgo },
      },
      _count: true,
    });

    return NextResponse.json({
      data: history,
      stats: stats.reduce(
        (acc, s) => ({ ...acc, [s.type_modification]: s._count }),
        {},
      ),
      timeline: timeline.map((t) => ({
        date: t.created_at.toISOString().split("T")[0],
        count: t._count,
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Erreur lors de la récupération de l'historique" },
      { status: 500 },
    );
  }
}

// POST /api/history - Ajouter une entrée d'historique (interne)
export async function POST(request: NextRequest) {
  // Cette route est principalement utilisée par d'autres APIs
  try {
    const body = await request.json();
    const {
      employeeId,
      date,
      typeModification,
      ancienStatut,
      nouveauStatut,
      description,
    } = body;

    const history = await prisma.modification_history.create({
      data: {
        employee_id: employeeId,
        date: new Date(date),
        type_modification: typeModification,
        ancien_statut: ancienStatut,
        nouveau_statut: nouveauStatut,
        description,
      },
    });

    return NextResponse.json(history, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Erreur lors de la création" },
      { status: 500 },
    );
  }
}

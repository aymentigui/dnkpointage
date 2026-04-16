import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/jours-feries
// ?workspace_id=xxx (اختياري)
// ?date=2025-06-06 (تشوف إذا يوم معين فيه عيد)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const workspace_id = searchParams.get("workspace_id");
    const date = searchParams.get("date");

    // إذا بغى يتحقق من يوم معين
    if (date) {
      const targetDate = new Date(date);
      const jourFerie = await prisma.jour_ferie.findFirst({
        where: {
          date_debut: { lte: targetDate },
          date_fin: { gte: targetDate },
          ...(workspace_id ? { workspace_id } : {}),
        },
      });

      return NextResponse.json({
        is_ferie: !!jourFerie,
        jour_ferie: jourFerie ?? null,
      });
    }

    // GET ALL
    const jours = await prisma.jour_ferie.findMany({
      where: {
        ...(workspace_id ? { workspace_id } : {}),
      },
      orderBy: { date_debut: "asc" },
    });

    return NextResponse.json({ data: jours });
  } catch (error) {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// POST /api/jours-feries
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      nom,
      date_debut,
      date_fin,
      workspace_id,
      recurrent,
      type,
      description,
    } = body;

    // Validation
    if (!nom || !date_debut) {
      return NextResponse.json(
        { error: "nom et date_debut sont obligatoires" },
        { status: 400 },
      );
    }

    const jour = await prisma.jour_ferie.create({
      data: {
        nom,
        date_debut: new Date(date_debut),
        date_fin: date_fin ? new Date(date_fin) : new Date(date_debut), // إذا ما عطاش date_fin = يوم واحد
        workspace_id: workspace_id ?? null,
        recurrent: recurrent ?? false,
        type: type ?? null,
        description: description ?? null,
      },
    });

    return NextResponse.json({ data: jour }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

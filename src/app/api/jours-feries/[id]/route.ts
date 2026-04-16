import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/jours-feries/:id
export async function GET(req: NextRequest, { params }: any) {
  try {
    const { id } = await params;
    const jour = await prisma.jour_ferie.findUnique({
      where: { id: params.id },
    });

    if (!jour) {
      return NextResponse.json({ error: "Non trouvé" }, { status: 404 });
    }

    return NextResponse.json({ data: jour });
  } catch (error) {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// PUT /api/jours-feries/:id
export async function PUT(req: NextRequest, { params }: any) {
  try {
    const { id } = await params;
    const body = await req.json();
    const {
      nom,
      date_debut,
      date_fin,
      recurrent,
      type,
      description,
      workspace_id,
    } = body;

    const exists = await prisma.jour_ferie.findUnique({
      where: { id: id },
    });

    if (!exists) {
      return NextResponse.json({ error: "Non trouvé" }, { status: 404 });
    }

    const updated = await prisma.jour_ferie.update({
      where: { id: id },
      data: {
        ...(nom && { nom }),
        ...(date_debut && { date_debut: new Date(date_debut) }),
        ...(date_fin && { date_fin: new Date(date_fin) }),
        ...(recurrent !== undefined && { recurrent }),
        ...(type !== undefined && { type }),
        ...(description !== undefined && { description }),
        ...(workspace_id !== undefined && { workspace_id }),
      },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// DELETE /api/jours-feries/:id
export async function DELETE(req: NextRequest, { params }: any) {
  try {
    const { id } = await params;
    const exists = await prisma.jour_ferie.findUnique({
      where: { id: id },
    });

    if (!exists) {
      return NextResponse.json({ error: "Non trouvé" }, { status: 404 });
    }

    await prisma.jour_ferie.delete({
      where: { id: id },
    });

    return NextResponse.json({ message: "Supprimé avec succès" });
  } catch (error) {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

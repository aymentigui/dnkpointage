import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifySession } from "@/actions/permissions";

// GET /api/workspaces - Liste des workspaces
export async function GET() {
  try {
    const session = await verifySession();
    if (!session?.data?.user) {
      return NextResponse.json(
        { message: "Vous devez être connecté" },
        { status: 401 },
      );
    }
    const workspaces = await prisma.workspace.findMany({
      orderBy: { updated_at: "desc" },
    });
    return NextResponse.json(workspaces);
  } catch (error) {
    return NextResponse.json(
      { error: "Erreur lors de la récupération" },
      { status: 500 },
    );
  }
}

// POST /api/workspaces - Créer un workspace
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
    const { nom } = body;

    const workspace = await prisma.workspace.create({
      data: { nom },
    });

    return NextResponse.json(workspace, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Erreur lors de la création" },
      { status: 500 },
    );
  }
}

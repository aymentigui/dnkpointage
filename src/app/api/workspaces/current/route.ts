import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { cookies } from "next/headers";
import { verifySession } from "@/actions/permissions";

// GET /api/workspaces/current - Récupérer le workspace actif
export async function GET() {
  try {
    const session = await verifySession();
    if (!session?.data?.user) {
      return NextResponse.json(
        { message: "Vous devez être connecté" },
        { status: 401 },
      );
    }
    const cookieStore = await cookies();
    const currentId = cookieStore.get("currentWorkspace")?.value;

    if (!currentId) {
      return NextResponse.json({ workspace: null });
    }

    const workspace = await prisma.workspace.findUnique({
      where: { id: currentId },
    });

    return NextResponse.json({ workspace });
  } catch (error) {
    return NextResponse.json(
      { error: "Erreur lors de la récupération" },
      { status: 500 },
    );
  }
}

// POST /api/workspaces/current - Définir le workspace actif
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
    const { workspaceId } = body;

    if (!workspaceId) {
      return NextResponse.json(
        { error: "workspaceId requis" },
        { status: 400 },
      );
    }

    // Vérifier que le workspace existe
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      return NextResponse.json(
        { error: "Workspace non trouvé" },
        { status: 404 },
      );
    }

    // Set cookie
    const cookieStore = await cookies();
    cookieStore.set("currentWorkspace", workspaceId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 jours
    });

    return NextResponse.json({ success: true, workspace });
  } catch (error) {
    return NextResponse.json(
      { error: "Erreur lors de la définition" },
      { status: 500 },
    );
  }
}

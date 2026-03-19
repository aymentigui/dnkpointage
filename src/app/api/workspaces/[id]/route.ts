import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifySession } from "@/actions/permissions";

interface Params {
  params: {
    id: string;
  };
}

// GET /api/workspaces/[id] - Détail d'un workspace
export async function GET(request: NextRequest, { params }: any) {
  try {
    const paramsId = await params;
    const { id } = paramsId;

    const workspace = await prisma.workspace.findUnique({
      where: { id },
    });

    if (!workspace) {
      return NextResponse.json(
        { error: "Workspace non trouvé" },
        { status: 404 },
      );
    }

    return NextResponse.json(workspace);
  } catch (error) {
    return NextResponse.json(
      { error: "Erreur lors de la récupération" },
      { status: 500 },
    );
  }
}

// PUT /api/workspaces/[id] - Modifier un workspace
export async function PUT(request: NextRequest, { params }: any) {
  try {
    const paramsId = await params;
    const { id } = paramsId;
    const body = await request.json();
    const { nom } = body;

    const workspace = await prisma.workspace.update({
      where: { id },
      data: { nom },
    });

    return NextResponse.json(workspace);
  } catch (error) {
    return NextResponse.json(
      { error: "Erreur lors de la modification" },
      { status: 500 },
    );
  }
}

// DELETE /api/workspaces/[id] - Supprimer un workspace
export async function DELETE(request: NextRequest, { params }: any) {
  try {
    const session = await verifySession();

    if (!session) {
      return NextResponse.json({ error: "Session expirée" }, { status: 401 });
    }

    if (!session.data.user.is_admin) {
      return NextResponse.json(
        { error: "Vous n'avez pas les droits pour effectuer cette action" },
        { status: 403 },
      );
    }

    const paramsId = await params;
    const { id } = paramsId;

    // ── 1. Trouver le workspace ──────────────────────────────

    const workspace = await prisma.workspace.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!workspace) {
      return NextResponse.json(
        { error: "Workspace non trouvé" },
        { status: 404 },
      );
    }

    const workspaceId = workspace.id;

    // ── 2. supprimer tous les enregistrements liés au workspace ──────────────────────
    await prisma.cycle.deleteMany({
      where: { employee: { workspace_id: workspaceId } },
    });
    await prisma.planning.deleteMany({
      where: { employee: { workspace_id: workspaceId } },
    });
    await prisma.annotation.deleteMany({
      where: { employee: { workspace_id: workspaceId } },
    });

    await prisma.pointage.deleteMany({
      where: { employee: { workspace_id: workspaceId } },
    });

    await prisma.modification_history.deleteMany({
      where: { employee: { workspace_id: workspaceId } },
    });

    await prisma.employee.deleteMany({ where: { workspace_id: workspaceId } });

    // ── 3. supprimer le workspace ───────────────────────────────
    await prisma.workspace.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Workspace supprimé" });
  } catch (error) {
    return NextResponse.json(
      { error: "Erreur lors de la suppression" },
      { status: 500 },
    );
  }
}

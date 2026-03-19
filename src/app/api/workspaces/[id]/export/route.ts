import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest, { params }: any) {
  try {
    const paramsId = await params;
    const { id } = paramsId;
    const format = request.nextUrl.searchParams.get("format") || "json";

    // Récupérer toutes les données du workspace
    const workspace = await prisma.workspace.findUnique({
      where: { id },
    });

    if (format === "json") {
      return NextResponse.json(workspace);
    }

    // Export Excel via l'API existante
    return NextResponse.redirect(`/api/export/excel?workspace_id=${id}`);
  } catch (error) {
    return NextResponse.json(
      { error: "Erreur lors de l'export" },
      { status: 500 },
    );
  }
}

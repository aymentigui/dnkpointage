// /api/workspaces/[id]/departements/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest, { params }: any) {
  try {
    const { id } = await params;
    const departements = await prisma.departmenet.findMany({
      where: {
        workspace_id: id,
      },
    });
    return NextResponse.json(departements);
  } catch (error) {
    console.error("Error fetching zones:", error);
    return NextResponse.json(
      { error: "Failed to fetch zones" },
      { status: 500 },
    );
  }
}

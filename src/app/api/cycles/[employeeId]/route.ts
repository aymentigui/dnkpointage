import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// PUT /api/cycles/[employeeId] - Mettre à jour le cycle (manuel)
export async function PUT(request: NextRequest, { params }: any) {
  try {
    const paramsId = await params;
    const { employeeId } = paramsId;
    const body = await request.json();
    const { type, rest_days, travail, repos, start_phase } = body;

    const cycle = await prisma.cycle.findUnique({
      where: { employee_id: employeeId },
    });

    if (!cycle) {
      return NextResponse.json({ error: "Cycle non trouvé" }, { status: 404 });
    }
    console.log(body);
    const updated = await prisma.cycle.update({
      where: { employee_id: employeeId },
      data: {
        type,
        rest_days: rest_days ? JSON.stringify(rest_days) : cycle.rest_days,
        travail: travail !== undefined ? travail : cycle.travail,
        repos: repos !== undefined ? repos : cycle.repos,
        start_phase:
          start_phase !== undefined ? start_phase : cycle.start_phase,
        est_manuel: true, // Forcer manuel
      },
    });
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
    });
    // Recalculer le planning avec le nouveau cycle
    await fetch(`${process.env.DOMAIN_URL}/api/cycles/detect`, {
      method: "POST",
      body: JSON.stringify({ matricule: employee?.matricule }),
    });

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour" },
      { status: 500 },
    );
  }
}

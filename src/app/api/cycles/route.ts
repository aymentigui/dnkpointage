import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// POST /api/cycles - Créer un cycle (rare, généralement via détection)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { employeeId, type, restDays, travail, repos, start_phase } = body;

    // Vérifier si l'employé existe
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee) {
      return NextResponse.json(
        { error: "Employé non trouvé" },
        { status: 404 },
      );
    }

    // Vérifier si un cycle existe déjà
    const existing = await prisma.cycle.findUnique({
      where: { employee_id: employeeId },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Un cycle existe déjà pour cet employé" },
        { status: 400 },
      );
    }

    const cycle = await prisma.cycle.create({
      data: {
        employee_id: employeeId,
        type,
        rest_days: restDays ? JSON.stringify(restDays) : null,
        travail,
        repos,
        start_phase: start_phase || 0,
        est_manuel: true,
      },
    });

    return NextResponse.json(cycle, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Erreur lors de la création" },
      { status: 500 },
    );
  }
}

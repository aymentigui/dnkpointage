import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifySession } from "@/actions/permissions";

// GET /api/history/employee/[employeeId] - Historique d'un employé spécifique
export async function GET(request: NextRequest, { params }: any) {
  try {
    const session = await verifySession();
    if (!session?.data?.user) {
      return NextResponse.json(
        { message: "Vous devez être connecté" },
        { status: 401 },
      );
    }
    const paramsId = await params;
    const { employeeId } = paramsId;
    const searchParams = request.nextUrl.searchParams;
    const dateDebut = searchParams.get("debut");
    const dateFin = searchParams.get("fin");
    const type = searchParams.get("type");
    const limit = parseInt(searchParams.get("limit") || "100");
    // Vérifier employé
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee) {
      return NextResponse.json(
        { error: "Employé non trouvé" },
        { status: 404 },
      );
    }

    const where: any = { employee_id: employeeId };

    if (type) {
      where.type_modification = type;
    }

    if (dateDebut || dateFin) {
      where.date = {};
      if (dateDebut) where.date.gte = new Date(dateDebut);
      if (dateFin) where.date.lte = new Date(dateFin);
    }

    const history = await prisma.modification_history.findMany({
      where,
      orderBy: { created_at: "desc" },
      take: limit,
    });

    // Statistiques par type pour cet employé
    const stats = await prisma.modification_history.groupBy({
      by: ["type_modification"],
      where: { employee_id: employeeId },
      _count: true,
    });

    // Modifications par jour (graph)
    const parJour = history.reduce(
      (acc, h) => {
        const jour = h.created_at.toISOString().split("T")[0];
        if (!acc[jour]) acc[jour] = 0;
        acc[jour]++;
        return acc;
      },
      {} as Record<string, number>,
    );

    // Dernière modification
    const lastModif = history[0];
    return NextResponse.json({
      employee: {
        id: employee.id,
        matricule: employee.matricule,
        nom: employee.nom,
        prenom: employee.prenom,
      },
      stats: stats.reduce(
        (acc, s) => ({ ...acc, [s.type_modification]: s._count }),
        {},
      ),
      total: history.length,
      dernierChangement: lastModif,
      parJour: Object.entries(parJour).map(([date, count]) => ({
        date,
        count,
      })),
      historique: history,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Erreur lors de la récupération" },
      { status: 500 },
    );
  }
}

// DELETE /api/history/employee/[employeeId] - Effacer l'historique d'un employé
export async function DELETE(request: NextRequest, { params }: any) {
  try {
    const session = await verifySession();
    if (!session?.data?.user) {
      return NextResponse.json(
        { message: "Vous devez être connecté" },
        { status: 401 },
      );
    }
    const paramsId = await params;
    const { employeeId } = paramsId;

    // Vérifier employé
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee) {
      return NextResponse.json(
        { error: "Employé non trouvé" },
        { status: 404 },
      );
    }

    const { count } = await prisma.modification_history.deleteMany({
      where: { employee_id: employeeId },
    });

    return NextResponse.json({
      message: `Historique effacé (${count} entrées)`,
      count,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Erreur lors de la suppression" },
      { status: 500 },
    );
  }
}

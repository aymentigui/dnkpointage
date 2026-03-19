// app/api/workspaces/[id]/filters/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifySession } from "@/actions/permissions";

export async function GET(request: NextRequest, { params }: any) {
  try {
    const session = await verifySession();
    if (!session?.data?.user) {
      return NextResponse.json(
        { message: "Vous devez être connecté" },
        { status: 401 },
      );
    }

    const { id } = await params;

    // Vérifier que le workspace existe
    const workspace = await prisma.workspace.findUnique({
      where: { id },
    });

    if (!workspace) {
      return NextResponse.json(
        { error: "Espace de travail non trouvé" },
        { status: 404 },
      );
    }

    // Récupérer tous les employés du workspace
    const employees = await prisma.employee.findMany({
      where: { workspace_id: id },
      select: {
        id: true,
        matricule: true,
        nom: true,
        prenom: true,
      },
      orderBy: [{ nom: "asc" }, { prenom: "asc" }],
    });

    // Récupérer tous les utilisateurs qui ont fait des modifications
    // Récupérer d'abord tous les created_by uniques depuis modification_history
    const historyUsers = await prisma.modification_history.findMany({
      where: {
        employee: { workspace_id: id },
        created_by: { not: null },
      },
      select: { created_by: true },
      distinct: ["created_by"],
    });

    const userIds = historyUsers
      .map((h) => h.created_by)
      .filter((id): id is string => id !== null);

    // Récupérer les détails des utilisateurs
    const users =
      userIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: userIds } },
            select: {
              id: true,
              firstname: true,
              lastname: true,
              username: true,
              email: true,
            },
            orderBy: [{ lastname: "asc" }, { firstname: "asc" }],
          })
        : [];

    // Formater les utilisateurs pour l'affichage
    const formattedUsers = users.map((u) => ({
      id: u.id,
      name:
        [u.firstname, u.lastname].filter(Boolean).join(" ") ||
        u.username ||
        u.email ||
        u.id,
    }));

    return NextResponse.json({
      workspace,
      employees: employees.map((e) => ({
        id: e.id,
        label: `${e.matricule} - ${e.prenom || ""} ${e.nom || ""}`.trim(),
        matricule: e.matricule,
        nom: e.nom,
        prenom: e.prenom,
      })),
      users: formattedUsers,
    });
  } catch (error) {
    console.error("Erreur API filtres workspace:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

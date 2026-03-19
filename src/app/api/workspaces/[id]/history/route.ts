// app/api/workspaces/[id]/history/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifySession } from "@/actions/permissions";
import { Prisma } from "@prisma/client";

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
    const searchParams = request.nextUrl.searchParams;

    // Récupérer les paramètres de filtre
    const employeeId = searchParams.get("employeeId");
    const userId = searchParams.get("userId");
    const dateDebut = searchParams.get("dateDebut");
    const dateFin = searchParams.get("dateFin");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const skip = (page - 1) * limit;

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

    // Construire la condition WHERE
    const where: Prisma.modification_historyWhereInput = {
      employee: { workspace_id: id },
    };

    if (employeeId) {
      where.employee_id = employeeId;
    }

    if (userId) {
      where.created_by = userId;
    }

    if (dateDebut || dateFin) {
      where.date = {};
      if (dateDebut) where.date.gte = new Date(dateDebut);
      if (dateFin) where.date.lte = new Date(dateFin);
    }

    // Récupérer le total pour la pagination
    const total = await prisma.modification_history.count({ where });

    // Récupérer les historiques avec pagination
    const histories = await prisma.modification_history.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            matricule: true,
            nom: true,
            prenom: true,
          },
        },
      },
      orderBy: { created_at: "desc" },
      skip,
      take: limit,
    });

    // Récupérer les infos des utilisateurs
    const userIds = [
      ...new Set(
        histories
          .map((h) => h.created_by)
          .filter((id): id is string => id !== null),
      ),
    ];

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
          })
        : [];

    const userMap = new Map(users.map((u) => [u.id, u]));

    const getUserName = (userId: string | null) => {
      if (!userId) return "Système";
      const u = userMap.get(userId);
      if (!u) return userId;
      return (
        [u.firstname, u.lastname].filter(Boolean).join(" ") ||
        u.username ||
        u.email ||
        userId
      );
    };

    // Formater les résultats
    const formattedHistories = histories.map((h) => ({
      id: h.id,
      date: h.date,
      employee: {
        id: h.employee.id,
        matricule: h.employee.matricule,
        nom: h.employee.nom,
        prenom: h.employee.prenom,
        label:
          `${h.employee.matricule} - ${h.employee.prenom || ""} ${h.employee.nom || ""}`.trim(),
      },
      ancien_statut: h.ancien_statut,
      nouveau_statut: h.nouveau_statut,
      type_modification: h.type_modification,
      description: h.description,
      modifie_par: getUserName(h.created_by),
      modifie_par_id: h.created_by,
      modifie_le: h.created_at,
    }));

    // Calculer les statistiques
    const stats = {
      total_modifications: total,
      par_type: {
        base: histories.filter((h) => h.type_modification === "base").length,
        annotation: histories.filter(
          (h) => h.type_modification === "annotation",
        ).length,
        cycle: histories.filter((h) => h.type_modification === "cycle").length,
      },
    };

    return NextResponse.json({
      histories: formattedHistories,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
      stats,
    });
  } catch (error) {
    console.error("Erreur API historique workspace:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

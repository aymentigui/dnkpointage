// app/api/sorties/route.ts
import { NextResponse } from "next/server";
import { canManageEmployee } from "@/actions/auth/auth";
import {
  verifySession,
  withAuthorizationPermission,
} from "@/actions/permissions";
import { prisma } from "@/lib/db";

// Fonction pour valider et parser les heures
function parseHeure(heure: string): Date | null {
  if (!heure) return null;
  // Format attendu: "HH:MM"
  const [hours, minutes] = heure.split(":");
  const date = new Date();
  date.setUTCHours(parseInt(hours), parseInt(minutes), 0, 0);
  return date;
}

export async function GET(req: Request) {
  try {
    const session = await verifySession();
    if (!session?.data?.user)
      return NextResponse.json({ message: "Non autorisé" }, { status: 401 });

    const hasPerm = await withAuthorizationPermission(["sortie_view"]);
    if (hasPerm.status !== 200 || !hasPerm.data.hasPermission) {
      return NextResponse.json(
        { message: "Permission refusée" },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit =
      searchParams.get("limit") === "Tous"
        ? "Tous"
        : parseInt(searchParams.get("limit") || "10");
    const skip = limit !== "Tous" ? (page - 1) * limit : undefined;

    // Filtres
    const employeeId = searchParams.get("employeeId");
    const dateDebut = searchParams.get("dateDebut");
    const dateFin = searchParams.get("dateFin");
    const motif = searchParams.get("motif");
    const direction = searchParams.get("direction");
    const sansRetour = searchParams.get("sansRetour") === "true";

    const whereClause: any = {
      employee: {
        OR: [
          { userManagedEmployees: { some: { user_id: session.data.user.id } } },
          {
            departmenet: {
              userManagedDepartmenets: {
                some: { user_id: session.data.user.id },
              },
            },
          },
        ],
      },
    };

    if (employeeId) whereClause.employee_id = employeeId;
    if (motif) whereClause.motif = { contains: motif };
    if (direction) whereClause.direction = { contains: direction };
    if (sansRetour) whereClause.heure_entree = null;

    // Filtrage par date
    if (dateDebut) {
      const d = new Date(dateDebut);
      whereClause.date = { gte: d, lt: new Date(d.getTime() + 86400000) };
    }
    if (dateFin) {
      const d = new Date(dateFin);
      whereClause.date = { ...whereClause.date, lte: d };
    }

    const sorties = await prisma.sortie.findMany({
      where: whereClause,
      include: {
        employee: {
          select: {
            nom: true,
            prenom: true,
            matricule: true,
            departmenet: true,
            poste: true,
            zoneEmployes: {
              include: {
                zone: true,
              },
            },
          },
        },
      },
      skip: skip,
      take: limit !== "Tous" ? limit : undefined,
      orderBy: { created_at: "desc" },
    });

    const total = await prisma.sortie.count({ where: whereClause });

    return NextResponse.json({
      sorties,
      total,
      pages: limit === "Tous" ? 1 : Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Erreur GET sorties:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await verifySession();
    if (!session?.data?.user)
      return NextResponse.json({ message: "Non autorisé" }, { status: 401 });

    const hasPerm = await withAuthorizationPermission(["sortie_create"]);
    if (hasPerm.status !== 200 || !hasPerm.data.hasPermission) {
      return NextResponse.json(
        { message: "Permission refusée" },
        { status: 403 },
      );
    }

    const body = await req.json();
    const {
      numero,
      employee_id,
      direction,
      date,
      heure_sortie,
      heure_entree,
      motif,
    } = body;

    // Validation des heures
    if (
      !heure_sortie ||
      !heure_sortie.match(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/)
    ) {
      return NextResponse.json(
        { error: "Format d'heure de sortie invalide. Utilisez HH:MM" },
        { status: 400 },
      );
    }

    if (
      heure_entree &&
      !heure_entree.match(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/)
    ) {
      return NextResponse.json(
        { error: "Format d'heure d'entrée invalide. Utilisez HH:MM" },
        { status: 400 },
      );
    }

    const isAuthorized = await canManageEmployee(
      session.data.user.id,
      employee_id,
    );
    if (!isAuthorized) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    await prisma.$transaction(async (tx) => {
      const sortie = await tx.sortie.create({
        data: {
          numero,
          employee_id,
          direction: direction || null,
          date: new Date(date),
          heure_sortie,
          heure_entree: heure_entree || null,
          motif,
          created_by: session.data.user.id,
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erreur POST sortie:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

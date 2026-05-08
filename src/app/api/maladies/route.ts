// app/api/maladies/route.ts
import { NextResponse } from "next/server";
import { canManageEmployee } from "@/actions/auth/auth";
import {
  verifySession,
  withAuthorizationPermission,
} from "@/actions/permissions";
import { prisma } from "@/lib/db";

// Fonction pour générer les dates entre deux dates (inclusif)
function getDatesBetween(startDate: Date, endDate: Date): Date[] {
  const dates = [];
  let current = new Date(startDate);
  current.setUTCHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setUTCHours(0, 0, 0, 0);

  // Inclure la date de fin
  while (current <= end) {
    dates.push(new Date(current));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

// Fonction pour générer les dates de maladie
function getMaladieDates(
  dateDebut: Date,
  duree: number,
  dateRetour?: Date | null,
): Date[] {
  if (dateRetour) {
    const endDate = new Date(dateRetour);
    endDate.setUTCDate(endDate.getUTCDate() - 1); // <-- dateRetour - 1
    return getDatesBetween(dateDebut, endDate);
  } else {
    const endDate = new Date(dateDebut);
    endDate.setUTCDate(endDate.getUTCDate() + duree - 1);
    return getDatesBetween(dateDebut, endDate);
  }
}

// Fonction pour créer les annotations de maladie
async function createMaladieAnnotations(
  tx: any,
  employee_id: string,
  dateDebut: Date,
  duree: number,
  dateRetour: Date | null | undefined,
  type_maladie: string | null,
  created_by: string,
) {
  const dates = getMaladieDates(dateDebut, duree, dateRetour);

  if (dates.length > 0) {
    const libelle = `Maladie${type_maladie ? ` (${type_maladie})` : ""}`;

    await tx.annotation.createMany({
      data: dates.map((d) => ({
        employee_id,
        code: "Md",
        libelle: libelle,
        date: d,
        created_by: created_by,
      })),
      skipDuplicates: true,
    });
  }

  return dates.length;
}

// Fonction pour supprimer les annotations de maladie
async function deleteMaladieAnnotations(
  tx: any,
  employee_id: string,
  dateDebut: Date,
  duree: number,
  dateRetour?: Date | null,
) {
  const dates = getMaladieDates(dateDebut, duree, dateRetour);

  if (dates.length > 0) {
    await tx.annotation.deleteMany({
      where: {
        employee_id: employee_id,
        code: "Md",
        date: { in: dates },
      },
    });
  }
}

export async function GET(req: Request) {
  try {
    const session = await verifySession();
    if (!session?.data?.user)
      return NextResponse.json({ message: "Non autorisé" }, { status: 401 });

    const hasPerm = await withAuthorizationPermission(["maladie_view"]);
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
    const type_maladie = searchParams.get("type_maladie");
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
    if (type_maladie) whereClause.type_maladie = { contains: type_maladie };
    if (sansRetour) whereClause.date_retour = null;

    // Filtrage par date
    if (dateDebut) {
      const d = new Date(dateDebut);
      whereClause.date = { gte: d, lt: new Date(d.getTime() + 86400000) };
    }
    if (dateFin) {
      const d = new Date(dateFin);
      whereClause.date = { ...whereClause.date, lte: d };
    }

    const maladies = await prisma.maladie.findMany({
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

    const total = await prisma.maladie.count({ where: whereClause });

    return NextResponse.json({
      maladies,
      total,
      pages: limit === "Tous" ? 1 : Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Erreur GET maladies:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await verifySession();
    if (!session?.data?.user)
      return NextResponse.json({ message: "Non autorisé" }, { status: 401 });

    const hasPerm = await withAuthorizationPermission(["maladie_create"]);
    if (hasPerm.status !== 200 || !hasPerm.data.hasPermission) {
      return NextResponse.json(
        { message: "Permission refusée" },
        { status: 403 },
      );
    }

    const body = await req.json();
    const {
      employee_id,
      date,
      duree,
      date_retour,
      type_maladie,
      caisse_assurance,
    } = body;

    // Validation
    if (!employee_id || !date || !duree || !caisse_assurance) {
      return NextResponse.json(
        { error: "Champs requis manquants" },
        { status: 400 },
      );
    }

    if (duree <= 0) {
      return NextResponse.json(
        { error: "La durée doit être supérieure à 0" },
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
      const maladie = await tx.maladie.create({
        data: {
          employee_id,
          date: new Date(date),
          duree: parseInt(duree),
          date_retour: date_retour ? new Date(date_retour) : null,
          type_maladie: type_maladie || null,
          caisse_assurance,
          created_by: session.data.user.id,
        },
      });

      // Créer les annotations
      await createMaladieAnnotations(
        tx,
        employee_id,
        new Date(date),
        parseInt(duree),
        date_retour ? new Date(date_retour) : null,
        type_maladie,
        session.data.user.id,
      );
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erreur POST maladie:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

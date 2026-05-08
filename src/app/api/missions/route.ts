import { NextResponse } from "next/server";
import { canManageEmployee } from "@/actions/auth/auth";
import {
  verifySession,
  withAuthorizationPermission,
} from "@/actions/permissions";
import { prisma } from "@/lib/db";

// Fonction pour générer les dates (Gère le cas où N === Retour)
function getDatesBetween(startDate: Date, endDate: Date) {
  const dates = [];
  let current = new Date(startDate);

  // Utiliser setUTCHours au lieu de setHours pour éviter le décalage horaire
  current.setUTCHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setUTCHours(0, 0, 0, 0);

  // Si même jour, on retourne ce jour-là uniquement
  if (current.getTime() === end.getTime()) {
    dates.push(new Date(current));
    return dates;
  }

  // Sinon, strictement inférieur pour s'arrêter un jour avant (N à N+4)
  while (current < end) {
    dates.push(new Date(current));
    // Utiliser setUTCDate au lieu de setDate
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

export async function GET(req: Request) {
  const session = await verifySession();
  if (!session?.data?.user)
    return NextResponse.json({ message: "Non autorisé" }, { status: 401 });

  const hasPerm = await withAuthorizationPermission(["mission_view"]);
  if (hasPerm.status !== 200 || !hasPerm.data.hasPermission) {
    return NextResponse.json(
      { message: "Permission refusée" },
      { status: 403 },
    );
  }

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit: any = parseInt(searchParams.get("limit") || "10");
  const skip = (page - 1) * limit;

  // Nouveaux Filtres
  const employeeId = searchParams.get("employeeId");
  const dateDebut = searchParams.get("dateDebut");
  const dateRetour = searchParams.get("dateRetour");
  const sansRetour = searchParams.get("sansRetour") === "true";
  const plus80km = searchParams.get("plus80km") === "true";
  const matricule = searchParams.get("matricule");
  const direction = searchParams.get("direction");

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
  if (sansRetour) whereClause.date_retour = null;
  if (plus80km) whereClause.plus_80km = true;
  if (matricule) whereClause.vehicule_matricule = { contains: matricule };
  if (direction) whereClause.direction = { contains: direction };

  // Filtrage par date (On prend tout ce qui tombe dans la journée sélectionnée)
  if (dateDebut) {
    const d = new Date(dateDebut);
    whereClause.date_debut = { gte: d, lt: new Date(d.getTime() + 86400000) };
  }
  if (dateRetour) {
    const d = new Date(dateRetour);
    whereClause.date_retour = { gte: d, lt: new Date(d.getTime() + 86400000) };
  }

  const missions = await prisma.mission.findMany({
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
    skip: limit === "Tous" ? undefined : skip,
    take: limit === "Tous" ? undefined : limit,
    orderBy: { created_at: "desc" },
  });

  const total = await prisma.mission.count({ where: whereClause });

  return NextResponse.json({
    missions,
    total,
    pages: limit === "Tous" ? 1 : Math.ceil(total / limit),
  });
}

export async function POST(req: Request) {
  try {
    const session = await verifySession();
    if (!session?.data?.user)
      return NextResponse.json({ message: "Non autorisé" }, { status: 401 });

    const hasPerm = await withAuthorizationPermission(["mission_create"]);
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
      destination,
      date_debut,
      date_retour,
      plus_80km,
      drahem,
      drahem_lidahom,
      direction,
      vehicule_matricule,
    } = body;

    const isAuthorized = await canManageEmployee(
      session.data.user.id,
      employee_id,
    );
    if (!isAuthorized)
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    await prisma.$transaction(async (tx) => {
      const mission = await tx.mission.create({
        data: {
          numero,
          employee_id,
          destination,
          date_debut: new Date(date_debut),
          date_retour: date_retour ? new Date(date_retour) : null,
          plus_80km: Boolean(plus_80km),
          drahem: drahem ? parseFloat(drahem) : null,
          drahem_lidahom: drahem_lidahom ? parseFloat(drahem_lidahom) : null,
          direction: direction || null,
          vehicule_matricule: vehicule_matricule || null,
          created_by: session.data.user.id,
        },
      });

      if (date_retour) {
        const dates = getDatesBetween(
          new Date(date_debut),
          new Date(date_retour),
        );
        if (dates.length > 0) {
          await tx.annotation.createMany({
            data: dates.map((d) => ({
              employee_id,
              code: "M",
              libelle: "Mission",
              date: d,
              created_by: session.data.user.id,
            })),
            skipDuplicates: true,
          });
        }
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

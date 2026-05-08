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

export async function PUT(req: Request, { params }: any) {
  try {
    const { id } = await params;
    const session = await verifySession();
    if (!session?.data?.user)
      return NextResponse.json({ message: "Non autorisé" }, { status: 401 });

    const hasPerm = await withAuthorizationPermission(["mission_edit"]);
    if (hasPerm.status !== 200 || !hasPerm.data.hasPermission) {
      return NextResponse.json(
        { message: "Permission refusée" },
        { status: 403 },
      );
    }

    const body = await req.json();
    const {
      numero,
      destination,
      date_debut,
      date_retour,
      plus_80km,
      drahem,
      drahem_lidahom,
      direction,
      vehicule_matricule,
    } = body;

    const oldMission = await prisma.mission.findUnique({
      where: { id },
    });
    if (!oldMission)
      return NextResponse.json(
        { error: "Mission introuvable" },
        { status: 404 },
      );

    if (
      !(await canManageEmployee(session.data.user.id, oldMission.employee_id))
    ) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.mission.update({
        where: { id },
        data: {
          numero,
          destination,
          date_debut: new Date(date_debut),
          date_retour: date_retour ? new Date(date_retour) : null,
          plus_80km,
          drahem: drahem ? parseFloat(drahem) : null,
          drahem_lidahom: drahem_lidahom ? parseFloat(drahem_lidahom) : null,
          direction: direction || null,
          vehicule_matricule: vehicule_matricule || null,
        },
      });

      if (oldMission.date_retour) {
        const oldDates = getDatesBetween(
          oldMission.date_debut,
          oldMission.date_retour,
        );
        if (oldDates.length > 0) {
          await tx.annotation.deleteMany({
            where: {
              employee_id: oldMission.employee_id,
              code: "M",
              date: { in: oldDates },
            },
          });
        }
      }

      if (date_retour) {
        const newDates = getDatesBetween(
          new Date(date_debut),
          new Date(date_retour),
        );
        if (newDates.length > 0) {
          await tx.annotation.createMany({
            data: newDates.map((d) => ({
              employee_id: oldMission.employee_id,
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

export async function DELETE(req: Request, { params }: any) {
  try {
    const { id } = await params;
    const session = await verifySession();
    if (!session?.data?.user)
      return NextResponse.json({ message: "Non autorisé" }, { status: 401 });

    const hasPerm = await withAuthorizationPermission(["mission_delete"]);
    if (hasPerm.status !== 200 || !hasPerm.data.hasPermission) {
      return NextResponse.json(
        { message: "Permission refusée" },
        { status: 403 },
      );
    }

    const oldMission = await prisma.mission.findUnique({
      where: { id },
    });
    if (!oldMission)
      return NextResponse.json(
        { error: "Mission introuvable" },
        { status: 404 },
      );

    if (
      !(await canManageEmployee(session.data.user.id, oldMission.employee_id))
    ) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }
    await prisma.$transaction(async (tx) => {
      await tx.mission.delete({
        where: { id },
      });

      if (oldMission.date_retour) {
        const oldDates = getDatesBetween(
          oldMission.date_debut,
          oldMission.date_retour,
        );
        if (oldDates.length > 0) {
          await tx.annotation.deleteMany({
            where: {
              employee_id: oldMission.employee_id,
              code: "M",
              date: { in: oldDates },
            },
          });
        }
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// app/api/maladies/[id]/route.ts
import { NextResponse } from "next/server";
import { canManageEmployee } from "@/actions/auth/auth";
import {
  verifySession,
  withAuthorizationPermission,
} from "@/actions/permissions";
import { prisma } from "@/lib/db";

// =============================
// Utils
// =============================

// Générer dates entre deux dates (inclusif)
function getDatesBetween(startDate: Date, endDate: Date): Date[] {
  const dates: Date[] = [];
  let current = new Date(startDate);
  current.setUTCHours(0, 0, 0, 0);

  const end = new Date(endDate);
  end.setUTCHours(0, 0, 0, 0);

  while (current <= end) {
    dates.push(new Date(current));
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return dates;
}

// Générer les dates maladie
function getMaladieDates(
  dateDebut: Date,
  duree: number,
  dateRetour?: Date | null,
): Date[] {
  if (dateRetour) {
    const endDate = new Date(dateRetour);
    endDate.setUTCDate(endDate.getUTCDate() - 1);
    return getDatesBetween(dateDebut, endDate);
  } else {
    const endDate = new Date(dateDebut);
    endDate.setUTCDate(endDate.getUTCDate() + duree - 1);
    return getDatesBetween(dateDebut, endDate);
  }
}

// =============================
// Annotation logic
// =============================

async function syncMaladieAnnotations(
  tx: any,
  employee_id: string,
  oldDateDebut: Date,
  oldDuree: number,
  oldDateRetour: Date | null | undefined,
  newDateDebut: Date,
  newDuree: number,
  newDateRetour: Date | null | undefined,
  type_maladie: string | null,
  created_by: string,
) {
  const oldDates = getMaladieDates(oldDateDebut, oldDuree, oldDateRetour);

  const newDates = getMaladieDates(newDateDebut, newDuree, newDateRetour);

  const oldSet = new Set(oldDates.map((d) => d.toISOString()));
  const newSet = new Set(newDates.map((d) => d.toISOString()));

  // Dates à supprimer (présentes avant mais plus maintenant)
  const datesToDelete = oldDates.filter((d) => !newSet.has(d.toISOString()));

  // Dates à ajouter (nouvelles dates)
  const datesToAdd = newDates.filter((d) => !oldSet.has(d.toISOString()));

  if (datesToDelete.length > 0) {
    await tx.annotation.deleteMany({
      where: {
        employee_id,
        code: "Md",
        date: { in: datesToDelete },
      },
    });
  }

  if (datesToAdd.length > 0) {
    const libelle = `Maladie${type_maladie ? ` (${type_maladie})` : ""}`;

    await tx.annotation.createMany({
      data: datesToAdd.map((d) => ({
        employee_id,
        code: "Md",
        libelle,
        date: d,
        created_by,
      })),
      skipDuplicates: true,
    });
  }
}

// =============================
// PUT
// =============================

export async function PUT(req: Request, { params }: any) {
  try {
    const { id } = params;
    const session = await verifySession();

    if (!session?.data?.user)
      return NextResponse.json({ message: "Non autorisé" }, { status: 401 });

    const hasPerm = await withAuthorizationPermission(["maladie_update"]);

    if (hasPerm.status !== 200 || !hasPerm.data.hasPermission) {
      return NextResponse.json(
        { message: "Permission refusée" },
        { status: 403 },
      );
    }

    const body = await req.json();
    const { date, duree, date_retour, type_maladie, caisse_assurance } = body;

    if (!date || !duree || !caisse_assurance) {
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

    const oldMaladie = await prisma.maladie.findUnique({
      where: { id },
    });

    if (!oldMaladie)
      return NextResponse.json(
        { error: "Maladie introuvable" },
        { status: 404 },
      );

    if (
      !(await canManageEmployee(session.data.user.id, oldMaladie.employee_id))
    ) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const newDate = new Date(date);
    const newDuree = parseInt(duree);
    const newDateRetour = date_retour ? new Date(date_retour) : null;

    await prisma.$transaction(async (tx) => {
      await tx.maladie.update({
        where: { id },
        data: {
          date: newDate,
          duree: newDuree,
          date_retour: newDateRetour,
          type_maladie: type_maladie || null,
          caisse_assurance,
        },
      });

      await syncMaladieAnnotations(
        tx,
        oldMaladie.employee_id,
        oldMaladie.date,
        oldMaladie.duree,
        oldMaladie.date_retour,
        newDate,
        newDuree,
        newDateRetour,
        type_maladie,
        session.data.user.id,
      );
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erreur PUT maladie:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// =============================
// DELETE
// =============================

export async function DELETE(req: Request, { params }: any) {
  try {
    const { id } = params;
    const session = await verifySession();

    if (!session?.data?.user)
      return NextResponse.json({ message: "Non autorisé" }, { status: 401 });

    const hasPerm = await withAuthorizationPermission(["maladie_delete"]);

    if (hasPerm.status !== 200 || !hasPerm.data.hasPermission) {
      return NextResponse.json(
        { message: "Permission refusée" },
        { status: 403 },
      );
    }

    const oldMaladie = await prisma.maladie.findUnique({
      where: { id },
    });

    if (!oldMaladie)
      return NextResponse.json(
        { error: "Maladie introuvable" },
        { status: 404 },
      );

    if (
      !(await canManageEmployee(session.data.user.id, oldMaladie.employee_id))
    ) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.maladie.delete({
        where: { id },
      });

      const dates = getMaladieDates(
        oldMaladie.date,
        oldMaladie.duree,
        oldMaladie.date_retour,
      );

      if (dates.length > 0) {
        await tx.annotation.deleteMany({
          where: {
            employee_id: oldMaladie.employee_id,
            code: "Md",
            date: { in: dates },
          },
        });
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erreur DELETE maladie:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

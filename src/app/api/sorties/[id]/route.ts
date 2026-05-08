// app/api/sorties/[id]/route.ts
import { NextResponse } from "next/server";
import { canManageEmployee } from "@/actions/auth/auth";
import {
  verifySession,
  withAuthorizationPermission,
} from "@/actions/permissions";
import { prisma } from "@/lib/db";

export async function PUT(req: Request, { params }: any) {
  try {
    const { id } = await params;
    const session = await verifySession();
    if (!session?.data?.user)
      return NextResponse.json({ message: "Non autorisé" }, { status: 401 });

    const hasPerm = await withAuthorizationPermission(["sortie_edit"]);
    if (hasPerm.status !== 200 || !hasPerm.data.hasPermission) {
      return NextResponse.json(
        { message: "Permission refusée" },
        { status: 403 },
      );
    }

    const body = await req.json();
    const { numero, direction, date, heure_sortie, heure_entree, motif } = body;

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

    const oldSortie = await prisma.sortie.findUnique({
      where: { id },
    });

    if (!oldSortie) {
      return NextResponse.json(
        { error: "Sortie introuvable" },
        { status: 404 },
      );
    }

    if (
      !(await canManageEmployee(session.data.user.id, oldSortie.employee_id))
    ) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.sortie.update({
        where: { id },
        data: {
          numero,
          direction: direction || null,
          date: new Date(date),
          heure_sortie,
          heure_entree: heure_entree || null,
          motif,
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erreur PUT sortie:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: any) {
  try {
    const { id } = await params;
    const session = await verifySession();
    if (!session?.data?.user)
      return NextResponse.json({ message: "Non autorisé" }, { status: 401 });

    const hasPerm = await withAuthorizationPermission(["sortie_delete"]);
    if (hasPerm.status !== 200 || !hasPerm.data.hasPermission) {
      return NextResponse.json(
        { message: "Permission refusée" },
        { status: 403 },
      );
    }

    const oldSortie = await prisma.sortie.findUnique({
      where: { id },
    });

    if (!oldSortie) {
      return NextResponse.json(
        { error: "Sortie introuvable" },
        { status: 404 },
      );
    }

    if (
      !(await canManageEmployee(session.data.user.id, oldSortie.employee_id))
    ) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    await prisma.$transaction(async (tx) => {
      // Supprimer la sortie
      await tx.sortie.delete({
        where: { id },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erreur DELETE sortie:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

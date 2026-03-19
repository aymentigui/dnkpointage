// ─────────────────────────────────────────────────────────────
// app/api/employees/[id]/pointages/route.ts
// GET /api/employees/[id]/pointages?debut=YYYY-MM-DD&fin=YYYY-MM-DD
// → détail complet des pointages avec durées calculées
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest, { params }: any) {
  try {
    const paramsId = await params;
    const { id } = paramsId;
    const searchParams = request.nextUrl.searchParams;
    const dateDebut = searchParams.get("debut");
    const dateFin = searchParams.get("fin");

    const employee = await prisma.employee.findUnique({
      where: { id },
      select: { id: true, matricule: true, nom: true, prenom: true },
    });

    if (!employee) {
      return NextResponse.json(
        { error: "Employé non trouvé" },
        { status: 404 },
      );
    }

    const dateCondition: any = {};
    if (dateDebut || dateFin) {
      dateCondition.date = {};
      if (dateDebut) dateCondition.date.gte = new Date(dateDebut);
      if (dateFin) dateCondition.date.lte = new Date(dateFin);
    }

    const pointages = await prisma.pointage.findMany({
      where: { employee_id: id, ...dateCondition },
      orderBy: { date: "asc" },
    });

    // Enrichir chaque pointage avec durée + statut qualité
    const pointagesEnrichis = pointages.map((p) => {
      const entree = p.heure_entree;
      const sortie = p.heure_sortie;

      // Calcul durée
      let dureeMinutes: number | null = null;
      let dureeFormatee: string | null = null;
      let qualite: "complet" | "incomplet" | "suspect" = "complet";

      if (!entree && !sortie) {
        qualite = "incomplet";
      } else if (!entree || !sortie) {
        qualite = "incomplet";
      } else {
        const [hE, mE] = entree.split(":").map(Number);
        const [hS, mS] = sortie.split(":").map(Number);
        const entreeMin = hE * 60 + mE;
        const sortieMin = hS * 60 + mS;
        const diff = Math.abs(sortieMin - entreeMin);

        if (diff < 5) {
          // Même badgeuse entrée/sortie
          qualite = "suspect";
          dureeMinutes = 0;
        } else {
          dureeMinutes = p.est_nuit
            ? 1440 - entreeMin + sortieMin
            : sortieMin - entreeMin;

          const h = Math.floor(dureeMinutes / 60);
          const m = dureeMinutes % 60;
          dureeFormatee = `${h}h${String(m).padStart(2, "0")}`;
        }
      }

      return {
        id: p.id,
        date: p.date.toISOString().split("T")[0],
        heure_entree: entree ?? null,
        heure_sortie: sortie ?? null,
        est_nuit: p.est_nuit,
        duree_minutes: dureeMinutes,
        duree: dureeFormatee,
        qualite,
      };
    });

    // Résumé global
    const completsCount = pointagesEnrichis.filter(
      (p) => p.qualite === "complet",
    ).length;
    const incompletCount = pointagesEnrichis.filter(
      (p) => p.qualite === "incomplet",
    ).length;
    const suspectCount = pointagesEnrichis.filter(
      (p) => p.qualite === "suspect",
    ).length;

    const totalMinutes = pointagesEnrichis
      .filter((p) => p.duree_minutes && p.duree_minutes > 5)
      .reduce((s, p) => s + (p.duree_minutes ?? 0), 0);

    const totalH = Math.floor(totalMinutes / 60);
    const totalM = totalMinutes % 60;

    return NextResponse.json({
      employee,
      periode: { debut: dateDebut, fin: dateFin },
      resume: {
        total: pointages.length,
        complets: completsCount,
        incomplets: incompletCount,
        suspects: suspectCount,
        total_heures: `${totalH}h${String(totalM).padStart(2, "0")}`,
      },
      pointages: pointagesEnrichis,
    });
  } catch (error) {
    console.error("Erreur API pointages employé:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

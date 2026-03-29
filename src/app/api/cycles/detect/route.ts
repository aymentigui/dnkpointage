// app/api/cycles/detect/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
// import { verifySession } from "@/actions/permissions"; // À décommenter selon ton système d'auth

// ─────────────────────────────────────────────────────────────
// SEUILS DE GESTION
// ─────────────────────────────────────────────────────────────
const SEUIL_SORTIE_NUIT_MAX_H = 10; // Sortie ≤ 10:00 = fin de nuit (compte pour la veille)
const SEUIL_ENTREE_NUIT_MIN_H = 16; // Entrée ≥ 16:00 = début de nuit

export async function POST(request: NextRequest) {
  try {
    // const session = await verifySession();
    // if (!session?.data?.user) return NextResponse.json({ message: "Non autorisé" }, { status: 401 });

    const body = await request.json();
    const { matricule, workspace_id } = body;

    return matricule
      ? await detecterPourUnEmploye(matricule, workspace_id)
      : await detecterPourTous(workspace_id);
  } catch (error) {
    console.error("Erreur détection cycle:", error);
    return NextResponse.json(
      { error: "Erreur lors de la détection" },
      { status: 500 },
    );
  }
}

// ─────────────────────────────────────────────────────────────
// HANDLERS BDD
// ─────────────────────────────────────────────────────────────

async function detecterPourUnEmploye(matricule: string, workspace_id: string) {
  const employee = await prisma.employee.findFirst({
    where: { matricule, workspace_id },
    include: { pointages: { orderBy: { date: "asc" } } },
  });

  if (!employee)
    return NextResponse.json({ error: "Employé non trouvé" }, { status: 404 });

  const cycleExistant = await prisma.cycle.findUnique({
    where: { employee_id: employee.id },
  });

  if (cycleExistant?.est_manuel) {
    return NextResponse.json({
      message: "Cycle manuel non modifié",
      cycle: cycleExistant,
    });
  }

  const resultat = algorithmeKhchinDetection(employee.pointages);

  const cycle = await prisma.cycle.upsert({
    where: { employee_id: employee.id },
    update: { ...resultat, est_manuel: false },
    create: { ...resultat, est_manuel: false, employee_id: employee.id },
  });

  return NextResponse.json({
    message: "Cycle détecté",
    cycle,
    debug: resultat,
  });
}

async function detecterPourTous(workspace_id: string) {
  const employees = await prisma.employee.findMany({
    where: { workspace_id },
    include: { pointages: { orderBy: { date: "asc" } }, cycles: true },
  });

  const results = [];

  for (const emp of employees) {
    if (emp.cycles?.est_manuel) {
      results.push({ matricule: emp.matricule, status: "ignoré (manuel)" });
      continue;
    }

    if (emp.pointages.length < 7) {
      results.push({
        matricule: emp.matricule,
        status: "données insuffisantes",
      });
      continue;
    }

    const resultat = algorithmeKhchinDetection(emp.pointages);

    await prisma.cycle.upsert({
      where: { employee_id: emp.id },
      update: { ...resultat, est_manuel: false },
      create: { ...resultat, est_manuel: false, employee_id: emp.id },
    });

    results.push({
      matricule: emp.matricule,
      status: "détecté",
      details: resultat,
    });
  }

  return NextResponse.json({
    message: "Détection terminée",
    total: results.length,
    results,
  });
}

// ─────────────────────────────────────────────────────────────
// LE CŒUR DE L'ALGORITHME
// ─────────────────────────────────────────────────────────────

type TypeTravail = "rotation" | "night";

function algorithmeKhchinDetection(pointages: any[]) {
  const base = {
    type: "unknown",
    rest_days: null,
    travail: null,
    repos: null,
    start_phase: 0,
    fiabilite: 0,
  };

  if (!pointages || pointages.length < 7) return base;

  // 1. NORMALISATION: Création de la Timeline exacte des jours travaillés
  const joursTravailles = new Map<string, TypeTravail>();

  const decalerJour = (dateStr: string, jours: number) => {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + jours);
    return d.toISOString().split("T")[0];
  };

  for (const p of pointages) {
    const dateStr = new Date(p.date).toISOString().split("T")[0];
    const entreeH = p.heure_entree
      ? parseInt(p.heure_entree.split(":")[0], 10)
      : null;
    const sortieH = p.heure_sortie
      ? parseInt(p.heure_sortie.split(":")[0], 10)
      : null;

    if (entreeH !== null && entreeH >= SEUIL_ENTREE_NUIT_MIN_H) {
      // Cas 1 : Entrée > 16h = C'est le début d'une nuit (Jour N)
      joursTravailles.set(dateStr, "night");
    } else if (
      entreeH === null &&
      sortieH !== null &&
      sortieH <= SEUIL_SORTIE_NUIT_MAX_H
    ) {
      // Cas 2 : Que Sortie le matin < 10h = C'est la fin de la nuit de la veille (Jour N-1)
      const veille = decalerJour(dateStr, -1);
      if (!joursTravailles.has(veille)) joursTravailles.set(veille, "night");
    } else if (
      entreeH !== null &&
      sortieH !== null &&
      sortieH <= SEUIL_SORTIE_NUIT_MAX_H &&
      entreeH >= SEUIL_ENTREE_NUIT_MIN_H
    ) {
      // Cas 3 : Nuit complète sur la même ligne d'enregistrement
      joursTravailles.set(dateStr, "night");
    } else if (entreeH !== null || sortieH !== null) {
      // Cas 4 : N'importe quel autre pointage (tolérance oubli de badgeage)
      joursTravailles.set(dateStr, "rotation");
    }
  }

  // 2. CONVERSION EN TABLEAU CONTINU (0 = Repos, 1 = Travail)
  const datesUniques = Array.from(joursTravailles.keys()).sort();
  if (datesUniques.length === 0) return base;

  const dateDebut = new Date(datesUniques[0]);
  const dateFin = new Date(datesUniques[datesUniques.length - 1]);
  const totalJours =
    Math.floor((dateFin.getTime() - dateDebut.getTime()) / 86400000) + 1;

  const timeline = [];
  let nuitsCount = 0;

  for (let i = 0; i < totalJours; i++) {
    const d = new Date(dateDebut.getTime() + i * 86400000);
    const dateStr = d.toISOString().split("T")[0];
    const type = joursTravailles.get(dateStr);

    if (type) {
      timeline.push(1);
      if (type === "night") nuitsCount++;
    } else {
      timeline.push(0);
    }
  }

  const joursTravaillesTotal = timeline.filter((v) => v === 1).length;
  if (joursTravaillesTotal === 0) return base;

  const estGlobalementNuit = nuitsCount / joursTravaillesTotal > 0.4;

  // 3. RECHERCHE CYCLE HEBDOMADAIRE (Repos Vendredi ou X/Y)
  if (!estGlobalementNuit) {
    const joursSemainePresences = [0, 0, 0, 0, 0, 0, 0]; // 0=Dimanche, 6=Samedi
    const joursSemaineTotal = [0, 0, 0, 0, 0, 0, 0];

    for (let i = 0; i < timeline.length; i++) {
      const d = new Date(dateDebut.getTime() + i * 86400000);
      const dayOfWeek = d.getDay();
      joursSemaineTotal[dayOfWeek]++;
      if (timeline[i] === 1) joursSemainePresences[dayOfWeek]++;
    }

    const reposHabituels = [];
    let moyenneTravail = 0;
    let joursCalcules = 0;

    for (let i = 0; i < 7; i++) {
      if (joursSemaineTotal[i] > 1) {
        const taux = joursSemainePresences[i] / joursSemaineTotal[i];
        if (taux < 0.25) {
          reposHabituels.push(i);
        } else {
          moyenneTravail += taux;
          joursCalcules++;
        }
      }
    }

    moyenneTravail = joursCalcules > 0 ? moyenneTravail / joursCalcules : 0;

    if (
      reposHabituels.length > 0 &&
      reposHabituels.length <= 2 &&
      moyenneTravail > 0.7
    ) {
      return {
        type: "weekly", // Tu m'as dit de laisser "night" et "rotation", est-ce que "weekly" te va pour les semaines fixes ?
        rest_days: JSON.stringify(reposHabituels),
        travail: null,
        repos: null,
        start_phase: null,
        fiabilite: Math.round(moyenneTravail * 100) / 100,
      };
    }
  }

  // 4. RECHERCHE ROTATION / NIGHT
  const patternsRotation = [
    [1, 2], // Spécial Night (1 nuit / 2 repos)
    [2, 2], // Spécial Night (2 nuits / 2 repos) ou Rotation Jour
    [3, 3],
    [7, 7],
    [14, 7],
    [4, 2],
    [5, 2],
    [6, 2],
    [4, 4],
  ];

  let meilleurScore = 0;
  let meilleureRotation = null;

  for (const [travail, repos] of patternsRotation) {
    const cycleLength = travail + repos;

    // Pour chaque phase possible (décalage de départ)
    for (let phase = 0; phase < cycleLength; phase++) {
      let correspondances = 0;
      let totalVerifie = 0;

      for (let i = 0; i < timeline.length; i++) {
        const positionDansCycle = (i + phase) % cycleLength;
        const estCenseTravailler = positionDansCycle < travail;
        const aTravaille = timeline[i] === 1;

        if (estCenseTravailler === aTravaille) correspondances++;
        totalVerifie++;
      }

      const score = correspondances / totalVerifie;

      if (score > meilleurScore) {
        meilleurScore = score;
        meilleureRotation = {
          type: estGlobalementNuit ? "night" : "rotation",
          rest_days: null,
          travail,
          repos,
          start_phase: phase,
          fiabilite: Math.round(score * 100) / 100,
        };
      }
    }
  }

  // Validation de la rotation (On demande minimum 80% de correspondance)
  if (meilleureRotation && meilleurScore > 0.8) {
    return meilleureRotation;
  }

  return base;
}

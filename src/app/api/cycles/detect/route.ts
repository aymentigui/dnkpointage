// app/api/cycles/detect/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// ─────────────────────────────────────────────────────────────
// Seuils (mêmes que planning route)
// ─────────────────────────────────────────────────────────────
const SEUIL_BADGEUSE_UNIQUE_MIN = 15; // écart max (min) = badgeuse unique
const SEUIL_SORTIE_MATIN_MAX_H = 8; // sortie < 08:00 = fin de nuit
const SEUIL_ENTREE_NUIT_MIN_H = 14; // entrée ≥ 14:00 = début de nuit
const SEUIL_SORTIE_NUIT_MAX_H = 10; // sortie ≤ 10:00 pour nuit complète

export async function POST(request: NextRequest) {
  try {
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
// HANDLERS
// ─────────────────────────────────────────────────────────────

async function detecterPourUnEmploye(matricule: string, workspace_id: string) {
  const employee = await prisma.employee.findFirst({
    where: { matricule, workspace_id },
    include: { pointages: { orderBy: { date: "asc" } } },
  });

  if (!employee) {
    return NextResponse.json({ error: "Employé non trouvé" }, { status: 404 });
  }

  const cycleExistant = await prisma.cycle.findUnique({
    where: { employee_id: employee.id },
  });

  if (cycleExistant?.est_manuel) {
    return NextResponse.json({
      message: "Cycle manuel non modifié",
      cycle: cycleExistant,
    });
  }

  const pointagesNormalises = normaliserPointages(employee.pointages);
  const resultat = detecterCycle(pointagesNormalises);

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
    include: {
      pointages: { orderBy: { date: "asc" } },
      cycles: true,
    },
  });

  const results = [];

  for (const emp of employees) {
    if (emp.cycles?.est_manuel) {
      results.push({ matricule: emp.matricule, status: "ignoré (manuel)" });
      continue;
    }

    if (emp.pointages.length < 10) {
      results.push({
        matricule: emp.matricule,
        status: "données insuffisantes",
      });
      continue;
    }

    const pointagesNormalises = normaliserPointages(emp.pointages);
    const resultat = detecterCycle(pointagesNormalises);

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
// TYPES
// ─────────────────────────────────────────────────────────────

interface PointageNormalise {
  dateStr: string; // YYYY-MM-DD — date de référence du travail réel
  estNuit: boolean;
  estIncomplet: boolean;
  dureeMinutes: number;
}

// ─────────────────────────────────────────────────────────────
// ÉTAPE 1 : Normalisation des pointages
//
// FIX majeur : même logique que planning route
//
// Pour chaque pointage on détermine:
//   - si c'est une nuit (par les heures, pas seulement est_nuit BDD)
//   - la date de référence correcte pour le bitmap
//     → pour une fin de nuit (sortie matin), on utilise N-1 comme date de travail
//
// Cas traités :
//
// CAS A — Nuit complète (entrée ≥14h + sortie ≤10h / traverse minuit)
//   ex: 16:34 → 06:49
//   → dateStr = N (date du pointage = début de nuit)
//   → estNuit = true, estIncomplet = false
//   → on ajoute aussi N+1 comme jour présent (sortie)
//   → N+1 est fin de nuit → marqué repos dans bitmap
//
// CAS MIXTE — même jour: fin nuit + début nouvelle nuit
//   entrée < 08h + sortie ≥ 14h
//   ex: 06:49 → 16:30
//   → dateStr = N (jour de travail double)
//   → estNuit = true, estIncomplet = false
//
// CAS B — Badgeuse unique matin (|entrée-sortie| < seuil, heure < 08h)
//   ex: 06:52 → 06:52
//   → C'est la sortie d'une nuit commencée en N-1
//   → dateStr = N-1 (date réelle du travail)
//   → estNuit = true, estIncomplet = false
//   → N = fin de nuit (repos), pas ajouté comme travail
//
// CAS C — Seulement sortie, sortie < 08h
//   → même logique que CAS B
//   → dateStr = N-1
//
// CAS D — Seulement entrée, entrée ≥ 14h
//   ex: 16:20 seule
//   → dateStr = N (début de nuit)
//   → estNuit = true
//
// CAS E — Pointage normal
//   → dateStr = N, estNuit = false
// ─────────────────────────────────────────────────────────────

function normaliserPointages(pointages: any[]): PointageNormalise[] {
  const decalerJour = (dateStr: string, jours: number): string => {
    return new Date(new Date(dateStr).getTime() + jours * 86400000)
      .toISOString()
      .split("T")[0];
  };

  const toMin = (h: string) => {
    const [hh, mm] = h.split(":").map(Number);
    return hh * 60 + mm;
  };

  const resultats: PointageNormalise[] = [];

  for (const p of pointages) {
    const dateStr = new Date(p.date).toISOString().split("T")[0];
    const entree = p.heure_entree;
    const sortie = p.heure_sortie;

    // Aucune heure → présence simple
    if (!entree && !sortie) {
      resultats.push({
        dateStr,
        estNuit: false,
        estIncomplet: false,
        dureeMinutes: 480,
      });
      continue;
    }

    if (entree && sortie) {
      const minEntree = toMin(entree);
      const minSortie = toMin(sortie);
      const ecart = Math.abs(minSortie - minEntree);

      // ── CAS A : nuit complète ──────────────────────────────
      const traverseMinuit = minSortie < minEntree;
      const entreeAprem = minEntree >= SEUIL_ENTREE_NUIT_MIN_H * 60;
      const sortieMatin = minSortie <= SEUIL_SORTIE_NUIT_MAX_H * 60;
      const nuitComplete = traverseMinuit || (entreeAprem && sortieMatin);

      if (nuitComplete) {
        const duree = traverseMinuit
          ? 1440 - minEntree + minSortie
          : minSortie - minEntree;
        // N = jour de travail (début de nuit)
        resultats.push({
          dateStr,
          estNuit: true,
          estIncomplet: false,
          dureeMinutes: duree,
        });
        // On n'ajoute PAS N+1 ici : le bitmap gère les fins de nuit
        // via la logique de construireBitmapNuit
        continue;
      }

      // ── CAS MIXTE : sortie nuit + début nouvelle nuit ──────
      const entreeEstMatin = minEntree < SEUIL_SORTIE_MATIN_MAX_H * 60;
      const sortieEstAprem = minSortie >= SEUIL_ENTREE_NUIT_MIN_H * 60;

      if (entreeEstMatin && sortieEstAprem) {
        // Ce jour N est un jour de travail (double rôle)
        resultats.push({
          dateStr,
          estNuit: true,
          estIncomplet: false,
          dureeMinutes: 1440 - minEntree + ((minSortie + 1440) % 1440),
        });
        continue;
      }

      // ── CAS B : badgeuse unique le matin ──────────────────
      const badgeuseUnique = ecart < SEUIL_BADGEUSE_UNIQUE_MIN;
      const sortieMatinB = minSortie < SEUIL_SORTIE_MATIN_MAX_H * 60;

      if (badgeuseUnique && sortieMatinB) {
        // C'est une sortie de nuit → la vraie date de travail = N-1
        resultats.push({
          dateStr: decalerJour(dateStr, -1), // N-1 = vrai jour travaillé
          estNuit: true,
          estIncomplet: false,
          dureeMinutes: 0, // durée inconnue (badgeuse unique)
        });
        continue;
      }

      // ── CAS E : pointage normal ────────────────────────────
      resultats.push({
        dateStr,
        estNuit: false,
        estIncomplet: false,
        dureeMinutes: minSortie > minEntree ? minSortie - minEntree : 480,
      });
    } else if (!entree && sortie) {
      // ── CAS C : seulement sortie ──────────────────────────
      const minSortie = toMin(sortie);
      const sortieMatinC = minSortie < SEUIL_SORTIE_MATIN_MAX_H * 60;

      if (sortieMatinC) {
        // Sortie matin = fin de nuit → vrai travail = N-1
        resultats.push({
          dateStr: decalerJour(dateStr, -1),
          estNuit: true,
          estIncomplet: true, // on ne sait pas l'heure d'entrée
          dureeMinutes: 0,
        });
      } else {
        resultats.push({
          dateStr,
          estNuit: p.est_nuit ?? false,
          estIncomplet: true,
          dureeMinutes: 0,
        });
      }
    } else if (entree && !sortie) {
      // ── CAS D : seulement entrée ──────────────────────────
      const minEntree = toMin(entree);
      const entreeNuitD = minEntree >= SEUIL_ENTREE_NUIT_MIN_H * 60;

      resultats.push({
        dateStr,
        estNuit: entreeNuitD,
        estIncomplet: true,
        dureeMinutes: 0,
      });
    }
  }

  // Dédupliquer par dateStr (garder le premier si conflit)
  const seen = new Set<string>();
  const dedup: PointageNormalise[] = [];
  for (const r of resultats) {
    if (!seen.has(r.dateStr)) {
      seen.add(r.dateStr);
      dedup.push(r);
    }
  }

  return dedup.sort((a, b) => a.dateStr.localeCompare(b.dateStr));
}

// ─────────────────────────────────────────────────────────────
// ÉTAPE 2 : Bitmap de présence
// 1 = jour de vrai travail, 0 = repos/absent
//
// FIX : utilise les dateStr normalisés (après correction N-1 pour nuits)
// ─────────────────────────────────────────────────────────────

function construireBitmap(pointages: PointageNormalise[]): {
  bitmap: number[];
  dateDebut: Date;
  totalJours: number;
} {
  if (pointages.length === 0) {
    return { bitmap: [], dateDebut: new Date(), totalJours: 0 };
  }

  const msParJour = 86400000;
  const toMs = (dateStr: string) => new Date(dateStr).getTime();

  const msMin = Math.min(...pointages.map((p) => toMs(p.dateStr)));
  const msMax = Math.max(...pointages.map((p) => toMs(p.dateStr)));
  const dateDebut = new Date(msMin);
  const totalJours = Math.floor((msMax - msMin) / msParJour) + 1;

  // Seuls les jours de vrai travail (pas les incomplets badgeuse unique)
  // sont marqués 1 dans le bitmap
  const presencesSet = new Set(
    pointages
      .filter((p) => !p.estIncomplet || p.dureeMinutes > 0)
      .map((p) => p.dateStr),
  );

  // Pour les incomplets (CAS C sortie matin), on les inclut quand même
  // car ils représentent un vrai jour travaillé
  pointages.forEach((p) => presencesSet.add(p.dateStr));

  const bitmap: number[] = [];
  for (let i = 0; i < totalJours; i++) {
    const d = new Date(msMin + i * msParJour);
    const dateStr = d.toISOString().split("T")[0];
    bitmap.push(presencesSet.has(dateStr) ? 1 : 0);
  }

  return { bitmap, dateDebut, totalJours };
}

// ─────────────────────────────────────────────────────────────
// ÉTAPE 3 : Détecter si cycle de nuit
// Seuil 0.3 : un cycle 4/2 a ~50% de nuits sur les pointages valides
// ─────────────────────────────────────────────────────────────

function estCycleNuit(pointages: PointageNormalise[]): boolean {
  if (pointages.length === 0) return false;
  const nuits = pointages.filter((p) => p.estNuit).length;
  const ratioNuit = nuits / pointages.length;
  return ratioNuit > 0.3;
}

// ─────────────────────────────────────────────────────────────
// ÉTAPE 4 : Autocorrélation
// ─────────────────────────────────────────────────────────────

function autocorrelation(bitmap: number[], periode: number): number {
  if (bitmap.length < periode * 2) return 0;
  let accord = 0;
  const total = bitmap.length - periode;
  for (let i = 0; i < total; i++) {
    if (bitmap[i] === bitmap[i + periode]) accord++;
  }
  return accord / total;
}

// ─────────────────────────────────────────────────────────────
// ÉTAPE 5 : Meilleure phase
// ─────────────────────────────────────────────────────────────

function trouverMeilleurePhase(
  bitmap: number[],
  travail: number,
  repos: number,
): { phase: number; score: number } {
  const cycleLength = travail + repos;
  let meilleurePhase = 0;
  let meilleurScore = -Infinity;

  for (let phase = 0; phase < cycleLength; phase++) {
    let score = 0;
    for (let i = 0; i < bitmap.length; i++) {
      const pos = (i + phase) % cycleLength;
      const estJourTravail = pos < travail;

      if (bitmap[i] === 1 && estJourTravail) score += 2;
      if (bitmap[i] === 1 && !estJourTravail) score -= 2;
      if (bitmap[i] === 0 && !estJourTravail) score += 2;
      if (bitmap[i] === 0 && estJourTravail) score += 0;
    }
    if (score > meilleurScore) {
      meilleurScore = score;
      meilleurePhase = phase;
    }
  }

  const scoreMax = bitmap.length * 2;
  return { phase: meilleurePhase, score: meilleurScore / scoreMax };
}

// ─────────────────────────────────────────────────────────────
// ÉTAPE 6 : Détection hebdomadaire
// ─────────────────────────────────────────────────────────────

function detecterHebdomadaire(
  pointages: PointageNormalise[],
  bitmap: number[],
  dateDebut: Date,
): any | null {
  const msParJour = 86400000;
  const presenceParJour = Array(7).fill(0);
  const occurrenceParJour = Array(7).fill(0);

  bitmap.forEach((val, i) => {
    const d = new Date(dateDebut.getTime() + i * msParJour);
    const dow = d.getDay();
    occurrenceParJour[dow]++;
    if (val === 1) presenceParJour[dow]++;
  });

  const restDays: number[] = [];
  const ratiosParJour: number[] = [];

  for (let dow = 0; dow < 7; dow++) {
    if (occurrenceParJour[dow] < 3) {
      ratiosParJour.push(-1);
      continue;
    }
    const ratio = presenceParJour[dow] / occurrenceParJour[dow];
    ratiosParJour.push(ratio);
    if (ratio < 0.25) restDays.push(dow);
  }

  if (restDays.length < 1 || restDays.length > 3) return null;

  const joursTravail = [0, 1, 2, 3, 4, 5, 6].filter(
    (d) => !restDays.includes(d) && ratiosParJour[d] >= 0,
  );
  const ratioMoyenTravail =
    joursTravail.reduce((s, d) => s + ratiosParJour[d], 0) /
    (joursTravail.length || 1);

  if (ratioMoyenTravail < 0.6) return null;

  return {
    type: "weekly",
    rest_days: JSON.stringify(restDays),
    travail: null,
    repos: null,
    start_phase: null,
    fiabilite: Math.round(ratioMoyenTravail * 100) / 100,
  };
}

// ─────────────────────────────────────────────────────────────
// ÉTAPE 7 : Détection rotation / nuit
// ─────────────────────────────────────────────────────────────

function detecterRotation(bitmap: number[], estNuit: boolean): any | null {
  const patterns: [number, number][] = [
    [1, 1],
    [1, 2],
    [2, 1],
    [2, 2],
    [3, 1],
    [3, 2],
    [3, 3],
    [4, 2],
    [4, 4],
    [5, 2],
    [5, 5],
    [6, 2],
    [7, 2],
    [7, 7],
    [14, 7],
  ];

  let meilleurScore = 0;
  let meilleurResultat: any = null;

  for (const [travail, repos] of patterns) {
    const cycleLength = travail + repos;

    if (bitmap.length < cycleLength * 2.5) continue;

    const scoreAuto = autocorrelation(bitmap, cycleLength);
    if (scoreAuto < 0.62) continue;

    const { phase, score: scorePhase } = trouverMeilleurePhase(
      bitmap,
      travail,
      repos,
    );
    const scoreFinal = scoreAuto * 0.35 + scorePhase * 0.65;

    if (scoreFinal > meilleurScore) {
      meilleurScore = scoreFinal;
      meilleurResultat = {
        type: estNuit ? "night" : "rotation",
        rest_days: null,
        travail,
        repos,
        start_phase: phase,
        fiabilite: Math.round(scoreFinal * 100) / 100,
      };
    }
  }

  if (!meilleurResultat || meilleurScore < 0.62) return null;
  return meilleurResultat;
}

// ─────────────────────────────────────────────────────────────
// DISPATCHER
// ─────────────────────────────────────────────────────────────

function detecterCycle(pointages: PointageNormalise[]): any {
  const base = {
    type: "unknown",
    rest_days: null,
    travail: null,
    repos: null,
    start_phase: 0,
    fiabilite: 0,
  };

  if (pointages.length < 10) return base;

  const { bitmap, dateDebut } = construireBitmap(pointages);
  if (bitmap.length < 14) return base;

  const isNuit = estCycleNuit(pointages);

  // 1. Hebdomadaire en priorité (sauf si nuit)
  if (!isNuit) {
    const hebdo = detecterHebdomadaire(pointages, bitmap, dateDebut);
    if (hebdo && hebdo.fiabilite >= 0.7) return hebdo;
  }

  // 2. Rotation / nuit
  const rotation = detecterRotation(bitmap, isNuit);
  if (rotation && rotation.fiabilite >= 0.62) return rotation;

  // 3. Hebdomadaire fallback
  if (!isNuit) {
    const hebdoFallback = detecterHebdomadaire(pointages, bitmap, dateDebut);
    if (hebdoFallback) return hebdoFallback;
  }

  return base;
}

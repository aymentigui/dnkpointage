// app/api/workspaces/[id]/planning/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
// import { verifySession } from "@/actions/permissions"; // À décommenter si besoin

const SEUIL_BADGEUSE_UNIQUE_MIN = 15;
const SEUIL_SORTIE_MATIN_MAX_H = 8;
const SEUIL_ENTREE_NUIT_MIN_H = 14;
const SEUIL_SORTIE_NUIT_MAX_H = 10;

const ANNOT_CODES = new Set(["M", "J", "Md", "Rc", "C", "Ce"]);

export async function GET(request: NextRequest, { params }: any) {
  try {
    // const session = await verifySession();
    // if (!session?.data?.user) return NextResponse.json({ message: "Vous devez être connecté" }, { status: 401 });

    const paramsId = await params;
    const workspaceId = paramsId.id;
    const searchParams = request.nextUrl.searchParams;
    const dateDebut = searchParams.get("debut");
    const dateFin = searchParams.get("fin");

    if (!workspaceId) {
      return NextResponse.json(
        { error: "ID du workspace requis" },
        { status: 400 },
      );
    }

    const employees = await prisma.employee.findMany({
      where: { workspace_id: workspaceId },
      include: { cycles: true },
    });

    if (employees.length === 0) return NextResponse.json({});

    const employeeIds = employees.map((e) => e.id);

    const dateCondition: any = {};
    if (dateDebut || dateFin) {
      dateCondition.date = {};
      if (dateDebut) dateCondition.date.gte = new Date(dateDebut);
      if (dateFin) dateCondition.date.lte = new Date(dateFin);
    }

    // ── Fetch en parallèle ────────────────────────────────────
    const [
      allAnnotations,
      allPointages,
      allPlannings,
      allHistories,
      premiersPointages,
      allJoursFeries, // 🔥 NOUVEAU : Fetch des jours fériés
    ] = await Promise.all([
      prisma.annotation.findMany({
        where: { employee_id: { in: employeeIds }, ...dateCondition },
        include: { employee: { select: { matricule: true } } },
      }),

      // J-1 pour les nuits
      prisma.pointage.findMany({
        where: {
          employee_id: { in: employeeIds },
          ...(dateDebut && dateFin
            ? {
                date: {
                  gte: new Date(new Date(dateDebut).getTime() - 86400000),
                  lte: new Date(dateFin),
                },
              }
            : {}),
        },
        select: {
          employee_id: true,
          date: true,
          heure_entree: true,
          heure_sortie: true,
          est_nuit: true,
        },
      }),

      prisma.planning.findMany({
        where: { employee_id: { in: employeeIds }, ...dateCondition },
        include: {
          employee: { select: { matricule: true } },
          annotation: true,
        },
      }),

      prisma.modification_history.findMany({
        where: { employee_id: { in: employeeIds }, ...dateCondition },
        include: { employee: { select: { matricule: true } } },
        orderBy: { created_at: "asc" },
      }),

      // Récupérer la date du TOUT PREMIER pointage par employé pour l'ancrage
      prisma.pointage.groupBy({
        by: ["employee_id"],
        _min: { date: true },
        where: { employee_id: { in: employeeIds } },
      }),

      // 🔥 NOUVEAU : Récupération des jours fériés du workspace
      prisma.jour_ferie.findMany({
        where: {
          OR: [
            { workspace_id: workspaceId },
            { workspace_id: null }, // Au cas où tu as des jours fériés globaux
          ],
        },
      }),
    ]);

    // ── Charger les users pour les noms ───────────────────────
    const userIds = [
      ...new Set(
        allHistories
          .map((h) => h.created_by)
          .filter((id): id is string => !!id),
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
            },
          })
        : [];

    const userMap = new Map(users.map((u) => [u.id, u]));

    // ── Map d'ancrage des cycles (Date de référence absolue) ──
    const anchorMap = new Map<string, Date>();
    premiersPointages.forEach((p) => {
      if (p._min.date) anchorMap.set(p.employee_id, p._min.date);
    });

    // ── Générer les dates ─────────────────────────────────────
    let toutesLesDates: string[] = [];

    if (dateDebut && dateFin) {
      const start = new Date(dateDebut),
        end = new Date(dateFin);
      const current = new Date(start);
      while (current <= end) {
        toutesLesDates.push(current.toISOString().split("T")[0]);
        current.setDate(current.getDate() + 1);
      }
    } else {
      const datesSet = new Set<string>();
      allPointages.forEach((p) =>
        datesSet.add(p.date.toISOString().split("T")[0]),
      );
      allAnnotations.forEach((a) =>
        datesSet.add(a.date.toISOString().split("T")[0]),
      );
      allPlannings.forEach((p) =>
        datesSet.add(p.date.toISOString().split("T")[0]),
      );
      toutesLesDates = Array.from(datesSet).sort();
    }

    // ── Maps ──────────────────────────────────────────────────
    const annotMap = new Map<string, any>();
    allAnnotations.forEach((a) => {
      annotMap.set(
        `${a.employee.matricule}_${a.date.toISOString().split("T")[0]}`,
        { id: a.id, code: a.code, libelle: a.libelle, date: a.date },
      );
    });

    const planningMap = new Map<string, any>();
    allPlannings.forEach((p) => {
      planningMap.set(
        `${p.employee.matricule}_${p.date.toISOString().split("T")[0]}`,
        p,
      );
    });

    const historyMap = new Map<string, any[]>();
    allHistories.forEach((h) => {
      const key = `${h.employee.matricule}_${h.date.toISOString().split("T")[0]}`;
      if (!historyMap.has(key)) historyMap.set(key, []);

      const user = h.created_by ? userMap.get(h.created_by) : null;
      const userName = user
        ? [user.firstname, user.lastname].filter(Boolean).join(" ") ||
          user.username ||
          h.created_by
        : null;

      historyMap.get(key)!.push({
        ancien_statut: h.ancien_statut,
        nouveau_statut: h.nouveau_statut,
        type_modification: h.type_modification,
        modifie_par: userName,
        modifie_par_id: h.created_by,
        modifie_le: h.created_at,
      });
    });

    const cycleParEmp = new Map<string, any>();
    employees.forEach((e) => cycleParEmp.set(e.id, e.cycles ?? null));

    // ── Helpers ────────────────────────────────────────────────
    const toMinutes = (h: string) => {
      const [hh, mm] = h.split(":").map(Number);
      return hh * 60 + mm;
    };
    const decalerJour = (dateStr: string, jours: number) =>
      new Date(new Date(dateStr).getTime() + jours * 86400000)
        .toISOString()
        .split("T")[0];

    // ── presenceMap + finNuitMap ──────────────────────────────
    const presenceMap = new Map<string, boolean>();
    const finNuitMap = new Map<string, boolean>();

    const marquerPresent = (id: string, d: string) =>
      presenceMap.set(`${id}_${d}`, true);
    const marquerFinNuit = (id: string, d: string) =>
      finNuitMap.set(`${id}_${d}`, true);

    allPointages.forEach((p) => {
      const dateStr = p.date.toISOString().split("T")[0];
      const empId = p.employee_id;
      const cycle = cycleParEmp.get(empId);
      const isNuit = cycle?.type === "night" || (p.est_nuit ?? false);
      const entree = p.heure_entree;
      const sortie = p.heure_sortie;

      if (entree && sortie) {
        const minE = toMinutes(entree),
          minS = toMinutes(sortie);
        const ecart = Math.abs(minS - minE);

        if (
          minS < minE ||
          (minE >= SEUIL_ENTREE_NUIT_MIN_H * 60 &&
            minS <= SEUIL_SORTIE_NUIT_MAX_H * 60)
        ) {
          marquerPresent(empId, dateStr);
          marquerFinNuit(empId, decalerJour(dateStr, +1));
          return;
        }
        if (
          minE < SEUIL_SORTIE_MATIN_MAX_H * 60 &&
          minS >= SEUIL_ENTREE_NUIT_MIN_H * 60 &&
          isNuit
        ) {
          marquerPresent(empId, dateStr);
          marquerFinNuit(empId, decalerJour(dateStr, +1));
          return;
        }
        if (
          ecart < SEUIL_BADGEUSE_UNIQUE_MIN &&
          minS < SEUIL_SORTIE_MATIN_MAX_H * 60 &&
          isNuit
        ) {
          marquerFinNuit(empId, dateStr);
          marquerPresent(empId, decalerJour(dateStr, -1));
          return;
        }
        marquerPresent(empId, dateStr);
      } else if (!entree && sortie) {
        const minS = toMinutes(sortie);
        if (minS < SEUIL_SORTIE_MATIN_MAX_H * 60 && isNuit) {
          marquerFinNuit(empId, dateStr);
          marquerPresent(empId, decalerJour(dateStr, -1));
        } else marquerPresent(empId, dateStr);
      } else if (entree && !sortie) {
        const minE = toMinutes(entree);
        if (minE >= SEUIL_ENTREE_NUIT_MIN_H * 60 && isNuit) {
          marquerPresent(empId, dateStr);
          marquerFinNuit(empId, decalerJour(dateStr, +1));
        } else marquerPresent(empId, dateStr);
      } else {
        marquerPresent(empId, dateStr);
      }
    });

    // ── Résultat ──────────────────────────────────────────────
    const result: Record<string, any> = {};
    employees.forEach((emp) => {
      result[emp.matricule] = { plannings: [], annotations: [] };
    });

    // ── Construire les plannings ──────────────────────────────
    for (const emp of employees) {
      const cycle = emp.cycles ?? null;
      const anchorDate = anchorMap.get(emp.id) || null;

      for (const element of toutesLesDates) {
        const dateStr = element;
        const date = new Date(dateStr);
        const presenceKey = `${emp.id}_${dateStr}`;
        const finNuitKey = `${emp.id}_${dateStr}`;
        const veilleDateStr = decalerJour(dateStr, -1);
        const veilleFinKey = `${emp.id}_${veilleDateStr}`;
        const annotKey = `${emp.matricule}_${dateStr}`;
        const planKey = `${emp.matricule}_${dateStr}`;
        const histKey = `${emp.matricule}_${dateStr}`;

        const annot = annotMap.get(annotKey) ?? null;
        const history = historyMap.get(histKey) ?? [];

        if (annot) {
          result[emp.matricule].annotations.push({
            id: annot.id,
            date: annot.date,
            code: annot.code,
            libelle: annot.libelle,
          });
        }

        let statut = "";
        let annotation_id: string | null = null;

        // 1. PRIORITÉ ABSOLUE : Les annotations explicites (M, C, A, P...)
        if (annot && ANNOT_CODES.has(annot.code)) {
          statut = annot.code;
          annotation_id = annot.id;
        }
        // 2. PRIORITÉ SECONDAIRE : Le planning modifié (si annoté)
        else if (planningMap.has(planKey)) {
          const plan = planningMap.get(planKey);
          const planAnnot = plan.annotation ?? null;

          if (planAnnot && ANNOT_CODES.has(planAnnot.code)) {
            statut = planAnnot.code;
            annotation_id = plan.annotation_id;

            if (!annot) {
              result[emp.matricule].annotations.push({
                id: planAnnot.id,
                date: planAnnot.date,
                code: planAnnot.code,
                libelle: planAnnot.libelle,
              });
            }
          } else {
            statut = plan.statut;
            annotation_id = plan.annotation_id;
          }
        }
        // 3. LOGIQUE AUTOMATIQUE (Badgeuse, Cycles & Jours Fériés)
        else if (finNuitMap.has(finNuitKey) || finNuitMap.has(veilleFinKey)) {
          statut = "R";
        } else if (presenceMap.has(presenceKey)) {
          statut = "P";
        } else {
          // 🔥 NOUVEAU : On check d'abord le repos, ensuite le Jour Férié, sinon Absence
          if (estJourRepos(date, cycle, anchorDate)) {
            statut = "R";
          } else if (
            cycle?.type === "weekly" &&
            verifierJourFerie(date, allJoursFeries)
          ) {
            statut = "JF"; // C'est un weekly et on tombe sur un jour férié sans badgeage
          } else {
            statut = "A";
          }
        }

        // Ajout final au tableau des plannings
        result[emp.matricule].plannings.push({
          id: null,
          date,
          statut,
          annotation_id,
          history,
          statut_original: (() => {
            if (finNuitMap.has(finNuitKey)) return "R";
            if (finNuitMap.has(veilleFinKey)) return "R";
            if (presenceMap.has(presenceKey)) return "P";
            if (estJourRepos(date, cycle, anchorDate)) return "R";
            // 🔥 Statut original prend en compte le JF
            if (
              cycle?.type === "weekly" &&
              verifierJourFerie(date, allJoursFeries)
            )
              return "JF";
            return "A";
          })(),
        });
      }
    }

    // ── Stats ─────────────────────────────────────────────────
    for (const emp of employees) {
      const empData = result[emp.matricule];
      const cycle = emp.cycles ?? null;
      const anchorDate = anchorMap.get(emp.id) || null;

      let presents = 0,
        absences = 0,
        absences_annotees = 0,
        repos = 0,
        presences_supplementaires = 0,
        jours_feries = 0; // 🔥 NOUVEAU: Compteur pour JF

      empData.plannings.forEach((p: any) => {
        const dateStr = new Date(p.date).toISOString().split("T")[0];
        const statut = p.statut;

        const hadPointage = presenceMap.has(`${emp.id}_${dateStr}`);
        const veilleDateStr = decalerJour(dateStr, -1);
        const estFinNuit =
          finNuitMap.has(`${emp.id}_${dateStr}`) ||
          finNuitMap.has(`${emp.id}_${veilleDateStr}`);

        const devraitR =
          estJourRepos(new Date(dateStr), cycle, anchorDate) || estFinNuit;

        if (statut === "P") {
          presents++;
          if (devraitR) presences_supplementaires++;
          if (!hadPointage && !devraitR) {
            absences++;
            absences_annotees++;
          }
        } else if (statut === "R") {
          repos++;
          if (!hadPointage && !devraitR) {
            absences++;
            absences_annotees++;
          }
        } else if (statut === "JF") {
          jours_feries++; // 🔥 On incrémente le JF sans pénaliser les absences
        } else if (ANNOT_CODES.has(statut)) {
          presents++;
          if (hadPointage) {
            if (devraitR) presences_supplementaires++;
          } else if (devraitR) {
            presences_supplementaires++;
          } else {
            absences++;
            absences_annotees++;
          }
        } else {
          absences++; // Le "A" par défaut tombe ici
        }
      });

      empData.stats = {
        presents,
        absences,
        absences_nettes: absences,
        absences_annotees,
        repos,
        jours_feries, // 🔥 Retourné dans l'objet des stats
        presences_supplementaires,
        total: empData.plannings.length,
      };
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Erreur API planning workspace:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération du planning" },
      { status: 500 },
    );
  }
}

// 🔥 FONCTION POUR VÉRIFIER LES JOURS FÉRIÉS 🔥
function verifierJourFerie(targetDate: Date, joursFeries: any[]): boolean {
  if (!joursFeries || joursFeries.length === 0) return false;

  // On normalise la date cible pour ne garder que la journée (ignorer l'heure)
  const tDate = new Date(targetDate.toISOString().split("T")[0]);
  const tTime = tDate.getTime();

  for (const jf of joursFeries) {
    const debut = new Date(jf.date_debut);
    const fin = new Date(jf.date_fin);

    if (jf.recurrent) {
      // Si c'est récurrent, on transpose les dates de début/fin à l'année de la date cible
      const startRecurrent = new Date(debut);
      startRecurrent.setFullYear(tDate.getFullYear());

      const endRecurrent = new Date(fin);
      endRecurrent.setFullYear(tDate.getFullYear());

      const sTime = new Date(
        startRecurrent.toISOString().split("T")[0],
      ).getTime();
      const eTime = new Date(
        endRecurrent.toISOString().split("T")[0],
      ).getTime();

      if (tTime >= sTime && tTime <= eTime) {
        return true;
      }
    } else {
      // Pas récurrent : on compare simplement les timestamps sans les heures
      const sTime = new Date(debut.toISOString().split("T")[0]).getTime();
      const eTime = new Date(fin.toISOString().split("T")[0]).getTime();

      if (tTime >= sTime && tTime <= eTime) {
        return true;
      }
    }
  }

  return false;
}

// 🔥 LOGIQUE ABSOLUE POUR LES ROTATIONS 🔥
function estJourRepos(
  date: Date,
  cycle: any,
  anchorDate: Date | null,
): boolean {
  if (!cycle || cycle.type === "unknown") return [5, 6].includes(date.getDay());

  if (cycle.type === "weekly") {
    try {
      return JSON.parse(cycle.rest_days || "[]").includes(date.getDay());
    } catch {
      return false;
    }
  }

  if (cycle.type === "rotation" || cycle.type === "night") {
    if (!anchorDate) return false; // Si l'employé n'a aucun historique, on ne peut pas aligner la phase

    // Calcul propre de la différence en jours (indépendant de l'heure pour éviter les soucis de fuseau)
    const targetMs = new Date(date.toISOString().split("T")[0]).getTime();
    const anchorMs = new Date(anchorDate.toISOString().split("T")[0]).getTime();
    const diffDays = Math.round((targetMs - anchorMs) / 86400000);

    const cl = (cycle.travail || 2) + (cycle.repos || 2);

    // Formule sécurisée même si on cherche une date AVANT le premier pointage (diffDays négatif)
    let position = (diffDays + (cycle.start_phase || 0)) % cl;
    if (position < 0) position += cl;

    return position >= (cycle.travail || 2);
  }

  return false;
}

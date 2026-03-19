// app/api/employees/[id]/planning/route.ts
//
// GET retourne pour chaque jour :
//   - statut          : code affiché (P, A, R, M, J, Md, Rc, C, Ce)
//   - statut_original : statut calculé depuis pointages/cycle (avant toute modif manuelle)
//   - history[]       : liste des modifications manuelles (ancien→nouveau, qui, quand)
//   - annotation      : { code, libelle } si présente
//   - source          : "calcule" | "bdd"

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifySession } from "@/actions/permissions";

const SEUIL_BADGEUSE_UNIQUE_MIN = 15;
const SEUIL_SORTIE_MATIN_MAX_H = 8;
const SEUIL_ENTREE_NUIT_MIN_H = 14;
const SEUIL_SORTIE_NUIT_MAX_H = 10;

const ANNOT_CODES = new Set(["M", "J", "Md", "Rc", "C", "Ce"]);

// ─────────────────────────────────────────────────────────────
// GET
// ─────────────────────────────────────────────────────────────
export async function GET(request: NextRequest, { params }: any) {
  try {
    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;
    const dateDebut = searchParams.get("debut");
    const dateFin = searchParams.get("fin");

    const employee = await prisma.employee.findUnique({
      where: { id },
      include: { cycles: true },
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

    // ── Fetch en parallèle ────────────────────────────────────
    const [plannings, annotations, pointages, histories] = await Promise.all([
      prisma.planning.findMany({
        where: { employee_id: id, ...dateCondition },
        include: { annotation: true },
        orderBy: { date: "asc" },
      }),

      prisma.annotation.findMany({
        where: { employee_id: id, ...dateCondition },
        orderBy: { date: "asc" },
      }),

      // J-1 pour capter les nuits commençant la veille
      prisma.pointage.findMany({
        where: {
          employee_id: id,
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
          date: true,
          heure_entree: true,
          heure_sortie: true,
          est_nuit: true,
        },
        orderBy: { date: "asc" },
      }),

      // Historique des modifications pour la période
      prisma.modification_history.findMany({
        where: { employee_id: id, ...dateCondition },
        orderBy: { created_at: "asc" },
      }),
    ]);

    // ── Charger les users pour noms ───────────────────────────
    const userIds = [
      ...new Set(
        histories.map((h) => h.created_by).filter((x): x is string => !!x),
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

    const getUserName = (userId: string | null) => {
      if (!userId) return null;
      const u = userMap.get(userId);
      if (!u) return userId;
      return (
        [u.firstname, u.lastname].filter(Boolean).join(" ") ||
        u.username ||
        userId
      );
    };

    // ── Map historique par date ───────────────────────────────
    // "dateStr" → HistoryEntry[]
    const historyByDate = new Map<string, any[]>();
    histories.forEach((h) => {
      const dateStr = h.date.toISOString().split("T")[0];
      if (!historyByDate.has(dateStr)) historyByDate.set(dateStr, []);
      historyByDate.get(dateStr)!.push({
        ancien_statut: h.ancien_statut,
        nouveau_statut: h.nouveau_statut,
        type_modification: h.type_modification,
        modifie_par: getUserName(h.created_by),
        modifie_par_id: h.created_by,
        modifie_le: h.created_at,
      });
    });

    // ── Générer toutes les dates ───────────────────────────────
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
      pointages.forEach((p) =>
        datesSet.add(p.date.toISOString().split("T")[0]),
      );
      annotations.forEach((a) =>
        datesSet.add(a.date.toISOString().split("T")[0]),
      );
      plannings.forEach((p) =>
        datesSet.add(p.date.toISOString().split("T")[0]),
      );
      toutesLesDates = Array.from(datesSet).sort();
    }

    // ── Maps ──────────────────────────────────────────────────
    const planningMap = new Map<string, any>();
    plannings.forEach((p) =>
      planningMap.set(p.date.toISOString().split("T")[0], p),
    );

    const annotMap = new Map<string, any>();
    annotations.forEach((a) =>
      annotMap.set(a.date.toISOString().split("T")[0], a),
    );

    // ── Helpers ────────────────────────────────────────────────
    const toMinutes = (heure: string) => {
      const [h, m] = heure.split(":").map(Number);
      return h * 60 + m;
    };
    const decalerJour = (dateStr: string, jours: number) =>
      new Date(new Date(dateStr).getTime() + jours * 86400000)
        .toISOString()
        .split("T")[0];

    const cycle = employee.cycles ?? null;
    const estCycleNuit = cycle?.type === "night";

    // ── presenceMap + finNuitMap ──────────────────────────────
    const presenceMap = new Map<string, boolean>();
    const finNuitMap = new Map<string, boolean>();

    pointages.forEach((p) => {
      const dateStr = p.date.toISOString().split("T")[0];
      const isNuit = estCycleNuit || (p.est_nuit ?? false);
      const entree = p.heure_entree;
      const sortie = p.heure_sortie;

      if (entree && sortie) {
        const minEntree = toMinutes(entree),
          minSortie = toMinutes(sortie);
        const ecart = Math.abs(minSortie - minEntree);

        if (
          minSortie < minEntree ||
          (minEntree >= SEUIL_ENTREE_NUIT_MIN_H * 60 &&
            minSortie <= SEUIL_SORTIE_NUIT_MAX_H * 60)
        ) {
          presenceMap.set(dateStr, true);
          finNuitMap.set(decalerJour(dateStr, +1), true);
          return;
        }
        if (
          minEntree < SEUIL_SORTIE_MATIN_MAX_H * 60 &&
          minSortie >= SEUIL_ENTREE_NUIT_MIN_H * 60 &&
          isNuit
        ) {
          presenceMap.set(dateStr, true);
          finNuitMap.set(decalerJour(dateStr, +1), true);
          return;
        }
        if (
          ecart < SEUIL_BADGEUSE_UNIQUE_MIN &&
          minSortie < SEUIL_SORTIE_MATIN_MAX_H * 60 &&
          isNuit
        ) {
          finNuitMap.set(dateStr, true);
          presenceMap.set(decalerJour(dateStr, -1), true);
          return;
        }
        presenceMap.set(dateStr, true);
      } else if (!entree && sortie) {
        const minSortie = toMinutes(sortie);
        if (minSortie < SEUIL_SORTIE_MATIN_MAX_H * 60 && isNuit) {
          finNuitMap.set(dateStr, true);
          presenceMap.set(decalerJour(dateStr, -1), true);
        } else presenceMap.set(dateStr, true);
      } else if (entree && !sortie) {
        const minEntree = toMinutes(entree);
        if (minEntree >= SEUIL_ENTREE_NUIT_MIN_H * 60 && isNuit) {
          presenceMap.set(dateStr, true);
          finNuitMap.set(decalerJour(dateStr, +1), true);
        } else presenceMap.set(dateStr, true);
      } else {
        presenceMap.set(dateStr, true);
      }
    });

    // ─────────────────────────────────────────────────────────
    // Construire les jours
    // ─────────────────────────────────────────────────────────

    const jours: any[] = [];

    for (let i = 0; i < toutesLesDates.length; i++) {
      const dateStr = toutesLesDates[i];
      const date = new Date(dateStr);
      const veilleDateStr = decalerJour(dateStr, -1);
      const annot = annotMap.get(dateStr) ?? null;
      const history = historyByDate.get(dateStr) ?? [];

      // ── Statut original (calculé depuis pointages/cycle) ────
      // = ce que le système calcule sans tenir compte du planning BDD
      const statutOriginal = (() => {
        if (finNuitMap.has(dateStr)) return "R";
        if (finNuitMap.has(veilleDateStr)) return "R";
        if (presenceMap.has(dateStr)) {
          return annot && ANNOT_CODES.has(annot.code) ? annot.code : "P";
        }
        if (annot && ANNOT_CODES.has(annot.code)) return annot.code;
        return estJourRepos(date, cycle, i) ? "R" : "A";
      })();

      // ── Statut final (avec planning BDD) ────────────────────
      let statut = statutOriginal;
      let source: string = "calcule";
      let annotRetour: any = annot
        ? { id: annot.id, code: annot.code, libelle: annot.libelle }
        : null;

      // Si planning BDD existe → il peut surcharger
      if (planningMap.has(dateStr)) {
        const plan = planningMap.get(dateStr);
        const planAnnot = plan.annotation ?? null;
        source = "bdd";
        if (planAnnot && ANNOT_CODES.has(planAnnot.code)) {
          statut = planAnnot.code;
          annotRetour = {
            id: planAnnot.id,
            code: planAnnot.code,
            libelle: planAnnot.libelle,
          };
        } else {
          statut = plan.statut;
        }
      }

      jours.push({
        date: dateStr,
        statut,
        statut_original: statutOriginal,
        source,
        annotation: annotRetour,
        history,
        pointage: null, // sera enrichi si besoin
      });
    }

    // ── Historique global (toutes les modifications) ──────────
    const historiqueGlobal = histories.map((h) => ({
      id: h.id,
      date: h.date,
      ancien_statut: h.ancien_statut,
      nouveau_statut: h.nouveau_statut,
      type_modification: h.type_modification,
      description: h.description,
      modifie_par: getUserName(h.created_by),
      modifie_par_id: h.created_by,
      modifie_le: h.created_at,
    }));

    return NextResponse.json({
      employee: {
        id: employee.id,
        matricule: employee.matricule,
        nom: employee.nom,
        prenom: employee.prenom,
      },
      periode: { debut: dateDebut, fin: dateFin },
      total: jours.length,
      jours,
      historique_global: historiqueGlobal,
    });
  } catch (error) {
    console.error("Erreur API planning employé:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────
// POST
// ─────────────────────────────────────────────────────────────
export async function POST(request: NextRequest, { params }: any) {
  try {
    const session = await verifySession();
    if (!session?.data?.user) {
      return NextResponse.json(
        { message: "Vous devez être connecté" },
        { status: 401 },
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { date, statut, annotation } = body;

    const employee = await prisma.employee.findUnique({ where: { id } });
    if (!employee) {
      return NextResponse.json(
        { error: "Employé non trouvé" },
        { status: 404 },
      );
    }

    const dateObj = new Date(date);
    let annotationId: string | null = null;

    if (annotation && ANNOT_CODES.has(annotation.code)) {
      const upserted = await prisma.annotation.upsert({
        where: {
          employee_id_date: { employee_id: employee.id, date: dateObj },
        },
        update: {
          code: annotation.code,
          libelle: annotation.libelle,
          description: annotation.description ?? null,
          updated_at: new Date(),
        },
        create: {
          employee_id: employee.id,
          date: dateObj,
          code: annotation.code,
          libelle: annotation.libelle,
          description: annotation.description ?? null,
          created_by: session.data.user.id,
        },
      });
      annotationId = upserted.id;
    } else if (!annotation) {
      await prisma.annotation.deleteMany({
        where: { employee_id: employee.id, date: dateObj },
      });
    }

    const planning = await prisma.planning.upsert({
      where: { employee_id_date: { employee_id: employee.id, date: dateObj } },
      update: {
        statut,
        annotation_id: annotationId,
        updated_at: new Date(),
        created_by: session.data.user.id,
      },
      create: {
        employee_id: employee.id,
        date: dateObj,
        statut,
        annotation_id: annotationId,
        created_by: session.data.user.id,
      },
    });

    await prisma.modification_history.create({
      data: {
        employee_id: employee.id,
        date: dateObj,
        nouveau_statut: annotation?.code ?? statut,
        type_modification: annotation ? "annotation" : "base",
        created_by: session.data.user.id,
      },
    });

    return NextResponse.json({
      planning,
      annotation: annotationId ? { id: annotationId } : null,
    });
  } catch (error) {
    console.error("Erreur POST planning employé:", error);
    return NextResponse.json(
      { error: "Erreur lors de la modification du planning" },
      { status: 500 },
    );
  }
}

function estJourRepos(
  date: Date,
  cycle: any,
  indexDepuisDebut: number,
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
    const cl = (cycle.travail || 2) + (cycle.repos || 2);
    return (
      (indexDepuisDebut + (cycle.start_phase || 0)) % cl >= (cycle.travail || 2)
    );
  }
  return false;
}

"use server";
// app/api/workspaces/import/route.ts

import { verifySession } from "@/actions/permissions";
import { prisma } from "@/lib/db";

// ─── Constantes ───────────────────────────────────────────────
// (ajouter si nécessaire des constantes comme ANNOT_LABELS)

// ─── POST handler ─────────────────────────────────────────────
export async function importWorkspace(formData: FormData, workspaceId: string) {
  try {
    const file = formData.get("file") as File;
    if (!file) throw new Error("Fichier manquant");

    const fileContent = await file.text();
    const data = JSON.parse(fileContent);

    const session = await verifySession();
    if (!session?.data?.user) {
      return {
        status: 401,
        data: { message: "Vous devez être connecté" },
      };
    }
    // ── Validation basique ─────────────────────────────────
    if (!data.workspace || !Array.isArray(data.employees)) {
      return {
        status: 400,
        data: {
          error: "Format invalide — champs 'workspace' et 'employees' requis",
        },
      };
    }

    const workspaceData = data.workspace;
    const employeesData = data.employees ?? [];
    const pointagesData = data.pointages ?? {};
    const planningsData = data.plannings ?? {};
    const annotationsData = data.annotations ?? {};
    const cyclesData = data.cycles ?? {};
    const historiesData = data.histories ?? {};

    // ── Résumé de l'import ─────────────────────────────────
    const summary = {
      total_employees: employeesData.length,
      workspaces_crees: 0,
      employees_crees: 0,
      pointages_crees: 0,
      plannings_crees: 0,
      annotations_crees: 0,
      cycles_crees: 0,
      histories_crees: 0,
      erreurs: [] as string[],
    };

    // ══════════════════════════════════════════════════════
    // 1. Créer le workspace
    // ══════════════════════════════════════════════════════
    let workspace;
    try {
      workspace = await prisma.workspace.update({
        where: {
          id: workspaceId,
        },
        data: {
          nom: workspaceData.nom,
          emp_count: workspaceData.emp_count ?? 0,
          days_count: workspaceData.days_count ?? 0,
          saved_at: workspaceData.saved_at
            ? new Date(workspaceData.saved_at)
            : null,
        },
      });
      summary.workspaces_crees++;
    } catch (wsErr: any) {
      summary.erreurs.push(`Workspace: ${wsErr.message}`);
      return {
        status: 400,
        data: {
          message: "Import échoué",
          summary: {
            ...summary,
            erreurs: summary.erreurs.slice(0, 20),
            erreurs_total: summary.erreurs.length,
          },
        },
      };
    }

    // ══════════════════════════════════════════════════════
    // BOUCLE PRINCIPALE — un employé à la fois
    // ══════════════════════════════════════════════════════
    for (const emp of employeesData) {
      try {
        // ── 1. Créer l'employé ──────────────────────────────
        const employee = await prisma.employee.create({
          data: {
            matricule: emp.matricule,
            nom: emp.nom ?? null,
            prenom: emp.prenom ?? null,
            poste: emp.poste ?? null,
            zone: emp.zone ?? null,
            workspace_id: workspaceId,
          },
        });
        summary.employees_crees++;

        // ── 2. Pointages ────────────────────────────────────
        const empPointages =
          pointagesData[emp.matricule] ?? emp.pointages ?? [];
        if (empPointages.length > 0) {
          for (const pointage of empPointages) {
            try {
              await prisma.pointage.create({
                data: {
                  employee_id: employee.id,
                  date: new Date(pointage.date),
                  heure_entree: pointage.heure_entree ?? null,
                  heure_sortie: pointage.heure_sortie ?? null,
                  est_nuit: pointage.est_nuit ?? false,
                  type_creation: pointage.type_creation ?? "json_import",
                  created_by: pointage.created_by ?? session.data.user.id,
                },
              });
              summary.pointages_crees++;
            } catch (pointageErr: any) {
              summary.erreurs.push(
                `${emp.matricule}/pointage/${pointage.date}: ${pointageErr.message}`,
              );
            }
          }
        }

        // ── 3. Plannings + Annotations ──────────────────────
        const empPlannings =
          planningsData[emp.matricule] ?? emp.plannings ?? [];

        for (const pl of empPlannings) {
          try {
            let annotationId: string | null = null;

            // Créer l'annotation si elle existe
            if (pl.annotation) {
              const annotation = await prisma.annotation.create({
                data: {
                  employee_id: employee.id,
                  code: pl.annotation.code,
                  libelle: pl.annotation.libelle,
                  date: new Date(pl.annotation.date),
                  description: pl.annotation.description ?? null,
                  created_by: pl.annotation.created_by ?? session.data.user.id,
                },
              });
              annotationId = annotation.id;
              summary.annotations_crees++;
            }

            // Créer le planning
            await prisma.planning.create({
              data: {
                employee_id: employee.id,
                date: new Date(pl.date),
                statut: pl.statut,
                annotation_id: annotationId,
                created_by: pl.created_by ?? session.data.user.id,
              },
            });
            summary.plannings_crees++;
          } catch (planningErr: any) {
            summary.erreurs.push(
              `${emp.matricule}/planning/${pl.date}: ${planningErr.message}`,
            );
          }
        }

        // ── 4. Annotations standalone ───────────────────────
        const empAnnotations =
          annotationsData[emp.matricule] ?? emp.annotations_standalone ?? [];
        if (empAnnotations.length > 0) {
          for (const annot of empAnnotations) {
            try {
              await prisma.annotation.create({
                data: {
                  employee_id: employee.id,
                  code: annot.code,
                  libelle: annot.libelle,
                  date: new Date(annot.date),
                  description: annot.description ?? null,
                  created_by: annot.created_by ?? session.data.user.id,
                },
              });
              summary.annotations_crees++;
            } catch (annotErr: any) {
              summary.erreurs.push(
                `${emp.matricule}/annotation/${annot.date}: ${annotErr.message}`,
              );
            }
          }
        }

        // ── 5. Cycle ────────────────────────────────────────
        const empCycle = cyclesData[emp.matricule] ?? emp.cycle;
        if (empCycle) {
          try {
            await prisma.cycle.create({
              data: {
                employee_id: employee.id,
                type: empCycle.type,
                rest_days: empCycle.rest_days ?? null,
                travail: empCycle.travail ?? null,
                repos: empCycle.repos ?? null,
                start_phase: empCycle.start_phase ?? 0,
                fiabilite: empCycle.fiabilite ?? null,
                est_manuel: empCycle.est_manuel ?? false,
                created_by: empCycle.created_by ?? session.data.user.id,
              },
            });
            summary.cycles_crees++;
          } catch (cycleErr: any) {
            summary.erreurs.push(`${emp.matricule}/cycle: ${cycleErr.message}`);
          }
        }

        // ── 6. Historique ───────────────────────────────────
        const empHistories =
          historiesData[emp.matricule] ?? emp.modification_histories ?? [];
        if (empHistories.length > 0) {
          for (const hist of empHistories) {
            try {
              await prisma.modification_history.create({
                data: {
                  employee_id: employee.id,
                  date: new Date(hist.date),
                  ancien_statut: hist.ancien_statut ?? null,
                  nouveau_statut: hist.nouveau_statut ?? null,
                  type_modification: hist.type_modification,
                  description: hist.description ?? null,
                  created_by: hist.created_by ?? session.data.user.id,
                },
              });
              summary.histories_crees++;
            } catch (histErr: any) {
              summary.erreurs.push(
                `${emp.matricule}/history/${hist.date}: ${histErr.message}`,
              );
            }
          }
        }
      } catch (empErr: any) {
        summary.erreurs.push(
          `${emp.matricule ?? "inconnu"}: ${empErr.message}`,
        );
      }
    }

    // ── Mise à jour du nombre d'employés ─────────────────────
    if (summary.employees_crees > 0) {
      await prisma.workspace.update({
        where: { id: workspace.id },
        data: { emp_count: summary.employees_crees },
      });
    }

    return {
      status: 200,
      data: {
        message: "Import terminé",
        summary: {
          ...summary,
          erreurs: summary.erreurs.slice(0, 20),
          erreurs_total: summary.erreurs.length,
        },
      },
    };
  } catch (error: any) {
    console.error("Erreur import workspace JSON:", error);
    return {
      status: 500,
      data: { error: "Erreur lors de l'import", detail: error.message },
    };
  }
}

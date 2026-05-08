// app/api/employees/import/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import * as XLSX from "xlsx";
import { verifySession } from "@/actions/permissions";

export async function POST(request: NextRequest) {
  try {
    const session = await verifySession();
    if (!session?.data?.user) {
      return NextResponse.json(
        { message: "Vous devez être connecté" },
        { status: 401 },
      );
    }
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const mode = formData.get("mode") || "nouveau"; // 'nouveau' ou 'fusion'
    const type = formData.get("type") || "pointages"; // 'pointages' ou 'staff'
    const workspaceId = formData.get("workspaceId") as string;

    if (!file) {
      return NextResponse.json(
        { error: "Aucun fichier fourni" },
        { status: 400 },
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    if (type === "staff") {
      // Import base personnel (6 colonnes: Matricule, Nom, Prénom, Poste, Zone, Département)
      return await importStaff(rows, mode as string, workspaceId);
    } else {
      // Import pointages (4 colonnes: Matricule, Date, Entrée, Sortie)
      return await importPointages(rows, mode as string, workspaceId);
    }
  } catch (error) {
    return NextResponse.json(
      { error: "Erreur lors de l'import: " + (error as Error).message },
      { status: 500 },
    );
  }
}

async function importStaff(rows: any[], mode: string, workspaceId: string) {
  const stats = { ajoutes: 0, misAJour: 0, ignores: 0 };

  for (const element of rows) {
    const row = element as any[];

    if (!row || row.length < 1) {
      continue;
    }

    const [matricule, nom, prenom, poste, zoneRaw, departementRaw] = row.map(
      (val: any) => (val == null ? "" : String(val).trim()),
    );

    if (!matricule) {
      continue;
    }

    if (matricule.toLowerCase() === "matricule") continue;

    // ── 1. Gestion des Zones (Virgule, Majuscule, Sans Espaces) ──
    const zoneIds: string[] = [];
    if (zoneRaw) {
      // Séparer par virgule
      const zonesList = zoneRaw.split(",");

      for (const z of zonesList) {
        // Enlever TOUS les espaces et mettre en majuscule (ex: " zone 2 " -> "ZONE2")
        // const zoneName = z.replace(/\s+/g, "").toUpperCase();
        // new maj : Enlever  les espaces juste au debut et a la fin et mettre en majuscule
        const zoneName = z.trim().toUpperCase();

        if (!zoneName) continue; // Si c'était juste des espaces ou vide

        // Vérifier si elle existe kima hiya
        let zoneRecord = await prisma.zone.findFirst({
          where: { name: zoneName, workspace_id: workspaceId },
        });

        // Sinon, créer la zone
        if (!zoneRecord) {
          zoneRecord = await prisma.zone.create({
            data: { name: zoneName, workspace_id: workspaceId },
          });
        }

        // Ajouter l'ID à notre liste pour cet employé
        if (!zoneIds.includes(zoneRecord.id)) {
          zoneIds.push(zoneRecord.id);
        }
      }
    }

    // ── 2. Gestion du Département ──
    let depId = null;
    if (departementRaw) {
      const depName = departementRaw.toUpperCase();
      let depRecord = await prisma.departmenet.findFirst({
        where: { name: depName, workspace_id: workspaceId },
      });
      if (!depRecord) {
        depRecord = await prisma.departmenet.create({
          data: { name: depName, workspace_id: workspaceId },
        });
      }
      depId = depRecord.id;
    }

    // ── 3. Gestion de l'Employé ──
    const existing = await prisma.employee.findFirst({
      where: { matricule: matricule, workspace_id: workspaceId },
    });

    if (existing && mode === "fusion") {
      // Mise à jour de l'employé
      await prisma.employee.update({
        where: { id: existing.id },
        data: {
          nom: nom || existing.nom,
          prenom: prenom || existing.prenom,
          poste: poste || existing.poste,
          departmenet_id: depId || existing.departmenet_id,
        },
      });

      // Lier les zones si elles ne sont pas déjà liées
      for (const zId of zoneIds) {
        const linkExists = await prisma.zone_employe.findFirst({
          where: { employee_id: existing.id, zone_id: zId },
        });
        if (!linkExists) {
          await prisma.zone_employe.create({
            data: { employee_id: existing.id, zone_id: zId },
          });
        }
      }
      stats.misAJour++;
    } else if (!existing) {
      // Création de l'employé
      await prisma.employee.create({
        data: {
          matricule: matricule,
          nom: nom || null,
          prenom: prenom || null,
          poste: poste || null,
          workspace_id: workspaceId,
          departmenet_id: depId,
          cycles: { create: { type: "unknown", est_manuel: false } },
          // Création directe des liaisons dans la table zone_employe
          ...(zoneIds.length > 0
            ? {
                zoneEmployes: {
                  create: zoneIds.map((zId) => ({ zone_id: zId })),
                },
              }
            : {}),
        },
      });
      stats.ajoutes++;
    } else {
      stats.ignores++;
    }
  }

  return NextResponse.json({
    message: "Import terminé",
    stats,
  });
}

// Le reste du fichier (importPointages, parseDate, detecterNuit, recalculerTousPlannings) reste exactement pareil...
async function importPointages(rows: any[], mode: string, workspaceId: string) {
  const stats = { nouveaux: 0, existants: 0, ignores: 0 };

  for (const row of rows) {
    if (!row || row.length < 2) {
      stats.ignores++;
      continue;
    }

    const [matricule, dateRaw, entree, sortie] = row;

    if (
      !matricule?.toString().trim() ||
      matricule.toString().toLowerCase() === "matricule"
    ) {
      stats.ignores++;
      continue;
    }

    const employee = await prisma.employee.findFirst({
      where: {
        matricule: matricule.toString().trim(),
        workspace_id: workspaceId,
      },
    });

    if (!employee) {
      stats.ignores++;
      continue;
    }

    const date = parseDate(dateRaw);
    if (!date) {
      stats.ignores++;
      continue;
    }

    const existing = await prisma.pointage.findUnique({
      where: {
        employee_id_date: {
          employee_id: employee.id,
          date,
        },
      },
    });

    if (existing && mode === "fusion") {
      // Mise à jour
      await prisma.pointage.update({
        where: { id: existing.id },
        data: {
          heure_entree: entree?.toString().trim() || existing.heure_entree,
          heure_sortie: sortie?.toString().trim() || existing.heure_sortie,
          est_nuit: detecterNuit(
            entree?.toString().trim() || existing.heure_entree,
            sortie?.toString().trim() || existing.heure_sortie,
          ),
        },
      });
      stats.existants++;
    } else if (!existing) {
      // Création
      await prisma.pointage.create({
        data: {
          employee_id: employee.id,
          date,
          heure_entree: entree?.toString().trim(),
          heure_sortie: sortie?.toString().trim(),
          est_nuit: detecterNuit(
            entree?.toString().trim(),
            sortie?.toString().trim(),
          ),
        },
      });
      stats.nouveaux++;
    }
  }

  await recalculerTousPlannings();

  return NextResponse.json({
    message: "Import des pointages terminé",
    stats,
  });
}

function parseDate(val: any): Date | null {
  if (!val) return null;
  if (val instanceof Date) return val;

  const str = String(val).trim();

  let match = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (match) {
    return new Date(
      `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`,
    );
  }

  match = str.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
  if (match) {
    return new Date(
      `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`,
    );
  }

  const num = parseFloat(str);
  if (!isNaN(num) && num > 40000) {
    return new Date((num - 25569) * 86400000);
  }

  return null;
}

function detecterNuit(entree?: string, sortie?: string): boolean {
  if (!entree || !sortie) return false;

  const parse = (s: string) => {
    const match = s.match(/(\d{1,2})[:\s](\d{2})/);
    return match ? parseInt(match[1]) * 60 + parseInt(match[2]) : 0;
  };

  const t1 = parse(entree);
  const t2 = parse(sortie);

  return t2 < t1 && t1 > 720;
}

async function recalculerTousPlannings() {
  // Logique de recalcul (sera implémentée dans la route dédiée)
  // Appeler /api/planning/recalcul
}

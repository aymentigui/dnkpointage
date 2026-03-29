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
      // Import base personnel (5 colonnes: Matricule, Nom, Prénom, Poste, Zone)
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

  for (const row of rows) {
    if (!row || row.length < 5) {
      stats.ignores++;
      continue;
    }
    const [matricule, nom, prenom, poste, zone] = row.map(String);

    if (!matricule?.trim()) {
      stats.ignores++;
      continue;
    }

    const existing = await prisma.employee.findFirst({
      where: { matricule: matricule.trim(), workspace_id: workspaceId },
    });

    if (existing && mode === "fusion") {
      // Mise à jour
      await prisma.employee.update({
        where: { id: existing.id },
        data: {
          nom: nom?.trim() || existing.nom,
          prenom: prenom?.trim() || existing.prenom,
          poste: poste?.trim() || existing.poste,
          zone: zone?.trim() || existing.zone,
        },
      });
      stats.misAJour++;
    } else if (!existing) {
      // Création
      await prisma.employee.create({
        data: {
          matricule: matricule.trim(),
          nom: nom?.trim(),
          prenom: prenom?.trim(),
          poste: poste?.trim(),
          zone: zone?.trim(),
          workspace_id: workspaceId,
          cycles: { create: { type: "unknown" } },
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

async function importPointages(rows: any[], mode: string, workspaceId: string) {
  const stats = { nouveaux: 0, existants: 0, ignores: 0 };

  for (const row of rows) {
    if (!row || row.length < 2) {
      stats.ignores++;
      continue;
    }

    const [matricule, dateRaw, entree, sortie] = row;

    if (!matricule?.toString().trim()) {
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

  // Déclencher le recalcul automatique des plannings
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

  // Format DD/MM/YYYY
  let match = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (match) {
    return new Date(
      `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`,
    );
  }

  // Format YYYY-MM-DD
  match = str.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
  if (match) {
    return new Date(
      `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`,
    );
  }

  // Excel serial
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

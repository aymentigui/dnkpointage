import { NextResponse } from "next/server";
import { prisma } from "@/lib/db"; // Ajuste le chemin selon ton projet

export async function GET() {
  try {
    // 1. Récupérer tous les employés qui ont une zone textuelle
    const employees = await prisma.employee.findMany({
      where: {
        zone: { not: null },
      },
    });

    let stats = {
      employesTraites: 0,
      zonesCreees: 0,
      liaisonsCreees: 0,
    };

    for (const emp of employees) {
      if (!emp.zone || !emp.workspace_id) continue;

      // 2. Séparer par virgule, enlever les espaces, et mettre en MAJUSCULE
      const zonesTexte = emp.zone
        .split(",")
        .map((z) => z.trim().toUpperCase())
        .filter((z) => z.length > 0);

      for (const zoneName of zonesTexte) {
        // 3. Chercher si la zone existe déjà dans ce workspace
        let zoneRecord = await prisma.zone.findFirst({
          where: {
            name: zoneName,
            workspace_id: emp.workspace_id,
          },
        });

        // Si elle n'existe pas, on la crée
        if (!zoneRecord) {
          zoneRecord = await prisma.zone.create({
            data: {
              name: zoneName,
              workspace_id: emp.workspace_id,
            },
          });
          stats.zonesCreees++;
        }

        // 4. Lier l'employé à cette zone (si ce n'est pas déjà fait)
        const existingLink = await prisma.zone_employe.findFirst({
          where: {
            zone_id: zoneRecord.id,
            employee_id: emp.id,
          },
        });

        if (!existingLink) {
          await prisma.zone_employe.create({
            data: {
              zone_id: zoneRecord.id,
              employee_id: emp.id,
            },
          });
          stats.liaisonsCreees++;
        }
      }
      stats.employesTraites++;
    }

    return NextResponse.json({
      message: "Migration des zones réussie !",
      stats,
    });
  } catch (error) {
    console.error("Erreur migration:", error);
    return NextResponse.json(
      { error: "Erreur lors de la migration" },
      { status: 500 },
    );
  }
}

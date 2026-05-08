// app/api/employees/export/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import * as XLSX from "xlsx";
import {
  verifySession,
  withAuthorizationPermission,
} from "@/actions/permissions";

// Change from GET to POST
export async function POST(request: NextRequest) {
  try {
    const session = await verifySession();
    if (!session?.data?.user) {
      return NextResponse.json(
        { message: "Vous devez être connecté" },
        { status: 401 },
      );
    }

    const hasPermissionAdd = await withAuthorizationPermission([
      "view_employe",
    ]);

    if (
      hasPermissionAdd.status != 200 ||
      !hasPermissionAdd.data.hasPermission
    ) {
      return NextResponse.json(
        { message: "Vous n'avez pas la permission de voir les employés" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { ids, workspaceId } = body;

    // ── Construire le where ───────────────────────────────────
    const where: any = {};

    if (ids && Array.isArray(ids) && ids.length > 0) {
      where.id = { in: ids };
    } else if (workspaceId) {
      where.workspace_id = workspaceId;
    } else {
      return NextResponse.json({ error: "Aucun ID fourni" }, { status: 400 });
    }

    // ── Fetch employés avec les nouvelles relations ───────────
    const employees = await prisma.employee.findMany({
      where,
      include: {
        cycles: true,
        departmenet: true, // NOUVEAU: Inclure le département
        zoneEmployes: {
          // NOUVEAU: Inclure les zones via la table de liaison
          include: {
            zone: true,
          },
        },
        _count: {
          select: {
            pointages: true,
            annotations: true,
          },
        },
      },
      orderBy: { matricule: "asc" },
    });

    if (employees.length === 0) {
      return NextResponse.json(
        { error: "Aucun employé trouvé" },
        { status: 404 },
      );
    }

    // ── Helpers ───────────────────────────────────────────────
    const getCycleLabel = (cycle: any): string => {
      if (!cycle) return "—";
      if (cycle.type === "weekly") {
        try {
          let days = JSON.parse(cycle.rest_days || "[]");
          if (typeof days === "string") days = JSON.parse(days);
          return `Repos: ${days.map((d: number) => ["Di", "Lu", "Ma", "Me", "Je", "Ve", "Sa"][d]).join("+")}`;
        } catch {
          return "weekly";
        }
      }
      if (cycle.type === "rotation") return `${cycle.travail}T/${cycle.repos}R`;
      if (cycle.type === "night")
        return `Nuit ${cycle.travail}T/${cycle.repos}R`;
      if (cycle.type === "unknown") return "Inconnu";
      return cycle.type;
    };

    // ── Construire le sheet ───────────────────────────────────
    const headers = [
      "Matricule",
      "Nom",
      "Prénom",
      "Poste",
      "Département", // Ajouté
      "Zone(s)", // Modifié
      "Statut", // Ajouté (Actif/Inactif)
      "Cycle",
      "Type cycle",
      "Manuel",
      "Nb pointages",
      "Nb annotations",
    ];

    const rows = employees.map((emp) => {
      // Extraire le nom des zones et les joindre avec une virgule s'il y en a plusieurs
      const zonesString =
        emp.zoneEmployes && emp.zoneEmployes.length > 0
          ? emp.zoneEmployes.map((ze) => ze.zone.name).join(", ")
          : "—";

      return [
        emp.matricule,
        emp.nom ?? "",
        emp.prenom ?? "",
        emp.poste ?? "",
        emp.departmenet?.name ?? "—", // Extraction du nom du département
        zonesString, // Extraction des zones
        emp.active ? "Actif" : "Inactif", // Affichage du statut
        getCycleLabel(emp.cycles),
        emp.cycles?.type ?? "—",
        emp.cycles?.est_manuel ? "Oui" : "Non",
        emp._count.pointages,
        emp._count.annotations,
      ];
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

    ws["!cols"] = [
      { wch: 14 }, // Matricule
      { wch: 18 }, // Nom
      { wch: 18 }, // Prénom
      { wch: 20 }, // Poste
      { wch: 20 }, // Département (Nouveau)
      { wch: 25 }, // Zone(s) (Ajusté pour plusieurs zones)
      { wch: 12 }, // Statut (Nouveau)
      { wch: 22 }, // Cycle
      { wch: 12 }, // Type cycle
      { wch: 8 }, // Manuel
      { wch: 12 }, // Pointages
      { wch: 14 }, // Annotations
    ];

    XLSX.utils.book_append_sheet(wb, ws, "Employés");

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const dateStr = new Date().toISOString().split("T")[0];

    return new NextResponse(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="employes_${dateStr}.xlsx"`,
      },
    });
  } catch (error) {
    console.error("Erreur export employés:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'export" },
      { status: 500 },
    );
  }
}

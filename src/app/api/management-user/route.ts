import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  verifySession,
  withAuthorizationPermission,
} from "@/actions/permissions";
export async function GET() {
  try {
    const session = await verifySession();
    if (!session?.data?.user) {
      return NextResponse.json(
        { message: "Vous devez être connecté" },
        { status: 401 },
      );
    }

    const hasPermissionAdd = await withAuthorizationPermission([
      "permission_view",
    ]);
    if (
      hasPermissionAdd.status != 200 ||
      !hasPermissionAdd.data.hasPermission
    ) {
      return NextResponse.json(
        { message: "Vous n'avez pas la permission de voir les permissions" },
        { status: 403 },
      );
    }
    // Récupérer les utilisateurs avec leurs permissions actuelles
    const users = await prisma.user.findMany({
      select: {
        id: true,
        firstname: true,
        lastname: true,
        email: true,
        userManagedDepartmenets: { select: { departmenet_id: true } },
        userManagedEmployees: { select: { employee_id: true } },
      },
    });

    const departments = await prisma.departmenet.findMany({
      select: { id: true, name: true },
    });

    const employees = await prisma.employee.findMany({
      select: { id: true, nom: true, prenom: true, matricule: true },
    });

    return NextResponse.json({ users, departments, employees });
  } catch (error) {
    return NextResponse.json(
      { error: "Erreur lors de la récupération des données" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId, departmentIds, employeeIds } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "L'ID de l'utilisateur est requis" },
        { status: 400 },
      );
    }

    // Utilisation d'une transaction Prisma pour s'assurer que tout s'exécute correctement
    await prisma.$transaction(async (tx) => {
      // 1. Supprimer les anciennes permissions de cet utilisateur
      await tx.user_managed_departmenet.deleteMany({
        where: { user_id: userId },
      });
      await tx.user_managed_employee.deleteMany({ where: { user_id: userId } });

      // 2. Ajouter les nouvelles permissions pour les départements
      if (departmentIds && departmentIds.length > 0) {
        await tx.user_managed_departmenet.createMany({
          data: departmentIds.map((deptId: string) => ({
            user_id: userId,
            departmenet_id: deptId,
          })),
        });
      }

      // 3. Ajouter les nouvelles permissions pour les employés
      if (employeeIds && employeeIds.length > 0) {
        await tx.user_managed_employee.createMany({
          data: employeeIds.map((empId: string) => ({
            user_id: userId,
            employee_id: empId,
          })),
        });
      }
    });

    return NextResponse.json({
      message: "Permissions mises à jour avec succès",
    });
  } catch (error) {
    // console.error(error);
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour" },
      { status: 500 },
    );
  }
}

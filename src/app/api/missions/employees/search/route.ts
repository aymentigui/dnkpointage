import { NextResponse } from "next/server";
import {
  verifySession,
  withAuthorizationPermission,
} from "@/actions/permissions";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  const session = await verifySession();
  if (!session?.data?.user)
    return NextResponse.json({ message: "Non autorisé" }, { status: 401 });

  const hasPerm = await withAuthorizationPermission(["mission_view"]);
  if (hasPerm.status !== 200 || !hasPerm.data.hasPermission) {
    return NextResponse.json(
      { message: "Permission refusée" },
      { status: 403 },
    );
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";

  if (q.length < 2) return NextResponse.json([]); // Sécurité backend

  const employees = await prisma.employee.findMany({
    where: {
      OR: [
        { nom: { contains: q } },
        { prenom: { contains: q } },
        { matricule: { contains: q } },
      ],
      AND: [
        {
          OR: [
            {
              userManagedEmployees: { some: { user_id: session.data.user.id } },
            },
            {
              departmenet: {
                userManagedDepartmenets: {
                  some: { user_id: session.data.user.id },
                },
              },
            },
          ],
        },
      ],
    },
    select: { id: true, nom: true, prenom: true, matricule: true },
    take: 10,
  });

  return NextResponse.json(employees);
}

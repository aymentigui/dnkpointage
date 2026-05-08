import { NextResponse } from "next/server";
import { verifySession } from "@/actions/permissions";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  const session = await verifySession();
  if (!session?.data?.user)
    return NextResponse.json({ message: "Non autorisé" }, { status: 401 });

  const directions = await prisma.departmenet.findMany({
    where: {
      userManagedDepartmenets: {
        some: { user_id: session.data.user.id },
      },
    },
    select: { id: true, name: true },
  });

  return NextResponse.json(directions);
}

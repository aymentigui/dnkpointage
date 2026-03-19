import { getRoles } from "@/actions/roles/get";
import { AddRole } from "@/actions/roles/set";
import { NextResponse } from "next/server";

export async function GET(request: Request) {

    const res=await getRoles()

    return NextResponse.json( res.data);
}

export async function POST(request: Request) {

    const { name, permissions } = await request.json();

    const res=await AddRole(name, permissions)

    return NextResponse.json(res);
}
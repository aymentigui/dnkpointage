import { deleteRole } from "@/actions/roles/delete";
import { getRole } from "@/actions/roles/get";
import { UpdateRole } from "@/actions/roles/update";
import { NextResponse } from "next/server";

export async function GET(request: Request, { params }: { params: any }) {

    const paramsID = await params

    const role = await getRole(paramsID.id)

    return NextResponse.json(role);
}


export async function PUT(request: Request, { params }: { params: any }) {

    const paramsID = await params

    const {name, permissions} = await request.json();

    const role = await UpdateRole(paramsID.id, name, permissions)

    return NextResponse.json(role);
}

export async function DELETE(request: Request, { params }: { params: any }) {

    const paramsID = await params

    const role = await deleteRole(paramsID.id)
   

    return NextResponse.json(role);
}
import { AddRole } from "@/actions/roles/set";
import { getCountUsers, getUsers } from "@/actions/users/get";
import { createUser } from "@/actions/users/set";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {

    const searchQuery = request.nextUrl.searchParams.get("search");
    const page = request.nextUrl.searchParams.get("page");
    const pageSize = request.nextUrl.searchParams.get("pageSize");
    const count = request.nextUrl.searchParams.get("count");

    let res;

    if (count) {
        res = await getCountUsers(searchQuery || "")
    } else {
        res = await getUsers(page ? Number(page) : 1, pageSize ? Number(pageSize) : 10, searchQuery || "")
    }

    return NextResponse.json(res.data);
}

export async function POST(request: NextRequest) {

    const data= await request.formData();
    let image = data.get("file") as unknown as File;
    const firstname = data.get("firstname") as string;
    const lastname = data.get("lastname") as string;
    const username = data.get("username") as string;
    const email = data.get("email") as string;
    const password = data.get("password") as string;
    const is_admin = data.get("is_admin") === "true";
    const roles = JSON.parse(data.get("roles") as string);

    if (!image) 
        image = new File([], "default.png", { type: "image/png" });


    const res = await createUser({ image, firstname, lastname, username, email, password, is_admin, roles });

    return NextResponse.json(res);
}
import { uploadFileDB } from "@/actions/localstorage/upload-db";
import { verifySession } from "@/actions/permissions";
import { prisma } from "@/lib/db";
import { getTranslations } from "next-intl/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: Request) {

    const url = new URL(request.url);
    let type = null, searchQuery = null, page = 1, pageSize = 10, count = null, justpublic = null;
    if (url.searchParams && url.searchParams.get("type")) {
        type = url.searchParams.get("type");
    }
    if (url.searchParams && url.searchParams.get("justpublic")) {
        justpublic = url.searchParams.get("justpublic");
    }
    if (url.searchParams && url.searchParams.get("searchQuery")) {
        searchQuery = url.searchParams.get("searchQuery");
    }
    if (url.searchParams && url.searchParams.get("page")) {
        page = parseFloat(url.searchParams.get("page") ?? "1");
    }
    if (url.searchParams && url.searchParams.get("pageSize")) {
        pageSize = parseFloat(url.searchParams.get("pageSize") ?? "10");
    }
    if (url.searchParams && url.searchParams.get("count")) {
        count = url.searchParams.get("count");
    }

    // @ts-ignore
    let where = []
    const f = await getTranslations('Files');

    if (justpublic) {
        where.push(
            {
                admin_view_only: false
            },
            {
                can_view_users: null
            },
            {
                can_view_permissions: null
            }
        )
    }
    else {
        const session = await verifySession();

        if (session.status !== 200 || !session.data || !session.data.user)
            where.push(
                {
                    admin_view_only: false
                },
                {
                    can_view_users: null
                },
                {
                    can_view_permissions: null
                }
            )
        else if (!justpublic && session.status === 200 && session.data && session.data.user) {
            if (session.data.user.is_admin === false) {
                where.push(
                    {
                        or: [
                            {
                                admin_view_only: false,
                            },
                            {
                                addedFrom: session.data.user.id
                            },
                        ],
                    }
                )
                where.push(
                    {
                        OR: session.data.user.permissions.map((perm: string) => ({
                            can_view_permissions: { contains: perm },
                        })),
                    }
                )
                where.push(
                    {
                        can_view_users: { contains: session.data.user.id },
                    }
                )
            }
        }
    }

    if (type) {
        where.push({
            mime_type: { contains: type },
        })
    }

    if (searchQuery) {
        where.push({
            AND: [
                { name: { contains: searchQuery } },
            ],
        })
    }

    if (count) {
        const count = await prisma.files.count(
            {
                // @ts-ignore
                where: where.length ? { AND: where } : {},
            }
        );
        return NextResponse.json({ data: count }, { status: 200 });
    }

    const files = await prisma.files.findMany({
        skip: (page - 1) * pageSize, // Nombre d'éléments à sauter
        take: pageSize, // Nombre d'éléments à prendre
        // @ts-ignore
        where: where.length ? { AND: where } : {},
        orderBy: {
            created_at: "desc",
        }
    })

    if (!files) {
        return NextResponse.json({ message: f("filedoesnotexist") }, { status: 404 });
    }

    return NextResponse.json({ data: files }, { status: 200 });
}


export async function POST(request: NextRequest) {

    const data = await request.formData();
    const files = data.getAll("file") as File[];

    const isPublicView = data.get("isPublicView") === "true";
    const isJustMeView = data.get("isJustMeView") === "true";
    const permissionsView = JSON.parse(data.get("permissionsView") as string);
    const usersView = JSON.parse(data.get("usersView") as string);

    const isPublicDownload = data.get("isPublicDownload") === "true";
    const isJustMeDownload = data.get("isJustMeDownload") === "true";
    const permissionsDownload = JSON.parse(data.get("permissionsDownload") as string);
    const usersDownload = JSON.parse(data.get("usersDownload") as string);

    const isPublicDelete = data.get("isPublicDelete") === "true";
    const isJustMeDelete = data.get("isJustMeDelete") === "true";
    const permissionsDelete = JSON.parse(data.get("permissionsDelete") as string);
    const usersDelete = JSON.parse(data.get("usersDelete") as string);

    if (!files.length) {
        return NextResponse.json({ message: "No files found" }, { status: 400 });
    }

    const session = await verifySession();
    if (session.status !== 200 || !session.data || !session.data.user) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const uploadedFiles = [];

    for (const file of files) {
        const newFile = await uploadFileDB(
            file,
            session.data.user.id,
            isPublicView || isJustMeView ? null : usersView,
            isPublicView || isJustMeView ? null : permissionsView,
            !isPublicView && isJustMeView,
            isPublicDownload || isJustMeDownload ? null : usersDownload,
            isPublicDownload || isJustMeDownload ? null : permissionsDownload,
            !isPublicDownload && isJustMeDownload,
            isPublicDelete || isJustMeDelete ? null : usersDelete,
            isPublicDelete || isJustMeDelete ? null : permissionsDelete,
            !isPublicDelete && isJustMeDelete
        );
        uploadedFiles.push({ data: newFile.data, status: newFile.status });
    }

    return NextResponse.json(uploadedFiles);
}

import { withAuthorizationPermission, verifySession } from "@/actions/permissions";
import { prisma } from "@/lib/db";
import { getTranslations } from "next-intl/server";
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { deleteFile } from "@/actions/localstorage/delete";

const deleteFileFromDB = async (id: string) => {
    const deletedFile = await prisma.files.delete({ where: { id } });
    deleteFile(id);
    return deletedFile
}

/**
 * Utilitaire pour renvoyer une réponse JSON standardisée
 */
function jsonResponse(message: string, status = 200) {
    return NextResponse.json({ message }, { status });
}

/**
 * Utilitaire pour créer un stream de fichier et le retourner sous forme de Response
 */
async function createFileResponse(filePath: string, mimeType: string, metadata: any) {
    const fullPath = path.join(process.cwd(), filePath);

    if (!fs.existsSync(fullPath)) {
        return jsonResponse("File not found in storage", 200);
    }

    const fileStream = fs.createReadStream(fullPath);
    const readableStream = new ReadableStream({
        start(controller) {
            fileStream.on("data", (chunk) => controller.enqueue(chunk));
            fileStream.on("end", () => controller.close());
            fileStream.on("error", (err) => controller.error(err));
        },
    });

    return new Response(readableStream, {
        headers: {
            "Content-Type": mimeType,
            "X-File-Metadata": JSON.stringify(metadata),
        },
    });
}

/**
 * Endpoint GET principal
 */
export async function GET(request: Request, { params }: { params: any }) {
    const { id } = params;
    const url = new URL(request.url);
    const allFile = url.searchParams.get("allFile");

    const f = await getTranslations("Files");
    const e = await getTranslations("Error");

    const fileexists = await prisma.files.findFirst({ where: { id } });

    if (!fileexists) {
        return jsonResponse(e("not_found"), 404);
    }

    // 🔒 Gestion des permissions
    if (fileexists.can_view_users || fileexists.admin_view_only || fileexists.can_view_permissions) {
        const session = await verifySession();
        let havePermission = false;

        // Vérification session
        if (session.status !== 200 || !session.data?.user) {
            return jsonResponse(e("unauthorized"), 401);
        }

        const user = session.data.user;

        // Si admin, autorisé
        if (user.is_admin) havePermission = true;

        // Fichiers réservés à l'admin
        if (!havePermission && fileexists.admin_view_only) {
            if (fileexists.admin_view_only !== user.id) {
                return jsonResponse(f("unauthorized"), 401);
            }
            havePermission = true;
        }

        // Liste des utilisateurs autorisés
        if (!havePermission && fileexists.can_view_users) {
            const allowedUsers = fileexists.can_view_users.split(",");
            if (allowedUsers.includes(user.id)) {
                havePermission = true;
            }
        }

        // Permissions spécifiques
        if (!havePermission && fileexists.can_view_permissions) {
            const requiredPermissions = fileexists.can_view_permissions.split(",");
            const hasPermission = await withAuthorizationPermission(requiredPermissions, user.id);

            if (hasPermission.status === 200 && hasPermission.data?.hasPermission) {
                havePermission = true;
            }
        }
        
        if (!havePermission) {
            return jsonResponse(f("unauthorized"), 401);
        }
    }

    // 🔄 Si on demande le fichier complet
    if (allFile === "true") {
        try {
            return await createFileResponse(fileexists.path, fileexists.mime_type, fileexists);
        } catch (error) {
            console.error("File stream error:", error);
            return jsonResponse("Internal Server Error", 500);
        }
    }
    // ✅ Sinon, on renvoie les métadonnées
    return NextResponse.json({ data: fileexists }, { status: 200 });
}



export async function DELETE(request: Request, { params }: { params: any }) {

    const paramsID = await params
    const f = await getTranslations('Files');

    const fileexist = await prisma.files.findFirst({ where: { id: paramsID.id } });

    if (!fileexist) {
        return NextResponse.json({ message: f("filedoesnotexist") }, { status: 404 });
    }

    const session = await verifySession();
    if (session.status !== 200 || !session.data || !session.data.user) {
        return NextResponse.json({ message: f("unauthorized") }, { status: 401 });
    }

    if (session.data.user.is_admin === true) {
        const deletedFile = await deleteFileFromDB(paramsID.id)
        return NextResponse.json({ data: deletedFile }, { status: 200 });
    }

    // si le fichier est pour admin uniquement ou l'utilisateur n'est pas celui qui l'a ajouté
    if (fileexist.admin_delete_only) {
        if (fileexist.added_from !== session.data.user.id) {
            return NextResponse.json({ message: f("unauthorized") }, { status: 401 });
        } else {
            const deletedFile = await deleteFileFromDB(paramsID.id)
            return NextResponse.json({ data: deletedFile }, { status: 200 });
        }
    }


    if (fileexist.can_delete_users) {
        const users = fileexist.can_delete_users.split(',')
        if (users.includes(session.data.user.id)) {
            const deletedFile = await deleteFileFromDB(paramsID.id)
            return NextResponse.json({ data: deletedFile }, { status: 200 });
        }
    }

    if (fileexist.can_delete_permissions) {
        const permissions = fileexist.can_delete_permissions.split(',')
        const hasPermission = await withAuthorizationPermission(permissions, session.data.user.id);
        if (hasPermission.status === 200 && hasPermission.data.hasPermission) {
            const deletedFile = await deleteFileFromDB(paramsID.id)
            return NextResponse.json({ data: deletedFile }, { status: 200 });
        }
    }

    return NextResponse.json({ message: f("unauthorized") }, { status: 401 });

}


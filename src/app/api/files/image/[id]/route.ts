import { withAuthorizationPermission, verifySession } from "@/actions/permissions";
import { prisma } from "@/lib/db";
import { getTranslations } from "next-intl/server";
import fs from "fs";
import path from "path";

async function createFileResponse(filePath: string, mimeType = "image/png", metadata: any = null) {
    const fullPath = path.join(process.cwd(), filePath);

    // Si le fichier n'existe pas, renvoie un placeholder générique
    if (!fs.existsSync(fullPath)) {
        return createFileResponse("/public/not_found.jpg", "image/png", metadata);
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
            ...(metadata && { "X-File-Metadata": JSON.stringify(metadata) }),
        },
    });
}

export async function GET(request: Request, { params }: { params: any }) {
    const { id } = params;
    const e = await getTranslations("Error");
    const fileexists = await prisma.files.findFirst({ where: { id } });

    // Fichier non trouvé dans la base
    if (!fileexists) {
        return createFileResponse("/public/not_found.jpg");
    }

    // Vérifie le chemin réel du fichier
    if (!fs.existsSync(path.join(process.cwd(), fileexists.path))) {
        return createFileResponse("/public/not_found.jpg", "image/png", fileexists);
    }

    // Gestion des permissions
    if (fileexists.can_view_users || fileexists.admin_view_only || fileexists.can_view_permissions) {
        const session = await verifySession();

        // Pas de session valide
        if (session.status !== 200 || !session.data?.user) {
            return createFileResponse("/public/no_access.png", "image/png", fileexists);
        }

        // Admin
        if (session.data.user.is_admin === true) {
            return createFileResponse(fileexists.path, fileexists.mime_type, fileexists);
        }

        // Fichier réservé à l'admin
        if (fileexists.admin_view_only) {
            if (fileexists.added_from !== session.data.user.id) {
                return createFileResponse("/public/no_access.png", "image/png", fileexists);
            } else {
                return createFileResponse(fileexists.path, fileexists.mime_type, fileexists);
            }
        }

        // Liste d’utilisateurs autorisés
        if (fileexists.can_view_users) {
            const users = fileexists.can_view_users.split(",");
            if (users.includes(session.data.user.id)) {
                return createFileResponse(fileexists.path, fileexists.mime_type, fileexists);
            }
        }

        // Permissions spécifiques
        if (fileexists.can_view_permissions) {
            const permissions = fileexists.can_view_permissions.split(",");
            const hasPermission = await withAuthorizationPermission(permissions, session.data.user.id);
            if (hasPermission.status === 200 && hasPermission.data.hasPermission) {
                return createFileResponse(fileexists.path, fileexists.mime_type, fileexists);
            }
        }
    }

    // Fichier valide : on le retourne
    return createFileResponse(fileexists.path, fileexists.mime_type, fileexists);
}

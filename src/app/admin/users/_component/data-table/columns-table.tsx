// src/components/columns-table.tsx
"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Trash, ArrowUpDown, Settings2, CircleUserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
// import { useAddUpdateUserDialog } from "@/context/add-update-dialog-context";
import { useSession } from "@/hooks/use-session";
import axios from "axios";
import { useOrigin } from "@/hooks/use-origin";
import { Checkbox } from "@/components/ui/checkbox";
import MyImage from "@/components/myui/my-image";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogHeader
} from "@/components/ui/dialog";
import * as React from "react";
import Loading from "@/components/myui/loading";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";


// --- Type de données de la colonne ---

export type Columns = {
  id: string;
  firstname: string;
  lastname: string;
  username: string;
  email: string;
  image: string;
  imageCompressed: string; // Gardé pour le type, mais l'accessorKey dans la colonne est 'image_compressed'
  roles: string[];
  is_admin: boolean;
};

// --- Fonctions d'En-tête (Header) avec Tri ---

const SortableHeader = (key: keyof Columns, translateKey: string) =>
  ({ column }: any) => {
    const t = useTranslations("Users");
    return (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="justify-start hover:bg-transparent px-2"
      >
        {t(translateKey)}
        <ArrowUpDown className="ml-2 h-3 w-3 opacity-50" />
      </Button>
    );
  };

// --- Fonctions de Cellule (Cell) ---

const RolesCell = ({ row }: any) => {
  const u = useTranslations("Users");
  const roles = row.getValue("roles") as string[];
  const is_admin = row.original.is_admin as boolean;

  return (
    <div className="font-medium text-sm">
      {is_admin ? (
        <span className="text-primary font-bold">{u("isadmin")} ✨</span>
      ) : (
        roles.length > 0 ? roles.join(", ") : <span className="text-muted-foreground">No roles</span>
      )}
    </div>
  );
};

const ImageCell = ({ row }: any) => {
  // Note: Utiliser l'accessorKey 'image_compressed' ou 'image' si l'API renvoie le champ différemment
  console.log(row)
  const preview =  row.original.image_compressed || row.original.image;
  return preview ? (
    <MyImage
      image={preview}
      alt="Avatar"
      load
      classNameProps="w-8 h-8 object-cover rounded-full"
    />
  ) : (
    <CircleUserRound className="w-8 h-8 text-gray-400" />
  );
};

const ActionsCell = ({ row }: any) => {
  const user = row.original as Columns;
  const origin = useOrigin();
  const t = useTranslations("System");
  // const { openDialog } = useAddUpdateUserDialog();
  const { session } = useSession();

  // Permissions (Mieux vaut les dériver dans le composant parent ou hook si possible)
  const hasPermissionDeleteUsers = React.useMemo(() => (
    session?.user?.is_admin ||
    session?.user?.permissions.some((p: string) => p === "users_delete")
  ), [session]);

  const hasPermissionUpdateUsers = React.useMemo(() => (
    session?.user?.is_admin ||
    session?.user?.permissions.some((p: string) => p === "users_update")
  ), [session]);


  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  // Fonction de suppression
  const deleteUserHandler = async () => {
    if (!user.id || !origin) return;
    setLoading(true);
    try {
      const response = await axios.delete(`${origin}/api/admin/users/${user.id}`);
      if (response.data.status === 200) {
        toast.success(response.data.data.message || t("delete_success"));
        // Reload la fenêtre ou idéalement invalider la cache/fetcher les données
        window.location.reload();
      } else {
        toast.error(response.data.data.message || t("delete_error"));
      }
    } catch (error) {
      console.error(error);
      toast.error(t("delete_error_generic"));
    } finally {
      setLoading(false);
      setIsDialogOpen(false);
    }
  };

  return (
    <div className="flex space-x-2">
      {hasPermissionUpdateUsers && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={() => window.location.href = `/admin/users/user/${user.id}`}
              >
                <Settings2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{t("edit")}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {hasPermissionDeleteUsers && (
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <DialogTrigger asChild>
                  <Button variant="destructive" size="icon">
                    <Trash className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t("delete")}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{t("confermationdelete")}</DialogTitle>
              <DialogDescription>
                {t("confermationdeletemessage")}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="mt-4">
              <Button
                disabled={loading}
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
              >
                {t("cancel")}
              </Button>
              <Button
                disabled={loading}
                variant="destructive"
                onClick={deleteUserHandler}
              >
                {loading ? (
                  <>
                    <Loading classSizeProps="h-4 w-4 mr-2" />
                    {t("deleting")}
                  </>
                ) : (
                  t("delete")
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

// --- Définition des Colonnes (ColumnDef) ---

export const columns: ColumnDef<Columns>[] = [
  {
    id: "select", // Changé à 'select' au lieu de 'actionsCheck' pour standardisation
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllRowsSelected(!!value)}
        aria-label="Select all"
        className="translate-y-[2px]"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
        className="translate-y-[2px]"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    id: "image", // ID explicite pour l'image
    accessorKey: "image_compressed", // Utiliser l'accessorKey pour la donnée
    header: "", // Pas de texte d'en-tête pour l'image
    cell: (props) => ImageCell(props),
    enableSorting: false,
    size: 40, // Taille fixe pour l'image
  },
  {
    accessorKey: "firstname",
    header: SortableHeader("firstname", "firstname"),
  },
  {
    accessorKey: "lastname",
    header: SortableHeader("lastname", "lastname"),
  },
  {
    accessorKey: "email",
    header: SortableHeader("email", "email"),
  },
  {
    accessorKey: "username",
    header: SortableHeader("username", "username"),
  },
  {
    accessorKey: "roles",
    header: SortableHeader("roles", "roles"),
    cell: (props) => RolesCell(props),
  },
  {
    id: "actions",
    header: "", // L'en-tête reste vide pour les actions
    cell: (props) => ActionsCell(props),
    enableSorting: false,
    size: 130, // Largeur fixe pour la colonne d'actions
  },
];
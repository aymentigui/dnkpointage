"use client"
import * as React from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { Settings2, Trash, ArrowUpDown, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import axios from "axios";
import { useOrigin } from "@/hooks/use-origin";
import { useSession } from "@/hooks/use-session";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogHeader
} from "@/components/ui/dialog";
import { useState } from "react";
import Loading from "@/components/myui/loading";


export type Role = {
  id: string;
  name: string;
  userCount: number;
};

// --- Utilities ---

const SortableHeader = (key: keyof Role, translateKey: string) =>
  ({ column }: any) => {
    const t = useTranslations("Roles");
    return (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="justify-start hover:bg-transparent px-2 text-sm"
      >
        {t(translateKey)}
        <ArrowUpDown className="ml-2 h-3 w-3 opacity-50" />
      </Button>
    );
  };

const deleteRoleHandler = async (roleId: string, origin: string, t: (key: string) => string, setLoading: (loading: boolean) => void, setIsOpen: (open: boolean) => void) => {
  if (!origin) return;
  setLoading(true);
  try {
    const response = await axios.delete(origin + "/api/admin/roles/" + roleId);
    if (response.data.status === 200) {
      toast.success(response.data.data.message || t("delete_success"));
      // For real-time updates without full reload, a state update or query invalidation is preferred
      // window.location.reload(); 
    } else {
      toast.error(response.data.data.message || t("delete_error_generic"));
    }
  } catch (e: any) {
    toast.error(e.message || t("delete_error_generic"));
  } finally {
    setLoading(false);
    setIsOpen(false);
  }
};

// --- Cell Renderers ---

const UserCountCell = ({ row }: any) => {
  const count = row.getValue("userCount") as number;
  return (
    <Badge variant="outline" className="text-xs font-medium bg-secondary/50 text-secondary-foreground hover:bg-secondary/70">
      <Users className="h-3 w-3 mr-1" />
      {count}
    </Badge>
  );
};

const ActionsCell = ({ row }: any) => {
  const role = row.original as Role;
  const router = useRouter();
  const t = useTranslations("System");
  const { session } = useSession();
  const origin = useOrigin();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Permissions (Derived from session)
  const hasPermissionDeleteRoles = React.useMemo(() => (
    session?.user?.is_admin || session?.user?.permissions.some((p: string) => p === "roles_delete")
  ), [session]);

  const hasPermissionUpdateRoles = React.useMemo(() => (
    session?.user?.is_admin || session?.user?.permissions.some((p: string) => p === "roles_update")
  ), [session]);

  // Handler for delete confirmation
  const handleDelete = () => {
    if (!origin) return;
    deleteRoleHandler(role.id, origin, t, setLoading, setIsDialogOpen);
  }

  return (
    <div className="flex space-x-2">
      <TooltipProvider>
        {hasPermissionUpdateRoles && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={() => router.push(`/admin/roles/role/${role.id}`)}
                variant="outline"
                size="icon"
              >
                <Settings2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{t("edit")}</p>
            </TooltipContent>
          </Tooltip>
        )}

        {hasPermissionDeleteRoles && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <Tooltip>
              <TooltipTrigger asChild>
                <DialogTrigger asChild>
                  <Button
                    variant="destructive"
                    size="icon"
                  >
                    <Trash className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t("delete")}</p>
              </TooltipContent>
            </Tooltip>

            {/* Confirmation Dialog */}
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-xl">{t("confermationdelete")}</DialogTitle>
                <DialogDescription>
                  {t("confermationdeletemessage")}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="mt-4 sm:justify-end">
                <Button
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  disabled={loading}
                >
                  {t("cancel")}
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={loading}
                >
                  {loading ? (
                    <Loading classSizeProps="h-4 w-4" />
                  ) : (
                    t("delete")
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </TooltipProvider>
    </div>
  );
}

// --- Column Definition Array ---

export const columns: ColumnDef<Role>[] = [
  {
    accessorKey: "name",
    header: SortableHeader("name", "title"),
    cell: ({ row }) => (
      <div className="font-semibold text-primary">{row.getValue("name")}</div>
    ),
    enableSorting: true,
    size: 300,
  },
  {
    accessorKey: "userCount",
    header: SortableHeader("userCount", "totalusers"),
    cell: (props) => UserCountCell(props),
    size: 100,
  },
  {
    id: "actions",
    header: "",
    cell: (props) => ActionsCell(props),
    enableSorting: false,
    size: 130, // Largeur fixe pour la colonne d'actions
  },
];

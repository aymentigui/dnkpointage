"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import axios from "axios";
import { useOrigin } from "@/hooks/use-origin";
import Loading from "@/components/myui/loading";
import { Permission } from "./data-table/columns-permission";
import { DataTable } from "./data-table/data-table-permission";

type AddRoleFormProps = {
  permissions: Permission[];
  roleId?: string;
};

type Role = { id: string; name: string, userCount: number } | null;

export default function AddRoleForm({ permissions, roleId }: AddRoleFormProps) {
  const router = useRouter();
  const origin = useOrigin()

  const [role, setRole] = useState<Role>(null);
  const [roleName, setRoleName] = useState(role?.name || "");

  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [selectedPermissionsName, setSelectedPermissionsName] = useState<string[]>([]);
  const [error, setError] = useState("");

  const r = useTranslations("Roles")
  const p = useTranslations("Permissions")
  const s = useTranslations("System")
  const e = useTranslations("Error")

  useEffect(() => {
    if (roleId) {
      if (!origin) return
      fetchData()
    }
  }, [origin])

  const fetchData = async () => {
    if (!origin) return
    const res = await axios(origin + "/api/admin/roles/" + roleId)
    setRole(res.data.data)
    setRoleName(res.data.data.name)
    setSelectedPermissionsName(res.data.data.permissions.split(","))
  }

  // Créer le rôle
  const handleAddRole = async () => {
    if (!roleName) {
      setError(r("rolenamerequired"));
      return;
    }

    if (selectedPermissions.length === 0) {
      setError(r("permissionrequired"));
      return;
    }

    try {
      const permissions = selectedPermissionsName.join(",")
      let result;
      let status;
      let message;

      if (role?.id) {
        result = await axios.put(origin + "/api/admin/roles/" + role.id, { name: roleName, permissions })
      } else {
        result = await axios.post(origin + "/api/admin/roles/", { name: roleName, permissions })
      }
      status = result.data.status
      message = result.data.data.message


      if (status === 200) {
        toast.success(message);
        roleId ? router.refresh() : router.push("/admin/roles");
      } else if (status !== 200 && message) {
        toast.error(message);
        setError(message)
      }
      setError("")

    } catch (error) {
      setError(e("error"));
      console.error(error);
    }
  };

  return (
    <>
      {/* Champ pour le nom du rôle */}
      <div className="mb-6">
        <Input
          placeholder={r("rolename")}
          value={roleName}
          onChange={(e) => setRoleName(e.target.value)}
          className="w-1/2"
        />
      </div>

      {/* Tableau des permissions */}
      {
        roleId && !role
          ? <div className="flex items-center justify-center">
              <Loading></Loading>
          </div>
          : (<>
            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-4">{p("title")}</h2>
              <DataTable
                permissions={permissions}
                selectedPermissions={selectedPermissions}
                selectedPermissionNames={selectedPermissionsName}
                setSelectedPermissions={setSelectedPermissions}
                setSelectedPermissionsName={setSelectedPermissionsName}
              />
            </div>

            {/* Boutons */}
            <div className="flex gap-4">
              <Button onClick={handleAddRole}>{role?.id ? s("update") : r("addrole")}</Button>
              <Button
                variant="outline"
                onClick={() => router.push("/admin/roles")}
              >
                {s("cancel")}
              </Button>
            </div>
          </>)
      }

      {/* Affichage des erreurs */}
      {error && (
        <Alert variant="destructive" className="mt-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{e("error")}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </>
  );
}
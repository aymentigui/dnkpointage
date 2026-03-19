import { accessPage } from "@/actions/permissions";
import { Card } from "@/components/ui/card";
import { permissions } from "@/db/permissions";
import { getTranslations } from "next-intl/server";
import AddRoleForm from "../../_component/role-form";

export default async function UpdateRolePage({ params }: any) {
  const r = await getTranslations("Roles");
  const paramsID = await params;

  if (!paramsID.id)
    return null

  await accessPage(['roles_update']);

  return (
    <Card className='p-4'>
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">{!paramsID.id ? r("addrole") : r("updaterole")}</h1>
        <AddRoleForm permissions={permissions} roleId={paramsID.id} />
      </div>
    </Card>
  );
}
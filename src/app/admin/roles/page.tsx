import { accessPage, withAuthorizationPermission,verifySession} from '@/actions/permissions';
import ListRoles from '@/app/admin/roles/_component/list-roles'
import AddRouteButton from '@/components/my/button/add-route-button';
import { Card } from '@/components/ui/card';
import React from 'react'

const RolesPage = async () => {

  const session = await verifySession()

  if (session.status !== 200 || !session || !session.data.user || !session.data.user.id) {
    return null;
  }
  await accessPage(['roles_view'],session.data.user.id);
  const hasPermissionView = await withAuthorizationPermission(['roles_view'],session.data.user.id);
  const hasPermissionAdd = await withAuthorizationPermission(['roles_create'],session.data.user.id);

  return (
    <Card className='p-4'>
      <div className='flex flex-col gap-2'>
        {hasPermissionAdd.data.hasPermission && <AddRouteButton translationName="Roles" translationButton="addrole" route="/admin/roles/role" />}
        {hasPermissionView.data.hasPermission && <ListRoles />}
      </div>
    </Card>
  )
}

export default RolesPage

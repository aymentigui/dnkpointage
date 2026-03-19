
import { accessPage, withAuthorizationPermission, verifySession } from '@/actions/permissions'
import UsersAdminPage from '@/app/admin/users/_component/list-users'
import AddModalButton from '@/components/my/button/add-modal-button'
import AddRouteButton from '@/components/my/button/add-route-button';
import { Card } from '@/components/ui/card'
import { useAddUpdateUserDialog } from '@/context/add-update-dialog-context';
import React from 'react'

const UserPage = async () => {

  const session = await verifySession()

  if (!session || session.status !== 200 || !session.data.user || !session.data.user.id) {
    return null;
  }
  await accessPage(['users_view'],session.data.user.id);
  const hasPermissionView = await withAuthorizationPermission(['users_view'],session.data.user.id);
  const hasPermissionAdd = await withAuthorizationPermission(['users_create'],session.data.user.id);

  return (
    <Card className='p-4 w-full'>
      <div className='flex flex-col gap-2'>
        {hasPermissionAdd.data.hasPermission && <AddRouteButton translationName="Users" translationButton="adduser" route='/admin/users/user' />}
        {/* <ListUsers /> */}
        {hasPermissionView.data.hasPermission && <UsersAdminPage />}
      </div>
    </Card>
  )
}

export default UserPage

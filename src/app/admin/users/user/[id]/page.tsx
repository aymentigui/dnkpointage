import { accessPage, verifySession } from '@/actions/permissions';
import React from 'react'
import { AddUpdateUser } from '../../_component/form-user';
import { Card } from '@/components/ui/card';
import { getUser } from '@/actions/users/get';

const Page = async ({ params }: any) => {

    const session = await verifySession()
    const paramsID = await params;

    if (!paramsID.id)
        return null

    if (!session || session.status !== 200 || !session.data.user || !session.data.user.id) {
        return null;
    }
    await accessPage(['users_update'], session.data.user.id);

    const users = await getUser(paramsID.id)

    if (!users || users.status !== 200 )
        return null

    const user= users.data;

    return (
        <Card className='p-4 w-full'>
            <AddUpdateUser user={user} />
        </Card>
    )
}

export default Page

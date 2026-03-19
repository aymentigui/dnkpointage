import { accessPage, verifySession } from '@/actions/permissions';
import React from 'react'
import { AddUpdateUser } from '../_component/form-user';
import { Card } from '@/components/ui/card';

const Page = async () => {

    const session = await verifySession()

    if (!session || session.status !== 200 || !session.data.user || !session.data.user.id) {
        return null;
    }
    await accessPage(['users_create'], session.data.user.id);

    return (
        <Card className='p-4 w-full'>
            <AddUpdateUser />
        </Card>
    )
}

export default Page

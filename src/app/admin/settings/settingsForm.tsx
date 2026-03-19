

import { getSessions } from '@/actions/accont-settings/get';
import EmailForm from '@/app/admin/settings/_component/forms/email-form';
import ImageForm from '@/app/admin/settings/_component/forms/image-form';
import ListSessionsForm from '@/app/admin/settings/_component/list-sessions/listsessions-form';
import ResetPasswordForm from '@/app/admin/settings/_component/forms/resetpassword-form';
import TwoFactorConfermationForm from '@/app/admin/settings/_component/forms/twofactorconfermation-form';
import UsernameForm from '@/app/admin/settings/_component/forms/username-form';
import { Separator } from '@/components/ui/separator';
import { user } from '@prisma/client';
import InfoForm from './_component/forms/info-form';

interface SettingsFormProps {
    user: user
}

export default async function SettingsForm({ user }: SettingsFormProps) {

    if (!user) {
        return null
    }

    const sessions = await getSessions(user);

    if (sessions.status != 200) {
        return null
    }

    return (
        <div>
            <ImageForm image={user.image ?? ""} userId={user.id} />
            <Separator />
            {user.email && <EmailForm email={user.email} />}
            <Separator />
            {user.username && <UsernameForm username={user.username} />}
            <Separator />
            {<InfoForm user={user} />}
            <Separator />
            <TwoFactorConfermationForm twoFactorConfermation={user.is_two_factor_enabled ?? false} />
            <Separator />
            <ResetPasswordForm />
            <Separator />
            <ListSessionsForm sessions={sessions.data} />
        </div>
    )
}


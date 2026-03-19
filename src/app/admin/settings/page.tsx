import SettingsForm from "./settingsForm";
import { getUser } from "@/actions/users/get";
import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/card";
import { verifySession } from "@/actions/permissions";

export default async function SettingsPage() {
  const session = await verifySession();
  const t = await getTranslations('Settings');
  if (!session || session.status !== 200 || !session.data || !session.data.user) return null

  const user = await getUser(session.data.user?.id as string);
  if (user.status !== 200 || !user.data) return null

  return <Card className='p-4'>
    <div className="px-4 md:px-16 mt-8">

      <h1 className="text-2xl font-bold mb-6">{t('title')}</h1>
      <SettingsForm user={user.data} />
      <div className='w-full h-20'></div>
    </div>
  </Card >
}


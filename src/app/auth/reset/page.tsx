import ResetForm from "@/app/auth/reset/reset";
import { getTranslations } from "next-intl/server";

export default async function LoginPage() {
  const t=await getTranslations('Settings');

  return (
    <div className="min-h-screen py-10 overflow-auto w-full flex items-center justify-center bg-border">
      <div className="bg-background dark:bg-sidebar p-8 rounded-lg shadow-lg w-full max-w-xs md:max-w-md">
        <h1 className="text-2xl font-bold  mb-6 text-center">
          {t('resetpassword')}
        </h1>
        <ResetForm />
      </div>
    </div>
  );
}

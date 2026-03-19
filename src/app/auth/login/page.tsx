import LoginForm from "@/app/auth/login/login";
import { getTranslations } from "next-intl/server";

export default async function LoginPage() {
  const s=await getTranslations('System');

  return (
    <div className="min-h-screen bg-border py-10 overflow-auto w-full flex items-center justify-center ">
      <div className="bg-background dark:bg-sidebar p-8 rounded-lg shadow-2xl w-full max-w-xs md:max-w-md">
        <h1 className="text-2xl font-bold mb-6 text-center">
          {s('login')}
        </h1>
        <LoginForm />
      </div>
    </div>
  );
}

import RegisterForm from "@/app/auth/register/register";
import { getTranslations } from "next-intl/server";

export default async function RegisterPage() {
  const s=await getTranslations('System');

  return (
    <div  className="min-h-screen py-10 overflow-auto w-full flex items-center justify-center bg-border">
      <div className="bg-background dark:bg-sidebar p-8 rounded-lg shadow-lg w-full max-w-xs md:max-w-md">
        <h1 className="text-2xl font-bold  mb-6 text-center">
          {s('register')}
        </h1>
        <RegisterForm />
      </div>
    </div>
  );
}

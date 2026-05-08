import "./globals.css";
import { Cairo } from "next/font/google";
import type { Metadata } from "next";
import { Toaster } from "react-hot-toast";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { prisma } from "@/lib/db";
import bcrypt from "bcrypt";

const cairo = Cairo({
  subsets: ['latin'], // Sous-ensembles pour les caractères spécifiques
  weight: ['400', '700'], // Ajouter les épaisseurs nécessaires (normal, bold)
});
export const metadata: Metadata = {
  title: "حضور",
  description: "حضور",
};


export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {

  const locale = await getLocale();
  const messages = await getMessages();

  // const admin = await prisma.user.findFirst({
  //   where: {
  //     is_admin: true,
  //   },
  // });

  // if (!admin) {
  //   const password = await bcrypt.hash("Aymen03151199", 10);
  //   await prisma.user.create({
  //     data: {
  //       is_admin: true,
  //       email_verified: new Date(),
  //       username: "admin",
  //       email: "aymentigui@gmail.com",
  //       password: password,
  //       firstname: "Aymen",
  //       lastname: "Tigui",
  //       public: false,
  //     },
  //   });
  // }

  return (
    <html suppressHydrationWarning lang={locale} dir={locale === "ar" ? "rtl" : "ltr"}>
      <body
        className={`
          ${cairo.className}
          antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <NextIntlClientProvider messages={messages}>
            {children}
          </NextIntlClientProvider>
        </ThemeProvider>
        <div><Toaster /></div>
      </body>
    </html>
  );
}

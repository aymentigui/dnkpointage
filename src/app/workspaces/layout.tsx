import type { Metadata } from "next";
import DivAdmin from "@/components/my/admin/div-admin";

export const metadata: Metadata = {
  title: "Admin",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {


  return (
    <div>
      <DivAdmin />
      <main className="flex min-h-screen flex-col w-full overflow-auto bg-border">
        <div className="w-full p-4 flex-grow">
          {children}
        </div>
      </main>
    </div>
  );
}

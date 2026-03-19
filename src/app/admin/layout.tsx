import type { Metadata } from "next";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/ui/app-sidebar";
import DivAdmin from "@/components/my/admin/div-admin";
import HeaderAdmin from "@/components/my/admin/header";
import { AddUpdateUserDialog } from "@/modals/add-update-dialog";
import ModalClass from "@/components/my/modal-class";
import ModalContext from "@/components/my/modal-context";
import { verifySession } from "@/actions/permissions";

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
      <ModalClass />
      <SidebarProvider >
        <DivAdmin />
        <AppSidebar />
        <ModalContext>
          <main className="flex min-h-screen flex-col w-full overflow-auto bg-border">
            <HeaderAdmin>
              <SidebarTrigger />
            </HeaderAdmin>
            <div className="w-full p-4 flex-grow">
              {children}
            </div>
          </main>
        </ModalContext>
      </SidebarProvider>
    </div>
  );
}

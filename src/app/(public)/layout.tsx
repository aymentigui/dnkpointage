import DivStart from "@/components/my/public/div-start";
import HeaderPublic from "@/components/my/public/header";


export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {

  return (
    <div className="min-h-screen flex flex-col ">
      <DivStart />
      {/* Header */}
      <HeaderPublic />
      {children}
      <HeaderPublic />
    </div>
  );
}

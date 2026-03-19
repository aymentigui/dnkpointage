import { NextPage } from "next";
import { Smartphone, Laptop, Tv, CircleHelp, Car, Gamepad2, Tablet } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { format } from "date-fns";
import DeleteButton from "./delete-button";
import DeleteAllButton from "./deleteAll-button";
import { getTranslations } from "next-intl/server";

type Session = {
  id: string;
  deviceType: string;
  deviceName: string;
  browser: string;
  os: string;
  createdAt: string; // ISO date string
};

type Props = {
  sessions: Session[];
};


const DeviceIcon: React.FC<{ type: Session["deviceType"] }> = ({ type }) => {
  switch (type) {
    case "mobile":
      return <Smartphone className="w-6 h-6 text-blue-500" />;
    case "desktop":
      return <Laptop className="w-6 h-6 text-green-500" />;
    case "tablet":
      return <Tablet className="w-6 h-6 text-yellow-500" />;
    case "tv":
      return <Tv className="w-6 h-6 text-orange-500" />;
    case "car":
      return <Car className="w-6 h-6 text-red-500" />;
    case "console":
      return <Gamepad2 className="w-6 h-6 text-purple-500" />;
    default:
      return <CircleHelp className="w-6 h-6 text-gray-500" />;
  }
};

const ListSessionsForm: NextPage<Props> = async({ sessions }) => {
  const tss = await getTranslations('Sessions');
  const ts = await getTranslations('System');

  return (
    <div className="p-6">
      <div className="flex justify-between">
        <h1 className="text-2xl font-bold mb-4">{tss('activesessions')}</h1>
        <DeleteAllButton />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sessions.map((session) => (
          <Card key={session.id} className="border relative">
            <div className="absolute top-2 right-2">
              <DeleteButton id={session.id} />
            </div>
            <CardHeader className="flex items-center gap-4">
              <DeviceIcon type={session.deviceType || "unknown"} />
              <CardTitle className="text-lg font-semibold">
                {session.deviceName || "Unknown Device"} ({session.browser || "Unknown Browser"})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-400">{tss('os')} : {session.os || "Unknown OS"}</p>
              <p className="text-sm text-gray-400">
                {ts("createdat")}: {format(new Date(session.createdAt), "PPpp")}
              </p>
            </CardContent>
            <CardFooter>
              <p className="text-xs text-gray-500">{tss("sessionid")}: {session.id}</p>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default ListSessionsForm;

"use client";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { Button } from '../ui/button';
import { useTranslations } from 'next-intl';


export default function ExportButton(
  {
    all,
    handleExportCSV,
    handleExportXLSX
  }: any
) {

  const translate = useTranslations("System")
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2">
          {all ? translate("exportall") : translate("exportselected")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-32">
        <DropdownMenuItem
          onClick={handleExportCSV}
          className="cursor-pointer"
        >
          {translate("exportCSV")}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={handleExportXLSX}
          className="cursor-pointer"
        >
          {translate("exportXLSX")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

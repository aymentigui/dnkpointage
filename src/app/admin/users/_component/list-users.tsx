"use client"
import { DataTable } from "./data-table/data-table-user";
import { useTranslations } from "next-intl";
import Loading from "@/components/myui/loading";
import { useEffect, useState } from "react";
import { useOrigin } from "@/hooks/use-origin";
import { useSearchParams } from "next/navigation";
import axios from "axios";
import SelectFetch from "@/components/myui/select-fetch";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useImportSheetsStore } from "@/hooks/use-import-csv";
import { getColumns } from "@/actions/util/sheet-columns/user";
import { createUsers } from "@/actions/users/set";
import toast from "react-hot-toast";
import { useSession } from "@/hooks/use-session";
import { deleteUsers } from "@/actions/users/delete";
import ConfirmDialogDelete from "@/components/myui/shadcn-dialog-confirm";
import { generateFileClient } from "@/actions/util/export-data/export-client";
import ExportButton from "@/components/my/export-button";
import { getAllUsers, getUsersWithIds } from "@/actions/users/get";

const selectors = [
  { title: "Firstname", selector: "firstname" },
  { title: "Lastname", selector: "lastname" },
  { title: "Username", selector: "username" },
  { title: "Email", selector: "email" },
  { title: "Role", selector: "roles" },
  { title: "Created At", selector: "created_at" },
  { title: "Updated At", selector: "updated_at" },
];

export default function UsersAdminPage() {
  const translate = useTranslations("Users")
  const translateSystem = useTranslations("System");
  const translateErrors = useTranslations("Error")

  const origin = useOrigin()
  const { session } = useSession()
  const searchParams = useSearchParams();

  const [mounted, setMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [data, setData] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [page, setPage] = useState(searchParams.get("page") ? Number(searchParams.get("page")) : 1);
  const [pageSize, setPageSize] = useState(10);
  const [count, setCount] = useState(0);
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(searchParams.get("search")
    && searchParams.get("search") !== null
    ? String(searchParams.get("search"))
    : "");

  // --------------
  // --------------

  const [open, setOpen] = useState(false); // for confirm delete

  const { data: sheetData, setColumns, setData: setSheetData } = useImportSheetsStore();
  const [userSheetNotCreated, setUserSheetNotCreated] = useState<any>([])
  const [userSheetCreated, setUserSheetCreated] = useState(false)
  const columnsSheet = getColumns()

  // --------------
  // --------------


  const exportSelected = async (type: number = 1) => {
    const res = await getUsersWithIds(selectedIds)
    if (res.status !== 200) {
      toast.error(translateErrors("badrequest"))
      return
    }
    const users = res.data
    generateFileClient(selectors, users, type);
  };

  const exportAll = async (type: number = 1) => {
    const res = await getAllUsers()
    if (res.status !== 200) {
      toast.error(translateErrors("badrequest"))
      return
    }
    const users = res.data
    generateFileClient(selectors, users, type);
  };

  const createUsersFromSheet = async () => {
    if (sheetData && sheetData.length > 0) {
      try {
        const res = await createUsers(sheetData)
        if (res.status === 200) {
          if (res.data.users)
            res.data.users.forEach((user) => {
              if (user.status !== 200)
                setUserSheetNotCreated((prev: any) => [...prev, user.data])
              else setUserSheetCreated(true)
            })
        } else toast.error(res.data.message);
      } catch (error) {
        toast.error(translateSystem("errorcreate"));
      } finally {
        setSheetData([]); // Mettre à jour le tableau avec les données créées
      }
    }
  }

  const fetchUsers = async () => {
    setData([]);
    try {
      if (!origin) return
      setIsLoading(true);
      const response = await axios(origin + "/api/admin/users", { params: { page, pageSize, search: debouncedSearchQuery } });
      if (response.status === 200) setData(response.data);

      const countResponse = await axios(origin + "/api/admin/users", { params: { search: debouncedSearchQuery, count: true } });
      if (countResponse.status === 200) setCount(countResponse.data);
      
    } catch (error) { console.error("Error fetching:", error); }
    finally { setIsLoading(false); }
  };

  // -------------------
  // -------------------
  // -------------------

  useEffect(() => {
    setMounted(true);
    setColumns(columnsSheet);
  }, []);

  // pour la creation depuis les sheet
  useEffect(() => {
    createUsersFromSheet();
  }, [sheetData]);

  useEffect(() => {
    if (debouncedSearchQuery !== "" || (debouncedSearchQuery === "" && searchParams.get("search") !== null)) {
      setPage(1)
    }
    fetchUsers();
  }, [page, mounted, debouncedSearchQuery, pageSize]);

  if (!mounted) {
    return (
      <div className="h-[300px] flex items-center justify-center">
        <Loading />
      </div>
    );
  }

  return (
    <div className="py-10">
      <h1 className="text-2xl font-bold mb-4">{translate("title")}</h1>
      {userSheetCreated && (
        <div className="bg-blue-500 text-white p-4 mb-4 rounded">
          {translateSystem("mustrefreshtoseedata")}
        </div>
      )}
      {userSheetNotCreated && userSheetNotCreated.length > 0 && (
        <div className="max-h-48 overflow-auto">
          {userSheetNotCreated.map((data: any, index: any) => (
            <div key={index} className="mt-4 p-4 bg-red-200 text-red-700 rounded">
              <h2 className="font-bold">{translateErrors("errors")}</h2>
              <ul className="list-disc pl-5">
                <li>
                  {
                    (data.message ? data.message + " : " : "") + " " + (data.user.firstname ?? "") + " " + (data.user.lastname ?? "") + " " + (data.user.username ?? "") + " " + (data.user.email ?? "") + " " + (data.user.password ?? "")
                  }
                </li>
              </ul>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2 justify-between items-center">
        <div className="flex gap-2">
          <Link href="/admin/sheetimport">
            <Button>{translateSystem('import')}</Button>
          </Link>
          <ExportButton all={true} handleExportCSV={() => exportAll(1)} handleExportXLSX={() => exportAll(2)} />
          {selectedIds.length > 0 && <ExportButton all={false} handleExportCSV={() => exportSelected(1)} handleExportXLSX={() => exportSelected(2)} />}
          {(session?.user?.permissions.find((permission: string) => permission === "users_delete") ?? false) || session?.user?.is_admin
            &&
            selectedIds.length > 0
            &&
            <ConfirmDialogDelete
              open={open}
              setOpen={setOpen}
              selectedIds={selectedIds}
              textToastSelect={translate("selectusers")}
              triggerText={translate("deleteusers")}
              titleText={translate("confermationdelete")}
              descriptionText={translate("confermationdeletemessage")}
              deleteAction={deleteUsers}
            />
          }
        </div>
        <div className='w-48 mb-2'>
          <SelectFetch
            value={pageSize.toString()}
            onChange={(val) => setPageSize(Number(val))}
            label={translateSystem("pagesize")}
            placeholder={translateSystem("pagesizeplaceholder")}
            options={[
              { value: "10", label: "10" },
              { value: "20", label: "20" },
              { value: "50", label: "50" },
              { value: "100", label: "100" },
            ]}
          />
        </div>
      </div>
      <DataTable
        data={data}
        selectedIds={selectedIds}
        setSelectedIds={setSelectedIds}
        isLoading={isLoading}
        debouncedSearchQuery={debouncedSearchQuery}
        setDebouncedSearchQuery={setDebouncedSearchQuery}
        page={page}
        setPage={setPage}
        pageSize={pageSize}
        count={count}
        showPagination
        showSearch
      />
    </div>
  );
}
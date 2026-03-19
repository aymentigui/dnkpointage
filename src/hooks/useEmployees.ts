import { useState, useEffect } from "react";
import { employeesApi } from "@/lib/api";
import { toast } from "react-hot-toast";

export function useEmployees(initialFilters = {}) {
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(initialFilters);
  const [workspace_id, setWorkspaceId] = useState<string>("");
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    pages: 0,
  });

  const loadEmployees = async () => {
    setLoading(true);
    try {
      const { data } = await employeesApi.getAll({
        ...filters,
        ...pagination,
        workspace_id: workspace_id,
      });
      setEmployees(data.data || []);
      setPagination(data.pagination || pagination);
    } catch (error) {
      toast.error("Erreur lors du chargement");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEmployees();
  }, [filters, pagination.page]);

  const refresh = () => loadEmployees();

  return {
    employees,
    loading,
    filters,
    setFilters,
    pagination,
    setPagination,
    refresh,
  };
}

import { useState, useMemo } from "react";

interface FilterConfig<T> {
  initialFilters: T;
  filterFn: (item: any, filters: T) => boolean;
}

export function useFilters<T extends Record<string, any>>({
  initialFilters,
  filterFn,
}: FilterConfig<T>) {
  const [filters, setFilters] = useState<T>(initialFilters);

  const applyFilters = <U extends any[]>(items: U): U => {
    return items.filter((item) => filterFn(item, filters)) as U;
  };

  const resetFilters = () => {
    setFilters(initialFilters);
  };

  const updateFilter = <K extends keyof T>(key: K, value: T[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const activeFiltersCount = useMemo(() => {
    return Object.values(filters).filter(
      (v) => v !== "" && v !== null && v !== undefined,
    ).length;
  }, [filters]);

  return {
    filters,
    setFilters,
    updateFilter,
    resetFilters,
    applyFilters,
    activeFiltersCount,
  };
}

import { useState, useEffect } from "react";
import { planningApi } from "@/lib/api";
import { toast } from "react-hot-toast";

export function usePlanning(
  matricule?: string,
  dateDebut?: string,
  dateFin?: string,
) {
  const [plannings, setPlannings] = useState<any[]>([]);
  const [annotations, setAnnotations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const loadPlanning = async () => {
    if (!matricule) return;

    setLoading(true);
    try {
      const params: any = {};
      if (dateDebut) params.debut = dateDebut;
      if (dateFin) params.fin = dateFin;

      const { data } = await planningApi.getForEmployee(matricule, params);
      setPlannings(data.plannings || []);
      setAnnotations(data.annotations || []);
    } catch (error) {
      toast.error("Erreur lors du chargement");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlanning();
  }, [matricule, dateDebut, dateFin]);

  const updateCell = async (date: string, statut: string, annotation?: any) => {
    if (!matricule) return;

    try {
      await planningApi.update(matricule, { date, statut, annotation });
      await loadPlanning();
      return true;
    } catch (error) {
      toast.error("Erreur lors de la modification");
      return false;
    }
  };

  const getStatutForDate = (date: string): string => {
    const planning = plannings.find((p) => p.date.split("T")[0] === date);
    const annot = annotations.find((a) => a.date.split("T")[0] === date);
    return annot?.code || planning?.statut || "";
  };

  return {
    plannings,
    annotations,
    loading,
    updateCell,
    getStatutForDate,
    refresh: loadPlanning,
  };
}

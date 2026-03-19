import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api";

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Intercepteur pour gérer les erreurs
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Gérer non auth
    }
    return Promise.reject(error);
  },
);

// Types
export interface Employee {
  id: string;
  matricule: string;
  nom?: string;
  prenom?: string;
  poste?: string;
  zone?: string;
}

export interface Planning {
  id: string;
  employeeId: string;
  date: string;
  statut: "P" | "A" | "R";
  annotationId?: string;
}

export interface Annotation {
  id: string;
  code: "M" | "J" | "Md" | "Rc" | "C" | "Ce";
  libelle: string;
  employeeId: string;
  date: string;
}

export const planningApi = {
  getForEmployee: (matricule: string, params?: any) =>
    api.get(`/employees/${matricule}/planning`, { params }),
  update: (matricule: string, data: any) =>
    api.post(`/employees/${matricule}/planning`, data),
  getAllForWorkspace: (workspaceId: string, params?: any) =>
    api.get(`/workspaces/${workspaceId}/planning`, { params }),
};

export const cyclesApi = {
  detect: (workspace_id: string, matricule?: string) =>
    api.post("/cycles/detect", { matricule, workspace_id }),
  update: (employeeId: string, data: any) =>
    api.put(`/cycles/${employeeId}`, data),
};

// ==================== HISTORIQUE ====================
export const historyApi = {
  getAll: (params?: any) => api.get("/history", { params }),
  getForEmployee: (employeeId: string, params?: any) =>
    api.get(`/history/employee/${employeeId}`, { params }),
  deleteForEmployee: (employeeId: string) =>
    api.delete(`/history/employee/${employeeId}`),
};

// ==================== EXPORT JSON ====================
export const exportApi = {
  excel: (params?: any) =>
    api.get("/export/excel", { params, responseType: "blob" }),
  json: (workspaceId?: string, employeeId?: string) =>
    api.get("/export/json", {
      params: { workspaceId, employeeId },
      responseType: "blob",
    }),
};

// ==================== IMPORT JSON ====================
export const importApi = {
  uploadExcel: (
    file: File,
    mode: string = "nouveau",
    type: string = "pointages",
    workspaceId: string,
  ) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("mode", mode);
    formData.append("type", type);
    formData.append("workspaceId", workspaceId);
    return api.post("/import/excel", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  uploadJson: (file: File, workspaceId: string, mode: string = "nouveau") => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("workspaceId", workspaceId);
    formData.append("mode", mode);
    return api.post("/import/json", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
};

// ==================== WORKSPACE CURRENT ====================
export const workspacesApi = {
  getAll: () => api.get("/workspaces"),
  create: (data: { nom: string }) => api.post("/workspaces", data),
  get: (id: string) => api.get(`/workspaces/${id}`),
  update: (id: string, data: any) => api.put(`/workspaces/${id}`, data),
  delete: (id: string) => api.delete(`/workspaces/${id}`),
  getCurrent: () => api.get("/workspaces/current"),
  setCurrent: (workspaceId: string) =>
    api.post("/workspaces/current", { workspaceId }),
  exportWorkspace: (id: string, format: string = "json") =>
    api.get(`/workspaces/${id}/export?format=${format}`, {
      responseType: "blob",
    }),
};

export const employeesApi = {
  getAll: (params?: any) => api.get("/employees", { params }),
  getDetails: (id: string, params?: { debut?: string; fin?: string }) =>
    api.get(`/employees/${id}`, { params }),

  // GET /api/employees/[id]/planning  → calendrier
  getPlanning: (id: string, params?: { debut?: string; fin?: string }) =>
    api.get(`/employees/${id}/planning`, { params }),

  // GET /api/employees/[id]/pointages  → détail pointages
  getPointages: (id: string, params?: { debut?: string; fin?: string }) =>
    api.get(`/employees/${id}/pointages`, { params }),
  create: (data: Partial<Employee>) => api.post("/employees", data),
};

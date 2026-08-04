import axios from "axios";

const api = axios.create({
  baseURL:
    import.meta.env.VITE_API_URL || "https://starboxbackend.onrender.com/api",
  headers: {
    "Content-Type": "application/json",
  },
});

// Interceptor para adicionar token automaticamente
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor para tratar erros de autenticação
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 423) {
      const lockMessage =
        "Sistema temporariamente bloqueado pelo administrador.";

      localStorage.removeItem("token");
      localStorage.removeItem("usuario");
      if (error.response?.status === 423) {
        localStorage.setItem("auth_lock_reason", lockMessage);
      }

      window.dispatchEvent(
        new CustomEvent("auth:force-logout", {
          detail: {
            reason:
              error.response?.status === 423
                ? lockMessage
                : "Sessão expirada. Faça login novamente.",
            status: error.response?.status,
          },
        }),
      );

      if (window.location.pathname !== "/login") {
        window.location.replace("/login");
      }
    }
    return Promise.reject(error);
  },
);

// APIs para integração do financeiro pessoal

export const billsAPI = {
  getAll: async (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    const response = await api.get(`/financeiro/bills?${params}`);
    return response.data;
  },
  create: async (billData) => {
    const response = await api.post(`/financeiro/bills`, billData);
    return response.data;
  },
  update: async (id, billData) => {
    const response = await api.put(`/financeiro/bills/${id}`, billData);
    return response.data;
  },
  updateStatus: async (id, status) => {
    const response = await api.patch(`/financeiro/bills/${id}/status`, {
      status,
    });
    return response.data;
  },
  // Marca uma ocorrência mensal específica (visão DDA) como paga/aberta,
  // sem afetar o due_date "nativo" do registro. Requer suporte no backend
  // (tabela de ocorrências) — ver prompt de backend enviado ao time.
  setOccurrenceStatus: async (id, month, status) => {
    const response = await api.patch(
      `/financeiro/bills/${id}/occurrences/${month}`,
      { status },
    );
    return response.data;
  },
  delete: async (id) => {
    const response = await api.delete(`/financeiro/bills/${id}`);
    return response.data;
  },
};

export const categoriesAPI = {
  getAll: async () => {
    const response = await api.get(`/financeiro/categories`);
    return response.data;
  },
  create: async (name) => {
    const response = await api.post(`/financeiro/categories`, { name });
    return response.data;
  },
};

export const reportsAPI = {
  getDashboard: async () => {
    const response = await api.get(`/financeiro/reports/dashboard`);
    return response.data;
  },
  getAlerts: async () => {
    const response = await api.get(`/financeiro/reports/alerts`);
    return response.data;
  },
  export: async (format = "pdf") => {
    const response = await api.get(
      `/financeiro/reports/export?format=${format}`,
      { responseType: "blob" },
    );
    return response.data;
  },
};

export const pecasDefeituosasAPI = {
  getDashboardFuncionario: async () => {
    const response = await api.get(`/dashboard/pecas-defeituosas`);
    return response.data;
  },
  getResumoAdmin: async () => {
    const response = await api.get(`/admin/pecas-defeituosas/resumo-funcionarios`);
    return response.data;
  },
  confirmarItem: async (id) => {
    const response = await api.post(`/admin/pecas-defeituosas/${id}/confirmar`);
    return response.data;
  },
  confirmarTudoFuncionario: async (usuarioId) => {
    const response = await api.post(
      `/admin/pecas-defeituosas/confirmar-usuario/${usuarioId}`,
    );
    return response.data;
  },
  esvaziarBase: async () => {
    const response = await api.delete(`/admin/pecas-defeituosas/base/esvaziar`);
    return response.data;
  },
};

export const basesSecundariasAPI = {
  listar: async () => {
    const response = await api.get(`/dashboard/bases-secundarias`);
    return response.data;
  },
  criar: async (baseData) => {
    const response = await api.post(`/dashboard/bases-secundarias`, baseData);
    return response.data;
  },
  editar: async (id, baseData) => {
    const response = await api.put(`/dashboard/bases-secundarias/${id}`, baseData);
    return response.data;
  },
};

export default api;

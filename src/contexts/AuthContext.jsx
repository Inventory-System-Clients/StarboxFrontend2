import { createContext, useContext, useState, useEffect } from "react";
import api from "../services/api";

const AUTH_HEARTBEAT_MS = Math.max(
  1000,
  Number(import.meta.env.VITE_AUTH_HEARTBEAT_MS || 3000),
);

export const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [loading, setLoading] = useState(true);

  const executarLogoutForcado = (reason) => {
    localStorage.removeItem("token");
    localStorage.removeItem("usuario");

    if (reason) {
      localStorage.setItem("auth_lock_reason", reason);
    }

    delete api.defaults.headers.common["Authorization"];
    setUsuario(null);
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    const usuarioSalvo = localStorage.getItem("usuario");

    if (token && usuarioSalvo) {
      setUsuario(JSON.parse(usuarioSalvo));
      api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    if (!usuario) return;

    const intervalId = setInterval(async () => {
      try {
        await api.get("/auth/perfil");
      } catch (error) {
        const status = error?.response?.status;

        if (status === 401 || status === 423) {
          const reason =
            status === 423
              ? "Sistema temporariamente bloqueado pelo administrador."
              : "Sessão expirada. Faça login novamente.";

          executarLogoutForcado(reason);
          if (window.location.pathname !== "/login") {
            window.location.replace("/login");
          }
        }
      }
    }, AUTH_HEARTBEAT_MS);

    return () => clearInterval(intervalId);
  }, [usuario]);

  useEffect(() => {
    const handleForcedLogout = (event) => {
      const reason = event?.detail?.reason;
      executarLogoutForcado(reason);
    };

    window.addEventListener("auth:force-logout", handleForcedLogout);

    return () => {
      window.removeEventListener("auth:force-logout", handleForcedLogout);
    };
  }, []);

  const login = async (email, senha) => {
    try {
      const response = await api.post("/auth/login", { email, senha });
      const { token, usuario: usuarioData } = response.data;

      localStorage.setItem("token", token);
      localStorage.setItem("usuario", JSON.stringify(usuarioData));
      api.defaults.headers.common["Authorization"] = `Bearer ${token}`;

      setUsuario(usuarioData);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error:
          error.response?.data?.error ||
          error.response?.data?.detail ||
          "Erro ao fazer login",
      };
    }
  };

  const registrar = async (nome, email, senha, telefone) => {
    try {
      const response = await api.post("/auth/registrar", {
        nome,
        email,
        senha,
        telefone,
      });
      const { token, usuario: usuarioData } = response.data;

      localStorage.setItem("token", token);
      localStorage.setItem("usuario", JSON.stringify(usuarioData));
      api.defaults.headers.common["Authorization"] = `Bearer ${token}`;

      setUsuario(usuarioData);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error:
          error.response?.data?.error ||
          error.response?.data?.detail ||
          "Erro ao registrar",
      };
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("usuario");
    delete api.defaults.headers.common["Authorization"];
    setUsuario(null);
  };

  const isAdmin = () => usuario?.role === "ADMIN";

  return (
    <AuthContext.Provider
      value={{
        usuario,
        loading,
        login,
        registrar,
        logout,
        isAdmin,
        signed: !!usuario,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth deve ser usado dentro de um AuthProvider");
  }
  return context;
}

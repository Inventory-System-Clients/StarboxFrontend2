import { useEffect, useMemo, useState } from "react";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "https://starboxbackend.onrender.com/api";

export default function SecurityLockPage() {
  const [senha, setSenha] = useState("");
  const [securityToken, setSecurityToken] = useState(
    () => sessionStorage.getItem("security_panel_token") || "",
  );
  const [isLocked, setIsLocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [statusMsg, setStatusMsg] = useState("");
  const [unlockCooldownSeconds, setUnlockCooldownSeconds] = useState(0);

  useEffect(() => {
    if (unlockCooldownSeconds <= 0) return;

    const timer = setInterval(() => {
      setUnlockCooldownSeconds((seconds) => (seconds > 0 ? seconds - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [unlockCooldownSeconds]);

  const headers = useMemo(() => {
    if (!securityToken) return { "Content-Type": "application/json" };
    return {
      "Content-Type": "application/json",
      "x-security-token": securityToken,
    };
  }, [securityToken]);

  const carregarStatus = async (tokenParam = securityToken) => {
    if (!tokenParam) return;

    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE_URL}/security/status`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "x-security-token": tokenParam,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Falha ao obter status");
      }

      setIsLocked(Boolean(data.isLocked));
      setUnlockCooldownSeconds(Number(data.unlockCooldownSeconds || 0));
      setStatusMsg(data.isLocked ? "SISTEMA BLOQUEADO" : "SISTEMA LIBERADO");
    } catch (err) {
      setError(err.message || "Erro ao consultar status");
      sessionStorage.removeItem("security_panel_token");
      setSecurityToken("");
    } finally {
      setLoading(false);
    }
  };

  const entrarPainel = async (event) => {
    event.preventDefault();

    if (!senha) {
      setError("Informe a senha de segurança");
      return;
    }

    setLoading(true);
    setError("");
    setStatusMsg("");

    try {
      const response = await fetch(`${API_BASE_URL}/security/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senha }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Senha inválida");
      }

      sessionStorage.setItem("security_panel_token", data.token);
      setSecurityToken(data.token);
      setSenha("");
      await carregarStatus(data.token);
    } catch (err) {
      setError(err.message || "Não foi possível autenticar");
    } finally {
      setLoading(false);
    }
  };

  const alternarBloqueio = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE_URL}/security/toggle`, {
        method: "POST",
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 429 && data.unlockCooldownSeconds) {
          setUnlockCooldownSeconds(Number(data.unlockCooldownSeconds));
        }
        throw new Error(data.error || "Falha ao alternar bloqueio");
      }

      setIsLocked(Boolean(data.isLocked));
      setUnlockCooldownSeconds(Number(data.unlockCooldownSeconds || 0));
      setStatusMsg(data.message || "Status alterado");

      localStorage.removeItem("token");
      localStorage.removeItem("usuario");
    } catch (err) {
      setError(err.message || "Erro ao alternar bloqueio");
    } finally {
      setLoading(false);
    }
  };

  const sairPainel = () => {
    sessionStorage.removeItem("security_panel_token");
    setSecurityToken("");
    setError("");
    setStatusMsg("");
  };

  if (!securityToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <form
          onSubmit={entrarPainel}
          className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg"
        >
          <h1 className="text-2xl font-bold text-gray-900">
            Painel de Segurança
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Informe a senha mestra para acessar o controle global do sistema.
          </p>

          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="mt-4 w-full rounded-lg border border-gray-300 px-3 py-2"
            placeholder="Senha de segurança"
            autoComplete="current-password"
          />

          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-4 w-full rounded-lg bg-black px-4 py-2 font-semibold text-white disabled:opacity-60"
          >
            {loading ? "Verificando..." : "Entrar"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-lg">
        <h1 className="text-2xl font-bold text-gray-900">
          Controle Global do Sistema
        </h1>

        <p className="mt-3 text-sm font-semibold text-gray-700">
          Status atual: {isLocked ? "BLOQUEADO" : "LIBERADO"}
        </p>

        {statusMsg && <p className="mt-2 text-sm text-blue-700">{statusMsg}</p>}
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

        <button
          onClick={alternarBloqueio}
          disabled={loading || (isLocked && unlockCooldownSeconds > 0)}
          className={`mt-5 w-full rounded-lg px-4 py-3 font-bold text-white disabled:opacity-60 ${
            isLocked ? "bg-emerald-600" : "bg-red-700"
          }`}
        >
          {loading
            ? "Processando..."
            : isLocked
              ? unlockCooldownSeconds > 0
                ? `DESTRAVAR EM ${unlockCooldownSeconds}s`
                : "DESTRAVAR SITE"
              : "TRAVAR SITE"}
        </button>

        <div className="mt-3 flex gap-2">
          <button
            onClick={() => carregarStatus()}
            disabled={loading}
            className="w-1/2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 disabled:opacity-60"
          >
            Atualizar status
          </button>
          <button
            onClick={sairPainel}
            className="w-1/2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700"
          >
            Sair do painel
          </button>
        </div>
      </div>
    </div>
  );
}

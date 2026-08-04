import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { pecasDefeituosasAPI } from "../services/api";

const formatDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("pt-BR");
};

const getErrorMessage = (error) => {
  const status = error?.response?.status;

  if (status === 403) {
    return "Você não tem permissão para acessar a aba de peças defeituosas.";
  }

  if (status === 404) {
    return "Rota de peças defeituosas não encontrada no backend.";
  }

  if (status >= 500) {
    return "Erro interno do servidor ao carregar as peças defeituosas.";
  }

  return (
    error?.response?.data?.error ||
    error?.response?.data?.detail ||
    error?.message ||
    "Erro ao carregar dados de peças defeituosas"
  );
};

export default function PecasDefeituosasDashboard() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [dados, setDados] = useState({
    pendentes: [],
    naBase: [],
    totais: { pendentes: 0, naBase: 0 },
  });

  const carregarDados = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");
      const payload = await pecasDefeituosasAPI.getDashboardFuncionario();

      setDados({
        pendentes: Array.isArray(payload?.pendentes) ? payload.pendentes : [],
        naBase: Array.isArray(payload?.naBase) ? payload.naBase : [],
        totais: {
          pendentes: Number(payload?.totais?.pendentes || 0),
          naBase: Number(payload?.totais?.naBase || 0),
        },
      });
    } catch (err) {
      const status = err?.response?.status;
      setError(getErrorMessage(err));

      if (status === 401) {
        navigate("/login");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [navigate]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  return (
    <div className="min-h-screen bg-[rgb(242,242,242)] flex flex-col">
      <Navbar />

      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 flex-1">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-[#24094E]">Peças defeituosas</h1>
            <p className="text-[#733D38] mt-1">
              Acompanhe suas pendências de devolução e o histórico já confirmado na base.
            </p>
          </div>

          <button
            type="button"
            onClick={() => carregarDados(true)}
            disabled={loading || refreshing}
            className="bg-[#62A1D9] hover:bg-[#24094E] disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold px-4 py-2 rounded-lg shadow transition-colors"
          >
            {refreshing ? "Atualizando..." : "Atualizar"}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow p-5 border-l-4 border-orange-500">
            <p className="text-sm text-gray-600">Pendentes de devolução</p>
            <p className="text-3xl font-bold text-orange-600 mt-1">{dados.totais.pendentes}</p>
          </div>

          <div className="bg-white rounded-xl shadow p-5 border-l-4 border-green-600">
            <p className="text-sm text-gray-600">Já confirmadas na base</p>
            <p className="text-3xl font-bold text-green-700 mt-1">{dados.totais.naBase}</p>
          </div>
        </div>

        {loading ? (
          <div className="bg-white rounded-xl shadow p-8 text-center text-gray-600">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#24094E] mx-auto mb-4" />
            Carregando peças defeituosas...
          </div>
        ) : error ? (
          <div className="bg-white rounded-xl shadow p-6 border-l-4 border-red-500">
            <h2 className="text-lg font-semibold text-red-700">Erro ao carregar dados</h2>
            <p className="text-gray-700 mt-2">{error}</p>
            <button
              type="button"
              onClick={() => carregarDados(true)}
              disabled={refreshing}
              className="mt-4 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-semibold px-4 py-2 rounded-lg"
            >
              Tentar novamente
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <section className="bg-white rounded-xl shadow p-6">
              <h2 className="text-xl font-bold text-[#24094E] mb-3">Pendentes de devolução</h2>

              {dados.pendentes.length === 0 ? (
                <p className="text-gray-600">Nenhuma peça pendente no momento.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left border-b">
                        <th className="py-2 pr-3">Peça original</th>
                        <th className="py-2 pr-3">Peça defeituosa</th>
                        <th className="py-2 pr-3">Quantidade</th>
                        <th className="py-2">Criado em</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dados.pendentes.map((item) => (
                        <tr key={item.id} className="border-b last:border-b-0">
                          <td className="py-2 pr-3 font-medium">{item.nomePecaOriginal || "-"}</td>
                          <td className="py-2 pr-3">{item.nomePecaDefeituosa || "-"}</td>
                          <td className="py-2 pr-3">{item.quantidade || 0}</td>
                          <td className="py-2">{formatDateTime(item.criadoEm)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="bg-white rounded-xl shadow p-6">
              <h2 className="text-xl font-bold text-[#24094E] mb-3">Já confirmadas (na base)</h2>

              {dados.naBase.length === 0 ? (
                <p className="text-gray-600">Ainda não há peças confirmadas na base.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left border-b">
                        <th className="py-2 pr-3">Peça original</th>
                        <th className="py-2 pr-3">Peça defeituosa</th>
                        <th className="py-2 pr-3">Quantidade</th>
                        <th className="py-2 pr-3">Confirmado em</th>
                        <th className="py-2">Confirmado por</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dados.naBase.map((item) => (
                        <tr key={item.id} className="border-b last:border-b-0">
                          <td className="py-2 pr-3 font-medium">{item.nomePecaOriginal || "-"}</td>
                          <td className="py-2 pr-3">{item.nomePecaDefeituosa || "-"}</td>
                          <td className="py-2 pr-3">{item.quantidade || 0}</td>
                          <td className="py-2 pr-3">{formatDateTime(item.confirmadoEm)}</td>
                          <td className="py-2">{item.confirmadoPorId || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

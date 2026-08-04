import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";

import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { pecasDefeituosasAPI } from "../services/api";

const formatDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("pt-BR");
};

const getErrorMessage = (error, fallback) => {
  const status = error?.response?.status;

  if (status === 403) {
    return "Você não tem permissão para acessar esta funcionalidade.";
  }

  if (status === 404) {
    return "Recurso não encontrado para peças defeituosas.";
  }

  if (status >= 500) {
    return "Erro interno do servidor ao processar a solicitação.";
  }

  return (
    error?.response?.data?.error ||
    error?.response?.data?.detail ||
    error?.message ||
    fallback
  );
};

const normalizeResumo = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.usuarios)) return payload.usuarios;
  if (Array.isArray(payload?.resumoFuncionarios)) return payload.resumoFuncionarios;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};

const getNomeUsuario = (item) => {
  return item?.usuarioNome || item?.nome || item?.usuario?.nome || "Funcionário";
};

export default function PecasDefeituosasAdminPage() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [resumo, setResumo] = useState([]);
  const [processingItemId, setProcessingItemId] = useState("");
  const [processingUsuarioId, setProcessingUsuarioId] = useState("");
  const [clearingBase, setClearingBase] = useState(false);

  const carregarResumo = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");
      const payload = await pecasDefeituosasAPI.getResumoAdmin();
      setResumo(normalizeResumo(payload));
    } catch (err) {
      const status = err?.response?.status;
      setError(getErrorMessage(err, "Erro ao carregar resumo de peças defeituosas"));

      if (status === 401) {
        navigate("/login");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [navigate]);

  useEffect(() => {
    carregarResumo();
  }, [carregarResumo]);

  const totaisGerais = useMemo(() => {
    return resumo.reduce(
      (acc, usuarioItem) => {
        const pendentes = Number(usuarioItem?.totais?.pendentes || usuarioItem?.pendentes?.length || 0);
        const naBase = Number(usuarioItem?.totais?.naBase || usuarioItem?.naBase?.length || 0);
        return {
          pendentes: acc.pendentes + pendentes,
          naBase: acc.naBase + naBase,
        };
      },
      { pendentes: 0, naBase: 0 },
    );
  }, [resumo]);

  const confirmarItem = async (itemId) => {
    const confirmacao = await Swal.fire({
      icon: "question",
      title: "Confirmar devolução",
      text: "Deseja confirmar a devolução desta peça defeituosa?",
      showCancelButton: true,
      confirmButtonText: "Sim, confirmar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#16a34a",
    });

    if (!confirmacao.isConfirmed) return;

    try {
      setProcessingItemId(itemId);
      await pecasDefeituosasAPI.confirmarItem(itemId);
      await carregarResumo(true);

      await Swal.fire({
        icon: "success",
        title: "Devolução confirmada",
        text: "A peça foi movida para a base de peças defeituosas.",
        confirmButtonColor: "#16a34a",
      });
    } catch (err) {
      await Swal.fire({
        icon: "error",
        title: "Falha ao confirmar",
        text: getErrorMessage(err, "Erro ao confirmar devolução"),
        confirmButtonColor: "#dc2626",
      });
    } finally {
      setProcessingItemId("");
    }
  };

  const confirmarTudo = async (usuarioId, nomeUsuario) => {
    const confirmacao = await Swal.fire({
      icon: "question",
      title: "Confirmar tudo do funcionário",
      text: `Deseja confirmar todas as devoluções pendentes de ${nomeUsuario}?`,
      showCancelButton: true,
      confirmButtonText: "Sim, confirmar tudo",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#16a34a",
    });

    if (!confirmacao.isConfirmed) return;

    try {
      setProcessingUsuarioId(usuarioId);
      await pecasDefeituosasAPI.confirmarTudoFuncionario(usuarioId);
      await carregarResumo(true);

      await Swal.fire({
        icon: "success",
        title: "Confirmação em lote concluída",
        text: `As peças pendentes de ${nomeUsuario} foram confirmadas.`,
        confirmButtonColor: "#16a34a",
      });
    } catch (err) {
      await Swal.fire({
        icon: "error",
        title: "Falha na confirmação em lote",
        text: getErrorMessage(err, "Erro ao confirmar em lote"),
        confirmButtonColor: "#dc2626",
      });
    } finally {
      setProcessingUsuarioId("");
    }
  };

  const esvaziarBase = async () => {
    const primeiraConfirmacao = await Swal.fire({
      icon: "warning",
      title: "Esvaziar base",
      text: "Esta ação remove todos os itens já confirmados da base. Deseja continuar?",
      showCancelButton: true,
      confirmButtonText: "Continuar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#dc2626",
    });

    if (!primeiraConfirmacao.isConfirmed) return;

    const segundaConfirmacao = await Swal.fire({
      icon: "warning",
      title: "Confirmação final",
      text: "Confirma em definitivo esvaziar toda a base de peças defeituosas?",
      showCancelButton: true,
      confirmButtonText: "Sim, esvaziar base",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#b91c1c",
    });

    if (!segundaConfirmacao.isConfirmed) return;

    try {
      setClearingBase(true);
      await pecasDefeituosasAPI.esvaziarBase();
      await carregarResumo(true);

      await Swal.fire({
        icon: "success",
        title: "Base esvaziada",
        text: "A base de peças defeituosas foi limpa com sucesso.",
        confirmButtonColor: "#16a34a",
      });
    } catch (err) {
      await Swal.fire({
        icon: "error",
        title: "Falha ao esvaziar base",
        text: getErrorMessage(err, "Erro ao esvaziar base"),
        confirmButtonColor: "#dc2626",
      });
    } finally {
      setClearingBase(false);
    }
  };

  return (
    <div className="min-h-screen bg-[rgb(242,242,242)] flex flex-col">
      <Navbar />

      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 flex-1">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-[#24094E]">Controle de peças defeituosas</h1>
            <p className="text-[#733D38] mt-1">
              Resumo por funcionário, confirmações e gestão da base de peças defeituosas.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => carregarResumo(true)}
              disabled={loading || refreshing || clearingBase}
              className="bg-[#62A1D9] hover:bg-[#24094E] disabled:opacity-60 text-white font-semibold px-4 py-2 rounded-lg"
            >
              {refreshing ? "Atualizando..." : "Atualizar"}
            </button>

            <button
              type="button"
              onClick={esvaziarBase}
              disabled={loading || refreshing || clearingBase}
              className="bg-red-700 hover:bg-red-800 disabled:opacity-60 text-white font-semibold px-4 py-2 rounded-lg"
            >
              {clearingBase ? "Esvaziando..." : "Esvaziar base"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow p-5 border-l-4 border-orange-500">
            <p className="text-sm text-gray-600">Total pendente (todos os funcionários)</p>
            <p className="text-3xl font-bold text-orange-600 mt-1">{totaisGerais.pendentes}</p>
          </div>
          <div className="bg-white rounded-xl shadow p-5 border-l-4 border-green-600">
            <p className="text-sm text-gray-600">Total na base (todos os funcionários)</p>
            <p className="text-3xl font-bold text-green-700 mt-1">{totaisGerais.naBase}</p>
          </div>
        </div>

        {loading ? (
          <div className="bg-white rounded-xl shadow p-8 text-center text-gray-600">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#24094E] mx-auto mb-4" />
            Carregando resumo de peças defeituosas...
          </div>
        ) : error ? (
          <div className="bg-white rounded-xl shadow p-6 border-l-4 border-red-500">
            <h2 className="text-lg font-semibold text-red-700">Erro ao carregar resumo</h2>
            <p className="text-gray-700 mt-2">{error}</p>
            <button
              type="button"
              onClick={() => carregarResumo(true)}
              disabled={refreshing}
              className="mt-4 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-semibold px-4 py-2 rounded-lg"
            >
              Tentar novamente
            </button>
          </div>
        ) : resumo.length === 0 ? (
          <div className="bg-white rounded-xl shadow p-6 text-gray-600">
            Nenhum dado de peças defeituosas encontrado no momento.
          </div>
        ) : (
          <div className="space-y-6">
            {resumo.map((usuarioItem, index) => {
              const usuarioId = usuarioItem?.usuarioId || usuarioItem?.usuario?.id || "";
              const pendentes = Array.isArray(usuarioItem?.pendentes)
                ? usuarioItem.pendentes
                : [];
              const naBase = Array.isArray(usuarioItem?.naBase)
                ? usuarioItem.naBase
                : [];
              const totais = {
                pendentes: Number(usuarioItem?.totais?.pendentes || pendentes.length || 0),
                naBase: Number(usuarioItem?.totais?.naBase || naBase.length || 0),
              };
              const nomeUsuario = getNomeUsuario(usuarioItem);

              return (
                <section key={usuarioId || `${nomeUsuario}-${index}`} className="bg-white rounded-xl shadow p-6">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                    <div>
                      <h2 className="text-xl font-bold text-[#24094E]">{nomeUsuario}</h2>
                      <p className="text-sm text-gray-600 mt-1">
                        Pendentes: {totais.pendentes} | Na base: {totais.naBase}
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={!usuarioId || totais.pendentes === 0 || processingUsuarioId === usuarioId || !!processingItemId || clearingBase}
                      onClick={() => confirmarTudo(usuarioId, nomeUsuario)}
                      className="bg-green-600 hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold px-4 py-2 rounded-lg"
                    >
                      {processingUsuarioId === usuarioId ? "Confirmando..." : "Confirmar tudo do funcionário"}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <div className="border rounded-lg p-4">
                      <h3 className="font-semibold text-gray-900 mb-3">Pendentes de devolução</h3>

                      {pendentes.length === 0 ? (
                        <p className="text-sm text-gray-600">Sem pendências para este funcionário.</p>
                      ) : (
                        <div className="space-y-2">
                          {pendentes.map((item) => (
                            <div key={item.id} className="border rounded-lg p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                              <div>
                                <p className="font-medium text-gray-900">{item.nomePecaDefeituosa || "-"}</p>
                                <p className="text-sm text-gray-600">
                                  Original: {item.nomePecaOriginal || "-"} | Qtd: {item.quantidade || 0}
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                  Criado em: {formatDateTime(item.criadoEm)}
                                </p>
                              </div>

                              <button
                                type="button"
                                onClick={() => confirmarItem(item.id)}
                                disabled={processingItemId === item.id || !!processingUsuarioId || clearingBase}
                                className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-semibold px-3 py-2 rounded-lg text-sm"
                              >
                                {processingItemId === item.id ? "Confirmando..." : "Confirmar item"}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="border rounded-lg p-4">
                      <h3 className="font-semibold text-gray-900 mb-3">Histórico na base</h3>

                      {naBase.length === 0 ? (
                        <p className="text-sm text-gray-600">Sem itens confirmados para este funcionário.</p>
                      ) : (
                        <div className="space-y-2 max-h-80 overflow-auto pr-1">
                          {naBase.map((item) => (
                            <div key={item.id} className="border rounded-lg p-3">
                              <p className="font-medium text-gray-900">{item.nomePecaDefeituosa || "-"}</p>
                              <p className="text-sm text-gray-600">
                                Original: {item.nomePecaOriginal || "-"} | Qtd: {item.quantidade || 0}
                              </p>
                              <p className="text-xs text-gray-500 mt-1">
                                Confirmado em: {formatDateTime(item.confirmadoEm)}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

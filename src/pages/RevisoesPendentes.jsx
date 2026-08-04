import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { PageLoader } from "../components/Loading";
import { Modal } from "../components/UIComponents";
import {
  listarRevisoesPendentes,
  concluirRevisao,
  verificarTodasRevisoes,
} from "../services/revisoesVeiculos";
import Swal from "sweetalert2";

export default function RevisoesPendentes() {
  const { usuario } = useAuth();
  const [revisoes, setRevisoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [veiculoSelecionado, setVeiculoSelecionado] = useState(null);
  const [kmRevisao, setKmRevisao] = useState("");
  const [processando, setProcessando] = useState(false);

  useEffect(() => {
    carregarRevisoes();
  }, []);

  const carregarRevisoes = async () => {
    try {
      setLoading(true);
      const data = await listarRevisoesPendentes();
      setRevisoes(data);
    } catch (error) {
      console.error("Erro ao carregar revisões:", error);
      // Não mostrar erro se endpoint não existe ainda (404)
      if (error?.response?.status !== 404) {
        Swal.fire({
          icon: "error",
          title: "Erro",
          text: "Não foi possível carregar as revisões pendentes",
          confirmButtonColor: "#62A1D9",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const abrirModalConcluir = (revisao) => {
    setVeiculoSelecionado(revisao);
    setKmRevisao(revisao.kmAtual.toString());
    setModalVisible(true);
  };

  const handleConcluirRevisao = async () => {
    if (!veiculoSelecionado) return;

    // Validar KM
    const kmNumero = parseInt(kmRevisao);
    if (kmRevisao && (isNaN(kmNumero) || kmNumero <= 0)) {
      Swal.fire({
        icon: "warning",
        title: "KM Inválido",
        text: "Digite um valor válido para o KM da revisão",
        confirmButtonColor: "#62A1D9",
      });
      return;
    }

    try {
      setProcessando(true);
      await concluirRevisao(
        veiculoSelecionado.veiculoId,
        kmRevisao ? kmNumero : null
      );

      Swal.fire({
        icon: "success",
        title: "Sucesso!",
        text: "Revisão marcada como concluída",
        confirmButtonColor: "#62A1D9",
      });

      setModalVisible(false);
      setVeiculoSelecionado(null);
      setKmRevisao("");
      carregarRevisoes();
    } catch (error) {
      console.error("Erro ao concluir revisão:", error);
      Swal.fire({
        icon: "error",
        title: "Erro",
        text:
          error?.message || 
          error?.response?.data?.error ||
          "Não foi possível concluir a revisão",
        confirmButtonColor: "#62A1D9",
      });
    } finally {
      setProcessando(false);
    }
  };

  const handleVerificarTodas = async () => {
    try {
      setLoading(true);
      const resultado = await verificarTodasRevisoes();

      Swal.fire({
        icon: "info",
        title: "Verificação Concluída",
        text: `${resultado.alertasCriados} alerta(s) criado(s)`,
        confirmButtonColor: "#62A1D9",
      });

      carregarRevisoes();
    } catch (error) {
      console.error("Erro ao verificar revisões:", error);
      Swal.fire({
        icon: "error",
        title: "Erro",
        text: error?.message || "Não foi possível verificar as revisões",
        confirmButtonColor: "#62A1D9",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatarKm = (km) => {
    return km.toLocaleString("pt-BR");
  };

  const calcularAtraso = (kmAtual, kmRevisaoDevida) => {
    return kmAtual - kmRevisaoDevida;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F2F2F2]">
        <Navbar />
        <PageLoader />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F2F2F2]">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2 text-[#24094E]">
              🔧 Revisões Pendentes
            </h1>
            <p className="text-[#733D38]">
              Veículos que precisam de revisão a cada 10.000 km
            </p>
          </div>

          {usuario?.role === "ADMIN" && (
            <button
              onClick={handleVerificarTodas}
              className="bg-[#A6806A] hover:bg-[#733D38] text-white font-bold px-4 py-2 rounded-lg flex items-center gap-2 shadow transition-colors"
              title="Verificar todas as revisões"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                />
              </svg>
              Verificar Todas
            </button>
          )}
        </div>

        {/* Lista de Revisões */}
        {revisoes.length === 0 ? (
          <div className="card text-center py-12">
            <div className="flex flex-col items-center gap-4">
              <div className="text-6xl">✅</div>
              <h3 className="text-2xl font-bold text-[#24094E]">
                Nenhuma revisão pendente!
              </h3>
              <p className="text-[#733D38]">
                Todos os veículos estão em dia com as revisões.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {revisoes.map((revisao) => {
              const atraso = calcularAtraso(
                revisao.kmAtual,
                revisao.kmRevisaoDevida
              );
              const percentualAtraso =
                (atraso / revisao.kmRevisaoDevida) * 100;
              const corAtraso =
                percentualAtraso > 20
                  ? "bg-red-100 border-red-300"
                  : percentualAtraso > 10
                    ? "bg-orange-100 border-orange-300"
                    : "bg-yellow-100 border-yellow-300";

              return (
                <div
                  key={revisao.veiculoId}
                  className={`border-2 rounded-lg p-6 shadow-md ${corAtraso}`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-2xl font-bold text-[#24094E] flex items-center gap-2">
                        <span className="text-3xl">⚠️</span>
                        {revisao.veiculoNome}
                      </h3>
                      <p className="text-[#733D38] font-medium">
                        {revisao.veiculoModelo}
                      </p>
                    </div>

                    <div className="text-right">
                      <div className="bg-red-500 text-white px-3 py-1 rounded-full text-sm font-bold">
                        Atrasada ~{formatarKm(atraso)} km
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="bg-white rounded-lg p-4 shadow-sm">
                      <div className="text-sm text-[#733D38] font-medium mb-1">
                        KM Atual
                      </div>
                      <div className="text-2xl font-bold text-[#24094E]">
                        {formatarKm(revisao.kmAtual)}
                      </div>
                    </div>

                    <div className="bg-white rounded-lg p-4 shadow-sm">
                      <div className="text-sm text-[#733D38] font-medium mb-1">
                        Revisão devida aos
                      </div>
                      <div className="text-2xl font-bold text-[#62A1D9]">
                        {formatarKm(revisao.kmRevisaoDevida)} km
                      </div>
                    </div>

                    <div className="bg-white rounded-lg p-4 shadow-sm">
                      <div className="text-sm text-[#733D38] font-medium mb-1">
                        Próxima revisão
                      </div>
                      <div className="text-2xl font-bold text-[#A6806A]">
                        {formatarKm(revisao.proximaRevisaoKm)} km
                      </div>
                    </div>
                  </div>

                  {(usuario?.role === "ADMIN" ||
                    usuario?.role === "GERENCIADOR") && (
                    <button
                      onClick={() => abrirModalConcluir(revisao)}
                      className="w-full bg-[#62A1D9] hover:bg-[#24094E] text-white font-bold px-6 py-3 rounded-lg flex items-center justify-center gap-2 shadow transition-colors"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      Marcar como Concluída
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Modal de Conclusão */}
        <Modal
          isOpen={modalVisible}
          onClose={() => {
            if (!processando) {
              setModalVisible(false);
              setVeiculoSelecionado(null);
              setKmRevisao("");
            }
          }}
          title="🔧 Concluir Revisão"
          size="md"
        >
          {veiculoSelecionado && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="font-bold text-blue-800 mb-2">
                  Veículo: {veiculoSelecionado.veiculoNome}
                </p>
                <p className="text-sm text-gray-700">
                  Modelo: {veiculoSelecionado.veiculoModelo}
                </p>
                <p className="text-sm text-gray-700">
                  KM Atual: {formatarKm(veiculoSelecionado.kmAtual)}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  KM em que a revisão foi feita:
                </label>
                <input
                  type="number"
                  className="input-field w-full"
                  value={kmRevisao}
                  onChange={(e) => setKmRevisao(e.target.value)}
                  placeholder={`Ex: ${veiculoSelecionado.kmAtual}`}
                  min="0"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Deixe vazio para usar o KM atual (
                  {formatarKm(veiculoSelecionado.kmAtual)})
                </p>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-800">
                  <strong>⚠️ Importante:</strong> Após marcar como concluída, a
                  próxima revisão será programada para mais 10.000 km.
                </p>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  className="btn-secondary flex-1"
                  onClick={() => {
                    setModalVisible(false);
                    setVeiculoSelecionado(null);
                    setKmRevisao("");
                  }}
                  disabled={processando}
                >
                  Cancelar
                </button>
                <button
                  className="btn-primary flex-1"
                  onClick={handleConcluirRevisao}
                  disabled={processando}
                >
                  {processando ? "Processando..." : "✅ Confirmar Conclusão"}
                </button>
              </div>
            </div>
          )}
        </Modal>
      </div>

      <Footer />
    </div>
  );
}

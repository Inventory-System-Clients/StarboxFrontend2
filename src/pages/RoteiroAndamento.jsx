import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../services/api";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer.jsx";
import { AlertBox, PageHeader } from "../components/UIComponents";
import { LoadingSpinner } from "../components/Loading";

const STATUS_FINALIZADO = new Set([
  "finalizado",
  "finalizada",
  "concluido",
  "concluida",
]);

const normalizarTexto = (valor) => String(valor || "").trim();

const formatarDataBR = (data) => {
  if (!data) return "-";
  const dataObj = new Date(data);
  if (Number.isNaN(dataObj.getTime())) return "-";
  return dataObj.toLocaleDateString("pt-BR");
};

const formatarDataHoraBR = (data) => {
  if (!data) return "-";
  const dataObj = new Date(data);
  if (Number.isNaN(dataObj.getTime())) return "-";
  return dataObj.toLocaleString("pt-BR");
};

const lojaConcluida = (loja) => {
  const status = normalizarTexto(loja?.status).toLowerCase();
  return STATUS_FINALIZADO.has(status);
};

const maquinaConcluida = (maquina) => {
  const status = normalizarTexto(maquina?.status).toLowerCase();
  return STATUS_FINALIZADO.has(status);
};

export default function RoteiroAndamento() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const roteiro = dados?.roteiro || {};
  const execucaoSemanal = dados?.execucaoSemanal || {};
  const lojas = Array.isArray(dados?.lojas) ? dados.lojas : [];

  const titulo = useMemo(
    () => `Roteiro: ${normalizarTexto(roteiro?.nome) || "-"}`,
    [roteiro?.nome],
  );

  const carregarAndamento = useCallback(async () => {
    if (!id) return;

    try {
      setError("");
      const response = await api.get(`/roteiros/${id}/ver-andamento`);
      setDados(response?.data || null);
    } catch (err) {
      if (err?.response?.status === 404) {
        setError("Roteiro não está mais em andamento.");
        return;
      }
      setError(err?.response?.data?.error || "Erro ao carregar andamento.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    setLoading(true);
    carregarAndamento();
  }, [carregarAndamento]);

  useEffect(() => {
    if (!id) return undefined;
    const intervalId = window.setInterval(() => {
      carregarAndamento();
    }, 10000);

    return () => window.clearInterval(intervalId);
  }, [carregarAndamento, id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 text-[#24094E]">
        <Navbar />
        <div className="max-w-4xl mx-auto px-4 py-10">
          <LoadingSpinner message="Carregando andamento..." />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 text-[#24094E]">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <PageHeader
          title={titulo}
          subtitle="Visualização em modo leitura"
          icon="🔒"
          action={{
            label: "Voltar",
            onClick: () => navigate("/roteiros"),
          }}
        />

        {error && (
          <AlertBox type="warning" message={error} onClose={() => setError("")} />
        )}

        <section className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h3 className="text-sm font-bold text-amber-900 mb-2">
            Visualizando roteiro em andamento
          </h3>
          <div className="text-sm text-amber-900 space-y-1">
            <p>Responsável: {normalizarTexto(execucaoSemanal?.usuarioAssociado?.nome || execucaoSemanal?.usuarioAssociadoNome || "-")}</p>
            <p>Iniciado em: {formatarDataBR(execucaoSemanal?.dataInicio || execucaoSemanal?.iniciadoEm)}</p>
            {normalizarTexto(dados?.avisoPermissoes) && (
              <p className="text-xs">{normalizarTexto(dados?.avisoPermissoes)}</p>
            )}
          </div>
        </section>

        <section className="mb-6 rounded-xl border border-gray-200 bg-white p-4">
          <h3 className="text-sm font-bold text-gray-800 mb-4">Pontos e máquinas</h3>
          {lojas.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhuma loja disponível.</p>
          ) : (
            <div className="space-y-4">
              {lojas.map((loja) => (
                <div
                  key={loja.id}
                  className="rounded-lg border border-gray-200 bg-gray-50 p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold">
                      {normalizarTexto(loja?.nome) || "Loja"}
                    </h4>
                    <span
                      className={`text-xs font-bold uppercase ${
                        lojaConcluida(loja) ? "text-green-700" : "text-amber-700"
                      }`}
                    >
                      {lojaConcluida(loja) ? "Finalizado" : "Pendente"}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {(Array.isArray(loja?.maquinas) ? loja.maquinas : []).map(
                      (maquina) => (
                        <div
                          key={maquina.id}
                          className="flex items-center justify-between text-sm"
                        >
                          <span>{normalizarTexto(maquina?.nome) || "Máquina"}</span>
                          <span
                            className={
                              maquinaConcluida(maquina)
                                ? "text-green-700"
                                : "text-amber-700"
                            }
                          >
                            {maquinaConcluida(maquina) ? "✅" : "⏳"}
                          </span>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {dados?.resumoFinalizacao && (
          <section className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <h3 className="text-sm font-bold text-emerald-900 mb-2">
              Resumo de consumo
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm text-emerald-900">
              <span>
                Estoque inicial: {Number(dados.resumoFinalizacao.estoqueInicialTotal || 0)}
              </span>
              <span>
                Estoque final: {Number(dados.resumoFinalizacao.estoqueFinalTotal || 0)}
              </span>
              <span>
                Consumo total: {Number(dados.resumoFinalizacao.consumoTotalProdutos || 0)}
              </span>
            </div>
            <p className="text-xs text-emerald-900 mt-2">
              Finalizado em: {formatarDataHoraBR(dados.resumoFinalizacao.finalizadoEm)}
            </p>
          </section>
        )}

        {normalizarTexto(dados?.mensagemResumo) && (
          <section className="mb-6 rounded-xl border border-gray-200 bg-white p-4">
            <h3 className="text-sm font-bold text-gray-800 mb-2">
              Mensagem de finalização
            </h3>
            <pre className="whitespace-pre-wrap rounded-md border border-gray-200 bg-gray-50 p-3 text-xs">
              {normalizarTexto(dados?.mensagemResumo)}
            </pre>
            <p className="text-xs text-gray-500 mt-2">
              Esta mensagem está disponível apenas para leitura.
            </p>
          </section>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => navigate("/roteiros")}
          >
            Voltar
          </button>
          <button type="button" className="btn-primary" onClick={carregarAndamento}>
            Atualizar
          </button>
        </div>
      </main>
      <Footer />
    </div>
  );
}

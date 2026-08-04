import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import api from "../services/api";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer.jsx";
import { PageHeader, Badge, AlertBox } from "../components/UIComponents";
import { PageLoader } from "../components/Loading";
import { useAuth } from "../contexts/AuthContext.jsx";
import ModalEditarMovimentacao from "../components/ModalEditarMovimentacao";

export function MaquinaDetalhes() {
  const { id } = useParams();
  const { usuario } = useAuth();
  const podeVerFaturamentoMaquina = usuario?.role !== "GERENCIADOR";
  // const location = useLocation(); // Removido pois não é utilizado
  const [maquina, setMaquina] = useState(null);
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [estoqueAtual, setEstoqueAtual] = useState(null);
  const [alertaInconsistencia, setAlertaInconsistencia] = useState(null);
  const [alertaAbastecimento, setAlertaAbastecimento] = useState(null);
  const [produtoUltimaMov, setProdutoUltimaMov] = useState(null);
  const [maquinaConcluidaNoRoteiro, setMaquinaConcluidaNoRoteiro] =
    useState(false);
  
  // Estados para modal de edição
  const [modalEdicaoAberto, setModalEdicaoAberto] = useState(false);
  const [movimentacaoSelecionada, setMovimentacaoSelecionada] = useState(null);

  useEffect(() => {
    carregarDados();
    // eslint-disable-next-line
  }, [id]);

  // Atualiza o estoque atual e produto da última movimentação sempre que as movimentações mudam
  useEffect(() => {
    if (movimentacoes && movimentacoes.length > 0) {
      // Considera o campo totalPos, se existir, senão tenta outros nomes comuns
      const ultimaMov = movimentacoes[0];
      const totalPos =
        ultimaMov.totalPos ?? ultimaMov.total_pos ?? ultimaMov.totalpos ?? null;
      setEstoqueAtual(totalPos);

      // Extrai produto da última movimentação
      if (
        ultimaMov.detalhesProdutos &&
        Array.isArray(ultimaMov.detalhesProdutos) &&
        ultimaMov.detalhesProdutos.length > 0
      ) {
        const prod = ultimaMov.detalhesProdutos[0];
        setProdutoUltimaMov({ nome: prod.nome, emoji: prod.emoji });
      } else {
        setProdutoUltimaMov(null);
      }
    } else {
      setEstoqueAtual(null);
      setProdutoUltimaMov(null);
    }
  }, [movimentacoes]);

  const carregarDados = async () => {
    try {
      setLoading(true);
      const [
        maquinaRes,
        movimentacoesRes,
        resInconsistencia,
        resAbastecimento,
      ] = await Promise.all([
        api.get(`/maquinas/${id}`),
        api.get(`/movimentacoes?maquinaId=${id}`),
        api.get(
          `/relatorios/alertas-movimentacao-inconsistente?maquinaId=${id}`,
        ),
        api.get(`/relatorios/alertas-abastecimento-incompleto?maquinaId=${id}`),
      ]);
      setMaquina(maquinaRes.data);
      setMovimentacoes(movimentacoesRes.data);

      // Valida se o alerta realmente pertence a esta máquina
      const alertaInc = resInconsistencia.data?.alertas?.[0];
      if (alertaInc && String(alertaInc.maquinaId) === String(id)) {
        setAlertaInconsistencia(alertaInc);
      } else {
        setAlertaInconsistencia(null);
      }

      const alertaAbast = resAbastecimento.data?.alertas?.[0];
      if (alertaAbast && String(alertaAbast.maquinaId) === String(id)) {
        setAlertaAbastecimento(alertaAbast);
      } else {
        setAlertaAbastecimento(null);
      }
    } catch (error) {
      setError(
        "Erro ao carregar dados: " +
          (error.response?.data?.error || error.message),
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // O status de execução agora é semanal (até reset), sem filtro por data.
    const verificarStatus = async () => {
      try {
        const res = await api.get(
          `/status-diario?maquinaId=${id}&roteiroId=${maquina?.roteiroId}`,
        );
        setMaquinaConcluidaNoRoteiro(res.data?.concluida === true);
      } catch (e) {
        setMaquinaConcluidaNoRoteiro(false);
      }
    };
    if (maquina && maquina.roteiroId) {
      verificarStatus();
    }
  }, [id, maquina]);

  // Função para verificar se usuário pode editar uma movimentação
  const podeEditar = (movimentacao) => {
    if (!usuario) return false;
    return usuario.role === "ADMIN" || movimentacao.usuarioId === usuario.id;
  };

  // Função para abrir modal de edição
  const abrirModalEdicao = (movimentacao) => {
    setMovimentacaoSelecionada(movimentacao);
    setModalEdicaoAberto(true);
  };

  // Função para atualizar movimentação na lista após edição
  const atualizarMovimentacao = (movimentacaoAtualizada) => {
    setMovimentacoes((prev) =>
      prev.map((mov) =>
        mov.id === movimentacaoAtualizada.id ? movimentacaoAtualizada : mov
      )
    );
  };

  if (loading) return <PageLoader />;

  if (error) return <AlertBox type="error" message={error} />;

  if (!maquina)
    return <AlertBox type="error" message="Máquina não encontrada." />;

  return (
    <div className="min-h-screen bg-background-light">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex gap-4 mb-4">
          <button
            className="btn-secondary"
            onClick={() =>
              window.history.length > 1
                ? window.history.back()
                : window.location.assign("/alertas")
            }
          >
            Voltar para Alertas
          </button>
          <button
            className="btn-danger"
            onClick={async () => {
              try {
                await api.delete(
                  `/relatorios/alertas-movimentacao-inconsistente/${maquina.alertaId}`,
                  { data: { maquinaId: maquina.id } },
                );
                window.location.assign("/alertas");
              } catch (error) {
                alert("Erro ao marcar como corrigido.", error);
              }
            }}
            disabled={!maquina.alertaId}
            title="Marcar este alerta como corrigido"
          >
            Corrigido
          </button>
        </div>
        <PageHeader
          title={`Informações da Máquina: ${maquina.nome}`}
          subtitle={maquina.codigo}
          icon="🎰"
        />
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          {/* Detalhes dos alertas */}
          {alertaInconsistencia && (
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-300 rounded text-yellow-900">
              <strong>Alerta de Inconsistência:</strong>{" "}
              {alertaInconsistencia.mensagem ||
                `Inconsistência detectada: OUT (${alertaInconsistencia.contador_out})/IN (${alertaInconsistencia.contador_in}) não bate com fichas (${alertaInconsistencia.fichas}).`}
            </div>
          )}
          {alertaAbastecimento && (
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-300 rounded text-yellow-900">
              <strong>Alerta de Abastecimento Incompleto:</strong>{" "}
              {alertaAbastecimento.mensagem ||
                `Abastecimento incompleto: padrão ${
                  alertaAbastecimento.padrao
                }, tinha ${alertaAbastecimento.anterior}, abastecido ${
                  alertaAbastecimento.abastecido
                }. Motivo: ${alertaAbastecimento.observacao || "-"}`}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p>
                <strong>Tipo:</strong>{" "}
                {produtoUltimaMov ? (
                  <span>
                    {produtoUltimaMov.emoji ? (
                      <span>{produtoUltimaMov.emoji}</span>
                    ) : null}{" "}
                    {produtoUltimaMov.nome}
                  </span>
                ) : (
                  <>
                    {maquina.emoji ? <span>{maquina.emoji}</span> : null}{" "}
                    {maquina.tipo || "-"}
                  </>
                )}
              </p>
              <p>
                <strong>Capacidade:</strong>{" "}
                {maquina.capacidadePadrao || maquina.capacidade || "-"}
              </p>
              <p>
                <strong>Estoque Atual:</strong>{" "}
                {estoqueAtual !== null && estoqueAtual !== undefined
                  ? estoqueAtual
                  : "-"}
              </p>
              <p>
                <strong>Valor da Ficha:</strong> R${" "}
                {typeof maquina.valorFicha === "number"
                  ? maquina.valorFicha.toFixed(2)
                  : maquina.valorFicha || "-"}
              </p>
              <p>
                <strong>Usa fichas:</strong>{" "}
                {maquina.usaFichas || maquina.usa_fichas ? "Sim" : "Nao"}
              </p>
              <p>
                <strong>Comissão do Ponto:</strong>{" "}
                {maquina.comissaoLojaPercentual !== null &&
                maquina.comissaoLojaPercentual !== undefined &&
                maquina.comissaoLojaPercentual !== ""
                  ? `${parseFloat(maquina.comissaoLojaPercentual).toFixed(2)}%`
                  : "-"}
              </p>
            </div>
            <div>
              <p>
                <strong>Força Fraca:</strong> {maquina.forcaFraca ?? "-"}%
              </p>
              <p>
                <strong>Força Forte:</strong> {maquina.forcaForte ?? "-"}%
              </p>
              <p>
                <strong>Força Premium:</strong> {maquina.forcaPremium ?? "-"}%
              </p>
              <p>
                <strong>Jogadas Premium:</strong>{" "}
                {maquina.jogadasPremium ?? "-"}
              </p>
            </div>
          </div>
        </div>

        <h2 className="text-xl font-bold mb-4">Movimentações</h2>
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          {movimentacoes.length === 0 ? (
            <p className="text-gray-500">Nenhuma movimentação encontrada.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left py-2 px-2">Data</th>
                    <th className="text-left py-2 px-2">Entrada</th>
                    <th className="text-left py-2 px-2">Saída</th>
                    <th className="text-left py-2 px-2">Fichas</th>
                    <th className="text-left py-2 px-2">IN</th>
                    <th className="text-left py-2 px-2">OUT</th>
                    {podeVerFaturamentoMaquina && (
                      <th className="text-left py-2 px-2">Valor</th>
                    )}
                    <th className="text-left py-2 px-2">Quebra de Ordem</th>
                    <th className="text-left py-2 px-2">Observação</th>
                    <th className="text-left py-2 px-2">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {movimentacoes.map((mov) => (
                    <tr key={mov.id} className="border-b hover:bg-gray-50">
                      <td className="py-2 px-2">
                        {new Date(mov.dataColeta || mov.createdAt).toLocaleString(
                          "pt-BR",
                        )}
                      </td>
                      <td className="text-green-600 py-2 px-2">
                        {mov.abastecidas > 0 ? `+${mov.abastecidas}` : "-"}
                      </td>
                      <td className="text-red-600 py-2 px-2">
                        {mov.sairam > 0 ? `-${mov.sairam}` : "-"}
                      </td>
                      <td className="py-2 px-2">{mov.fichas || 0}</td>
                      <td className="py-2 px-2 font-medium text-blue-600">
                        {mov.contadorIn?.toLocaleString("pt-BR") || "-"}
                      </td>
                      <td className="py-2 px-2 font-medium text-purple-600">
                        {mov.contadorOut?.toLocaleString("pt-BR") || "-"}
                      </td>
                      {podeVerFaturamentoMaquina && (
                        <td className="py-2 px-2">
                          {mov.valorFaturado
                            ? `R$ ${mov.valorFaturado.toFixed(2)}`
                            : "-"}
                        </td>
                      )}
                      <td className="py-2 px-2">
                        {mov.justificativa_ordem ? (
                          <div className="max-w-xs">
                            <span className="px-2 py-1 bg-orange-50 border border-orange-200 rounded text-xs text-orange-900">
                              ⚠️ {mov.justificativa_ordem}
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="py-2 px-2 max-w-xs truncate">
                        {mov.observacoes || "-"}
                      </td>
                      <td className="py-2 px-2">
                        {podeEditar(mov) && (
                          <button
                            onClick={() => abrirModalEdicao(mov)}
                            className="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors flex items-center gap-1"
                            title="Editar movimentação"
                          >
                            <svg
                              className="w-3 h-3"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                              />
                            </svg>
                            Editar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Botão de movimentação */}
        <button
          className={`btn-primary ${maquinaConcluidaNoRoteiro ? "opacity-50 cursor-not-allowed" : ""}`}
          disabled={maquinaConcluidaNoRoteiro}
          title={
            maquinaConcluidaNoRoteiro
              ? "Máquina já concluída neste roteiro (até o reset semanal)"
              : "Registrar movimentação"
          }
        >
          {maquinaConcluidaNoRoteiro
            ? "Máquina concluída no roteiro"
            : "Registrar movimentação"}
        </button>
      </div>
      
      {/* Modal de edição de movimentação */}
      {modalEdicaoAberto && movimentacaoSelecionada && (
        <ModalEditarMovimentacao
          movimentacao={movimentacaoSelecionada}
          onClose={() => setModalEdicaoAberto(false)}
          onSucesso={atualizarMovimentacao}
        />
      )}
      
      <Footer />
    </div>
  );
}

export default MaquinaDetalhes;

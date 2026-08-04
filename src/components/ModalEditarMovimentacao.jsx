import { useState, useEffect } from "react";
import { Modal } from "./UIComponents";
import api from "../services/api";
import { useAuth } from "../contexts/AuthContext";

const formatDatetimeLocal = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

/**
 * Modal para editar movimentações de máquinas
 * Permite editar campos como fichas, contadores, valores monetários, etc.
 *
 * @param {Object} movimentacao - Dados da movimentação a ser editada
 * @param {Function} onClose - Callback para fechar o modal
 * @param {Function} onSucesso - Callback chamado após edição bem-sucedida
 */
export default function ModalEditarMovimentacao({
  movimentacao,
  onClose,
  onSucesso,
  bloquearDataColeta = false,
}) {
  const { usuario } = useAuth();
  const ocultarCamposFinanceirosEObservacoes =
    usuario?.role === "FUNCIONARIO" || usuario?.role === "ABASTECEDOR";
  const podeEditarTotalPre = usuario?.role === "ADMIN";
  const [loading, setLoading] = useState(false);
  const [produtos, setProdutos] = useState([]);
  const [produtoIdSelecionado, setProdutoIdSelecionado] = useState(null);
  const [formData, setFormData] = useState({
    totalPre: "",
    sairam: "",
    abastecidas: "",
    fichas: "",
    contadorIn: "",
    contadorOut: "",
    contadorMaquina: "",
    observacoes: "",
    tipoOcorrencia: "Normal",
    dataColeta: "",
  });

  // Carregar produtos disponíveis com estoque
  useEffect(() => {
    const carregarProdutos = async () => {
      try {
        if (!movimentacao) return;

        // Pegat lojaId da máquina associada à movimentação
        const lojaId = movimentacao?.maquina?.lojaId;
        const usuarioId = movimentacao.usuarioId;

        if (!lojaId && !usuarioId) {
          console.warn(
            "Não foi possível determinar usuarioId ou lojaId para filtrar produtos",
          );
          return;
        }

        // Chamar novo endpoint que filtra por estoque
        const params = {};
        if (usuarioId) params.usuarioId = usuarioId;
        if (lojaId) params.lojaId = lojaId;

        const res = await api.get("/produtos/com-estoque", { params });
        setProdutos(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error("Erro ao carregar produtos com estoque:", err);
      }
    };
    carregarProdutos();
  }, [movimentacao]);

  // Preencher formulário com dados da movimentação ao abrir
  useEffect(() => {
    if (movimentacao) {
      // Formatar data para input datetime-local
      const dataFormatada = movimentacao.dataColeta
        ? formatDatetimeLocal(movimentacao.dataColeta)
        : "";

      setFormData({
        totalPre: movimentacao.totalPre || "",
        sairam: movimentacao.sairam || "",
        abastecidas: movimentacao.abastecidas || "",
        fichas: movimentacao.fichas || "",
        contadorIn: movimentacao.contadorIn || "",
        contadorOut: movimentacao.contadorOut || "",
        contadorMaquina: movimentacao.contadorMaquina || "",
        observacoes: movimentacao.observacoes || "",
        tipoOcorrencia: movimentacao.tipoOcorrencia || "Normal",
        dataColeta: dataFormatada,
      });

      // Definir produto atual abastecido
      const produtoAtual =
        movimentacao.detalhesProdutos?.[0]?.produtoId || null;
      setProdutoIdSelecionado(produtoAtual);
    }
  }, [movimentacao]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Confirmação antes de salvar
    if (!window.confirm("Deseja realmente atualizar esta movimentação?")) {
      return;
    }

    try {
      setLoading(true);

      // Preparar dados para envio
      const dadosParaEnviar = {
        sairam: formData.sairam ? parseInt(formData.sairam) : null,
        abastecidas: formData.abastecidas
          ? parseInt(formData.abastecidas)
          : null,
        fichas: formData.fichas ? parseInt(formData.fichas) : null,
        contadorIn: formData.contadorIn ? parseInt(formData.contadorIn) : null,
        contadorOut: formData.contadorOut
          ? parseInt(formData.contadorOut)
          : null,
        contadorMaquina: formData.contadorMaquina
          ? parseInt(formData.contadorMaquina)
          : null,
        quantidade_notas_entrada: null,
        valor_entrada_maquininha_pix: null,
        observacoes: !ocultarCamposFinanceirosEObservacoes
          ? formData.observacoes || null
          : null,
        tipoOcorrencia: formData.tipoOcorrencia || "Normal",
        dataColeta: bloquearDataColeta
          ? movimentacao?.dataColeta || null
          : formData.dataColeta || null,
        produtoId: produtoIdSelecionado || null,
      };

      if (podeEditarTotalPre) {
        dadosParaEnviar.totalPre = formData.totalPre
          ? parseInt(formData.totalPre)
          : null;
      }

      // Enviar requisição PUT
      const response = await api.put(
        `/movimentacoes/${movimentacao.id}`,
        dadosParaEnviar,
      );

      // Sucesso
      alert("Movimentação atualizada com sucesso!");

      // Chamar callback de sucesso com dados atualizados
      if (onSucesso) {
        onSucesso(response.data);
      }

      // Fechar modal
      onClose();
    } catch (error) {
      console.error("Erro ao atualizar movimentação:", error);

      // Tratar erros específicos
      if (
        error.response?.status === 403 &&
        error.response?.data?.code === "MOVIMENTACAO_TOTAL_PRE_ADMIN_ONLY"
      ) {
        alert("Somente ADMIN pode editar a quantidade pré de produtos.");
      } else if (error.response?.status === 403) {
        alert("Você não tem permissão para editar esta movimentação.");
      } else if (error.response?.status === 404) {
        alert("Movimentação não encontrada.");
      } else {
        alert(
          error.response?.data?.error ||
            "Erro ao atualizar movimentação. Tente novamente.",
        );
      }
    } finally {
      setLoading(false);
    }
  };

  // Calcular valores automáticos (apenas para exibição)
  const possuiDadosQuantidade =
    formData.totalPre !== "" ||
    formData.abastecidas !== "" ||
    formData.sairam !== "";

  const totalPosCalculado = possuiDadosQuantidade
    ? (parseInt(formData.totalPre, 10) || 0) +
      (parseInt(formData.abastecidas, 10) || 0)
    : null;

  const valorFaturadoCalculado =
    (parseInt(formData.fichas) || 0) * (movimentacao?.maquina?.valorFicha || 0);

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={`Editar Movimentação - ${movimentacao?.maquina?.nome || movimentacao?.maquina?.codigo || "Máquina"}`}
      size="lg"
    >
      <form onSubmit={handleSubmit}>
        <div className="space-y-6">
          {!bloquearDataColeta && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                📅 Data da Coleta
              </label>
              <input
                type="datetime-local"
                name="dataColeta"
                value={formData.dataColeta}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          )}

          {/* QUANTIDADES */}
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              📦 Quantidades
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Total Pré
                </label>
                <input
                  type="number"
                  name="totalPre"
                  value={formData.totalPre}
                  onChange={handleChange}
                  disabled={!podeEditarTotalPre}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary disabled:bg-gray-100 disabled:text-gray-600"
                  min="0"
                />
                {!podeEditarTotalPre && (
                  <p className="text-xs text-gray-500 mt-1">
                    Somente ADMIN pode editar a quantidade pré.
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Saíram
                </label>
                <input
                  type="number"
                  name="sairam"
                  value={formData.sairam}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  min="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Abastecidas
                </label>
                <input
                  type="number"
                  name="abastecidas"
                  value={formData.abastecidas}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  min="0"
                />
              </div>
            </div>
            {totalPosCalculado !== null && (
              <div className="mt-2 p-2 bg-gray-50 rounded border border-gray-200">
                <span className="text-sm text-gray-600">
                  Total Pós (calculado): <strong>{totalPosCalculado}</strong>
                </span>
              </div>
            )}
          </div>

          {/* FICHAS E CONTADORES */}
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              🎰 Fichas e Contadores
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fichas
                </label>
                <input
                  type="number"
                  name="fichas"
                  value={formData.fichas}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  min="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contador Máquina
                </label>
                <input
                  type="number"
                  name="contadorMaquina"
                  value={formData.contadorMaquina}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  min="0"
                  placeholder="Opcional"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contador Entrada
                </label>
                <input
                  type="number"
                  name="contadorIn"
                  value={formData.contadorIn}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  min="0"
                  placeholder="Digital + Analógico"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contador Saída
                </label>
                <input
                  type="number"
                  name="contadorOut"
                  value={formData.contadorOut}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  min="0"
                  placeholder="Digital + Analógico"
                />
              </div>
            </div>
          </div>

          {/* SELEÇÃO DE PRODUTO */}
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              📦 Produto Abastecido
            </h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Qual produto está nesta máquina?
              </label>
              <select
                value={produtoIdSelecionado || ""}
                onChange={(e) =>
                  setProdutoIdSelecionado(e.target.value || null)
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Selecione um produto...</option>
                {produtos.map((produto) => (
                  <option key={produto.id} value={produto.id}>
                    {produto.nome}
                  </option>
                ))}
              </select>
              {produtoIdSelecionado && (
                <div className="mt-2 p-2 bg-blue-50 rounded border border-blue-200 text-sm text-blue-800">
                  ⚠️ Se trocar o produto, o sistema ajustará automaticamente os
                  estoques.
                </div>
              )}
            </div>
          </div>

          {!ocultarCamposFinanceirosEObservacoes && (
            <div className="mt-2 p-2 bg-gray-50 rounded border border-gray-200">
              <span className="text-sm text-gray-600">
                Valor Faturado (calculado):{" "}
                <strong>R$ {valorFaturadoCalculado.toFixed(2)}</strong>
              </span>
            </div>
          )}

          {!ocultarCamposFinanceirosEObservacoes && (
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                📝 Observações
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tipo de Ocorrência
                  </label>
                  <select
                    name="tipoOcorrencia"
                    value={formData.tipoOcorrencia}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="Normal">Normal</option>
                    <option value="Manutenção">Manutenção</option>
                    <option value="Troca de Máquina">Troca de Máquina</option>
                    <option value="Problema">Problema</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Observações
                  </label>
                  <textarea
                    name="observacoes"
                    value={formData.observacoes}
                    onChange={handleChange}
                    rows="3"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Observações adicionais..."
                  />
                </div>
              </div>
            </div>
          )}

          {/* Informações adicionais */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
            <p className="font-medium mb-1">ℹ️ Informações:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>
                Registrado por:{" "}
                {movimentacao?.usuario?.nome || "Usuário desconhecido"}
              </li>
              <li>
                Data original:{" "}
                {movimentacao?.dataColeta
                  ? new Date(movimentacao.dataColeta).toLocaleString("pt-BR")
                  : "-"}
              </li>
              <li>
                Os campos Total Pós e Valor Faturado são calculados
                automaticamente
              </li>
            </ul>
          </div>

          {/* Botões */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Salvando..." : "Salvar Alterações"}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

import { useEffect, useState } from "react";
import api from "../services/api";
import { useAuth } from "../contexts/AuthContext.jsx";
import { AlertBox, Modal, Badge } from "./UIComponents";
import { LoadingSpinner, EmptyState } from "./Loading";
import {
  montarMensagemDeLeiturasWhatsApp,
  abrirWhatsAppComMensagem,
} from "../lib/roteiroFinalizacaoWhatsApp";

const MODAL_ABASTECIMENTO_VAZIO = {
  aberto: false,
  maquina: null,
  loja: null,
  roteiroId: "",
  movimentacaoBaseId: "",
  produtoId: "",
  ultimoProdutoId: "",
  produtoPendenteId: "",
  confirmarTrocaProdutoAberto: false,
  quantidade: "",
  erro: "",
  loading: false,
};

// Painel simplificado pro role ABASTECEDOR: mostra direto no Dashboard os
// pontos do roteiro dele e, ao abrir um ponto, as maquinas com um botao de
// "Fazer abastecimento" (mesma funcionalidade do abastecimento extra da tela
// completa de roteiro) e um botao pra mandar as leituras no WhatsApp. Reusa
// os mesmos endpoints que RoteiroExecucao.jsx ja usa - nenhuma logica nova
// no backend.
export default function PainelAbastecedor() {
  const { usuario } = useAuth();

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [roteirosComLojas, setRoteirosComLojas] = useState([]);
  const [lojaExpandidaId, setLojaExpandidaId] = useState("");
  const [enviandoWhatsAppLojaId, setEnviandoWhatsAppLojaId] = useState("");
  const [produtosDisponiveis, setProdutosDisponiveis] = useState([]);
  const [modalAbastecimento, setModalAbastecimento] = useState(
    MODAL_ABASTECIMENTO_VAZIO,
  );

  useEffect(() => {
    let cancelado = false;

    async function carregarMeuRoteiro() {
      if (!usuario?.id) return;

      setCarregando(true);
      setErro("");

      try {
        const respRoteiros = await api.get("/roteiros");
        const todos = Array.isArray(respRoteiros.data) ? respRoteiros.data : [];
        const meusRoteiros = todos.filter(
          (r) => String(r?.funcionarioId || "") === String(usuario.id),
        );

        const comLojas = await Promise.all(
          meusRoteiros.map(async (roteiro) => {
            try {
              const respExecutar = await api.get(
                `/roteiros/${roteiro.id}/executar`,
              );
              const lojas = Array.isArray(respExecutar.data?.lojas)
                ? respExecutar.data.lojas
                : [];
              return { roteiro, lojas };
            } catch {
              return { roteiro, lojas: [] };
            }
          }),
        );

        if (!cancelado) setRoteirosComLojas(comLojas);
      } catch {
        if (!cancelado) {
          setErro("Não foi possível carregar seu roteiro.");
        }
      } finally {
        if (!cancelado) setCarregando(false);
      }
    }

    carregarMeuRoteiro();

    return () => {
      cancelado = true;
    };
  }, [usuario?.id]);

  const buscarUltimaMovimentacaoDaMaquina = async (maquina, roteiroId) => {
    const resposta = await api.get("/movimentacoes", {
      params: { maquinaId: maquina?.id, roteiroId, limite: 50 },
    });

    const payload = resposta?.data;
    const lista = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.data)
        ? payload.data
        : [];

    const listaOrdenada = [...lista].sort((a, b) => {
      const dataA = new Date(a?.dataColeta || a?.createdAt || 0).getTime();
      const dataB = new Date(b?.dataColeta || b?.createdAt || 0).getTime();
      return dataB - dataA;
    });

    const usuarioAtualId = String(usuario?.id || "").trim().toLowerCase();
    const doUsuarioAtual = listaOrdenada.filter((item) => {
      const donoId = String(item?.usuarioId || item?.usuario?.id || "")
        .trim()
        .toLowerCase();
      return donoId === usuarioAtualId;
    });

    return doUsuarioAtual[0] || listaOrdenada[0] || null;
  };

  const abrirModalAbastecimento = async (maquina, loja, roteiroId) => {
    setErro("");

    let ultimaMov = null;
    try {
      ultimaMov = await buscarUltimaMovimentacaoDaMaquina(maquina, roteiroId);
    } catch {
      // erro tratado abaixo, junto do caso "não encontrada"
    }

    if (!ultimaMov?.id) {
      setErro(
        `Não foi possível identificar a última movimentação de ${
          maquina?.nome || maquina?.codigo || "máquina"
        } para abastecimento.`,
      );
      return;
    }

    let produtosComEstoque = [];
    try {
      const [produtosRes, estoqueRes] = await Promise.all([
        api.get("/produtos", { params: { all: true } }),
        api
          .get("/estoque-usuarios/me")
          .catch(() => ({ data: { estoque: [] } })),
      ]);

      const listaProdutos = Array.isArray(produtosRes.data)
        ? produtosRes.data
        : [];
      const estoqueData = Array.isArray(estoqueRes?.data?.estoque)
        ? estoqueRes.data.estoque
        : Array.isArray(estoqueRes?.data)
          ? estoqueRes.data
          : [];

      const idsComEstoque = new Set(
        estoqueData
          .filter((item) => Number(item?.quantidade || 0) > 0)
          .map((item) => String(item.produtoId)),
      );

      produtosComEstoque = listaProdutos.filter((produto) =>
        idsComEstoque.has(String(produto?.id || "")),
      );
    } catch {
      // segue com a lista vazia - o select fica sem opções e o erro real
      // aparece se o usuário tentar salvar sem produto selecionado
    }
    setProdutosDisponiveis(produtosComEstoque);

    const detalhePrincipal = Array.isArray(ultimaMov?.detalhesProdutos)
      ? ultimaMov.detalhesProdutos[0]
      : null;
    const ultimoProdutoId = String(detalhePrincipal?.produtoId || "").trim();
    const produtoInicialId = produtosComEstoque.some(
      (produto) => String(produto?.id || "") === ultimoProdutoId,
    )
      ? ultimoProdutoId
      : "";

    setModalAbastecimento({
      aberto: true,
      maquina,
      loja,
      roteiroId,
      movimentacaoBaseId: ultimaMov.id,
      produtoId: produtoInicialId,
      ultimoProdutoId,
      produtoPendenteId: "",
      confirmarTrocaProdutoAberto: false,
      quantidade: "",
      erro: "",
      loading: false,
    });
  };

  const fecharModalAbastecimento = () => {
    if (modalAbastecimento.loading) return;
    setModalAbastecimento(MODAL_ABASTECIMENTO_VAZIO);
  };

  const alterarProdutoAbastecimento = (produtoIdSelecionado) => {
    const ultimoProdutoId = String(modalAbastecimento.ultimoProdutoId || "");
    const novoProdutoId = String(produtoIdSelecionado || "");

    if (ultimoProdutoId && novoProdutoId && novoProdutoId !== ultimoProdutoId) {
      setModalAbastecimento((prev) => ({
        ...prev,
        produtoPendenteId: novoProdutoId,
        confirmarTrocaProdutoAberto: true,
        erro: "",
      }));
      return;
    }

    setModalAbastecimento((prev) => ({
      ...prev,
      produtoId: novoProdutoId,
      erro: "",
    }));
  };

  const cancelarTrocaProdutoAbastecimento = () => {
    setModalAbastecimento((prev) => ({
      ...prev,
      produtoPendenteId: "",
      confirmarTrocaProdutoAberto: false,
    }));
  };

  const confirmarTrocaProdutoAbastecimento = async () => {
    const produtoIdConfirmado = String(
      modalAbastecimento.produtoPendenteId || "",
    ).trim();

    setModalAbastecimento((prev) => ({
      ...prev,
      produtoId: produtoIdConfirmado,
      produtoPendenteId: "",
      confirmarTrocaProdutoAberto: false,
      erro: "",
    }));

    await salvarAbastecimento(produtoIdConfirmado);
  };

  const salvarAbastecimento = async (produtoIdConfirmado = "") => {
    const quantidadeNumero = Number(modalAbastecimento.quantidade || 0);
    const produtoId = String(
      produtoIdConfirmado || modalAbastecimento.produtoId || "",
    ).trim();

    if (!Number.isFinite(quantidadeNumero) || quantidadeNumero <= 0) {
      setModalAbastecimento((prev) => ({
        ...prev,
        erro: "Informe uma quantidade válida para abastecimento.",
      }));
      return;
    }

    if (!produtoId) {
      setModalAbastecimento((prev) => ({
        ...prev,
        erro: "Selecione o produto abastecido.",
      }));
      return;
    }

    if (!modalAbastecimento.movimentacaoBaseId) {
      setModalAbastecimento((prev) => ({
        ...prev,
        erro: "Movimentação base não encontrada para abastecimento.",
      }));
      return;
    }

    try {
      setModalAbastecimento((prev) => ({
        ...prev,
        produtoId,
        erro: "",
        loading: true,
      }));

      const res = await api.patch(
        `/movimentacoes/${modalAbastecimento.movimentacaoBaseId}/abastecimento-extra`,
        { produtoId, quantidadeAbastecida: quantidadeNumero },
      );

      const movimentacaoAtualizada = res.data;
      const maquina = modalAbastecimento.maquina;
      const loja = modalAbastecimento.loja;
      const nomeMaquina = maquina?.nome || maquina?.codigo || "Máquina";
      const produtoSelecionado = produtosDisponiveis.find(
        (item) => String(item?.id || "") === produtoId,
      );
      const nomeProduto =
        produtoSelecionado?.nome ||
        movimentacaoAtualizada?.detalhesProdutos?.find(
          (item) => String(item?.produtoId || "") === produtoId,
        )?.produto?.nome ||
        produtoId;

      const resumo = {
        lojaNome: loja?.nome || "LOJA",
        dataMovimentacao: new Date().toISOString(),
        nomeUsuario: usuario?.nome || "-",
        codigoMaquina: maquina?.codigo || nomeMaquina,
        tipoMaquina: maquina?.tipo || nomeMaquina,
        inAnterior: Number(movimentacaoAtualizada?.contadorInAnterior || 0),
        inAtual: Number(movimentacaoAtualizada?.contadorIn || 0),
        outAnterior: Number(movimentacaoAtualizada?.contadorOutAnterior || 0),
        outAtual: Number(movimentacaoAtualizada?.contadorOut || 0),
        // O abastecedor so reabastece produto, nunca faz leitura de contador -
        // a mensagem de WhatsApp dele nao pode mostrar dinheiro (Saldo/Jogada/
        // Entradas/etc). Zerar aqui e o suficiente porque
        // construirMensagemDeItensWhatsApp deriva todo o financeiro (saldo,
        // jogada por pelucia e os totais da loja) a partir de diferencaIn/jogado.
        diferencaIn: 0,
        quantidadeSaiu: Number(movimentacaoAtualizada?.quantidadeSaiu || 0),
        jogado: 0,
        jogadasMediasPorPelucia: 0,
        diasDesdeUltimaMovimentacao:
          movimentacaoAtualizada?.diasDesdeUltimaMovimentacao,
        quantidadeAbastecimentoExtra: quantidadeNumero,
        nomeProdutoAbastecimentoExtra: nomeProduto,
      };

      if (movimentacaoAtualizada?.id) {
        try {
          await api.patch(
            `/movimentacoes/${movimentacaoAtualizada.id}/resumo-whatsapp`,
            { resumo },
          );
        } catch (resumoError) {
          console.warn(
            "Não foi possível salvar o resumo deste abastecimento para o WhatsApp:",
            resumoError,
          );
        }
      }

      setAviso(`Abastecimento de ${nomeMaquina} salvo com sucesso!`);
      fecharModalAbastecimento();
    } catch (err) {
      const mensagemErro =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        (err?.response?.status === 409
          ? "Estoque insuficiente para realizar o abastecimento."
          : "Erro ao salvar abastecimento.");

      setModalAbastecimento((prev) => ({
        ...prev,
        erro: mensagemErro,
        loading: false,
      }));
    }
  };

  const enviarWhatsAppDaLoja = async (roteiroId, loja) => {
    if (!loja?.id) return;

    setEnviandoWhatsAppLojaId(loja.id);
    setErro("");
    setAviso("");

    try {
      const resposta = await api.get("/movimentacoes/leituras-whatsapp", {
        params: { roteiroId, lojaId: loja.id },
      });
      const leituras = Array.isArray(resposta?.data) ? resposta.data : [];
      const mensagem = montarMensagemDeLeiturasWhatsApp(leituras, {
        ocultarFinanceiro: true,
      });

      if (!mensagem) {
        setErro(`Não há leituras salvas para ${loja.nome} ainda.`);
        return;
      }

      const abriu = abrirWhatsAppComMensagem(mensagem, null, {
        preferSameTab: true,
        noFallback: true,
      });

      setAviso(
        abriu
          ? "Mensagem enviada para o WhatsApp."
          : "Não foi possível abrir o WhatsApp.",
      );
    } catch {
      setErro("Não foi possível carregar as leituras deste ponto.");
    } finally {
      setEnviandoWhatsAppLojaId("");
    }
  };

  if (carregando) {
    return (
      <div className="mb-8">
        <LoadingSpinner message="Carregando seu roteiro..." />
      </div>
    );
  }

  const roteirosComPontos = roteirosComLojas.filter(
    (item) => item.lojas.length > 0,
  );

  return (
    <div className="mb-8 space-y-4">
      {erro && (
        <AlertBox type="error" message={erro} onClose={() => setErro("")} />
      )}
      {aviso && (
        <AlertBox
          type="success"
          message={aviso}
          onClose={() => setAviso("")}
        />
      )}

      {roteirosComPontos.length === 0 ? (
        <EmptyState
          icon="🗺️"
          title="Nenhum roteiro atribuído"
          description="Assim que um administrador atribuir um roteiro a você, os pontos aparecem aqui."
        />
      ) : (
        roteirosComPontos.map(({ roteiro, lojas }) => (
          <div
            key={roteiro.id}
            className="bg-white rounded-xl shadow-lg p-4 sm:p-6 border border-[#62A1D9]"
          >
            <h2 className="text-xl font-bold text-[#24094E] mb-4 flex items-center gap-2">
              🗺️ {roteiro.nome}
            </h2>

            <div className="space-y-3">
              {[...lojas]
                .sort((a, b) => (a.ordem || 0) - (b.ordem || 0))
                .map((loja) => {
                  const expandida = lojaExpandidaId === loja.id;
                  const lojaConcluida = loja.status === "finalizado";

                  return (
                    <div
                      key={loja.id}
                      className="border border-gray-200 rounded-lg overflow-hidden"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setLojaExpandidaId(expandida ? "" : loja.id)
                        }
                        className={`w-full flex items-center justify-between px-4 py-3 text-left font-bold ${
                          lojaConcluida
                            ? "bg-green-50 text-green-800"
                            : "bg-gray-50 text-[#24094E]"
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          🏪 {loja.nome}
                        </span>
                        <span className="flex items-center gap-2">
                          <Badge variant={lojaConcluida ? "success" : "warning"}>
                            {lojaConcluida ? "Finalizado" : "Pendente"}
                          </Badge>
                          <span className="text-sm">{expandida ? "▲" : "▼"}</span>
                        </span>
                      </button>

                      {expandida && (
                        <div className="p-4 space-y-3 bg-white">
                          {(loja.maquinas || []).length === 0 ? (
                            <p className="text-sm text-gray-500">
                              Nenhuma máquina cadastrada nesta loja.
                            </p>
                          ) : (
                            loja.maquinas.map((maquina) => (
                              <div
                                key={maquina.id}
                                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 rounded-lg border border-gray-200"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold">
                                    {maquina.nome || maquina.codigo}
                                  </span>
                                  <Badge
                                    variant={
                                      maquina.status === "finalizado"
                                        ? "success"
                                        : "warning"
                                    }
                                    size="sm"
                                  >
                                    {maquina.status === "finalizado"
                                      ? "Feito hoje"
                                      : "Pendente"}
                                  </Badge>
                                </div>
                                <button
                                  type="button"
                                  className="btn-primary text-sm"
                                  onClick={() =>
                                    abrirModalAbastecimento(
                                      maquina,
                                      loja,
                                      roteiro.id,
                                    )
                                  }
                                >
                                  📦 Fazer abastecimento
                                </button>
                              </div>
                            ))
                          )}

                          <button
                            type="button"
                            className="w-full mt-2 bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 rounded-lg flex items-center justify-center gap-2 disabled:opacity-60"
                            onClick={() => enviarWhatsAppDaLoja(roteiro.id, loja)}
                            disabled={enviandoWhatsAppLojaId === loja.id}
                          >
                            📲{" "}
                            {enviandoWhatsAppLojaId === loja.id
                              ? "Enviando..."
                              : "Enviar leituras no WhatsApp"}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        ))
      )}

      <Modal
        isOpen={modalAbastecimento.aberto}
        onClose={fecharModalAbastecimento}
        title="Fazer abastecimento"
        size="md"
      >
        <div className="space-y-4">
          {modalAbastecimento?.maquina && (
            <div className="p-3 bg-blue-50 border-l-4 border-blue-500 rounded">
              <p className="text-sm text-blue-900 font-semibold">
                Máquina:{" "}
                {modalAbastecimento.maquina.nome ||
                  modalAbastecimento.maquina.codigo}
              </p>
              {modalAbastecimento?.loja?.nome && (
                <p className="text-xs text-blue-800 mt-1">
                  Ponto: {modalAbastecimento.loja.nome}
                </p>
              )}
            </div>
          )}

          {modalAbastecimento.erro && (
            <AlertBox
              type="error"
              message={modalAbastecimento.erro}
              onClose={() =>
                setModalAbastecimento((prev) => ({ ...prev, erro: "" }))
              }
            />
          )}

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              Produto abastecido *
            </label>
            <select
              className="w-full p-3 border rounded-lg bg-white"
              value={modalAbastecimento.produtoId}
              onChange={(e) => alterarProdutoAbastecimento(e.target.value)}
              disabled={modalAbastecimento.loading}
            >
              <option value="">Selecione um produto</option>
              {produtosDisponiveis.map((produto) => (
                <option key={produto.id} value={produto.id}>
                  {produto.nome}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              Quantidade abastecida *
            </label>
            <input
              type="number"
              min="1"
              className="w-full p-3 border rounded-lg"
              placeholder="Ex: 10"
              value={modalAbastecimento.quantidade}
              onChange={(e) =>
                setModalAbastecimento((prev) => ({
                  ...prev,
                  quantidade: e.target.value,
                  erro: "",
                }))
              }
              disabled={modalAbastecimento.loading}
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              className="btn-secondary"
              onClick={fecharModalAbastecimento}
              disabled={modalAbastecimento.loading}
            >
              Cancelar
            </button>
            <button
              className="btn-primary"
              onClick={() => salvarAbastecimento()}
              disabled={modalAbastecimento.loading}
            >
              {modalAbastecimento.loading ? "Salvando..." : "Salvar abastecimento"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={modalAbastecimento.confirmarTrocaProdutoAberto}
        onClose={cancelarTrocaProdutoAbastecimento}
        title="Confirmar troca de produto"
        size="sm"
      >
        <div className="space-y-5">
          <div className="p-3 bg-yellow-50 border-l-4 border-yellow-400 rounded">
            <p className="text-sm font-semibold text-yellow-900">
              Tem certeza que deseja mudar o produto desta máquina?
            </p>
            <p className="text-xs text-yellow-800 mt-1">
              Se cancelar, o produto anterior abastecido nesta máquina será
              mantido.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row justify-end gap-2">
            <button
              type="button"
              className="btn-secondary w-full sm:w-auto"
              onClick={cancelarTrocaProdutoAbastecimento}
            >
              Não, manter anterior
            </button>
            <button
              type="button"
              className="btn-primary w-full sm:w-auto"
              onClick={confirmarTrocaProdutoAbastecimento}
              disabled={modalAbastecimento.loading}
            >
              {modalAbastecimento.loading ? "Salvando..." : "Sim, trocar produto"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Swal from "sweetalert2";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer.jsx";
import api from "../services/api";
import { PageLoader } from "../components/Loading";

const toNumberOrZero = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};

// Tela dedicada de gerenciamento do estoque de UMA loja (diferente da edição
// completa da loja em LojaForm, que mistura estoque com endereço/gastos
// fixos/etc.). Espelha o mesmo padrão de tabela usado em EstoqueUsuarios.jsx:
// só lista produtos que já têm registro na loja, com dropdown pra adicionar
// novos.
export default function EstoqueLoja() {
  const { id: lojaId } = useParams();
  const navigate = useNavigate();

  const [loja, setLoja] = useState(null);
  const [produtos, setProdutos] = useState([]);
  const [estoqueRows, setEstoqueRows] = useState([]);
  const [produtoParaAdicionar, setProdutoParaAdicionar] = useState("");
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const montarRowsDoEstoque = useCallback(
    (estoqueAtual = []) =>
      (estoqueAtual || []).map((item) => ({
        id: item.id,
        produtoId: item.produtoId,
        produtoNome: item.produto?.nome || "",
        produtoCodigo: item.produto?.codigo || "",
        emoji: item.produto?.emoji,
        quantidade: toNumberOrZero(item.quantidade),
        estoqueMinimo: toNumberOrZero(
          item.estoqueMinimo ?? item.produto?.estoqueMinimo,
        ),
      })),
    [],
  );

  const carregarDados = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [lojaRes, produtosRes, estoqueRes] = await Promise.all([
        api.get(`/lojas/${lojaId}`),
        api.get("/produtos", { params: { all: true } }),
        api.get(`/estoque-lojas/${lojaId}`),
      ]);

      setLoja(lojaRes.data || null);
      setProdutos(Array.isArray(produtosRes.data) ? produtosRes.data : []);
      setEstoqueRows(
        montarRowsDoEstoque(
          Array.isArray(estoqueRes.data) ? estoqueRes.data : [],
        ),
      );
    } catch (err) {
      console.error("Erro ao carregar estoque da loja:", err);
      setError(
        err?.response?.data?.error || "Erro ao carregar estoque da loja",
      );
    } finally {
      setLoading(false);
    }
  }, [lojaId, montarRowsDoEstoque]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  const bloquearScrollNumero = (event) => {
    event.target.blur();
  };

  const atualizarRow = (produtoId, campo, valor) => {
    const valorNormalizado = toNumberOrZero(valor);
    setEstoqueRows((prev) =>
      prev.map((row) =>
        row.produtoId === produtoId
          ? { ...row, [campo]: valorNormalizado }
          : row,
      ),
    );
  };

  const produtosDisponiveisParaAdicionar = useMemo(() => {
    const idsJaNaLista = new Set(estoqueRows.map((row) => row.produtoId));
    return produtos.filter((produto) => !idsJaNaLista.has(produto.id));
  }, [produtos, estoqueRows]);

  const adicionarProdutoNaLista = () => {
    if (!produtoParaAdicionar) return;
    const produto = produtos.find(
      (item) => String(item.id) === produtoParaAdicionar,
    );
    if (!produto) return;

    setEstoqueRows((prev) => [
      ...prev,
      {
        id: null,
        produtoId: produto.id,
        produtoNome: produto.nome,
        produtoCodigo: produto.codigo,
        emoji: produto.emoji,
        quantidade: 0,
        estoqueMinimo: toNumberOrZero(produto.estoqueMinimo),
      },
    ]);
    setProdutoParaAdicionar("");
  };

  const excluirProdutoDoEstoque = async (row) => {
    const confirmacao = await Swal.fire({
      icon: "warning",
      title: "Excluir produto",
      text: `Excluir ${row.produtoNome} do estoque de ${loja?.nome || "loja"}?`,
      showCancelButton: true,
      confirmButtonText: "Sim, excluir",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#dc2626",
    });
    if (!confirmacao.isConfirmed) return;

    if (row.id) {
      try {
        await api.delete(`/estoque-lojas/${lojaId}/${row.produtoId}`);
      } catch (err) {
        console.error("Erro ao excluir produto do estoque da loja:", err);
        setError(
          err?.response?.data?.error || "Erro ao excluir produto do estoque",
        );
        return;
      }
    }

    setEstoqueRows((prev) =>
      prev.filter((item) => item.produtoId !== row.produtoId),
    );
  };

  const salvarEstoque = async () => {
    try {
      setSalvando(true);
      setError("");
      setSuccess("");

      const payload = estoqueRows.map((item) => ({
        produtoId: item.produtoId,
        quantidade: toNumberOrZero(item.quantidade),
        estoqueMinimo: toNumberOrZero(item.estoqueMinimo),
      }));

      if (payload.length === 0) {
        setSalvando(false);
        return;
      }

      await api.post(`/estoque-lojas/${lojaId}/varios`, {
        estoques: payload,
      });

      setSuccess("Estoque salvo com sucesso.");
      await carregarDados();
    } catch (err) {
      console.error("Erro ao salvar estoque da loja:", err);
      setError(err?.response?.data?.error || "Erro ao salvar estoque");
    } finally {
      setSalvando(false);
    }
  };

  const resumo = useMemo(() => {
    const totalProdutos = estoqueRows.length;
    const totalUnidades = estoqueRows.reduce(
      (acc, item) => acc + toNumberOrZero(item.quantidade),
      0,
    );
    const abaixoMinimo = estoqueRows.filter(
      (item) =>
        toNumberOrZero(item.quantidade) <= toNumberOrZero(item.estoqueMinimo),
    ).length;

    return { totalProdutos, totalUnidades, abaixoMinimo };
  }, [estoqueRows]);

  if (loading) return <PageLoader />;

  return (
    <div className="min-h-screen bg-background-light">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="mb-4 flex items-center gap-1 text-sm font-semibold text-gray-600 hover:text-gray-900"
        >
          ← Voltar para o dashboard
        </button>

        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              🏪 Estoque Loja
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              {loja
                ? `${loja.nome}${loja.cidade ? ` - ${loja.cidade}` : ""}`
                : "Carregando..."}
            </p>
          </div>
        </div>

        <div className="bg-purple-50 border-l-4 border-purple-500 rounded-lg p-4 mb-6">
          <p className="text-sm text-gray-700">
            💡 Produtos configurados aqui ficam disponíveis para os
            funcionários usarem como <strong>"Estoque do ponto"</strong> ao
            fazer máquinas deste ponto, como alternativa ao estoque pessoal
            deles. A quantidade adicionada é descontada automaticamente do
            Depósito Principal.
          </p>
        </div>

        {error ? (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}
        {success ? (
          <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {success}
          </div>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="card">
            <p className="text-xs uppercase text-gray-500 font-semibold">
              Produtos
            </p>
            <p className="text-2xl font-bold text-gray-900">
              {resumo.totalProdutos}
            </p>
          </div>
          <div className="card">
            <p className="text-xs uppercase text-gray-500 font-semibold">
              Unidades
            </p>
            <p className="text-2xl font-bold text-gray-900">
              {resumo.totalUnidades}
            </p>
          </div>
          <div className="card">
            <p className="text-xs uppercase text-gray-500 font-semibold">
              Abaixo do mínimo
            </p>
            <p className="text-2xl font-bold text-red-600">
              {resumo.abaixoMinimo}
            </p>
          </div>
        </div>

        <div className="card overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                  Produto
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                  Quantidade
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                  Mínimo
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {estoqueRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-6 text-center text-sm text-gray-500"
                  >
                    Nenhum produto neste estoque ainda. Use "Adicionar
                    produto" abaixo para começar.
                  </td>
                </tr>
              ) : (
                estoqueRows.map((item) => {
                  const abaixo =
                    toNumberOrZero(item.quantidade) <=
                    toNumberOrZero(item.estoqueMinimo);
                  return (
                    <tr key={item.produtoId} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">
                          {item.emoji || "📦"} {item.produtoNome}
                        </div>
                        <div className="text-xs text-gray-500">
                          {item.produtoCodigo || "sem código"}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          min="0"
                          className="input-field no-number-controls max-w-[140px]"
                          value={item.quantidade}
                          onChange={(e) =>
                            atualizarRow(
                              item.produtoId,
                              "quantidade",
                              e.target.value,
                            )
                          }
                          onWheel={bloquearScrollNumero}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          min="0"
                          className="input-field no-number-controls max-w-[140px]"
                          value={item.estoqueMinimo}
                          onChange={(e) =>
                            atualizarRow(
                              item.produtoId,
                              "estoqueMinimo",
                              e.target.value,
                            )
                          }
                          onWheel={bloquearScrollNumero}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                            abaixo
                              ? "bg-red-100 text-red-700"
                              : "bg-green-100 text-green-700"
                          }`}
                        >
                          {abaixo ? "Abaixo do mínimo" : "OK"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => excluirProdutoDoEstoque(item)}
                          className="text-xs font-semibold text-red-600 hover:text-red-700"
                        >
                          🗑️ Excluir
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <select
              className="select-field"
              value={produtoParaAdicionar}
              onChange={(e) => setProdutoParaAdicionar(e.target.value)}
              disabled={produtosDisponiveisParaAdicionar.length === 0}
            >
              <option value="">
                {produtosDisponiveisParaAdicionar.length === 0
                  ? "Todos os produtos já estão na lista"
                  : "Selecione um produto..."}
              </option>
              {produtosDisponiveisParaAdicionar.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nome} {item.codigo ? `(${item.codigo})` : ""}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 font-semibold hover:bg-gray-50 disabled:opacity-60"
              onClick={adicionarProdutoNaLista}
              disabled={!produtoParaAdicionar}
            >
              + Adicionar produto
            </button>
          </div>

          <button
            type="button"
            className="btn-primary disabled:opacity-60"
            onClick={salvarEstoque}
            disabled={salvando}
          >
            {salvando ? "Salvando..." : "Salvar estoque"}
          </button>
        </div>
      </main>

      <Footer />
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer.jsx";
import api from "../services/api";
import { useAuth } from "../contexts/AuthContext.jsx";

// IDs de usuários/lojas que o CONTROLADOR_ESTOQUE pode ver (exemplo, adapte para sua regra)
const IDS_PERMITIDOS_CONTROLADOR = [
  // Exemplo: 'uuid-usuario-1', 'uuid-usuario-2'
];

const ROLES_GESTAO_ESTOQUE = ["ADMIN", "CONTROLADOR_ESTOQUE"];

const toNumberOrZero = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};

const normalizarTexto = (texto = "") =>
  String(texto)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const formatarDataHora = (valor) => {
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return "-";
  return data.toLocaleString("pt-BR");
};

export default function EstoqueUsuarios() {
  const { usuario } = useAuth();
  const isAdmin = usuario?.role === "ADMIN";
  const isControlador = usuario?.role === "CONTROLADOR_ESTOQUE";
  const isGestorEstoque = isAdmin || isControlador;

  const [usuarios, setUsuarios] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [buscaUsuario, setBuscaUsuario] = useState("");
  const [usuarioSelecionadoId, setUsuarioSelecionadoId] = useState("");
  const [usuarioSelecionado, setUsuarioSelecionado] = useState(null);
  const [estoqueRows, setEstoqueRows] = useState([]);
  const [produtoParaAdicionar, setProdutoParaAdicionar] = useState("");
  const [ultimasMovimentacoes, setUltimasMovimentacoes] = useState([]);
  const [alertas, setAlertas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [filtroHistoricoUsuarioId, setFiltroHistoricoUsuarioId] = useState("");
  const [filtroHistoricoDataInicio, setFiltroHistoricoDataInicio] =
    useState("");
  const [filtroHistoricoDataFim, setFiltroHistoricoDataFim] = useState("");
  const [historicoMovimentacoes, setHistoricoMovimentacoes] = useState([]);
  const [loadingHistorico, setLoadingHistorico] = useState(false);
  const [erroHistorico, setErroHistorico] = useState("");

  // Monta as linhas só a partir dos registros que já existem de verdade pra
  // esse usuário — não do catálogo inteiro de produtos. É isso que corrige
  // o bug de "produto some quando fica 0": a linha existe (ou não) porque
  // tem (ou não) um registro no banco, não por causa do valor digitado.
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

  const carregarUltimasMovimentacoes = useCallback(async (alvoUsuarioId) => {
    if (!alvoUsuarioId) {
      setUltimasMovimentacoes([]);
      return;
    }
    try {
      const res = await api.get("/estoque-usuarios/movimentacoes", {
        params: { usuarioId: alvoUsuarioId, limit: 5 },
      });
      setUltimasMovimentacoes(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Erro ao carregar ultimas movimentacoes:", err);
      setUltimasMovimentacoes([]);
    }
  }, []);

  const carregarEstoque = useCallback(
    async (alvoUsuarioId, produtosBase, usuariosBase = []) => {
      if (!alvoUsuarioId) {
        setUsuarioSelecionado(null);
        setEstoqueRows([]);
        setAlertas([]);
        setUltimasMovimentacoes([]);
        return;
      }

      try {
        const endpointEstoque = isGestorEstoque
          ? `/estoque-usuarios/${alvoUsuarioId}`
          : "/estoque-usuarios/me";
        const endpointAlertas = isGestorEstoque
          ? `/estoque-usuarios/${alvoUsuarioId}/alertas`
          : "/estoque-usuarios/me/alertas";

        const [estoqueRes, alertasRes] = await Promise.all([
          api.get(endpointEstoque),
          api.get(endpointAlertas),
        ]);

        const estoqueData = Array.isArray(estoqueRes.data?.estoque)
          ? estoqueRes.data.estoque
          : [];
        const alertasData = Array.isArray(alertasRes.data)
          ? alertasRes.data
          : alertasRes.data?.alertas || [];

        setUsuarioSelecionado(
          estoqueRes.data?.usuario ||
            (usuariosBase || []).find((u) => u.id === alvoUsuarioId) || {
              id: usuario?.id,
              nome: usuario?.nome,
              email: usuario?.email,
              role: usuario?.role,
            },
        );
        setEstoqueRows(montarRowsDoEstoque(estoqueData));
        setAlertas(alertasData);

        if (isGestorEstoque) {
          await carregarUltimasMovimentacoes(alvoUsuarioId);
        }
      } catch (err) {
        console.error("Erro ao carregar estoque do usuario:", err);
        setError(
          err?.response?.data?.error || "Erro ao carregar estoque do usuario",
        );
      }
    },
    [
      carregarUltimasMovimentacoes,
      isGestorEstoque,
      montarRowsDoEstoque,
      usuario?.email,
      usuario?.id,
      usuario?.nome,
      usuario?.role,
    ],
  );

  useEffect(() => {
    if (!usuario?.id) return;

    let ativo = true;

    const inicializar = async () => {
      try {
        setLoading(true);
        setError("");
        setSuccess("");

        const requisicoes = [api.get("/produtos", { params: { all: true } })];

        if (isGestorEstoque) {
          requisicoes.push(api.get("/estoque-usuarios/usuarios"));
        }

        const resultados = await Promise.all(requisicoes);

        if (!ativo) return;

        const produtosData = Array.isArray(resultados[0]?.data)
          ? resultados[0].data
          : [];

        let usuariosData =
          isGestorEstoque && Array.isArray(resultados[1]?.data)
            ? resultados[1].data
            : [];

        // Se for CONTROLADOR_ESTOQUE (mas não ADMIN), filtra os usuários/lojas permitidos
        if (
          isControlador &&
          !isAdmin &&
          IDS_PERMITIDOS_CONTROLADOR.length > 0
        ) {
          usuariosData = usuariosData.filter((u) =>
            IDS_PERMITIDOS_CONTROLADOR.includes(u.id),
          );
        }

        setProdutos(produtosData);
        setUsuarios(usuariosData);

        const usuarioInicialId = isGestorEstoque
          ? usuariosData.find((item) => item.id === usuario.id)?.id ||
            usuariosData[0]?.id ||
            usuario.id
          : usuario.id;

        setUsuarioSelecionadoId(usuarioInicialId);
        await carregarEstoque(usuarioInicialId, produtosData, usuariosData);
      } catch (err) {
        if (!ativo) return;
        console.error("Erro ao inicializar estoque por usuario:", err);
        setError(
          err?.response?.data?.error || "Erro ao carregar dados da pagina",
        );
      } finally {
        if (ativo) {
          setLoading(false);
        }
      }
    };

    inicializar();

    return () => {
      ativo = false;
    };
  }, [carregarEstoque, isGestorEstoque, usuario?.id]);

  const onTrocarUsuario = useCallback(
    async (novoUsuarioId) => {
      if (!novoUsuarioId || novoUsuarioId === usuarioSelecionadoId) return;

      setUsuarioSelecionadoId(novoUsuarioId);
      setSuccess("");
      setError("");
      await carregarEstoque(novoUsuarioId, produtos, usuarios);
    },
    [carregarEstoque, produtos, usuarioSelecionadoId, usuarios],
  );

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
      text: `Excluir ${row.produtoNome} do estoque de ${usuarioSelecionado?.nome}?`,
      showCancelButton: true,
      confirmButtonText: "Sim, excluir",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#dc2626",
    });
    if (!confirmacao.isConfirmed) {
      return;
    }

    if (row.id) {
      try {
        await api.delete(
          `/estoque-usuarios/${usuarioSelecionadoId}/${row.produtoId}`,
        );
      } catch (err) {
        console.error("Erro ao excluir produto do estoque do usuario:", err);
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
    if (!isGestorEstoque || !usuarioSelecionadoId) return;

    try {
      setSalvando(true);
      setError("");
      setSuccess("");

      const payload = estoqueRows.map((item) => ({
        produtoId: item.produtoId,
        quantidade: toNumberOrZero(item.quantidade),
        estoqueMinimo: toNumberOrZero(item.estoqueMinimo),
      }));

      await api.put(`/estoque-usuarios/${usuarioSelecionadoId}/varios`, {
        estoques: payload,
      });

      setSuccess("Estoque salvo com sucesso.");
      await carregarEstoque(usuarioSelecionadoId, produtos, usuarios);
    } catch (err) {
      console.error("Erro ao salvar estoque do usuario:", err);
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

    return {
      totalProdutos,
      totalUnidades,
      abaixoMinimo,
    };
  }, [estoqueRows]);

  const usuariosFiltrados = useMemo(() => {
    const termo = normalizarTexto(buscaUsuario.trim());
    if (!termo) return usuarios;

    return usuarios.filter((item) => {
      const alvo = normalizarTexto(
        `${item.nome || ""} ${item.email || ""} ${item.role || ""}`,
      );
      return alvo.includes(termo);
    });
  }, [buscaUsuario, usuarios]);

  const filtrosHistoricoCompletos = useMemo(
    () =>
      Boolean(
        filtroHistoricoUsuarioId &&
        filtroHistoricoDataInicio &&
        filtroHistoricoDataFim,
      ),
    [
      filtroHistoricoDataFim,
      filtroHistoricoDataInicio,
      filtroHistoricoUsuarioId,
    ],
  );

  const periodoHistoricoInvalido =
    filtrosHistoricoCompletos &&
    filtroHistoricoDataInicio > filtroHistoricoDataFim;

  useEffect(() => {
    if (!isGestorEstoque || loading) return;

    const termoAtivo = buscaUsuario.trim().length > 0;

    if (!termoAtivo) {
      if (!usuarioSelecionadoId && usuariosFiltrados.length > 0) {
        onTrocarUsuario(usuariosFiltrados[0].id);
      }
      return;
    }

    if (usuariosFiltrados.length === 0) {
      if (usuarioSelecionadoId) {
        setUsuarioSelecionadoId("");
        setUsuarioSelecionado(null);
        setEstoqueRows([]);
        setAlertas([]);
      }
      return;
    }

    const primeiroFiltradoId = usuariosFiltrados[0]?.id;
    if (primeiroFiltradoId && primeiroFiltradoId !== usuarioSelecionadoId) {
      onTrocarUsuario(primeiroFiltradoId);
    }
  }, [
    buscaUsuario,
    isGestorEstoque,
    loading,
    onTrocarUsuario,
    usuarioSelecionadoId,
    usuariosFiltrados,
  ]);

  useEffect(() => {
    if (!isGestorEstoque) return;

    if (!filtrosHistoricoCompletos) {
      setHistoricoMovimentacoes([]);
      setErroHistorico("");
      setLoadingHistorico(false);
      return;
    }

    if (periodoHistoricoInvalido) {
      setHistoricoMovimentacoes([]);
      setErroHistorico("Data inicio nao pode ser maior que data fim.");
      setLoadingHistorico(false);
      return;
    }

    let ativo = true;

    const carregarHistorico = async () => {
      try {
        setLoadingHistorico(true);
        setErroHistorico("");

        const response = await api.get("/estoque-usuarios/movimentacoes", {
          params: {
            usuarioId: filtroHistoricoUsuarioId,
            dataInicio: filtroHistoricoDataInicio,
            dataFim: filtroHistoricoDataFim,
          },
        });

        if (!ativo) return;

        const movimentacoes = Array.isArray(response.data) ? response.data : [];
        setHistoricoMovimentacoes(movimentacoes);
      } catch (err) {
        if (!ativo) return;
        console.error("Erro ao carregar historico de estoque do usuario:", err);
        setHistoricoMovimentacoes([]);
        setErroHistorico(
          err?.response?.data?.error ||
            "Erro ao carregar historico de movimentacoes",
        );
      } finally {
        if (ativo) {
          setLoadingHistorico(false);
        }
      }
    };

    carregarHistorico();

    return () => {
      ativo = false;
    };
  }, [
    filtroHistoricoDataFim,
    filtroHistoricoDataInicio,
    filtroHistoricoUsuarioId,
    filtrosHistoricoCompletos,
    isGestorEstoque,
    periodoHistoricoInvalido,
  ]);

  return (
    <div className="min-h-screen bg-background-light">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Estoque por Usuario
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Acompanhe e ajuste o estoque individual de produtos por
              colaborador.
            </p>
          </div>

          {isGestorEstoque ? (
            <div className="w-full md:w-96">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Pesquisar usuario
              </label>
              <input
                type="text"
                className="input-field mb-3"
                placeholder="Digite nome, email ou perfil..."
                value={buscaUsuario}
                onChange={(e) => setBuscaUsuario(e.target.value)}
                disabled={loading}
              />

              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Usuario selecionado
              </label>
              <select
                className="select-field"
                value={usuarioSelecionadoId}
                onChange={(e) => onTrocarUsuario(e.target.value)}
                disabled={loading}
              >
                {usuariosFiltrados.length === 0 ? (
                  <option value="" disabled>
                    Nenhum usuario encontrado
                  </option>
                ) : (
                  usuariosFiltrados.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.nome} ({item.role})
                    </option>
                  ))
                )}
              </select>
              <p className="mt-2 text-xs text-gray-500">
                {usuariosFiltrados.length} usuario(s) encontrado(s)
              </p>
            </div>
          ) : null}
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
              Abaixo do minimo
            </p>
            <p className="text-2xl font-bold text-red-600">
              {resumo.abaixoMinimo}
            </p>
          </div>
        </div>

        {usuarioSelecionado ? (
          <div className="card mb-6">
            <p className="text-sm text-gray-700">
              <span className="font-semibold">Usuario:</span>{" "}
              {usuarioSelecionado.nome} ({usuarioSelecionado.role})
            </p>
            <p className="text-sm text-gray-600">{usuarioSelecionado.email}</p>
            {!isGestorEstoque ? (
              <p className="text-xs text-gray-500 mt-2">
                Visualizacao somente leitura. Ajustes de estoque sao permitidos
                apenas para ADMIN e CONTROLADOR_ESTOQUE.
              </p>
            ) : null}

            {isGestorEstoque ? (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-600 uppercase mb-2">
                  Ultimas movimentacoes
                </p>
                {ultimasMovimentacoes.length === 0 ? (
                  <p className="text-xs text-gray-500">
                    Nenhuma movimentacao registrada ainda.
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {ultimasMovimentacoes.map((item) => (
                      <li key={item.id} className="text-xs text-gray-600">
                        {formatarDataHora(item.dataMovimentacao)} ·{" "}
                        {item.produto?.emoji || "📦"}{" "}
                        {item.produto?.nome || item.produtoId} ·{" "}
                        <span
                          className={
                            item.tipoMovimentacao === "entrada"
                              ? "text-green-700 font-semibold"
                              : "text-red-700 font-semibold"
                          }
                        >
                          {item.tipoMovimentacao === "entrada"
                            ? "Entrada"
                            : "Saida"}{" "}
                          {toNumberOrZero(item.quantidade)}
                        </span>{" "}
                        ({toNumberOrZero(item.quantidadeAnterior)} {"->"}{" "}
                        {toNumberOrZero(item.quantidadeAtual)})
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="card overflow-x-auto">
          {loading ? (
            <div className="py-16 text-center text-gray-500">
              Carregando estoque...
            </div>
          ) : (
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
                    Minimo
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                    Status
                  </th>
                  {isGestorEstoque ? (
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                      Acoes
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {estoqueRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={isGestorEstoque ? 5 : 4}
                      className="px-4 py-6 text-center text-sm text-gray-500"
                    >
                      Nenhum produto neste estoque ainda.
                      {isGestorEstoque
                        ? " Use \"Adicionar produto\" abaixo para comecar."
                        : ""}
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
                            {item.emoji || "🧸"} {item.produtoNome}
                          </div>
                          <div className="text-xs text-gray-500">
                            {item.produtoCodigo || "sem codigo"}
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
                            disabled={!isGestorEstoque}
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
                            disabled={!isGestorEstoque}
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
                            {abaixo ? "Abaixo do minimo" : "OK"}
                          </span>
                        </td>
                        {isGestorEstoque ? (
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => excluirProdutoDoEstoque(item)}
                              className="text-xs font-semibold text-red-600 hover:text-red-700"
                            >
                              🗑️ Excluir
                            </button>
                          </td>
                        ) : null}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>

        {isGestorEstoque ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <select
                className="select-field"
                value={produtoParaAdicionar}
                onChange={(e) => setProdutoParaAdicionar(e.target.value)}
                disabled={
                  loading || !usuarioSelecionadoId ||
                  produtosDisponiveisParaAdicionar.length === 0
                }
              >
                <option value="">
                  {produtosDisponiveisParaAdicionar.length === 0
                    ? "Todos os produtos ja estao na lista"
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
                disabled={loading || !usuarioSelecionadoId || !produtoParaAdicionar}
              >
                + Adicionar produto
              </button>
            </div>

            <button
              type="button"
              className="btn-primary disabled:opacity-60"
              onClick={salvarEstoque}
              disabled={salvando || loading}
            >
              {salvando ? "Salvando..." : "Salvar estoque"}
            </button>
          </div>
        ) : null}

        <div className="card mt-6">
          <h2 className="text-lg font-bold text-gray-900 mb-3">
            Alertas deste estoque
          </h2>
          {alertas.length === 0 ? (
            <p className="text-sm text-gray-600">
              Nenhum alerta de estoque no momento.
            </p>
          ) : (
            <div className="space-y-2">
              {alertas.slice(0, 10).map((item) => (
                <div
                  key={`${item.produtoId}-${item.id}`}
                  className="rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-900"
                >
                  <span className="font-semibold">
                    {item.produto?.nome || item.produtoId}
                  </span>
                  {` - atual ${item.quantidade} | minimo ${item.estoqueMinimo}`}
                </div>
              ))}
            </div>
          )}
        </div>

        {isGestorEstoque ? (
          <div className="card mt-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">
              Registro de movimentacoes de estoque
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase">
                  Usuario
                </label>
                <select
                  className="select-field"
                  value={filtroHistoricoUsuarioId}
                  onChange={(e) => setFiltroHistoricoUsuarioId(e.target.value)}
                >
                  <option value="">Selecione</option>
                  {usuarios.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.nome} ({item.role})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase">
                  Data inicio
                </label>
                <input
                  type="date"
                  className="input-field"
                  value={filtroHistoricoDataInicio}
                  onChange={(e) => setFiltroHistoricoDataInicio(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase">
                  Data fim
                </label>
                <input
                  type="date"
                  className="input-field"
                  value={filtroHistoricoDataFim}
                  onChange={(e) => setFiltroHistoricoDataFim(e.target.value)}
                />
              </div>

              <div className="flex items-end">
                <button
                  type="button"
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-gray-700 font-semibold hover:bg-gray-50"
                  onClick={() => {
                    setFiltroHistoricoUsuarioId("");
                    setFiltroHistoricoDataInicio("");
                    setFiltroHistoricoDataFim("");
                    setHistoricoMovimentacoes([]);
                    setErroHistorico("");
                  }}
                >
                  Limpar filtros
                </button>
              </div>
            </div>

            {!filtrosHistoricoCompletos ? null : loadingHistorico ? (
              <p className="text-sm text-gray-500">Carregando registros...</p>
            ) : erroHistorico ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {erroHistorico}
              </div>
            ) : historicoMovimentacoes.length === 0 ? (
              <p className="text-sm text-gray-500">
                Nenhuma movimentacao encontrada para os filtros selecionados.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">
                        Data/Hora
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">
                        Produto
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">
                        Tipo
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">
                        Quantidade
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">
                        Saldo
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">
                        Lancado por
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {historicoMovimentacoes.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-sm text-gray-700 whitespace-nowrap">
                          {formatarDataHora(item.dataMovimentacao)}
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-700">
                          {(item.produto?.emoji || "📦") +
                            " " +
                            (item.produto?.nome || item.produtoId)}
                        </td>
                        <td className="px-3 py-2 text-sm">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                              item.tipoMovimentacao === "entrada"
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {item.tipoMovimentacao === "entrada"
                              ? "Entrada"
                              : "Saida"}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-700">
                          {toNumberOrZero(item.quantidade)}
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-700 whitespace-nowrap">
                          {toNumberOrZero(item.quantidadeAnterior)} {"->"}{" "}
                          {toNumberOrZero(item.quantidadeAtual)}
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-700">
                          {item.lancadoPor?.nome || "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : null}

      </main>

      <Footer />
    </div>
  );
}

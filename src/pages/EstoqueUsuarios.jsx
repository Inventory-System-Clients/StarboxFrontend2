import { useCallback, useEffect, useMemo, useState } from "react";
// Função utilitária para buscar saldo do depósito principal para múltiplos produtos
async function buscarSaldosDepositoPrincipal(produtoIds) {
  if (!Array.isArray(produtoIds) || produtoIds.length === 0) return {};
  try {
    // Busca a loja depósito principal
    const lojasRes = await api.get("/lojas");
    const deposito = (lojasRes.data || []).find((l) => l.isDepositoPrincipal);
    if (!deposito) return {};
    // Busca o estoque do depósito principal
    const estoqueRes = await api.get(`/estoque-lojas/${deposito.id}`);
    const estoque = Array.isArray(estoqueRes.data) ? estoqueRes.data : [];
    // Monta um map produtoId -> quantidade
    const saldos = {};
    for (const pid of produtoIds) {
      const item = estoque.find((e) => String(e.produtoId) === String(pid));
      saldos[pid] = item ? Number(item.quantidade) : 0;
    }
    return saldos;
  } catch {
    return {};
  }
}
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

const criarLinhaMovimentacao = (produtoId = "") => ({
  produtoId: String(produtoId || ""),
  tipoMovimentacao: "entrada",
  quantidade: "",
});

const formatarDataHora = (valor) => {
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return "-";
  return data.toLocaleString("pt-BR");
};

export default function EstoqueUsuarios() {
  // Saldos do depósito principal para os produtos selecionados no modal
  const [saldosDeposito, setSaldosDeposito] = useState({});
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
  const [alertas, setAlertas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [mostrarModalMovimentacao, setMostrarModalMovimentacao] =
    useState(false);
  const [movimentacoesForm, setMovimentacoesForm] = useState([
    criarLinhaMovimentacao(),
  ]);
  const [movimentacaoEnviando, setMovimentacaoEnviando] = useState(false);
  const [movimentacaoErro, setMovimentacaoErro] = useState("");
  const [filtroHistoricoUsuarioId, setFiltroHistoricoUsuarioId] = useState("");
  const [filtroHistoricoDataInicio, setFiltroHistoricoDataInicio] =
    useState("");
  const [filtroHistoricoDataFim, setFiltroHistoricoDataFim] = useState("");
  const [historicoMovimentacoes, setHistoricoMovimentacoes] = useState([]);
  const [loadingHistorico, setLoadingHistorico] = useState(false);
  const [erroHistorico, setErroHistorico] = useState("");

  const montarRowsComProdutos = useCallback(
    (produtosBase, estoqueAtual = []) => {
      const estoqueMap = new Map(
        (estoqueAtual || []).map((item) => [item.produtoId, item]),
      );

      return (produtosBase || []).map((produto) => {
        const item = estoqueMap.get(produto.id);
        return {
          id: item?.id || null,
          produtoId: produto.id,
          produtoNome: produto.nome,
          produtoCodigo: produto.codigo,
          emoji: produto.emoji,
          quantidade: toNumberOrZero(item?.quantidade),
          estoqueMinimo:
            item?.estoqueMinimo !== undefined && item?.estoqueMinimo !== null
              ? toNumberOrZero(item.estoqueMinimo)
              : toNumberOrZero(produto.estoqueMinimo),
        };
      });
    },
    [],
  );

  const carregarEstoque = useCallback(
    async (alvoUsuarioId, produtosBase, usuariosBase = []) => {
      if (
        !alvoUsuarioId ||
        !Array.isArray(produtosBase) ||
        produtosBase.length === 0
      ) {
        setUsuarioSelecionado(null);
        setEstoqueRows([]);
        setAlertas([]);
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
        setEstoqueRows(montarRowsComProdutos(produtosBase, estoqueData));
        setAlertas(alertasData);
      } catch (err) {
        console.error("Erro ao carregar estoque do usuario:", err);
        setError(
          err?.response?.data?.error || "Erro ao carregar estoque do usuario",
        );
      }
    },
    [
      isGestorEstoque,
      montarRowsComProdutos,
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

        const requisicoes = [api.get("/produtos")];

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

  const estoqueRowsVisiveis = useMemo(
    () =>
      estoqueRows.filter((item) => {
        const quantidade = toNumberOrZero(item.quantidade);
        const minimo = toNumberOrZero(item.estoqueMinimo);
        return !(quantidade === 0 && minimo === 0);
      }),
    [estoqueRows],
  );

  const resumo = useMemo(() => {
    const totalProdutos = estoqueRowsVisiveis.length;
    const totalUnidades = estoqueRowsVisiveis.reduce(
      (acc, item) => acc + toNumberOrZero(item.quantidade),
      0,
    );
    const abaixoMinimo = estoqueRowsVisiveis.filter(
      (item) =>
        toNumberOrZero(item.quantidade) <= toNumberOrZero(item.estoqueMinimo),
    ).length;

    return {
      totalProdutos,
      totalUnidades,
      abaixoMinimo,
    };
  }, [estoqueRowsVisiveis]);

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

  const saldoAtualPorProduto = useMemo(
    () =>
      new Map(
        estoqueRows.map((item) => [
          String(item.produtoId),
          toNumberOrZero(item.quantidade),
        ]),
      ),
    [estoqueRows],
  );

  const obterProdutoInicialMovimentacao = useCallback(() => {
    const produtoPreferencial = produtos.find(
      (item) => String(item.id) === String(estoqueRowsVisiveis[0]?.produtoId),
    );

    return String(produtoPreferencial?.id || produtos[0]?.id || "");
  }, [estoqueRowsVisiveis, produtos]);

  const abrirModalMovimentacao = () => {
    if (!usuarioSelecionadoId) {
      setError("Selecione um usuario antes de lancar movimentacao.");
      return;
    }

    const produtoInicial = obterProdutoInicialMovimentacao();

    setMovimentacoesForm([criarLinhaMovimentacao(produtoInicial)]);
    setMovimentacaoErro("");
    setMostrarModalMovimentacao(true);

    // Buscar saldo do depósito principal para o produto inicial
    buscarSaldosDepositoPrincipal([produtoInicial]).then(setSaldosDeposito);
  };

  const fecharModalMovimentacao = () => {
    if (movimentacaoEnviando) return;

    setMostrarModalMovimentacao(false);
    setMovimentacaoErro("");
    setMovimentacoesForm([criarLinhaMovimentacao()]);
  };

  const adicionarLinhaMovimentacao = () => {
    const produtoInicial = obterProdutoInicialMovimentacao();
    setMovimentacoesForm((prev) => [
      ...prev,
      criarLinhaMovimentacao(produtoInicial),
    ]);
  };

  const removerLinhaMovimentacao = (indice) => {
    setMovimentacoesForm((prev) => {
      if (prev.length === 1) return prev;
      return prev.filter((_, idx) => idx !== indice);
    });
  };

  const atualizarLinhaMovimentacao = (indice, campo, valor) => {
    const valorFinal =
      campo === "quantidade" ? String(valor || "").replace(/\D/g, "") : valor;

    setMovimentacoesForm((prev) =>
      prev.map((item, idx) =>
        idx === indice ? { ...item, [campo]: valorFinal } : item,
      ),
    );

    // Se trocar produto, buscar saldo do depósito principal para todos produtos do form
    if (campo === "produtoId") {
      const novosIds = [
        ...new Set([
          ...movimentacoesForm.map((m, i) =>
            i === indice ? valorFinal : m.produtoId,
          ),
        ]),
      ];
      buscarSaldosDepositoPrincipal(novosIds).then(setSaldosDeposito);
    }
  };

  const lancarMovimentacao = async (event) => {
    event.preventDefault();

    if (!isGestorEstoque || !usuarioSelecionadoId) return;

    if (!Array.isArray(movimentacoesForm) || movimentacoesForm.length === 0) {
      setMovimentacaoErro("Adicione ao menos um produto para movimentar.");
      return;
    }

    // Verificar se há entradas e avisar sobre desconto do depósito
    const temEntradas = movimentacoesForm.some(
      (m) => m.tipoMovimentacao === "entrada",
    );

    if (temEntradas) {
      const totalEntradas = movimentacoesForm.filter(
        (m) => m.tipoMovimentacao === "entrada",
      ).length;
      const confirmar = window.confirm(
        `📦 Você está adicionando ${totalEntradas} produto(s) para "${usuarioSelecionado?.nome}".\n\n` +
          `🏭 Estes produtos serão AUTOMATICAMENTE DESCONTADOS do depósito principal.\n\n` +
          `Confirma a entrada de estoque para o funcionário?`,
      );

      if (!confirmar) {
        return;
      }
    }

    const movimentacoesNormalizadas = [];

    for (let index = 0; index < movimentacoesForm.length; index += 1) {
      const linha = movimentacoesForm[index] || {};
      const quantidadeNumerica = Number(linha.quantidade);

      if (!linha.produtoId) {
        setMovimentacaoErro(`Linha ${index + 1}: selecione um produto.`);
        return;
      }

      if (!["entrada", "saida"].includes(linha.tipoMovimentacao)) {
        setMovimentacaoErro(
          `Linha ${index + 1}: tipo de movimentacao invalido.`,
        );
        return;
      }

      if (
        Number.isNaN(quantidadeNumerica) ||
        !Number.isFinite(quantidadeNumerica) ||
        quantidadeNumerica <= 0
      ) {
        setMovimentacaoErro(
          `Linha ${index + 1}: informe uma quantidade valida maior que zero.`,
        );
        return;
      }

      movimentacoesNormalizadas.push({
        produtoId: linha.produtoId,
        tipoMovimentacao: linha.tipoMovimentacao,
        quantidade: quantidadeNumerica,
      });
    }

    const saldoSimulado = new Map(saldoAtualPorProduto);
    for (let index = 0; index < movimentacoesNormalizadas.length; index += 1) {
      const item = movimentacoesNormalizadas[index];
      const chaveProduto = String(item.produtoId);
      const saldoAnterior = toNumberOrZero(saldoSimulado.get(chaveProduto));

      if (
        item.tipoMovimentacao === "saida" &&
        item.quantidade > saldoAnterior
      ) {
        const produtoNome =
          produtos.find((produto) => String(produto.id) === chaveProduto)
            ?.nome || `produto ${chaveProduto}`;
        setMovimentacaoErro(
          `Linha ${index + 1}: nao e possivel tirar ${item.quantidade} de ${produtoNome}. Saldo atual: ${saldoAnterior}.`,
        );
        return;
      }

      saldoSimulado.set(
        chaveProduto,
        item.tipoMovimentacao === "entrada"
          ? saldoAnterior + item.quantidade
          : saldoAnterior - item.quantidade,
      );
    }

    try {
      setMovimentacaoEnviando(true);
      setMovimentacaoErro("");
      setError("");
      setSuccess("");

      await api.post(`/estoque-usuarios/${usuarioSelecionadoId}/movimentar`, {
        movimentacoes: movimentacoesNormalizadas,
      });

      setSuccess(
        `${movimentacoesNormalizadas.length} movimentacao(oes) registrada(s) com sucesso.`,
      );
      setMostrarModalMovimentacao(false);
      setMovimentacaoErro("");
      setMovimentacoesForm([criarLinhaMovimentacao()]);
      await carregarEstoque(usuarioSelecionadoId, produtos, usuarios);
    } catch (err) {
      console.error("Erro ao lancar movimentacao do estoque do usuario:", err);
      setMovimentacaoErro(
        err?.response?.data?.error || "Erro ao lancar movimentacao",
      );
    } finally {
      setMovimentacaoEnviando(false);
    }
  };

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
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {estoqueRowsVisiveis.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-6 text-center text-sm text-gray-500"
                    >
                      Nenhum produto para exibir. Itens com quantidade e minimo
                      zerados ficam ocultos.
                    </td>
                  </tr>
                ) : (
                  estoqueRowsVisiveis.map((item) => {
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
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>

        {isGestorEstoque ? (
          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 font-semibold hover:bg-gray-50 disabled:opacity-60"
              onClick={abrirModalMovimentacao}
              disabled={
                loading || !usuarioSelecionadoId || movimentacaoEnviando
              }
            >
              Lancar movimentacao
            </button>
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

        {isGestorEstoque && mostrarModalMovimentacao ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
                <h2 className="text-lg font-bold text-gray-900">
                  Movimentacao de estoque do usuario
                </h2>
                <button
                  type="button"
                  className="text-gray-500 hover:text-gray-700"
                  onClick={fecharModalMovimentacao}
                  disabled={movimentacaoEnviando}
                >
                  x
                </button>
              </div>

              <form
                className="space-y-4 px-6 py-5 overflow-y-auto flex-1"
                style={{ maxHeight: "70vh" }}
                onSubmit={lancarMovimentacao}
              >
                {/* Aviso sobre desconto do depósito principal */}
                <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
                  <div className="flex gap-3">
                    <div className="shrink-0">
                      <span className="text-2xl">ℹ️</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-blue-900 mb-1">
                        Atenção
                      </p>
                      <p className="text-sm text-blue-800">
                        Ao adicionar estoque para este funcionário (Entrada), os
                        produtos serão{" "}
                        <strong>
                          automaticamente descontados do Depósito Principal
                        </strong>
                        .
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  {movimentacoesForm.map((linha, index) => {
                    const produtoLinha =
                      produtos.find(
                        (item) => String(item.id) === String(linha.produtoId),
                      ) || null;
                    const saldoLinha = toNumberOrZero(
                      saldoAtualPorProduto.get(String(linha.produtoId)),
                    );

                    // Saldo do depósito principal para o produto
                    const saldoDeposito =
                      saldosDeposito[String(linha.produtoId)] ?? null;

                    return (
                      <div
                        key={`linha-movimentacao-${index}`}
                        className="rounded-lg border border-gray-200 bg-gray-50 p-3"
                      >
                        <p className="text-xs font-semibold text-gray-500 mb-2">
                          Item {index + 1}
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">
                              Produto
                            </label>
                            <select
                              className="select-field"
                              value={linha.produtoId}
                              onChange={(e) =>
                                atualizarLinhaMovimentacao(
                                  index,
                                  "produtoId",
                                  e.target.value,
                                )
                              }
                              disabled={movimentacaoEnviando}
                              required
                            >
                              <option value="" disabled>
                                Selecione
                              </option>
                              {produtos.map((item) => (
                                <option key={item.id} value={item.id}>
                                  {item.nome}{" "}
                                  {item.codigo ? `(${item.codigo})` : ""}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">
                              Tipo
                            </label>
                            <select
                              className="select-field"
                              value={linha.tipoMovimentacao}
                              onChange={(e) =>
                                atualizarLinhaMovimentacao(
                                  index,
                                  "tipoMovimentacao",
                                  e.target.value,
                                )
                              }
                              disabled={movimentacaoEnviando}
                              required
                            >
                              <option value="entrada">
                                Enviar para funcionario
                              </option>
                              <option value="saida">
                                Tirar do funcionario
                              </option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">
                              Quantidade
                            </label>
                            <input
                              type="number"
                              min="1"
                              step="1"
                              className="input-field no-number-controls"
                              value={linha.quantidade}
                              onChange={(e) =>
                                atualizarLinhaMovimentacao(
                                  index,
                                  "quantidade",
                                  e.target.value,
                                )
                              }
                              onWheel={bloquearScrollNumero}
                              disabled={movimentacaoEnviando}
                              required
                            />
                          </div>
                        </div>

                        <div className="mt-2 flex items-center justify-between gap-2">
                          <p className="text-xs text-gray-500">
                            Saldo atual: <strong>{saldoLinha}</strong>
                            {produtoLinha
                              ? ` ${produtoLinha.emoji || ""} ${produtoLinha.nome}`
                              : ""}
                          </p>
                          {/* Alerta de saldo do depósito principal insuficiente */}
                          {linha.tipoMovimentacao === "entrada" &&
                          saldoDeposito !== null &&
                          Number(linha.quantidade) > saldoDeposito ? (
                            <div className="mt-2 rounded bg-amber-100 border border-amber-300 px-3 py-2 text-xs text-amber-900">
                              Atenção: O depósito principal possui apenas{" "}
                              <strong>{saldoDeposito}</strong> unidade(s) deste
                              produto. A quantidade informada é maior que o
                              disponível no depósito.
                            </div>
                          ) : null}

                          {movimentacoesForm.length > 1 ? (
                            <button
                              type="button"
                              className="text-xs font-semibold text-red-600 hover:text-red-700"
                              onClick={() => removerLinhaMovimentacao(index)}
                              disabled={movimentacaoEnviando}
                            >
                              Remover item
                            </button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div>
                  <button
                    type="button"
                    className="text-sm font-semibold text-[#F2A20C] hover:text-[#c58409]"
                    onClick={adicionarLinhaMovimentacao}
                    disabled={movimentacaoEnviando}
                  >
                    + Adicionar produto
                  </button>
                </div>

                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  Saidas nao podem ultrapassar o saldo atual do funcionario para
                  cada produto.
                </p>

                {movimentacaoErro ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {movimentacaoErro}
                  </div>
                ) : null}

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 disabled:opacity-60"
                    onClick={fecharModalMovimentacao}
                    disabled={movimentacaoEnviando}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="btn-primary disabled:opacity-60"
                    disabled={movimentacaoEnviando}
                  >
                    {movimentacaoEnviando
                      ? "Lancando..."
                      : "Confirmar movimentacao"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}
      </main>

      <Footer />
    </div>
  );
}

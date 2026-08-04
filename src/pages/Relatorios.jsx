import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { buscarRoteiros } from "../services/roteiros";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer.jsx";
import { PageHeader } from "../components/UIComponents";
import { PageLoader } from "../components/Loading";
import { RelatorioTodasLojas } from "../components/RelatorioTodasLojas";

const TODAS_LOJAS_VALUE = "__TODAS_AS_LOJAS__";
const SELECAO_MANUAL_LOJAS_VALUE = "__SELECAO_MANUAL_LOJAS__";

export function Relatorios() {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(null);
  const [lojas, setLojas] = useState([]);
  const [lojaSelecionada, setLojaSelecionada] = useState("");
  const [buscaLoja, setBuscaLoja] = useState("");
  const [buscaLojaConsolidado, setBuscaLojaConsolidado] = useState("");
  const [buscaRoteiro, setBuscaRoteiro] = useState("");
  const [buscaUsuario, setBuscaUsuario] = useState("");
  const [lojasSelecionadasConsolidado, setLojasSelecionadasConsolidado] =
    useState([]);
  const [roteiros, setRoteiros] = useState([]);
  const [roteiroSelecionado, setRoteiroSelecionado] = useState("");
  const [usuarios, setUsuarios] = useState([]);
  const [usuarioSelecionado, setUsuarioSelecionado] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingLojas, setLoadingLojas] = useState(true);
  const [relatorio, setRelatorio] = useState(null);
  const [comissaoData, setComissaoData] = useState(null);
  const [lucroData, setLucroData] = useState(null);
  const [movimentacoesData, setMovimentacoesData] = useState(null);
  const [produtosPrecos, setProdutosPrecos] = useState({});
  const [abaTicketPremio, setAbaTicketPremio] = useState("loja");
  const [error, setError] = useState("");
  const [gastosFixosLoja, setGastosFixosLoja] = useState([]);
  const [comparativoMensal, setComparativoMensal] = useState(null);
  const termoBuscaLoja = buscaLoja.trim().toLowerCase();
  const termoBuscaLojaConsolidado = buscaLojaConsolidado.trim().toLowerCase();
  const termoBuscaRoteiro = buscaRoteiro.trim().toLowerCase();
  const termoBuscaUsuario = buscaUsuario.trim().toLowerCase();

  const lojasFiltradasBusca = useMemo(() => {
    if (!termoBuscaLoja) return lojas;
    return lojas.filter((loja) =>
      [loja?.nome, loja?.cidade, loja?.endereco, loja?.razaoSocial]
        .filter(Boolean)
        .some((valor) => String(valor).toLowerCase().includes(termoBuscaLoja)),
    );
  }, [lojas, termoBuscaLoja]);

  const lojasFiltradasConsolidado = useMemo(() => {
    if (!termoBuscaLojaConsolidado) return lojas;
    return lojas.filter((loja) =>
      [loja?.nome, loja?.cidade, loja?.endereco, loja?.razaoSocial]
        .filter(Boolean)
        .some((valor) =>
          String(valor).toLowerCase().includes(termoBuscaLojaConsolidado),
        ),
    );
  }, [lojas, termoBuscaLojaConsolidado]);

  const roteirosFiltradosBusca = useMemo(() => {
    if (!termoBuscaRoteiro) return roteiros;
    return roteiros.filter((roteiro) =>
      [roteiro?.nome, roteiro?.descricao, roteiro?.funcionario?.nome]
        .filter(Boolean)
        .some((valor) =>
          String(valor).toLowerCase().includes(termoBuscaRoteiro),
        ),
    );
  }, [roteiros, termoBuscaRoteiro]);

  const usuariosFiltradosBusca = useMemo(() => {
    if (!termoBuscaUsuario) return usuarios;
    return usuarios.filter((usuario) =>
      [usuario?.nome, usuario?.email, usuario?.role]
        .filter(Boolean)
        .some((valor) =>
          String(valor).toLowerCase().includes(termoBuscaUsuario),
        ),
    );
  }, [usuarios, termoBuscaUsuario]);

  const montarParamsComUsuario = (params = {}, usuarioId = usuarioSelecionado) =>
    usuarioId ? { ...params, usuarioId } : { ...params };

  const montarFiltroUsuarioRelatorio = (usuarioId = usuarioSelecionado) => {
    if (!usuarioId) return null;

    const usuario = (Array.isArray(usuarios) ? usuarios : []).find(
      (item) => String(item?.id) === String(usuarioId),
    );

    return {
      id: usuarioId,
      nome: usuario?.nome || "Funcionário selecionado",
      email: usuario?.email || "",
      role: usuario?.role || "",
    };
  };

  const aplicarFiltroUsuarioAoRelatorio = (dadosRelatorio, filtroUsuario) => {
    if (!dadosRelatorio || !filtroUsuario) return dadosRelatorio;
    return {
      ...dadosRelatorio,
      filtroUsuario,
    };
  };

  // Buscar lista de lojas
  const carregarLojas = async () => {
    try {
      setLoadingLojas(true);
      const response = await api.get("/lojas");
      setLojas(response.data);
    } catch (error) {
      setError(
        "Erro ao carregar lojas: " +
          (error.response?.data?.error || error.message),
      );
      setLojas([]);
    } finally {
      setLoadingLojas(false);
    }
  };

  const carregarUsuarios = async () => {
    try {
      const response = await api.get("/usuarios/funcionarios");
      const listaUsuarios = Array.isArray(response.data)
        ? response.data
        : response.data?.usuarios || response.data?.rows || [];
      setUsuarios(listaUsuarios);
    } catch (error) {
      console.warn("Erro ao carregar usuários para filtro:", error);
      setUsuarios([]);
    }
  };

  // Buscar dados do dashboard
  const carregarDashboard = async (
    lojaId,
    dataInicio,
    dataFim,
    usuarioId = usuarioSelecionado,
  ) => {
    try {
      const response = await api.get("/relatorios/dashboard", {
        params: montarParamsComUsuario(
          {
          lojaId,
          dataInicio,
          dataFim,
          },
          usuarioId,
        ),
      });
      setDashboard(response.data);
    } catch (error) {
      console.error("Erro ao carregar dashboard:", error);
      setDashboard(null);
    }
  };

  useEffect(() => {
    carregarLojas();
    carregarUsuarios();
    // Carregar roteiros
    buscarRoteiros()
      .then(setRoteiros)
      .catch(() => setRoteiros([]));
    definirDatasDefault && definirDatasDefault();
  }, []);

  const handleImprimir = () => {
    window.print();
  };

  const definirDatasDefault = () => {
    const hoje = new Date();
    const seteDiasAtras = new Date();
    seteDiasAtras.setDate(hoje.getDate() - 7);
    setDataFim(hoje.toISOString().split("T")[0]);
    setDataInicio(seteDiasAtras.toISOString().split("T")[0]);
  };

  const toggleLojaConsolidado = (lojaId) => {
    const lojaIdNormalizado = String(lojaId);

    setLojasSelecionadasConsolidado((prev) =>
      prev.includes(lojaIdNormalizado)
        ? prev.filter((idAtual) => idAtual !== lojaIdNormalizado)
        : [...prev, lojaIdNormalizado],
    );
  };

  const formatarDataISO = (data) => {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, "0");
    const dia = String(data.getDate()).padStart(2, "0");
    return `${ano}-${mes}-${dia}`;
  };

  const calcularCustoFixoProporcionalPeriodo = (
    custoFixoMensal,
    periodoInicio,
    periodoFim,
  ) => {
    const custoMensal = toNumber(custoFixoMensal);
    if (custoMensal <= 0) return 0;

    if (!periodoInicio || !periodoFim) return custoMensal;

    const inicio = new Date(`${periodoInicio}T12:00:00`);
    const fim = new Date(`${periodoFim}T12:00:00`);

    if (Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime())) {
      return custoMensal;
    }

    if (fim < inicio) return 0;

    const cursor = new Date(inicio);
    let totalProporcional = 0;

    while (cursor <= fim) {
      const diasNoMes = new Date(
        cursor.getFullYear(),
        cursor.getMonth() + 1,
        0,
      ).getDate();

      if (diasNoMes > 0) {
        totalProporcional += custoMensal / diasNoMes;
      }

      cursor.setDate(cursor.getDate() + 1);
    }

    return totalProporcional;
  };

  const obterMesmoDiaNoMesAnterior = (dataTexto) => {
    const dataBase = new Date(`${dataTexto}T00:00:00`);
    if (Number.isNaN(dataBase.getTime())) return dataTexto;

    const ano = dataBase.getFullYear();
    const mes = dataBase.getMonth();
    const dia = dataBase.getDate();
    const ultimoDiaMesAnterior = new Date(ano, mes, 0).getDate();
    const diaAjustado = Math.min(dia, ultimoDiaMesAnterior);

    return formatarDataISO(new Date(ano, mes - 1, diaAjustado));
  };

  const toNumber = (valor) => Number(valor || 0);

  const pickNumber = (...valores) => {
    for (const valor of valores) {
      if (valor === null || valor === undefined || valor === "") continue;
      const numero = Number(valor);
      if (!Number.isNaN(numero)) return numero;
    }
    return null;
  };

  const normalizarTexto = (texto) =>
    String(texto || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

  const extrairListaGastosFixos = (payload) => {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.gastos)) return payload.gastos;
    return [];
  };

  const selecionarLojasDoRelatorioConsolidado = (
    dadosRelatorio,
    lojasDisponiveis,
  ) => {
    const idsLojas = new Set();
    const nomesLojas = new Set();

    const listasComLojas = [
      dadosRelatorio?.graficos?.rankingLucroLojas,
      dadosRelatorio?.graficos?.rankingGastoLojas,
      dadosRelatorio?.graficos?.participacaoLojas,
      dadosRelatorio?.graficos?.rankingLucroBrutoLojas,
      dadosRelatorio?.graficos?.gastosFixosPorLoja,
    ];

    listasComLojas.forEach((lista) => {
      (lista || []).forEach((item) => {
        const lojaId = item?.lojaId ?? item?.id;
        const lojaNome = item?.lojaNome ?? item?.nome;

        if (lojaId !== null && lojaId !== undefined && lojaId !== "") {
          idsLojas.add(String(lojaId));
        }

        if (lojaNome) {
          nomesLojas.add(normalizarTexto(lojaNome));
        }
      });
    });

    if (!idsLojas.size && !nomesLojas.size) {
      return Array.isArray(lojasDisponiveis) ? lojasDisponiveis : [];
    }

    return (Array.isArray(lojasDisponiveis) ? lojasDisponiveis : []).filter(
      (loja) =>
        idsLojas.has(String(loja?.id)) ||
        nomesLojas.has(normalizarTexto(loja?.nome)),
    );
  };

  const carregarGastosFixosPorLoja = async (
    dadosRelatorio,
    idsLojasSelecionadas = [],
  ) => {
    const idsSelecionados = new Set(
      (idsLojasSelecionadas || []).map((idLoja) => String(idLoja)),
    );

    const lojasAlvo = idsSelecionados.size
      ? (Array.isArray(lojas) ? lojas : []).filter((loja) =>
          idsSelecionados.has(String(loja?.id)),
        )
      : selecionarLojasDoRelatorioConsolidado(dadosRelatorio, lojas);

    if (!lojasAlvo.length) return [];

    const resultados = await Promise.all(
      lojasAlvo.map(async (loja) => {
        try {
          const response = await api.get(`/gastos-fixos-loja/${loja.id}`);
          const gastos = extrairListaGastosFixos(response.data);
          const custoFixo = gastos.reduce(
            (acc, item) => acc + toNumber(item?.valor),
            0,
          );

          return {
            lojaId: loja.id,
            lojaNome: loja.nome || `Loja ${loja.id}`,
            custoFixo,
          };
        } catch (erroGastoLoja) {
          console.warn(
            `Não foi possível buscar gastos fixos da loja ${loja.id}:`,
            erroGastoLoja,
          );
          return {
            lojaId: loja.id,
            lojaNome: loja.nome || `Loja ${loja.id}`,
            custoFixo: 0,
          };
        }
      }),
    );

    return resultados.sort(
      (a, b) => Number(b.custoFixo || 0) - Number(a.custoFixo || 0),
    );
  };

  const aplicarGastosFixosPorLojaNoConsolidado = (
    dadosRelatorio,
    gastosFixosPorLoja,
  ) => {
    if (!dadosRelatorio) return dadosRelatorio;

    const gastosNormalizados = (gastosFixosPorLoja || []).map((item) => ({
      lojaId: item?.lojaId,
      lojaNome: item?.lojaNome || "-",
      custoFixo: toNumber(item?.custoFixo),
    }));

    const custoFixoTotal = gastosNormalizados.reduce(
      (acc, item) => acc + toNumber(item?.custoFixo),
      0,
    );

    return {
      ...dadosRelatorio,
      totais: {
        ...(dadosRelatorio.totais || {}),
        custoFixoTotal,
      },
      graficos: {
        ...(dadosRelatorio.graficos || {}),
        gastosFixosPorLoja: gastosNormalizados,
      },
    };
  };

  const obterValorLucroBrutoPorItem = (item, lucroBrutoBase = 0) => {
    const valorDireto =
      item?.lucroBruto ?? item?.valor ?? item?.lucroBrutoLoja ?? null;

    if (
      valorDireto !== null &&
      valorDireto !== undefined &&
      valorDireto !== ""
    ) {
      return toNumber(valorDireto);
    }

    const participacao = toNumber(item?.participacaoLucroBruto);
    if (participacao > 0 && lucroBrutoBase > 0) {
      return (lucroBrutoBase * participacao) / 100;
    }

    return 0;
  };

  const itemPertenceAoConsolidadoSelecionado = (
    item,
    idsLojasSelecionadas,
    nomesLojasSelecionadas,
  ) => {
    const lojaIdItem = item?.lojaId ?? item?.idLoja ?? item?.loja?.id;
    const lojaNomeItem = normalizarTexto(
      item?.lojaNome ?? item?.nome ?? item?.loja?.nome,
    );

    if (lojaIdItem !== null && lojaIdItem !== undefined && lojaIdItem !== "") {
      return idsLojasSelecionadas.has(String(lojaIdItem));
    }

    if (lojaNomeItem) {
      return nomesLojasSelecionadas.has(lojaNomeItem);
    }

    return false;
  };

  const aplicarFiltroLojasNoConsolidado = (
    dadosRelatorio,
    idsLojasSelecionadas = [],
  ) => {
    if (!dadosRelatorio || !idsLojasSelecionadas.length) {
      return dadosRelatorio;
    }

    const idsSelecionados = new Set(
      idsLojasSelecionadas.map((idLoja) => String(idLoja)),
    );
    const lojasSelecionadas = (Array.isArray(lojas) ? lojas : []).filter(
      (loja) => idsSelecionados.has(String(loja?.id)),
    );
    const nomesSelecionados = new Set(
      lojasSelecionadas
        .map((loja) => normalizarTexto(loja?.nome))
        .filter(Boolean),
    );

    const filtrarListaPorLoja = (lista = []) =>
      (lista || []).filter((item) =>
        itemPertenceAoConsolidadoSelecionado(
          item,
          idsSelecionados,
          nomesSelecionados,
        ),
      );

    const graficosOriginais = dadosRelatorio?.graficos || {};
    const totaisOriginais = dadosRelatorio?.totais || {};
    const lucroBrutoBaseOriginal = toNumber(totaisOriginais.lucroBrutoTotal);

    const rankingLucroLojas = filtrarListaPorLoja(
      graficosOriginais.rankingLucroLojas,
    ).sort((a, b) => toNumber(b?.lucroLiquido) - toNumber(a?.lucroLiquido));

    const rankingGastoLojas = filtrarListaPorLoja(
      graficosOriginais.rankingGastoLojas,
    ).sort((a, b) => toNumber(b?.custoTotal) - toNumber(a?.custoTotal));

    const rankingLucroBrutoLojas = filtrarListaPorLoja(
      graficosOriginais.rankingLucroBrutoLojas?.length
        ? graficosOriginais.rankingLucroBrutoLojas
        : graficosOriginais.participacaoLojas,
    )
      .map((item) => ({
        ...item,
        lucroBruto: obterValorLucroBrutoPorItem(item, lucroBrutoBaseOriginal),
      }))
      .sort((a, b) => toNumber(b?.lucroBruto) - toNumber(a?.lucroBruto));

    const lucroBrutoTotalSelecionado = rankingLucroBrutoLojas.reduce(
      (acc, item) => acc + toNumber(item?.lucroBruto),
      0,
    );

    const participacaoLojas = filtrarListaPorLoja(
      graficosOriginais.participacaoLojas,
    )
      .map((item) => {
        const lucroBrutoItem = obterValorLucroBrutoPorItem(
          item,
          lucroBrutoBaseOriginal,
        );

        return {
          ...item,
          participacaoLucroBruto:
            lucroBrutoTotalSelecionado > 0
              ? (lucroBrutoItem / lucroBrutoTotalSelecionado) * 100
              : 0,
        };
      })
      .sort(
        (a, b) =>
          toNumber(b?.participacaoLucroBruto) -
          toNumber(a?.participacaoLucroBruto),
      );

    const rankingTicketPremioLojas = filtrarListaPorLoja(
      graficosOriginais.rankingTicketPremioLojas,
    ).sort(
      (a, b) => toNumber(b?.ticketPorPremio) - toNumber(a?.ticketPorPremio),
    );

    const nomesLojasComDados = Array.from(
      new Set(
        [
          ...rankingLucroLojas,
          ...rankingGastoLojas,
          ...rankingLucroBrutoLojas,
          ...participacaoLojas,
          ...rankingTicketPremioLojas,
        ]
          .map((item) => item?.lojaNome || item?.nome)
          .filter(Boolean),
      ),
    );

    const nomesLojasComDadosNormalizados = new Set(
      nomesLojasComDados.map((nome) => normalizarTexto(nome)).filter(Boolean),
    );

    const lojasSemDados = lojasSelecionadas
      .map((loja) => loja?.nome)
      .filter(
        (nome) =>
          nome && !nomesLojasComDadosNormalizados.has(normalizarTexto(nome)),
      );

    const valorEsperadoTotalSelecionado = rankingLucroBrutoLojas.reduce(
      (acc, item) => acc + toNumber(item?.valorEsperado),
      0,
    );

    const totaisFiltrados = {
      ...totaisOriginais,
      lucroBrutoTotal: lucroBrutoTotalSelecionado,
      lucroLiquidoTotal: rankingLucroLojas.reduce(
        (acc, item) => acc + toNumber(item?.lucroLiquido),
        0,
      ),
      custoTotal: rankingGastoLojas.reduce(
        (acc, item) => acc + toNumber(item?.custoTotal),
        0,
      ),
      valorEsperadoTotal: valorEsperadoTotalSelecionado,
      lucroEsperadoTotal:
        valorEsperadoTotalSelecionado -
        rankingGastoLojas.reduce(
          (acc, item) => acc + toNumber(item?.custoTotal),
          0,
        ),
    };

    const lojaMaiorLucro = rankingLucroLojas[0]
      ? {
          lojaNome:
            rankingLucroLojas[0]?.lojaNome || rankingLucroLojas[0]?.nome || "-",
          lucroLiquido: toNumber(rankingLucroLojas[0]?.lucroLiquido),
        }
      : null;

    const lojaMaiorGasto = rankingGastoLojas[0]
      ? {
          lojaNome:
            rankingGastoLojas[0]?.lojaNome || rankingGastoLojas[0]?.nome || "-",
          custoTotal: toNumber(rankingGastoLojas[0]?.custoTotal),
        }
      : null;

    const lojaMaiorParticipacao = participacaoLojas[0]
      ? {
          lojaNome:
            participacaoLojas[0]?.lojaNome || participacaoLojas[0]?.nome || "-",
          participacaoLucroBruto: toNumber(
            participacaoLojas[0]?.participacaoLucroBruto,
          ),
        }
      : null;

    return {
      ...dadosRelatorio,
      lojasComDados: nomesLojasComDados.length,
      lojasSemDados,
      totais: totaisFiltrados,
      destaques: {
        ...(dadosRelatorio?.destaques || {}),
        lojaMaiorLucro,
        lojaMaiorGasto,
        lojaMaiorParticipacao,
      },
      graficos: {
        ...graficosOriginais,
        rankingLucroLojas,
        rankingGastoLojas,
        rankingLucroBrutoLojas,
        participacaoLojas,
        rankingTicketPremioLojas,
      },
    };
  };

  const obterTotaisFluxoCaixaRelatorio = (dadosRelatorio) => {
    const dinheiroFluxo = toNumber(
      dadosRelatorio?.totais?.valorDinheiroMaquinas ??
        (Array.isArray(dadosRelatorio?.maquinas)
          ? dadosRelatorio.maquinas.reduce(
              (acc, maquina) => acc + toNumber(maquina?.totais?.dinheiro),
              0,
            )
          : 0),
    );

    const cartaoPixFluxoBruto = toNumber(
      dadosRelatorio?.totais?.valorCartaoPixMaquinasBruto ??
        (Array.isArray(dadosRelatorio?.maquinas)
          ? dadosRelatorio.maquinas.reduce(
              (acc, maquina) => acc + toNumber(maquina?.totais?.cartaoPix),
              0,
            )
          : 0),
    );

    const cartaoPixFluxoLiquido = toNumber(
      dadosRelatorio?.totais?.valorCartaoPixMaquinasLiquido ??
        (Array.isArray(dadosRelatorio?.maquinas)
          ? dadosRelatorio.maquinas.reduce(
              (acc, maquina) =>
                acc +
                toNumber(
                  maquina?.totais?.cartaoPixLiquido ??
                    maquina?.totais?.cartaoPix,
                ),
              0,
            )
          : cartaoPixFluxoBruto),
    );

    return {
      dinheiroFluxo,
      cartaoPixFluxoBruto,
      cartaoPixFluxoLiquido,
      totalBrutoFluxo: dinheiroFluxo + cartaoPixFluxoBruto,
      totalLiquidoFluxo: dinheiroFluxo + cartaoPixFluxoLiquido,
    };
  };

  const calcularValorFichasRelatorio = (dadosRelatorio) => {
    const totalFichas = toNumber(dadosRelatorio?.totais?.fichas);
    const valorFicha = toNumber(dadosRelatorio?.loja?.valorFichaPadrao || 2.5);
    return totalFichas * valorFicha;
  };

  const calcularValorConsolidadoRelatorio = (dadosRelatorio) => {
    if (dadosRelatorio?.totais?.valorBrutoConsolidadoLojaMaquinas != null) {
      return toNumber(dadosRelatorio.totais.valorBrutoConsolidadoLojaMaquinas);
    }
    const { totalBrutoFluxo } = obterTotaisFluxoCaixaRelatorio(dadosRelatorio);
    return totalBrutoFluxo;
  };

  const calcularLucroLiquidoRelatorio = (dadosRelatorio) => {
    if (dadosRelatorio?.totais?.valorLiquidoConsolidadoLojaMaquinas != null) {
      return toNumber(
        dadosRelatorio.totais.valorLiquidoConsolidadoLojaMaquinas,
      );
    }
    const { totalLiquidoFluxo } =
      obterTotaisFluxoCaixaRelatorio(dadosRelatorio);
    const gastoTotal = toNumber(dadosRelatorio?.totais?.gastoTotalPeriodo);
    return totalLiquidoFluxo - gastoTotal;
  };

  const normalizarProdutoSaida = (produto = {}) => {
    const produtoIdOriginal =
      produto?.produtoId ?? produto?.produtoNaMaquinaId ?? produto?.id;
    const produtoId =
      produtoIdOriginal === null || produtoIdOriginal === undefined
        ? ""
        : String(produtoIdOriginal);

    return {
      produtoId: produtoId || null,
      produtoNaMaquinaId:
        produto?.produtoNaMaquinaId !== null &&
        produto?.produtoNaMaquinaId !== undefined
          ? String(produto.produtoNaMaquinaId)
          : null,
      nome:
        produtoId === "__SEM_DETALHE__"
          ? "Produto não detalhado (legado)"
          : String(produto?.nome || "").trim() || "Produto sem nome",
      codigo: String(produto?.codigo || "").trim(),
      quantidade: toNumber(produto?.quantidade),
      valorUnitario: toNumber(
        produto?.valorUnitario ?? produto?.custoUnitario ?? produto?.preco,
      ),
      valorTotal: toNumber(produto?.valorTotal),
      emoji: produto?.emoji || "📦",
    };
  };

  const calcularResumoProdutos = (produtosSairam = [], totais = {}) => {
    const itens = (Array.isArray(produtosSairam) ? produtosSairam : []).map(
      normalizarProdutoSaida,
    );

    const totalQuantidadeItens = itens.reduce(
      (acc, item) => acc + toNumber(item?.quantidade),
      0,
    );
    const custoTotalItens = itens.reduce(
      (acc, item) => acc + toNumber(item?.valorTotal),
      0,
    );

    const totalQuantidadeDeclarado = toNumber(totais?.produtosSairam);
    const custoTotalDeclarado = toNumber(totais?.custoProdutosSairam);
    const tolerancia = 0.01;

    return {
      itens,
      totalQuantidadeItens,
      custoTotalItens,
      totalQuantidadeDeclarado,
      custoTotalDeclarado,
      quantidadeItensSemDetalhe: itens.filter(
        (item) => item?.produtoId === "__SEM_DETALHE__",
      ).length,
      divergenciaQuantidade:
        Math.abs(totalQuantidadeItens - totalQuantidadeDeclarado) > tolerancia,
      divergenciaCusto:
        Math.abs(custoTotalItens - custoTotalDeclarado) > tolerancia,
    };
  };

  const calcularCustoSaidaProdutosRelatorio = (dadosRelatorio) => {
    const resumoConsolidado = calcularResumoProdutos(
      dadosRelatorio?.produtosSairam,
      dadosRelatorio?.totais,
    );

    if (resumoConsolidado.itens.length > 0) {
      return resumoConsolidado.custoTotalItens;
    }

    if (resumoConsolidado.totalQuantidadeDeclarado === 0) {
      return 0;
    }

    const produtosSairamPorMaquina = Array.isArray(dadosRelatorio?.maquinas)
      ? dadosRelatorio.maquinas.flatMap((maquina) =>
          Array.isArray(maquina?.produtosSairam) ? maquina.produtosSairam : [],
        )
      : [];

    if (produtosSairamPorMaquina.length > 0) {
      return calcularResumoProdutos(produtosSairamPorMaquina).custoTotalItens;
    }

    return toNumber(dadosRelatorio?.totais?.custoProdutosSairam);
  };

  const obterLojaIdDoFluxo = (fluxo) =>
    String(
      fluxo?.lojaId ??
        fluxo?.loja?.id ??
        fluxo?.movimentacao?.lojaId ??
        fluxo?.movimentacao?.loja?.id ??
        fluxo?.movimentacao?.maquina?.lojaId ??
        fluxo?.movimentacao?.maquina?.loja?.id ??
        "",
    ).trim();

  const filtrarFluxosPorLoja = (fluxos = [], lojaId) => {
    const lojaAlvo = String(lojaId || "").trim();
    if (!lojaAlvo) return Array.isArray(fluxos) ? fluxos : [];

    return (Array.isArray(fluxos) ? fluxos : []).filter((fluxo) => {
      const lojaDoFluxo = obterLojaIdDoFluxo(fluxo);
      return lojaDoFluxo === lojaAlvo;
    });
  };

  const obterDataReferenciaFluxo = (fluxo) => {
    const dataTexto =
      fluxo?.movimentacao?.dataColeta ||
      fluxo?.movimentacao?.dataMovimentacao ||
      fluxo?.movimentacao?.createdAt ||
      fluxo?.movimentacao?.updatedAt ||
      fluxo?.dataConferencia ||
      fluxo?.createdAt ||
      fluxo?.updatedAt ||
      null;

    if (!dataTexto) return null;
    const dataObj = new Date(dataTexto);
    if (Number.isNaN(dataObj.getTime())) return null;
    return dataObj;
  };

  const calcularQuebraCaixaComoCusto = (
    fluxos = [],
    lojaIdAlvo = null,
    periodoInicio = null,
    periodoFim = null,
  ) => {
    const alvo =
      lojaIdAlvo === null || lojaIdAlvo === undefined
        ? ""
        : String(lojaIdAlvo).trim();

    const inicioPeriodo = periodoInicio
      ? new Date(`${periodoInicio}T00:00:00`)
      : null;
    const fimPeriodo = periodoFim ? new Date(`${periodoFim}T23:59:59`) : null;

    return (Array.isArray(fluxos) ? fluxos : []).reduce((acc, fluxo) => {
      const dataFluxo = obterDataReferenciaFluxo(fluxo);
      if (inicioPeriodo && dataFluxo && dataFluxo < inicioPeriodo) {
        return acc;
      }
      if (fimPeriodo && dataFluxo && dataFluxo > fimPeriodo) {
        return acc;
      }

      if (alvo) {
        const lojaDoFluxo = obterLojaIdDoFluxo(fluxo);
        // Em relatório por loja, só aceita fluxos que comprovem pertencer à loja alvo.
        if (lojaDoFluxo !== alvo) {
          return acc;
        }
      }

      const conferenciaNormalizada = String(fluxo?.conferencia || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, "_");

      // Regra de negocio: quebra de caixa conta SOMENTE quando a conferencia e "nao bateu".
      if (conferenciaNormalizada !== "nao_bateu") {
        return acc;
      }

      const temDiferencaDireta =
        fluxo?.diferenca !== null &&
        fluxo?.diferenca !== undefined &&
        fluxo?.diferenca !== "";

      const valorEsperadoReferencia =
        fluxo?.valorEsperado ??
        fluxo?.valorEsperadoCalculado ??
        fluxo?.movimentacao?.valorFaturado;

      const valorEsperadoInformado =
        valorEsperadoReferencia !== null &&
        valorEsperadoReferencia !== undefined &&
        valorEsperadoReferencia !== "";

      const valorRetiradoInformado =
        fluxo?.valorRetirado !== null &&
        fluxo?.valorRetirado !== undefined &&
        fluxo?.valorRetirado !== "";

      if (
        !temDiferencaDireta &&
        (!valorRetiradoInformado || !valorEsperadoInformado)
      ) {
        return acc;
      }

      const diferenca = temDiferencaDireta
        ? toNumber(fluxo?.diferenca)
        : toNumber(fluxo?.valorRetirado) - toNumber(valorEsperadoReferencia);

      // Quebra de caixa só ocorre quando o retirado é menor que o esperado.
      return diferenca < 0 ? acc + Math.abs(diferenca) : acc;
    }, 0);
  };

  const deduplicarFluxosCaixa = (fluxos = []) => {
    const mapa = new Map();
    const duplicados = [];

    (Array.isArray(fluxos) ? fluxos : []).forEach((fluxo, idx) => {
      const chave = String(
        fluxo?.id ??
          fluxo?.movimentacaoId ??
          fluxo?.movimentacao?.id ??
          `fluxo-${idx}`,
      );

      if (!mapa.has(chave)) {
        mapa.set(chave, fluxo);
      } else {
        duplicados.push({
          chave,
          atual: fluxo,
          existente: mapa.get(chave),
        });
      }
    });

    if (duplicados.length > 0) {
      console.log("[Relatorios][Quebra][Dedup] Duplicados encontrados:", {
        totalRecebido: Array.isArray(fluxos) ? fluxos.length : 0,
        totalUnicos: mapa.size,
        totalDuplicados: duplicados.length,
        chavesDuplicadas: duplicados.map((d) => d.chave),
      });
    }

    return Array.from(mapa.values());
  };

  const obterTotaisRecebimentoPorFluxos = (fluxos = []) => {
    return (Array.isArray(fluxos) ? fluxos : []).reduce(
      (acc, fluxo) => {
        const valorFisico = pickNumber(
          fluxo?.valorRetiradoFisico,
          fluxo?.valorRetiradoDinheiro,
          fluxo?.valorFisico,
        );
        const valorDigital = pickNumber(
          fluxo?.valorRetiradoDigital,
          fluxo?.valorRetiradoCartaoPix,
          fluxo?.valorDigital,
        );

        // Compatibilidade com registros antigos sem separacao fisico/digital.
        const valorTotalLegado =
          valorFisico === null && valorDigital === null
            ? pickNumber(fluxo?.valorRetirado, fluxo?.valorRetiradoTotal)
            : null;

        if (
          valorFisico !== null ||
          valorDigital !== null ||
          valorTotalLegado !== null
        ) {
          acc.temDadosFluxo = true;
        }

        acc.dinheiroFluxo += toNumber(valorFisico ?? valorTotalLegado);
        acc.cartaoPixFluxoLiquido += toNumber(valorDigital);

        return acc;
      },
      {
        dinheiroFluxo: 0,
        cartaoPixFluxoLiquido: 0,
        temDadosFluxo: false,
      },
    );
  };

  const obterValorEsperadoTotalPorFluxos = (fluxos = []) => {
    return (Array.isArray(fluxos) ? fluxos : []).reduce((acc, fluxo) => {
      const valorEsperado = pickNumber(
        fluxo?.valorEsperado,
        fluxo?.valorEsperadoCalculado,
        fluxo?.movimentacao?.valorFaturado,
      );

      return acc + toNumber(valorEsperado);
    }, 0);
  };

  const carregarFluxosCaixa = async (filtros = {}) => {
    const params = new URLSearchParams();
    const { inicio, fim, lojaId, roteiroId, usuarioId } = filtros;

    if (inicio) params.append("dataInicio", inicio);
    if (fim) params.append("dataFim", fim);
    if (lojaId) params.append("lojaId", lojaId);
    if (roteiroId) params.append("roteiroId", roteiroId);
    if (usuarioId) params.append("usuarioId", usuarioId);

    const response = await api.get(`/fluxo-caixa?${params.toString()}`);
    const fluxos = Array.isArray(response?.data)
      ? response.data
      : response?.data?.rows || response?.data?.fluxos || [];

    return deduplicarFluxosCaixa(fluxos);
  };

  const carregarQuebraCaixaPorLoja = async (
    lojaId,
    inicio,
    fim,
    usuarioId = usuarioSelecionado,
  ) => {
    try {
      const fluxos = await carregarFluxosCaixa({
        inicio,
        fim,
        lojaId,
        usuarioId,
      });

      return calcularQuebraCaixaComoCusto(fluxos, lojaId, inicio, fim);
    } catch (erroFluxo) {
      console.warn(
        `Não foi possível calcular quebra de caixa da loja ${lojaId}:`,
        erroFluxo,
      );
      return 0;
    }
  };

  const carregarQuebraCaixaRoteiro = async (
    roteiroId,
    inicio,
    fim,
    usuarioId = usuarioSelecionado,
  ) => {
    try {
      const fluxos = await carregarFluxosCaixa({
        inicio,
        fim,
        roteiroId,
        usuarioId,
      });

      return calcularQuebraCaixaComoCusto(fluxos, null, inicio, fim);
    } catch (erroFluxoRoteiro) {
      console.warn(
        `Não foi possível calcular quebra de caixa do roteiro ${roteiroId}:`,
        erroFluxoRoteiro,
      );
      return 0;
    }
  };

  const aplicarQuebraCaixaNoResumoRoteiro = (
    resumoRoteiro,
    custoQuebraCaixa = 0,
  ) => {
    if (!resumoRoteiro) return resumoRoteiro;

    const quebra = Math.max(0, toNumber(custoQuebraCaixa));
    if (quebra <= 0) return resumoRoteiro;

    const totaisAtuais = resumoRoteiro?.totais || {};
    const custoFixo = toNumber(
      totaisAtuais?.custoFixoTotal ?? totaisAtuais?.gastoFixoTotal,
    );
    const custoProdutos = toNumber(
      totaisAtuais?.custoProdutosTotal ?? totaisAtuais?.custoProdutosSairam,
    );
    const custoVariavel = toNumber(
      totaisAtuais?.custoVariavelTotal ?? totaisAtuais?.gastoVariavelTotal,
    );
    const custoTotalAtual = toNumber(
      totaisAtuais?.custoTotal ?? totaisAtuais?.gastoTotalPeriodo,
    );
    const quebraAtual = toNumber(
      totaisAtuais?.custoQuebraCaixaTotal ?? totaisAtuais?.custoQuebraCaixa,
    );

    const custoTotalSemQuebra =
      custoTotalAtual > 0
        ? Math.max(0, custoTotalAtual - quebraAtual)
        : custoFixo + custoProdutos + custoVariavel;
    const novoCustoTotal = custoTotalSemQuebra + quebra;

    const lucroBrutoBase = toNumber(
      totaisAtuais?.lucroBrutoTotal ??
        totaisAtuais?.valorBrutoConsolidadoLojaMaquinas ??
        totaisAtuais?.valorTotalLojaBruto ??
        totaisAtuais?.faturamentoBrutoTotal,
    );

    return {
      ...resumoRoteiro,
      totais: {
        ...totaisAtuais,
        custoQuebraCaixaTotal: quebra,
        custoQuebraCaixa: quebra,
        custoTotal: novoCustoTotal,
        gastoTotalPeriodo: novoCustoTotal,
        lucroLiquidoTotal: lucroBrutoBase - novoCustoTotal,
      },
    };
  };

  const aplicarQuebraCaixaNoRelatorioLoja = (
    dadosRelatorio,
    custoQuebraCaixa = 0,
  ) => {
    if (!dadosRelatorio) return dadosRelatorio;

    const quebra = Math.max(0, toNumber(custoQuebraCaixa));
    const totaisAtuais = dadosRelatorio?.totais || {};
    const gastoTotalOriginal = toNumber(totaisAtuais.gastoTotalPeriodo);
    const lucroLiquidoConsolidadoOriginal =
      totaisAtuais.valorLiquidoConsolidadoLojaMaquinas;
    const lucroLiquidoTotalOriginal = totaisAtuais.lucroLiquidoTotal;
    const custoQuebraOriginal = toNumber(
      totaisAtuais.custoQuebraCaixa ?? totaisAtuais.custoQuebraCaixaTotal,
    );
    const gastoSemQuebraOriginal = Math.max(
      0,
      gastoTotalOriginal - custoQuebraOriginal,
    );
    const novoGastoTotal = gastoSemQuebraOriginal + quebra;

    return {
      ...dadosRelatorio,
      totais: {
        ...totaisAtuais,
        custoQuebraCaixa: quebra,
        custoQuebraCaixaTotal: quebra,
        gastoTotalPeriodo: novoGastoTotal,
        ...(lucroLiquidoConsolidadoOriginal !== null &&
        lucroLiquidoConsolidadoOriginal !== undefined
          ? {
              valorLiquidoConsolidadoLojaMaquinas:
                toNumber(lucroLiquidoConsolidadoOriginal) +
                custoQuebraOriginal -
                quebra,
            }
          : {}),
        ...(lucroLiquidoTotalOriginal !== null &&
        lucroLiquidoTotalOriginal !== undefined
          ? {
              lucroLiquidoTotal:
                toNumber(lucroLiquidoTotalOriginal) +
                custoQuebraOriginal -
                quebra,
            }
          : {}),
      },
    };
  };

  const formatarMoeda = (valor) =>
    Number(valor || 0).toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const renderTabelaProdutosSaidos = ({
    resumoProdutos,
    contexto = "consolidado",
    exibirConferencia = true,
  }) => {
    if (!resumoProdutos) return null;

    if (resumoProdutos.itens.length === 0) {
      if (resumoProdutos.totalQuantidadeDeclarado > 0) {
        return (
          <div className="text-center py-8 bg-white rounded-lg border border-amber-300">
            <p className="text-4xl mb-2">📦</p>
            <p className="text-gray-700 font-medium">
              Totais indicam saída (
              {resumoProdutos.totalQuantidadeDeclarado.toLocaleString("pt-BR")}
              ), mas produtosSairam[] não veio no payload.
            </p>
          </div>
        );
      }

      return (
        <div className="text-center py-8 bg-white rounded-lg">
          <p className="text-4xl mb-2">📭</p>
          <p className="text-gray-600">Nenhum produto saiu</p>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {resumoProdutos.quantidadeItensSemDetalhe > 0 && (
          <div className="bg-amber-100 border border-amber-300 text-amber-900 text-xs rounded-lg px-3 py-2">
            Aviso: há item(ns) legado sem detalhamento histórico em {contexto}.
          </div>
        )}

        <div className="overflow-x-auto bg-white rounded-lg border border-red-200">
          <table className="min-w-full text-sm">
            <thead className="bg-red-50 text-red-800">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Nome</th>
                <th className="px-3 py-2 text-left font-semibold">Código</th>
                <th className="px-3 py-2 text-right font-semibold">
                  Quantidade
                </th>
                <th className="px-3 py-2 text-right font-semibold">
                  Valor unitário
                </th>
                <th className="px-3 py-2 text-right font-semibold">
                  Valor total
                </th>
              </tr>
            </thead>
            <tbody>
              {resumoProdutos.itens
                .sort((a, b) => b.quantidade - a.quantidade)
                .map((produto) => {
                  const chaveLinha =
                    produto.produtoNaMaquinaId ||
                    produto.produtoId ||
                    `${produto.nome}-${produto.codigo || "sem-codigo"}`;

                  return (
                    <tr key={chaveLinha} className="border-t border-red-100">
                      <td className="px-3 py-2 text-gray-900">
                        <div className="font-semibold">{produto.nome}</div>
                        {produto.produtoId === "__SEM_DETALHE__" && (
                          <div className="text-xs text-amber-800">
                            Sem detalhamento histórico deste item.
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-gray-700 font-mono">
                        {produto.codigo || "S/C"}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-800 font-semibold">
                        {Number(produto.quantidade || 0).toLocaleString(
                          "pt-BR",
                        )}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-800">
                        R$ {formatarMoeda(produto.valorUnitario || 0)}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-900 font-bold">
                        R$ {formatarMoeda(produto.valorTotal || 0)}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        {exibirConferencia && resumoProdutos.divergenciaQuantidade && (
          <p className="text-xs text-amber-700 mt-2">
            Divergência: soma das quantidades (
            {resumoProdutos.totalQuantidadeItens.toLocaleString("pt-BR")})
            diferente de totais.produtosSairam (
            {resumoProdutos.totalQuantidadeDeclarado.toLocaleString("pt-BR")}).
          </p>
        )}
        {exibirConferencia && resumoProdutos.divergenciaCusto && (
          <p className="text-xs text-amber-700">
            Divergência: soma de valorTotal (R${" "}
            {formatarMoeda(resumoProdutos.custoTotalItens)}) diferente de
            totais.custoProdutosSairam (R${" "}
            {formatarMoeda(resumoProdutos.custoTotalDeclarado)}).
          </p>
        )}
      </div>
    );
  };

  const formatarPercentualComparacao = (valor) =>
    Number(valor || 0).toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const formatarDataExibicao = (dataTexto) => {
    const [ano, mes, dia] = String(dataTexto || "").split("-");
    if (!ano || !mes || !dia) return dataTexto || "-";
    return `${dia}/${mes}/${ano}`;
  };

  const obterClassesStatusComparacao = (status) => {
    if (status === "melhor")
      return {
        card: "bg-emerald-50 border-emerald-300",
        texto: "text-emerald-700",
        icone: "▲",
      };
    if (status === "pior")
      return {
        card: "bg-red-50 border-red-300",
        texto: "text-red-700",
        icone: "▼",
      };
    return {
      card: "bg-slate-50 border-slate-300",
      texto: "text-slate-700",
      icone: "●",
    };
  };

  const montarIndicadorComparacao = (
    valorAtual,
    valorAnterior,
    melhorQuando = "maior",
  ) => {
    const atual = toNumber(valorAtual);
    const anterior = toNumber(valorAnterior);
    const diferenca = atual - anterior;

    let percentual = 0;
    if (Math.abs(anterior) > 0.0001) {
      percentual = (diferenca / Math.abs(anterior)) * 100;
    } else if (Math.abs(atual) > 0.0001) {
      percentual = 100;
    }

    const direcao =
      diferenca > 0.0001 ? "acima" : diferenca < -0.0001 ? "abaixo" : "igual";

    let status = "igual";
    if (direcao !== "igual") {
      if (melhorQuando === "menor") {
        status = diferenca < 0 ? "melhor" : "pior";
      } else {
        status = diferenca > 0 ? "melhor" : "pior";
      }
    }

    return {
      atual,
      anterior,
      diferenca,
      percentual,
      direcao,
      status,
    };
  };

  const construirConsolidadoManualPorLojas = async (
    idsLojasSelecionadas = [],
    periodoInicio,
    periodoFim,
    usuarioId = usuarioSelecionado,
  ) => {
    const idsNormalizados = Array.from(
      new Set((idsLojasSelecionadas || []).map((idLoja) => String(idLoja))),
    );

    const lojasSelecionadas = (Array.isArray(lojas) ? lojas : []).filter(
      (loja) => idsNormalizados.includes(String(loja?.id)),
    );

    const lojaNomePorId = new Map(
      lojasSelecionadas.map((loja) => [
        String(loja.id),
        loja.nome || `Loja ${loja.id}`,
      ]),
    );

    const consolidadoBaseVazio = {
      tipo: "todas-lojas",
      periodo: {
        inicio: periodoInicio,
        fim: periodoFim,
      },
      lojasComDados: 0,
      lojasResumo: [],
      lojasSemDados: lojasSelecionadas
        .map((loja) => loja?.nome)
        .filter(Boolean),
      totais: {
        lucroBrutoTotal: 0,
        lucroLiquidoTotal: 0,
        valorEsperadoTotal: 0,
        custoTotal: 0,
        custoVariavelTotal: 0,
        custoFixoTotal: 0,
        custoProdutosTotal: 0,
        produtosSairamTotal: 0,
        produtosEntraramTotal: 0,
        fichasTotal: 0,
        dinheiroTotal: 0,
        cartaoPixTotal: 0,
        cartaoPixLiquidoTotal: 0,
        taxaDeCartaoTotal: 0,
        percentualTaxaCartaoMediaTotal: 0,
        faturamentoBrutoTicketTotal: 0,
        saidasPremioTotal: 0,
        ticketPorPremioConsolidado: 0,
      },
      destaques: {
        lojaMaiorLucro: null,
        lojaMaiorGasto: null,
        lojaMaiorParticipacao: null,
        produtoMaisSaiu: null,
      },
      graficos: {
        rankingLucroBrutoLojas: [],
        rankingLucroLojas: [],
        rankingGastoLojas: [],
        participacaoLojas: [],
        rankingTicketPremioLojas: [],
        rankingProdutos: [],
        gastosFixosPorLoja: [],
      },
    };

    if (!idsNormalizados.length) {
      return consolidadoBaseVazio;
    }

    const respostasPorLoja = await Promise.all(
      idsNormalizados.map(async (lojaId) => {
        const nomeFallback = lojaNomePorId.get(lojaId) || `Loja ${lojaId}`;

        try {
          const [relatorioResponse, gastosFixosResponse, fluxosLoja] =
            await Promise.all([
              api
                .get("/relatorios/impressao", {
                  params: montarParamsComUsuario(
                    {
                      lojaId,
                      dataInicio: periodoInicio,
                      dataFim: periodoFim,
                    },
                    usuarioId,
                  ),
                })
                .catch(() => null),
              api
                .get(`/gastos-fixos-loja/${lojaId}`)
                .catch(() => ({ data: [] })),
              carregarFluxosCaixa({
                inicio: periodoInicio,
                fim: periodoFim,
                lojaId,
                usuarioId,
              }).catch(() => []),
            ]);

          const dadosLoja = relatorioResponse?.data;
          if (!dadosLoja) {
            return {
              lojaId,
              lojaNome: nomeFallback,
              semDados: true,
            };
          }

          const lojaNome = dadosLoja?.loja?.nome || nomeFallback;
          const fluxosDaLoja = filtrarFluxosPorLoja(fluxosLoja, lojaId);
          const custoQuebraCaixa = calcularQuebraCaixaComoCusto(
            fluxosDaLoja,
            lojaId,
            periodoInicio,
            periodoFim,
          );

          const recebimentoFluxo = obterTotaisRecebimentoPorFluxos(fluxosDaLoja);
          const valorEsperadoFluxo =
            obterValorEsperadoTotalPorFluxos(fluxosDaLoja);
          const fluxoFallback = obterTotaisFluxoCaixaRelatorio(dadosLoja);
          const fluxo = {
            ...fluxoFallback,
            dinheiroFluxo:
              recebimentoFluxo.temDadosFluxo
                ? recebimentoFluxo.dinheiroFluxo
                : fluxoFallback.dinheiroFluxo,
            cartaoPixFluxoLiquido:
              recebimentoFluxo.temDadosFluxo
                ? recebimentoFluxo.cartaoPixFluxoLiquido
                : fluxoFallback.cartaoPixFluxoLiquido,
            // No consolidado manual o cartao/pix exibido deve refletir o valor digital conferido no fluxo.
            cartaoPixFluxoBruto:
              recebimentoFluxo.temDadosFluxo
                ? recebimentoFluxo.cartaoPixFluxoLiquido
                : fluxoFallback.cartaoPixFluxoBruto,
          };
          const lucroBruto = calcularValorConsolidadoRelatorio(dadosLoja);

          const gastosFixosLista = extrairListaGastosFixos(
            gastosFixosResponse?.data,
          );
          const custoFixoMensal = gastosFixosLista.reduce(
            (acc, item) => acc + toNumber(item?.valor),
            0,
          );
          const custoFixo = calcularCustoFixoProporcionalPeriodo(
            custoFixoMensal,
            periodoInicio,
            periodoFim,
          );

          const produtosSairamDireto = Array.isArray(dadosLoja?.produtosSairam)
            ? dadosLoja.produtosSairam
            : [];
          const produtosSairamPorMaquina = Array.isArray(dadosLoja?.maquinas)
            ? dadosLoja.maquinas.flatMap((maquina) =>
                Array.isArray(maquina?.produtosSairam)
                  ? maquina.produtosSairam
                  : [],
              )
            : [];

          const produtosSairamLista =
            produtosSairamDireto.length > 0
              ? produtosSairamDireto
              : produtosSairamPorMaquina;
          const resumoProdutosSairam = calcularResumoProdutos(
            produtosSairamLista,
            dadosLoja?.totais,
          );
          const custoProdutos = resumoProdutosSairam.custoTotalItens;
          // Regra de negócio local: custo da loja vem apenas de
          // gastos fixos cadastrados na loja + custo dos produtos que saíram.
          const custoBase = custoProdutos + custoFixo;
          const custoTotal = custoBase + toNumber(custoQuebraCaixa);
          const lucroLiquido = lucroBruto - custoTotal;
          const custoVariavel = Math.max(
            0,
            custoTotal - custoProdutos - custoFixo,
          );
          const fichas = toNumber(dadosLoja?.totais?.fichas);
          const produtosSairam = resumoProdutosSairam.totalQuantidadeItens;
          const produtosEntraram = toNumber(
            dadosLoja?.totais?.produtosEntraram,
          );

          const faturamentoBrutoTicket =
            toNumber(dadosLoja?.totais?.faturamentoBrutoTicketTotal) ||
            toNumber(dadosLoja?.totais?.valorTotalLojaBruto) ||
            lucroBruto;
          const saidasPremio =
            toNumber(dadosLoja?.totais?.saidasPremioTotal) || produtosSairam;
          const ticketPorPremio =
            toNumber(dadosLoja?.totais?.ticketPorPremioTotal) ||
            (saidasPremio > 0 ? faturamentoBrutoTicket / saidasPremio : 0);

          const taxaDeCartao = Math.max(
            0,
            toNumber(fluxo.cartaoPixFluxoBruto) -
              toNumber(fluxo.cartaoPixFluxoLiquido),
          );

          return {
            lojaId,
            lojaNome,
            semDados: false,
            fluxo,
            lucroBruto,
            lucroLiquido,
            custoTotal,
            custoVariavel,
            custoProdutos,
            custoFixo,
            custoFixoMensal,
            custoQuebraCaixa: toNumber(custoQuebraCaixa),
            valorEsperadoFluxo,
            fichas,
            produtosSairam,
            produtosEntraram,
            faturamentoBrutoTicket,
            saidasPremio,
            ticketPorPremio,
            taxaDeCartao,
            produtosSairamLista,
          };
        } catch (erroLoja) {
          console.warn(
            `Não foi possível consolidar dados da loja ${lojaId}:`,
            erroLoja,
          );

          return {
            lojaId,
            lojaNome: nomeFallback,
            semDados: true,
          };
        }
      }),
    );

    const lojasComDadosDetalhado = respostasPorLoja.filter(
      (item) => !item?.semDados,
    );

    if (!lojasComDadosDetalhado.length) {
      return consolidadoBaseVazio;
    }

    const rankingLucroBrutoLojas = lojasComDadosDetalhado
      .map((item) => ({
        lojaId: item.lojaId,
        lojaNome: item.lojaNome,
        lucroBruto: toNumber(item.lucroBruto),
      }))
      .sort((a, b) => toNumber(b.lucroBruto) - toNumber(a.lucroBruto));

    const lucroBrutoTotal = rankingLucroBrutoLojas.reduce(
      (acc, item) => acc + toNumber(item.lucroBruto),
      0,
    );

    const participacaoLojas = rankingLucroBrutoLojas.map((item) => ({
      lojaId: item.lojaId,
      lojaNome: item.lojaNome,
      participacaoLucroBruto:
        lucroBrutoTotal > 0
          ? (toNumber(item.lucroBruto) / lucroBrutoTotal) * 100
          : 0,
    }));

    const rankingLucroLojas = lojasComDadosDetalhado
      .map((item) => ({
        lojaId: item.lojaId,
        lojaNome: item.lojaNome,
        lucroLiquido: toNumber(item.lucroLiquido),
      }))
      .sort((a, b) => toNumber(b.lucroLiquido) - toNumber(a.lucroLiquido));

    const rankingGastoLojas = lojasComDadosDetalhado
      .map((item) => ({
        lojaId: item.lojaId,
        lojaNome: item.lojaNome,
        custoTotal: toNumber(item.custoTotal),
      }))
      .sort((a, b) => toNumber(b.custoTotal) - toNumber(a.custoTotal));

    const rankingTicketPremioLojas = lojasComDadosDetalhado
      .map((item) => ({
        lojaId: item.lojaId,
        lojaNome: item.lojaNome,
        ticketPorPremio: toNumber(item.ticketPorPremio),
        saidasPremio: toNumber(item.saidasPremio),
        faturamentoBrutoTicket: toNumber(item.faturamentoBrutoTicket),
      }))
      .sort(
        (a, b) => toNumber(b.ticketPorPremio) - toNumber(a.ticketPorPremio),
      );

    const gastosFixosPorLoja = lojasComDadosDetalhado
      .map((item) => ({
        lojaId: item.lojaId,
        lojaNome: item.lojaNome,
        custoFixo: toNumber(item.custoFixo),
      }))
      .sort((a, b) => toNumber(b.custoFixo) - toNumber(a.custoFixo));

    const mapaProdutos = new Map();

    lojasComDadosDetalhado.forEach((item) => {
      const resumoProdutosItem = calcularResumoProdutos(
        item.produtosSairamLista || [],
      );

      resumoProdutosItem.itens.forEach((produto) => {
        const chaveProduto =
          produto?.produtoId !== undefined && produto?.produtoId !== null
            ? `id:${produto.produtoId}`
            : `nome:${normalizarTexto(produto?.nome)}`;

        if (!chaveProduto || chaveProduto === "nome:") return;

        const atual = mapaProdutos.get(chaveProduto) || {
          id: produto?.produtoId,
          nome: produto?.nome || "Produto",
          emoji: produto?.emoji || "📦",
          codigo: produto?.codigo,
          quantidade: 0,
        };

        atual.quantidade += toNumber(produto?.quantidade);
        mapaProdutos.set(chaveProduto, atual);
      });
    });

    const rankingProdutos = Array.from(mapaProdutos.values()).sort(
      (a, b) => toNumber(b.quantidade) - toNumber(a.quantidade),
    );

    const dinheiroTotal = lojasComDadosDetalhado.reduce(
      (acc, item) => acc + toNumber(item?.fluxo?.dinheiroFluxo),
      0,
    );
    const cartaoPixTotal = lojasComDadosDetalhado.reduce(
      (acc, item) => acc + toNumber(item?.fluxo?.cartaoPixFluxoBruto),
      0,
    );
    const cartaoPixLiquidoTotal = lojasComDadosDetalhado.reduce(
      (acc, item) => acc + toNumber(item?.fluxo?.cartaoPixFluxoLiquido),
      0,
    );
    const taxaDeCartaoTotal = lojasComDadosDetalhado.reduce(
      (acc, item) => acc + toNumber(item?.taxaDeCartao),
      0,
    );

    const lucroLiquidoTotal = rankingLucroLojas.reduce(
      (acc, item) => acc + toNumber(item?.lucroLiquido),
      0,
    );
    const valorEsperadoTotal = lojasComDadosDetalhado.reduce(
      (acc, item) => acc + toNumber(item?.valorEsperadoFluxo),
      0,
    );
    const custoTotal = rankingGastoLojas.reduce(
      (acc, item) => acc + toNumber(item?.custoTotal),
      0,
    );
    const custoVariavelTotal = lojasComDadosDetalhado.reduce(
      (acc, item) => acc + toNumber(item?.custoVariavel),
      0,
    );
    const custoFixoTotal = gastosFixosPorLoja.reduce(
      (acc, item) => acc + toNumber(item?.custoFixo),
      0,
    );
    const custoQuebraCaixaTotal = lojasComDadosDetalhado.reduce(
      (acc, item) => acc + toNumber(item?.custoQuebraCaixa),
      0,
    );
    const custoProdutosTotal = lojasComDadosDetalhado.reduce(
      (acc, item) => acc + toNumber(item?.custoProdutos),
      0,
    );
    const produtosSairamTotal = lojasComDadosDetalhado.reduce(
      (acc, item) => acc + toNumber(item?.produtosSairam),
      0,
    );
    const produtosEntraramTotal = lojasComDadosDetalhado.reduce(
      (acc, item) => acc + toNumber(item?.produtosEntraram),
      0,
    );
    const fichasTotal = lojasComDadosDetalhado.reduce(
      (acc, item) => acc + toNumber(item?.fichas),
      0,
    );
    const faturamentoBrutoTicketTotal = lojasComDadosDetalhado.reduce(
      (acc, item) => acc + toNumber(item?.faturamentoBrutoTicket),
      0,
    );
    const saidasPremioTotal = lojasComDadosDetalhado.reduce(
      (acc, item) => acc + toNumber(item?.saidasPremio),
      0,
    );
    const ticketPorPremioConsolidado =
      saidasPremioTotal > 0
        ? faturamentoBrutoTicketTotal / saidasPremioTotal
        : 0;
    const percentualTaxaCartaoMediaTotal =
      cartaoPixTotal > 0 ? (taxaDeCartaoTotal / cartaoPixTotal) * 100 : 0;

    const nomesLojasComDados = new Set(
      lojasComDadosDetalhado.map((item) => item?.lojaNome).filter(Boolean),
    );

    const lojasSemDados = lojasSelecionadas
      .map((loja) => loja?.nome)
      .filter((nome) => nome && !nomesLojasComDados.has(nome));

    const produtoMaisSaiu = rankingProdutos[0]
      ? {
          nome: rankingProdutos[0]?.nome || "-",
          emoji: rankingProdutos[0]?.emoji || "📦",
          quantidade: toNumber(rankingProdutos[0]?.quantidade),
        }
      : null;

    return {
      tipo: "todas-lojas",
      periodo: {
        inicio: periodoInicio,
        fim: periodoFim,
      },
      lojasComDados: lojasComDadosDetalhado.length,
      lojasResumo: lojasComDadosDetalhado.map((item) => ({
        lojaId: item?.lojaId,
        lojaNome: item?.lojaNome,
        lucroBruto: toNumber(item?.lucroBruto),
        lucroLiquido: toNumber(item?.lucroLiquido),
        valorEsperado: toNumber(item?.valorEsperadoFluxo),
        custoTotal: toNumber(item?.custoTotal),
        produtosSairam: toNumber(item?.produtosSairam),
      })),
      lojasSemDados,
      totais: {
        lucroBrutoTotal,
        lucroLiquidoTotal,
        valorEsperadoTotal,
        custoTotal,
        custoVariavelTotal,
        custoFixoTotal,
        custoQuebraCaixaTotal,
        custoProdutosTotal,
        produtosSairamTotal,
        produtosEntraramTotal,
        fichasTotal,
        dinheiroTotal,
        cartaoPixTotal,
        cartaoPixLiquidoTotal,
        taxaDeCartaoTotal,
        percentualTaxaCartaoMediaTotal,
        faturamentoBrutoTicketTotal,
        saidasPremioTotal,
        ticketPorPremioConsolidado,
      },
      destaques: {
        lojaMaiorLucro: rankingLucroLojas[0]
          ? {
              lojaNome: rankingLucroLojas[0]?.lojaNome || "-",
              lucroLiquido: toNumber(rankingLucroLojas[0]?.lucroLiquido),
            }
          : null,
        lojaMaiorGasto: rankingGastoLojas[0]
          ? {
              lojaNome: rankingGastoLojas[0]?.lojaNome || "-",
              custoTotal: toNumber(rankingGastoLojas[0]?.custoTotal),
            }
          : null,
        lojaMaiorParticipacao: participacaoLojas[0]
          ? {
              lojaNome: participacaoLojas[0]?.lojaNome || "-",
              participacaoLucroBruto: toNumber(
                participacaoLojas[0]?.participacaoLucroBruto,
              ),
            }
          : null,
        produtoMaisSaiu,
      },
      graficos: {
        rankingLucroBrutoLojas,
        rankingLucroLojas,
        rankingGastoLojas,
        participacaoLojas,
        rankingTicketPremioLojas,
        rankingProdutos,
        gastosFixosPorLoja,
      },
    };
  };

  const gerarRelatorio = async () => {
    if (!dataInicio || !dataFim) {
      setError("Por favor, preencha todos os campos obrigatórios");
      return;
    }

    if (!lojaSelecionada && !roteiroSelecionado) {
      setError("Selecione um ponto (ou roteiro) para gerar o relatório");
      return;
    }

    if (
      lojaSelecionada === SELECAO_MANUAL_LOJAS_VALUE &&
      lojasSelecionadasConsolidado.length === 0
    ) {
      setError("Selecione pelo menos um ponto para gerar o consolidado manual");
      return;
    }

    const inicio = new Date(dataInicio);
    const fim = new Date(dataFim);
    if (fim < inicio) {
      setError("A data final não pode ser anterior à data inicial");
      return;
    }
    try {
      setLoading(true);
      setError("");
      setRelatorio(null);
      setDashboard(null);
      setComissaoData(null);
      setLucroData(null);
      setMovimentacoesData(null);
      setAbaTicketPremio("loja");
      setGastosFixosLoja([]);
      setComparativoMensal(null);

      const consolidadoManual = lojaSelecionada === SELECAO_MANUAL_LOJAS_VALUE;
      const consolidadoTodas = lojaSelecionada === TODAS_LOJAS_VALUE;
      const usuarioFiltroId = usuarioSelecionado || "";
      const filtroUsuarioRelatorio =
        montarFiltroUsuarioRelatorio(usuarioFiltroId);

      if (consolidadoManual) {
        const relatorioTodasLojas = await construirConsolidadoManualPorLojas(
          lojasSelecionadasConsolidado,
          dataInicio,
          dataFim,
          usuarioFiltroId,
        );

        let comparativoMensal = null;
        try {
          const dataInicioMesAnterior = obterMesmoDiaNoMesAnterior(dataInicio);
          const dataFimMesAnterior = obterMesmoDiaNoMesAnterior(dataFim);

          const relatorioMesAnterior = await construirConsolidadoManualPorLojas(
            lojasSelecionadasConsolidado,
            dataInicioMesAnterior,
            dataFimMesAnterior,
            usuarioFiltroId,
          );

          const totaisAtual = relatorioTodasLojas?.totais || {};
          const totaisAnterior = relatorioMesAnterior?.totais || {};

          const valorConsolidadoAtual =
            toNumber(totaisAtual.lucroBrutoTotal) ||
            toNumber(totaisAtual.dinheiroTotal) +
              toNumber(totaisAtual.cartaoPixTotal);

          const valorConsolidadoAnterior =
            toNumber(totaisAnterior.lucroBrutoTotal) ||
            toNumber(totaisAnterior.dinheiroTotal) +
              toNumber(totaisAnterior.cartaoPixTotal);

          comparativoMensal = {
            periodoAtual: {
              inicio: dataInicio,
              fim: dataFim,
            },
            periodoAnterior: {
              inicio: dataInicioMesAnterior,
              fim: dataFimMesAnterior,
            },
            metricas: [
              {
                chave: "lucroLiquidoTotal",
                titulo: "Lucro Líquido Total",
                icone: "📉",
                indicador: montarIndicadorComparacao(
                  toNumber(totaisAtual.lucroLiquidoTotal),
                  toNumber(totaisAnterior.lucroLiquidoTotal),
                  "maior",
                ),
              },
              {
                chave: "valorFichasTotal",
                titulo: "Valor das Fichas (Estimado)",
                icone: "🎟️",
                observacao:
                  "Estimado com valor médio de R$ 2,50 por ficha no consolidado.",
                indicador: montarIndicadorComparacao(
                  toNumber(totaisAtual.fichasTotal) * 2.5,
                  toNumber(totaisAnterior.fichasTotal) * 2.5,
                  "maior",
                ),
              },
              {
                chave: "valorConsolidado",
                titulo: "Valor Consolidado",
                icone: "💰",
                indicador: montarIndicadorComparacao(
                  valorConsolidadoAtual,
                  valorConsolidadoAnterior,
                  "maior",
                ),
              },
              {
                chave: "custoSaidaProdutos",
                titulo: "Custo de Saída dos Produtos",
                icone: "💸",
                indicador: montarIndicadorComparacao(
                  toNumber(totaisAtual.custoProdutosTotal),
                  toNumber(totaisAnterior.custoProdutosTotal),
                  "menor",
                ),
              },
            ],
          };
        } catch (erroComparativoTodasLojas) {
          console.warn(
            "Não foi possível gerar comparativo das lojas selecionadas com o mês passado:",
            erroComparativoTodasLojas,
          );
        }

        setRelatorio({
          ...aplicarFiltroUsuarioAoRelatorio(
            relatorioTodasLojas,
            filtroUsuarioRelatorio,
          ),
          comparativoMensal,
        });
      } else if (consolidadoTodas) {
        const idsTodasLojas = (Array.isArray(lojas) ? lojas : [])
          .map((loja) => String(loja?.id || "").trim())
          .filter(Boolean);

        const relatorioTodasLojas = await construirConsolidadoManualPorLojas(
          idsTodasLojas,
          dataInicio,
          dataFim,
          usuarioFiltroId,
        );

        let comparativoMensal = null;
        try {
          const dataInicioMesAnterior = obterMesmoDiaNoMesAnterior(dataInicio);
          const dataFimMesAnterior = obterMesmoDiaNoMesAnterior(dataFim);

          const relatorioMesAnterior = await construirConsolidadoManualPorLojas(
            idsTodasLojas,
            dataInicioMesAnterior,
            dataFimMesAnterior,
            usuarioFiltroId,
          );

          const totaisAtual = relatorioTodasLojas?.totais || {};
          const totaisAnterior = relatorioMesAnterior?.totais || {};

          const valorConsolidadoAtual =
            toNumber(totaisAtual.lucroBrutoTotal) ||
            toNumber(totaisAtual.dinheiroTotal) +
              toNumber(totaisAtual.cartaoPixTotal);

          const valorConsolidadoAnterior =
            toNumber(totaisAnterior.lucroBrutoTotal) ||
            toNumber(totaisAnterior.dinheiroTotal) +
              toNumber(totaisAnterior.cartaoPixTotal);

          comparativoMensal = {
            periodoAtual: {
              inicio: dataInicio,
              fim: dataFim,
            },
            periodoAnterior: {
              inicio: dataInicioMesAnterior,
              fim: dataFimMesAnterior,
            },
            metricas: [
              {
                chave: "lucroLiquidoTotal",
                titulo: "Lucro Líquido Total",
                icone: "📉",
                indicador: montarIndicadorComparacao(
                  toNumber(totaisAtual.lucroLiquidoTotal),
                  toNumber(totaisAnterior.lucroLiquidoTotal),
                  "maior",
                ),
              },
              {
                chave: "valorFichasTotal",
                titulo: "Valor das Fichas (Estimado)",
                icone: "🎟️",
                observacao:
                  "Estimado com valor médio de R$ 2,50 por ficha no consolidado.",
                indicador: montarIndicadorComparacao(
                  toNumber(totaisAtual.fichasTotal) * 2.5,
                  toNumber(totaisAnterior.fichasTotal) * 2.5,
                  "maior",
                ),
              },
              {
                chave: "valorConsolidado",
                titulo: "Valor Consolidado",
                icone: "💰",
                indicador: montarIndicadorComparacao(
                  valorConsolidadoAtual,
                  valorConsolidadoAnterior,
                  "maior",
                ),
              },
              {
                chave: "custoSaidaProdutos",
                titulo: "Custo de Saída dos Produtos",
                icone: "💸",
                indicador: montarIndicadorComparacao(
                  toNumber(totaisAtual.custoProdutosTotal),
                  toNumber(totaisAnterior.custoProdutosTotal),
                  "menor",
                ),
              },
            ],
          };
        } catch (erroComparativoTodasLojas) {
          console.warn(
            "Não foi possível gerar comparativo de todas as lojas com o mês passado:",
            erroComparativoTodasLojas,
          );
        }

        setRelatorio({
          ...aplicarFiltroUsuarioAoRelatorio(
            relatorioTodasLojas,
            filtroUsuarioRelatorio,
          ),
          comparativoMensal,
        });
      } else if (roteiroSelecionado) {
        // Buscar relatório de roteiro inteiro
        const [response, custoQuebraCaixaRoteiroFluxo] = await Promise.all([
          api.get("/relatorios/roteiro", {
            params: montarParamsComUsuario(
              { roteiroId: roteiroSelecionado, dataInicio, dataFim },
              usuarioFiltroId,
            ),
          }),
          carregarQuebraCaixaRoteiro(
            roteiroSelecionado,
            dataInicio,
            dataFim,
            usuarioFiltroId,
          ),
        ]);
        const dadosRoteiro = response.data || {};
        const resumoRoteiroBackend =
          dadosRoteiro?.resumoRoteiroConsolidado ||
          dadosRoteiro?.resumoConsolidadoRoteiro ||
          null;
        const roteiroSelecionadoMeta = (
          Array.isArray(roteiros) ? roteiros : []
        ).find((r) => String(r?.id) === String(roteiroSelecionado));

        const nomesLojasRoteiro = new Set(
          [
            ...(Array.isArray(dadosRoteiro?.lojas) ? dadosRoteiro.lojas : []),
            ...(Array.isArray(roteiroSelecionadoMeta?.lojas)
              ? roteiroSelecionadoMeta.lojas
              : []),
          ]
            .map((loja) =>
              normalizarTexto(
                loja?.nome || loja?.lojaNome || loja?.loja?.nome || "",
              ),
            )
            .filter(Boolean),
        );

        const idsLojasRoteiro = Array.from(
          new Set(
            [
              ...(Array.isArray(dadosRoteiro?.lojas) ? dadosRoteiro.lojas : []),
              ...(Array.isArray(dadosRoteiro?.maquinas)
                ? dadosRoteiro.maquinas.map(
                    (maquina) => maquina?.loja || { id: maquina?.lojaId },
                  )
                : []),
              ...(Array.isArray(roteiroSelecionadoMeta?.lojas)
                ? roteiroSelecionadoMeta.lojas
                : []),
              ...(Array.isArray(roteiroSelecionadoMeta?.pontos)
                ? roteiroSelecionadoMeta.pontos
                : []),
              ...(Array.isArray(roteiroSelecionadoMeta?.lojaIds)
                ? roteiroSelecionadoMeta.lojaIds.map((id) => ({ id }))
                : []),
            ]
              .map((loja) =>
                String(loja?.id ?? loja?.lojaId ?? loja?.loja?.id ?? "").trim(),
              )
              .filter(Boolean),
          ),
        );

        if (idsLojasRoteiro.length === 0 && nomesLojasRoteiro.size > 0) {
          const idsPorNome = (Array.isArray(lojas) ? lojas : [])
            .filter((loja) =>
              nomesLojasRoteiro.has(normalizarTexto(loja?.nome)),
            )
            .map((loja) => String(loja?.id))
            .filter(Boolean);

          idsLojasRoteiro.push(...idsPorNome);
        }

        let custoQuebraCaixaRoteiroPorLojas = 0;
        if (idsLojasRoteiro.length > 0) {
          const fluxosPorLoja = await Promise.all(
            idsLojasRoteiro.map((lojaId) =>
              carregarFluxosCaixa({
                lojaId,
                roteiroId: roteiroSelecionado,
                inicio: dataInicio,
                fim: dataFim,
                usuarioId: usuarioFiltroId,
              }).catch(() => []),
            ),
          );

          const resumoFluxosPorLoja = idsLojasRoteiro.map((lojaId, idx) => {
            const fluxosLoja = Array.isArray(fluxosPorLoja[idx])
              ? fluxosPorLoja[idx]
              : [];
            const quebraLoja = calcularQuebraCaixaComoCusto(
              fluxosLoja,
              lojaId,
              dataInicio,
              dataFim,
            );

            return {
              lojaId,
              totalFluxos: fluxosLoja.length,
              quebraLoja,
              idsFluxos: fluxosLoja.map((f) =>
                String(f?.id ?? f?.movimentacaoId ?? f?.movimentacao?.id ?? ""),
              ),
            };
          });

          const fluxosUnicosRoteiro = deduplicarFluxosCaixa(
            fluxosPorLoja.flat(),
          );
          custoQuebraCaixaRoteiroPorLojas = calcularQuebraCaixaComoCusto(
            fluxosUnicosRoteiro,
            null,
            dataInicio,
            dataFim,
          );

          console.log("[Relatorios][Quebra][Roteiro] Consolidação por lojas:", {
            roteiroId: roteiroSelecionado,
            periodo: { inicio: dataInicio, fim: dataFim },
            idsLojasRoteiro,
            porLoja: resumoFluxosPorLoja,
            totalFluxosSomadosSemDedup: fluxosPorLoja.flat().length,
            totalFluxosUnicosAposDedup: fluxosUnicosRoteiro.length,
            quebraTotalAposDedup: custoQuebraCaixaRoteiroPorLojas,
          });
        }

        let resumoRoteiroConsolidado = resumoRoteiroBackend;
        let resumoRoteiroCalculado = null;
        if (idsLojasRoteiro.length > 0) {
          try {
            resumoRoteiroCalculado = await construirConsolidadoManualPorLojas(
              idsLojasRoteiro,
              dataInicio,
              dataFim,
              usuarioFiltroId,
            );

            resumoRoteiroConsolidado = resumoRoteiroConsolidado
              ? {
                  ...resumoRoteiroConsolidado,
                  ...resumoRoteiroCalculado,
                  totais: {
                    ...(resumoRoteiroBackend?.totais || {}),
                    ...(resumoRoteiroCalculado?.totais || {}),
                  },
                  graficos: {
                    ...(resumoRoteiroBackend?.graficos || {}),
                    ...(resumoRoteiroCalculado?.graficos || {}),
                  },
                }
              : resumoRoteiroCalculado;
          } catch (erroResumoRota) {
            console.warn(
              "Não foi possível consolidar custos e resultados do roteiro:",
              erroResumoRota,
            );
          }
        }

        const quebraAtualResumoRoteiro = toNumber(
          pickNumber(
            resumoRoteiroConsolidado?.totais?.custoQuebraCaixaTotal,
            resumoRoteiroConsolidado?.totais?.custoQuebraCaixa,
          ) || 0,
        );

        const quebraCalculadaPorLojas = toNumber(
          custoQuebraCaixaRoteiroPorLojas,
        );
        const quebraCalculadaPorFluxo = toNumber(custoQuebraCaixaRoteiroFluxo);

        // Prioriza cálculos deduplicados no frontend; usa resumo backend apenas como fallback.
        const quebraConfiavelRoteiro =
          quebraCalculadaPorLojas > 0
            ? quebraCalculadaPorLojas
            : quebraCalculadaPorFluxo > 0
              ? quebraCalculadaPorFluxo
              : quebraAtualResumoRoteiro;

        if (
          quebraAtualResumoRoteiro > 0 &&
          quebraConfiavelRoteiro > 0 &&
          Math.abs(quebraAtualResumoRoteiro - quebraConfiavelRoteiro) > 0.01
        ) {
          console.warn(
            "[Relatorios][Quebra][Roteiro] Resumo backend divergente; usando valor deduplicado.",
            {
              roteiroId: roteiroSelecionado,
              quebraResumoBackend: quebraAtualResumoRoteiro,
              quebraDeduplicadaEscolhida: quebraConfiavelRoteiro,
            },
          );
        }

        console.log("[Relatorios][Quebra][Roteiro] Escolha da quebra:", {
          roteiroId: roteiroSelecionado,
          quebraAtualResumoRoteiro,
          custoQuebraCaixaRoteiroPorLojas,
          custoQuebraCaixaRoteiroFluxo,
          quebraConfiavelRoteiro,
        });

        if (toNumber(quebraConfiavelRoteiro) > 0 && resumoRoteiroConsolidado) {
          resumoRoteiroConsolidado = aplicarQuebraCaixaNoResumoRoteiro(
            resumoRoteiroConsolidado,
            quebraConfiavelRoteiro,
          );

          console.log(
            "[Relatorios][Quebra][Roteiro] Totais após aplicar quebra:",
            {
              roteiroId: roteiroSelecionado,
              totais: resumoRoteiroConsolidado?.totais,
            },
          );
        }

        setRelatorio(
          aplicarFiltroUsuarioAoRelatorio(
            {
              tipo: "roteiro",
              ...dadosRoteiro,
              resumoRoteiroConsolidado,
            },
            filtroUsuarioRelatorio,
          ),
        );
      } else if (lojaSelecionada) {
        // Buscar relatório de loja + dashboard + comissão + produtos em paralelo
        const [
          impressaoRes,
          comissaoRes,
          lucroRes,
          movRes,
          produtosRes,
          custoQuebraCaixaPeriodo,
        ] = await Promise.all([
          api.get("/relatorios/impressao", {
            params: montarParamsComUsuario(
              { lojaId: lojaSelecionada, dataInicio, dataFim },
              usuarioFiltroId,
            ),
          }),
          api
            .get("/movimentacoes/relatorio/comissao-dia", {
              params: montarParamsComUsuario(
                { lojaId: lojaSelecionada, data: dataFim },
                usuarioFiltroId,
              ),
            })
            .catch(() => ({ data: null })),
          api
            .get("/movimentacoes/relatorio/lucro-dia", {
              params: montarParamsComUsuario(
                { lojaId: lojaSelecionada, data: dataFim },
                usuarioFiltroId,
              ),
            })
            .catch((err) => {
              console.error(
                "Erro lucro-dia:",
                err.response?.data || err.message,
              );
              return { data: null };
            }),
          api
            .get("/movimentacoes/relatorio/movimentacoes-dia", {
              params: montarParamsComUsuario(
                { lojaId: lojaSelecionada, data: dataFim },
                usuarioFiltroId,
              ),
            })
            .catch(() => ({ data: null })),
          api.get("/produtos").catch(() => ({ data: [] })),
          carregarQuebraCaixaPorLoja(
            lojaSelecionada,
            dataInicio,
            dataFim,
            usuarioFiltroId,
          ),
        ]);
        // Também carregar dashboard
        await carregarDashboard(
          lojaSelecionada,
          dataInicio,
          dataFim,
          usuarioFiltroId,
        );

        // Criar mapa de preços dos produtos (id -> {preco, custoUnitario})
        const produtosMap = {};
        const produtosList = Array.isArray(produtosRes.data)
          ? produtosRes.data
          : produtosRes.data?.produtos || produtosRes.data?.rows || [];
        produtosList.forEach((p) => {
          produtosMap[p.id] = {
            nome: p.nome || "",
            preco: Number(p.preco || 0),
            custoUnitario: Number(p.custoUnitario || 0),
          };
        });
        setProdutosPrecos(produtosMap);

        // Enriquecer produtosSairam com preços dos produtos
        const dados = impressaoRes.data;
        if (dados.produtosSairam) {
          dados.produtosSairam = dados.produtosSairam.map((p) => ({
            ...p,
            produtoNaMaquinaId: p.produtoNaMaquinaId ?? null,
            preco: p.preco || produtosMap[p.id]?.preco || 0,
            custoUnitario:
              p.custoUnitario || produtosMap[p.id]?.custoUnitario || 0,
            valorUnitario:
              p.preco ||
              p.valorUnitario ||
              p.custoUnitario ||
              produtosMap[p.id]?.preco ||
              produtosMap[p.id]?.custoUnitario ||
              0,
          }));
        }
        if (dados.maquinas) {
          dados.maquinas = dados.maquinas.map((m) => ({
            ...m,
            produtosSairam:
              m.produtosSairam?.map((p) => ({
                ...p,
                produtoNaMaquinaId: p.produtoNaMaquinaId ?? null,
                preco: p.preco || produtosMap[p.id]?.preco || 0,
                custoUnitario:
                  p.custoUnitario || produtosMap[p.id]?.custoUnitario || 0,
                valorUnitario:
                  p.preco ||
                  p.valorUnitario ||
                  p.custoUnitario ||
                  produtosMap[p.id]?.preco ||
                  produtosMap[p.id]?.custoUnitario ||
                  0,
              })) || [],
          }));
        }

        const dadosComQuebra = aplicarQuebraCaixaNoRelatorioLoja(
          dados,
          custoQuebraCaixaPeriodo,
        );

        setRelatorio(
          aplicarFiltroUsuarioAoRelatorio(
            dadosComQuebra,
            filtroUsuarioRelatorio,
          ),
        );
        setComissaoData(comissaoRes.data);
        setLucroData(lucroRes.data);

        // Buscar gastos fixos da loja
        try {
          const gastosFixosResponse = await api.get(
            `/gastos-fixos-loja/${lojaSelecionada}`,
          );
          setGastosFixosLoja(
            Array.isArray(gastosFixosResponse.data)
              ? gastosFixosResponse.data
              : [],
          );
        } catch (erroGastosFixos) {
          console.warn(
            "Não foi possível buscar gastos fixos:",
            erroGastosFixos,
          );
          setGastosFixosLoja([]);
        }

        // Comparativo com mês passado
        try {
          const dataInicioMesAnterior = obterMesmoDiaNoMesAnterior(dataInicio);
          const dataFimMesAnterior = obterMesmoDiaNoMesAnterior(dataFim);
          const responseMesAnterior = await api.get("/relatorios/impressao", {
            params: montarParamsComUsuario(
              {
                lojaId: lojaSelecionada,
                dataInicio: dataInicioMesAnterior,
                dataFim: dataFimMesAnterior,
              },
              usuarioFiltroId,
            ),
          });
          const quebraCaixaMesAnterior = await carregarQuebraCaixaPorLoja(
            lojaSelecionada,
            dataInicioMesAnterior,
            dataFimMesAnterior,
            usuarioFiltroId,
          );
          const relatorioMesAnterior = aplicarQuebraCaixaNoRelatorioLoja(
            responseMesAnterior.data,
            quebraCaixaMesAnterior,
          );
          if (relatorioMesAnterior) {
            setComparativoMensal({
              periodoAtual: { inicio: dataInicio, fim: dataFim },
              periodoAnterior: {
                inicio: dataInicioMesAnterior,
                fim: dataFimMesAnterior,
              },
              metricas: [
                {
                  chave: "lucroLiquido",
                  titulo: "Lucro Líquido",
                  icone: "📉",
                  indicador: montarIndicadorComparacao(
                    calcularLucroLiquidoRelatorio(dadosComQuebra),
                    calcularLucroLiquidoRelatorio(relatorioMesAnterior),
                    "maior",
                  ),
                },
                {
                  chave: "valorFichas",
                  titulo: "Valor das Fichas",
                  icone: "🎟️",
                  indicador: montarIndicadorComparacao(
                    calcularValorFichasRelatorio(dados),
                    calcularValorFichasRelatorio(relatorioMesAnterior),
                    "maior",
                  ),
                },
                {
                  chave: "valorConsolidado",
                  titulo: "Valor Consolidado",
                  icone: "💰",
                  indicador: montarIndicadorComparacao(
                    calcularValorConsolidadoRelatorio(dados),
                    calcularValorConsolidadoRelatorio(relatorioMesAnterior),
                    "maior",
                  ),
                },
                {
                  chave: "custoSaidaProdutos",
                  titulo: "Custo de Saída dos Produtos",
                  icone: "💸",
                  indicador: montarIndicadorComparacao(
                    calcularCustoSaidaProdutosRelatorio(dadosComQuebra),
                    calcularCustoSaidaProdutosRelatorio(relatorioMesAnterior),
                    "menor",
                  ),
                },
                ...(toNumber(dadosComQuebra?.totais?.custoQuebraCaixa) > 0 ||
                toNumber(relatorioMesAnterior?.totais?.custoQuebraCaixa) > 0
                  ? [
                      {
                        chave: "quebraCaixa",
                        titulo: "Quebra de Caixa (Custo)",
                        icone: "💥",
                        indicador: montarIndicadorComparacao(
                          toNumber(dadosComQuebra?.totais?.custoQuebraCaixa),
                          toNumber(
                            relatorioMesAnterior?.totais?.custoQuebraCaixa,
                          ),
                          "menor",
                        ),
                      },
                    ]
                  : []),
              ],
            });
          }
        } catch (erroComparativo) {
          console.warn("Não foi possível gerar comparativo:", erroComparativo);
        }

        // Agregar movimentações por máquina (dinheiro, cartão/pix)
        if (movRes.data) {
          const movs = Array.isArray(movRes.data)
            ? movRes.data
            : movRes.data.movimentacoes || [];
          const porMaquina = {};
          movs.forEach((mov) => {
            const mId = mov.maquinaId;
            if (!porMaquina[mId])
              porMaquina[mId] = { dinheiro: 0, pixCartao: 0 };
            porMaquina[mId].dinheiro += Number(
              mov.quantidade_notas_entrada || 0,
            );
            porMaquina[mId].pixCartao += Number(
              mov.valor_entrada_maquininha_pix || 0,
            );
          });
          setMovimentacoesData(porMaquina);
        }
      }
    } catch (error) {
      let errorMessage = "Erro ao gerar relatório. Tente novamente.";
      if (error.response?.status === 404) {
        errorMessage =
          "⚠️ Endpoint não encontrado. O servidor pode estar atualizando. Aguarde alguns minutos e tente novamente.";
      } else if (error.response?.status === 500) {
        errorMessage = `⚠️ Erro no servidor: ${error.response?.data?.error || "Erro interno no servidor"}. Verifique se há dados para o período selecionado.`;
      } else if (error.response?.status === 400) {
        errorMessage = `⚠️ Requisição inválida: ${error.response?.data?.error || "Verifique os campos preenchidos"}`;
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message === "Network Error") {
        errorMessage = "⚠️ Erro de conexão. Verifique sua internet.";
      }
      setError(errorMessage);
      setRelatorio(null);
      setDashboard(null);
    } finally {
      setLoading(false);
    }
  };

  const gastosFixosComValor = gastosFixosLoja
    .map((item) => ({
      id: item.id,
      nome: String(item.nome || "").trim(),
      valor: Number(item.valor || 0),
    }))
    .filter((item) => item.nome.length > 0 && item.valor > 0);

  const gastosFixosProporcionaisPeriodo = gastosFixosComValor.map((item) => ({
    ...item,
    valorProporcionalPeriodo: calcularCustoFixoProporcionalPeriodo(
      item.valor,
      dataInicio,
      dataFim,
    ),
  }));

  const totalGastosFixosMensalDaLoja = gastosFixosComValor.reduce(
    (acc, item) => acc + item.valor,
    0,
  );
  const totalGastosFixosDaLoja = gastosFixosProporcionaisPeriodo.reduce(
    (acc, item) => acc + toNumber(item?.valorProporcionalPeriodo),
    0,
  );
  const custoQuebraCaixaRelatorio = toNumber(
    relatorio?.totais?.custoQuebraCaixa,
  );
  const resumoProdutosConsolidado = calcularResumoProdutos(
    relatorio?.produtosSairam,
    relatorio?.totais,
  );

  const valorConsolidadoRelatorio =
    calcularValorConsolidadoRelatorio(relatorio);
  const custoProdutosRelatorio = calcularCustoSaidaProdutosRelatorio(relatorio);
  const custoProdutosBaseRelatorio =
    calcularCustoSaidaProdutosRelatorio(relatorio);
  const gastoTotalPeriodoRelatorio = toNumber(
    relatorio?.totais?.gastoTotalPeriodo,
  );
  const custosNaoMapeadosBackendRelatorio = Math.max(
    0,
    gastoTotalPeriodoRelatorio -
      custoProdutosBaseRelatorio -
      custoQuebraCaixaRelatorio -
      totalGastosFixosDaLoja,
  );
  const custoTotalConsideradoRelatorio =
    custoProdutosRelatorio + totalGastosFixosDaLoja + custoQuebraCaixaRelatorio;
  const lucroLiquidoRelatorio =
    valorConsolidadoRelatorio - custoTotalConsideradoRelatorio;
  const lucroSemCustoFixoRelatorio =
    valorConsolidadoRelatorio - custoProdutosRelatorio;
  const valorEsperadoRelatorio = toNumber(
    relatorio?.totais?.valorEsperadoContadores ?? 0,
  );
  const lucroEsperadoRelatorio =
    valorEsperadoRelatorio - custoTotalConsideradoRelatorio;

  const isRelatorioRoteiro = relatorio?.tipo === "roteiro";
  const resumoRoteiroConsolidado =
    relatorio?.resumoRoteiroConsolidado ||
    relatorio?.resumoConsolidadoRoteiro ||
    null;
  const totaisRoteiroConsolidado =
    resumoRoteiroConsolidado?.totais || relatorio?.totais || {};

  const rendimentoBrutoRoteiro = toNumber(
    pickNumber(
      totaisRoteiroConsolidado?.lucroBrutoTotal,
      totaisRoteiroConsolidado?.valorBrutoConsolidadoLojaMaquinas,
      totaisRoteiroConsolidado?.valorTotalLojaBruto,
      totaisRoteiroConsolidado?.faturamentoBrutoTotal,
    ) || 0,
  );

  const produtosSairamRoteiro = toNumber(
    pickNumber(
      totaisRoteiroConsolidado?.produtosSairamTotal,
      totaisRoteiroConsolidado?.produtosSairam,
      totaisRoteiroConsolidado?.saidasPremioTotal,
    ) || 0,
  );

  const custoFixoRoteiro = toNumber(
    pickNumber(
      totaisRoteiroConsolidado?.custoFixoTotal,
      totaisRoteiroConsolidado?.gastoFixoTotal,
    ) || 0,
  );
  const custoQuebraRoteiro = toNumber(
    pickNumber(
      totaisRoteiroConsolidado?.custoQuebraCaixaTotal,
      totaisRoteiroConsolidado?.custoQuebraCaixa,
    ) || 0,
  );
  const custoProdutosRoteiro = toNumber(
    pickNumber(
      totaisRoteiroConsolidado?.custoProdutosTotal,
      totaisRoteiroConsolidado?.custoProdutosSairam,
    ) || 0,
  );
  const custoVariavelRoteiro = toNumber(
    pickNumber(
      totaisRoteiroConsolidado?.custoVariavelTotal,
      totaisRoteiroConsolidado?.gastoVariavelTotal,
    ) || 0,
  );
  const custoTotalRoteiro = toNumber(
    pickNumber(
      totaisRoteiroConsolidado?.custoTotal,
      totaisRoteiroConsolidado?.gastoTotalPeriodo,
    ) ||
      custoFixoRoteiro +
        custoQuebraRoteiro +
        custoProdutosRoteiro +
        custoVariavelRoteiro,
  );

  const lucroLiquidoRoteiro = rendimentoBrutoRoteiro - custoTotalRoteiro;

  const valorEsperadoRoteiro = toNumber(
    pickNumber(
      totaisRoteiroConsolidado?.valorEsperadoTotal,
      totaisRoteiroConsolidado?.valorEsperadoContadores,
    ) || 0,
  );
  const lucroEsperadoRoteiro = valorEsperadoRoteiro - custoTotalRoteiro;

  const outrosCustosRoteiro = Math.max(
    0,
    custoTotalRoteiro -
      custoFixoRoteiro -
      custoQuebraRoteiro -
      custoProdutosRoteiro -
      custoVariavelRoteiro,
  );

  const resumoLojasRoteiro = (() => {
    if (!isRelatorioRoteiro) return [];

    const lojasResumoDireto = Array.isArray(
      resumoRoteiroConsolidado?.lojasResumo,
    )
      ? resumoRoteiroConsolidado.lojasResumo
      : [];

    if (lojasResumoDireto.length > 0) {
      const diasPorLoja = new Map(
        (Array.isArray(relatorio?.lojas) ? relatorio.lojas : []).map((loja) => [
          String(
            loja?.id ?? loja?.lojaId ?? loja?.loja?.id ?? loja?.nome ?? "",
          ),
          Array.isArray(loja?.diasSemMovimentacao)
            ? loja.diasSemMovimentacao.length
            : 0,
        ]),
      );

      return lojasResumoDireto
        .map((item, idx) => {
          const chave = String(
            item?.lojaId ?? item?.id ?? item?.lojaNome ?? item?.nome ?? idx,
          );

          return {
            lojaId: item?.lojaId ?? item?.id ?? null,
            lojaNome: item?.lojaNome || item?.nome || `Ponto ${idx + 1}`,
            lucroBruto: toNumber(item?.lucroBruto),
            lucroLiquido: toNumber(item?.lucroLiquido),
            custoTotal: toNumber(item?.custoTotal),
            produtosSairam: toNumber(item?.produtosSairam),
            diasSemMovimentacao: toNumber(diasPorLoja.get(chave) || 0),
          };
        })
        .sort((a, b) =>
          String(a.lojaNome || "").localeCompare(
            String(b.lojaNome || ""),
            "pt-BR",
          ),
        );
    }

    const mapa = new Map();
    const graficos = resumoRoteiroConsolidado?.graficos || {};

    const atualizarCampo = (registro, campo, ...candidatos) => {
      const valor = pickNumber(...candidatos);
      if (valor === null) return;

      if (toNumber(registro[campo]) === 0 || valor !== 0) {
        registro[campo] = toNumber(valor);
      }
    };

    const aplicarValoresDaLoja = (registro, origem = {}) => {
      const totaisOrigem = origem?.totais || {};

      atualizarCampo(
        registro,
        "lucroBruto",
        origem?.lucroBruto,
        origem?.rendimento,
        origem?.valorBruto,
        origem?.faturamentoBruto,
        totaisOrigem?.lucroBruto,
        totaisOrigem?.lucroBrutoTotal,
        totaisOrigem?.valorTotalLojaBruto,
        totaisOrigem?.faturamentoBruto,
      );

      atualizarCampo(
        registro,
        "produtosSairam",
        origem?.produtosSairam,
        origem?.saidasPremio,
        origem?.quantidadeSaidas,
        totaisOrigem?.produtosSairam,
        totaisOrigem?.produtosSairamTotal,
        totaisOrigem?.saidasPremioTotal,
      );

      atualizarCampo(
        registro,
        "custoTotal",
        origem?.custoTotal,
        origem?.gastoTotal,
        origem?.despesaTotal,
        totaisOrigem?.custoTotal,
        totaisOrigem?.gastoTotalPeriodo,
      );

      atualizarCampo(
        registro,
        "lucroLiquido",
        origem?.lucroLiquido,
        origem?.valorLiquido,
        totaisOrigem?.lucroLiquido,
        totaisOrigem?.lucroLiquidoTotal,
        totaisOrigem?.valorLiquidoConsolidadoLojaMaquinas,
      );

      const diasSemMov = pickNumber(
        Array.isArray(origem?.diasSemMovimentacao)
          ? origem.diasSemMovimentacao.length
          : null,
        origem?.diasSemMovimentacao,
        origem?.totalDiasSemMovimentacao,
      );

      if (diasSemMov !== null) {
        registro.diasSemMovimentacao = toNumber(diasSemMov);
      }
    };

    const garantirLoja = (lojaId, lojaNome = "Ponto") => {
      const chave = String(lojaId || lojaNome || "").trim();
      if (!chave) return null;

      if (!mapa.has(chave)) {
        mapa.set(chave, {
          lojaId: lojaId || null,
          lojaNome: lojaNome || "Ponto",
          lucroBruto: 0,
          lucroLiquido: 0,
          custoTotal: 0,
          produtosSairam: 0,
          diasSemMovimentacao: 0,
        });
      }

      return mapa.get(chave);
    };

    const listasLojas = [
      relatorio?.lojas,
      resumoRoteiroConsolidado?.lojas,
      resumoRoteiroConsolidado?.lojasDetalhado,
      resumoRoteiroConsolidado?.detalhamentoLojas,
    ];

    listasLojas.forEach((lista) => {
      (Array.isArray(lista) ? lista : []).forEach((loja, idx) => {
        const lojaId =
          loja?.id ?? loja?.lojaId ?? loja?.loja?.id ?? `loja-${idx}`;
        const lojaNome =
          loja?.nome ??
          loja?.lojaNome ??
          loja?.loja?.nome ??
          `Ponto ${idx + 1}`;
        const registro = garantirLoja(lojaId, lojaNome);
        if (registro) aplicarValoresDaLoja(registro, loja);
      });
    });

    (graficos?.rankingLucroBrutoLojas || []).forEach((item) => {
      const registro = garantirLoja(item?.lojaId, item?.lojaNome);
      if (registro) aplicarValoresDaLoja(registro, item);
    });

    (graficos?.rankingLucroLojas || []).forEach((item) => {
      const registro = garantirLoja(item?.lojaId, item?.lojaNome);
      if (registro) aplicarValoresDaLoja(registro, item);
    });

    (graficos?.rankingGastoLojas || []).forEach((item) => {
      const registro = garantirLoja(item?.lojaId, item?.lojaNome);
      if (registro) aplicarValoresDaLoja(registro, item);
    });

    (graficos?.rankingTicketPremioLojas || []).forEach((item) => {
      const registro = garantirLoja(item?.lojaId, item?.lojaNome);
      if (registro) aplicarValoresDaLoja(registro, item);
    });

    // Fallback: quando vierem apenas máquinas com dados de loja, agrega por loja.
    (Array.isArray(relatorio?.maquinas) ? relatorio.maquinas : []).forEach(
      (maquina, idx) => {
        const lojaId =
          maquina?.lojaId ?? maquina?.loja?.id ?? `loja-maquina-${idx}`;
        const lojaNome =
          maquina?.loja?.nome ?? maquina?.lojaNome ?? `Ponto ${idx + 1}`;
        const registro = garantirLoja(lojaId, lojaNome);
        if (!registro) return;

        const totaisMaquina = maquina?.totais || {};
        registro.lucroBruto += toNumber(
          pickNumber(
            totaisMaquina?.faturamentoBruto,
            totaisMaquina?.valorTotalLojaBruto,
          ) || 0,
        );
        registro.lucroLiquido += toNumber(totaisMaquina?.lucroLiquido || 0);
        registro.produtosSairam += toNumber(
          pickNumber(
            totaisMaquina?.produtosSairam,
            totaisMaquina?.saidasPremio,
          ) || 0,
        );
      },
    );

    Array.from(mapa.values()).forEach((registro) => {
      if (toNumber(registro.lucroLiquido) === 0) {
        registro.lucroLiquido =
          toNumber(registro.lucroBruto) - toNumber(registro.custoTotal);
      }
    });

    return Array.from(mapa.values()).sort((a, b) =>
      String(a.lojaNome || "").localeCompare(String(b.lojaNome || ""), "pt-BR"),
    );
  })();

  if (loadingLojas) return <PageLoader />;

  return (
    <div className="min-h-screen bg-linear-to-br from-[#62A1D9] via-[#A6806A] to-[#24094E] text-[#24094E]">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title="📄 Relatório de Impressão"
          subtitle="Gere relatórios detalhados de movimentações por ponto"
          icon="📊"
        />

        {/* Formulário de Filtros */}
        <div className="card mb-6 no-print">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Filtros</h3>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                🗂️ Roteiro
              </label>
              <input
                type="text"
                value={buscaRoteiro}
                onChange={(e) => setBuscaRoteiro(e.target.value)}
                className="input-field w-full mb-2"
                placeholder="Digite o nome do roteiro"
                disabled={
                  lojaSelecionada === TODAS_LOJAS_VALUE ||
                  lojaSelecionada === SELECAO_MANUAL_LOJAS_VALUE
                }
              />
              <select
                value={roteiroSelecionado}
                onChange={(e) => {
                  setRoteiroSelecionado(e.target.value);
                  setLojaSelecionada("");
                  setLojasSelecionadasConsolidado([]);
                }}
                className="input-field w-full"
                disabled={
                  lojaSelecionada === TODAS_LOJAS_VALUE ||
                  lojaSelecionada === SELECAO_MANUAL_LOJAS_VALUE
                }
              >
                <option value="">Selecione um roteiro (opcional)</option>
                {roteirosFiltradosBusca.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nome}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                🏪 Loja
              </label>
              <input
                type="text"
                value={buscaLoja}
                onChange={(e) => setBuscaLoja(e.target.value)}
                className="input-field w-full mb-2"
                placeholder="Digite o nome da loja"
                disabled={!!roteiroSelecionado}
              />
              <select
                value={lojaSelecionada}
                onChange={(e) => {
                  const valorSelecionado = e.target.value;
                  setLojaSelecionada(valorSelecionado);
                  setRoteiroSelecionado("");

                  if (valorSelecionado !== SELECAO_MANUAL_LOJAS_VALUE) {
                    setLojasSelecionadasConsolidado([]);
                  }
                }}
                className="input-field w-full"
                disabled={!!roteiroSelecionado}
              >
                <option value="">Selecione uma loja</option>
                <option value={TODAS_LOJAS_VALUE}>Todas as lojas</option>
                <option value={SELECAO_MANUAL_LOJAS_VALUE}>
                  Selecionar lojas manualmente (consolidado)
                </option>
                {lojasFiltradasBusca.map((loja) => (
                  <option key={loja.id} value={loja.id}>
                    {loja.nome}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                👤 Funcionário
              </label>
              <input
                type="text"
                value={buscaUsuario}
                onChange={(e) => setBuscaUsuario(e.target.value)}
                className="input-field w-full mb-2"
                placeholder="Digite o nome do funcionário"
              />
              <select
                value={usuarioSelecionado}
                onChange={(e) => setUsuarioSelecionado(e.target.value)}
                className="input-field w-full"
              >
                <option value="">Todos os funcionários</option>
                {usuariosFiltradosBusca.map((usuario) => (
                  <option key={usuario.id} value={usuario.id}>
                    {usuario.nome}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                📅 Data Inicial *
              </label>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="input-field w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                📅 Data Final *
              </label>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="input-field w-full"
              />
            </div>
          </div>

          {lojaSelecionada === SELECAO_MANUAL_LOJAS_VALUE &&
            !roteiroSelecionado && (
              <div className="mt-4 p-4 rounded-lg border border-indigo-200 bg-indigo-50/40">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                  <p className="text-sm font-semibold text-gray-800">
                    Lojas selecionadas para o consolidado:{" "}
                    {lojasSelecionadasConsolidado.length}
                  </p>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setLojasSelecionadasConsolidado(
                          (lojas || []).map((loja) => String(loja.id)),
                        )
                      }
                      className="px-3 py-1.5 rounded-lg border border-indigo-200 text-indigo-700 bg-white hover:bg-indigo-50 text-sm font-medium"
                    >
                      Selecionar todas
                    </button>
                    <button
                      type="button"
                      onClick={() => setLojasSelecionadasConsolidado([])}
                      className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 bg-white hover:bg-gray-50 text-sm font-medium"
                    >
                      Limpar
                    </button>
                  </div>
                </div>

                <input
                  type="text"
                  value={buscaLojaConsolidado}
                  onChange={(e) => setBuscaLojaConsolidado(e.target.value)}
                  className="input-field w-full mb-3"
                  placeholder="Digite o nome da loja para filtrar a lista"
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-56 overflow-y-auto pr-1">
                  {(lojasFiltradasConsolidado || []).map((loja) => {
                    const lojaIdNormalizado = String(loja.id);
                    const selecionada =
                      lojasSelecionadasConsolidado.includes(lojaIdNormalizado);

                    return (
                      <label
                        key={loja.id}
                        className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                          selecionada
                            ? "bg-indigo-50 border-indigo-300"
                            : "bg-white border-gray-200 hover:border-indigo-200"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selecionada}
                          onChange={() => toggleLojaConsolidado(loja.id)}
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-sm text-gray-800 truncate">
                          {loja.nome}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">⚠️ {error}</p>
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={gerarRelatorio}
              disabled={loading}
              className="btn-primary"
            >
              {loading ? "⏳ Gerando..." : "📊 Gerar Relatório"}
            </button>
            <button
              onClick={handleImprimir}
              disabled={!relatorio}
              className="btn-secondary"
            >
              🖨️ Imprimir
            </button>
            <button
              onClick={() => navigate("/graficos")}
              className="px-6 py-2.5 bg-linear-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-lg font-semibold transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center gap-2"
            >
              📈 Ver Gráficos
            </button>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="text-gray-600 mt-4">Gerando relatório...</p>
          </div>
        )}

        {/* Relatório */}
        {relatorio && !loading && relatorio.tipo === "todas-lojas" && (
          <RelatorioTodasLojas relatorio={relatorio} />
        )}

        {relatorio && !loading && relatorio.tipo !== "todas-lojas" && (
          <div className="space-y-6">
            {relatorio?.filtroUsuario && (
              <div className="card bg-white border border-indigo-200">
                <p className="text-sm text-gray-700">
                  Relatório filtrado por funcionário:{" "}
                  <strong>{relatorio.filtroUsuario.nome}</strong>
                  {relatorio.filtroUsuario.email
                    ? ` (${relatorio.filtroUsuario.email})`
                    : ""}
                </p>
              </div>
            )}

            {isRelatorioRoteiro &&
              (resumoRoteiroConsolidado || relatorio?.totais) && (
                <div className="card bg-linear-to-r from-sky-50 to-indigo-100 border-2 border-indigo-300">
                  <h3 className="text-lg sm:text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <span className="text-2xl sm:text-3xl">🧭</span>
                    Resumo Geral da Rota (Todas as Lojas do Roteiro)
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                    <div className="card bg-linear-to-br from-blue-600 to-indigo-700 text-white">
                      <div className="text-2xl mb-2">💰</div>
                      <div className="text-xl sm:text-2xl font-bold">
                        R${" "}
                        {rendimentoBrutoRoteiro.toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                        })}
                      </div>
                      <div className="text-xs sm:text-sm opacity-90">
                        Valor Recebido da Rota
                      </div>
                    </div>

                    <div className="card bg-linear-to-br from-red-500 to-rose-700 text-white">
                      <div className="text-2xl mb-2">📤</div>
                      <div className="text-xl sm:text-2xl font-bold">
                        {produtosSairamRoteiro.toLocaleString("pt-BR")}
                      </div>
                      <div className="text-xs sm:text-sm opacity-90">
                        Produtos Saíram (Rota)
                      </div>
                    </div>

                    <div className="card bg-linear-to-br from-rose-500 to-red-700 text-white">
                      <div className="text-2xl mb-2">🧮</div>
                      <div className="text-xl sm:text-2xl font-bold">
                        R${" "}
                        {custoTotalRoteiro.toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                        })}
                      </div>
                      <div className="text-xs sm:text-sm opacity-90">
                        Custos Totais da Rota
                      </div>
                      <div className="text-[10px] sm:text-xs opacity-85 mt-2 space-y-1">
                        <div>
                          Produtos: R${" "}
                          {custoProdutosRoteiro.toLocaleString("pt-BR", {
                            minimumFractionDigits: 2,
                          })}
                        </div>
                        <div>
                          Fixos: R${" "}
                          {custoFixoRoteiro.toLocaleString("pt-BR", {
                            minimumFractionDigits: 2,
                          })}
                        </div>
                        <div>
                          Quebra de caixa: R${" "}
                          {custoQuebraRoteiro.toLocaleString("pt-BR", {
                            minimumFractionDigits: 2,
                          })}
                        </div>
                        <div>
                          Outros: R${" "}
                          {outrosCustosRoteiro.toLocaleString("pt-BR", {
                            minimumFractionDigits: 2,
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="card bg-linear-to-br from-emerald-600 to-green-800 text-white">
                      <div className="text-2xl mb-2">📉</div>
                      <div className="text-xl sm:text-2xl font-bold">
                        R${" "}
                        {lucroLiquidoRoteiro.toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                        })}
                      </div>
                      <div className="text-xs sm:text-sm opacity-90">
                        Lucro Líquido Geral da Rota
                      </div>
                    </div>

                    <div className="card bg-linear-to-br from-amber-500 to-yellow-600 text-white border-2 border-amber-300">
                      <div className="text-2xl mb-2">🔮</div>
                      <div className="text-xl sm:text-2xl font-bold">
                        R${" "}
                        {valorEsperadoRoteiro.toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                        })}
                      </div>
                      <div className="text-xs sm:text-sm opacity-90">
                        Valor Esperado (Fluxo de Caixa)
                      </div>
                      <div className="text-[10px] sm:text-xs opacity-80 mt-1">
                        Soma da coluna valor esperado com os filtros do
                        relatório
                      </div>
                    </div>

                    <div
                      className={`card border-2 text-white ${
                        lucroEsperadoRoteiro >= 0
                          ? "bg-linear-to-br from-lime-500 to-green-700 border-lime-300"
                          : "bg-linear-to-br from-red-600 to-rose-800 border-red-300"
                      }`}
                    >
                      <div className="text-2xl mb-2">🎯</div>
                      <div className="text-xl sm:text-2xl font-bold">
                        R${" "}
                        {lucroEsperadoRoteiro.toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                        })}
                      </div>
                      <div className="text-xs sm:text-sm opacity-90">
                        Lucro Esperado
                      </div>
                      <div className="text-[10px] sm:text-xs opacity-80 mt-1">
                        Valor Esperado − Custos Totais
                      </div>
                    </div>
                  </div>
                </div>
              )}

            {/* Aviso de diferença de fichas */}
            {relatorio.avisoFichas && (
              <div className="p-4 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-900 rounded mb-4">
                <strong>Aviso:</strong> {relatorio.avisoFichas}
              </div>
            )}

            {isRelatorioRoteiro && resumoLojasRoteiro.length > 0 && (
              <div className="card bg-linear-to-r from-cyan-50 to-blue-100 border-2 border-cyan-300">
                <h3 className="text-lg sm:text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <span className="text-2xl sm:text-3xl">🏬</span>
                  Lojas que fazem parte do roteiro
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {resumoLojasRoteiro.map((lojaResumo) => (
                    <div
                      key={String(lojaResumo.lojaId || lojaResumo.lojaNome)}
                      className="bg-white rounded-lg border border-cyan-200 px-4 py-3 shadow-sm"
                    >
                      <div className="font-semibold text-gray-900 truncate">
                        {lojaResumo.lojaNome}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Cards de Totais Gerais - Resumo Geral da Loja */}
            {!isRelatorioRoteiro && (
              <div className="card bg-linear-to-r from-purple-50 to-purple-100 border-2 border-purple-300">
                <h3 className="text-lg sm:text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <span className="text-2xl sm:text-3xl">📊</span>
                  Resumo Geral da Loja
                </h3>
                <div className="flex flex-wrap gap-4 sm:gap-4">
                  {/* Bruto Consolidado */}
                  <div className="card bg-linear-to-br from-yellow-500 to-orange-600 text-white">
                    <div className="text-2xl sm:text-3xl mb-2">💰</div>
                    <div className="text-xl sm:text-2xl font-bold">
                      R${" "}
                      {Number(valorConsolidadoRelatorio || 0).toLocaleString(
                        "pt-BR",
                        { minimumFractionDigits: 2 },
                      )}
                    </div>
                    <div className="text-xs sm:text-sm opacity-90">
                      Valor Recebido (Fluxo de Caixa)
                    </div>
                  </div>

                  {/* Produtos Entraram */}
                  <div className="card bg-linear-to-br from-green-500 to-green-600 text-white">
                    <div className="text-2xl sm:text-3xl mb-2">📥</div>
                    <div className="text-xl sm:text-2xl font-bold">
                      {(relatorio.totais?.produtosEntraram || 0).toLocaleString(
                        "pt-BR",
                      )}
                    </div>
                    <div className="text-xs sm:text-sm opacity-90">
                      Contador prêmios
                    </div>
                  </div>

                  {/* Ticket por Prêmio (Total) */}
                  <div className="card bg-linear-to-br from-indigo-500 to-indigo-700 text-white">
                    <div className="text-2xl sm:text-3xl mb-2">🎯</div>
                    <div className="text-xl sm:text-2xl font-bold">
                      R${" "}
                      {Number(
                        relatorio.totais?.ticketPorPremioTotal || 0,
                      ).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-xs sm:text-sm opacity-90">
                      Ticket por Prêmio (Total)
                    </div>
                    <div className="text-[10px] sm:text-xs opacity-80 mt-1">
                      Fórmula: Faturamento Bruto ÷ Produtos Saíram
                    </div>
                    <div className="text-[10px] sm:text-xs opacity-80 mt-1">
                      {`R$ ${Number(relatorio.totais?.valorTotalLojaBruto || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} / ${(relatorio.totais?.produtosSairam || 0).toLocaleString("pt-BR")} saídas`}
                    </div>
                  </div>

                  {/* Custo Total de Produtos + Produtos Saíram */}
                  <div className="card bg-linear-to-br from-yellow-100 to-yellow-400 text-yellow-900 border-yellow-400 border-2">
                    <div className="text-2xl sm:text-3xl mb-2">💸</div>
                    <div className="text-xl sm:text-2xl font-bold">
                      R${" "}
                      {Number(custoProdutosRelatorio || 0).toLocaleString(
                        "pt-BR",
                        {
                          minimumFractionDigits: 2,
                        },
                      )}
                    </div>
                    <div className="text-xs sm:text-sm opacity-90">
                      Custo Total de Produtos
                    </div>
                    <div className="text-[10px] sm:text-xs opacity-80 mt-1">
                      Fórmula: soma do valorTotal dos itens em produtosSairam[]
                    </div>
                    <div className="text-2xl sm:text-3xl mb-2 mt-3">📤</div>
                    <div className="text-xl sm:text-2xl font-bold">
                      {resumoProdutosConsolidado.totalQuantidadeItens.toLocaleString(
                        "pt-BR",
                      )}
                    </div>
                    <div className="text-xs sm:text-sm opacity-90">
                      Produtos Saíram
                    </div>
                    {resumoProdutosConsolidado.divergenciaQuantidade && (
                      <div className="text-[10px] sm:text-xs opacity-90 mt-1">
                        Conferência: itens (
                        {resumoProdutosConsolidado.totalQuantidadeItens.toLocaleString(
                          "pt-BR",
                        )}
                        ) diferente de totais.produtosSairam (
                        {resumoProdutosConsolidado.totalQuantidadeDeclarado.toLocaleString(
                          "pt-BR",
                        )}
                        )
                      </div>
                    )}
                    {resumoProdutosConsolidado.divergenciaCusto && (
                      <div className="text-[10px] sm:text-xs opacity-90 mt-1">
                        Conferência: soma valorTotal (R${" "}
                        {formatarMoeda(
                          resumoProdutosConsolidado.custoTotalItens,
                        )}
                        ) diferente de totais.custoProdutosSairam (R${" "}
                        {formatarMoeda(
                          resumoProdutosConsolidado.custoTotalDeclarado,
                        )}
                        )
                      </div>
                    )}
                  </div>

                  {/* Gastos Fixos da Loja (Detalhado) */}
                  <div className="card bg-linear-to-br from-violet-500 to-purple-800 text-white">
                    <div className="text-2xl sm:text-3xl mb-2">🏷️</div>
                    <div className="text-xl sm:text-2xl font-bold">
                      R${" "}
                      {Number(totalGastosFixosDaLoja || 0).toLocaleString(
                        "pt-BR",
                        { minimumFractionDigits: 2 },
                      )}
                    </div>
                    <div className="text-xs sm:text-sm opacity-90">
                      Gastos Fixos no Período (rateio diário)
                    </div>
                    <div className="text-[10px] sm:text-xs opacity-80 mt-1">
                      Mensal da loja: R${" "}
                      {Number(totalGastosFixosMensalDaLoja || 0).toLocaleString(
                        "pt-BR",
                        { minimumFractionDigits: 2 },
                      )}
                    </div>
                    <div className="text-[10px] sm:text-xs opacity-80 mt-2 space-y-1 max-h-24 overflow-y-auto pr-1">
                      {gastosFixosProporcionaisPeriodo.length > 0 ? (
                        gastosFixosProporcionaisPeriodo.map((gasto) => (
                          <div
                            key={`${gasto.id || gasto.nome}`}
                            className="truncate"
                          >
                            {gasto.nome}: R${" "}
                            {Number(
                              gasto.valorProporcionalPeriodo || 0,
                            ).toLocaleString("pt-BR", {
                              minimumFractionDigits: 2,
                            })}{" "}
                            <span className="opacity-80">
                              (mensal: R${" "}
                              {Number(gasto.valor || 0).toLocaleString(
                                "pt-BR",
                                {
                                  minimumFractionDigits: 2,
                                },
                              )}
                              )
                            </span>
                          </div>
                        ))
                      ) : (
                        <div>Sem gastos fixos com valor maior que zero</div>
                      )}
                    </div>
                  </div>

                  {/* Gasto Total */}
                  <div className="card bg-linear-to-br from-rose-500 to-red-700 text-white">
                    <div className="text-2xl sm:text-3xl mb-2">🧮</div>
                    <div className="text-xl sm:text-2xl font-bold">
                      R${" "}
                      {Number(
                        custoTotalConsideradoRelatorio || 0,
                      ).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-xs sm:text-sm opacity-90">
                      Gasto Total
                    </div>
                    {custosNaoMapeadosBackendRelatorio > 0 && (
                      <div className="text-[10px] sm:text-xs opacity-90 mt-1">
                        Ignorado do backend (não mapeado em fixo/produto): R${" "}
                        {Number(
                          custosNaoMapeadosBackendRelatorio,
                        ).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </div>
                    )}
                  </div>

                  {/* Quebra de Caixa como Custo */}
                  {Boolean(relatorio?.loja?.id) &&
                    custoQuebraCaixaRelatorio > 0 && (
                      <div className="card bg-linear-to-br from-red-700 to-rose-900 text-white border-2 border-red-300">
                        <div className="text-2xl sm:text-3xl mb-2">💥</div>
                        <div className="text-xl sm:text-2xl font-bold">
                          R${" "}
                          {Number(
                            custoQuebraCaixaRelatorio || 0,
                          ).toLocaleString("pt-BR", {
                            minimumFractionDigits: 2,
                          })}
                        </div>
                        <div className="text-xs sm:text-sm opacity-90">
                          Quebra de Caixa (custo)
                        </div>
                      </div>
                    )}

                  {/* Lucro Líquido */}
                  <div className="card bg-linear-to-br from-emerald-600 to-green-800 text-white">
                    <div className="text-2xl sm:text-3xl mb-2">📉</div>
                    <div className="text-xl sm:text-2xl font-bold">
                      R${" "}
                      {Number(lucroLiquidoRelatorio || 0).toLocaleString(
                        "pt-BR",
                        { minimumFractionDigits: 2 },
                      )}
                    </div>
                    <div className="text-xs sm:text-sm opacity-90">
                      Lucro Líquido
                    </div>
                  </div>

                  {/* Lucro sem custo fixo */}
                  <div className="card bg-linear-to-br from-teal-600 to-cyan-800 text-white">
                    <div className="text-2xl sm:text-3xl mb-2">🟢</div>
                    <div className="text-xl sm:text-2xl font-bold">
                      R${" "}
                      {Number(lucroSemCustoFixoRelatorio || 0).toLocaleString(
                        "pt-BR",
                        { minimumFractionDigits: 2 },
                      )}
                    </div>
                    <div className="text-xs sm:text-sm opacity-90">
                      Lucro sem custo fixo
                    </div>
                    <div className="text-[10px] sm:text-xs opacity-80 mt-1">
                      Considera apenas custo dos produtos que saíram
                    </div>
                  </div>

                  {/* Valor Esperado (Contadores) */}
                  <div className="card bg-linear-to-br from-amber-500 to-yellow-600 text-white border-2 border-amber-300">
                    <div className="text-2xl sm:text-3xl mb-2">🔮</div>
                    <div className="text-xl sm:text-2xl font-bold">
                      R${" "}
                      {Number(valorEsperadoRelatorio).toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                      })}
                    </div>
                    <div className="text-xs sm:text-sm opacity-90">
                      Valor Esperado (Fluxo de Caixa)
                    </div>
                    <div className="text-[10px] sm:text-xs opacity-80 mt-1">
                      Soma da coluna valor esperado com os filtros do relatório
                    </div>
                  </div>

                  {/* Lucro Esperado */}
                  <div
                    className={`card border-2 text-white ${
                      lucroEsperadoRelatorio >= 0
                        ? "bg-linear-to-br from-lime-500 to-green-700 border-lime-300"
                        : "bg-linear-to-br from-red-600 to-rose-800 border-red-300"
                    }`}
                  >
                    <div className="text-2xl sm:text-3xl mb-2">🎯</div>
                    <div className="text-xl sm:text-2xl font-bold">
                      R${" "}
                      {Number(lucroEsperadoRelatorio).toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                      })}
                    </div>
                    <div className="text-xs sm:text-sm opacity-90">
                      Lucro Esperado
                    </div>
                    <div className="text-[10px] sm:text-xs opacity-80 mt-1">
                      Valor Esperado − Custos Totais
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Comparativo com Mês Passado */}
            {comparativoMensal && (
              <div className="card bg-linear-to-r from-slate-50 to-indigo-50 border-2 border-indigo-200">
                <h3 className="text-lg sm:text-2xl font-bold text-gray-900 mb-2 flex items-center gap-2">
                  <span className="text-2xl sm:text-3xl">📈</span>
                  Comparativo com o Mês Passado (mesmos dias)
                </h3>
                <p className="text-xs sm:text-sm text-gray-700 mb-4">
                  Atual:{" "}
                  {formatarDataExibicao(comparativoMensal.periodoAtual?.inicio)}{" "}
                  até{" "}
                  {formatarDataExibicao(comparativoMensal.periodoAtual?.fim)} |
                  Mês passado:{" "}
                  {formatarDataExibicao(
                    comparativoMensal.periodoAnterior?.inicio,
                  )}{" "}
                  até{" "}
                  {formatarDataExibicao(comparativoMensal.periodoAnterior?.fim)}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                  {(comparativoMensal.metricas || []).map((metrica) => {
                    const indicador = metrica.indicador || {};
                    const classes = obterClassesStatusComparacao(
                      indicador.status,
                    );
                    const sinalPercentual =
                      indicador.percentual > 0.0001
                        ? "+"
                        : indicador.percentual < -0.0001
                          ? "-"
                          : "";
                    const sinalDiferenca =
                      indicador.diferenca > 0.0001
                        ? "+"
                        : indicador.diferenca < -0.0001
                          ? "-"
                          : "";
                    const textoStatus =
                      indicador.status === "melhor"
                        ? "Melhor"
                        : indicador.status === "pior"
                          ? "Pior"
                          : "Igual";
                    return (
                      <div
                        key={metrica.chave}
                        className={`rounded-xl border-2 p-4 ${classes.card}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="font-bold text-gray-900 text-sm sm:text-base">
                            {metrica.icone} {metrica.titulo}
                          </h4>
                          <span
                            className={`text-xs font-bold ${classes.texto}`}
                          >
                            {classes.icone} {textoStatus}
                          </span>
                        </div>
                        <p
                          className={`text-sm font-bold mt-2 ${classes.texto}`}
                        >
                          {sinalPercentual}
                          {formatarPercentualComparacao(
                            Math.abs(indicador.percentual || 0),
                          )}
                          %{" "}
                          {indicador.direcao === "igual"
                            ? "igual ao"
                            : `${indicador.direcao} do`}{" "}
                          mês passado
                        </p>
                        <p className="text-xs text-gray-700 mt-2">
                          Atual: R$ {formatarMoeda(indicador.atual)}
                        </p>
                        <p className="text-xs text-gray-700">
                          Mês passado: R$ {formatarMoeda(indicador.anterior)}
                        </p>
                        <p
                          className={`text-xs font-semibold mt-1 ${classes.texto}`}
                        >
                          Diferença: {sinalDiferenca}R${" "}
                          {formatarMoeda(Math.abs(indicador.diferenca || 0))}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {!roteiroSelecionado && (
              <div className="card bg-linear-to-r from-indigo-50 to-violet-100 border-2 border-violet-300">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                  <h3 className="text-lg sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <span className="text-2xl sm:text-3xl">🎯</span>
                    Aba de Ticket por Prêmio
                  </h3>
                  <div className="flex gap-2 no-print">
                    <button
                      type="button"
                      onClick={() => setAbaTicketPremio("loja")}
                      className={`px-3 py-2 rounded-lg text-sm font-bold transition ${
                        abaTicketPremio === "loja"
                          ? "bg-violet-600 text-white"
                          : "bg-white text-violet-700 border border-violet-300"
                      }`}
                    >
                      Loja (Total)
                    </button>
                    <button
                      type="button"
                      onClick={() => setAbaTicketPremio("maquinas")}
                      className={`px-3 py-2 rounded-lg text-sm font-bold transition ${
                        abaTicketPremio === "maquinas"
                          ? "bg-violet-600 text-white"
                          : "bg-white text-violet-700 border border-violet-300"
                      }`}
                    >
                      Máquinas
                    </button>
                  </div>
                </div>

                {abaTicketPremio === "loja"
                  ? (() => {
                      const faturamentoBruto = Number(
                        relatorio?.ticketPremio?.faturamentoBruto ||
                          relatorio?.totais?.faturamentoBrutoConsolidado ||
                          dashboard?.totais?.faturamento ||
                          0,
                      );
                      const saidasPremio = Number(
                        relatorio?.ticketPremio?.produtosSairam ||
                          relatorio?.totais?.saidasPremioTotal ||
                          relatorio?.totais?.produtosSairam ||
                          0,
                      );
                      const ticketPorPremio = Number(
                        relatorio?.ticketPremio?.ticketPorPremio ||
                          relatorio?.totais?.ticketPorPremioTotal ||
                          (saidasPremio > 0
                            ? faturamentoBruto / saidasPremio
                            : 0),
                      );

                      return (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="bg-linear-to-br from-blue-500 to-indigo-700 text-white rounded-xl p-4 shadow-lg">
                            <div className="text-sm opacity-85">
                              Faturamento Bruto
                            </div>
                            <div className="text-2xl font-bold mt-1">
                              R${" "}
                              {faturamentoBruto.toLocaleString("pt-BR", {
                                minimumFractionDigits: 2,
                              })}
                            </div>
                          </div>

                          <div className="bg-linear-to-br from-red-500 to-rose-700 text-white rounded-xl p-4 shadow-lg">
                            <div className="text-sm opacity-85">
                              Produtos Saíram
                            </div>
                            <div className="text-2xl font-bold mt-1">
                              {saidasPremio.toLocaleString("pt-BR")}
                            </div>
                          </div>

                          <div className="bg-linear-to-br from-violet-500 to-indigo-700 text-white rounded-xl p-4 shadow-lg">
                            <div className="text-sm opacity-85">
                              Ticket por Prêmio (Total)
                            </div>
                            <div className="text-3xl font-black mt-1">
                              R${" "}
                              {ticketPorPremio.toLocaleString("pt-BR", {
                                minimumFractionDigits: 2,
                              })}
                            </div>
                            <div className="text-xs opacity-90 mt-2">
                              Fórmula: Faturamento Bruto ÷ Produtos Saíram
                            </div>
                            <div className="text-xs opacity-90 mt-1">
                              R${" "}
                              {faturamentoBruto.toLocaleString("pt-BR", {
                                minimumFractionDigits: 2,
                              })}{" "}
                              / {saidasPremio.toLocaleString("pt-BR")} saídas
                            </div>
                          </div>
                        </div>
                      );
                    })()
                  : (() => {
                      const linhas = (
                        relatorio?.ticketPremioMaquinas ||
                        relatorio?.maquinas?.map((item) => ({
                          maquinaId: item?.maquina?.id,
                          maquinaNome: item?.maquina?.nome,
                          maquinaCodigo: item?.maquina?.codigo,
                          faturamentoBruto:
                            Number(item?.totais?.faturamentoBruto || 0) ||
                            Number(item?.totais?.dinheiro || 0) +
                              Number(item?.totais?.cartaoPix || 0),
                          produtosSairam: Number(
                            item?.totais?.produtosSairam || 0,
                          ),
                          ticketPorPremio:
                            Number(item?.totais?.ticketPorPremio || 0) ||
                            (Number(item?.totais?.produtosSairam || 0) > 0
                              ? (Number(item?.totais?.faturamentoBruto || 0) ||
                                  Number(item?.totais?.dinheiro || 0) +
                                    Number(item?.totais?.cartaoPix || 0)) /
                                Number(item?.totais?.produtosSairam || 0)
                              : 0),
                        })) ||
                        []
                      ).sort(
                        (a, b) =>
                          Number(b?.ticketPorPremio || 0) -
                          Number(a?.ticketPorPremio || 0),
                      );

                      if (!linhas.length) {
                        return (
                          <div className="text-center py-6 text-gray-600">
                            Nenhuma máquina com dados para Ticket por Prêmio.
                          </div>
                        );
                      }

                      return (
                        <div className="overflow-x-auto">
                          <table className="min-w-full bg-white rounded-xl overflow-hidden border border-violet-200">
                            <thead className="bg-violet-100 text-violet-900">
                              <tr>
                                <th className="px-4 py-3 text-left text-sm font-bold">
                                  Máquina
                                </th>
                                <th className="px-4 py-3 text-right text-sm font-bold">
                                  Faturamento Bruto
                                </th>
                                <th className="px-4 py-3 text-right text-sm font-bold">
                                  Produtos Saíram
                                </th>
                                <th className="px-4 py-3 text-right text-sm font-bold">
                                  Ticket/Prêmio
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {linhas.map((linha) => (
                                <tr
                                  key={
                                    linha.maquinaId ||
                                    `${linha.maquinaNome}-${linha.maquinaCodigo}`
                                  }
                                  className="border-t border-violet-100"
                                >
                                  <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                                    {linha.maquinaNome || "Máquina"}
                                    {linha.maquinaCodigo
                                      ? ` (${linha.maquinaCodigo})`
                                      : ""}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-right text-gray-800">
                                    R${" "}
                                    {Number(
                                      linha.faturamentoBruto || 0,
                                    ).toLocaleString("pt-BR", {
                                      minimumFractionDigits: 2,
                                    })}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-right text-gray-800">
                                    {Number(
                                      linha.produtosSairam || 0,
                                    ).toLocaleString("pt-BR")}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-right font-bold text-violet-700">
                                    R${" "}
                                    {Number(
                                      linha.ticketPorPremio || 0,
                                    ).toLocaleString("pt-BR", {
                                      minimumFractionDigits: 2,
                                    })}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      );
                    })()}
              </div>
            )}

            {/* Detalhamento por máquina */}
            {relatorio.maquinas && relatorio.maquinas.length > 0 && (
              <div className="space-y-6">
                <div className="card bg-linear-to-r from-indigo-500 to-purple-600 text-white">
                  <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold flex items-center gap-2 sm:gap-3">
                    <span className="text-3xl sm:text-4xl">🎰</span>
                    <span className="wrap-break-word">
                      RELATÓRIO DETALHADO POR MÁQUINA
                    </span>
                  </h2>
                  <p className="text-xs sm:text-sm opacity-90 mt-2">
                    Visualize abaixo as informações detalhadas de cada máquina
                    desta loja no período selecionado
                  </p>
                </div>

                {relatorio.maquinas.map((maquina, index) => {
                  const resumoProdutosMaquina = calcularResumoProdutos(
                    maquina?.produtosSairam,
                    maquina?.totais,
                  );

                  return (
                    <div
                      key={maquina.maquina.id}
                      className="card border-4 border-indigo-300 shadow-2xl page-break-before"
                    >
                      {/* Header da Máquina com destaque */}
                      <div className="bg-linear-to-r from-indigo-600 to-purple-600 text-white p-4 sm:p-6 rounded-xl mb-4 sm:mb-6 shadow-lg">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                          <div className="flex-1">
                            <h3 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-2">
                              🎰{" "}
                              {maquina.maquina.nome || `Máquina ${index + 1}`}
                            </h3>
                            <p className="text-sm sm:text-lg opacity-90">
                              📋 Código:{" "}
                              <span className="font-mono font-bold">
                                {maquina.maquina.codigo}
                              </span>
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="bg-white/20 backdrop-blur-sm px-3 sm:px-4 py-2 rounded-lg">
                              <div className="text-xs sm:text-sm opacity-90">
                                Máquina
                              </div>
                              <div className="text-2xl sm:text-3xl font-bold">
                                {index + 1}/{relatorio.maquinas.length}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Totais da Máquina em destaque */}
                      <div className="mb-4 sm:mb-6">
                        <h4 className="text-base sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4 flex items-center gap-2">
                          <span className="text-xl sm:text-2xl">📊</span>
                          <span className="text-sm sm:text-base">
                            Resumo de Movimentações desta Máquina
                          </span>
                        </h4>
                        <div className="flex flex-wrap gap-4 sm:gap-6">
                          {/* Dinheiro máquina */}
                          <div className="bg-linear-to-br from-yellow-400 to-yellow-600 text-white p-3 sm:p-5 rounded-xl shadow-lg">
                            <div className="text-2xl sm:text-4xl mb-1 sm:mb-2 text-center">
                              💵
                            </div>
                            <div className="text-xl sm:text-3xl font-bold text-center">
                              R${" "}
                              {Number(
                                maquina.totais.dinheiro || 0,
                              ).toLocaleString("pt-BR", {
                                minimumFractionDigits: 2,
                              })}
                            </div>
                            <div className="text-xs sm:text-sm text-center mt-1 sm:mt-2 opacity-90">
                              Dinheiro
                            </div>
                          </div>
                          {/* Produtos Saíram */}
                          <div className="bg-linear-to-br from-red-500 to-red-600 text-white p-3 sm:p-5 rounded-xl shadow-lg">
                            <div className="text-2xl sm:text-4xl mb-1 sm:mb-2 text-center">
                              📤
                            </div>
                            <div className="text-xl sm:text-3xl font-bold text-center">
                              {Number(
                                resumoProdutosMaquina.totalQuantidadeItens || 0,
                              ).toLocaleString("pt-BR")}
                            </div>
                            <div className="text-xs sm:text-sm text-center mt-1 sm:mt-2 opacity-90">
                              Produtos Saíram
                            </div>
                            <div className="text-[10px] sm:text-xs text-center mt-1 opacity-90 leading-tight">
                              {resumoProdutosMaquina.itens.length > 0
                                ? resumoProdutosMaquina.itens
                                    .map((produto) =>
                                      produto?.nome
                                        ? `${produto.nome} (${Number(produto?.quantidade || 0).toLocaleString("pt-BR")})`
                                        : null,
                                    )
                                    .filter(Boolean)
                                    .join(" | ")
                                : "Sem detalhamento de produto"}
                            </div>
                          </div>
                          {/* Produtos Entraram */}
                          <div className="bg-linear-to-br from-green-500 to-green-600 text-white p-3 sm:p-5 rounded-xl shadow-lg">
                            <div className="text-2xl sm:text-4xl mb-1 sm:mb-2 text-center">
                              📥
                            </div>
                            <div className="text-xl sm:text-3xl font-bold text-center">
                              {Number(
                                maquina.totais.produtosEntraram || 0,
                              ).toLocaleString("pt-BR")}
                            </div>
                            <div className="text-xs sm:text-sm text-center mt-1 sm:mt-2 opacity-90">
                              Produtos Entraram
                            </div>
                          </div>
                          {/* Movimentações */}
                          <div className="bg-linear-to-br from-purple-500 to-purple-600 text-white p-3 sm:p-5 rounded-xl shadow-lg">
                            <div className="text-2xl sm:text-4xl mb-1 sm:mb-2 text-center">
                              🔄
                            </div>
                            <div className="text-xl sm:text-3xl font-bold text-center">
                              {maquina.totais.movimentacoes || 0}
                            </div>
                            <div className="text-xs sm:text-sm text-center mt-1 sm:mt-2 opacity-90">
                              Total de Movimentações
                            </div>
                          </div>
                          {/* Custo dos produtos que saíram */}
                          <div className="bg-linear-to-br from-purple-500 to-purple-600 text-white p-3 sm:p-5 rounded-xl shadow-lg">
                            <div className="text-2xl sm:text-4xl mb-1 sm:mb-2 text-center">
                              ➖💸
                            </div>
                            <div className="text-xl sm:text-3xl font-bold text-center">
                              R${" "}
                              {Number(
                                resumoProdutosMaquina.custoTotalItens || 0,
                              ).toLocaleString("pt-BR", {
                                minimumFractionDigits: 2,
                              })}
                            </div>
                            <div className="text-xs sm:text-sm text-center mt-1 sm:mt-2 opacity-90">
                              Custo dos Produtos que Saíram
                            </div>
                          </div>
                          {/* Lucro da Máquina */}
                          <div className="bg-linear-to-br from-yellow-500 to-orange-600 text-white p-3 sm:p-5 rounded-xl shadow-lg">
                            <div className="text-2xl sm:text-4xl mb-1 sm:mb-2 text-center">
                              💰
                            </div>
                            <div className="text-xl sm:text-3xl font-bold text-center">
                              R${" "}
                              {(() => {
                                const fichas = Number(
                                  maquina.totais.fichas || 0,
                                );
                                const valorFicha = Number(
                                  maquina.maquina?.valorFicha ||
                                    relatorio.loja?.valorFichaPadrao ||
                                    2.5,
                                );
                                return (fichas * valorFicha).toLocaleString(
                                  "pt-BR",
                                  { minimumFractionDigits: 2 },
                                );
                              })()}
                            </div>
                            <div className="text-xs sm:text-sm text-center mt-1 sm:mt-2 opacity-90">
                              Lucro da Máquina
                            </div>
                          </div>
                          {/* Lucro Líquido da Máquina */}
                          <div className="bg-linear-to-br from-green-700 to-green-400 text-white p-3 sm:p-5 rounded-xl shadow-lg">
                            <div className="text-2xl sm:text-4xl mb-1 sm:mb-2 text-center">
                              🟩
                            </div>
                            <div className="text-xl sm:text-3xl font-bold text-center">
                              R${" "}
                              {Number(
                                maquina.totais.lucroLiquido || 0,
                              ).toLocaleString("pt-BR", {
                                minimumFractionDigits: 2,
                              })}
                            </div>
                            <div className="text-xs sm:text-sm text-center mt-1 sm:mt-2 opacity-90">
                              Lucro Líquido da Máquina
                            </div>
                          </div>
                          {/* Ticket por Prêmio */}
                          <div className="bg-linear-to-br from-indigo-600 to-blue-700 text-white p-3 sm:p-5 rounded-xl shadow-lg">
                            <div className="text-2xl sm:text-4xl mb-1 sm:mb-2 text-center">
                              🎯
                            </div>
                            <div className="text-xl sm:text-3xl font-bold text-center">
                              R${" "}
                              {Number(
                                maquina.totais.ticketPorPremio || 0,
                              ).toLocaleString("pt-BR", {
                                minimumFractionDigits: 2,
                              })}
                            </div>
                            <div className="text-xs sm:text-sm text-center mt-1 sm:mt-2 opacity-90">
                              Ticket por Prêmio
                            </div>
                            <div className="text-[10px] sm:text-xs text-center mt-1 opacity-80">
                              Faturamento Bruto ÷ Produtos Saíram
                            </div>
                            <div className="text-[10px] sm:text-xs text-center mt-1 opacity-80">
                              {`R$ ${Number(maquina.totais.faturamentoBruto || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} / ${Number(resumoProdutosMaquina.totalQuantidadeItens || 0).toLocaleString("pt-BR")} saídas`}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Produtos da Máquina */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                        {/* Produtos que Saíram */}
                        <div className="bg-red-50 p-3 sm:p-5 rounded-xl border-2 border-red-200">
                          <h4 className="text-base sm:text-xl font-bold mb-3 sm:mb-4 flex items-center gap-2 bg-red-500 text-white p-2 sm:p-3 rounded-lg">
                            <span className="text-xl sm:text-2xl">📤</span>
                            <span className="text-sm sm:text-base">
                              Produtos que SAÍRAM
                            </span>
                            <span className="ml-auto bg-white text-red-500 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-bold">
                              {resumoProdutosMaquina.totalQuantidadeItens.toLocaleString(
                                "pt-BR",
                              )}
                            </span>
                          </h4>
                          {renderTabelaProdutosSaidos({
                            resumoProdutos: resumoProdutosMaquina,
                            contexto: `máquina ${maquina?.maquina?.codigo || ""}`,
                          })}
                        </div>

                        {/* Produtos que Entraram */}
                        <div className="bg-green-50 p-3 sm:p-5 rounded-xl border-2 border-green-200">
                          <h4 className="text-base sm:text-xl font-bold mb-3 sm:mb-4 flex items-center gap-2 bg-green-500 text-white p-2 sm:p-3 rounded-lg">
                            <span className="text-xl sm:text-2xl">📥</span>
                            <span className="text-sm sm:text-base">
                              Produtos que ENTRARAM
                            </span>
                            <span className="ml-auto bg-white text-green-500 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-bold">
                              {maquina.totais.produtosEntraram}
                            </span>
                          </h4>
                          {maquina.produtosEntraram &&
                          maquina.produtosEntraram.length > 0 ? (
                            <div className="space-y-2 sm:space-y-3">
                              {maquina.produtosEntraram
                                .sort((a, b) => b.quantidade - a.quantidade)
                                .map((produto) => (
                                  <div
                                    key={produto.id}
                                    className="bg-white p-3 sm:p-4 rounded-lg border-2 border-green-300 shadow-md"
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                                        <span className="text-2xl sm:text-4xl shrink-0">
                                          {produto.emoji || "📦"}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                          <div className="font-bold text-sm sm:text-lg text-gray-900 truncate">
                                            {produto.nome}
                                          </div>
                                          <div className="text-xs sm:text-sm text-gray-600 truncate">
                                            📋 Cód:{" "}
                                            <span className="font-mono">
                                              {produto.codigo || "S/C"}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                      <div className="bg-green-500 text-white px-3 sm:px-5 py-2 sm:py-3 rounded-xl font-bold text-base sm:text-xl shrink-0">
                                        {produto.quantidade.toLocaleString(
                                          "pt-BR",
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                            </div>
                          ) : (
                            <div className="text-center py-6 sm:py-8 bg-white rounded-lg">
                              <p className="text-4xl sm:text-6xl mb-2">📭</p>
                              <p className="text-sm sm:text-base text-gray-500 font-medium">
                                Nenhum produto entrou
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Separador entre máquinas */}
                      {index < relatorio.maquinas.length - 1 && (
                        <div className="mt-8 pt-6 border-t-4 border-dashed border-gray-300">
                          <p className="text-center text-gray-500 text-sm font-medium">
                            ⬇️ Próxima Máquina ⬇️
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Gráfico de saída por máquina */}
            {relatorio.graficoSaidaPorMaquina &&
              relatorio.graficoSaidaPorMaquina.length > 0 && (
                <div className="card bg-linear-to-r from-blue-50 to-blue-100 border-2 border-blue-300 mt-8">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <span className="text-2xl">📊</span>
                    Gráfico: Saída de Produtos por Máquina
                  </h3>
                  <div className="flex flex-wrap gap-4 items-end">
                    {(() => {
                      const maxSairam = Math.max(
                        ...relatorio.graficoSaidaPorMaquina.map(
                          (i) => i.produtosSairam,
                        ),
                        1,
                      );
                      const MAX_BAR_HEIGHT = 200;
                      return relatorio.graficoSaidaPorMaquina.map((item) => {
                        const barHeight = Math.max(
                          (item.produtosSairam / maxSairam) * MAX_BAR_HEIGHT,
                          4,
                        );
                        return (
                          <div
                            key={item.maquina}
                            className="flex flex-col items-center"
                          >
                            <div className="font-bold text-lg text-blue-700">
                              {item.maquina}
                            </div>
                            <div
                              className="w-12 flex items-end"
                              style={{ height: MAX_BAR_HEIGHT }}
                            >
                              <div
                                style={{
                                  height: `${barHeight}px`,
                                  background: "#1976d2",
                                  width: "100%",
                                  borderRadius: 4,
                                }}
                              ></div>
                            </div>
                            <div className="text-sm text-gray-700 mt-2">
                              {item.produtosSairam} saíram
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}
            {/* Gráfico de saída por produto */}
            {relatorio.graficoSaidaPorProduto &&
              relatorio.graficoSaidaPorProduto.length > 0 && (
                <div className="card bg-linear-to-r from-green-50 to-green-100 border-2 border-green-300 mt-8">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <span className="text-2xl">📦</span>
                    Gráfico: Saída de Produtos por Tipo
                  </h3>
                  <div className="flex flex-wrap gap-4 items-end">
                    {(() => {
                      const maxQtd = Math.max(
                        ...relatorio.graficoSaidaPorProduto.map(
                          (i) => i.quantidade,
                        ),
                        1,
                      );
                      const MAX_BAR_HEIGHT = 200;
                      return relatorio.graficoSaidaPorProduto.map((item) => {
                        const barHeight = Math.max(
                          (item.quantidade / maxQtd) * MAX_BAR_HEIGHT,
                          4,
                        );
                        return (
                          <div
                            key={item.produto}
                            className="flex flex-col items-center"
                          >
                            <div className="font-bold text-lg text-green-700">
                              {item.produto}
                            </div>
                            <div
                              className="w-12 flex items-end"
                              style={{ height: MAX_BAR_HEIGHT }}
                            >
                              <div
                                style={{
                                  height: `${barHeight}px`,
                                  background: "#43a047",
                                  width: "100%",
                                  borderRadius: 4,
                                }}
                              ></div>
                            </div>
                            <div className="text-sm text-gray-700 mt-2">
                              {item.quantidade} saíram
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}
            {/* Consolidado Geral de Produtos */}
            <div className="card bg-linear-to-r from-amber-50 to-orange-100 border-2 border-orange-300">
              <h3 className="text-2xl font-bold text-gray-900 mb-2 flex items-center gap-2">
                <span className="text-3xl">📊</span>
                Consolidado Geral de Produtos
              </h3>
              <p className="text-sm text-gray-600 mb-6">
                Resumo de todos os produtos (todas as máquinas somadas)
              </p>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Produtos que Saíram - Consolidado */}
                <div>
                  <h4 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <span className="text-2xl">📤</span>
                    Produtos que Saíram (Total Geral)
                  </h4>
                  {renderTabelaProdutosSaidos({
                    resumoProdutos: resumoProdutosConsolidado,
                    contexto: "consolidado",
                    exibirConferencia: false,
                  })}
                </div>

                {/* Produtos que Entraram - Consolidado */}
                <div>
                  <h4 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <span className="text-2xl">📥</span>
                    Produtos que Entraram (Total Geral)
                  </h4>
                  {relatorio.produtosEntraram &&
                  relatorio.produtosEntraram.length > 0 ? (
                    <div className="space-y-2">
                      {relatorio.produtosEntraram
                        .sort((a, b) => b.quantidade - a.quantidade)
                        .map((produto) => (
                          <div
                            key={produto.id}
                            className="p-3 bg-white border-2 border-green-200 rounded-lg"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-2xl">
                                  {produto.emoji || "📦"}
                                </span>
                                <div>
                                  <div className="font-bold text-gray-900">
                                    {produto.nome}
                                  </div>
                                  <div className="text-xs text-gray-600">
                                    Cód: {produto.codigo || "S/C"}
                                  </div>
                                </div>
                              </div>
                              <span className="bg-green-500 text-white px-3 py-1 rounded-full font-bold">
                                {produto.quantidade.toLocaleString("pt-BR")}
                              </span>
                            </div>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-4xl mb-2">📭</p>
                      <p className="text-gray-600">Nenhum produto entrou</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Dias sem movimentação por loja (roteiro) */}
            {relatorio && relatorio.lojas && roteiroSelecionado && (
              <div className="mt-8">
                <h3 className="text-lg font-bold mb-4">
                  Dias sem movimentação por loja
                </h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full border text-xs">
                    <thead>
                      <tr className="bg-gray-200">
                        <th className="border px-2 py-1">Loja</th>
                        <th className="border px-2 py-1">
                          Dias sem movimentação
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {relatorio.lojas.map((loja, idx) => (
                        <tr key={loja.id || loja.nome || idx}>
                          <td className="border px-2 py-1 font-semibold">
                            {loja.nome || `Loja ${idx + 1}`}
                          </td>
                          <td className="border px-2 py-1">
                            {loja.diasSemMovimentacao &&
                            loja.diasSemMovimentacao.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {loja.diasSemMovimentacao.map((dia, i) => (
                                  <span
                                    key={dia + "-" + i}
                                    className="bg-red-200 text-red-800 rounded px-2 py-0.5 text-xs font-bold"
                                  >
                                    {dia}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="bg-green-100 text-green-800 rounded px-2 py-0.5 text-xs">
                                Sem dias sem movimentação
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Estado Vazio */}
        {!relatorio && !loading && !error && (
          <div className="text-center py-12 card">
            <p className="text-6xl mb-4">📄</p>
            <p className="text-gray-600 text-lg">
              Selecione uma loja e o período para gerar o relatório
            </p>
          </div>
        )}
      </div>

      <Footer />

      {/* Estilos de Impressão */}
      <style>{`
        @media print {
          .no-print, nav, footer {
            display: none !important;
          }
          
          body {
            background: white !important;
          }
          
          .card {
            page-break-inside: avoid;
            box-shadow: none !important;
            border: 1px solid #e5e7eb;
          }
          
          .page-break-before {
            page-break-before: always;
          }
          
          .print-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            color: white !important;
          }
          
          .bg-linear-to-br, .bg-linear-to-r {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          
          .from-blue-500, .to-blue-600,
          .from-red-500, .to-red-600,
          .from-green-500, .to-green-600,
          .from-purple-500, .to-purple-600,
          .from-indigo-500, .to-indigo-500 {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          
          .bg-blue-50, .bg-red-50, .bg-green-50, .bg-purple-50, .bg-gray-50 {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          
          .border-blue-200, .border-red-200, .border-green-200, .border-purple-200 {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          
          @page {
            margin: 1.5cm;
            size: A4;
          }
          
          h1, h2, h3, h4 {
            page-break-after: avoid;
          }
          
          .grid {
            page-break-inside: avoid;
          }
        }
      `}</style>
    </div>
  );
}

export default Relatorios;
// Fim do componente Relatorios

import { useState, useEffect, useCallback, useMemo } from "react";
import api from "../services/api";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer.jsx";
import { PageHeader } from "../components/UIComponents";
import { PageLoader } from "../components/Loading";
import {
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
  Cell,
  LabelList,
  ReferenceLine,
} from "recharts";

export function Graficos() {
  const [loading, setLoading] = useState(true);
  const [lojas, setLojas] = useState([]);
  const [lojaSelecionada, setLojaSelecionada] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [dadosDashboard, setDadosDashboard] = useState(null);
  const [dadosRelatorio, setDadosRelatorio] = useState(null);
  const [erro, setErro] = useState("");
  const [custosExtras, setCustosExtras] = useState(0);
  const [custoQuebraCaixa, setCustoQuebraCaixa] = useState(0);
  const toNumber = (valor) => Number(valor || 0);

  const calcularQuebraCaixaComoCusto = (fluxos = [], lojaIdAlvo = null) => {
    const alvo = lojaIdAlvo === null || lojaIdAlvo === undefined ? null : String(lojaIdAlvo);

    return (Array.isArray(fluxos) ? fluxos : []).reduce((acc, fluxo) => {
      const lojaDoFluxo = String(
        fluxo?.lojaId ||
          fluxo?.movimentacao?.maquina?.lojaId ||
          fluxo?.movimentacao?.maquina?.loja?.id ||
          "",
      );

      // Segurança extra: desconta quebra apenas da loja selecionada nos filtros.
      if (alvo && lojaDoFluxo !== alvo) {
        return acc;
      }

      const temDiferencaDireta =
        fluxo?.diferenca !== null &&
        fluxo?.diferenca !== undefined &&
        fluxo?.diferenca !== "";

      const diferenca = temDiferencaDireta
        ? toNumber(fluxo?.diferenca)
        : toNumber(fluxo?.valorRetirado) -
          toNumber(fluxo?.valorEsperado ?? fluxo?.movimentacao?.valorFaturado);

      return diferenca < 0 ? acc + Math.abs(diferenca) : acc;
    }, 0);
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
      nome:
        produtoId === "__SEM_DETALHE__"
          ? "Produto não detalhado (legado)"
          : String(produto?.nome || "").trim() || "Produto sem nome",
      codigo: String(produto?.codigo || "").trim() || "S/C",
      quantidade: toNumber(produto?.quantidade),
      valorUnitario: toNumber(
        produto?.valorUnitario ?? produto?.custoUnitario ?? produto?.preco,
      ),
      valorTotal: toNumber(produto?.valorTotal),
    };
  };

  const calcularResumoProdutos = (produtosSairam = [], totais = {}) => {
    const itens = (Array.isArray(produtosSairam) ? produtosSairam : []).map(
      normalizarProdutoSaida,
    );

    return {
      itens,
      totalQuantidadeItens: itens.reduce(
        (acc, item) => acc + toNumber(item?.quantidade),
        0,
      ),
      custoTotalItens: itens.reduce(
        (acc, item) => acc + toNumber(item?.valorTotal),
        0,
      ),
      totalQuantidadeDeclarado: toNumber(totais?.produtosSairam),
      custoTotalDeclarado: toNumber(totais?.custoProdutosSairam),
    };
  };

  const resumoProdutosGraficos = useMemo(() => {
    const produtosDireto = Array.isArray(dadosRelatorio?.produtosSairam)
      ? dadosRelatorio.produtosSairam
      : [];

    const produtosPorMaquina = Array.isArray(dadosRelatorio?.maquinas)
      ? dadosRelatorio.maquinas.flatMap((maquina) =>
          Array.isArray(maquina?.produtosSairam) ? maquina.produtosSairam : [],
        )
      : [];

    const produtos =
      produtosDireto.length > 0 ? produtosDireto : produtosPorMaquina;

    return calcularResumoProdutos(produtos, {
      produtosSairam:
        dadosRelatorio?.totais?.produtosSairam ?? dadosDashboard?.totais?.saidas,
      custoProdutosSairam: dadosRelatorio?.totais?.custoProdutosSairam,
    });
  }, [dadosRelatorio, dadosDashboard]);

  const topProdutosVendidos = useMemo(() => {
    const mapa = new Map();

    resumoProdutosGraficos.itens.forEach((item) => {
      const chave = item?.produtoId || item?.nome;
      const atual = mapa.get(chave) || {
        nome: item?.nome || "Produto",
        quantidade: 0,
      };

      atual.quantidade += toNumber(item?.quantidade);
      mapa.set(chave, atual);
    });

    return Array.from(mapa.values())
      .filter((item) => item.quantidade > 0)
      .sort((a, b) => b.quantidade - a.quantidade)
      .slice(0, 10);
  }, [resumoProdutosGraficos]);

  // Faturamento real — usa o valor que o backend calcula diretamente
  const faturamentoReal = useMemo(() => {
    if (!dadosDashboard?.totais) return 0;
    return parseFloat(dadosDashboard.totais.faturamento || 0);
  }, [dadosDashboard]);

  // Custo de produtos saídos alinhado ao relatório: soma de valorTotal dos itens.
  const custoProdutos = useMemo(() => {
    if (resumoProdutosGraficos.itens.length > 0) {
      return resumoProdutosGraficos.custoTotalItens;
    }

    return resumoProdutosGraficos.custoTotalDeclarado;
  }, [resumoProdutosGraficos]);

  // Custo total = produtos saídos + custos fixos/variáveis digitados pelo usuário
  const custoTotal = useMemo(() => {
    return custoProdutos + custosExtras + custoQuebraCaixa;
  }, [custoProdutos, custosExtras, custoQuebraCaixa]);

  // Lucro Líquido = faturamento − custo produtos (saidas × preço médio) − fixos/variáveis digitados
  const lucroTotal = useMemo(() => {
    return faturamentoReal - custoProdutos - custosExtras - custoQuebraCaixa;
  }, [faturamentoReal, custoProdutos, custosExtras, custoQuebraCaixa]);

  // Dados do gráfico com custos extras incorporados (NUNCA altera faturamento) + lucro por dia
  const graficoComCustosExtras = useMemo(() => {
    if (
      !dadosDashboard?.graficoFinanceiro ||
      dadosDashboard.graficoFinanceiro.length === 0
    )
      return [];

    const totalFat = dadosDashboard.graficoFinanceiro.reduce(
      (s, d) => s + (parseFloat(d.faturamento) || 0),
      0,
    );

    return dadosDashboard.graficoFinanceiro.map((d) => {
      const fatDia = parseFloat(d.faturamento) || 0;
      const proporcao =
        totalFat > 0 ? fatDia / totalFat : 1 / dadosDashboard.graficoFinanceiro.length;
      const custoDia =
        custoProdutos * proporcao +
        custosExtras * proporcao +
        custoQuebraCaixa * proporcao;

      return {
        ...d,
        faturamento: fatDia,
        custo: custoDia,
        lucro: Math.max(0, fatDia - custoDia),
      };
    });
  }, [dadosDashboard, custoProdutos, custosExtras, custoQuebraCaixa]);

  // Configuração inicial de datas (últimos 30 dias)
  useEffect(() => {
    carregarLojas();
    const hoje = new Date();
    const trintaDiasAtras = new Date();
    trintaDiasAtras.setDate(hoje.getDate() - 30);
    setDataFim(hoje.toISOString().split("T")[0]);
    setDataInicio(trintaDiasAtras.toISOString().split("T")[0]);
  }, []);

  // Busca de Lojas para o Dropdown
  const carregarLojas = async () => {
    try {
      const response = await api.get("/lojas");
      setLojas(response.data || []);
      if (response.data && response.data.length > 0) {
        setLojaSelecionada(response.data[0].id);
      }
    } catch (error) {
      console.error("Erro ao carregar lojas:", error);
      setErro("Erro ao carregar lista de pontos.");
    }
  };

  // Nova função otimizada: busca dados já processados do Backend
  const carregarDados = useCallback(async () => {
    if (!lojaSelecionada || !dataInicio || !dataFim) return;

    setErro("");
    setLoading(true);

    try {
      const [responseDashboard, responseRelatorio] = await Promise.all([
        api.get("/relatorios/dashboard", {
          params: { lojaId: lojaSelecionada, dataInicio, dataFim },
        }),
        api
          .get("/relatorios/impressao", {
            params: { lojaId: lojaSelecionada, dataInicio, dataFim },
          })
          .catch(() => ({ data: null })),
      ]);

      let quebraPeriodo = 0;
      try {
        const fluxoResponse = await api.get("/fluxo-caixa", {
          params: { lojaId: lojaSelecionada, dataInicio, dataFim },
        });

        const fluxos = Array.isArray(fluxoResponse?.data)
          ? fluxoResponse.data
          : fluxoResponse?.data?.rows || fluxoResponse?.data?.fluxos || [];

        quebraPeriodo = calcularQuebraCaixaComoCusto(fluxos, lojaSelecionada);
      } catch {
        quebraPeriodo = 0;
      }

      setDadosDashboard(responseDashboard.data);
      setDadosRelatorio(responseRelatorio.data);
      setCustoQuebraCaixa(quebraPeriodo);
    } catch (error) {
      console.error("Erro ao carregar dashboard:", error);
      setErro("Não foi possível carregar os dados do painel.");
      setDadosDashboard(null);
      setDadosRelatorio(null);
      setCustoQuebraCaixa(0);
    } finally {
      setLoading(false);
    }
  }, [lojaSelecionada, dataInicio, dataFim]);

  // Atualiza quando filtros mudam
  useEffect(() => {
    if (lojaSelecionada && dataInicio && dataFim) {
      if (new Date(dataInicio) > new Date(dataFim)) {
        setErro("A data inicial não pode ser maior que a data final.");
        return;
      }
      carregarDados();
    }
  }, [lojaSelecionada, dataInicio, dataFim, carregarDados]);

  // Formatação de Moeda
  const formatMoney = (val) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(val || 0);

  // Calcula a margem de lucro para exibição (caso o backend não envie explicito)
  const calcularMargem = (lucro, faturamento) => {
    if (!faturamento || faturamento === 0) return 0;
    return ((lucro / faturamento) * 100).toFixed(1);
  };

  if (loading && !dadosDashboard) return <PageLoader />;

  return (
    <div className="min-h-screen bg-gray-50 bg-pattern teddy-pattern">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title="Painel de Controle e Gráficos"
          subtitle="Visão estratégica do seu negócio"
          icon="📊"
        />

        {/* Filtros */}
        <div className="bg-white rounded-lg shadow p-6 mb-8 border border-gray-100">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Loja
              </label>
              <select
                value={lojaSelecionada}
                onChange={(e) => setLojaSelecionada(e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border"
              >
                {lojas.map((loja) => (
                  <option key={loja.id} value={loja.id}>
                    {loja.nome}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Data Inicial
              </label>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Data Final
              </label>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border"
              />
            </div>
          </div>
        </div>

        {erro && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 text-red-700">
            <p className="font-bold">Atenção</p>
            <p>{erro}</p>
          </div>
        )}

        {dadosDashboard && (
          <div className="space-y-8 animate-fade-in">
            {/* 1. KPI Cards - Indicadores Principais */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Faturamento */}
              <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-green-500">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                      Faturamento
                    </p>
                    <h3 className="text-2xl font-bold text-gray-900 mt-1">
                      {formatMoney(faturamentoReal)}
                    </h3>
                  </div>
                  <span className="p-2 bg-green-100 text-green-600 rounded-lg text-xl">
                    💰
                  </span>
                </div>
              </div>

              {/* Dinheiro */}
              <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-yellow-500">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                      Dinheiro
                    </p>
                    <h3 className="text-2xl font-bold text-gray-900 mt-1">
                      {formatMoney(dadosDashboard?.totais?.dinheiro || 0)}
                    </h3>
                  </div>
                  <span className="p-2 bg-yellow-100 text-yellow-600 rounded-lg text-xl">
                    💵
                  </span>
                </div>
              </div>

              {/* Pix */}
              <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-cyan-500">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                      Pix
                    </p>
                    <h3 className="text-2xl font-bold text-gray-900 mt-1">
                      {formatMoney(dadosDashboard?.totais?.pix || 0)}
                    </h3>
                  </div>
                  <span className="p-2 bg-cyan-100 text-cyan-600 rounded-lg text-xl">
                    🟢
                  </span>
                </div>
              </div>

              {/* Custos Totais */}
              <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-red-500">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                      Custos Totais
                    </p>
                    <h3 className="text-2xl font-bold text-red-600 mt-1">
                      {formatMoney(custoTotal)}
                    </h3>
                    <div className="flex flex-col gap-0.5 mt-2 text-xs text-gray-500">
                      <span>🧸 Produtos saídos: {formatMoney(custoProdutos)}</span>
                      {custoQuebraCaixa > 0 && (
                        <span>💥 Quebra de caixa: {formatMoney(custoQuebraCaixa)}</span>
                      )}
                      {custosExtras > 0 && <span>📋 Fixos/Variáveis: {formatMoney(custosExtras)}</span>}
                    </div>
                  </div>
                  <span className="p-2 bg-red-100 text-red-600 rounded-lg text-xl">
                    📉
                  </span>
                </div>
              </div>

              {/* Lucro Líquido */}
              <div className={`bg-white p-6 rounded-lg shadow-md border-l-4 ${lucroTotal >= 0 ? 'border-emerald-500' : 'border-red-500'}`}>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                      Lucro Líquido
                    </p>
                    <h3 className={`text-2xl font-bold mt-1 ${lucroTotal >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {formatMoney(lucroTotal)}
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">
                      Margem: {calcularMargem(lucroTotal, faturamentoReal)}%
                    </p>
                    {/* Breakdown custos simples */}
                    {(custoProdutos > 0 || custosExtras > 0 || custoQuebraCaixa > 0) && (
                      <div className="mt-2 pt-2 border-t border-gray-100 flex flex-col gap-0.5 text-xs text-gray-500">
                        <span className="font-semibold text-gray-700">Composição dos custos:</span>
                        {custoProdutos > 0 && (
                          <span>🧸 Produtos saídos: <strong className="text-red-600">{formatMoney(custoProdutos)}</strong></span>
                        )}
                        {custoQuebraCaixa > 0 && (
                          <span>💥 Quebra de caixa: <strong className="text-red-600">{formatMoney(custoQuebraCaixa)}</strong></span>
                        )}
                        {custosExtras > 0 && (
                          <span>📋 Fixos/Variáveis: <strong className="text-red-600">{formatMoney(custosExtras)}</strong></span>
                        )}
                      </div>
                    )}
                  </div>
                  <span className={`p-2 rounded-lg text-xl ${lucroTotal >= 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                    {lucroTotal >= 0 ? '📈' : '📉'}
                  </span>
                </div>
              </div>

              {/* Prêmios Entregues */}
              <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-orange-500">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                      Prêmios Entregues
                    </p>
                    <h3 className="text-2xl font-bold text-gray-900 mt-1">
                      {Number(
                        resumoProdutosGraficos.itens.length > 0
                          ? resumoProdutosGraficos.totalQuantidadeItens
                          : resumoProdutosGraficos.totalQuantidadeDeclarado ||
                              dadosDashboard?.totais?.saidas ||
                              0,
                      ).toLocaleString("pt-BR")}
                    </h3>
                  </div>
                  <span className="p-2 bg-orange-100 text-orange-600 rounded-lg text-xl">
                    🧸
                  </span>
                </div>
              </div>
            </div>

            {/* Custos Variáveis / Fixos (input) */}
            <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-gray-400">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                    Custos Variáveis / Fixos (R$)
                  </p>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={custosExtras || ''}
                    onChange={e => setCustosExtras(parseFloat(e.target.value) || 0)}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border text-lg font-bold"
                    placeholder="Digite custos extras (aluguel, etc)"
                  />
                  <p className="text-xs text-gray-400 mt-1">Será somado aos custos e subtraído do lucro</p>
                </div>
                <div className="text-sm text-gray-600">
                  <p className="font-semibold mb-1">Composição dos Custos:</p>
                  <p>🧸 Produtos saídos: <strong>{formatMoney(custoProdutos)}</strong></p>
                  <p>💥 Quebra de caixa: <strong>{formatMoney(custoQuebraCaixa)}</strong></p>
                  <p>📋 Fixos/Variáveis: <strong>{formatMoney(custosExtras)}</strong></p>
                  <p className="mt-1 pt-1 border-t font-bold">Total: {formatMoney(custoTotal)}</p>
                </div>
              </div>
            </div>

            {/* 2. Gráfico de Evolução Financeira */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-bold text-gray-800 mb-2 flex items-center">
                  <span className="bg-gray-100 p-1 rounded mr-2">📅</span>
                  Evolução Diária
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  Faturamento total no período: <strong className="text-green-600">{formatMoney(faturamentoReal)}</strong>
                </p>
                <div className="h-80 w-full">
                    {(!graficoComCustosExtras || graficoComCustosExtras.length === 0) ? (
                      <>
                        <div className="mt-8 mb-4 p-6 rounded-xl shadow-lg bg-linear-to-br from-yellow-400 to-orange-500 text-white flex flex-col items-center justify-center">
                          <h4 className="text-xl font-bold mb-2 flex items-center gap-2">
                            <span className="bg-white/30 p-2 rounded-full">📈</span>
                            Comparativo de Lucro Mensal
                          </h4>
                          {(() => {
                            const hoje = new Date();
                            const diaAtual = hoje.getDate();
                            const mesAtual = hoje.getMonth() + 1;
                            const anoAtual = hoje.getFullYear();
                            function getLucroPeriodo(dados, ano, mes, dias) {
                              let total = 0;
                              for (let d = 1; d <= dias; d++) {
                                const dataStr = `${ano}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                                total += Number(dados.lucroPorDia?.[dataStr] || 0);
                              }
                              return total;
                            }
                            const lucroPeriodoAtual = getLucroPeriodo(dadosDashboard, anoAtual, mesAtual, diaAtual);
                            const mesAnterior = mesAtual === 1 ? 12 : mesAtual - 1;
                            const anoMesAnterior = mesAtual === 1 ? anoAtual - 1 : anoAtual;
                            const lucroPeriodoAnterior = getLucroPeriodo(dadosDashboard, anoMesAnterior, mesAnterior, diaAtual);
                            const diff = lucroPeriodoAtual - lucroPeriodoAnterior;
                            const percent = lucroPeriodoAnterior > 0 ? (diff / lucroPeriodoAnterior) * 100 : 0;
                            return (
                              <div className="flex flex-col items-center justify-center w-full">
                                <div className="text-3xl font-extrabold mb-2">
                                  R$ {lucroPeriodoAtual.toLocaleString("pt-BR", {minimumFractionDigits: 2})}
                                </div>
                                <div className="text-lg font-semibold mb-1">
                                  {lucroPeriodoAnterior > 0 ? (
                                    <span className={percent >= 0 ? "text-green-200" : "text-red-200"}>
                                      {percent >= 0 ? "▲" : "▼"} {Math.abs(percent).toFixed(1)}%
                                    </span>
                                  ) : (
                                    <span className="text-white/80">(Sem dados do mês passado)</span>
                                  )}
                                </div>
                                <div className="text-sm text-white/80">
                                  <span>Lucro até hoje vs mês passado</span><br />
                                  <span>(R$ {lucroPeriodoAtual.toLocaleString("pt-BR", {minimumFractionDigits: 2})} vs R$ {lucroPeriodoAnterior.toLocaleString("pt-BR", {minimumFractionDigits: 2})})</span>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                        <div className="flex items-center justify-center h-full text-gray-400">
                          <p>Sem dados para o período selecionado</p>
                        </div>
                      </>
                    ) : (
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                    <AreaChart data={graficoComCustosExtras}>
                      <defs>
                        <linearGradient
                          id="colorFat"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="#10B981"
                            stopOpacity={0.8}
                          />
                          <stop
                            offset="95%"
                            stopColor="#10B981"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="data"
                        tickFormatter={(str) =>
                          new Date(str).toLocaleDateString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                          })
                        }
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip
                        formatter={(value) => formatMoney(value)}
                        labelFormatter={(label) =>
                          new Date(label).toLocaleDateString("pt-BR")
                        }
                      />
                      <Legend />
                      <Area
                        type="monotone"
                        dataKey="faturamento"
                        name="Faturamento"
                        stroke="#10B981"
                        fillOpacity={1}
                        fill="url(#colorFat)"
                      />
                      <Area
                        type="monotone"
                        dataKey="custo"
                        name="Custo"
                        stroke="#EF4444"
                        fillOpacity={0.3}
                        fill="#EF4444"
                      />
                      <Area
                        type="monotone"
                        dataKey="lucro"
                        name="Lucro"
                        stroke="#8B5CF6"
                        fillOpacity={0.2}
                        fill="#8B5CF6"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* 3. Performance por Máquina */}
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-bold text-gray-800 mb-2 flex items-center">
                  <span className="bg-gray-100 p-1 rounded mr-2">🤖</span>
                  Performance por Máquina
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  Total faturado: <strong className="text-green-600">{formatMoney(faturamentoReal)}</strong>
                </p>
                <div className="h-80 w-full">
                  {(!dadosDashboard.performanceMaquinas || dadosDashboard.performanceMaquinas.length === 0) ? (
                    <div className="flex items-center justify-center h-full text-gray-400">
                      <p>Sem dados de máquinas para o período</p>
                    </div>
                  ) : (
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                    <BarChart
                      data={dadosDashboard.performanceMaquinas}
                      layout="vertical"
                      margin={{ top: 5, right: 110, left: 40, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" />
                      <YAxis
                        dataKey="nome"
                        type="category"
                        width={100}
                        tick={{ fontSize: 11 }}
                      />
                      <Tooltip
                        cursor={{ fill: "transparent" }}
                        formatter={(value, name) => [
                          formatMoney(value),
                          "Faturamento",
                        ]}
                      />
                      <Legend />
                      <Bar
                        dataKey="faturamento"
                        name="Faturamento"
                        fill="#3B82F6"
                        radius={[0, 4, 4, 0]}
                        barSize={20}
                      >
                        <LabelList
                          dataKey="faturamento"
                          position="right"
                          formatter={(v) => formatMoney(v)}
                          style={{ fontSize: 11, fill: "#374151", fontWeight: 600 }}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>

            {/* 4. Ranking de Produtos e Ocupação */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Top Produtos */}
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                  <span className="bg-gray-100 p-1 rounded mr-2">🏆</span>
                  Top Produtos Vendidos
                </h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Produto
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                          Qtd
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Popularidade
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {topProdutosVendidos.map((prod, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                            {idx + 1}. {prod.nome}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 text-right">
                            {Number(prod.quantidade || 0).toLocaleString("pt-BR")}
                          </td>
                          <td className="px-4 py-3">
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-indigo-600 h-2 rounded-full"
                                style={{
                                  width: `${Math.min(
                                    (prod.quantidade /
                                      (topProdutosVendidos?.[0]?.quantidade || 1)) *
                                      100,
                                    100,
                                  )}%`,
                                }}
                              ></div>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {topProdutosVendidos.length === 0 && (
                        <tr>
                          <td
                            colSpan={3}
                            className="px-4 py-4 text-sm text-gray-500 text-center"
                          >
                            Sem quantidade de produtos saídos no período.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Box comparativo de lucro mensal - separada, maior e estilizada */}
              <div className="mt-8 mb-4 p-8 rounded-2xl shadow-2xl bg-gradient-to-br from-yellow-400 via-orange-400 to-orange-600 text-white flex flex-col items-center justify-center border-4 border-yellow-500">
                <h4 className="text-3xl font-extrabold mb-4 flex items-center gap-3 drop-shadow-lg">
                  <span className="bg-white/30 p-3 rounded-full text-4xl">📈</span>
                  Comparativo de Lucro Mensal
                </h4>
                {(() => {
                  // Calcular faturamento do mês atual e do mês passado até o mesmo dia
                  const hoje = new Date();
                  const diaAtual = hoje.getDate();
                  const mesAtual = hoje.getMonth() + 1;
                  const anoAtual = hoje.getFullYear();
                  function getFaturamentoPeriodo(dados, ano, mes, dias) {
                    let total = 0;
                    for (let d = 1; d <= dias; d++) {
                      const dataStr = `${ano}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                      total += Number(dados.faturamentoPorDia?.[dataStr] || 0);
                    }
                    return total;
                  }
                  // Se não existir faturamentoPorDia, usar faturamentoReal para o mês atual
                  let faturamentoAtual = 0;
                  let faturamentoAnterior = 0;
                  if (dadosDashboard?.faturamentoPorDia) {
                    faturamentoAtual = getFaturamentoPeriodo(dadosDashboard, anoAtual, mesAtual, diaAtual);
                    const mesAnterior = mesAtual === 1 ? 12 : mesAtual - 1;
                    const anoMesAnterior = mesAtual === 1 ? anoAtual - 1 : anoAtual;
                    faturamentoAnterior = getFaturamentoPeriodo(dadosDashboard, anoMesAnterior, mesAnterior, diaAtual);
                  } else {
                    faturamentoAtual = faturamentoReal;
                    faturamentoAnterior = 0;
                  }
                  const percent = faturamentoAnterior > 0 ? ((faturamentoAtual - faturamentoAnterior) / faturamentoAnterior) * 100 : 0;
                  return (
                    <div className="flex flex-col items-center justify-center w-full">
                      <div className="text-5xl font-extrabold mb-2 drop-shadow-xl">
                        {formatMoney(faturamentoAtual)}
                      </div>
                      <div className="text-2xl font-bold mb-2">
                        {faturamentoAnterior > 0 ? (
                          <span className={percent >= 0 ? "text-green-200" : "text-red-200"}>
                            {percent >= 0 ? "▲" : "▼"} {Math.abs(percent).toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-white/80">(Sem dados do mês passado)</span>
                        )}
                      </div>
                      <div className="text-lg text-white/80 mb-2">
                        <span>Faturamento até hoje vs mês passado</span><br />
                        <span>(
                          {formatMoney(faturamentoAtual)} vs {formatMoney(faturamentoAnterior)}
                        )</span>
                      </div>
                      {/* Detalhamento dos descontos do lucro */}
                      <div className="mt-4 p-4 rounded-xl bg-white/20 text-white text-base w-full max-w-md">
                        <div className="font-bold mb-2">Descontos considerados no lucro:</div>
                        <ul className="list-disc pl-5">
                          <li>Produtos saídos: <span className="font-semibold">{formatMoney(custoProdutos)}</span></li>
                          <li>Custos extras (fixos/variáveis): <span className="font-semibold">{formatMoney(custosExtras)}</span></li>
                          <li>Outros custos totais: <span className="font-semibold">{formatMoney(custoTotal)}</span></li>
                        </ul>
                        <div className="text-sm mt-2 text-white/80">O lucro é calculado descontando todos os custos acima do faturamento.</div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Status de Ocupação (Estoque) */}
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center">
                  <span className="bg-gray-100 p-1 rounded mr-2">📦</span>
                  Nível de Estoque (%)
                </h3>
                <div className="h-80 w-full">
                  {(!dadosDashboard.performanceMaquinas || dadosDashboard.performanceMaquinas.length === 0) ? (
                    <div className="flex items-center justify-center h-full text-gray-400">
                      <p>Sem dados de estoque</p>
                    </div>
                  ) : (
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                    <BarChart
                      data={dadosDashboard.performanceMaquinas}
                      margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="nome"
                        tick={{ fontSize: 10 }}
                        interval={0}
                      />
                      <YAxis domain={[0, 100]} />
                      <Tooltip formatter={(val) => `${val}%`} />
                      <Bar
                        dataKey="ocupacao"
                        name="Ocupação"
                        radius={[4, 4, 0, 0]}
                      >
                        {(dadosDashboard.performanceMaquinas || []).map(
                          (entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={
                                (parseFloat(entry.ocupacao) || 0) < 30
                                  ? "#EF4444" // Crítico
                                  : (parseFloat(entry.ocupacao) || 0) < 60
                                    ? "#F59E0B" // Atenção
                                    : "#10B981" // Bom
                              }
                            />
                          ),
                        )}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}

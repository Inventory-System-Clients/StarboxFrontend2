import { useState } from "react";

const formatarMoeda = (valor) =>
  `R$ ${Number(valor || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
  })}`;

const formatarPercentual = (valor) => `${Number(valor || 0).toFixed(2)}%`;

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
  if (status === "melhor") {
    return {
      card: "bg-emerald-50 border-emerald-300",
      texto: "text-emerald-700",
      icone: "▲",
    };
  }

  if (status === "pior") {
    return {
      card: "bg-red-50 border-red-300",
      texto: "text-red-700",
      icone: "▼",
    };
  }

  return {
    card: "bg-slate-50 border-slate-300",
    texto: "text-slate-700",
    icone: "●",
  };
};

const calcularLargura = (valor, maximo) => {
  if (!maximo || maximo <= 0) return "0%";
  const percentual = (Number(valor || 0) / maximo) * 100;
  return `${Math.max(percentual, 4).toFixed(2)}%`;
};

const GraficoBarras = ({
  titulo,
  itens,
  chaveNome,
  chaveValor,
  classeBarra,
  formatter,
  vazio,
}) => {
  const maximo = Math.max(
    ...(itens || []).map((item) => Number(item[chaveValor] || 0)),
    0,
  );

  return (
    <div className="card bg-white border border-gray-200">
      <h4 className="text-lg font-bold text-gray-900 mb-4">{titulo}</h4>
      {!itens || itens.length === 0 ? (
        <p className="text-gray-500">{vazio}</p>
      ) : (
        <div className="space-y-3 w-full">
          {itens.map((item) => (
            <div key={`${item[chaveNome]}-${item[chaveValor]}`}>
              <div className="flex items-center justify-between text-sm mb-1 gap-2">
                <span className="font-medium text-gray-800 truncate flex-1 min-w-0">
                  {item[chaveNome]}
                </span>
                <span className="font-bold text-gray-900 whitespace-nowrap">
                  {formatter(item[chaveValor])}
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                <div
                  className={`${classeBarra} h-3 rounded-full`}
                  style={{ width: calcularLargura(item[chaveValor], maximo) }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export function RelatorioTodasLojas({ relatorio }) {
  const [abaTicketPremio, setAbaTicketPremio] = useState("resumo");
  const totais = relatorio?.totais || {};
  const destaques = relatorio?.destaques || {};
  const graficos = relatorio?.graficos || {};
  const comparativoMensal = relatorio?.comparativoMensal || null;
  const cartaoPixLiquidoTotal =
    totais.cartaoPixLiquidoTotal ??
    Number(totais.cartaoPixTotal || 0) - Number(totais.taxaDeCartaoTotal || 0);
  const totalRecebimentosLiquidos =
    Number(totais.dinheiroTotal || 0) + Number(cartaoPixLiquidoTotal || 0);
  const brutoConsolidado = Number(
    totais.lucroBrutoTotal ??
      Number(totais.dinheiroTotal || 0) + Number(totais.cartaoPixTotal || 0),
  );
  const gastosFixosPorLoja = (graficos.gastosFixosPorLoja || []).filter(
    (item) => Number(item.custoFixo || 0) > 0,
  );
  const rankingLucroBrutoLojas = (
    graficos.rankingLucroBrutoLojas ||
    graficos.participacaoLojas ||
    []
  )
    .map((item) => {
      const lucroBrutoDireto = Number(
        item?.lucroBruto ?? item?.valor ?? item?.lucroBrutoLoja,
      );
      const lucroBrutoCalculadoPorParticipacao =
        (Number(totais.lucroBrutoTotal || 0) *
          Number(item?.participacaoLucroBruto || 0)) /
        100;

      return {
        ...item,
        lojaNome: item?.lojaNome || item?.nome || "-",
        lucroBruto: Number.isFinite(lucroBrutoDireto)
          ? lucroBrutoDireto
          : lucroBrutoCalculadoPorParticipacao,
      };
    })
    .sort((a, b) => Number(b.lucroBruto || 0) - Number(a.lucroBruto || 0));
  const pagamentoLiquido = [
    {
      metodo: "Dinheiro",
      valor: Number(totais.dinheiroTotal || 0),
      percentual:
        totalRecebimentosLiquidos > 0
          ? (Number(totais.dinheiroTotal || 0) / totalRecebimentosLiquidos) *
            100
          : 0,
    },
    {
      metodo: "Cartão / Pix (Líquido)",
      valor: Number(cartaoPixLiquidoTotal || 0),
      percentual:
        totalRecebimentosLiquidos > 0
          ? (Number(cartaoPixLiquidoTotal || 0) / totalRecebimentosLiquidos) *
            100
          : 0,
    },
  ];
  const faturamentoBrutoTicketTotal = Number(
    totais.faturamentoBrutoTicketTotal ?? brutoConsolidado,
  );
  const lucroSemCustosFixosTotal =
    Number(brutoConsolidado || 0) - Number(totais.custoProdutosTotal || 0);
  const custoProdutosTotal = Number(totais.custoProdutosTotal || 0);
  const custoFixoTotal = Number(totais.custoFixoTotal || 0);
  const custoVariavelTotal = Number(totais.custoVariavelTotal || 0);
  const custoQuebraCaixaTotal = Number(
    totais.custoQuebraCaixaTotal ?? totais.custoQuebraCaixa ?? 0,
  );
  const custoOutrosTotal = Math.max(
    0,
    Number(totais.custoTotal || 0) -
      (custoProdutosTotal +
        custoFixoTotal +
        custoVariavelTotal +
        custoQuebraCaixaTotal),
  );
  const valorEsperadoTotal = Number(totais.valorEsperadoTotal || 0);
  const lucroEsperadoTotal = Number(
    totais.lucroEsperadoTotal ??
      valorEsperadoTotal - Number(totais.custoTotal || 0),
  );
  const saidasPremioTotal = Number(
    totais.saidasPremioTotal ?? (totais.produtosSairamTotal || 0),
  );
  const ticketPorPremioConsolidado = Number(
    totais.ticketPorPremioConsolidado ??
      (saidasPremioTotal > 0
        ? faturamentoBrutoTicketTotal / saidasPremioTotal
        : 0),
  );
  const rankingTicketPremioLojas = (graficos.rankingTicketPremioLojas || [])
    .map((item) => ({
      ...item,
      lojaNome: item?.lojaNome || item?.nome || "-",
      ticketPorPremio: Number(item?.ticketPorPremio || 0),
      saidasPremio: Number(item?.saidasPremio || 0),
      faturamentoBrutoTicket: Number(item?.faturamentoBrutoTicket || 0),
    }))
    .filter((item) => item.saidasPremio > 0)
    .sort((a, b) => b.ticketPorPremio - a.ticketPorPremio);

  return (
    <div className="space-y-6">
      <div className="card bg-linear-to-r from-indigo-50 to-blue-100 border-2 border-indigo-200">
        <h3 className="text-2xl font-bold text-gray-900 mb-2">
          🏬 Consolidado de Todos os Pontos
        </h3>
        <p className="text-gray-700">
          Período: <strong>{relatorio?.periodo?.inicio}</strong> até{" "}
          <strong>{relatorio?.periodo?.fim}</strong>
        </p>
        <p className="text-gray-700 mt-1">
          Pontos com dados: <strong>{relatorio?.lojasComDados || 0}</strong>
        </p>
        {relatorio?.filtroUsuario && (
          <p className="text-gray-700 mt-1">
            Funcionário: <strong>{relatorio.filtroUsuario.nome}</strong>
            {relatorio.filtroUsuario.email
              ? ` (${relatorio.filtroUsuario.email})`
              : ""}
          </p>
        )}
        {!!relatorio?.lojasSemDados?.length && (
          <p className="text-amber-700 mt-2 text-sm">
            Pontos sem dados no período: {relatorio.lojasSemDados.join(", ")}
          </p>
        )}
      </div>

      {comparativoMensal && (
        <div className="card bg-linear-to-r from-slate-50 to-indigo-50 border-2 border-indigo-200">
          <h4 className="text-lg sm:text-2xl font-bold text-gray-900 mb-2 flex items-center gap-2">
            <span className="text-2xl sm:text-3xl">📈</span>
            Comparativo com o Mês Passado (mesmos dias)
          </h4>
          <p className="text-xs sm:text-sm text-gray-700 mb-4">
            Atual:{" "}
            {formatarDataExibicao(comparativoMensal.periodoAtual?.inicio)} até{" "}
            {formatarDataExibicao(comparativoMensal.periodoAtual?.fim)} | Mês
            passado:{" "}
            {formatarDataExibicao(comparativoMensal.periodoAnterior?.inicio)}{" "}
            até {formatarDataExibicao(comparativoMensal.periodoAnterior?.fim)}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {(comparativoMensal.metricas || []).map((metrica) => {
              const indicador = metrica.indicador || {};
              const classes = obterClassesStatusComparacao(indicador.status);

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
                    <h5 className="font-bold text-gray-900 text-sm sm:text-base">
                      {metrica.icone} {metrica.titulo}
                    </h5>
                    <span className={`text-xs font-bold ${classes.texto}`}>
                      {classes.icone} {textoStatus}
                    </span>
                  </div>

                  <p className={`text-sm font-bold mt-2 ${classes.texto}`}>
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
                    Atual: {formatarMoeda(indicador.atual)}
                  </p>
                  <p className="text-xs text-gray-700">
                    Mês passado: {formatarMoeda(indicador.anterior)}
                  </p>
                  <p className={`text-xs font-semibold mt-1 ${classes.texto}`}>
                    Diferença: {sinalDiferenca}
                    {formatarMoeda(Math.abs(indicador.diferenca || 0))}
                  </p>

                  {metrica.observacao && (
                    <p className="text-[10px] sm:text-xs text-gray-600 mt-2">
                      {metrica.observacao}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="card bg-linear-to-br from-emerald-500 to-green-700 text-white">
          <div className="text-2xl mb-1">💰</div>
          <div className="text-2xl font-bold">
            {formatarMoeda(totais.lucroBrutoTotal)}
          </div>
          <div className="text-sm opacity-90">Valor Recebido Total</div>
        </div>
        <div className="card bg-linear-to-br from-blue-600 to-cyan-700 text-white">
          <div className="text-2xl mb-1">📉</div>
          <div className="text-2xl font-bold">
            {formatarMoeda(totais.lucroLiquidoTotal)}
          </div>
          <div className="text-sm opacity-90">Lucro Líquido Total</div>
          <div className="text-xs opacity-80 mt-1">
            Valor bruto: {formatarMoeda(totais.lucroBrutoTotal)}
          </div>
        </div>
        <div className="card bg-linear-to-br from-rose-500 to-red-700 text-white">
          <div className="text-2xl mb-1">🧾</div>
          <div className="text-2xl font-bold">
            {formatarMoeda(totais.custoTotal)}
          </div>
          <div className="text-sm opacity-90">Custo Total</div>
          <div className="text-xs opacity-85 mt-2 space-y-1">
            <div>Produtos: {formatarMoeda(custoProdutosTotal)}</div>
            <div>Fixos: {formatarMoeda(custoFixoTotal)}</div>
            <div>Quebra de caixa: {formatarMoeda(custoQuebraCaixaTotal)}</div>
            <div>Variáveis: {formatarMoeda(custoVariavelTotal)}</div>
            <div>Outros: {formatarMoeda(custoOutrosTotal)}</div>
          </div>
        </div>
        <div className="card bg-linear-to-br from-fuchsia-500 to-purple-700 text-white">
          <div className="text-2xl mb-1">📌</div>
          <div className="text-2xl font-bold">
            {formatarMoeda(totais.custoVariavelTotal)}
          </div>
          <div className="text-sm opacity-90">Custo Variável Total</div>
        </div>
        <div className="card bg-linear-to-br from-violet-500 to-purple-800 text-white">
          <div className="text-2xl mb-1">🏷️</div>
          <div className="text-2xl font-bold">
            {formatarMoeda(totais.custoFixoTotal)}
          </div>
          <div className="text-sm opacity-90">Custo Fixo Total</div>
        </div>
        <div className="card bg-linear-to-br from-red-500 to-rose-700 text-white">
          <div className="text-2xl mb-1">📤</div>
          <div className="text-2xl font-bold">
            {Number(totais.produtosSairamTotal || 0).toLocaleString("pt-BR")}
          </div>
          <div className="text-sm opacity-90">Produtos Saíram (Total)</div>
        </div>
        <div className="card bg-linear-to-br from-teal-600 to-cyan-800 text-white">
          <div className="text-2xl mb-1">🟢</div>
          <div className="text-2xl font-bold">
            {formatarMoeda(lucroSemCustosFixosTotal)}
          </div>
          <div className="text-sm opacity-90">Lucro sem custos fixos</div>
          <div className="text-xs opacity-80 mt-1">
            Considera apenas custo dos produtos que saíram
          </div>
        </div>
        <div className="card bg-linear-to-br from-green-500 to-emerald-700 text-white">
          <div className="text-2xl mb-1">📥</div>
          <div className="text-2xl font-bold">
            {Number(totais.produtosEntraramTotal || 0).toLocaleString("pt-BR")}
          </div>
          <div className="text-sm opacity-90">Contador entrada (Total)</div>
        </div>
        <div className="card bg-linear-to-br from-amber-500 to-yellow-600 text-white border-2 border-amber-300">
          <div className="text-2xl mb-1">🔮</div>
          <div className="text-2xl font-bold">
            {formatarMoeda(valorEsperadoTotal)}
          </div>
          <div className="text-sm opacity-90">
            Valor Esperado (Fluxo de Caixa)
          </div>
          <div className="text-xs opacity-80 mt-1">
            Soma da coluna valor esperado com os filtros do relatório
          </div>
        </div>
        <div
          className={`card border-2 text-white ${
            lucroEsperadoTotal >= 0
              ? "bg-linear-to-br from-lime-500 to-green-700 border-lime-300"
              : "bg-linear-to-br from-red-600 to-rose-800 border-red-300"
          }`}
        >
          <div className="text-2xl mb-1">🎯</div>
          <div className="text-2xl font-bold">
            {formatarMoeda(lucroEsperadoTotal)}
          </div>
          <div className="text-sm opacity-90">Lucro Esperado</div>
          <div className="text-xs opacity-80 mt-1">
            Valor Esperado − Custo Total
          </div>
        </div>
      </div>

      <div className="card bg-linear-to-r from-violet-50 to-indigo-100 border-2 border-indigo-300">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h4 className="text-lg sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <span className="text-2xl sm:text-3xl">🎯</span>
            Aba de Ticket por Prêmio
          </h4>

          <div className="flex gap-2 no-print">
            <button
              type="button"
              onClick={() => setAbaTicketPremio("resumo")}
              className={`px-3 py-2 rounded-lg text-sm font-bold transition ${
                abaTicketPremio === "resumo"
                  ? "bg-indigo-600 text-white"
                  : "bg-white text-indigo-700 border border-indigo-300"
              }`}
            >
              Resumo Geral
            </button>
            <button
              type="button"
              onClick={() => setAbaTicketPremio("ranking")}
              className={`px-3 py-2 rounded-lg text-sm font-bold transition ${
                abaTicketPremio === "ranking"
                  ? "bg-indigo-600 text-white"
                  : "bg-white text-indigo-700 border border-indigo-300"
              }`}
            >
              Ranking por Ponto
            </button>
          </div>
        </div>

        {abaTicketPremio === "resumo" ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-linear-to-br from-blue-500 to-indigo-700 text-white rounded-xl p-4 shadow-lg">
              <div className="text-sm opacity-85">Faturamento Bruto</div>
              <div className="text-2xl font-bold mt-1">
                {formatarMoeda(faturamentoBrutoTicketTotal)}
              </div>
            </div>

            <div className="bg-linear-to-br from-red-500 to-rose-700 text-white rounded-xl p-4 shadow-lg">
              <div className="text-sm opacity-85">Produtos Saíram</div>
              <div className="text-2xl font-bold mt-1">
                {Number(saidasPremioTotal || 0).toLocaleString("pt-BR")}
              </div>
            </div>

            <div className="bg-linear-to-br from-indigo-500 to-violet-700 text-white rounded-xl p-4 shadow-lg">
              <div className="text-sm opacity-85">
                Ticket por Prêmio (Total)
              </div>
              <div className="text-3xl font-black mt-1">
                {formatarMoeda(ticketPorPremioConsolidado)}
              </div>
              <div className="text-xs opacity-90 mt-2">
                Fórmula: Faturamento Bruto ÷ Produtos Saíram
              </div>
              <div className="text-xs opacity-90 mt-1">
                {formatarMoeda(faturamentoBrutoTicketTotal)} /{" "}
                {Number(saidasPremioTotal || 0).toLocaleString("pt-BR")} saídas
              </div>
            </div>
          </div>
        ) : (
          <GraficoBarras
            titulo="🏆 Ranking de Ticket por Prêmio por Ponto"
            itens={rankingTicketPremioLojas}
            chaveNome="lojaNome"
            chaveValor="ticketPorPremio"
            classeBarra="bg-linear-to-r from-indigo-500 to-violet-700"
            formatter={formatarMoeda}
            vazio="Sem dados para ranking de ticket por prêmio no período."
          />
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="card border border-green-200 bg-green-50">
          <div className="text-sm text-gray-700">Ponto que mais lucrou</div>
          <div className="font-bold text-green-800 mt-1">
            {destaques.lojaMaiorLucro?.lojaNome || "-"}
          </div>
          <div className="text-sm mt-1">
            {formatarMoeda(destaques.lojaMaiorLucro?.lucroLiquido || 0)}
          </div>
        </div>
        <div className="card border border-red-200 bg-red-50">
          <div className="text-sm text-gray-700">Ponto com maior gasto</div>
          <div className="font-bold text-red-800 mt-1">
            {destaques.lojaMaiorGasto?.lojaNome || "-"}
          </div>
          <div className="text-sm mt-1">
            {formatarMoeda(destaques.lojaMaiorGasto?.custoTotal || 0)}
          </div>
        </div>
        <div className="card border border-indigo-200 bg-indigo-50">
          <div className="text-sm text-gray-700">Maior participação (%)</div>
          <div className="font-bold text-indigo-800 mt-1">
            {destaques.lojaMaiorParticipacao?.lojaNome || "-"}
          </div>
          <div className="text-sm mt-1">
            {formatarPercentual(
              destaques.lojaMaiorParticipacao?.participacaoLucroBruto || 0,
            )}
          </div>
        </div>
        <div className="card border border-amber-200 bg-amber-50">
          <div className="text-sm text-gray-700">Produto que mais saiu</div>
          <div className="font-bold text-amber-800 mt-1">
            {destaques.produtoMaisSaiu?.emoji || "📦"}{" "}
            {destaques.produtoMaisSaiu?.nome || "-"}
          </div>
          <div className="text-sm mt-1">
            {(destaques.produtoMaisSaiu?.quantidade || 0).toLocaleString(
              "pt-BR",
            )}{" "}
            unidades
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <GraficoBarras
          titulo="📊 Ranking: Vendas"
          itens={rankingLucroBrutoLojas}
          chaveNome="lojaNome"
          chaveValor="lucroBruto"
          classeBarra="bg-linear-to-r from-teal-500 to-emerald-700"
          formatter={formatarMoeda}
          vazio="Sem dados para ranking de Total Vendas."
        />

        <GraficoBarras
          titulo="📊 Ranking: pontos com maior lucro líquido"
          itens={graficos.rankingLucroLojas || []}
          chaveNome="lojaNome"
          chaveValor="lucroLiquido"
          classeBarra="bg-linear-to-r from-green-500 to-emerald-700"
          formatter={formatarMoeda}
          vazio="Sem dados para ranking de lucro."
        />

        <GraficoBarras
          titulo="📊 Ranking: pontos com maior gasto"
          itens={graficos.rankingGastoLojas || []}
          chaveNome="lojaNome"
          chaveValor="custoTotal"
          classeBarra="bg-linear-to-r from-red-500 to-rose-700"
          formatter={formatarMoeda}
          vazio="Sem dados para ranking de gastos."
        />

        <GraficoBarras
          titulo="📊 Ranking: pontos com maior gasto fixo"
          itens={gastosFixosPorLoja || []}
          chaveNome="lojaNome"
          chaveValor="custoFixo"
          classeBarra="bg-linear-to-r from-violet-500 to-purple-800"
          formatter={formatarMoeda}
          vazio="Sem dados de gastos fixos por ponto."
        />

        <GraficoBarras
          titulo="📊 Participação percentual por ponto"
          itens={graficos.participacaoLojas || []}
          chaveNome="lojaNome"
          chaveValor="participacaoLucroBruto"
          classeBarra="bg-linear-to-r from-indigo-500 to-blue-700"
          formatter={formatarPercentual}
          vazio="Sem dados de participação por ponto."
        />

        <GraficoBarras
          titulo="📊 Produto que mais está saindo"
          itens={graficos.rankingProdutos || []}
          chaveNome="nome"
          chaveValor="quantidade"
          classeBarra="bg-linear-to-r from-amber-500 to-orange-700"
          formatter={(valor) => Number(valor || 0).toLocaleString("pt-BR")}
          vazio="Sem produtos com saída no período."
        />
      </div>

      <div className="card bg-linear-to-r from-cyan-50 to-blue-100 border-2 border-cyan-200">
        <h4 className="text-lg font-bold text-gray-900 mb-4">
          💳 Percentual de recebimento (Dinheiro x Cartão/Pix Líquido)
        </h4>
        <div className="space-y-4">
          {pagamentoLiquido.map((item) => (
            <div key={item.metodo}>
              <div className="flex items-center justify-between mb-1 gap-2">
                <span className="font-medium text-gray-800">{item.metodo}</span>
                <span className="font-bold text-gray-900">
                  {formatarPercentual(item.percentual)} •{" "}
                  {formatarMoeda(item.valor)}
                </span>
              </div>
              <div className="w-full bg-white rounded-full h-4 overflow-hidden border border-gray-200">
                <div
                  className={
                    item.metodo === "Dinheiro"
                      ? "bg-linear-to-r from-emerald-500 to-green-700 h-4"
                      : "bg-linear-to-r from-blue-500 to-indigo-700 h-4"
                  }
                  style={{
                    width: `${Number(item.percentual || 0).toFixed(2)}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

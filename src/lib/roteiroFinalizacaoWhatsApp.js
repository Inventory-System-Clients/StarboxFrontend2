const STATUS_CONCLUIDO = new Set([
  "concluido",
  "concluida",
  "finalizado",
  "finalizada",
  "feito",
]);

const ESTOQUE_INICIAL_ROTEIRO_STORAGE_PREFIX =
  "starbox:roteiro:estoque-inicial:";
const KM_INICIAL_PILOTAGEM_ROTEIRO_STORAGE_PREFIX =
  "starbox:roteiro:km-inicial-pilotagem:";
const KM_INICIAL_PILOTAGEM_ATIVA_STORAGE_PREFIX =
  "starbox:pilotagem:km-inicial:";
const MANUTENCAO_RESUMO_ROTEIRO_STORAGE_PREFIX =
  "starbox:roteiro:manutencao-resumo:";
const MOVIMENTACOES_WHATSAPP_LOJA_STORAGE_PREFIX =
  "starbox:roteiro:movimentacoes-whatsapp-loja:";
const MOVIMENTACOES_WHATSAPP_ULTIMA_MENSAGEM_LOJA_STORAGE_PREFIX =
  "starbox:roteiro:movimentacoes-whatsapp-ultima-mensagem-loja:";

const normalizarTexto = (valor) => String(valor || "").trim();

const montarChaveEstoqueInicialRoteiro = ({ roteiroId, usuarioId }) => {
  const roteiroNormalizado = normalizarTexto(roteiroId);
  const usuarioNormalizado = normalizarTexto(usuarioId);

  if (!roteiroNormalizado || !usuarioNormalizado) return "";
  return `${ESTOQUE_INICIAL_ROTEIRO_STORAGE_PREFIX}${usuarioNormalizado}:${roteiroNormalizado}`;
};

export const obterEstoqueInicialSnapshotRoteiro = ({
  roteiroId,
  usuarioId,
}) => {
  const chave = montarChaveEstoqueInicialRoteiro({ roteiroId, usuarioId });
  if (!chave) return null;

  try {
    const bruto = window.localStorage.getItem(chave);
    if (!bruto) return null;

    const payload = JSON.parse(bruto);
    const quantidade = Number(payload?.quantidadeInicial);
    return Number.isFinite(quantidade) ? quantidade : null;
  } catch {
    return null;
  }
};

export const salvarEstoqueInicialSnapshotRoteiro = ({
  roteiroId,
  usuarioId,
  quantidadeInicial,
  sobrescrever = false,
}) => {
  const chave = montarChaveEstoqueInicialRoteiro({ roteiroId, usuarioId });
  const quantidade = Number(quantidadeInicial);

  if (!chave || !Number.isFinite(quantidade)) return false;

  try {
    if (!sobrescrever && window.localStorage.getItem(chave)) {
      return true;
    }

    window.localStorage.setItem(
      chave,
      JSON.stringify({
        quantidadeInicial: quantidade,
        roteiroId: String(roteiroId),
        usuarioId: String(usuarioId),
        capturedAt: new Date().toISOString(),
      }),
    );

    return true;
  } catch {
    return false;
  }
};

export const removerEstoqueInicialSnapshotRoteiro = ({
  roteiroId,
  usuarioId,
}) => {
  const chave = montarChaveEstoqueInicialRoteiro({ roteiroId, usuarioId });
  if (!chave) return false;

  try {
    window.localStorage.removeItem(chave);
    return true;
  } catch {
    return false;
  }
};

const montarChaveKmInicialPilotagemRoteiro = ({ roteiroId, usuarioId }) => {
  const roteiroNormalizado = normalizarTexto(roteiroId);
  const usuarioNormalizado = normalizarTexto(usuarioId);

  if (!roteiroNormalizado || !usuarioNormalizado) return "";
  return `${KM_INICIAL_PILOTAGEM_ROTEIRO_STORAGE_PREFIX}${usuarioNormalizado}:${roteiroNormalizado}`;
};

export const obterKmInicialPilotagemSnapshotRoteiro = ({
  roteiroId,
  usuarioId,
}) => {
  const chave = montarChaveKmInicialPilotagemRoteiro({ roteiroId, usuarioId });
  if (!chave) return null;

  try {
    const bruto = window.localStorage.getItem(chave);
    if (!bruto) return null;

    const payload = JSON.parse(bruto);
    const kmInicial = Number(payload?.kmInicial);
    return Number.isFinite(kmInicial) ? kmInicial : null;
  } catch {
    return null;
  }
};

export const salvarKmInicialPilotagemSnapshotRoteiro = ({
  roteiroId,
  usuarioId,
  kmInicial,
  sobrescrever = false,
}) => {
  const chave = montarChaveKmInicialPilotagemRoteiro({ roteiroId, usuarioId });
  const kmInicialNumero = Number(kmInicial);

  if (!chave || !Number.isFinite(kmInicialNumero)) return false;

  try {
    if (!sobrescrever && window.localStorage.getItem(chave)) {
      return true;
    }

    window.localStorage.setItem(
      chave,
      JSON.stringify({
        kmInicial: kmInicialNumero,
        roteiroId: String(roteiroId),
        usuarioId: String(usuarioId),
        capturedAt: new Date().toISOString(),
      }),
    );

    return true;
  } catch {
    return false;
  }
};

export const removerKmInicialPilotagemSnapshotRoteiro = ({
  roteiroId,
  usuarioId,
}) => {
  const chave = montarChaveKmInicialPilotagemRoteiro({ roteiroId, usuarioId });
  if (!chave) return false;

  try {
    window.localStorage.removeItem(chave);
    return true;
  } catch {
    return false;
  }
};

const montarChaveKmInicialPilotagemAtiva = ({ usuarioId, veiculoId }) => {
  const usuarioNormalizado = normalizarTexto(usuarioId);
  const veiculoNormalizado = normalizarTexto(veiculoId);

  if (!usuarioNormalizado || !veiculoNormalizado) return "";
  return `${KM_INICIAL_PILOTAGEM_ATIVA_STORAGE_PREFIX}${usuarioNormalizado}:${veiculoNormalizado}`;
};

export const obterKmInicialPilotagemAtiva = ({ usuarioId, veiculoId }) => {
  const chave = montarChaveKmInicialPilotagemAtiva({ usuarioId, veiculoId });
  if (!chave) return null;

  try {
    const bruto = window.localStorage.getItem(chave);
    if (!bruto) return null;

    const payload = JSON.parse(bruto);
    const kmInicial = Number(payload?.kmInicial);
    return Number.isFinite(kmInicial) ? kmInicial : null;
  } catch {
    return null;
  }
};

export const salvarKmInicialPilotagemAtiva = ({
  usuarioId,
  veiculoId,
  kmInicial,
}) => {
  const chave = montarChaveKmInicialPilotagemAtiva({ usuarioId, veiculoId });
  const kmInicialNumero = Number(kmInicial);

  if (!chave || !Number.isFinite(kmInicialNumero)) return false;

  try {
    window.localStorage.setItem(
      chave,
      JSON.stringify({
        kmInicial: kmInicialNumero,
        usuarioId: String(usuarioId),
        veiculoId: String(veiculoId),
        capturedAt: new Date().toISOString(),
      }),
    );

    return true;
  } catch {
    return false;
  }
};

export const removerKmInicialPilotagemAtiva = ({ usuarioId, veiculoId }) => {
  const chave = montarChaveKmInicialPilotagemAtiva({ usuarioId, veiculoId });
  if (!chave) return false;

  try {
    window.localStorage.removeItem(chave);
    return true;
  } catch {
    return false;
  }
};

const montarChaveManutencaoResumoRoteiro = ({ roteiroId, usuarioId }) => {
  const roteiroNormalizado = normalizarTexto(roteiroId);
  const usuarioNormalizado = normalizarTexto(usuarioId);

  if (!roteiroNormalizado || !usuarioNormalizado) return "";
  return `${MANUTENCAO_RESUMO_ROTEIRO_STORAGE_PREFIX}${usuarioNormalizado}:${roteiroNormalizado}`;
};

const montarChaveMovimentacoesWhatsAppLoja = ({
  roteiroId,
  usuarioId,
  lojaId,
}) => {
  const roteiroNormalizado = normalizarTexto(roteiroId);
  const usuarioNormalizado = normalizarTexto(usuarioId);
  const lojaNormalizada = normalizarTexto(lojaId);

  if (!roteiroNormalizado || !usuarioNormalizado || !lojaNormalizada) return "";
  return `${MOVIMENTACOES_WHATSAPP_LOJA_STORAGE_PREFIX}${usuarioNormalizado}:${roteiroNormalizado}:${lojaNormalizada}`;
};

const montarChaveUltimaMensagemMovimentacoesWhatsAppLoja = ({
  roteiroId,
  usuarioId,
  lojaId,
}) => {
  const roteiroNormalizado = normalizarTexto(roteiroId);
  const usuarioNormalizado = normalizarTexto(usuarioId);
  const lojaNormalizada = normalizarTexto(lojaId);

  if (!roteiroNormalizado || !usuarioNormalizado || !lojaNormalizada) return "";
  return `${MOVIMENTACOES_WHATSAPP_ULTIMA_MENSAGEM_LOJA_STORAGE_PREFIX}${usuarioNormalizado}:${roteiroNormalizado}:${lojaNormalizada}`;
};

const montarChaveUnicaMovimentacaoMaquina = (item = {}) => {
  const resumo = item?.resumo && typeof item.resumo === "object" ? item.resumo : {};
  return (
    normalizarTexto(item?.maquinaId) ||
    normalizarTexto(item?.maquinaNome) ||
    normalizarTexto(resumo?.codigoMaquina)
  );
};

export const obterMovimentacoesWhatsAppPendentesLoja = ({
  roteiroId,
  usuarioId,
  lojaId,
}) => {
  const chave = montarChaveMovimentacoesWhatsAppLoja({
    roteiroId,
    usuarioId,
    lojaId,
  });
  if (!chave) return [];

  try {
    const bruto = window.localStorage.getItem(chave);
    if (!bruto) return [];

    const payload = JSON.parse(bruto);
    const itens = Array.isArray(payload?.itens) ? payload.itens : [];

    return itens
      .map((item) => ({
        maquinaId: normalizarTexto(item?.maquinaId),
        maquinaNome: normalizarTexto(item?.maquinaNome),
        mensagem: String(item?.mensagem || "").trim(),
        resumo:
          item?.resumo && typeof item.resumo === "object" ? item.resumo : null,
        createdAt: item?.createdAt || null,
      }))
      .filter((item) => item.mensagem);
  } catch {
    return [];
  }
};

export const salvarMovimentacaoWhatsAppPendenteLoja = ({
  roteiroId,
  usuarioId,
  lojaId,
  maquinaId,
  maquinaNome,
  mensagem,
  resumo,
}) => {
  const chave = montarChaveMovimentacoesWhatsAppLoja({
    roteiroId,
    usuarioId,
    lojaId,
  });
  const mensagemNormalizada = String(mensagem || "").trim();

  if (!chave || !mensagemNormalizada) return false;

  try {
    const itensAtuais = obterMovimentacoesWhatsAppPendentesLoja({
      roteiroId,
      usuarioId,
      lojaId,
    });

    const novoItem = {
      maquinaId: normalizarTexto(maquinaId),
      maquinaNome: normalizarTexto(maquinaNome),
      mensagem: mensagemNormalizada,
      resumo: resumo && typeof resumo === "object" ? resumo : null,
      createdAt: new Date().toISOString(),
    };
    const chaveMaquina = montarChaveUnicaMovimentacaoMaquina(novoItem);
    const itensAtualizados = chaveMaquina
      ? itensAtuais.filter(
          (item) => montarChaveUnicaMovimentacaoMaquina(item) !== chaveMaquina,
        )
      : itensAtuais;

    itensAtualizados.push(novoItem);

    window.localStorage.setItem(
      chave,
      JSON.stringify({
        roteiroId: String(roteiroId),
        usuarioId: String(usuarioId),
        lojaId: String(lojaId),
        itens: itensAtualizados,
        updatedAt: new Date().toISOString(),
      }),
    );

    return true;
  } catch {
    return false;
  }
};

export const atualizarMovimentacaoWhatsAppPendenteLoja = ({
  roteiroId,
  usuarioId,
  lojaId,
  maquinaId,
  mensagem,
  resumo,
}) => {
  const chave = montarChaveMovimentacoesWhatsAppLoja({
    roteiroId,
    usuarioId,
    lojaId,
  });
  const maquinaNormalizada = normalizarTexto(maquinaId);
  const mensagemNormalizada = String(mensagem || "").trim();

  if (!chave || !maquinaNormalizada || !mensagemNormalizada) return false;

  try {
    const itensAtuais = obterMovimentacoesWhatsAppPendentesLoja({
      roteiroId,
      usuarioId,
      lojaId,
    });

    const indiceItem = [...itensAtuais]
      .reverse()
      .findIndex(
        (item) => normalizarTexto(item?.maquinaId) === maquinaNormalizada,
      );

    if (indiceItem < 0) return false;

    const indiceReal = itensAtuais.length - 1 - indiceItem;
    const itemAnterior = itensAtuais[indiceReal];
    const itensAtualizados = itensAtuais.map((item, index) =>
      index === indiceReal
        ? {
            ...item,
            mensagem: mensagemNormalizada,
            resumo:
              resumo && typeof resumo === "object"
                ? {
                    ...(itemAnterior?.resumo || {}),
                    ...resumo,
                    leituraAtualizada: true,
                    atualizadoEm: new Date().toISOString(),
                  }
                : itemAnterior?.resumo || null,
            mensagemOriginal: itemAnterior?.mensagem || "",
            updatedAt: new Date().toISOString(),
          }
        : item,
    );

    window.localStorage.setItem(
      chave,
      JSON.stringify({
        roteiroId: String(roteiroId),
        usuarioId: String(usuarioId),
        lojaId: String(lojaId),
        itens: itensAtualizados,
        updatedAt: new Date().toISOString(),
      }),
    );

    return true;
  } catch {
    return false;
  }
};

export const removerMovimentacoesWhatsAppPendentesLoja = ({
  roteiroId,
  usuarioId,
  lojaId,
}) => {
  const chave = montarChaveMovimentacoesWhatsAppLoja({
    roteiroId,
    usuarioId,
    lojaId,
  });
  if (!chave) return false;

  try {
    window.localStorage.removeItem(chave);
    return true;
  } catch {
    return false;
  }
};

export const obterUltimaMensagemMovimentacoesWhatsAppLoja = ({
  roteiroId,
  usuarioId,
  lojaId,
}) => {
  const chave = montarChaveUltimaMensagemMovimentacoesWhatsAppLoja({
    roteiroId,
    usuarioId,
    lojaId,
  });
  if (!chave) return "";

  try {
    return String(window.localStorage.getItem(chave) || "").trim();
  } catch {
    return "";
  }
};

export const salvarUltimaMensagemMovimentacoesWhatsAppLoja = ({
  roteiroId,
  usuarioId,
  lojaId,
  mensagem,
}) => {
  const chave = montarChaveUltimaMensagemMovimentacoesWhatsAppLoja({
    roteiroId,
    usuarioId,
    lojaId,
  });
  const mensagemNormalizada = String(mensagem || "").trim();

  if (!chave || !mensagemNormalizada) return false;

  try {
    window.localStorage.setItem(chave, mensagemNormalizada);
    return true;
  } catch {
    return false;
  }
};

const parseNumeroPtBr = (valor) => {
  const texto = String(valor || "")
    .trim()
    .replace(/\s+/g, "");
  if (!texto) return null;

  const apenasNumeros = texto.replace(/[^\d,.-]/g, "");
  if (!apenasNumeros) return null;

  const normalizado = apenasNumeros.includes(",")
    ? apenasNumeros.replace(/\./g, "").replace(",", ".")
    : apenasNumeros;

  const numero = Number(normalizado);
  return Number.isFinite(numero) ? numero : null;
};

const parseDataHoraPtBr = (valor) => {
  const texto = String(valor || "").trim();
  if (!texto) return null;

  const match = texto.match(
    /^(\d{2})\/(\d{2})\/(\d{2,4})\s*,?\s*(\d{2}):(\d{2})(?::(\d{2}))?$/,
  );
  if (!match) return null;

  const dia = Number(match[1]);
  const mes = Number(match[2]);
  const anoBruto = Number(match[3]);
  const horas = Number(match[4]);
  const minutos = Number(match[5]);
  const segundos = Number(match[6] || 0);
  const ano = anoBruto < 100 ? 2000 + anoBruto : anoBruto;

  const data = new Date(ano, mes - 1, dia, horas, minutos, segundos);
  return Number.isNaN(data.getTime()) ? null : data.toISOString();
};

const extrairResumoLegadoDaMensagem = (mensagem = "", item = {}) => {
  const linhas = String(mensagem || "")
    .split("\n")
    .map((linha) => linha.trim());

  const extrairLinha = (prefixoRegex) =>
    linhas.find((linha) => prefixoRegex.test(linha)) || "";

  const lojaMatch = linhas.find((linha) => /^\*.+\*$/.test(linha));
  const lojaNome = lojaMatch ? lojaMatch.replace(/^\*|\*$/g, "").trim() : "";

  const dataLinha = extrairLinha(/^Data(?:\/Hora)?:/i);
  const usuarioLinha = extrairLinha(
    /^(Lançado por:|Lancado por:|Funcionário:|Funcionario:)/i,
  );
  const maquinaLinha =
    linhas.find((linha) => /\|/.test(linha) && !/^\*/.test(linha)) || "";
  const produtoAbastecidoLinha = extrairLinha(/^Produto abastecido:/i);
  const quantidadeAbastecidaLinha = extrairLinha(/^Quantidade abastecida:/i);
  const linhaE = extrairLinha(/^E\s+/i);
  const linhaS = extrairLinha(/^S\s+/i);
  const saldoLinha = extrairLinha(/^Saldo:/i);
  const mediaLinha = extrairLinha(
    /^(Jogadas medias por pelucia:|Media Bicho:|Jogada:)/i,
  );
  const cobrancaLinha = extrairLinha(/^Cobrado com\s+/i);

  const maquinaPartes = maquinaLinha
    .split("|")
    .map((parte) => parte.trim())
    .filter(Boolean);
  const codigoMaquina = normalizarTexto(
    (maquinaPartes[0] || item?.maquinaNome || "-").replace(/^Máquina:\s*/i, ""),
  );
  const tipoMaquina = normalizarTexto(
    (maquinaPartes[1] || "Máquina").replace(/^Tipo:\s*/i, ""),
  );

  const numerosE = linhaE.match(/[\d.,]+/g) || [];
  const numerosS = linhaS.match(/[\d.,]+/g) || [];

  const inAnterior = parseNumeroPtBr(numerosE[0]) ?? 0;
  const inAtual = parseNumeroPtBr(numerosE[1]) ?? 0;
  const diferencaIn =
    parseNumeroPtBr(numerosE[numerosE.length - 1]) ??
    Math.max(0, inAtual - inAnterior);

  const outAnterior = parseNumeroPtBr(numerosS[0]) ?? 0;
  const outAtual = parseNumeroPtBr(numerosS[1]) ?? 0;
  const quantidadeSaiu =
    parseNumeroPtBr(numerosS[numerosS.length - 1]) ??
    Math.max(0, outAtual - outAnterior);

  const saldo =
    parseNumeroPtBr(saldoLinha.replace(/^Saldo:\s*/i, "")) ?? diferencaIn;
  const mediaBicho = parseNumeroPtBr(mediaLinha) ?? 0;
  const quantidadeAbastecimentoExtra =
    parseNumeroPtBr(
      quantidadeAbastecidaLinha.replace(/^Quantidade abastecida:\s*/i, ""),
    ) ?? 0;
  const nomeProdutoAbastecimentoExtra = normalizarTexto(
    produtoAbastecidoLinha.replace(/^Produto abastecido:\s*/i, ""),
  );
  const dataMovimentacaoTexto = normalizarTexto(
    dataLinha.replace(/^Data(?:\/Hora)?:\s*/i, ""),
  );

  const diasMatch = cobrancaLinha.match(/(\d+)/);
  const diasDesdeUltimaMovimentacao = diasMatch ? Number(diasMatch[1]) : null;

  return {
    lojaNome: normalizarTexto(lojaNome || "LOJA"),
    dataMovimentacao:
      parseDataHoraPtBr(dataMovimentacaoTexto) ||
      item?.createdAt ||
      new Date().toISOString(),
    nomeUsuario: normalizarTexto(
      usuarioLinha.replace(
        /^(Lançado por:|Lancado por:|Funcionário:|Funcionario:)\s*/i,
        "",
      ),
    ),
    codigoMaquina,
    tipoMaquina,
    inAnterior,
    inAtual,
    outAnterior,
    outAtual,
    diferencaIn: Number.isFinite(saldo) ? saldo : diferencaIn,
    quantidadeSaiu,
    jogado: Number.isFinite(diferencaIn) ? diferencaIn : 0,
    jogadasMediasPorPelucia: Number.isFinite(mediaBicho) ? mediaBicho : 0,
    diasDesdeUltimaMovimentacao,
    nomeProdutoAbastecido: nomeProdutoAbastecimentoExtra,
    quantidadeAbastecidaInformada: Number.isFinite(quantidadeAbastecimentoExtra)
      ? quantidadeAbastecimentoExtra
      : 0,
    quantidadeAbastecimentoExtra: Number.isFinite(quantidadeAbastecimentoExtra)
      ? quantidadeAbastecimentoExtra
      : 0,
    nomeProdutoAbastecimentoExtra,
  };
};

export const montarMensagemMovimentacoesWhatsAppLoja = ({
  roteiroId,
  usuarioId,
  lojaId,
}) => {
  const itens = obterMovimentacoesWhatsAppPendentesLoja({
    roteiroId,
    usuarioId,
    lojaId,
  });

  if (itens.length === 0) return "";

  const itensOrdenados = [...itens].sort((a, b) => {
    const dataA = new Date(a?.createdAt || 0).getTime();
    const dataB = new Date(b?.createdAt || 0).getTime();
    return dataA - dataB;
  });

  const itensPorMaquina = new Map();
  itensOrdenados.forEach((item, index) => {
    const itemNormalizado = {
      ...item,
      resumo:
        item?.resumo && typeof item.resumo === "object"
          ? item.resumo
          : extrairResumoLegadoDaMensagem(item?.mensagem, item),
    };
    const chaveMaquina =
      montarChaveUnicaMovimentacaoMaquina(itemNormalizado) || `item-${index}`;
    itensPorMaquina.set(chaveMaquina, itemNormalizado);
  });

  const itensNormalizados = Array.from(itensPorMaquina.values());

  const primeiroResumo = itensNormalizados[0].resumo;
  const ultimoResumo = itensNormalizados[itensNormalizados.length - 1].resumo;

  const formatarDataCurta = (valor) => {
    const data = new Date(valor || Date.now());
    if (Number.isNaN(data.getTime())) return "-";
    return data.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const formatarMoeda = (valor) =>
    Number(valor || 0).toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const formatarInteiro = (valor) =>
    Number(valor || 0).toLocaleString("pt-BR", {
      maximumFractionDigits: 0,
    });

  const usaFichasResumo = (resumo = {}) =>
    resumo?.usaFichas === true ||
    resumo?.usa_fichas === true ||
    resumo?.usaFichas === 1 ||
    resumo?.usa_fichas === 1;

  const calcularFinanceiroResumo = (resumo = {}) => {
    const quantidadeJogadas = Number(resumo?.diferencaIn || 0);
    const valorJogada = Number(resumo?.valorJogada || resumo?.valorFicha || 0);
    const deveMultiplicarPorFicha = usaFichasResumo(resumo) && valorJogada > 0;
    const saldo = deveMultiplicarPorFicha
      ? quantidadeJogadas * valorJogada
      : quantidadeJogadas;
    const quantidadeSaiu = Number(resumo?.quantidadeSaiu || 0);
    const jogadaPorPelucia = quantidadeSaiu > 0 ? saldo / quantidadeSaiu : 0;

    return {
      quantidadeJogadas,
      saldo,
      jogadaPorPelucia,
    };
  };

  const blocosMaquinas = itensNormalizados.map((item) => {
    const r = item.resumo;
    const codigo = normalizarTexto(
      r?.codigoMaquina || item?.maquinaNome || "-",
    );
    const tipo = normalizarTexto(r?.tipoMaquina || "Máquina");
    const nomeProdutoAbastecido = normalizarTexto(
      r?.nomeProdutoAbastecido || r?.nomeProdutoAbastecimentoExtra,
    );
    const alteracoesLeitura = Array.isArray(r?.alteracoesLeitura)
      ? r.alteracoesLeitura.map(normalizarTexto).filter(Boolean)
      : [];
    const quantidadeAbastecidaInformada = Number(
      r?.quantidadeAbastecidaInformada,
    );
    const { quantidadeJogadas, saldo, jogadaPorPelucia } =
      calcularFinanceiroResumo(r);
    const dias = r?.diasDesdeUltimaMovimentacao;
    const quantidadeAbastecimentoExtra = Number(
      r?.quantidadeAbastecimentoExtra || 0,
    );
    const nomeProdutoAbastecimentoExtra = normalizarTexto(
      r?.nomeProdutoAbastecimentoExtra,
    );

    return [
      `${codigo} - ${tipo}`,
      ...(nomeProdutoAbastecido
        ? [
            `Produto abastecido: ${nomeProdutoAbastecido}${Number.isFinite(quantidadeAbastecidaInformada) && quantidadeAbastecidaInformada > 0 ? ` (Qtd: ${formatarInteiro(quantidadeAbastecidaInformada)})` : ""}`,
          ]
        : []),
      ...(r?.leituraAtualizada ? ["Leitura atualizada"] : []),
      ...alteracoesLeitura.map((item) => `Alteracao: ${item}`),
      `E  ${formatarInteiro(r?.inAnterior)}  ${formatarInteiro(r?.inAtual)}_____${formatarMoeda(quantidadeJogadas)}`,
      `S  ${formatarInteiro(r?.outAnterior)}  ${formatarInteiro(r?.outAtual)}________${formatarInteiro(r?.quantidadeSaiu)}`,
      ...(quantidadeAbastecimentoExtra > 0
        ? [
            `Abastecimento extra: +${formatarInteiro(quantidadeAbastecimentoExtra)}${nomeProdutoAbastecimentoExtra ? ` (${nomeProdutoAbastecimentoExtra})` : ""}`,
          ]
        : []),
      `Saldo: ${formatarMoeda(saldo)}`,
      `Jogada: ${formatarMoeda(jogadaPorPelucia)}`,
      ...(Number.isFinite(Number(dias))
        ? [`Cobrado com ${formatarInteiro(dias)} dia(s)`]
        : []),
      "___________________________________",
    ].join("\n");
  });

  const totalEntradas = itensNormalizados.reduce(
    (acc, item) => acc + calcularFinanceiroResumo(item?.resumo).saldo,
    0,
  );
  const totalSaidasQtd = itensNormalizados.reduce(
    (acc, item) => acc + Number(item?.resumo?.quantidadeSaiu || 0),
    0,
  );
  const totalJogado = itensNormalizados.reduce(
    (acc, item) => acc + calcularFinanceiroResumo(item?.resumo).saldo,
    0,
  );
  const totalAbastecimentoExtra = itensNormalizados.reduce(
    (acc, item) =>
      acc + Number(item?.resumo?.quantidadeAbastecimentoExtra || 0),
    0,
  );
  const nomeUsuarioLancamento =
    normalizarTexto(ultimoResumo?.nomeUsuario) ||
    normalizarTexto(
      itensNormalizados.find((item) =>
        normalizarTexto(item?.resumo?.nomeUsuario),
      )?.resumo?.nomeUsuario,
    ) ||
    "-";

  return [
    "STAR BOX",
    `*${normalizarTexto(primeiroResumo?.lojaNome) || "LOJA"}*`,
    `Data: ${formatarDataCurta(ultimoResumo?.dataMovimentacao)}`,
    `Lançado por: ${nomeUsuarioLancamento}`,
    "___________________________________",
    ...blocosMaquinas,
    `Qtde Maqs....: ${formatarInteiro(itensNormalizados.length)}`,
    `Entradas.....: ${formatarMoeda(totalEntradas)}`,
    `Saidas.......: ${formatarInteiro(totalSaidasQtd)}`,
    ...(totalAbastecimentoExtra > 0
      ? [`Abast. extra.: ${formatarInteiro(totalAbastecimentoExtra)}`]
      : []),
    `Jogado.......: ${formatarMoeda(totalJogado)}`,
    "Cliente....: 0,00",
    `Liquido.....: ${formatarMoeda(totalEntradas)}`,
    "Cartao......: 0,00",
    `Especie.....: ${formatarMoeda(totalEntradas)}`,
  ].join("\n");
};

export const obterManutencaoResumoSnapshotRoteiro = ({
  roteiroId,
  usuarioId,
}) => {
  const chave = montarChaveManutencaoResumoRoteiro({ roteiroId, usuarioId });
  if (!chave) return null;

  try {
    const bruto = window.localStorage.getItem(chave);
    if (!bruto) return null;

    const payload = JSON.parse(bruto);
    const totalRealizadas = Number(payload?.totalRealizadas);
    const lojasComManutencao = Array.isArray(payload?.lojasComManutencao)
      ? payload.lojasComManutencao.filter(Boolean)
      : [];
    const lojasSemManutencao = Array.isArray(payload?.lojasSemManutencao)
      ? payload.lojasSemManutencao.filter(Boolean)
      : [];

    return {
      totalRealizadas: Number.isFinite(totalRealizadas)
        ? Math.max(0, totalRealizadas)
        : 0,
      lojasComManutencao: Array.from(new Set(lojasComManutencao)),
      lojasSemManutencao: Array.from(new Set(lojasSemManutencao)),
      updatedAt: payload?.updatedAt || null,
    };
  } catch {
    return null;
  }
};

export const salvarManutencaoResumoSnapshotRoteiro = ({
  roteiroId,
  usuarioId,
  resumo,
  sobrescrever = true,
}) => {
  const chave = montarChaveManutencaoResumoRoteiro({ roteiroId, usuarioId });
  if (!chave || !resumo || typeof resumo !== "object") return false;

  try {
    if (!sobrescrever && window.localStorage.getItem(chave)) {
      return true;
    }

    const totalRealizadas = Number(resumo?.totalRealizadas);
    const lojasComManutencao = Array.isArray(resumo?.lojasComManutencao)
      ? resumo.lojasComManutencao.filter(Boolean)
      : [];
    const lojasSemManutencao = Array.isArray(resumo?.lojasSemManutencao)
      ? resumo.lojasSemManutencao.filter(Boolean)
      : [];

    window.localStorage.setItem(
      chave,
      JSON.stringify({
        roteiroId: String(roteiroId),
        usuarioId: String(usuarioId),
        totalRealizadas: Number.isFinite(totalRealizadas)
          ? Math.max(0, totalRealizadas)
          : 0,
        lojasComManutencao: Array.from(new Set(lojasComManutencao)),
        lojasSemManutencao: Array.from(new Set(lojasSemManutencao)),
        updatedAt: new Date().toISOString(),
      }),
    );

    return true;
  } catch {
    return false;
  }
};

export const removerManutencaoResumoSnapshotRoteiro = ({
  roteiroId,
  usuarioId,
}) => {
  const chave = montarChaveManutencaoResumoRoteiro({ roteiroId, usuarioId });
  if (!chave) return false;

  try {
    window.localStorage.removeItem(chave);
    return true;
  } catch {
    return false;
  }
};

const toArray = (valor) => {
  if (Array.isArray(valor)) return valor;
  if (valor && typeof valor === "object") {
    const valores = Object.values(valor);
    if (Array.isArray(valores) && valores.length > 0) return valores;
  }
  if (!valor) return [];
  if (Array.isArray(valor?.rows)) return valor.rows;
  if (Array.isArray(valor?.movimentacoes)) return valor.movimentacoes;
  return [];
};

const statusConcluido = (status) =>
  STATUS_CONCLUIDO.has(normalizarTexto(status).toLowerCase());

const normalizarListaNomes = (lista, chavePadrao = "nome") => {
  const nomes = lista
    .map((item) => {
      if (typeof item === "string") return normalizarTexto(item);
      if (!item || typeof item !== "object") return "";

      return normalizarTexto(
        item[chavePadrao] ||
          item.nome ||
          item.lojaNome ||
          item.maquinaNome ||
          item.descricao,
      );
    })
    .filter(Boolean);

  return Array.from(new Set(nomes));
};

export const extrairResumoExecucaoRoteiro = ({ roteiro, finalizacaoData }) => {
  const data = finalizacaoData || {};

  const lojasFeitas = new Set(
    normalizarListaNomes(
      data.lojasFeitas || data.lojasConcluidas || [],
      "nome",
    ),
  );
  const lojasNaoFeitas = new Set(
    normalizarListaNomes(
      data.lojasNaoFeitas || data.lojasPendentes || [],
      "nome",
    ),
  );

  const maquinasFeitas = new Set(
    normalizarListaNomes(
      data.maquinasFeitas || data.maquinasConcluidas || [],
      "maquinaNome",
    ),
  );
  const maquinasNaoFeitas = new Set(
    normalizarListaNomes(
      data.maquinasNaoFeitas || data.maquinasPendentes || [],
      "maquinaNome",
    ),
  );

  const pendencias = toArray(data.pendencias);
  for (const item of pendencias) {
    const nomeLoja = normalizarTexto(item?.lojaNome || item?.loja?.nome);
    const nomeMaquina = normalizarTexto(
      item?.maquinaNome || item?.maquina?.nome,
    );

    if (nomeLoja) lojasNaoFeitas.add(nomeLoja);
    if (nomeMaquina) maquinasNaoFeitas.add(nomeMaquina);
  }

  const lojasRoteiro = toArray(roteiro?.lojas);
  for (const loja of lojasRoteiro) {
    const nomeLoja = normalizarTexto(loja?.nome);
    if (!nomeLoja) continue;

    if (statusConcluido(loja?.status)) {
      lojasFeitas.add(nomeLoja);
      lojasNaoFeitas.delete(nomeLoja);
    } else if (!lojasFeitas.has(nomeLoja)) {
      lojasNaoFeitas.add(nomeLoja);
    }

    const maquinasLoja = toArray(loja?.maquinas);
    for (const maquina of maquinasLoja) {
      const nomeMaquina = normalizarTexto(
        maquina?.nome || maquina?.codigo || maquina?.maquinaNome,
      );
      if (!nomeMaquina) continue;

      if (statusConcluido(maquina?.status)) {
        maquinasFeitas.add(nomeMaquina);
        maquinasNaoFeitas.delete(nomeMaquina);
      } else if (!maquinasFeitas.has(nomeMaquina)) {
        maquinasNaoFeitas.add(nomeMaquina);
      }
    }
  }

  for (const nomeFeita of lojasFeitas) lojasNaoFeitas.delete(nomeFeita);
  for (const nomeFeita of maquinasFeitas) maquinasNaoFeitas.delete(nomeFeita);

  return {
    lojasFeitas: Array.from(lojasFeitas),
    lojasNaoFeitas: Array.from(lojasNaoFeitas),
    maquinasFeitas: Array.from(maquinasFeitas),
    maquinasNaoFeitas: Array.from(maquinasNaoFeitas),
  };
};

export const somarPeluciasUsadasMovimentacoes = (
  movimentacoes,
  usuarioId = null,
) => {
  const usuarioNormalizado =
    usuarioId === null || usuarioId === undefined ? null : String(usuarioId);

  return toArray(movimentacoes).reduce((total, mov) => {
    const movUsuarioId = String(
      mov?.usuario?.id || mov?.usuarioId || mov?.funcionarioId || "",
    );

    if (usuarioNormalizado && movUsuarioId !== usuarioNormalizado) {
      return total;
    }

    const quantidadeAbastecida = Number(
      mov?.abastecidas ||
        mov?.quantidadeAdicionada ||
        mov?.totalAbastecido ||
        0,
    );

    return (
      total + (Number.isFinite(quantidadeAbastecida) ? quantidadeAbastecida : 0)
    );
  }, 0);
};

export const somarSaldoEstoqueUsuario = (estoqueUsuarioData) => {
  const totalDireto = Number(
    estoqueUsuarioData?.totalUnidades ??
      estoqueUsuarioData?.totais?.totalUnidades ??
      estoqueUsuarioData?.resumo?.totalUnidades,
  );

  if (Number.isFinite(totalDireto)) {
    return totalDireto;
  }

  const lista = toArray(
    estoqueUsuarioData?.estoque ||
      estoqueUsuarioData?.produtos ||
      estoqueUsuarioData,
  );

  return lista.reduce((total, item) => {
    const quantidade = Number(
      item?.quantidadeAtual || item?.quantidade || item?.saldo || 0,
    );
    return total + (Number.isFinite(quantidade) ? quantidade : 0);
  }, 0);
};

export const extrairKmMovimentacoesRoteiro = (
  movimentacoes,
  { usuarioId = null, veiculoId = null, roteiroId = null } = {},
) => {
  const usuarioNormalizado =
    usuarioId === null || usuarioId === undefined ? null : String(usuarioId);
  const veiculoNormalizado =
    veiculoId === null || veiculoId === undefined ? null : String(veiculoId);
  const roteiroNormalizado =
    roteiroId === null || roteiroId === undefined ? null : String(roteiroId);

  const listaFiltrada = toArray(movimentacoes).filter((mov) => {
    const tipo = normalizarTexto(mov?.tipo).toLowerCase();
    if (tipo !== "retirada" && tipo !== "devolucao") return false;

    const movUsuarioId = String(
      mov?.usuario?.id || mov?.usuarioId || mov?.funcionarioId || "",
    );
    const movVeiculoId = String(mov?.veiculoId || mov?.veiculo?.id || "");
    const movRoteiroId = String(mov?.roteiroId || mov?.roteiro?.id || "");

    if (usuarioNormalizado && movUsuarioId !== usuarioNormalizado) return false;
    if (veiculoNormalizado && movVeiculoId !== veiculoNormalizado) return false;
    if (
      roteiroNormalizado &&
      movRoteiroId &&
      movRoteiroId !== roteiroNormalizado
    ) {
      return false;
    }

    return true;
  });

  const listaOrdenada = [...listaFiltrada].sort((a, b) => {
    const dataA = new Date(
      a?.dataHora || a?.createdAt || a?.updatedAt || 0,
    ).getTime();
    const dataB = new Date(
      b?.dataHora || b?.createdAt || b?.updatedAt || 0,
    ).getTime();

    if (dataA !== dataB) return dataA - dataB;
    return Number(a?.id || 0) - Number(b?.id || 0);
  });

  const primeiraRetirada = listaOrdenada.find(
    (mov) => normalizarTexto(mov?.tipo).toLowerCase() === "retirada",
  );
  const ultimaDevolucao = [...listaOrdenada]
    .reverse()
    .find((mov) => normalizarTexto(mov?.tipo).toLowerCase() === "devolucao");

  const parseKmPorTipo = (mov, tipo) => {
    const chavesPreferenciais =
      tipo === "retirada"
        ? [
            mov?.kmInicial,
            mov?.quilometragemInicial,
            mov?.kmRetirada,
            mov?.odometroInicial,
            mov?.km,
            mov?.quilometragem,
            mov?.odometro,
          ]
        : [
            mov?.kmFinal,
            mov?.quilometragemFinal,
            mov?.kmDevolucao,
            mov?.odometroFinal,
            mov?.km,
            mov?.quilometragem,
            mov?.odometro,
          ];

    const numero = Number(
      chavesPreferenciais.find(
        (valor) => valor !== null && valor !== undefined && valor !== "",
      ),
    );
    return Number.isFinite(numero) ? numero : null;
  };

  return {
    kmInicial: parseKmPorTipo(primeiraRetirada, "retirada"),
    kmFinal: parseKmPorTipo(ultimaDevolucao, "devolucao"),
  };
};

const formatarLista = (itens) => {
  const lista = toArray(itens).filter(Boolean);
  if (lista.length === 0) return "Nenhum";
  return lista.join(", ");
};

const parseDataValida = (valor) => {
  if (!valor) return null;
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? null : data;
};

const obterPrimeiraDataValida = (...valores) => {
  for (const valor of valores) {
    const data = parseDataValida(valor);
    if (data) return data;
  }
  return null;
};

const extrairNomePonto = (item) => {
  if (!item || typeof item !== "object") return "";

  return normalizarTexto(
    item.pontoNome ||
      item.lojaNome ||
      item.loja?.nome ||
      item.ponto?.nome ||
      item.localNome ||
      item.local?.nome,
  );
};

const montarResumoManutencoesPorPonto = (manutencoes = []) => {
  const contadorPorPonto = new Map();

  for (const item of toArray(manutencoes)) {
    const nomePonto = extrairNomePonto(item);
    if (!nomePonto) continue;

    const quantidadeAtual = contadorPorPonto.get(nomePonto) || 0;
    contadorPorPonto.set(nomePonto, quantidadeAtual + 1);
  }

  return Array.from(contadorPorPonto.entries())
    .sort((a, b) => a[0].localeCompare(b[0], "pt-BR"))
    .map(([nomePonto, quantidade]) => `${nomePonto} (${quantidade})`);
};

const extrairDataRealizacaoManutencao = (item) => {
  if (!item || typeof item !== "object") return null;

  return obterPrimeiraDataValida(
    item.concluidaEm,
    item.concluida_em,
    item.concluidoEm,
    item.concluido_em,
    item.finalizadaEm,
    item.finalizada_em,
    item.finalizadoEm,
    item.finalizado_em,
    item.realizadaEm,
    item.realizada_em,
    item.realizadoEm,
    item.realizado_em,
    item.dataRealizacao,
    item.data_realizacao,
    item.dataConclusao,
    item.data_conclusao,
    item.dataFinalizacao,
    item.data_finalizacao,
    item.updatedAt,
    item.updated_at,
    item.createdAt,
    item.created_at,
  );
};

const filtrarManutencoesRealizadasPorPeriodo = ({
  manutencoes,
  inicio,
  fim,
}) => {
  const itens = toArray(manutencoes).filter(
    (item) => item && typeof item === "object",
  );

  if (!inicio || !fim || itens.length === 0) return null;

  const itensComData = itens
    .map((item) => ({
      item,
      data: extrairDataRealizacaoManutencao(item),
    }))
    .filter((item) => item.data);

  if (itensComData.length === 0) return null;

  return itensComData
    .filter(({ data }) => data >= inicio && data <= fim)
    .map(({ item }) => item);
};

const substituirLinhaResumoFinalizacao = (mensagem, regex, novaLinha) => {
  if (!regex.test(mensagem)) return mensagem;
  return mensagem.replace(regex, novaLinha);
};

export const filtrarMensagemFinalizacaoRoteiroManutencoesPorPeriodo = ({
  mensagem,
  finalizacaoData,
  roteiro,
}) => {
  const texto = String(mensagem || "").trim();
  if (!texto) return "";

  const payload =
    finalizacaoData && typeof finalizacaoData === "object"
      ? finalizacaoData
      : {};
  const resumo =
    payload?.resumoExecucao && typeof payload.resumoExecucao === "object"
      ? payload.resumoExecucao
      : payload?.resumoExecucaoPersistido &&
          typeof payload.resumoExecucaoPersistido === "object"
        ? payload.resumoExecucaoPersistido
        : payload?.resumo && typeof payload.resumo === "object"
          ? payload.resumo
          : payload;
  const execucao =
    payload?.execucaoSemanal ||
    payload?.execucao_semanal ||
    payload?.execucao ||
    roteiro?.execucaoSemanal ||
    roteiro?.execucao_semanal ||
    roteiro?.execucao ||
    {};

  const inicio = obterPrimeiraDataValida(
    payload?.dataInicio,
    payload?.data_inicio,
    payload?.iniciadoEm,
    payload?.iniciado_em,
    resumo?.dataInicio,
    resumo?.data_inicio,
    resumo?.iniciadoEm,
    resumo?.iniciado_em,
    execucao?.dataInicio,
    execucao?.data_inicio,
    execucao?.iniciadoEm,
    execucao?.iniciado_em,
    roteiro?.dataInicio,
    roteiro?.data_inicio,
    roteiro?.iniciadoEm,
    roteiro?.iniciado_em,
  );
  const fim = obterPrimeiraDataValida(
    payload?.finalizadoEm,
    payload?.finalizado_em,
    payload?.dataFim,
    payload?.data_fim,
    resumo?.finalizadoEm,
    resumo?.finalizado_em,
    resumo?.dataFim,
    resumo?.data_fim,
    execucao?.finalizadoEm,
    execucao?.finalizado_em,
    roteiro?.finalizadoEm,
    roteiro?.finalizado_em,
  );

  const manutencoesFiltradas = filtrarManutencoesRealizadasPorPeriodo({
    manutencoes:
      resumo?.manutencoesRealizadas ||
      resumo?.manutencoesFeitas ||
      payload?.manutencoesRealizadas ||
      payload?.manutencoesFeitas ||
      [],
    inicio,
    fim,
  });

  if (!manutencoesFiltradas) return texto;

  const manutencoesLista = normalizarListaNomes(
    manutencoesFiltradas,
    "descricao",
  );
  const lojasComManutencaoLista = manutencoesFiltradas
    .map(extrairNomePonto)
    .filter(Boolean);
  const lojasUnicas = Array.from(
    new Set(lojasComManutencaoLista.filter(Boolean)),
  );

  let textoFiltrado = substituirLinhaResumoFinalizacao(
    texto,
    /^Total de manuten[cç][oõ]es realizadas: .*$/im,
    `Total de manutencoes realizadas: ${manutencoesFiltradas.length}`,
  );
  textoFiltrado = substituirLinhaResumoFinalizacao(
    textoFiltrado,
    /^Lojas com manuten[cç][aã]o realizada: .*$/im,
    `Lojas com manutencao realizada: ${formatarLista(lojasUnicas)}`,
  );
  textoFiltrado = substituirLinhaResumoFinalizacao(
    textoFiltrado,
    /^Manuten[cç][oõ]es realizadas \(\d+\): .*$/im,
    `Manutencoes realizadas (${manutencoesLista.length}): ${formatarLista(manutencoesLista)}`,
  );

  return textoFiltrado;
};

const formatarMoedaBRL = (valor) => {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return "Nao informado";
  return numero.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
};

export const montarMensagemFinalizacaoRoteiro = ({
  roteiroNome,
  possuiVeiculoAssociado = true,
  rotaIniciadaEm,
  rotaFinalizadaEm,
  kmInicialVeiculo,
  kmFinalVeiculo,
  lojasFeitas,
  lojasNaoFeitas,
  maquinasFeitas,
  maquinasNaoFeitas,
  totalPeluciasUsadas,
  saldoPeluciasEstoque,
  despesaTotal,
  sobraValorDespesa,
  manutencoesRealizadas,
  manutencoesNaoRealizadas,
  totalManutencoesRealizadas,
  lojasComManutencao,
  lojasSemManutencao,
  abastecimentosExtras,
  resumoConsumoProdutos,
  maquinasComEdicao,
}) => {
  const totalUsadas = Number.isFinite(Number(totalPeluciasUsadas))
    ? Number(totalPeluciasUsadas)
    : null;
  const saldoEstoque = Number.isFinite(Number(saldoPeluciasEstoque))
    ? Number(saldoPeluciasEstoque)
    : null;
  const kmInicial = Number.isFinite(Number(kmInicialVeiculo))
    ? Number(kmInicialVeiculo)
    : null;
  const kmFinal = Number.isFinite(Number(kmFinalVeiculo))
    ? Number(kmFinalVeiculo)
    : null;
  const kmRodado =
    kmInicial !== null && kmFinal !== null
      ? Math.max(0, kmFinal - kmInicial)
      : null;
  const manutencoesRealizadasBrutas = toArray(manutencoesRealizadas).filter(
    Boolean,
  );
  const manutencoesFiltradasPorPeriodo =
    filtrarManutencoesRealizadasPorPeriodo({
      manutencoes: manutencoesRealizadasBrutas,
      inicio: parseDataValida(rotaIniciadaEm),
      fim: parseDataValida(rotaFinalizadaEm),
    });
  const manutencoesFeitasBrutas =
    manutencoesFiltradasPorPeriodo || manutencoesRealizadasBrutas;
  const manutencoesNaoFeitasBrutas = toArray(manutencoesNaoRealizadas).filter(
    Boolean,
  );
  const manutencoesFeitasLista = normalizarListaNomes(
    manutencoesFeitasBrutas,
    "descricao",
  );
  const manutencoesNaoFeitasLista = normalizarListaNomes(
    manutencoesNaoFeitasBrutas,
    "descricao",
  );
  const totalManutencoesFeitas = manutencoesFiltradasPorPeriodo
    ? manutencoesFeitasLista.length
    : Number.isFinite(Number(totalManutencoesRealizadas))
      ? Number(totalManutencoesRealizadas)
      : manutencoesFeitasLista.length;
  const lojasComManutencaoLista = manutencoesFiltradasPorPeriodo
    ? Array.from(
        new Set(manutencoesFeitasBrutas.map(extrairNomePonto).filter(Boolean)),
      )
    : normalizarListaNomes(toArray(lojasComManutencao), "nome");
  const manutencoesNaoFeitasPorPonto = montarResumoManutencoesPorPonto(
    manutencoesNaoFeitasBrutas,
  );
  const consumoResumo =
    resumoConsumoProdutos && typeof resumoConsumoProdutos === "object"
      ? {
          estoqueInicialTotal: Number(
            resumoConsumoProdutos.estoqueInicialTotal,
          ),
          estoqueFinalTotal: Number(resumoConsumoProdutos.estoqueFinalTotal),
          consumoTotalProdutos: Number(
            resumoConsumoProdutos.consumoTotalProdutos,
          ),
        }
      : null;
  const consumoResumoValido =
    consumoResumo &&
    Number.isFinite(consumoResumo.estoqueInicialTotal) &&
    Number.isFinite(consumoResumo.estoqueFinalTotal) &&
    Number.isFinite(consumoResumo.consumoTotalProdutos);
  const maquinasComEdicaoLista = normalizarListaNomes(
    toArray(maquinasComEdicao),
    "nome",
  );
  const abastecimentosExtrasLista = normalizarListaNomes(
    toArray(abastecimentosExtras),
    "descricao",
  );
  const pontosFeitosQuantidade = toArray(lojasFeitas).filter(Boolean).length;
  const pontosNaoFeitosQuantidade =
    toArray(lojasNaoFeitas).filter(Boolean).length;
  const linhasKm = possuiVeiculoAssociado
    ? [
        `KM inicial (retirada): ${kmInicial !== null ? kmInicial : "Nao informado"}`,
        `KM final (devolucao): ${kmFinal !== null ? kmFinal : "Nao informado"}`,
        `KM rodado: ${kmRodado !== null ? kmRodado : "Nao informado"}`,
      ]
    : [];

  return [
    "STAR BOX",
    "*Resumo de Finalizacao de Roteiro*",
    "___________________________________",
    `Roteiro: ${normalizarTexto(roteiroNome) || "-"}`,
    ...linhasKm,
    `Pontos feitos: ${formatarInteiro(pontosFeitosQuantidade)}`,
    `Pontos nao feitos: ${formatarInteiro(pontosNaoFeitosQuantidade)}`,
    `Maquinas feitas: ${formatarLista(maquinasFeitas)}`,
    `Maquinas nao feitas: ${formatarLista(maquinasNaoFeitas)}`,
    ...(consumoResumoValido
      ? [
          `Estoque inicial: ${consumoResumo.estoqueInicialTotal} produtos`,
          `Estoque final: ${consumoResumo.estoqueFinalTotal} produtos`,
          `Total gasto na rota: ${consumoResumo.consumoTotalProdutos} produtos`,
        ]
      : ["Resumo de consumo indisponivel para esta finalizacao."]),
    `Despesa total: ${formatarMoedaBRL(despesaTotal)}`,
    `Sobra valor despesa: ${formatarMoedaBRL(sobraValorDespesa)}`,
    `Total de manutencoes realizadas: ${totalManutencoesFeitas}`,
    `Lojas com manutencao realizada: ${formatarLista(lojasComManutencaoLista)}`,

    `Manutencoes realizadas (${manutencoesFeitasLista.length}): ${formatarLista(manutencoesFeitasLista)}`,

    `Manutencoes nao realizadas (${manutencoesNaoFeitasLista.length}): ${formatarLista(manutencoesNaoFeitasLista)}`,
    `Manutencoes nao realizadas por ponto: ${formatarLista(manutencoesNaoFeitasPorPonto)}`,
    ...(maquinasComEdicaoLista.length > 0
      ? [
          `Rota finalizada com edicao na maquina: ${formatarLista(maquinasComEdicaoLista)}`,
        ]
      : []),
    ...(abastecimentosExtrasLista.length > 0
      ? [
          `Abastecimentos extras na rota: ${formatarLista(abastecimentosExtrasLista)}`,
        ]
      : []),
  ].join("\n");
};

export const abrirWhatsAppComMensagem = (
  mensagem,
  popupReservado = null,
  options = {},
) => {
  const { preferSameTab = false, noFallback = false } = options || {};
  const textoBruto = String(mensagem || "").trim();
  if (!textoBruto) {
    if (popupReservado && !popupReservado.closed) {
      popupReservado.close();
    }
    return false;
  }
  const textoCodificado = encodeURIComponent(textoBruto);
  const whatsappAppUrl = `whatsapp://send?text=${textoCodificado}`;
  const whatsappFallbackUrl = `https://wa.me/?text=${textoCodificado}`;
  const userAgent = String(
    navigator.userAgent || navigator.vendor || window?.opera || "",
  );
  const isMobile =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(
      userAgent,
    ) ||
    (navigator.maxTouchPoints > 1 && /Macintosh/i.test(userAgent));
  const isAndroid = /Android/i.test(userAgent);

  const redirecionarSeAindaVisivel = (url, delay) => {
    if (noFallback) return;
    window.setTimeout(() => {
      if (document.visibilityState === "visible") {
        window.location.href = url;
      }
    }, delay);
  };

  if (isMobile) {
    if (popupReservado && !popupReservado.closed) {
      popupReservado.close();
    }
    if (isAndroid) {
      window.location.href = `intent://send?text=${textoCodificado}#Intent;scheme=whatsapp;package=com.whatsapp;end`;
      redirecionarSeAindaVisivel(
        `intent://send?text=${textoCodificado}#Intent;scheme=whatsapp;package=com.whatsapp.w4b;end`,
        700,
      );
      redirecionarSeAindaVisivel(whatsappFallbackUrl, 1800);
      return true;
    }
    window.location.href = whatsappAppUrl;
    redirecionarSeAindaVisivel(whatsappFallbackUrl, 1200);
    return true;
  }

  if (preferSameTab) {
    window.location.assign(whatsappFallbackUrl);
    return true;
  }

  if (popupReservado && !popupReservado.closed) {
    popupReservado.location.href = whatsappFallbackUrl;
    popupReservado.focus?.();
    return true;
  }

  const novaAba = window.open(whatsappFallbackUrl, "_blank");
  if (!novaAba) {
    window.location.assign(whatsappFallbackUrl);
  }
  return true;
};

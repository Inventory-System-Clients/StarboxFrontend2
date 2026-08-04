import { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import api from "../services/api";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer.jsx";
import { Modal, AlertBox } from "../components/UIComponents";
import ManutencaoModal from "../components/ManutencaoModal";
import ModalEditarMovimentacao from "../components/ModalEditarMovimentacao";
import { useAuth } from "../contexts/AuthContext";
import {
  abrirWhatsAppComMensagem,
  montarMensagemMovimentacoesWhatsAppLoja,
  obterMovimentacoesWhatsAppPendentesLoja,
  obterUltimaMensagemMovimentacoesWhatsAppLoja,
  obterKmInicialPilotagemAtiva,
  removerMovimentacoesWhatsAppPendentesLoja,
  salvarUltimaMensagemMovimentacoesWhatsAppLoja,
  salvarMovimentacaoWhatsAppPendenteLoja,
  atualizarMovimentacaoWhatsAppPendenteLoja,
  filtrarMensagemFinalizacaoRoteiroManutencoesPorPeriodo,
} from "../lib/roteiroFinalizacaoWhatsApp";

export default function RoteiroExecucao() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { usuario } = useAuth();
  const CATEGORIAS_GASTO = [
    { value: "transporte", label: "Transporte" },
    { value: "estadia", label: "Estadia" },
    { value: "abastecimento", label: "Abastecimento" },
    { value: "alimentacao", label: "Alimentação" },
    { value: "outros", label: "Outros" },
  ];
  const [roteiro, setRoteiro] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [erroCarregamentoInicial, setErroCarregamentoInicial] = useState("");
  const [lojaSelecionada, setLojaSelecionada] = useState(null);
  const [modalFinalizar, setModalFinalizar] = useState({
    aberto: false,
    etapa: 1,
    loading: false,
  });
  const [kmFinalVeiculoInput, setKmFinalVeiculoInput] = useState("");
  const [enviandoResumoWhatsapp, setEnviandoResumoWhatsapp] = useState(false);
  const [copiandoResumo, setCopiandoResumo] = useState(false);
  const [modalNovaManutencao, setModalNovaManutencao] = useState({
    aberto: false,
    loading: false,
  });
  const [novaManutencaoRoteiro, setNovaManutencaoRoteiro] = useState({
    maquinaId: "",
    descricao: "",
  });

  // Estados para manutenção
  const [manutencaoPendente, setManutencaoPendente] = useState(null);
  const [modalManutencao, setModalManutencao] = useState(false);
  const [manutencaoRecemCriada, setManutencaoRecemCriada] = useState(null);

  // Estados para controle de ordem
  const [modalJustificativa, setModalJustificativa] = useState({
    aberto: false,
    lojaId: null,
    lojaNome: "",
    lojaPuladaId: null,
    lojaPuladaNome: "",
    justificativa: "",
  });
  const [gastoForm, setGastoForm] = useState({
    categoria: "transporte",
    valor: "",
    quilometragem: "",
    litros: "",
    nivelCombustivel: "Cheio",
    observacao: "",
  });
  const [lancandoGasto, setLancandoGasto] = useState(false);
  const [resumoManutencaoRota, setResumoManutencaoRota] = useState({
    totalRealizadas: 0,
    lojasComManutencao: [],
    lojasSemManutencao: [],
  });
  const [resumoExecucaoBackend, setResumoExecucaoBackend] = useState(null);
  const [tiposMaquinaPorId, setTiposMaquinaPorId] = useState({});
  const [ultimasMovimentacoesPorMaquina, setUltimasMovimentacoesPorMaquina] =
    useState({});
  const [modalJustificativaEdicao, setModalJustificativaEdicao] = useState({
    aberto: false,
    justificativa: "",
    maquina: null,
    movimentacaoAnterior: null,
    movimentacaoAtualizada: null,
  });
  const [modalEdicaoAberto, setModalEdicaoAberto] = useState(false);
  const [movimentacaoParaEditar, setMovimentacaoParaEditar] = useState(null);
  const [maquinasEditadasNaRota, setMaquinasEditadasNaRota] = useState([]);
  const [leiturasAtualizadasPorLoja, setLeiturasAtualizadasPorLoja] = useState(
    {},
  );
  const [justificativasEdicaoPorLoja, setJustificativasEdicaoPorLoja] =
    useState({});
  const [abastecimentosExtrasNaRota, setAbastecimentosExtrasNaRota] = useState(
    [],
  );
  const [modalAbastecimentoExtra, setModalAbastecimentoExtra] = useState({
    aberto: false,
    maquina: null,
    movimentacao: null,
    quantidade: "",
    produtoId: "",
    ultimoProdutoId: "",
    produtoPendenteId: "",
    confirmarTrocaProdutoAberto: false,
    erro: "",
    loading: false,
  });
  const [produtosAbastecimentoExtra, setProdutosAbastecimentoExtra] = useState(
    [],
  );
  const [pontosPuladosPorLoja, setPontosPuladosPorLoja] = useState({});

  const perfisPermitidosEditarMovimentacaoRota = new Set([
    "FUNCIONARIO",
    "FUNCIONARIO_TODAS_LOJAS",
    "ABASTECEDOR",
    "FUNCIONARIO_ABASTECEDOR",
  ]);
  const EDICOES_MOVIMENTACAO_ROTA_STORAGE_PREFIX =
    "starbox:roteiro:edicoes-movimentacao:";
  const JUSTIFICATIVAS_EDICAO_MOVIMENTACAO_ROTA_STORAGE_PREFIX =
    "starbox:roteiro:justificativas-edicao-movimentacao:";
  const STATUS_EXECUCAO_ROTEIRO_STORAGE_PREFIX =
    "starbox:roteiro:execucao-semanal-status:";

  const lojaEstaConcluida = (status) =>
    ["concluido", "concluida", "finalizado", "finalizada"].includes(
      String(status || "").toLowerCase(),
    );

  const lojaMarcadaConcluidaNoBackend = (loja) => {
    const camposBooleanos = [
      loja?.concluida,
      loja?.concluída,
      loja?.statusConcluida,
      loja?.status_concluida,
      loja?.pontoConcluido,
      loja?.ponto_concluido,
    ];

    return camposBooleanos.some((valor) => {
      if (valor === true) return true;
      if (valor === 1) return true;
      return String(valor || "").trim().toLowerCase() === "true";
    });
  };

  const pontoEstaConcluido = (loja) =>
    lojaMarcadaConcluidaNoBackend(loja) || lojaEstaConcluida(loja?.status);

  const roteiroEstaFinalizado = (status) =>
    ["finalizado", "finalizada", "concluido", "concluida"].includes(
      String(status || "").toLowerCase(),
    );

  const maquinaEstaConcluida = (status) =>
    ["finalizado", "finalizada", "concluido", "concluida"].includes(
      String(status || "").toLowerCase(),
    );

  const maquinaMarcadaConcluidaNoBackend = (maquina) => {
    const camposBooleanos = [
      maquina?.concluida,
      maquina?.["concluida"],
      maquina?.statusConcluida,
      maquina?.status_concluida,
      maquina?.maquinaConcluida,
      maquina?.maquina_concluida,
      maquina?.finalizada,
      maquina?.finalizado,
    ];

    return camposBooleanos.some((valor) => {
      if (valor === true) return true;
      if (valor === 1) return true;
      return String(valor || "").trim().toLowerCase() === "true";
    });
  };

  const maquinaEstaConcluidaNoBackend = (maquina) =>
    maquinaMarcadaConcluidaNoBackend(maquina) ||
    maquinaEstaConcluida(maquina?.status);

  const listaTemItens = (lista) => Array.isArray(lista) && lista.length > 0;

  const normalizarExecucaoSemanalRoteiro = (roteiroAtual) => {
    const execucao =
      roteiroAtual?.execucaoSemanal ||
      roteiroAtual?.execucao_semanal ||
      roteiroAtual?.execucao ||
      null;

    const execucaoFonte =
      execucao && typeof execucao === "object" ? execucao : roteiroAtual;

    if (!execucaoFonte || typeof execucaoFonte !== "object") return null;

    const statusTexto = String(
      execucaoFonte?.status ||
        execucaoFonte?.statusExecucao ||
        execucaoFonte?.status_execucao ||
        roteiroAtual?.statusExecucao ||
        roteiroAtual?.status_execucao ||
        roteiroAtual?.status ||
        "",
    )
      .trim()
      .toLowerCase();

    return {
      emAndamento:
        execucaoFonte?.emAndamento === true ||
        execucaoFonte?.em_andamento === true ||
        execucaoFonte?.statusExecucaoEmAndamento === true ||
        execucaoFonte?.ativo === true ||
        ["em_andamento", "em-andamento", "em andamento", "iniciado", "ativo"].includes(
          statusTexto,
        ),
      dataInicio:
        execucaoFonte?.dataInicio ||
        execucaoFonte?.data_inicio ||
        execucaoFonte?.iniciadoEm ||
        execucaoFonte?.iniciado_em ||
        execucaoFonte?.data ||
        null,
      finalizadoEm:
        execucaoFonte?.finalizadoEm || execucaoFonte?.finalizado_em || null,
    };
  };

  const obterChaveStatusExecucaoRoteiro = (roteiroAtual) => {
    const roteiroId = String(roteiroAtual?.id || id || "").trim();
    const execucao = normalizarExecucaoSemanalRoteiro(roteiroAtual);
    const dataInicio = String(execucao?.dataInicio || "").trim();

    if (!roteiroId || !dataInicio) return "";
    return `${STATUS_EXECUCAO_ROTEIRO_STORAGE_PREFIX}${roteiroId}:${dataInicio}`;
  };

  const limparStatusExecucoesAnteriores = (roteiroAtual, chaveAtual = "") => {
    const roteiroId = String(roteiroAtual?.id || id || "").trim();
    if (!roteiroId) return;

    const prefixoRoteiro = `${STATUS_EXECUCAO_ROTEIRO_STORAGE_PREFIX}${roteiroId}:`;

    try {
      Object.keys(window.localStorage)
        .filter(
          (chave) =>
            chave.startsWith(prefixoRoteiro) && (!chaveAtual || chave !== chaveAtual),
        )
        .forEach((chave) => window.localStorage.removeItem(chave));
    } catch {
      // Sem bloqueio de fluxo caso localStorage falhe.
    }
  };

  const lerStatusExecucaoRoteiro = (chave) => {
    if (!chave) return { lojas: {}, maquinas: {} };

    try {
      const dados = JSON.parse(window.localStorage.getItem(chave) || "{}");
      return {
        lojas: dados?.lojas && typeof dados.lojas === "object" ? dados.lojas : {},
        maquinas:
          dados?.maquinas && typeof dados.maquinas === "object"
            ? dados.maquinas
            : {},
      };
    } catch {
      return { lojas: {}, maquinas: {} };
    }
  };

  const salvarStatusExecucaoRoteiro = (chave, dados) => {
    if (!chave) return;

    try {
      window.localStorage.setItem(chave, JSON.stringify(dados));
    } catch {
      // Sem bloqueio de fluxo caso localStorage falhe.
    }
  };

  const extrairListasMovimentacoesRoteiro = (roteiroAtual) => {
    const listas = [
      roteiroAtual?.movimentacoesConsideradas,
      roteiroAtual?.movimentacoes_consideradas,
      roteiroAtual?.movimentacoesHoje,
      roteiroAtual?.movimentacoes_hoje,
      roteiroAtual?.movimentacoes,
    ];

    (Array.isArray(roteiroAtual?.lojas) ? roteiroAtual.lojas : []).forEach(
      (loja) => {
        listas.push(
          loja?.movimentacoesConsideradas,
          loja?.movimentacoes_consideradas,
          loja?.movimentacoesHoje,
          loja?.movimentacoes_hoje,
          loja?.movimentacoes,
        );
        (Array.isArray(loja?.maquinas) ? loja.maquinas : []).forEach(
          (maquina) => {
            listas.push(
              maquina?.movimentacoesConsideradas,
              maquina?.movimentacoes_consideradas,
              maquina?.movimentacoesHoje,
              maquina?.movimentacoes_hoje,
              maquina?.movimentacoes,
            );
          },
        );
      },
    );

    return listas.filter(Array.isArray).flat();
  };

  const coletarStatusFinalizadosRoteiro = (roteiroAtual) => {
    const finalizados = { lojas: {}, maquinas: {} };
    const lojas = Array.isArray(roteiroAtual?.lojas) ? roteiroAtual.lojas : [];
    const maquinaParaLoja = {};

    lojas.forEach((loja) => {
      const lojaId = String(loja?.id || "").trim();
      const maquinas = Array.isArray(loja?.maquinas) ? loja.maquinas : [];
      const temMovimentacoesLoja = [
        loja?.movimentacoesConsideradas,
        loja?.movimentacoes_consideradas,
        loja?.movimentacoesHoje,
        loja?.movimentacoes_hoje,
        loja?.movimentacoes,
      ].some(listaTemItens);

      if (lojaId && (pontoEstaConcluido(loja) || temMovimentacoesLoja)) {
        finalizados.lojas[lojaId] = true;
      }

      maquinas.forEach((maquina) => {
        const maquinaId = String(maquina?.id || "").trim();
        if (!maquinaId) return;

        maquinaParaLoja[maquinaId] = lojaId;

        const temMovimentacoes = [
          maquina?.movimentacoesConsideradas,
          maquina?.movimentacoes_consideradas,
          maquina?.movimentacoesHoje,
          maquina?.movimentacoes_hoje,
          maquina?.movimentacoes,
        ].some(listaTemItens);

        if (maquinaEstaConcluidaNoBackend(maquina) || temMovimentacoes) {
          finalizados.maquinas[maquinaId] = true;
          if (lojaId) finalizados.lojas[lojaId] = true;
        }
      });
    });

    extrairListasMovimentacoesRoteiro(roteiroAtual).forEach((mov) => {
      const maquinaId = String(
        mov?.maquinaId || mov?.maquina_id || mov?.maquina?.id || "",
      ).trim();
      const lojaId = String(
        mov?.lojaId ||
          mov?.loja_id ||
          mov?.loja?.id ||
          mov?.maquina?.lojaId ||
          mov?.maquina?.loja?.id ||
          maquinaParaLoja[maquinaId] ||
          "",
      ).trim();

      if (maquinaId) finalizados.maquinas[maquinaId] = true;
      if (lojaId) finalizados.lojas[lojaId] = true;
    });

    return finalizados;
  };

  const aplicarStatusFinalizadosPersistidos = (roteiroAtual, finalizados) => {
    if (!roteiroAtual || typeof roteiroAtual !== "object") return roteiroAtual;

    const lojas = Array.isArray(roteiroAtual?.lojas)
      ? roteiroAtual.lojas.map((loja) => {
          const lojaId = String(loja?.id || "").trim();
          const maquinas = Array.isArray(loja?.maquinas)
            ? loja.maquinas.map((maquina) => {
                const maquinaId = String(maquina?.id || "").trim();
                if (!maquinaId || !finalizados.maquinas[maquinaId]) {
                  return maquina;
                }

                return {
                  ...maquina,
                  status: "finalizado",
                  statusConcluida: true,
                };
              })
            : loja?.maquinas;

          if (!lojaId || !finalizados.lojas[lojaId]) {
            return { ...loja, maquinas };
          }

          return {
            ...loja,
            maquinas,
            status: "finalizado",
            statusConcluida: true,
            concluida: true,
          };
        })
      : roteiroAtual?.lojas;

    return { ...roteiroAtual, lojas };
  };

  const normalizarRoteiroComStatusSemanalPersistido = (roteiroAtual) => {
    const execucaoBruta =
      roteiroAtual?.execucaoSemanal ||
      roteiroAtual?.execucao_semanal ||
      roteiroAtual?.execucao ||
      null;
    const temExecucaoSemanalExplicita =
      execucaoBruta && typeof execucaoBruta === "object";
    const execucao = normalizarExecucaoSemanalRoteiro(roteiroAtual);
    const chave = obterChaveStatusExecucaoRoteiro(roteiroAtual);
    const execucaoAtiva =
      execucao?.emAndamento === true && !execucao?.finalizadoEm && Boolean(chave);

    if (!chave) {
      if (
        temExecucaoSemanalExplicita &&
        (execucao?.emAndamento === false || execucao?.finalizadoEm)
      ) {
        limparStatusExecucoesAnteriores(roteiroAtual);
      }

      return roteiroAtual;
    }

    if (!execucaoAtiva) {
      limparStatusExecucoesAnteriores(roteiroAtual);
      return roteiroAtual;
    }

    limparStatusExecucoesAnteriores(roteiroAtual, chave);

    const persistidos = lerStatusExecucaoRoteiro(chave);
    const atuais = coletarStatusFinalizadosRoteiro(roteiroAtual);
    const finalizados = {
      lojas: { ...persistidos.lojas, ...atuais.lojas },
      maquinas: { ...persistidos.maquinas, ...atuais.maquinas },
    };

    salvarStatusExecucaoRoteiro(chave, finalizados);
    return aplicarStatusFinalizadosPersistidos(roteiroAtual, finalizados);
  };

  const normalizarPontosPuladosBackend = (payload) => {
    const candidatos = [
      payload?.pontosPulados,
      payload?.pontos_pulados,
      payload?.quebrasOrdem,
      payload?.quebras_ordem,
      payload?.resumoExecucao?.pontosPulados,
      payload?.resumoExecucao?.pontos_pulados,
    ];

    const lista = candidatos.find((item) => Array.isArray(item));
    if (!Array.isArray(lista)) return {};

    return lista.reduce((acc, item) => {
      if (!item || typeof item !== "object") return acc;

      const lojaId = String(
        item.lojaId ||
          item.loja_id ||
          item.pontoSelecionadoId ||
          item.pontoSelecionado?.id ||
          item.loja?.id ||
          "",
      ).trim();

      if (!lojaId) return acc;

      acc[lojaId] = {
        justificativaEnviada:
          item.justificativaEnviada === true ||
          item.justificativa_enviada === true ||
          String(item.status || "").toLowerCase() === "justificada",
        justificativa: String(item.justificativa || "").trim(),
      };

      return acc;
    }, {});
  };

  const atualizarPontosPuladosComStatus = (statusQuebra, lojaIdSelecionada) => {
    if (!statusQuebra || typeof statusQuebra !== "object") return;

    const pontoPulado =
      statusQuebra?.pontoPulado || statusQuebra?.ponto_pulado || null;
    const lojaIdPontoPulado = String(
      pontoPulado?.lojaId ||
        pontoPulado?.loja_id ||
        pontoPulado?.pontoSelecionadoId ||
        pontoPulado?.pontoSelecionado?.id ||
        "",
    ).trim();
    const lojaSelecionadaNormalizada = String(lojaIdSelecionada || "").trim();
    const mesmaLojaSelecionada =
      !!lojaIdPontoPulado &&
      !!lojaSelecionadaNormalizada &&
      lojaIdPontoPulado === lojaSelecionadaNormalizada;

    const lojaId = String(
      lojaIdPontoPulado || lojaSelecionadaNormalizada,
    ).trim();

    if (!lojaId) return;

    const motivo = String(statusQuebra?.motivo || "")
      .trim()
      .toLowerCase();
    const justificativaEnviada =
      (pontoPulado?.justificativaEnviada === true &&
        (!lojaSelecionadaNormalizada || mesmaLojaSelecionada)) ||
      (motivo === "ponto_selecionado_ja_justificado" && mesmaLojaSelecionada);

    if (!justificativaEnviada) return;

    setPontosPuladosPorLoja((prev) => ({
      ...prev,
      [lojaId]: {
        justificativaEnviada: true,
        justificativa: String(
          pontoPulado?.justificativa || prev?.[lojaId]?.justificativa || "",
        ).trim(),
      },
    }));
  };

  const lojaComMaquinasFinalizadas = (loja) => {
    const maquinas = Array.isArray(loja?.maquinas) ? loja.maquinas : [];
    if (!pontoEstaConcluido(loja) || maquinas.length === 0) {
      return false;
    }

    return maquinas.every((maquina) => maquinaEstaConcluidaNoBackend(maquina));
  };

  const enviarWhatsAppLoja = (loja) => {
    if (!loja?.id) return;
    const mensagemPendente = montarMensagemMovimentacoesWhatsAppLoja({
      roteiroId: id,
      usuarioId: usuario?.id,
      lojaId: loja.id,
    });
    const mensagem =
      mensagemPendente ||
      obterUltimaMensagemMovimentacoesWhatsAppLoja({
        roteiroId: id,
        usuarioId: usuario?.id,
        lojaId: loja.id,
      });

    if (!mensagem) {
      setError(
        "Nao ha leituras salvas para este ponto ainda. Finalize ao menos uma maquina para gerar a mensagem.",
      );
      return;
    }

    const abriuWhatsApp = abrirWhatsAppComMensagem(mensagem, null, {
      preferSameTab: true,
      noFallback: true,
    });
    if (abriuWhatsApp) {
      setSuccess("Mensagem de leituras enviada para o WhatsApp.");
    } else {
      setError(
        "Nao foi possivel abrir o WhatsApp. Verifique se o navegador bloqueou a abertura de janelas.",
      );
    }

    salvarUltimaMensagemMovimentacoesWhatsAppLoja({
      roteiroId: id,
      usuarioId: usuario?.id,
      lojaId: loja.id,
      mensagem,
    });

    if (mensagemPendente) {
      removerMovimentacoesWhatsAppPendentesLoja({
        roteiroId: id,
        usuarioId: usuario?.id,
        lojaId: loja.id,
      });
      setLeiturasAtualizadasPorLoja((prev) => ({
        ...prev,
        [String(loja.id)]: false,
      }));
    }
  };

  const roteiroTemPendencias = (roteiroAtual) => {
    const lojas = Array.isArray(roteiroAtual?.lojas) ? roteiroAtual.lojas : [];
    return lojas.some((loja) => {
      const statusLojaConcluido = pontoEstaConcluido(loja);
      const maquinas = Array.isArray(loja?.maquinas) ? loja.maquinas : [];

      if (!statusLojaConcluido) return true;
      return maquinas.some((maquina) => !maquinaEstaConcluidaNoBackend(maquina));
    });
  };

  const roteiroTemVeiculoAssociado = (roteiroAtual) =>
    Boolean(
      String(roteiroAtual?.veiculoId || roteiroAtual?.veiculo?.id || "").trim(),
    );

  const roleUsuarioNormalizado = String(usuario?.role || "")
    .trim()
    .toUpperCase();
  // Rota com funcionário responsável de role ABASTECEDOR: sem veículo, sem
  // gastos e sem finalização manual. Prioriza o flag pronto que o backend
  // calcula por rota (`funcionarioAbastecedor`/`funcionario.role`), mas cai
  // para o role do usuário logado quando ele é o próprio responsável pela
  // rota — assim, se o admin mudar o role de alguém para ABASTECEDOR, a
  // rota já existente dessa pessoa vira simplificada na hora, mesmo que o
  // backend ainda não tenha recalculado/retornado o flag por algum motivo.
  const isFuncionarioAbastecedor =
    roteiro?.funcionarioAbastecedor === true ||
    roteiro?.funcionario?.role === "ABASTECEDOR" ||
    (roleUsuarioNormalizado === "ABASTECEDOR" &&
      Boolean(usuario?.id) &&
      String(roteiro?.funcionarioId || "") === String(usuario?.id));
  const usuarioPodeEditarMovimentacaoNaRota =
    perfisPermitidosEditarMovimentacaoRota.has(roleUsuarioNormalizado) ||
    roleUsuarioNormalizado.includes("FUNCIONARIO") ||
    roleUsuarioNormalizado.includes("ABASTECEDOR");

  const obterChaveEdicoesMovimentacaoRota = () => {
    const roteiroId = String(id || "").trim();
    const usuarioId = String(
      roteiro?.funcionarioId || usuario?.id || "",
    ).trim();
    if (!roteiroId || !usuarioId) return "";
    return `${EDICOES_MOVIMENTACAO_ROTA_STORAGE_PREFIX}${usuarioId}:${roteiroId}`;
  };

  const carregarEdicoesMovimentacaoRota = () => {
    const chave = obterChaveEdicoesMovimentacaoRota();
    if (!chave) return [];

    try {
      const bruto = window.localStorage.getItem(chave);
      if (!bruto) return [];
      const lista = JSON.parse(bruto);
      return Array.isArray(lista) ? lista : [];
    } catch {
      return [];
    }
  };

  const salvarEdicoesMovimentacaoRota = (lista) => {
    const chave = obterChaveEdicoesMovimentacaoRota();
    if (!chave) return;

    try {
      window.localStorage.setItem(chave, JSON.stringify(lista));
    } catch {
      // Sem bloqueio de fluxo caso localStorage falhe.
    }
  };

  const limparEdicoesMovimentacaoRota = () => {
    const chave = obterChaveEdicoesMovimentacaoRota();
    if (!chave) return;

    try {
      window.localStorage.removeItem(chave);
    } catch {
      // Sem bloqueio de fluxo caso localStorage falhe.
    }
  };

  const obterChaveJustificativasEdicaoMovimentacaoRota = () => {
    const roteiroId = String(id || "").trim();
    const usuarioId = String(
      roteiro?.funcionarioId || usuario?.id || "",
    ).trim();
    if (!roteiroId || !usuarioId) return "";
    return `${JUSTIFICATIVAS_EDICAO_MOVIMENTACAO_ROTA_STORAGE_PREFIX}${usuarioId}:${roteiroId}`;
  };

  const carregarJustificativasEdicaoMovimentacaoRota = () => {
    const chave = obterChaveJustificativasEdicaoMovimentacaoRota();
    if (!chave) return {};

    try {
      const bruto = window.localStorage.getItem(chave);
      if (!bruto) return {};
      const payload = JSON.parse(bruto);
      return payload && typeof payload === "object" && !Array.isArray(payload)
        ? payload
        : {};
    } catch {
      return {};
    }
  };

  const salvarJustificativasEdicaoMovimentacaoRota = (payload) => {
    const chave = obterChaveJustificativasEdicaoMovimentacaoRota();
    if (!chave) return;

    try {
      window.localStorage.setItem(chave, JSON.stringify(payload || {}));
    } catch {
      // Sem bloqueio de fluxo caso localStorage falhe.
    }
  };

  const limparJustificativasEdicaoMovimentacaoRota = () => {
    const chave = obterChaveJustificativasEdicaoMovimentacaoRota();
    if (!chave) return;

    try {
      window.localStorage.removeItem(chave);
    } catch {
      // Sem bloqueio de fluxo caso localStorage falhe.
    }
  };

  const STATUS_MANUTENCAO_REALIZADA = new Set([
    "feito",
    "concluida",
    "concluido",
    "finalizada",
    "finalizado",
  ]);

  const extrairResumoManutencoesDaLista = (listaManutencoes, roteiroAtual) => {
    const itens = Array.isArray(listaManutencoes) ? listaManutencoes : [];
    const lojasRoteiro = Array.isArray(roteiroAtual?.lojas)
      ? roteiroAtual.lojas
      : [];
    const lojasRoteiroNomes = Array.from(
      new Set(
        lojasRoteiro
          .map((loja) => String(loja?.nome || "").trim())
          .filter(Boolean),
      ),
    );

    const manutencoesFeitas = itens.filter((item) => {
      const status = String(item?.status || "")
        .trim()
        .toLowerCase();
      return STATUS_MANUTENCAO_REALIZADA.has(status);
    });

    const lojasComManutencao = Array.from(
      new Set(
        manutencoesFeitas
          .map((item) =>
            String(item?.loja?.nome || item?.lojaNome || "").trim(),
          )
          .filter(Boolean),
      ),
    );

    const lojasSemManutencao = lojasRoteiroNomes.filter(
      (nomeLoja) => !lojasComManutencao.includes(nomeLoja),
    );

    return {
      totalRealizadas: manutencoesFeitas.length,
      lojasComManutencao,
      lojasSemManutencao,
    };
  };

  const formatarMoedaBRL = (valor) =>
    Number(valor || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });

  const formatarDataHora = (dataIso) => {
    const data = new Date(dataIso);
    if (Number.isNaN(data.getTime())) {
      return { data: "-", hora: "-" };
    }
    return {
      data: data.toLocaleDateString("pt-BR"),
      hora: data.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
  };

  const obterDataHojeIso = () => new Date().toISOString().slice(0, 10);

  const normalizarListaResumoBackend = (lista) => {
    if (!Array.isArray(lista)) return [];

    const valores = lista
      .map((item) => {
        if (typeof item === "string") return item.trim();
        if (!item || typeof item !== "object") return "";
        return String(
          item.nome ||
            item.descricao ||
            item.lojaNome ||
            item.maquinaNome ||
            item.pontoNome ||
            "",
        ).trim();
      })
      .filter(Boolean);

    return Array.from(new Set(valores));
  };

  const normalizarResumoExecucaoBackend = (
    payloadResumo,
    roteiroAtual = null,
  ) => {
    if (!payloadResumo || typeof payloadResumo !== "object") return null;

    const resumo = payloadResumo?.resumoExecucao || payloadResumo;
    const textoResumo = String(
      resumo?.resumoTextoCopiar ||
        payloadResumo?.resumoTextoCopiar ||
        resumo?.mensagemResumoWhatsapp ||
        payloadResumo?.mensagemResumoWhatsapp ||
        "",
    ).trim();

    const extrairNumero = (...valores) => {
      for (const valor of valores) {
        const numero = Number(valor);
        if (Number.isFinite(numero)) return numero;
      }
      return null;
    };

    const extrairNumeroDoResumoTexto = (...rotulos) => {
      if (!textoResumo) return null;

      for (const rotulo of rotulos) {
        const regex = new RegExp(`${rotulo}\\s*:\\s*([\\d.]+)`, "i");
        const match = textoResumo.match(regex);
        if (!match?.[1]) continue;

        const numero = Number(String(match[1]).replace(/\./g, ""));
        if (Number.isFinite(numero)) return numero;
      }

      return null;
    };

    const pontosFeitos = normalizarListaResumoBackend(
      resumo?.pontosFeitos || resumo?.lojasFeitas || [],
    );
    const pontosNaoFeitos = normalizarListaResumoBackend(
      resumo?.pontosNaoFeitos || resumo?.lojasNaoFeitas || [],
    );
    const totalPontosNaRota =
      extrairNumero(
        resumo?.totalPontosNaRota,
        payloadResumo?.totalPontosNaRota,
      ) ||
      extrairNumeroDoResumoTexto("Total de pontos na rota") ||
      pontosFeitos.length + pontosNaoFeitos.length;

    const estoqueInicial = extrairNumero(
      resumo?.estoqueInicial,
      resumo?.resumoConsumoProdutos?.estoqueInicialTotal,
      resumo?.estoqueInicialTotal,
      payloadResumo?.estoqueInicial,
      payloadResumo?.estoqueInicialTotal,
    );

    const totalGastoRota = extrairNumero(
      resumo?.totalGastoRota,
      resumo?.resumoConsumoProdutos?.consumoTotalProdutos,
      resumo?.consumoTotalProdutos,
      payloadResumo?.totalGastoRota,
      payloadResumo?.consumoTotalProdutos,
    );

    const estoqueAdicional =
      extrairNumero(
        resumo?.estoqueAdicional,
        resumo?.resumoConsumoProdutos?.estoqueAdicional,
        payloadResumo?.estoqueAdicional,
      ) ||
      extrairNumeroDoResumoTexto("Estoque adicional");

    const estoqueInicialSeguro = Number(estoqueInicial || 0);
    const consumoTotalSeguro = Number(totalGastoRota || 0);
    const estoqueAdicionalSeguro = Number(estoqueAdicional || 0);
    const consumoDoAdicional = Math.max(0, consumoTotalSeguro - estoqueInicialSeguro);
    const sobraEstoqueInicialCalculada = Math.max(
      0,
      estoqueInicialSeguro - consumoTotalSeguro,
    );
    const sobraEstoqueAdicionalCalculada = Math.max(
      0,
      estoqueAdicionalSeguro - consumoDoAdicional,
    );

    const sobraEstoqueInicial =
      extrairNumero(
        resumo?.sobraEstoqueInicial,
        resumo?.resumoConsumoProdutos?.sobraEstoqueInicial,
        payloadResumo?.sobraEstoqueInicial,
      ) ||
      extrairNumeroDoResumoTexto("Sobra estoque inicial") ||
      sobraEstoqueInicialCalculada;

    const sobraEstoqueAdicional =
      extrairNumero(
        resumo?.sobraEstoqueAdicional,
        resumo?.resumoConsumoProdutos?.sobraEstoqueAdicional,
        payloadResumo?.sobraEstoqueAdicional,
      ) ||
      extrairNumeroDoResumoTexto("Sobra estoque adicional") ||
      sobraEstoqueAdicionalCalculada;

    return {
      roteiro:
        String(
          resumo?.roteiroNome ||
            resumo?.roteiro?.nome ||
            payloadResumo?.roteiro?.nome ||
            roteiroAtual?.nome ||
            "",
        ).trim() || "-",
      pontosFeitos,
      pontosNaoFeitos,
      totalPontosNaRota,
      maquinasFeitas: normalizarListaResumoBackend(
        resumo?.maquinasFeitas || [],
      ),
      maquinasNaoFeitas: normalizarListaResumoBackend(
        resumo?.maquinasNaoFeitas || [],
      ),
      estoqueInicial,
      estoqueAdicional,
      sobraEstoqueInicial,
      sobraEstoqueAdicional,
      estoqueFinal: extrairNumero(
        resumo?.estoqueFinal,
        resumo?.resumoConsumoProdutos?.estoqueFinalTotal,
      ),
      totalGastoRota,
      despesaTotal: extrairNumero(resumo?.despesaTotal),
      sobraValorDespesa: extrairNumero(resumo?.sobraValorDespesa),
      totalManutencoesRealizadas: extrairNumero(
        resumo?.totalManutencoesRealizadas,
        resumo?.totalDeManutencoesRealizadas,
      ),
      lojasComManutencaoRealizada: normalizarListaResumoBackend(
        resumo?.lojasComManutencaoRealizada || resumo?.lojasComManutencao || [],
      ),
      lojasSemManutencaoRealizada: normalizarListaResumoBackend(
        resumo?.lojasSemManutencaoRealizada || resumo?.lojasSemManutencao || [],
      ),
      manutencoesRealizadas: normalizarListaResumoBackend(
        resumo?.manutencoesRealizadas || [],
      ),
      manutencoesNaoRealizadas: normalizarListaResumoBackend(
        resumo?.manutencoesNaoRealizadas || [],
      ),
      manutencoesNaoRealizadasPorPonto: normalizarListaResumoBackend(
        resumo?.manutencoesNaoRealizadasPorPonto || [],
      ),
      mensagemResumoWhatsapp: String(
        resumo?.mensagemResumoWhatsapp ||
          payloadResumo?.mensagemResumoWhatsapp ||
          "",
      ).trim(),
      resumoTextoCopiar: String(
        resumo?.resumoTextoCopiar ||
          payloadResumo?.resumoTextoCopiar ||
          "",
      ).trim(),
      finalizado:
        Boolean(resumo?.finalizado) ||
        roteiroEstaFinalizado(
          resumo?.status || payloadResumo?.status || roteiroAtual?.status,
        ),
    };
  };

  const parseValorMonetario = (valorTexto) => {
    const texto = String(valorTexto || "").trim();
    if (!texto) return 0;
    return Number(texto.replace(",", "."));
  };

  const parseKmInteiroNaoNegativo = (valor) => {
    const texto = String(valor ?? "").trim();
    if (!texto) return { ok: false, numero: null };
    if (!/^\d+$/.test(texto)) return { ok: false, numero: null };

    const numero = Number(texto);
    if (!Number.isInteger(numero) || numero < 0) {
      return { ok: false, numero: null };
    }

    return { ok: true, numero };
  };

  const obterTextoResumoParaCompartilhar = () =>
    String(
      resumoExecucaoBackend?.resumoTextoCopiar ||
        resumoExecucaoBackend?.mensagemResumoWhatsapp ||
        roteiro?.resumoTextoCopiar ||
        roteiro?.mensagemResumoWhatsapp ||
        "",
    ).trim();

  const enviarResumoWhatsapp = async () => {
    if (enviandoResumoWhatsapp) return;

    const textoResumo = obterTextoResumoParaCompartilhar();
    if (!textoResumo) {
      setError(
        "Resumo ainda não disponível para envio. Finalize a rota e tente novamente.",
      );
      return;
    }

    const popupReservado = window.open("about:blank", "_blank");

    try {
      setError("");
      setSuccess("");
      setEnviandoResumoWhatsapp(true);

      const abriuWhatsApp = abrirWhatsAppComMensagem(textoResumo, popupReservado);
      if (!abriuWhatsApp) {
        setSuccess(
          "Resumo pronto, mas o navegador bloqueou a abertura do WhatsApp. Libere pop-up para o StarBox.",
        );
      } else {
        setSuccess("Resumo do roteiro enviado para confirmação no WhatsApp.");
      }
    } finally {
      setEnviandoResumoWhatsapp(false);
    }
  };

  const copiarResumoFinalizacao = async () => {
    if (copiandoResumo) return;

    const textoResumo = obterTextoResumoParaCompartilhar();
    if (!textoResumo) {
      setError("Resumo ainda não disponível para cópia.");
      return;
    }

    try {
      setCopiandoResumo(true);
      await navigator.clipboard.writeText(textoResumo);
      setSuccess("Resumo copiado com sucesso");
    } catch {
      setError(
        "Não foi possível copiar automaticamente. Verifique permissão de clipboard no navegador.",
      );
    } finally {
      setCopiandoResumo(false);
    }
  };

  const extrairTextoValido = (...valores) => {
    for (const valor of valores) {
      if (valor === null || valor === undefined) continue;
      if (typeof valor === "string") {
        const texto = valor.trim();
        if (texto) return texto;
        continue;
      }
      if (typeof valor === "number") {
        return String(valor);
      }
    }
    return "";
  };

  const obterNomeMaquinaExibicao = (maquina) =>
    extrairTextoValido(maquina?.nome, maquina?.codigo) || "-";

  const obterTipoMaquinaExibicao = (maquina) =>
    extrairTextoValido(
      tiposMaquinaPorId[String(maquina?.id || "")],
      maquina?.tipo,
      maquina?.tipoMaquina,
      maquina?.modelo,
      maquina?.modeloMaquina,
      maquina?.tipoNome,
      maquina?.tipo?.nome,
      maquina?.modelo?.nome,
    ) || "Não informado";

  const normalizarMovimentacoes = (payload) => {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.rows)) return payload.rows;
    if (Array.isArray(payload?.movimentacoes)) return payload.movimentacoes;
    if (payload && typeof payload === "object") {
      const valores = Object.values(payload);
      if (Array.isArray(valores)) return valores;
    }
    return [];
  };

  const normalizarIdTexto = (valor) =>
    String(valor || "")
      .trim()
      .toLowerCase();

  const obterUsuarioMovimentacao = (movimentacao) =>
    normalizarIdTexto(
      movimentacao?.usuarioId ||
        movimentacao?.usuario_id ||
        movimentacao?.funcionarioId ||
        movimentacao?.funcionario_id ||
        movimentacao?.userId ||
        movimentacao?.createdBy ||
        movimentacao?.usuario?.id ||
        movimentacao?.funcionario?.id ||
        "",
    );

  const obterUltimaMovimentacaoPorMaquina = (maquinaId) =>
    ultimasMovimentacoesPorMaquina[String(maquinaId || "")] || null;

  const podeEditarUltimaMovimentacaoDaMaquina = (maquina) => {
    // Exibir para todas as roles quando a máquina já está finalizada.
    return maquinaEstaConcluidaNoBackend(maquina);
  };

  const registrarMaquinaEditadaNaRota = (maquina) => {
    const maquinaId = String(maquina?.id || "").trim();
    if (!maquinaId) return;

    const nomeMaquina = obterNomeMaquinaExibicao(maquina);
    const tipoMaquina = obterTipoMaquinaExibicao(maquina);

    setMaquinasEditadasNaRota((prev) => {
      const jaExiste = prev.some(
        (item) => String(item?.id || "").trim() === maquinaId,
      );
      if (jaExiste) return prev;

      const proximaLista = [
        ...prev,
        { id: maquinaId, nome: nomeMaquina, tipo: tipoMaquina },
      ];
      salvarEdicoesMovimentacaoRota(proximaLista);
      return proximaLista;
    });
  };

  const formatarValorAlteracaoMovimentacao = (valor, tipo = "texto") => {
    if (valor === null || valor === undefined || valor === "") {
      return "vazio";
    }

    if (tipo === "data") {
      const data = new Date(valor);
      if (!Number.isNaN(data.getTime())) {
        return data.toLocaleString("pt-BR");
      }
    }

    return String(valor);
  };

  const obterProdutoPrincipalMovimentacao = (movimentacao) => {
    const detalhePrincipal = Array.isArray(movimentacao?.detalhesProdutos)
      ? movimentacao.detalhesProdutos[0]
      : null;

    return {
      id: detalhePrincipal?.produtoId || null,
      nome: detalhePrincipal?.produto?.nome || null,
    };
  };

  const montarAlteracoesMovimentacao = (anterior, atualizada) => {
    const alteracoes = [];
    const camposComparaveis = [
      ["totalPre", "Total pré"],
      ["sairam", "Saíram"],
      ["abastecidas", "Abastecidas"],
      ["fichas", "Fichas"],
      ["contadorIn", "Contador entrada"],
      ["contadorOut", "Contador saída"],
      ["contadorMaquina", "Contador máquina"],
      ["tipoOcorrencia", "Tipo de ocorrência"],
      ["observacoes", "Observações"],
      ["dataColeta", "Data da coleta", "data"],
    ];

    camposComparaveis.forEach(([campo, rotulo, tipo]) => {
      const valorAnterior = anterior?.[campo] ?? null;
      const valorAtual = atualizada?.[campo] ?? null;

      if (String(valorAnterior ?? "") === String(valorAtual ?? "")) {
        return;
      }

      alteracoes.push(
        `${rotulo}: ${formatarValorAlteracaoMovimentacao(valorAnterior, tipo)} -> ${formatarValorAlteracaoMovimentacao(valorAtual, tipo)}`,
      );
    });

    const produtoAnterior = obterProdutoPrincipalMovimentacao(anterior);
    const produtoAtual = obterProdutoPrincipalMovimentacao(atualizada);
    const chaveProdutoAnterior = `${produtoAnterior.id || ""}:${produtoAnterior.nome || ""}`;
    const chaveProdutoAtual = `${produtoAtual.id || ""}:${produtoAtual.nome || ""}`;

    if (chaveProdutoAnterior !== chaveProdutoAtual) {
      alteracoes.push(
        `Produto: ${formatarValorAlteracaoMovimentacao(produtoAnterior.nome || produtoAnterior.id)} -> ${formatarValorAlteracaoMovimentacao(produtoAtual.nome || produtoAtual.id)}`,
      );
    }

    return alteracoes;
  };

  const numeroOuFallback = (...valores) => {
    for (const valor of valores) {
      if (valor === null || valor === undefined || valor === "") continue;
      const numero = Number(valor);
      if (Number.isFinite(numero)) return numero;
    }
    return 0;
  };

  const formatarNumeroLeitura = (valor, casas = 0) =>
    Number(valor || 0).toLocaleString("pt-BR", {
      minimumFractionDigits: casas,
      maximumFractionDigits: casas,
    });

  const obterProdutoMovimentacaoParaLeitura = (movimentacao, resumoBase) => {
    const detalhePrincipal = Array.isArray(movimentacao?.detalhesProdutos)
      ? movimentacao.detalhesProdutos[0]
      : null;

    return {
      nome:
        detalhePrincipal?.produto?.nome ||
        detalhePrincipal?.produtoNome ||
        resumoBase?.nomeProdutoAbastecido ||
        resumoBase?.nomeProdutoAbastecimentoExtra ||
        "",
      quantidade: numeroOuFallback(
        movimentacao?.abastecidas,
        movimentacao?.quantidadeAdicionada,
        detalhePrincipal?.quantidadeAbastecida,
        resumoBase?.quantidadeAbastecidaInformada,
      ),
    };
  };

  const montarMensagemLeituraAtualizada = (resumo) => {
    const alteracoes = Array.isArray(resumo?.alteracoesLeitura)
      ? resumo.alteracoesLeitura
      : [];
    const quantidadeSaiu = Number(resumo?.quantidadeSaiu || 0);
    const saldo = Number(resumo?.saldo ?? resumo?.diferencaIn ?? 0);
    const jogadaPorPelucia = quantidadeSaiu > 0 ? saldo / quantidadeSaiu : 0;

    return [
      "STAR BOX",
      `*${resumo?.lojaNome || "LOJA"}*`,
      `Data: ${new Date(resumo?.dataMovimentacao || Date.now()).toLocaleString("pt-BR")}`,
      `LanÃ§ado por: ${resumo?.nomeUsuario || usuario?.nome || "-"}`,
      "___________________________________",
      `${resumo?.codigoMaquina || "-"} | ${resumo?.tipoMaquina || "MÃ¡quina"}${resumo?.modeloMaquina ? ` | Modelo: ${resumo.modeloMaquina}` : ""}`,
      ...(resumo?.nomeProdutoAbastecido
        ? [
            `Produto abastecido: ${resumo.nomeProdutoAbastecido}${Number(resumo?.quantidadeAbastecidaInformada || 0) > 0 ? ` (Qtd: ${formatarNumeroLeitura(resumo.quantidadeAbastecidaInformada)})` : ""}`,
          ]
        : []),
      "Leitura atualizada",
      ...alteracoes.map((item) => `Alteracao: ${item}`),
      `E  ${formatarNumeroLeitura(resumo?.inAnterior)}  ${formatarNumeroLeitura(resumo?.inAtual)}  ____ ${formatarNumeroLeitura(resumo?.diferencaIn, 2)}`,
      `S  ${formatarNumeroLeitura(resumo?.outAnterior)}  ${formatarNumeroLeitura(resumo?.outAtual)}  ____ ${formatarNumeroLeitura(quantidadeSaiu)}`,
      `Saldo: R$${formatarNumeroLeitura(saldo, 2)}`,
      `Jogada: R$${formatarNumeroLeitura(jogadaPorPelucia, 2)}`,
    ].join("\n");
  };

  const atualizarLeituraPendenteAposEdicao = ({
    maquina,
    movimentacaoAnterior,
    movimentacaoAtualizada,
  }) => {
    const lojaIdAtual = String(
      lojaSelecionada?.id || maquina?.lojaId || maquina?.loja?.id || "",
    ).trim();
    const maquinaIdAtual = String(
      maquina?.id ||
        movimentacaoAtualizada?.maquinaId ||
        movimentacaoAtualizada?.maquina?.id ||
        movimentacaoAnterior?.maquinaId ||
        "",
    ).trim();

    if (!lojaIdAtual || !maquinaIdAtual) return false;

    const leiturasPendentes = obterMovimentacoesWhatsAppPendentesLoja({
      roteiroId: id,
      usuarioId: usuario?.id,
      lojaId: lojaIdAtual,
    });
    const leituraOriginal = [...leiturasPendentes]
      .reverse()
      .find((item) => String(item?.maquinaId || "").trim() === maquinaIdAtual);

    if (!leituraOriginal?.resumo) return false;

    const resumoBase = leituraOriginal.resumo;
    const inAnterior = numeroOuFallback(resumoBase?.inAnterior);
    const outAnterior = numeroOuFallback(resumoBase?.outAnterior);
    const inAtual = numeroOuFallback(
      movimentacaoAtualizada?.contadorIn,
      movimentacaoAtualizada?.contadorInAtual,
      resumoBase?.inAtual,
    );
    const outAtual = numeroOuFallback(
      movimentacaoAtualizada?.contadorOut,
      movimentacaoAtualizada?.contadorOutAtual,
      resumoBase?.outAtual,
    );
    const diferencaIn = Math.max(0, inAtual - inAnterior);
    const quantidadeSaiu = numeroOuFallback(
      movimentacaoAtualizada?.sairam,
      movimentacaoAtualizada?.quantidadeSaiu,
      Math.max(0, outAtual - outAnterior),
    );
    const valorJogada = numeroOuFallback(
      resumoBase?.valorJogada,
      resumoBase?.valorFicha,
      maquina?.valorFicha,
      movimentacaoAtualizada?.maquina?.valorFicha,
      movimentacaoAnterior?.maquina?.valorFicha,
    );
    const usaFichas =
      resumoBase?.usaFichas === true ||
      resumoBase?.usa_fichas === true ||
      maquina?.usaFichas === true ||
      maquina?.usa_fichas === true ||
      movimentacaoAtualizada?.maquina?.usaFichas === true ||
      movimentacaoAtualizada?.maquina?.usa_fichas === true ||
      movimentacaoAnterior?.maquina?.usaFichas === true ||
      movimentacaoAnterior?.maquina?.usa_fichas === true;
    const saldo =
      usaFichas && valorJogada > 0 ? diferencaIn * valorJogada : diferencaIn;
    const jogadasMediasPorPelucia =
      quantidadeSaiu > 0 ? saldo / quantidadeSaiu : 0;
    const produto = obterProdutoMovimentacaoParaLeitura(
      movimentacaoAtualizada,
      resumoBase,
    );
    const alteracoes = montarAlteracoesMovimentacao(
      movimentacaoAnterior,
      movimentacaoAtualizada,
    );

    const resumoAtualizado = {
      ...resumoBase,
      dataMovimentacao: new Date().toISOString(),
      nomeUsuario: usuario?.nome || resumoBase?.nomeUsuario || "-",
      codigoMaquina:
        resumoBase?.codigoMaquina || obterNomeMaquinaExibicao(maquina),
      tipoMaquina: resumoBase?.tipoMaquina || obterTipoMaquinaExibicao(maquina),
      inAnterior,
      inAtual,
      outAnterior,
      outAtual,
      diferencaIn,
      quantidadeSaiu,
      jogado: saldo,
      saldo,
      valorJogada,
      usaFichas,
      jogadasMediasPorPelucia,
      quantidadeAbastecidaInformada: produto.quantidade,
      nomeProdutoAbastecido: produto.nome,
      alteracoesLeitura: alteracoes,
      leituraAtualizada: true,
    };

    const atualizou = atualizarMovimentacaoWhatsAppPendenteLoja({
      roteiroId: id,
      usuarioId: usuario?.id,
      lojaId: lojaIdAtual,
      maquinaId: maquinaIdAtual,
      mensagem: montarMensagemLeituraAtualizada(resumoAtualizado),
      resumo: resumoAtualizado,
    });

    if (atualizou) {
      setLeiturasAtualizadasPorLoja((prev) => ({
        ...prev,
        [lojaIdAtual]: true,
      }));
    }

    return atualizou;
  };

  const abrirModalAbastecimentoExtra = async (maquina) => {
    let ultimaMov = obterUltimaMovimentacaoPorMaquina(maquina?.id);

    const usuarioAtualId = normalizarIdTexto(usuario?.id);
    if (
      ultimaMov?.id &&
      usuarioAtualId &&
      obterUsuarioMovimentacao(ultimaMov) !== usuarioAtualId
    ) {
      ultimaMov = null;
    }

    if (!ultimaMov?.id) {
      try {
        ultimaMov = await buscarUltimaMovimentacaoDaMaquina(maquina?.id);
        if (ultimaMov?.id) {
          setUltimasMovimentacoesPorMaquina((prev) => ({
            ...prev,
            [String(maquina?.id || "")]: ultimaMov,
          }));
        }
      } catch {
        // Erro tratado abaixo.
      }
    }

    if (!ultimaMov?.id) {
      setError(
        "Não foi possível identificar a última movimentação desta máquina para abastecimento.",
      );
      return;
    }

    let produtosDisponiveisExtra = [];
    let erroProdutos = "";

    try {
      const [produtosRes, estoqueUsuarioRes] = await Promise.all([
        api.get("/produtos"),
        api
          .get("/estoque-usuarios/me")
          .catch(() => ({ data: { estoque: [] } })),
      ]);

      const listaProdutos = Array.isArray(produtosRes.data)
        ? produtosRes.data
        : [];
      const estoqueUsuarioData = Array.isArray(
        estoqueUsuarioRes?.data?.estoque,
      )
        ? estoqueUsuarioRes.data.estoque
        : Array.isArray(estoqueUsuarioRes?.data)
          ? estoqueUsuarioRes.data
          : [];

      const produtoIdsComEstoque = new Set(
        estoqueUsuarioData
          .filter((item) => Number(item?.quantidade || 0) > 0)
          .map((item) => String(item.produtoId)),
      );

      produtosDisponiveisExtra = listaProdutos.filter((produto) =>
        produtoIdsComEstoque.has(String(produto?.id || "")),
      );
      setProdutosAbastecimentoExtra(produtosDisponiveisExtra);
    } catch (err) {
      setProdutosAbastecimentoExtra([]);
      erroProdutos =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        "Não foi possível carregar os produtos disponíveis em estoque.";
    }

    const produtoPrincipal = obterProdutoPrincipalMovimentacao(ultimaMov);
    const ultimoProdutoId = String(produtoPrincipal?.id || "").trim();
    const produtoInicialId = produtosDisponiveisExtra.some(
      (produto) =>
        String(produto?.id || "") === ultimoProdutoId,
    )
      ? ultimoProdutoId
      : "";

    setModalAbastecimentoExtra({
      aberto: true,
      maquina,
      movimentacao: ultimaMov,
      quantidade: "",
      produtoId: produtoInicialId,
      ultimoProdutoId,
      produtoPendenteId: "",
      confirmarTrocaProdutoAberto: false,
      erro: erroProdutos,
      loading: false,
    });
  };

  const fecharModalAbastecimentoExtra = () => {
    if (modalAbastecimentoExtra.loading) return;
    setModalAbastecimentoExtra({
      aberto: false,
      maquina: null,
      movimentacao: null,
      quantidade: "",
      produtoId: "",
      ultimoProdutoId: "",
      produtoPendenteId: "",
      confirmarTrocaProdutoAberto: false,
      erro: "",
      loading: false,
    });
  };

  const alterarProdutoAbastecimentoExtra = (produtoIdSelecionado) => {
    const ultimoProdutoId = String(
      modalAbastecimentoExtra.ultimoProdutoId || "",
    );
    const novoProdutoId = String(produtoIdSelecionado || "");

    if (
      ultimoProdutoId &&
      novoProdutoId &&
      novoProdutoId !== ultimoProdutoId
    ) {
      setModalAbastecimentoExtra((prev) => ({
        ...prev,
        produtoPendenteId: novoProdutoId,
        confirmarTrocaProdutoAberto: true,
        erro: "",
      }));
      return;
    }

    setModalAbastecimentoExtra((prev) => ({
      ...prev,
      produtoId: novoProdutoId,
      erro: "",
    }));
  };

  const cancelarTrocaProdutoAbastecimentoExtra = () => {
    setModalAbastecimentoExtra((prev) => ({
      ...prev,
      produtoPendenteId: "",
      confirmarTrocaProdutoAberto: false,
    }));
  };

  const confirmarTrocaProdutoAbastecimentoExtra = async () => {
    const produtoIdConfirmado = String(
      modalAbastecimentoExtra.produtoPendenteId || "",
    ).trim();

    setModalAbastecimentoExtra((prev) => ({
      ...prev,
      produtoId: produtoIdConfirmado,
      produtoPendenteId: "",
      confirmarTrocaProdutoAberto: false,
      erro: "",
    }));

    await salvarAbastecimentoExtra(produtoIdConfirmado);
  };

  const salvarAbastecimentoExtra = async (produtoIdConfirmado = "") => {
    const quantidadeNumero = Number(modalAbastecimentoExtra.quantidade || 0);
    const produtoId = String(
      produtoIdConfirmado || modalAbastecimentoExtra.produtoId || "",
    ).trim();

    if (!Number.isFinite(quantidadeNumero) || quantidadeNumero <= 0) {
      setModalAbastecimentoExtra((prev) => ({
        ...prev,
        erro: "Informe uma quantidade válida para abastecimento.",
      }));
      return;
    }

    if (!produtoId) {
      setModalAbastecimentoExtra((prev) => ({
        ...prev,
        erro: "Selecione o produto abastecido.",
      }));
      return;
    }

    if (!modalAbastecimentoExtra.movimentacao?.id) {
      setModalAbastecimentoExtra((prev) => ({
        ...prev,
        erro: "Movimentação base não encontrada para abastecimento.",
      }));
      return;
    }

    try {
      setModalAbastecimentoExtra((prev) => ({
        ...prev,
        produtoId,
        erro: "",
        loading: true,
      }));

      const res = await api.patch(
        `/movimentacoes/${modalAbastecimentoExtra.movimentacao.id}/abastecimento-extra`,
        {
          produtoId,
          quantidadeAbastecida: quantidadeNumero,
        },
      );

      const movimentacaoAtualizada = res.data;
      const maquina =
        modalAbastecimentoExtra.maquina || movimentacaoAtualizada?.maquina;
      const nomeMaquina = obterNomeMaquinaExibicao(maquina);
      const tipoMaquina = obterTipoMaquinaExibicao(maquina);
      const produtoSelecionado = produtosAbastecimentoExtra.find(
        (item) => String(item?.id || "") === produtoId,
      );
      const nomeProduto =
        produtoSelecionado?.nome ||
        movimentacaoAtualizada?.detalhesProdutos?.find(
          (item) => String(item?.produtoId || "") === produtoId,
        )?.produto?.nome ||
        produtoId;

      setUltimasMovimentacoesPorMaquina((prev) => ({
        ...prev,
        [String(maquina?.id || "")]: movimentacaoAtualizada,
      }));

      setAbastecimentosExtrasNaRota((prev) => [
        ...prev,
        {
          maquinaNome: nomeMaquina,
          tipoMaquina,
          produtoNome: nomeProduto,
          quantidade: quantidadeNumero,
        },
      ]);

      const mensagemWhatsApp = [
        "STAR BOX",
        "*Abastecimento extra na rota*",
        `Data/Hora: ${new Date().toLocaleString("pt-BR")}`,
        `Roteiro: ${roteiro?.nome || "-"}`,
        `Funcionário: ${usuario?.nome || "-"}`,
        `Loja: ${lojaSelecionada?.nome || "-"}`,
        `Máquina: ${nomeMaquina} | Tipo: ${tipoMaquina}`,
        `Produto abastecido: ${nomeProduto}`,
        `Quantidade abastecida: ${quantidadeNumero}`,
      ].join("\n");

      salvarMovimentacaoWhatsAppPendenteLoja({
        roteiroId: id,
        usuarioId: usuario?.id,
        lojaId: lojaSelecionada?.id,
        maquinaId: maquina?.id,
        maquinaNome: nomeMaquina,
        mensagem: mensagemWhatsApp,
        resumo: {
          lojaNome: lojaSelecionada?.nome || "LOJA",
          dataMovimentacao: new Date().toISOString(),
          nomeUsuario: usuario?.nome || "-",
          codigoMaquina: nomeMaquina,
          tipoMaquina,
          inAnterior: Number(movimentacaoAtualizada?.contadorInAnterior || 0),
          inAtual: Number(movimentacaoAtualizada?.contadorInAtual || 0),
          outAnterior: Number(movimentacaoAtualizada?.contadorOutAnterior || 0),
          outAtual: Number(movimentacaoAtualizada?.contadorOutAtual || 0),
          diferencaIn: Number(movimentacaoAtualizada?.diferencaIn || 0),
          quantidadeSaiu: Number(movimentacaoAtualizada?.quantidadeSaiu || 0),
          jogado: Number(movimentacaoAtualizada?.jogado || 0),
          jogadasMediasPorPelucia: Number(
            movimentacaoAtualizada?.jogadasMediasPorPelucia || 0,
          ),
          diasDesdeUltimaMovimentacao:
            movimentacaoAtualizada?.diasDesdeUltimaMovimentacao,
          quantidadeAbastecimentoExtra: quantidadeNumero,
          nomeProdutoAbastecimentoExtra: nomeProduto,
        },
      });

      enviarWhatsAppLoja(lojaSelecionada);
      setSuccess("Abastecimento extra salvo com sucesso!");
      setModalAbastecimentoExtra({
        aberto: false,
        maquina: null,
        movimentacao: null,
        quantidade: "",
        produtoId: "",
        ultimoProdutoId: "",
        produtoPendenteId: "",
        confirmarTrocaProdutoAberto: false,
        erro: "",
        loading: false,
      });
      await carregarRoteiro();
    } catch (err) {
      const mensagemErro =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        (err?.response?.status === 409
          ? "Estoque insuficiente para realizar o abastecimento."
          : "Erro ao salvar abastecimento extra.");

      setModalAbastecimentoExtra((prev) => ({
        ...prev,
        erro: mensagemErro,
        loading: false,
      }));
    }
  };

  const buscarUltimaMovimentacaoDaMaquina = async (maquinaId) => {
    const resposta = await api.get("/movimentacoes", {
      params: {
        maquinaId,
        roteiroId: id,
        limite: 50,
      },
    });

    const lista = normalizarMovimentacoes(resposta?.data);
    const listaOrdenada = Array.isArray(lista)
      ? [...lista].sort((a, b) => {
          const dataA = new Date(
            a?.dataColeta || a?.createdAt || a?.updatedAt || 0,
          ).getTime();
          const dataB = new Date(
            b?.dataColeta || b?.createdAt || b?.updatedAt || 0,
          ).getTime();
          if (dataA !== dataB) return dataB - dataA;
          return String(b?.id || "").localeCompare(String(a?.id || ""));
        })
      : [];

    const usuarioAtualId = normalizarIdTexto(usuario?.id);
    if (!usuarioAtualId) return listaOrdenada[0] || null;

    const listaDoUsuarioAtual = listaOrdenada.filter(
      (item) => obterUsuarioMovimentacao(item) === usuarioAtualId,
    );

    return listaDoUsuarioAtual[0] || null;
  };

  const abrirFluxoJustificativaEdicao = async (maquina) => {
    let ultimaMov = obterUltimaMovimentacaoPorMaquina(maquina?.id);
    if (!ultimaMov?.id) {
      try {
        ultimaMov = await buscarUltimaMovimentacaoDaMaquina(maquina?.id);
        if (ultimaMov?.id) {
          setUltimasMovimentacoesPorMaquina((prev) => ({
            ...prev,
            [String(maquina?.id || "")]: ultimaMov,
          }));
        }
      } catch {
        // Mensagem abaixo cobre falha de busca.
      }
    }

    if (!ultimaMov?.id) {
      setError(
        "Não foi possível identificar a última movimentação desta máquina para edição.",
      );
      return;
    }

    setMovimentacaoParaEditar({
      ...ultimaMov,
      maquina: ultimaMov?.maquina || {
        id: maquina?.id,
        nome: obterNomeMaquinaExibicao(maquina),
        codigo: maquina?.codigo,
        tipo: obterTipoMaquinaExibicao(maquina),
        modelo: maquina?.modelo,
        valorFicha: maquina?.valorFicha,
        usaFichas: maquina?.usaFichas,
        usa_fichas: maquina?.usa_fichas,
        loja: { nome: lojaSelecionada?.nome || maquina?.loja?.nome || "-" },
      },
    });
    setModalEdicaoAberto(true);
  };

  const confirmarJustificativaEdicao = () => {
    const justificativa = String(
      modalJustificativaEdicao?.justificativa || "",
    ).trim();
    if (!justificativa) {
      setError("Informe a justificativa da edição realizada.");
      return;
    }

    const maquina = modalJustificativaEdicao?.maquina;
    const movimentacaoAnterior = modalJustificativaEdicao?.movimentacaoAnterior;
    const movimentacaoAtualizada =
      modalJustificativaEdicao?.movimentacaoAtualizada;
    const alteracoes = montarAlteracoesMovimentacao(
      movimentacaoAnterior,
      movimentacaoAtualizada,
    );

    const mensagemWhatsApp = [
      "STAR BOX",
      "*Edição de movimentação na rota*",
      `Data/Hora: ${new Date().toLocaleString("pt-BR")}`,
      `Roteiro: ${roteiro?.nome || "-"}`,
      `Funcionário: ${usuario?.nome || "-"}`,
      `Loja: ${lojaSelecionada?.nome || maquina?.loja?.nome || "-"}`,
      `Máquina: ${obterNomeMaquinaExibicao(maquina)} | Tipo: ${obterTipoMaquinaExibicao(maquina)}`,
      `Movimentação: ${movimentacaoAtualizada?.id || movimentacaoAnterior?.id || "-"}`,
      "___________________________________",
      `O que mudou: ${alteracoes.length > 0 ? "" : "Nenhuma alteração identificada automaticamente."}`,
      ...alteracoes.map((item) => `- ${item}`),
      `Justificativa: ${justificativa}`,
    ].join("\n");

    const lojaJustificativaId = String(
      lojaSelecionada?.id || maquina?.lojaId || maquina?.loja?.id || "",
    ).trim();
    const abriuWhatsApp = abrirWhatsAppComMensagem(mensagemWhatsApp);

    if (!abriuWhatsApp) {
      setSuccess(
        "Edição salva, mas o navegador bloqueou a abertura do WhatsApp. Libere pop-up para o StarBox.",
      );
    } else {
      setSuccess("Edição salva e justificativa enviada para o WhatsApp.");
    }

    if (lojaJustificativaId) {
      setJustificativasEdicaoPorLoja((prev) => {
        const proximo = {
          ...prev,
          [lojaJustificativaId]: {
            mensagem: mensagemWhatsApp,
            justificativa,
            maquinaNome: obterNomeMaquinaExibicao(maquina),
            atualizadoEm: new Date().toISOString(),
          },
        };
        salvarJustificativasEdicaoMovimentacaoRota(proximo);
        return proximo;
      });
    }

    setModalJustificativaEdicao({
      aberto: false,
      justificativa: "",
      maquina: null,
      movimentacaoAnterior: null,
      movimentacaoAtualizada: null,
    });
    setMovimentacaoParaEditar(null);
  };

  const reenviarJustificativaEdicao = (loja) => {
    const item =
      justificativasEdicaoPorLoja[String(loja?.id || "").trim()] || null;
    const mensagem = String(item?.mensagem || "").trim();

    if (!mensagem) {
      setError("Nao ha justificativa de edicao para reenviar neste ponto.");
      return;
    }

    const abriuWhatsApp = abrirWhatsAppComMensagem(mensagem);

    if (abriuWhatsApp) {
      setSuccess("Justificativa de edicao reenviada para o WhatsApp.");
    } else {
      setError(
        "Nao foi possivel abrir o WhatsApp para reenviar a justificativa.",
      );
    }
  };

  const fecharModalJustificativaEdicao = () => {
    setModalJustificativaEdicao({
      aberto: false,
      justificativa: "",
      maquina: null,
      movimentacaoAnterior: null,
      movimentacaoAtualizada: null,
    });
    setMovimentacaoParaEditar(null);
  };

  const concluirEdicaoMovimentacao = (movimentacaoAtualizada) => {
    const maquinaBase =
      movimentacaoAtualizada?.maquina ||
      movimentacaoParaEditar?.maquina ||
      null;

    atualizarMovimentacaoEditadaNaRota(movimentacaoAtualizada);
    atualizarLeituraPendenteAposEdicao({
      maquina: maquinaBase,
      movimentacaoAnterior: movimentacaoParaEditar,
      movimentacaoAtualizada,
    });

    setModalJustificativaEdicao({
      aberto: true,
      justificativa: "",
      maquina: maquinaBase,
      movimentacaoAnterior: movimentacaoParaEditar,
      movimentacaoAtualizada,
    });
  };

  const atualizarMovimentacaoEditadaNaRota = (movimentacaoAtualizada) => {
    const maquinaId = String(
      movimentacaoAtualizada?.maquinaId ||
        movimentacaoAtualizada?.maquina?.id ||
        "",
    ).trim();

    if (maquinaId) {
      setUltimasMovimentacoesPorMaquina((prev) => ({
        ...prev,
        [maquinaId]: {
          ...movimentacaoAtualizada,
          maquina:
            movimentacaoAtualizada?.maquina ||
            prev?.[maquinaId]?.maquina ||
            null,
        },
      }));
    }

    const maquinaFonte =
      (lojaSelecionada?.maquinas || []).find(
        (item) => String(item?.id || "").trim() === maquinaId,
      ) ||
      movimentacaoAtualizada?.maquina ||
      null;

    if (maquinaFonte) {
      registrarMaquinaEditadaNaRota(maquinaFonte);
    }
  };

  useEffect(() => {
    const carregarTiposFaltantes = async () => {
      const maquinasSelecionadas = Array.isArray(lojaSelecionada?.maquinas)
        ? lojaSelecionada.maquinas
        : [];

      const idsParaBuscar = maquinasSelecionadas
        .map((maquina) => String(maquina?.id || "").trim())
        .filter(Boolean)
        .filter((idMaquina) => {
          const maquina = maquinasSelecionadas.find(
            (item) => String(item?.id || "").trim() === idMaquina,
          );
          const tipoNoPayload = extrairTextoValido(
            maquina?.tipo,
            maquina?.tipoMaquina,
            maquina?.modelo,
            maquina?.modeloMaquina,
            maquina?.tipoNome,
            maquina?.tipo?.nome,
            maquina?.modelo?.nome,
          );

          return !tipoNoPayload && !tiposMaquinaPorId[idMaquina];
        });

      if (idsParaBuscar.length === 0) return;

      const resultados = await Promise.allSettled(
        idsParaBuscar.map((idMaquina) => api.get(`/maquinas/${idMaquina}`)),
      );

      const novosTipos = {};
      resultados.forEach((resultado, index) => {
        if (resultado.status !== "fulfilled") return;

        const idMaquina = idsParaBuscar[index];
        const dadosMaquina = resultado.value?.data || {};
        const tipoResolvido = extrairTextoValido(
          dadosMaquina?.tipo,
          dadosMaquina?.tipoMaquina,
          dadosMaquina?.modelo,
          dadosMaquina?.modeloMaquina,
          dadosMaquina?.tipoNome,
          dadosMaquina?.tipo?.nome,
          dadosMaquina?.modelo?.nome,
        );

        if (tipoResolvido) {
          novosTipos[idMaquina] = tipoResolvido;
        }
      });

      if (Object.keys(novosTipos).length > 0) {
        setTiposMaquinaPorId((prev) => ({ ...prev, ...novosTipos }));
      }
    };

    carregarTiposFaltantes();
  }, [lojaSelecionada, tiposMaquinaPorId]);

  useEffect(() => {
    const carregarUltimasMovimentacoesDaLoja = async () => {
      const maquinasSelecionadas = Array.isArray(lojaSelecionada?.maquinas)
        ? lojaSelecionada.maquinas
        : [];

      if (maquinasSelecionadas.length === 0) {
        setUltimasMovimentacoesPorMaquina({});
        return;
      }

      const respostas = await Promise.allSettled(
        maquinasSelecionadas.map((maquina) =>
          api.get("/movimentacoes", {
            params: {
              maquinaId: maquina.id,
              roteiroId: id,
              limite: 50,
            },
          }),
        ),
      );

      const usuarioAtualId = normalizarIdTexto(usuario?.id);

      const ultimasPorMaquina = {};
      respostas.forEach((resultado, index) => {
        if (resultado.status !== "fulfilled") return;

        const maquina = maquinasSelecionadas[index];
        const lista = normalizarMovimentacoes(resultado.value?.data);
        const listaOrdenada = Array.isArray(lista)
          ? [...lista].sort((a, b) => {
              const dataA = new Date(
                a?.dataColeta || a?.createdAt || a?.updatedAt || 0,
              ).getTime();
              const dataB = new Date(
                b?.dataColeta || b?.createdAt || b?.updatedAt || 0,
              ).getTime();
              if (dataA !== dataB) return dataB - dataA;
              return String(b?.id || "").localeCompare(String(a?.id || ""));
            })
          : [];
        const listaDoUsuarioAtual = usuarioAtualId
          ? listaOrdenada.filter(
              (item) => obterUsuarioMovimentacao(item) === usuarioAtualId,
            )
          : [];
        const ultimaMovimentacao =
          listaDoUsuarioAtual[0] || listaOrdenada[0] || null;

        if (ultimaMovimentacao?.id) {
          ultimasPorMaquina[String(maquina.id)] = {
            ...ultimaMovimentacao,
            maquina: ultimaMovimentacao?.maquina || {
              id: maquina?.id,
              nome: obterNomeMaquinaExibicao(maquina),
              codigo: maquina?.codigo,
              tipo: obterTipoMaquinaExibicao(maquina),
              modelo: maquina?.modelo,
              valorFicha: maquina?.valorFicha,
              usaFichas: maquina?.usaFichas,
              usa_fichas: maquina?.usa_fichas,
            },
          };
        }
      });

      setUltimasMovimentacoesPorMaquina(ultimasPorMaquina);
    };

    carregarUltimasMovimentacoesDaLoja();
  }, [lojaSelecionada]);

  const carregarDadosRoteiroExecucao = async (roteiroId) => {
    const endpoints = [
      `/roteiros/${roteiroId}/executar`,
      `/roteiros/${roteiroId}`,
    ];
    let ultimoErro404 = null;

    for (const endpoint of endpoints) {
      try {
        return await api.get(endpoint);
      } catch (err) {
        const status = err?.response?.status;
        if (status === 404) {
          ultimoErro404 = err;
          continue;
        }
        throw err;
      }
    }

    throw ultimoErro404 || new Error("Roteiro não encontrado.");
  };

  const carregarResumoExecucaoPersistido = async (
    roteiroId,
    roteiroAtual = null,
  ) => {
    if (!roteiroId) return null;

    try {
      const resResumo = await api.get(
        `/roteiros/${roteiroId}/resumo-execucao`,
        {
          params: { data: obterDataHojeIso() },
        },
      );

      const normalizado = normalizarResumoExecucaoBackend(
        resResumo?.data,
        roteiroAtual,
      );

      setResumoExecucaoBackend(normalizado);

      if (normalizado) {
        setResumoManutencaoRota({
          totalRealizadas: Number(normalizado.totalManutencoesRealizadas || 0),
          lojasComManutencao: Array.isArray(
            normalizado.lojasComManutencaoRealizada,
          )
            ? normalizado.lojasComManutencaoRealizada
            : [],
          lojasSemManutencao: Array.isArray(
            normalizado.lojasSemManutencaoRealizada,
          )
            ? normalizado.lojasSemManutencaoRealizada
            : [],
        });
      }

      return normalizado;
    } catch {
      setResumoExecucaoBackend(null);
      return null;
    }
  };

  const getLabelCategoriaGasto = (categoria) =>
    CATEGORIAS_GASTO.find((item) => item.value === categoria)?.label ||
    categoria ||
    "-";

  useEffect(() => {
    carregarRoteiro();
  }, [id]);

  useEffect(() => {
    setMaquinasEditadasNaRota(carregarEdicoesMovimentacaoRota());
    setJustificativasEdicaoPorLoja(
      carregarJustificativasEdicaoMovimentacaoRota(),
    );
  }, [id, roteiro?.funcionarioId, usuario?.id]);

  useEffect(() => {
    if (!roteiro?.id) return;
    carregarResumoExecucaoPersistido(roteiro.id, roteiro);
  }, [roteiro?.id]);

  useEffect(() => {
    if (!id) return;

    const interval = window.setInterval(() => {
      carregarResumoExecucaoPersistido(id, roteiro);
    }, 30000);

    return () => window.clearInterval(interval);
  }, [id, roteiro]);

  // Efeito para selecionar automaticamente a loja quando volta da movimentação
  useEffect(() => {
    if (roteiro && location.state?.lojaId) {
      const loja = roteiro.lojas?.find((l) => l.id === location.state.lojaId);
      if (loja) {
        setLojaSelecionada(loja);
        // Limpar apenas o lojaId para preservar outros sinais de fluxo.
        const proximoState = { ...(location.state || {}) };
        delete proximoState.lojaId;
        navigate(location.pathname, {
          replace: true,
          state: Object.keys(proximoState).length > 0 ? proximoState : {},
        });
        // Quando voltar de uma movimentação, verificar se todas as máquinas da
        // loja estão finalizadas. Se sim, enviar WhatsApp combinado da loja —
        // mas só automaticamente na primeira vez que o ponto fica completo.
        // Se o ponto já estava 100% concluído antes (ex: usuário voltou numa
        // máquina só para lançar um abastecimento extra), não reabre o
        // WhatsApp sozinho de novo — só sinaliza a leitura atualizada, e o
        // reenvio fica a cargo do botão manual "Enviar leitura atualizada".
        if (location.state?.origemMovimentacao) {
          const todasFinalizadas =
            loja.maquinas?.length > 0 &&
            loja.maquinas.every((m) => maquinaEstaConcluidaNoBackend(m));
          if (todasFinalizadas) {
            const jaHaviaMensagemEnviadaAntes = Boolean(
              obterUltimaMensagemMovimentacoesWhatsAppLoja({
                roteiroId: id,
                usuarioId: usuario?.id,
                lojaId: loja.id,
              }),
            );

            if (jaHaviaMensagemEnviadaAntes) {
              setLeiturasAtualizadasPorLoja((prev) => ({
                ...prev,
                [String(loja.id)]: true,
              }));
            } else {
              enviarWhatsAppLoja(loja);
            }
          }
        }
      }
    }
  }, [roteiro, location.state]);

  useEffect(() => {
    if (!location.state?.origemMovimentacao) return;
    carregarRoteiro();
  }, [location.state?.origemMovimentacao]);

  useEffect(() => {
    const roteiroIdState = String(location.state?.roteiroIdParaFinalizar || "");
    if (!location.state?.pilotagemFinalizada || roteiroIdState !== String(id)) {
      return;
    }

    setSuccess(
      "Veículo finalizado com sucesso. Confirme a finalização da rota para enviar o resumo no WhatsApp.",
    );
    setModalFinalizar({ aberto: true, etapa: 1, loading: false });
    setKmFinalVeiculoInput("");

    const proximoState = { ...(location.state || {}) };
    delete proximoState.pilotagemFinalizada;
    delete proximoState.roteiroIdParaFinalizar;
    delete proximoState.fluxoFinalizacaoAutomatica;

    navigate(location.pathname, {
      replace: true,
      state: Object.keys(proximoState).length > 0 ? proximoState : {},
    });
  }, [id, location.pathname, location.state, navigate]);

  const carregarRoteiro = async () => {
    try {
      setLoading(true);
      setErroCarregamentoInicial("");
      const res = await carregarDadosRoteiroExecucao(id);
      const roteiroNormalizado = normalizarRoteiroComStatusSemanalPersistido(
        res.data,
      );
      setRoteiro(roteiroNormalizado);
      setPontosPuladosPorLoja(
        normalizarPontosPuladosBackend(roteiroNormalizado),
      );

      console.log("Roteiro carregado:", roteiroNormalizado);
    } catch (err) {
      if (err?.response?.status === 404) {
        setErroCarregamentoInicial(
          "Roteiro não encontrado para execução. Verifique se o roteiro existe ou se o endpoint /executar está disponível no backend.",
        );
      } else {
        setErroCarregamentoInicial("Erro ao buscar roteiro.");
      }
    } finally {
      setLoading(false);
    }
  };

  const verificarManutencoesPendentes = async (lojaId) => {
    try {
      const res = await api.get(`/manutencoes`, {
        params: {
          lojaId,
          status: "pendente",
        },
      });
      const manutencoesPendentes = res.data || [];

      if (manutencoesPendentes.length > 0) {
        // Pega a primeira manutenção pendente
        setManutencaoPendente(manutencoesPendentes[0]);
        setModalManutencao(true);
        return true;
      }
      return false;
    } catch (err) {
      console.error("Erro ao verificar manutenções:", err);
      return false;
    }
  };

  const handleSelecionarLoja = async (loja) => {
    // Verificar ordem das lojas
    if (roteiro?.lojas) {
      const lojasOrdenadas = [...roteiro.lojas].sort(
        (a, b) => (a.ordem || 0) - (b.ordem || 0),
      );
      const proximaLoja = lojasOrdenadas.find(
        (l) => !pontoEstaConcluido(l),
      );

      const ordemLojaSelecionada = Number(loja?.ordem || 0);
      const ordemProximaLoja = Number(proximaLoja?.ordem || 0);
      const indiceLojaSelecionada = lojasOrdenadas.findIndex(
        (item) => item.id === loja?.id,
      );
      const indiceProximaLoja = lojasOrdenadas.findIndex(
        (item) => item.id === proximaLoja?.id,
      );
      const pulouParaFrente =
        proximaLoja &&
        ((Number.isFinite(ordemLojaSelecionada) &&
          Number.isFinite(ordemProximaLoja) &&
          ordemLojaSelecionada > ordemProximaLoja) ||
          (ordemLojaSelecionada === ordemProximaLoja &&
            indiceLojaSelecionada > indiceProximaLoja));

      // Solicita justificativa apenas quando a seleção quebrar a ordem para frente.
      if (
        pulouParaFrente &&
        proximaLoja.id !== loja.id &&
        !pontoEstaConcluido(loja)
      ) {
        try {
          // A validação deve considerar o próximo ponto pendente real do roteiro,
          // e não apenas a loja selecionada na UI.
          const lojaAtualId = String(proximaLoja?.id || "").trim();
          const statusRes = await api.get(
            `/roteiros/${id}/quebra-ordem/status`,
            {
              params: {
                lojaAtualId,
                lojaId: loja.id,
              },
            },
          );
          const statusQuebra = statusRes?.data || {};
          atualizarPontosPuladosComStatus(statusQuebra, loja.id);
          const precisaJustificativa = Boolean(
            statusQuebra?.precisaJustificativa,
          );
          const motivoQuebra = String(statusQuebra?.motivo || "")
            .trim()
            .toLowerCase();

          if (precisaJustificativa) {
            setModalJustificativa({
              aberto: true,
              lojaId: loja.id,
              lojaNome: loja.nome,
              lojaPuladaId: statusQuebra?.lojaEsperadaId || proximaLoja.id,
              lojaPuladaNome:
                statusQuebra?.lojaEsperadaNome || proximaLoja.nome || "",
              justificativa: "",
            });
            return;
          }

          if (motivoQuebra === "ponto_selecionado_ja_justificado") {
            setSuccess(
              "Esse ponto já foi pulado hoje e a justificativa já foi enviada. Não é necessário enviar novamente.",
            );
          }
        } catch {
          // Fallback seguro: se status não puder ser consultado, exige justificativa.
          setModalJustificativa({
            aberto: true,
            lojaId: loja.id,
            lojaNome: loja.nome,
            lojaPuladaId: proximaLoja.id,
            lojaPuladaNome: proximaLoja.nome,
            justificativa: "",
          });
          return;
        }
      }
    }

    setLojaSelecionada(loja);
    setNovaManutencaoRoteiro({ maquinaId: "", descricao: "" });
    setManutencaoRecemCriada(null);

    // Verificar se há manutenções pendentes nesta loja
    if (loja && loja.id) {
      await verificarManutencoesPendentes(loja.id);
    }
  };

  const confirmarSelecaoComJustificativa = async () => {
    if (!modalJustificativa.justificativa.trim()) {
      setError("Por favor, informe o motivo de pular o ponto anterior.");
      return;
    }

    // Reserva popup no clique para evitar bloqueio ao abrir WhatsApp apos chamada async.
    const popupReservado = window.open("about:blank", "_blank");

    try {
      // Salvar justificativa via API
      await api.post(`/roteiros/${id}/justificar-ordem`, {
        lojaId: modalJustificativa.lojaId,
        lojaPuladaId: modalJustificativa.lojaPuladaId,
        justificativa: modalJustificativa.justificativa,
      });

      // Marcar imediatamente a loja pulada como justificada no estado local,
      // para que verificações futuras de quebra de ordem reconheçam que ela
      // já foi justificada e não peçam justificativa novamente desnecessariamente.
      if (modalJustificativa.lojaPuladaId) {
        setPontosPuladosPorLoja((prev) => ({
          ...prev,
          [String(modalJustificativa.lojaPuladaId)]: {
            justificativaEnviada: true,
            justificativa: modalJustificativa.justificativa.trim(),
          },
        }));
      }

      try {
        const statusAtualizadoRes = await api.get(
          `/roteiros/${id}/quebra-ordem/status`,
          {
            params: {
              lojaAtualId: modalJustificativa.lojaPuladaId,
              lojaId: modalJustificativa.lojaId,
            },
          },
        );
        atualizarPontosPuladosComStatus(
          statusAtualizadoRes?.data,
          modalJustificativa.lojaPuladaId,
        );
      } catch {
        // Fluxo segue com recarregamento completo do roteiro.
      }

      const mensagemWhatsAppQuebraOrdem = [
        "STAR BOX",
        "*Quebra de ordem do roteiro*",
        `Data/Hora: ${new Date().toLocaleString("pt-BR")}`,
        `Roteiro: ${roteiro?.nome || "-"}`,
        `Funcionario: ${usuario?.nome || "-"}`,
        "___________________________________",
        `Ponto pulado: ${modalJustificativa.lojaPuladaNome || "-"}`,
        `Ponto selecionado: ${modalJustificativa.lojaNome || "-"}`,
        `Justificativa: ${modalJustificativa.justificativa.trim()}`,
      ].join("\n");

      const abriuWhatsApp = abrirWhatsAppComMensagem(
        mensagemWhatsAppQuebraOrdem,
        popupReservado,
      );

      if (!abriuWhatsApp) {
        setSuccess(
          "Justificativa salva, mas o navegador bloqueou a abertura do WhatsApp. Libere pop-up para o StarBox.",
        );
      }

      const resRoteiroAtualizado = await carregarDadosRoteiroExecucao(id);
      const roteiroAtualizado = resRoteiroAtualizado?.data || null;

      if (roteiroAtualizado) {
        const roteiroNormalizado =
          normalizarRoteiroComStatusSemanalPersistido(roteiroAtualizado);
        setRoteiro(roteiroNormalizado);
        const pontosPuladosBackend =
          normalizarPontosPuladosBackend(roteiroNormalizado);
        setPontosPuladosPorLoja((prev) => {
          if (Object.keys(pontosPuladosBackend).length === 0) {
            return prev;
          }

          const merged = { ...prev };
          Object.entries(pontosPuladosBackend).forEach(([lojaId, info]) => {
            merged[lojaId] = {
              justificativaEnviada:
                info?.justificativaEnviada === true ||
                prev?.[lojaId]?.justificativaEnviada === true,
              justificativa: String(
                info?.justificativa || prev?.[lojaId]?.justificativa || "",
              ).trim(),
            };
          });

          return merged;
        });
        await carregarResumoExecucaoPersistido(id, roteiroNormalizado);
      }

      const lojasAtualizadas = Array.isArray(roteiroAtualizado?.lojas)
        ? roteiroAtualizado.lojas
        : Array.isArray(roteiro?.lojas)
          ? roteiro.lojas
          : [];
      const loja = lojasAtualizadas.find(
        (l) => String(l?.id || "") === String(modalJustificativa.lojaId || ""),
      );

      setLojaSelecionada(loja);

      // Verificar manutenções
      if (loja && loja.id) {
        await verificarManutencoesPendentes(loja.id);
      }

      setModalJustificativa({
        aberto: false,
        lojaId: null,
        lojaNome: "",
        lojaPuladaId: null,
        lojaPuladaNome: "",
        justificativa: "",
      });
    } catch (err) {
      if (popupReservado && !popupReservado.closed) {
        popupReservado.close();
      }
      setError("Erro ao salvar justificativa.");
    }
  };

  const handleManutencaoConcluida = async (evento = {}) => {
    if (evento?.whatsappAberto === false) {
      setSuccess(
        "Manutenção processada, mas o navegador bloqueou a abertura do WhatsApp. Libere pop-up para o StarBox.",
      );
    } else {
      setSuccess("Manutenção processada com sucesso!");
    }
    setModalManutencao(false);

    if (
      manutencaoRecemCriada?.id &&
      manutencaoPendente?.id === manutencaoRecemCriada.id
    ) {
      setManutencaoRecemCriada(null);
    }

    setManutencaoPendente(null);
    // Recarregar roteiro para atualizar status
    await carregarRoteiro();

    await carregarResumoExecucaoPersistido(id, roteiro);
  };

  const abrirModalNovaManutencao = () => {
    setError("");
    setSuccess("");
    setManutencaoRecemCriada(null);
    setNovaManutencaoRoteiro({ maquinaId: "", descricao: "" });
    setModalNovaManutencao({ aberto: true, loading: false });
  };

  const abrirManutencaoRecemCriada = async () => {
    if (!manutencaoRecemCriada?.id) return;

    setError("");
    const lojaIdConsulta =
      manutencaoRecemCriada?.loja?.id || lojaSelecionada?.id || null;

    try {
      let manutencaoAtualizada = null;

      if (lojaIdConsulta) {
        const resPendentes = await api.get("/manutencoes", {
          params: {
            lojaId: lojaIdConsulta,
            status: "pendente",
          },
        });

        const pendentes = Array.isArray(resPendentes?.data)
          ? resPendentes.data
          : Array.isArray(resPendentes?.data?.rows)
            ? resPendentes.data.rows
            : [];

        manutencaoAtualizada =
          pendentes.find(
            (item) =>
              String(item?.id || "") === String(manutencaoRecemCriada.id),
          ) || null;
      }

      setManutencaoPendente(manutencaoAtualizada || manutencaoRecemCriada);
      setModalManutencao(true);
    } catch {
      // Mantem o fluxo mesmo se a consulta falhar.
      setManutencaoPendente(manutencaoRecemCriada);
      setModalManutencao(true);
    }
  };

  const fecharModalNovaManutencao = () => {
    if (modalNovaManutencao.loading) return;
    setModalNovaManutencao({ aberto: false, loading: false });
  };

  const handleCriarManutencaoRoteiro = async () => {
    if (!lojaSelecionada?.id) {
      setError("Selecione uma loja para adicionar manutenção.");
      return;
    }

    const descricaoLimpa = String(novaManutencaoRoteiro.descricao || "").trim();
    if (!novaManutencaoRoteiro.maquinaId) {
      setError("Selecione a máquina da manutenção.");
      return;
    }
    if (!descricaoLimpa) {
      setError("Descreva o que precisa ser feito na manutenção.");
      return;
    }

    try {
      setModalNovaManutencao((prev) => ({ ...prev, loading: true }));
      setError("");
      setSuccess("");

      const maquinaIdSelecionada = novaManutencaoRoteiro.maquinaId;
      const resCriacao = await api.post("/manutencoes", {
        descricao: descricaoLimpa,
        lojaId: lojaSelecionada.id,
        maquinaId: maquinaIdSelecionada,
        funcionarioId: usuario?.id || null,
        roteiroId: id,
      });

      const payload = resCriacao?.data;
      const manutencaoCriadaResponse =
        payload?.manutencao && typeof payload.manutencao === "object"
          ? payload.manutencao
          : payload && typeof payload === "object" && payload.id
            ? payload
            : null;

      let manutencaoCriada = manutencaoCriadaResponse;

      if (!manutencaoCriada?.id) {
        const resPendentes = await api.get("/manutencoes", {
          params: {
            lojaId: lojaSelecionada.id,
            status: "pendente",
          },
        });

        const pendentes = Array.isArray(resPendentes?.data)
          ? resPendentes.data
          : [];
        manutencaoCriada =
          pendentes.find(
            (item) =>
              String(item?.maquinaId || item?.maquina_id || "") ===
                String(maquinaIdSelecionada || "") &&
              String(item?.descricao || "").trim() === descricaoLimpa,
          ) ||
          pendentes[0] ||
          null;
      }

      if (manutencaoCriada?.id) {
        const maquinaSelecionada = (lojaSelecionada?.maquinas || []).find(
          (item) =>
            String(item?.id || "") === String(maquinaIdSelecionada || ""),
        );

        setManutencaoRecemCriada({
          ...manutencaoCriada,
          descricao: manutencaoCriada.descricao || descricaoLimpa,
          loja: manutencaoCriada.loja || {
            id: lojaSelecionada.id,
            nome: lojaSelecionada?.nome || "-",
          },
          maquina:
            manutencaoCriada.maquina ||
            (maquinaSelecionada
              ? {
                  id: maquinaSelecionada.id,
                  codigo: maquinaSelecionada.codigo,
                  nome: maquinaSelecionada.nome,
                }
              : null),
        });
      } else {
        setManutencaoRecemCriada(null);
      }

      setSuccess(
        "Manutenção criada com sucesso! Clique em 'Fazer manutenção criada agora' para concluir agora.",
      );
      setModalNovaManutencao({ aberto: false, loading: false });
      setNovaManutencaoRoteiro({ maquinaId: "", descricao: "" });
      await carregarRoteiro();
    } catch (err) {
      setError(err?.response?.data?.error || "Erro ao criar manutenção.");
      setModalNovaManutencao((prev) => ({ ...prev, loading: false }));
    }
  };

  const handleLancarGasto = async () => {
    const categoriasPermitidas = CATEGORIAS_GASTO.map((item) => item.value);
    if (!categoriasPermitidas.includes(gastoForm.categoria)) {
      setError("Categoria de gasto inválida.");
      return;
    }

    const valorNumerico = parseValorMonetario(gastoForm.valor);
    if (!Number.isFinite(valorNumerico) || valorNumerico <= 0) {
      setError("Informe um valor válido para o gasto.");
      return;
    }

    const observacaoNormalizada = String(gastoForm.observacao || "").trim();
    if (gastoForm.categoria === "outros" && !observacaoNormalizada) {
      setError("Observação é obrigatória quando a categoria for Outros.");
      return;
    }

    let quilometragemNumerica = null;
    let litrosNumericos = null;
    if (gastoForm.categoria === "abastecimento") {
      if (!roteiro?.veiculo?.id) {
        setError(
          "Este roteiro não possui veículo associado. Vincule um veículo antes de lançar abastecimento.",
        );
        return;
      }

      const kmDigitado = Number.parseInt(gastoForm.quilometragem, 10);
      if (!Number.isInteger(kmDigitado) || kmDigitado < 0) {
        setError(
          "Informe o KM do abastecimento (número inteiro maior ou igual a zero).",
        );
        return;
      }
      quilometragemNumerica = kmDigitado;

      const litrosDigitados = parseFloat(
        String(gastoForm.litros || "").replace(",", "."),
      );
      if (!Number.isFinite(litrosDigitados) || litrosDigitados <= 0) {
        setError(
          "Informe a quantidade de litros abastecidos (maior que zero).",
        );
        return;
      }
      litrosNumericos = litrosDigitados;
    }

    const saldoAtual = Number(
      roteiro?.saldoGastoSemana ?? roteiro?.saldoGastoHoje ?? 0,
    );
    if (Number.isFinite(saldoAtual) && valorNumerico > saldoAtual) {
      setError(
        `Saldo semanal insuficiente para este lançamento. Saldo disponível: ${formatarMoedaBRL(saldoAtual)}.`,
      );
      return;
    }

    try {
      setLancandoGasto(true);
      setError("");
      setSuccess("");

      const payload = {
        categoria: gastoForm.categoria,
        valor: valorNumerico,
        quilometragem: quilometragemNumerica,
        litros: litrosNumericos,
        nivelCombustivel:
          gastoForm.categoria === "abastecimento"
            ? gastoForm.nivelCombustivel
            : null,
        observacao: observacaoNormalizada || null,
      };

      const res = await api.post(`/roteiros/${id}/gastos`, payload);

      setSuccess(res?.data?.message || "Gasto semanal registrado com sucesso.");
      setGastoForm((prev) => ({
        ...prev,
        valor: "",
        quilometragem: "",
        litros: "",
        observacao: "",
      }));
      await carregarRoteiro();
    } catch (err) {
      const mensagemErro =
        err?.response?.data?.error || "Erro ao registrar gasto semanal.";
      const saldoDisponivelErro = err?.response?.data?.saldoDisponivel;
      if (typeof saldoDisponivelErro === "number") {
        setError(
          `${mensagemErro}. Saldo disponível: ${formatarMoedaBRL(saldoDisponivelErro)}.`,
        );
      } else {
        setError(mensagemErro);
      }
    } finally {
      setLancandoGasto(false);
    }
  };

  const executarFinalizacaoRoteiro = async () => {
    if (!roteiro || modalFinalizar.loading) return;

    const validarPilotagemAtivaUsuario = async () => {
      try {
        const veiculoRoteiroId = String(
          roteiro?.veiculoId || roteiro?.veiculo?.id || "",
        ).trim();
        if (!veiculoRoteiroId) return false;

        const [ultimasMovRes, veiculosRes] = await Promise.all([
          api.get("/movimentacao-veiculos/ultimas"),
          api.get("/veiculos"),
        ]);

        const usuarioId = String(usuario?.id || "");
        const veiculosLista = Array.isArray(veiculosRes.data)
          ? veiculosRes.data
          : [];
        const veiculoDoRoteiro = veiculosLista.find(
          (veiculo) => String(veiculo?.id || "") === veiculoRoteiroId,
        );

        if (!veiculoDoRoteiro?.emUso) {
          return false;
        }

        const ultimasMovObj = ultimasMovRes.data || {};
        const ultimasMovimentacoes = Array.isArray(ultimasMovObj)
          ? ultimasMovObj
          : Object.values(ultimasMovObj);

        const ultimaMovimentacaoVeiculoRoteiro = ultimasMovimentacoes.find(
          (mov) =>
            String(mov?.veiculoId || mov?.veiculo?.id || "") ===
            veiculoRoteiroId,
        );

        const usuarioUltimaMovimentacao = String(
          ultimaMovimentacaoVeiculoRoteiro?.usuario?.id ||
            ultimaMovimentacaoVeiculoRoteiro?.usuarioId ||
            ultimaMovimentacaoVeiculoRoteiro?.funcionarioId ||
            "",
        );
        const tipoUltimaMovimentacao = String(
          ultimaMovimentacaoVeiculoRoteiro?.tipo || "",
        ).toLowerCase();

        const temRetiradaAtivaDoUsuarioNoVeiculoDoRoteiro =
          tipoUltimaMovimentacao === "retirada" &&
          usuarioUltimaMovimentacao === usuarioId;

        if (temRetiradaAtivaDoUsuarioNoVeiculoDoRoteiro) {
          return true;
        }

        const usuarioVinculadoAoVeiculo = String(
          veiculoDoRoteiro?.usuario?.id ||
            veiculoDoRoteiro?.usuarioId ||
            veiculoDoRoteiro?.funcionarioId ||
            veiculoDoRoteiro?.condutorId ||
            "",
        );

        if (usuarioVinculadoAoVeiculo === usuarioId) {
          return true;
        }

        const kmInicialPilotagemAtiva = obterKmInicialPilotagemAtiva({
          usuarioId,
          veiculoId: veiculoRoteiroId,
        });

        return Number.isFinite(Number(kmInicialPilotagemAtiva));
      } catch {
        setError(
          "Não foi possível validar a pilotagem do veículo. Tente novamente em instantes.",
        );
        return false;
      }
    };

    if (roteiroTemVeiculoAssociado(roteiro)) {
      const temPilotagemAtiva = await validarPilotagemAtivaUsuario();
      if (temPilotagemAtiva) {
        const mensagemBloqueio =
          "Para finalizar a rota, finalize primeiro a pilotagem do veículo. Você será redirecionado para Veículos.";

        setError(mensagemBloqueio);
        setModalFinalizar({ aberto: false, etapa: 1, loading: false });
        navigate("/veiculos", {
          state: {
            origem: "roteiros-finalizacao",
            retornarPara: `/roteiros/${id}/executar`,
            roteiroIdParaFinalizar: id,
            alertaFinalizarVeiculo: mensagemBloqueio,
            alertaFinalizarVeiculoToken: `${Date.now()}-${id}`,
          },
        });
        return;
      }
    }

    const payload = {};

    if (roteiroTemVeiculoAssociado(roteiro)) {
      const kmFinalValidado = parseKmInteiroNaoNegativo(kmFinalVeiculoInput);
      if (!kmFinalValidado.ok) {
        setError(
          "Informe um KM final de devolução válido (inteiro maior ou igual a zero).",
        );
        return;
      }
      payload.kmFinalVeiculo = kmFinalValidado.numero;
    }

    const popupReservado = window.open("about:blank", "_blank");

    try {
      setError("");
      setSuccess("");
      setModalFinalizar((prev) => ({ ...prev, loading: true }));

      const res = await api.post(`/roteiros/${id}/finalizar`, payload);
      const pendencias = res?.data?.pendencias || [];

      if (pendencias.length > 0) {
        const nomes = pendencias.map((p) => p.maquinaNome).join(", ");
        const envioWhatsApp = res?.data?.alertaWhatsApp?.status;
        setSuccess(
          `Roteiro finalizado com pendências: ${nomes}. Alerta WhatsApp: ${envioWhatsApp || "não enviado"}.`,
        );
      } else {
        setSuccess("Roteiro finalizado com sucesso!");
      }

      const resumoNormalizado = normalizarResumoExecucaoBackend(
        res?.data,
        roteiro,
      );
      setResumoExecucaoBackend(resumoNormalizado);
      const mensagemWhatsAppOriginal =
        resumoNormalizado?.mensagemResumoWhatsapp ||
        String(res?.data?.mensagemResumoWhatsapp || "").trim();

      if (!mensagemWhatsAppOriginal) {
        setError(
          "Rota finalizada, mas o backend nao retornou mensagemResumoWhatsapp.",
        );
        setModalFinalizar((prev) => ({ ...prev, loading: false }));
        return;
      }

      const mensagemWhatsApp =
        filtrarMensagemFinalizacaoRoteiroManutencoesPorPeriodo({
          mensagem: mensagemWhatsAppOriginal,
          finalizacaoData: res?.data,
          roteiro,
        });

      const abriuWhatsApp = abrirWhatsAppComMensagem(
        mensagemWhatsApp,
        popupReservado,
      );
      if (!abriuWhatsApp) {
        setSuccess(
          "Roteiro finalizado, mas o navegador bloqueou a abertura do WhatsApp. Libere pop-up para o StarBox.",
        );
      }

      limparEdicoesMovimentacaoRota();
      limparJustificativasEdicaoMovimentacaoRota();
      limparStatusExecucoesAnteriores(roteiro);
      setMaquinasEditadasNaRota([]);
      setJustificativasEdicaoPorLoja({});
      setKmFinalVeiculoInput("");

      setModalFinalizar({ aberto: false, etapa: 1, loading: false });
      await carregarRoteiro();
    } catch (err) {
      if (popupReservado && !popupReservado.closed) {
        popupReservado.close();
      }
      const status = err?.response?.status;
      const mensagemApi = err?.response?.data?.error;

      if (status === 400) {
        setError(mensagemApi || "KM final inválido para finalizar a rota.");
      } else if (status === 403) {
        setError("Você não tem permissão para esta ação.");
      } else if (status === 404) {
        setError("Roteiro ou veículo não encontrado.");
      } else if (status === 500) {
        setError("Erro interno. Tente novamente.");
      } else {
        setError(mensagemApi || "Erro ao finalizar roteiro.");
      }
      setModalFinalizar((prev) => ({ ...prev, loading: false }));
    }
  };

  const abrirModalFinalizacao = async () => {
    if (roteiroTemVeiculoAssociado(roteiro)) {
      try {
        const veiculoRoteiroId = String(
          roteiro?.veiculoId || roteiro?.veiculo?.id || "",
        ).trim();
        if (!veiculoRoteiroId) {
          setModalFinalizar({ aberto: true, etapa: 1, loading: false });
          setKmFinalVeiculoInput("");
          return;
        }

        const [ultimasMovRes, veiculosRes] = await Promise.all([
          api.get("/movimentacao-veiculos/ultimas"),
          api.get("/veiculos"),
        ]);

        const usuarioId = String(usuario?.id || "");
        const veiculosLista = Array.isArray(veiculosRes.data)
          ? veiculosRes.data
          : [];
        const veiculoDoRoteiro = veiculosLista.find(
          (veiculo) => String(veiculo?.id || "") === veiculoRoteiroId,
        );

        if (!veiculoDoRoteiro?.emUso) {
          setModalFinalizar({ aberto: true, etapa: 1, loading: false });
          setKmFinalVeiculoInput("");
          return;
        }

        const ultimasMovObj = ultimasMovRes.data || {};
        const ultimasMovimentacoes = Array.isArray(ultimasMovObj)
          ? ultimasMovObj
          : Object.values(ultimasMovObj);

        const ultimaMovimentacaoVeiculoRoteiro = ultimasMovimentacoes.find(
          (mov) =>
            String(mov?.veiculoId || mov?.veiculo?.id || "") ===
            veiculoRoteiroId,
        );

        const usuarioUltimaMovimentacao = String(
          ultimaMovimentacaoVeiculoRoteiro?.usuario?.id ||
            ultimaMovimentacaoVeiculoRoteiro?.usuarioId ||
            ultimaMovimentacaoVeiculoRoteiro?.funcionarioId ||
            "",
        );
        const tipoUltimaMovimentacao = String(
          ultimaMovimentacaoVeiculoRoteiro?.tipo || "",
        ).toLowerCase();

        const temRetiradaAtivaDoUsuarioNoVeiculoDoRoteiro =
          tipoUltimaMovimentacao === "retirada" &&
          usuarioUltimaMovimentacao === usuarioId;

        const usuarioVinculadoAoVeiculo = String(
          veiculoDoRoteiro?.usuario?.id ||
            veiculoDoRoteiro?.usuarioId ||
            veiculoDoRoteiro?.funcionarioId ||
            veiculoDoRoteiro?.condutorId ||
            "",
        );

        const kmInicialPilotagemAtiva = obterKmInicialPilotagemAtiva({
          usuarioId,
          veiculoId: veiculoRoteiroId,
        });

        const usuarioTemPilotagemNoVeiculoDoRoteiro =
          temRetiradaAtivaDoUsuarioNoVeiculoDoRoteiro ||
          usuarioVinculadoAoVeiculo === usuarioId ||
          Number.isFinite(Number(kmInicialPilotagemAtiva));

        if (usuarioTemPilotagemNoVeiculoDoRoteiro) {
          const mensagemBloqueio =
            "Para finalizar a rota, finalize primeiro a pilotagem do veículo. Você será redirecionado para Veículos.";

          setError(mensagemBloqueio);
          navigate("/veiculos", {
            state: {
              origem: "roteiros-finalizacao",
              retornarPara: `/roteiros/${id}/executar`,
              roteiroIdParaFinalizar: id,
              alertaFinalizarVeiculo: mensagemBloqueio,
              alertaFinalizarVeiculoToken: `${Date.now()}-${id}`,
            },
          });
          return;
        }
      } catch {
        setError(
          "Não foi possível validar a pilotagem do veículo. Tente novamente em instantes.",
        );
        return;
      }
    }

    setModalFinalizar({ aberto: true, etapa: 1, loading: false });
    setKmFinalVeiculoInput("");
  };

  const fecharModalFinalizacao = () => {
    if (modalFinalizar.loading) return;
    setModalFinalizar({ aberto: false, etapa: 1, loading: false });
    setKmFinalVeiculoInput("");
  };

  const avancarConfirmacaoFinalizacao = () => {
    setModalFinalizar((prev) => ({ ...prev, etapa: 2 }));
  };

  if (loading)
    return <div className="p-20 text-center font-bold">Carregando...</div>;
  if (erroCarregamentoInicial)
    return (
      <div className="max-w-3xl mx-auto p-6">
        <AlertBox type="error" message={erroCarregamentoInicial} />
      </div>
    );
  if (!roteiro)
    return (
      <div className="p-20 text-center font-bold">Roteiro não encontrado.</div>
    );

  const observacaoAdmin = String(roteiro.observacao || "").trim();
  const veiculoResumo = roteiro?.veiculo
    ? [roteiro.veiculo.nome, roteiro.veiculo.modelo].filter(Boolean).join(" - ")
    : "Sem veículo associado";
  const orcamentoConvertido = Number(
    roteiro.orcamentoSemanal ?? roteiro.orcamentoDiario,
  );
  const totalGastoConvertido = Number(
    roteiro.totalGastoSemana ?? roteiro.totalGastoHoje,
  );
  const saldoConvertido = Number(
    roteiro.saldoGastoSemana ?? roteiro.saldoGastoHoje,
  );
  const inicioSemanaGastos = String(
    roteiro?.periodoGastos?.inicioSemana || "",
  ).trim();
  const fimSemanaGastos = String(
    roteiro?.periodoGastos?.fimSemana || "",
  ).trim();

  const orcamentoSemanal = Number.isFinite(orcamentoConvertido)
    ? orcamentoConvertido
    : 2000;
  const totalGastoSemana = Number.isFinite(totalGastoConvertido)
    ? totalGastoConvertido
    : 0;
  const saldoGastoSemana = Number.isFinite(saldoConvertido)
    ? saldoConvertido
    : orcamentoSemanal - totalGastoSemana;
  const percentualSaldo =
    orcamentoSemanal > 0 ? saldoGastoSemana / orcamentoSemanal : 0;
  const percentualSaldoBarra = Math.max(
    0,
    Math.min(100, percentualSaldo * 100),
  );
  const saldoClassName =
    saldoGastoSemana <= 0
      ? "text-red-600"
      : percentualSaldo < 0.25
        ? "text-yellow-600"
        : "text-green-600";
  const kmObrigatorioPendente =
    gastoForm.categoria === "abastecimento" &&
    String(gastoForm.quilometragem || "").trim() === "";
  const litrosObrigatorioPendente =
    gastoForm.categoria === "abastecimento" &&
    String(gastoForm.litros || "").trim() === "";
  const observacaoObrigatoriaPendente =
    gastoForm.categoria === "outros" &&
    String(gastoForm.observacao || "").trim() === "";
  const gastosSemanaOrdenados = [
    ...(roteiro.gastosSemana || roteiro.gastosHoje || []),
  ].sort((a, b) => new Date(b.dataHora) - new Date(a.dataHora));

  return (
    <div className="min-h-screen bg-gray-100 text-[#24094E]">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-8">
        <h1
          className={`text-2xl font-bold mb-6 flex items-center gap-2 ${
            roteiroEstaFinalizado(roteiro.status) &&
            !roteiroTemPendencias(roteiro)
              ? "text-green-600"
              : ""
          }`}
        >
          Execução do Roteiro: {roteiro.nome}
          {roteiroEstaFinalizado(roteiro.status) &&
            !roteiroTemPendencias(roteiro) && (
              <span className="ml-2 px-3 py-1 rounded-full bg-green-100 text-green-700 text-sm font-semibold">
                Finalizado
              </span>
            )}
        </h1>
        {!isFuncionarioAbastecedor && (
          <p className="text-sm text-gray-600 mb-4">
            🚗 Veículo: {veiculoResumo}
          </p>
        )}
        <section className="mb-6 rounded-xl border border-violet-200 bg-violet-50 p-4">
          <h3 className="text-sm font-bold text-violet-900 mb-2">
            📋 Resumo da execução (backend)
          </h3>
          {!resumoExecucaoBackend ? (
            <p className="text-xs text-violet-900">
              Resumo persistido ainda não disponível para hoje.
            </p>
          ) : (
            <div className="space-y-2 text-xs text-violet-900">
              <p>Roteiro: {resumoExecucaoBackend.roteiro || "-"}</p>
              <p className="rounded-md bg-white/70 px-2 py-1 border border-violet-200">
                Total de pontos na rota: {Number(resumoExecucaoBackend.totalPontosNaRota || 0)}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <span className="rounded-md bg-white/70 px-2 py-1 border border-violet-200">
                  Pontos feitos: {resumoExecucaoBackend.pontosFeitos.length}
                </span>
                <span className="rounded-md bg-white/70 px-2 py-1 border border-violet-200">
                  Pontos não feitos: {resumoExecucaoBackend.pontosNaoFeitos.length}
                </span>
                <span className="rounded-md bg-white/70 px-2 py-1 border border-violet-200">
                  Máquinas feitas: {resumoExecucaoBackend.maquinasFeitas.length}
                </span>
                <span className="rounded-md bg-white/70 px-2 py-1 border border-violet-200">
                  Máquinas não feitas: {resumoExecucaoBackend.maquinasNaoFeitas.length}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <span className="rounded-md bg-white/70 px-2 py-1 border border-violet-200">
                  Estoque inicial: {Number(resumoExecucaoBackend.estoqueInicial || 0)} produtos
                </span>
                {Number(resumoExecucaoBackend.estoqueAdicional || 0) > 0 && (
                  <span className="rounded-md bg-blue-50 px-2 py-1 border border-blue-300 text-blue-900 font-semibold">
                    Estoque adicional: {Number(resumoExecucaoBackend.estoqueAdicional || 0)} produtos
                  </span>
                )}
                <span className="rounded-md bg-white/70 px-2 py-1 border border-violet-200">
                  Estoque final: {Number(resumoExecucaoBackend.estoqueFinal || 0)} produtos
                </span>
                <span className="rounded-md bg-white/70 px-2 py-1 border border-violet-200">
                  Total gasto na rota: {Number(resumoExecucaoBackend.totalGastoRota || 0)} produtos
                </span>
              </div>
              {!isFuncionarioAbastecedor && obterTextoResumoParaCompartilhar() && (
                <div>
                  <p className="font-semibold mb-1">Texto do resumo (inclui KM):</p>
                  <pre className="whitespace-pre-wrap rounded-md border border-violet-200 bg-white/70 p-2 text-[11px]">
                    {obterTextoResumoParaCompartilhar()}
                  </pre>
                </div>
              )}
            </div>
          )}
        </section>
        {error && (
          <AlertBox type="error" message={error} onClose={() => setError("")} />
        )}
        {success && (
          <AlertBox
            type="success"
            message={success}
            onClose={() => setSuccess("")}
          />
        )}
        {manutencaoRecemCriada?.id && (
          <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
            <p className="text-sm font-semibold text-blue-900">
              Manutenção criada nesta loja. Se quiser, finalize agora para já
              registrar peça/observação e disparar o WhatsApp.
            </p>
            <button
              className="btn-primary mt-3"
              onClick={abrirManutencaoRecemCriada}
            >
              Fazer manutenção criada agora
            </button>
          </div>
        )}
        {observacaoAdmin && (
          <section className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <h3 className="text-sm font-bold text-amber-800 mb-1">
              Observações do Admin
            </h3>
            <p className="text-sm text-amber-900 whitespace-pre-wrap">
              {observacaoAdmin}
            </p>
          </section>
        )}

        {!isFuncionarioAbastecedor && (
        <section className="mb-8 bg-white rounded-xl shadow p-5 border border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
            <h2 className="text-lg font-bold">💸 Gastos Semanais do Roteiro</h2>
            <span className="text-xs bg-gray-100 px-3 py-1 rounded-full font-semibold text-gray-600">
              Lançamento de gastos disponível
            </span>
          </div>
          {inicioSemanaGastos && fimSemanaGastos && (
            <p className="text-xs text-gray-500 mb-3">
              Período da semana: {inicioSemanaGastos} até {fimSemanaGastos}
            </p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
              <p className="text-xs font-bold text-blue-700">
                Orçamento Semanal
              </p>
              <p className="text-xl font-extrabold text-blue-800">
                {formatarMoedaBRL(orcamentoSemanal)}
              </p>
            </div>
            <div className="rounded-lg border border-orange-200 bg-orange-50 p-3">
              <p className="text-xs font-bold text-orange-700">
                Total Gasto na Semana
              </p>
              <p className="text-xl font-extrabold text-orange-800">
                {formatarMoedaBRL(totalGastoSemana)}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <p className="text-xs font-bold text-gray-600">
                Saldo Disponível
              </p>
              <p className={`text-xl font-extrabold ${saldoClassName}`}>
                {formatarMoedaBRL(saldoGastoSemana)}
              </p>
            </div>
          </div>

          <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-5">
            <div
              className={`h-full transition-all ${
                saldoGastoSemana <= 0
                  ? "bg-red-500"
                  : percentualSaldo < 0.25
                    ? "bg-yellow-500"
                    : "bg-green-500"
              }`}
              style={{ width: `${percentualSaldoBarra}%` }}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">
                Categoria
              </label>
              <select
                className="w-full p-3 border rounded-lg bg-white"
                value={gastoForm.categoria}
                onChange={(e) =>
                  setGastoForm((prev) => ({
                    ...prev,
                    categoria: e.target.value,
                    quilometragem:
                      e.target.value === "abastecimento"
                        ? prev.quilometragem
                        : "",
                  }))
                }
                disabled={lancandoGasto}
              >
                {CATEGORIAS_GASTO.map((categoria) => (
                  <option key={categoria.value} value={categoria.value}>
                    {categoria.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">
                Valor
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                className="w-full p-3 border rounded-lg bg-white"
                placeholder="Ex: 120.50"
                value={gastoForm.valor}
                onChange={(e) =>
                  setGastoForm((prev) => ({
                    ...prev,
                    valor: e.target.value,
                  }))
                }
                disabled={lancandoGasto}
              />
            </div>
          </div>

          {gastoForm.categoria === "abastecimento" && (
            <div className="mb-3">
              <label className="block text-sm font-bold text-gray-700 mb-1">
                KM do abastecimento *
              </label>
              <input
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                className={`w-full p-3 border rounded-lg bg-white ${
                  kmObrigatorioPendente ? "border-red-400" : ""
                }`}
                placeholder="Obrigatório para abastecimento (ex: 105430)"
                value={gastoForm.quilometragem}
                required
                onChange={(e) =>
                  setGastoForm((prev) => ({
                    ...prev,
                    quilometragem: e.target.value,
                  }))
                }
                disabled={lancandoGasto}
              />
              <p className="mt-1 text-xs text-red-600 font-semibold">
                Campo obrigatório quando a categoria for Abastecimento.
              </p>
            </div>
          )}

          {gastoForm.categoria === "abastecimento" && (
            <>
              <div className="mb-3">
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  Litros abastecidos *
                </label>
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  inputMode="decimal"
                  className={`w-full p-3 border rounded-lg bg-white ${
                    litrosObrigatorioPendente ? "border-red-400" : ""
                  }`}
                  placeholder="Ex: 12.5"
                  value={gastoForm.litros}
                  required
                  onChange={(e) =>
                    setGastoForm((prev) => ({
                      ...prev,
                      litros: e.target.value,
                    }))
                  }
                  disabled={lancandoGasto}
                />
              </div>
              <div className="mb-3">
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  Nível após abastecimento
                </label>
                <select
                  className="w-full p-3 border rounded-lg bg-white"
                  value={gastoForm.nivelCombustivel}
                  onChange={(e) =>
                    setGastoForm((prev) => ({
                      ...prev,
                      nivelCombustivel: e.target.value,
                    }))
                  }
                  disabled={lancandoGasto}
                >
                  <option value="Cheio">Cheio</option>
                  <option value="3/4">3/4</option>
                  <option value="Meio tanque">Meio tanque</option>
                  <option value="1/4">1/4</option>
                  <option value="Reserva">Reserva</option>
                </select>
              </div>
            </>
          )}

          <div className="mb-4">
            <label className="block text-sm font-bold text-gray-700 mb-1">
              {gastoForm.categoria === "outros"
                ? "Observação *"
                : "Observação (opcional)"}
            </label>
            <textarea
              rows="3"
              className={`w-full p-3 border rounded-lg bg-white resize-y ${
                observacaoObrigatoriaPendente ? "border-red-400" : ""
              }`}
              placeholder="Ex: Uber entre pontos"
              value={gastoForm.observacao}
              onChange={(e) =>
                setGastoForm((prev) => ({
                  ...prev,
                  observacao: e.target.value,
                }))
              }
              disabled={lancandoGasto}
            />
            {gastoForm.categoria === "outros" && (
              <p className="mt-1 text-xs text-red-600 font-semibold">
                Campo obrigatório quando a categoria for Outros.
              </p>
            )}
          </div>

          <div className="flex justify-end mb-4">
            <button
              className="bg-blue-600 text-white py-2 px-5 rounded-lg font-bold hover:bg-blue-700 disabled:opacity-60"
              onClick={handleLancarGasto}
              disabled={
                lancandoGasto ||
                kmObrigatorioPendente ||
                litrosObrigatorioPendente ||
                observacaoObrigatoriaPendente
              }
            >
              {lancandoGasto ? "Lançando..." : "Lançar gasto"}
            </button>
          </div>

          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-bold">Categoria</th>
                  <th className="px-3 py-2 text-left font-bold">Valor</th>
                  <th className="px-3 py-2 text-left font-bold">KM</th>
                  <th className="px-3 py-2 text-left font-bold">Observação</th>
                  <th className="px-3 py-2 text-left font-bold">Funcionário</th>
                  <th className="px-3 py-2 text-left font-bold">Data</th>
                  <th className="px-3 py-2 text-left font-bold">Hora</th>
                </tr>
              </thead>
              <tbody>
                {gastosSemanaOrdenados.length > 0 ? (
                  gastosSemanaOrdenados.map((gasto) => {
                    const dataHoraFormatada = formatarDataHora(gasto.dataHora);
                    return (
                      <tr key={gasto.id} className="border-t border-gray-100">
                        <td className="px-3 py-2">
                          {getLabelCategoriaGasto(gasto.categoria)}
                        </td>
                        <td className="px-3 py-2 font-semibold text-gray-800">
                          {formatarMoedaBRL(gasto.valor)}
                        </td>
                        <td className="px-3 py-2 text-gray-600">
                          {gasto.quilometragem ?? "-"}
                        </td>
                        <td className="px-3 py-2 text-gray-600">
                          {gasto.observacao?.trim() || "-"}
                        </td>
                        <td className="px-3 py-2 text-gray-600">
                          {gasto.usuario?.nome || usuario?.nome || "-"}
                        </td>
                        <td className="px-3 py-2 text-gray-600">
                          {dataHoraFormatada.data}
                        </td>
                        <td className="px-3 py-2 text-gray-600">
                          {dataHoraFormatada.hora}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-3 py-4 text-center text-gray-500 italic"
                    >
                      Nenhum gasto lançado nesta semana para este roteiro.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
        )}

        <div className="mb-8">
          <h2 className="text-lg font-bold mb-2">
            Selecione uma loja para movimentar:
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {roteiro.lojas && roteiro.lojas.length > 0 ? (
              [...roteiro.lojas]
                .sort((a, b) => (a.ordem || 0) - (b.ordem || 0))
                .map((loja, index) => {
                  const pontoFinalizado = lojaComMaquinasFinalizadas(loja);
                  const leituraAtualizadaDoPonto =
                    leiturasAtualizadasPorLoja[String(loja.id)] === true;
                  const justificativaEdicaoDoPonto =
                    justificativasEdicaoPorLoja[String(loja.id)] || null;
                  const pontoPuladoJustificado =
                    pontosPuladosPorLoja[String(loja.id)]?.justificativaEnviada ===
                    true;

                  return (
                    <div key={loja.id} className="space-y-3">
                      <button
                        onClick={() => handleSelecionarLoja(loja)}
                        className={`p-4 rounded-lg shadow border-2 font-bold text-lg transition-all flex flex-col items-start w-full 
                        ${lojaSelecionada?.id === loja.id ? "border-blue-600" : "border-transparent"}
                        ${pontoEstaConcluido(loja) ? "bg-green-100 border-green-600 text-green-700" : "bg-white"}`}
                      >
                        <div className="flex items-center gap-2 w-full">
                          <span className="bg-[#24094E] text-white rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold">
                            {index + 1}
                          </span>
                          <span>🏪 {loja.nome}</span>
                        </div>
                        <span className="text-xs text-gray-500 ml-9">
                          {loja.cidade}, {loja.estado}
                        </span>
                        {pontoEstaConcluido(loja) && (
                          <span className="mt-1 ml-9 px-2 py-0.5 rounded-full bg-green-200 text-green-800 text-xs font-semibold">
                            Concluída
                          </span>
                        )}
                        {pontoPuladoJustificado && (
                          <span className="mt-1 ml-9 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-semibold border border-amber-300">
                            Ponto pulado justificado
                          </span>
                        )}
                      </button>

                      {pontoFinalizado && (
                        <div className="ml-9 flex flex-col items-start gap-2">
                          <button
                            className="text-xs sm:text-sm font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 px-3 py-1.5 rounded-lg"
                            onClick={() => enviarWhatsAppLoja(loja)}
                          >
                            {leituraAtualizadaDoPonto
                              ? "Enviar leitura atualizada"
                              : "Enviar leituras do ponto no WhatsApp"}
                          </button>
                          {justificativaEdicaoDoPonto?.mensagem &&
                            justificativaEdicaoDoPonto?.justificativa && (
                              <button
                                className="text-xs sm:text-sm font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-300 px-3 py-1.5 rounded-lg"
                                onClick={() =>
                                  reenviarJustificativaEdicao(loja)
                                }
                              >
                                Reenviar justificativa da edicao
                              </button>
                            )}
                        </div>
                      )}

                      {lojaSelecionada?.id === loja.id && (
                        <div className="bg-white rounded-xl shadow p-4 border border-blue-100">
                          <h3 className="text-base sm:text-lg font-bold mb-3">
                            Máquinas da loja: {loja.nome}
                          </h3>
                          <div className="mb-4">
                            <button
                              className="bg-indigo-600 text-white py-2 px-4 rounded-lg font-bold hover:bg-indigo-700"
                              onClick={() => {
                                if (lojaSelecionada?.id !== loja.id) {
                                  setLojaSelecionada(loja);
                                }
                                abrirModalNovaManutencao();
                              }}
                            >
                              ➕ Adicionar manutenção
                            </button>
                          </div>
                          <div className="space-y-3">
                            {loja.maquinas && loja.maquinas.length > 0 ? (
                              loja.maquinas.map((maquina) =>
                                (() => {
                                  const maquinaConcluida =
                                    maquinaEstaConcluidaNoBackend(maquina);
                                  const podeEditarUltimaMovimentacao =
                                    podeEditarUltimaMovimentacaoDaMaquina(
                                      maquina,
                                    );
                                  return (
                                    <div
                                      key={maquina.id}
                                      className="flex flex-col sm:flex-row sm:items-center gap-2"
                                    >
                                      <button
                                        className={`p-3 rounded border font-medium w-full text-left transition-all flex items-center gap-2 flex-wrap whitespace-normal sm:flex-1 
                                ${maquinaConcluida ? "bg-green-100 border-green-600 text-green-700" : "bg-gray-50 hover:border-blue-600"}
                                ${maquinaConcluida ? "opacity-70 cursor-not-allowed" : ""}`}
                                        onClick={() => {
                                          if (maquinaConcluida) return;
                                          navigate(
                                            `/roteiros/${roteiro.id}/lojas/${loja.id}/maquinas/${maquina.id}/movimentacao`,
                                          );
                                        }}
                                        disabled={maquinaConcluida}
                                      >
                                        <span>
                                          🖲️ {obterNomeMaquinaExibicao(maquina)}{" "}
                                          - Tipo:{" "}
                                          {obterTipoMaquinaExibicao(maquina)}
                                        </span>
                                        {maquinaConcluida && (
                                          <span className="ml-2 px-2 py-0.5 rounded-full bg-green-200 text-green-800 text-xs font-semibold">
                                            Finalizada
                                          </span>
                                        )}
                                      </button>

                                      {maquinaConcluida && (
                                        <button
                                          className="w-full sm:w-auto px-3 py-2 rounded border border-blue-500 bg-blue-50 text-blue-800 text-xs font-semibold hover:bg-blue-100 whitespace-normal"
                                          onClick={() =>
                                            abrirModalAbastecimentoExtra(
                                              maquina,
                                            )
                                          }
                                          title="Lançar apenas abastecimento extra sem alterar contadores"
                                        >
                                          Abastecimento extra
                                        </button>
                                      )}

                                      {podeEditarUltimaMovimentacao && (
                                        <button
                                          className="w-full sm:w-auto px-3 py-2 rounded border border-amber-500 bg-amber-50 text-amber-800 text-xs font-semibold hover:bg-amber-100 whitespace-normal"
                                          onClick={() =>
                                            abrirFluxoJustificativaEdicao(
                                              maquina,
                                            )
                                          }
                                          title="Editar apenas a última movimentação feita por você"
                                        >
                                          Editar última movimentação
                                        </button>
                                      )}
                                    </div>
                                  );
                                })(),
                              )
                            ) : (
                              <div className="text-gray-400">
                                Nenhuma máquina cadastrada nesta loja.
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
            ) : (
              <div className="col-span-2 text-center text-gray-400">
                Nenhuma loja disponível neste roteiro.
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          {!isFuncionarioAbastecedor &&
            (!roteiroEstaFinalizado(roteiro.status) ||
              roteiroTemPendencias(roteiro)) && (
              <button
                className="w-full sm:w-auto bg-green-600 text-white py-2 px-6 rounded-lg font-bold hover:bg-green-700"
                onClick={abrirModalFinalizacao}
              >
                Finalizar Rota
              </button>
            )}
          {!isFuncionarioAbastecedor && (
            <button
              className={`w-full sm:w-auto py-2 px-6 rounded-lg font-bold text-white ${
                roteiroEstaFinalizado(roteiro.status) && !enviandoResumoWhatsapp
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-emerald-300 cursor-not-allowed"
              }`}
              onClick={enviarResumoWhatsapp}
              disabled={
                !roteiroEstaFinalizado(roteiro.status) || enviandoResumoWhatsapp
              }
              title={
                roteiroEstaFinalizado(roteiro.status)
                  ? ""
                  : "Finalize a rota para enviar o resumo no WhatsApp"
              }
            >
              {enviandoResumoWhatsapp ? "Enviando Whats..." : "Enviar resumo Whats"}
            </button>
          )}
          {!isFuncionarioAbastecedor && (
            <button
              className={`w-full sm:w-auto py-2 px-6 rounded-lg font-bold text-white ${
                roteiroEstaFinalizado(roteiro.status) && !copiandoResumo
                  ? "bg-blue-600 hover:bg-blue-700"
                  : "bg-blue-300 cursor-not-allowed"
              }`}
              onClick={copiarResumoFinalizacao}
              disabled={!roteiroEstaFinalizado(roteiro.status) || copiandoResumo}
              title={
                roteiroEstaFinalizado(roteiro.status)
                  ? ""
                  : "Finalize a rota para copiar o resumo"
              }
            >
              {copiandoResumo ? "Copiando..." : "Copiar resumo"}
            </button>
          )}
          <button
            className="w-full sm:w-auto bg-gray-200 text-gray-700 py-2 px-6 rounded-lg font-bold"
            onClick={() => navigate("/roteiros", { replace: true })}
          >
            Voltar
          </button>
        </div>

        <Modal
          isOpen={modalFinalizar.aberto}
          onClose={fecharModalFinalizacao}
          title={
            modalFinalizar.etapa === 1
              ? "Confirmar finalização"
              : "Confirmação final"
          }
          size="sm"
        >
          <div className="space-y-4">
            <p className="text-gray-700">
              {modalFinalizar.etapa === 1
                ? "Deseja realmente finalizar esta rota?"
                : "Confirma novamente: finalizar agora este roteiro?"}
            </p>
            {roteiroTemVeiculoAssociado(roteiro) && modalFinalizar.etapa === 2 && (
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  KM final de devolução do veículo
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  inputMode="numeric"
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Ex: 12380"
                  value={kmFinalVeiculoInput}
                  onChange={(e) => setKmFinalVeiculoInput(e.target.value)}
                  disabled={modalFinalizar.loading}
                />
                <p className="mt-1 text-xs text-gray-500">
                  Campo obrigatório quando o roteiro possui veículo.
                </p>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                className="btn-secondary"
                onClick={fecharModalFinalizacao}
                disabled={modalFinalizar.loading}
              >
                Cancelar
              </button>
              {modalFinalizar.etapa === 1 ? (
                <button
                  className="btn-primary"
                  onClick={avancarConfirmacaoFinalizacao}
                >
                  Continuar
                </button>
              ) : (
                <button
                  className="btn-danger"
                  onClick={executarFinalizacaoRoteiro}
                  disabled={modalFinalizar.loading}
                >
                  {modalFinalizar.loading ? "Finalizando..." : "Finalizar Rota"}
                </button>
              )}
            </div>
          </div>
        </Modal>

        <Modal
          isOpen={modalJustificativa.aberto}
          onClose={() =>
            setModalJustificativa({
              aberto: false,
              lojaId: null,
              lojaNome: "",
              lojaPuladaId: null,
              lojaPuladaNome: "",
              justificativa: "",
            })
          }
          title="Justificar alteração de ordem"
          size="md"
        >
          <div className="space-y-4">
            <div className="p-3 bg-yellow-50 border-l-4 border-yellow-500 rounded">
              <p className="text-yellow-800 font-semibold mb-2">
                ⚠️ Você está pulando a ordem das lojas!
              </p>
              <p className="text-sm text-yellow-700">
                Ponto pulado:{" "}
                <span className="font-bold">
                  {modalJustificativa.lojaPuladaNome}
                </span>
              </p>
              <p className="text-sm text-yellow-700">
                Loja selecionada:{" "}
                <span className="font-bold">{modalJustificativa.lojaNome}</span>
              </p>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Por que você está pulando a ordem?
              </label>
              <textarea
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                rows="4"
                placeholder="Ex: O ponto estava fechado, problema de acesso, etc."
                value={modalJustificativa.justificativa}
                onChange={(e) =>
                  setModalJustificativa((prev) => ({
                    ...prev,
                    justificativa: e.target.value,
                  }))
                }
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                className="btn-secondary"
                onClick={() =>
                  setModalJustificativa({
                    aberto: false,
                    lojaId: null,
                    lojaNome: "",
                    lojaPuladaId: null,
                    lojaPuladaNome: "",
                    justificativa: "",
                  })
                }
              >
                Cancelar
              </button>
              <button
                className="btn-primary"
                onClick={confirmarSelecaoComJustificativa}
              >
                Confirmar
              </button>
            </div>
          </div>
        </Modal>

        <Modal
          isOpen={modalNovaManutencao.aberto}
          onClose={fecharModalNovaManutencao}
          title="Nova manutenção da loja"
          size="md"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">
                Máquina
              </label>
              <select
                className="w-full p-3 border rounded-lg bg-white"
                value={novaManutencaoRoteiro.maquinaId}
                onChange={(e) =>
                  setNovaManutencaoRoteiro((prev) => ({
                    ...prev,
                    maquinaId: e.target.value,
                  }))
                }
              >
                <option value="">Selecione uma máquina</option>
                {(lojaSelecionada?.maquinas || []).map((maquina) => (
                  <option key={maquina.id} value={maquina.id}>
                    {obterNomeMaquinaExibicao(maquina)} - Tipo:{" "}
                    {obterTipoMaquinaExibicao(maquina)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">
                Descrição da manutenção
              </label>
              <textarea
                rows="3"
                className="w-full p-3 border rounded-lg bg-white resize-y"
                placeholder="Descreva o que precisa ser feito..."
                value={novaManutencaoRoteiro.descricao}
                onChange={(e) =>
                  setNovaManutencaoRoteiro((prev) => ({
                    ...prev,
                    descricao: e.target.value,
                  }))
                }
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                className="btn-secondary"
                onClick={fecharModalNovaManutencao}
                disabled={modalNovaManutencao.loading}
              >
                Cancelar
              </button>
              <button
                className="btn-primary"
                onClick={handleCriarManutencaoRoteiro}
                disabled={modalNovaManutencao.loading}
              >
                {modalNovaManutencao.loading
                  ? "Salvando..."
                  : "Criar manutenção"}
              </button>
            </div>
          </div>
        </Modal>

        <Modal
          isOpen={modalJustificativaEdicao.aberto}
          onClose={fecharModalJustificativaEdicao}
          title="Justificativa para editar movimentação"
          size="md"
        >
          <div className="space-y-4">
            <div className="p-3 bg-amber-50 border-l-4 border-amber-400 rounded">
              <p className="text-sm text-amber-900 font-semibold">
                Depois de salvar, informe obrigatoriamente o motivo da edição.
                Esta justificativa será enviada no WhatsApp com o resumo do que
                foi alterado.
              </p>
              {modalJustificativaEdicao?.maquina && (
                <p className="text-xs text-amber-800 mt-2">
                  Máquina:{" "}
                  {obterNomeMaquinaExibicao(modalJustificativaEdicao.maquina)} |
                  Tipo:{" "}
                  {obterTipoMaquinaExibicao(modalJustificativaEdicao.maquina)}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Motivo da edição *
              </label>
              <textarea
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-amber-300 outline-none"
                rows="4"
                placeholder="Explique por que você precisa editar esta movimentação..."
                value={modalJustificativaEdicao.justificativa}
                onChange={(e) =>
                  setModalJustificativaEdicao((prev) => ({
                    ...prev,
                    justificativa: e.target.value,
                  }))
                }
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                className="btn-secondary"
                onClick={fecharModalJustificativaEdicao}
              >
                Cancelar
              </button>
              <button
                className="btn-primary"
                onClick={confirmarJustificativaEdicao}
              >
                Enviar justificativa
              </button>
            </div>
          </div>
        </Modal>

        <Modal
          isOpen={modalAbastecimentoExtra.aberto}
          onClose={fecharModalAbastecimentoExtra}
          title="Abastecimento extra da máquina"
          size="md"
        >
          <div className="space-y-4">
            <div className="p-3 bg-blue-50 border-l-4 border-blue-500 rounded">
              <p className="text-sm text-blue-900 font-semibold">
                Este lançamento altera somente o abastecimento da máquina.
              </p>
              <p className="text-xs text-blue-800 mt-1">
                Não altera contador IN/OUT, apenas soma pelúcias na máquina e
                desconta do estoque do usuário.
              </p>
              {modalAbastecimentoExtra?.maquina && (
                <p className="text-xs text-blue-800 mt-2">
                  Máquina:{" "}
                  {obterNomeMaquinaExibicao(modalAbastecimentoExtra.maquina)} |
                  Tipo:{" "}
                  {obterTipoMaquinaExibicao(modalAbastecimentoExtra.maquina)}
                </p>
              )}
            </div>

            {modalAbastecimentoExtra.erro && (
              <AlertBox
                type="error"
                message={modalAbastecimentoExtra.erro}
                onClose={() =>
                  setModalAbastecimentoExtra((prev) => ({
                    ...prev,
                    erro: "",
                  }))
                }
              />
            )}

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Produto abastecido *
              </label>
              <select
                className="w-full p-3 border rounded-lg bg-white"
                value={modalAbastecimentoExtra.produtoId}
                onChange={(e) =>
                  alterarProdutoAbastecimentoExtra(e.target.value)
                }
                disabled={modalAbastecimentoExtra.loading}
              >
                <option value="">Selecione um produto</option>
                {produtosAbastecimentoExtra.map((produto) => (
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
                value={modalAbastecimentoExtra.quantidade}
                onChange={(e) =>
                  setModalAbastecimentoExtra((prev) => ({
                    ...prev,
                    quantidade: e.target.value,
                    erro: "",
                  }))
                }
                disabled={modalAbastecimentoExtra.loading}
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                className="btn-secondary"
                onClick={fecharModalAbastecimentoExtra}
                disabled={modalAbastecimentoExtra.loading}
              >
                Cancelar
              </button>
              <button
                className="btn-primary"
                onClick={() => salvarAbastecimentoExtra()}
                disabled={modalAbastecimentoExtra.loading}
              >
                {modalAbastecimentoExtra.loading
                  ? "Salvando..."
                  : "Salvar abastecimento"}
              </button>
            </div>
          </div>
        </Modal>

        <Modal
          isOpen={modalAbastecimentoExtra.confirmarTrocaProdutoAberto}
          onClose={cancelarTrocaProdutoAbastecimentoExtra}
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
                onClick={cancelarTrocaProdutoAbastecimentoExtra}
              >
                Não, manter anterior
              </button>
              <button
                type="button"
                className="btn-primary w-full sm:w-auto"
                onClick={confirmarTrocaProdutoAbastecimentoExtra}
                disabled={modalAbastecimentoExtra.loading}
              >
                {modalAbastecimentoExtra.loading
                  ? "Salvando..."
                  : "Sim, trocar produto"}
              </button>
            </div>
          </div>
        </Modal>

        {modalEdicaoAberto && movimentacaoParaEditar && (
          <ModalEditarMovimentacao
            movimentacao={movimentacaoParaEditar}
            bloquearDataColeta={true}
            onClose={() => {
              setModalEdicaoAberto(false);
            }}
            onSucesso={concluirEdicaoMovimentacao}
          />
        )}

        <ManutencaoModal
          isOpen={modalManutencao}
          onClose={() => setModalManutencao(false)}
          manutencao={manutencaoPendente}
          lojaId={lojaSelecionada?.id}
          roteiroId={id}
          usuarioId={usuario?.id}
          usuarioNome={usuario?.nome}
          onManutencaoConcluida={handleManutencaoConcluida}
        />
      </main>
      <Footer />
    </div>
  );
}

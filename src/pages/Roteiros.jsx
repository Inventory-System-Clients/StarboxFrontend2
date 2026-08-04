import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Swal from "sweetalert2";
import api from "../services/api";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import { Modal, AlertBox } from "../components/UIComponents";
import {
  abrirWhatsAppComMensagem,
  filtrarMensagemFinalizacaoRoteiroManutencoesPorPeriodo,
  obterKmInicialPilotagemAtiva,
} from "../lib/roteiroFinalizacaoWhatsApp";

export function Roteiros() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isAdmin = usuario?.role === "ADMIN";
  const isGestorRoteiro =
    isAdmin || usuario?.role === "GERENCIADOR";
  // Rota cujo funcionário responsável tem role ABASTECEDOR: sem veículo e
  // sem botão de finalizar/desfinalizar. Prioriza o flag pronto por rota
  // vindo do backend, mas também cai para o role do próprio usuário logado
  // quando ele é o responsável pela rota — assim, mudar o role de alguém
  // para ABASTECEDOR já reflete nas rotas existentes dessa pessoa na hora.
  const roteiroEhDeAbastecedor = (roteiroItem) =>
    roteiroItem?.funcionarioAbastecedor === true ||
    roteiroItem?.funcionario?.role === "ABASTECEDOR" ||
    (usuario?.role === "ABASTECEDOR" &&
      Boolean(usuario?.id) &&
      String(roteiroItem?.funcionarioId || "") === String(usuario.id));
  const LIMITE_OBSERVACAO_ROTEIRO = 1000;
  const ORCAMENTO_SEMANAL_PADRAO = 2000;
  const STATUS_ROTEIRO_FINALIZADO = new Set([
    "finalizado",
    "finalizada",
    "concluido",
    "concluida",
  ]);
  // --- ESTADOS DE DADOS ---
  const [roteiros, setRoteiros] = useState([]);
  const [funcionarios, setFuncionarios] = useState([]);
  const [veiculos, setVeiculos] = useState([]);
  const [todasLojas, setTodasLojas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [avisoAndamento, setAvisoAndamento] = useState(null);

  // --- DIAS DA SEMANA ---
  const DIAS_SEMANA = [
    { label: "SEG", full: "Segunda" },
    { label: "TER", full: "Terça" },
    { label: "QUA", full: "Quarta" },
    { label: "QUI", full: "Quinta" },
    { label: "SEX", full: "Sexta" },
    { label: "SAB", full: "Sábado" },
    { label: "DOM", full: "Domingo" },
  ];

  // diasPendentes: { [roteiroId]: string[] } — alterações locais antes de salvar
  const [diasPendentes, setDiasPendentes] = useState({});
  const [salvandoDias, setSalvandoDias] = useState({});

  const getDiasRoteiro = (roteiro) => {
    if (diasPendentes[roteiro.id] !== undefined)
      return diasPendentes[roteiro.id];
    return roteiro.diasSemana || [];
  };

  const toggleDia = (roteiroId, dia) => {
    setDiasPendentes((prev) => {
      const atual =
        prev[roteiroId] !== undefined
          ? prev[roteiroId]
          : roteiros.find((r) => r.id === roteiroId)?.diasSemana || [];
      const novo = atual.includes(dia)
        ? atual.filter((d) => d !== dia)
        : [...atual, dia];
      return { ...prev, [roteiroId]: novo };
    });
  };

  const salvarDias = async (roteiroId) => {
    const dias = diasPendentes[roteiroId];
    if (dias === undefined) return;
    try {
      setSalvandoDias((prev) => ({ ...prev, [roteiroId]: true }));
      await api.patch(`/roteiros/${roteiroId}`, { diasSemana: dias });
      setDiasPendentes((prev) => {
        const c = { ...prev };
        delete c[roteiroId];
        return c;
      });
      carregarDadosIniciais();
    } catch (err) {
      setError("Erro ao salvar dias do roteiro.");
    } finally {
      setSalvandoDias((prev) => ({ ...prev, [roteiroId]: false }));
    }
  };

  // --- ESTADOS DE MODAL ---
  const [showModalCriarRoteiro, setShowModalCriarRoteiro] = useState(false);
  const [showModalAdicionarLoja, setShowModalAdicionarLoja] = useState(false);
  const [novoNomeRoteiro, setNovoNomeRoteiro] = useState("");
  const [novoVeiculoId, setNovoVeiculoId] = useState("");
  const [novosDiasRoteiro, setNovosDiasRoteiro] = useState([]);
  const [novaObservacaoRoteiro, setNovaObservacaoRoteiro] = useState("");
  const [filtroNomeRoteiro, setFiltroNomeRoteiro] = useState("");
  const [roteiroParaAdicionar, setRoteiroParaAdicionar] = useState(null);
  const [filtroLojaAdicionar, setFiltroLojaAdicionar] = useState("");
  const [observacoesPendentes, setObservacoesPendentes] = useState({});
  const [salvandoObservacao, setSalvandoObservacao] = useState({});
  const [orcamentosPendentes, setOrcamentosPendentes] = useState({});
  const [salvandoOrcamento, setSalvandoOrcamento] = useState({});
  const [apagandoRoteiros, setApagandoRoteiros] = useState({});
  const [iniciandoRoteiros, setIniciandoRoteiros] = useState({});
  const [kmInicialVeiculoPorRoteiro, setKmInicialVeiculoPorRoteiro] =
    useState({});
  const [desfinalizandoRoteiros, setDesfinalizandoRoteiros] = useState({});
  const [lojasExpandidasPorRoteiro, setLojasExpandidasPorRoteiro] =
    useState({});
  const [modalFinalizar, setModalFinalizar] = useState({
    aberto: false,
    etapa: 1,
    roteiro: null,
    loading: false,
  });

  // --- ESTADOS DE DRAG & DROP ---
  const [draggedLoja, setDraggedLoja] = useState(null);
  const [draggedFromRoteiro, setDraggedFromRoteiro] = useState(null);
  const [draggedOverIndex, setDraggedOverIndex] = useState(null);
  const autoScrollIntervalRef = useRef(null);
  const dragScrollDirectionRef = useRef(0);

  const pararAutoScrollDrag = () => {
    if (autoScrollIntervalRef.current) {
      clearInterval(autoScrollIntervalRef.current);
      autoScrollIntervalRef.current = null;
    }
    dragScrollDirectionRef.current = 0;
  };

  const iniciarAutoScrollDrag = (direcao) => {
    if (dragScrollDirectionRef.current === direcao) return;

    pararAutoScrollDrag();
    dragScrollDirectionRef.current = direcao;

    autoScrollIntervalRef.current = setInterval(() => {
      const distancia = 20;
      window.scrollBy({ top: direcao * distancia, behavior: "auto" });
    }, 16);
  };

  const atualizarAutoScrollDrag = (clientY) => {
    if (typeof clientY !== "number") {
      pararAutoScrollDrag();
      return;
    }

    const limite = 140;
    const alturaJanela = window.innerHeight;

    if (clientY <= limite) {
      iniciarAutoScrollDrag(-1);
      return;
    }

    if (clientY >= alturaJanela - limite) {
      iniciarAutoScrollDrag(1);
      return;
    }

    pararAutoScrollDrag();
  };

  useEffect(() => {
    return () => {
      pararAutoScrollDrag();
    };
  }, []);

  const normalizarStatusTexto = (valor) =>
    String(valor || "")
      .trim()
      .toLowerCase();

  const extrairStatusExecucaoBackend = (payload) => {
    if (!payload || typeof payload !== "object") {
      return { statusTexto: "", emAndamento: false, finalizado: false };
    }

    const statusTexto = normalizarStatusTexto(
      payload?.statusExecucao ||
        payload?.status_execucao ||
        payload?.status ||
        payload?.estado ||
        payload?.execucaoStatus ||
        payload?.execucao_status ||
        "",
    );

    const emAndamento =
      payload?.emAndamento === true ||
      payload?.em_andamento === true ||
      payload?.ativo === true ||
      payload?.iniciado === true ||
      new Set([
        "em_andamento",
        "em-andamento",
        "em andamento",
        "iniciado",
        "ativo",
      ]).has(statusTexto);

    const finalizado =
      payload?.finalizado === true ||
      payload?.finalizada === true ||
      payload?.concluido === true ||
      payload?.concluida === true ||
      STATUS_ROTEIRO_FINALIZADO.has(statusTexto);

    return { statusTexto, emAndamento, finalizado };
  };

  const normalizarExecucaoSemanal = (roteiro, payloadExtra = null) => {
    const execucaoBase =
      roteiro?.execucaoSemanal ||
      roteiro?.execucao_semanal ||
      roteiro?.execucao ||
      null;
    const execucaoPayload =
      payloadExtra?.execucaoSemanal ||
      payloadExtra?.execucao_semanal ||
      payloadExtra?.execucao ||
      payloadExtra ||
      null;

    const execucao =
      execucaoBase && typeof execucaoBase === "object"
        ? execucaoBase
        : execucaoPayload && typeof execucaoPayload === "object"
          ? execucaoPayload
          : null;

    if (!execucao) return null;

    const usuarioAssociado =
      execucao?.usuarioAssociado ||
      execucao?.usuario_associado ||
      execucao?.usuario ||
      null;

    return {
      emAndamento: execucao?.emAndamento === true || execucao?.em_andamento === true,
      usuarioId:
        execucao?.usuarioAssociadoId ||
        execucao?.usuario_associado_id ||
        usuarioAssociado?.id ||
        execucao?.usuarioId ||
        execucao?.usuario_id ||
        null,
      usuarioNome:
        execucao?.usuarioAssociadoNome ||
        execucao?.usuario_associado_nome ||
        usuarioAssociado?.nome ||
        execucao?.usuarioNome ||
        execucao?.usuario_nome ||
        "",
      dataInicio:
        execucao?.dataInicio ||
        execucao?.data_inicio ||
        execucao?.iniciadoEm ||
        execucao?.iniciado_em ||
        execucao?.data ||
        null,
      finalizadoEm: execucao?.finalizadoEm || execucao?.finalizado_em || null,
    };
  };

  const obterStatusExecucaoRoteiro = (roteiro) =>
    normalizarStatusTexto(
      roteiro?.statusExecucao ||
        roteiro?.status_execucao ||
        roteiro?.statusExecucaoTexto ||
        roteiro?.statusRota ||
        roteiro?.status_rota ||
        roteiro?.status ||
        "",
    );

  const roteiroTemPontosConcluidos = (roteiro) => {
    const lojas = Array.isArray(roteiro?.lojas) ? roteiro.lojas : [];

    return lojas.some((loja) => {
      const camposBooleanos = [
        loja?.concluida,
        loja?.concluída,
        loja?.statusConcluida,
        loja?.status_concluida,
        loja?.pontoConcluido,
        loja?.ponto_concluido,
      ];

      const concluidoPorBooleano = camposBooleanos.some((valor) => {
        if (valor === true) return true;
        if (valor === 1) return true;
        return String(valor || "").trim().toLowerCase() === "true";
      });

      if (concluidoPorBooleano) return true;

      const status = normalizarStatusTexto(loja?.status);
      return STATUS_ROTEIRO_FINALIZADO.has(status);
    });
  };

  const isRoteiroFinalizado = (roteiro) => {
    if (roteiro?.statusExecucaoFinalizado === true) return true;

    const status = obterStatusExecucaoRoteiro(roteiro);
    return STATUS_ROTEIRO_FINALIZADO.has(status);
  };

  const isRoteiroStatusFinalizado = (roteiro) => isRoteiroFinalizado(roteiro);

  const isRoteiroPendente = (roteiro) => {
    const status = obterStatusExecucaoRoteiro(roteiro);
    if (status) return status === "pendente";

    return (
      !isRoteiroEmAndamento(roteiro) &&
      !isRoteiroFinalizado(roteiro) &&
      !roteiroTemPontosConcluidos(roteiro)
    );
  };

  const isRoteiroEmAndamento = (roteiro) => {
    if (roteiro?.statusExecucaoEmAndamento === true) return true;

    const execucaoSemanal = normalizarExecucaoSemanal(roteiro);
    if (execucaoSemanal?.emAndamento === true) return true;
    const status = obterStatusExecucaoRoteiro(roteiro);
    return new Set([
      "em_andamento",
      "em-andamento",
      "em andamento",
      "iniciado",
      "ativo",
    ]).has(status);
  };

  const isRoteiroEmAndamentoPorOutro = (roteiro) => {
    if (isAdmin) return false;

    const execucaoSemanal = normalizarExecucaoSemanal(roteiro);
    if (!execucaoSemanal?.emAndamento) return false;

    const usuarioAtualId = String(usuario?.id || "").trim();
    const usuarioAssociadoId = String(execucaoSemanal?.usuarioId || "").trim();

    if (!usuarioAtualId || !usuarioAssociadoId) return false;
    return usuarioAtualId !== usuarioAssociadoId;
  };

  const usuarioPodeIniciarRoteiro = (roteiro) => {
    if (!isRoteiroPendente(roteiro)) return false;
    if (isGestorRoteiro) return true;

    const funcionarioRoteiroId = String(roteiro?.funcionarioId || "").trim();
    const usuarioAtualId = String(usuario?.id || "").trim();

    return Boolean(
      funcionarioRoteiroId &&
        usuarioAtualId &&
        funcionarioRoteiroId === usuarioAtualId,
    );
  };

  const abrirAndamentoRoteiro = (roteiroId) => {
    if (!roteiroId) return;
    navigate(`/roteiros/${roteiroId}/andamento`);
  };

  const getRoteiroById = (roteiroId) =>
    roteiros.find((item) => String(item.id) === String(roteiroId));

  const LIMITE_LOJAS_VISIVEIS_CARD = 4;

  const listaLojasExpandida = (roteiroId) =>
    Boolean(lojasExpandidasPorRoteiro[roteiroId]);

  const toggleExpandirLojasDoRoteiro = (roteiroId) => {
    setLojasExpandidasPorRoteiro((prev) => ({
      ...prev,
      [roteiroId]: !prev[roteiroId],
    }));
  };

  const roteiroTemVeiculoAssociado = (roteiroAtual) =>
    Boolean(
      String(roteiroAtual?.veiculoId || roteiroAtual?.veiculo?.id || "").trim(),
    );

  const normalizarIdOpcional = (valor) => {
    const texto = String(valor || "").trim();
    return texto || null;
  };

  const usuarioPodeSerResponsavelRoteiro = (item) =>
    ["ADMIN", "FUNCIONARIO", "FUNCIONARIO_TODAS_LOJAS", "ABASTECEDOR"].includes(
      String(item?.role || "")
        .trim()
        .toUpperCase(),
    );

  const obterLabelResponsavelRoteiro = (item) => {
    const nome = String(item?.nome || "").trim();
    const role = String(item?.role || "").trim().toUpperCase();
    const sufixo = role === "ADMIN" ? " (Admin)" : "";
    return `${nome || "Usuário sem nome"}${sufixo}`;
  };

  const normalizarResponsaveisRoteiro = (listas) => {
    const mapa = new Map();

    listas.flat().forEach((item) => {
      const id = String(item?.id || "").trim();
      if (!id || !usuarioPodeSerResponsavelRoteiro(item)) return;
      if (item?.ativo === false) return;
      mapa.set(id, {
        ...item,
        id,
        nome: String(item?.nome || "").trim(),
        role: String(item?.role || "").trim().toUpperCase(),
      });
    });

    return Array.from(mapa.values()).sort((a, b) =>
      obterLabelResponsavelRoteiro(a).localeCompare(
        obterLabelResponsavelRoteiro(b),
        "pt-BR",
        { sensitivity: "base" },
      ),
    );
  };

  const getVeiculoLabel = (veiculo) => {
    const nome = String(veiculo?.nome || "").trim();
    const modelo = String(veiculo?.modelo || "").trim();

    if (!nome && !modelo) return "Veículo sem identificação";
    return [nome, modelo].filter(Boolean).join(" - ");
  };

  const getVeiculoResumoRoteiro = (roteiro) => {
    if (!roteiro?.veiculo) return "Sem veículo associado";
    return getVeiculoLabel(roteiro.veiculo);
  };

  const getKmInicialSugeridoDoVeiculo = (roteiro) => {
    const veiculoId = String(roteiro?.veiculoId || roteiro?.veiculo?.id || "")
      .trim();
    const usuarioId = String(usuario?.id || "").trim();

    if (!veiculoId || !usuarioId) return "";

    const kmInicial = obterKmInicialPilotagemAtiva({
      usuarioId,
      veiculoId,
    });

    return Number.isFinite(Number(kmInicial)) ? String(Number(kmInicial)) : "";
  };

  const getKmInicialInputRoteiro = (roteiro) => {
    const kmDigitado = kmInicialVeiculoPorRoteiro[roteiro.id];
    if (kmDigitado !== undefined) return kmDigitado;
    return getKmInicialSugeridoDoVeiculo(roteiro);
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

  const getMensagemErroVeiculo = (err, fallback) => {
    const mensagemBackend = String(err?.response?.data?.error || "");
    const mensagemNormalizada = mensagemBackend
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

    if (
      err?.response?.status === 404 &&
      mensagemNormalizada.includes("veiculo nao encontrado")
    ) {
      return "Veículo não encontrado. Selecione um veículo válido e tente novamente.";
    }

    return mensagemBackend || fallback;
  };

  const formatarMoedaBRL = (valor) =>
    Number(valor || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });

  const getOrcamentoNumericoRoteiro = (roteiro) => {
    const valor = Number(roteiro?.orcamentoSemanal ?? roteiro?.orcamentoDiario);
    return Number.isFinite(valor) ? valor : ORCAMENTO_SEMANAL_PADRAO;
  };

  const getOrcamentoRoteiro = (roteiro) => {
    if (orcamentosPendentes[roteiro.id] !== undefined) {
      return orcamentosPendentes[roteiro.id];
    }
    return getOrcamentoNumericoRoteiro(roteiro).toFixed(2);
  };

  const handleOrcamentoChange = (roteiroId, valor) => {
    setOrcamentosPendentes((prev) => ({
      ...prev,
      [roteiroId]: valor,
    }));
  };

  const salvarOrcamentoSemanal = async (roteiroId) => {
    const orcamentoDigitado = orcamentosPendentes[roteiroId];
    if (orcamentoDigitado === undefined) return;

    const orcamentoNormalizado = String(orcamentoDigitado)
      .trim()
      .replace(",", ".");
    const valorInformado =
      orcamentoNormalizado === ""
        ? ORCAMENTO_SEMANAL_PADRAO
        : Number(orcamentoNormalizado);

    if (!Number.isFinite(valorInformado) || valorInformado < 0) {
      setError("Informe um orçamento semanal válido.");
      return;
    }

    const valorOrcamento = Number(valorInformado.toFixed(2));
    const roteiroAtual = getRoteiroById(roteiroId);
    const orcamentoAtual = Number(
      getOrcamentoNumericoRoteiro(roteiroAtual).toFixed(2),
    );

    if (valorOrcamento === orcamentoAtual) {
      setOrcamentosPendentes((prev) => {
        const copia = { ...prev };
        delete copia[roteiroId];
        return copia;
      });
      return;
    }

    try {
      setSalvandoOrcamento((prev) => ({ ...prev, [roteiroId]: true }));
      await api.patch(`/roteiros/${roteiroId}/orcamento-semanal`, {
        orcamentoSemanal: valorOrcamento,
      });

      setRoteiros((prev) =>
        prev.map((item) =>
          item.id === roteiroId
            ? {
                ...item,
                orcamentoSemanal: valorOrcamento,
                orcamentoDiario: valorOrcamento,
              }
            : item,
        ),
      );

      setOrcamentosPendentes((prev) => {
        const copia = { ...prev };
        delete copia[roteiroId];
        return copia;
      });
      setSuccess("Orçamento semanal salvo com sucesso!");
    } catch {
      setError("Erro ao salvar orçamento semanal do roteiro.");
    } finally {
      setSalvandoOrcamento((prev) => ({ ...prev, [roteiroId]: false }));
    }
  };

  const getObservacaoRoteiro = (roteiro) => {
    if (observacoesPendentes[roteiro.id] !== undefined) {
      return observacoesPendentes[roteiro.id];
    }
    return roteiro.observacao || "";
  };

  const handleObservacaoChange = (roteiroId, valor) => {
    const valorLimitado = valor.slice(0, LIMITE_OBSERVACAO_ROTEIRO);
    setObservacoesPendentes((prev) => ({
      ...prev,
      [roteiroId]: valorLimitado,
    }));
  };

  const salvarObservacao = async (roteiroId) => {
    const observacaoDigitada = observacoesPendentes[roteiroId];
    if (observacaoDigitada === undefined) return;

    const roteiroAtual = getRoteiroById(roteiroId);
    const observacaoAtualNormalizada = String(
      roteiroAtual?.observacao || "",
    ).trim();
    const observacaoNormalizada = observacaoDigitada.trim();
    const observacaoPayload = observacaoNormalizada || null;

    if (observacaoNormalizada === observacaoAtualNormalizada) {
      setObservacoesPendentes((prev) => {
        const copia = { ...prev };
        delete copia[roteiroId];
        return copia;
      });
      return;
    }

    try {
      setSalvandoObservacao((prev) => ({ ...prev, [roteiroId]: true }));
      await api.patch(`/roteiros/${roteiroId}`, {
        observacao: observacaoPayload,
      });

      setRoteiros((prev) =>
        prev.map((item) =>
          item.id === roteiroId
            ? { ...item, observacao: observacaoPayload }
            : item,
        ),
      );

      setObservacoesPendentes((prev) => {
        const copia = { ...prev };
        delete copia[roteiroId];
        return copia;
      });
      setSuccess("Observação do roteiro salva com sucesso!");
    } catch {
      setError("Erro ao salvar observação do roteiro.");
    } finally {
      setSalvandoObservacao((prev) => ({ ...prev, [roteiroId]: false }));
    }
  };

  const normalizarTextoFiltro = (texto = "") =>
    String(texto)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

  const termoBuscaLoja = normalizarTextoFiltro(filtroLojaAdicionar);
  const idsLojasNoRoteiro = new Set(
    (roteiroParaAdicionar?.lojas || []).map((l) => String(l.id)),
  );
  const lojasFiltradasParaAdicionar = todasLojas.filter((loja) => {
    // Excluir lojas já presentes no roteiro
    if (idsLojasNoRoteiro.has(String(loja.id))) return false;

    if (!termoBuscaLoja) return true;

    const textoBuscaLoja = [
      loja?.nome,
      loja?.codigo,
      loja?.cidade,
      loja?.bairro,
      loja?.id,
    ]
      .filter(Boolean)
      .map((campo) => normalizarTextoFiltro(campo))
      .join(" ");

    return textoBuscaLoja.includes(termoBuscaLoja);
  });

  const roteirosDoUsuario = isGestorRoteiro
    ? roteiros
    : roteiros.filter((r) => String(r.funcionarioId) === String(usuario?.id));

  const termoBuscaRoteiro = normalizarTextoFiltro(filtroNomeRoteiro);
  const roteirosFiltrados = roteirosDoUsuario.filter((roteiro) =>
    normalizarTextoFiltro(roteiro?.nome || "").includes(termoBuscaRoteiro),
  );

  // Depende de usuario?.role para esperar o AuthContext hidratar do localStorage
  useEffect(() => {
    if (usuario === undefined) return; // ainda inicializando
    carregarDadosIniciais();
  }, [usuario?.role]);

  useEffect(() => {
    const roteiroIdState = String(
      location.state?.roteiroIdParaFinalizar || "",
    ).trim();

    if (!location.state?.pilotagemFinalizada || !roteiroIdState) {
      return;
    }

    const roteiroAlvo = getRoteiroById(roteiroIdState);
    if (roteiroAlvo && !isRoteiroFinalizado(roteiroAlvo)) {
      setSuccess(
        "Veículo finalizado com sucesso. Confirme a finalização da rota para concluir o roteiro.",
      );
      setModalFinalizar({
        aberto: true,
        etapa: 1,
        roteiro: roteiroAlvo,
        loading: false,
      });
    }

    const proximoState = { ...(location.state || {}) };
    delete proximoState.pilotagemFinalizada;
    delete proximoState.roteiroIdParaFinalizar;
    delete proximoState.alertaFinalizarVeiculo;
    delete proximoState.alertaFinalizarVeiculoToken;

    navigate(location.pathname, {
      replace: true,
      state: Object.keys(proximoState).length > 0 ? proximoState : {},
    });
  }, [location.pathname, location.state, navigate, roteiros]);

  const aplicarStatusExecucaoRoteiros = async (lista) => {
    const requisicoes = lista.map((item) => {
      const roteiroId = String(item?.id || "").trim();
      if (!roteiroId) {
        return Promise.resolve({ data: null, __skip: true });
      }

      return api.get(`/roteiro-status/${roteiroId}/status-execucao`);
    });

    const resultados = await Promise.allSettled(requisicoes);

    return lista.map((roteiro, index) => {
      const resultado = resultados[index];
      if (resultado?.status !== "fulfilled") return roteiro;
      if (resultado?.value?.__skip) return roteiro;

      const payloadStatus = resultado.value?.data || null;
      const statusInfo = extrairStatusExecucaoBackend(payloadStatus);
      const execucaoSemanalNormalizada = normalizarExecucaoSemanal(
        roteiro,
        payloadStatus,
      );
      let statusTexto = statusInfo.statusTexto;

      if (!statusTexto) {
        if (statusInfo.finalizado) {
          statusTexto = "finalizado";
        } else if (statusInfo.emAndamento) {
          statusTexto = "em_andamento";
        }
      }

      return {
        ...roteiro,
        execucaoSemanal: execucaoSemanalNormalizada || roteiro?.execucaoSemanal,
        statusExecucao: statusTexto || roteiro?.statusExecucao || null,
        statusExecucaoEmAndamento:
          statusInfo.emAndamento || execucaoSemanalNormalizada?.emAndamento,
        statusExecucaoFinalizado:
          statusInfo.finalizado || Boolean(execucaoSemanalNormalizada?.finalizadoEm),
      };
    });
  };

  const carregarDadosIniciais = async () => {
    try {
      setLoading(true);
      const promises = [
        api.get("/roteiros/com-status"),
        api.get("/lojas"),
        isGestorRoteiro
          ? api.get("/usuarios/funcionarios")
          : Promise.resolve({ data: [] }),
        isAdmin
          ? api.get("/usuarios?ativo=true").catch(() => ({ data: [] }))
          : Promise.resolve({ data: [] }),
        isGestorRoteiro ? api.get("/veiculos") : Promise.resolve({ data: [] }),
      ];
      const [resRoteiros, resLojas, resFuncionarios, resUsuarios, resVeiculos] =
        await Promise.all(promises);
      const listaRoteiros = Array.isArray(resRoteiros.data)
        ? resRoteiros.data
        : [];
      const listaComStatusExecucao = await aplicarStatusExecucaoRoteiros(
        listaRoteiros,
      );
      setRoteiros(listaComStatusExecucao);
      setTodasLojas(resLojas.data || []);
      setFuncionarios(
        normalizarResponsaveisRoteiro([
          Array.isArray(resFuncionarios.data) ? resFuncionarios.data : [],
          Array.isArray(resUsuarios.data) ? resUsuarios.data : [],
          isAdmin && usuario ? [usuario] : [],
        ]),
      );
      setVeiculos(resVeiculos.data || []);
    } catch (err) {
      setError("Erro ao carregar dados dos roteiros.");
    } finally {
      setLoading(false);
    }
  };

  const handleAtualizarVeiculoRoteiro = async (roteiro, valorSelecionado) => {
    const veiculoId = normalizarIdOpcional(valorSelecionado);
    const veiculoIdAnterior = normalizarIdOpcional(roteiro?.veiculoId);
    const veiculoSelecionado =
      veiculos.find((item) => String(item.id) === String(veiculoId)) || null;

    if (veiculoId === veiculoIdAnterior) return;

    setRoteiros((prev) =>
      prev.map((item) =>
        item.id === roteiro.id
          ? { ...item, veiculoId, veiculo: veiculoSelecionado }
          : item,
      ),
    );

    try {
      await api.patch(`/roteiros/${roteiro.id}`, {
        veiculoId,
      });

      setSuccess(
        veiculoSelecionado
          ? `Veículo ${getVeiculoLabel(veiculoSelecionado)} associado com sucesso.`
          : "Veículo removido do roteiro com sucesso.",
      );
      carregarDadosIniciais();
    } catch (err) {
      setError(
        getMensagemErroVeiculo(err, "Erro ao atualizar veículo do roteiro."),
      );

      setRoteiros((prev) =>
        prev.map((item) =>
          item.id === roteiro.id
            ? {
                ...item,
                veiculoId: veiculoIdAnterior,
                veiculo: roteiro.veiculo || null,
              }
            : item,
        ),
      );
    }
  };

  const usuarioTemPilotagemAtiva = async (
    validarParaTodosPerfis = false,
    roteiroAtual = null,
  ) => {
    if (
      !validarParaTodosPerfis &&
      usuario?.role !== "FUNCIONARIO_TODAS_LOJAS"
    ) {
      return true;
    }

    try {
      const [ultimasMovRes, veiculosRes] = await Promise.all([
        api.get("/movimentacao-veiculos/ultimas"),
        api.get("/veiculos"),
      ]);

      const usuarioId = String(usuario?.id || "").trim();
      const veiculoRoteiroId = String(
        roteiroAtual?.veiculoId || roteiroAtual?.veiculo?.id || "",
      ).trim();

      if (!usuarioId) return false;

      if (veiculoRoteiroId) {
        const kmInicialLocal = obterKmInicialPilotagemAtiva({
          usuarioId,
          veiculoId: veiculoRoteiroId,
        });

        if (Number.isFinite(kmInicialLocal)) {
          return true;
        }
      }

      const veiculosLista = Array.isArray(veiculosRes.data)
        ? veiculosRes.data
        : [];

      const ultimasMovObj = ultimasMovRes.data || {};
      const ultimasMovimentacoes = Array.isArray(ultimasMovObj)
        ? ultimasMovObj
        : Object.values(ultimasMovObj);

      const temRetiradaAtiva = ultimasMovimentacoes.some((mov) => {
        const usuarioMovId = String(
          mov?.usuario?.id || mov?.usuarioId || mov?.funcionarioId || "",
        ).trim();
        const tipoMov = String(mov?.tipo || "").toLowerCase();
        const veiculoId = String(
          mov?.veiculoId || mov?.veiculo?.id || "",
        ).trim();
        const veiculo = veiculosLista.find((v) => String(v.id) === veiculoId);

        return (
          usuarioMovId === usuarioId &&
          tipoMov === "retirada" &&
          (!veiculoRoteiroId || veiculoId === veiculoRoteiroId) &&
          Boolean(veiculo?.emUso)
        );
      });

      // Fallback defensivo para APIs que já expõem vínculo de usuário no veículo.
      const temVinculoDiretoNoVeiculo = veiculosLista.some((veiculo) => {
        const usuarioVeiculoId = String(
          veiculo?.usuario?.id ||
            veiculo?.usuarioId ||
            veiculo?.funcionarioId ||
            veiculo?.condutorId ||
            "",
        ).trim();
        const veiculoId = String(veiculo?.id || "").trim();

        return (
          Boolean(veiculo?.emUso) &&
          usuarioVeiculoId === usuarioId &&
          (!veiculoRoteiroId || veiculoId === veiculoRoteiroId)
        );
      });

      return temRetiradaAtiva || temVinculoDiretoNoVeiculo;
    } catch (err) {
      console.error("Erro ao validar pilotagem ativa:", err);
      setError(
        "Não foi possível validar a pilotagem do veículo. Tente novamente em instantes.",
      );
      return false;
    }
  };

  const iniciarOuContinuarRoteiro = async (roteiro) => {
    setError("");
    setSuccess("");
    setAvisoAndamento(null);

    const roteiroAtual = roteiro || null;

    if (!roteiroAtual?.id) return;

    if (iniciandoRoteiros[roteiroAtual.id]) return;

    if (!usuarioPodeIniciarRoteiro(roteiroAtual)) {
      setError("Esta rota só pode ser iniciada quando estiver pendente.");
      return;
    }

    if (roteiroTemVeiculoAssociado(roteiroAtual)) {
      const podeProsseguir = await usuarioTemPilotagemAtiva(
        false,
        roteiroAtual,
      );

      if (!podeProsseguir) {
        const mensagemBloqueio =
          "Você precisa iniciar a pilotagem de um veículo antes de começar a rota. Você será redirecionado para Veículos.";

        setError(mensagemBloqueio);
        navigate("/veiculos", {
          state: {
            origem: "roteiros",
            retornarPara: "/roteiros",
          },
        });
        return;
      }
    }

    if (isRoteiroEmAndamentoPorOutro(roteiroAtual)) {
      const execucaoSemanal = normalizarExecucaoSemanal(roteiroAtual);
      setAvisoAndamento({
        roteiroId: roteiroAtual.id,
        usuarioNome: execucaoSemanal?.usuarioNome || "outro usuário",
      });
      return;
    }

    if (isRoteiroEmAndamento(roteiroAtual)) {
      navigate(`/roteiros/${roteiroAtual.id}/executar`);
      return;
    }

    if (roteiroTemPontosConcluidos(roteiroAtual)) {
      navigate(`/roteiros/${roteiroAtual.id}/executar`);
      return;
    }

    const funcionarioRoteiroId = normalizarIdOpcional(
      roteiroAtual?.funcionarioId,
    );
    const funcionarioRoteiroNome = String(
      roteiroAtual?.funcionarioNome || "",
    ).trim();

    if (!funcionarioRoteiroId) {
      setError("Atribua um funcionário ativo ao roteiro antes de iniciar.");
      return;
    }

    const payload = {
      veiculoId: normalizarIdOpcional(roteiroAtual?.veiculoId),
      funcionarioId: funcionarioRoteiroId,
      funcionarioNome: funcionarioRoteiroNome,
    };

    if (roteiroTemVeiculoAssociado(roteiroAtual)) {
      const kmDigitado = getKmInicialInputRoteiro(roteiroAtual);
      const kmValidado = parseKmInteiroNaoNegativo(kmDigitado);

      if (!kmValidado.ok) {
        setError(
          "Informe um KM inicial do veículo válido (inteiro maior ou igual a zero).",
        );
        return;
      }

      payload.kmInicialVeiculo = kmValidado.numero;
    }

    try {
      setIniciandoRoteiros((prev) => ({ ...prev, [roteiroAtual.id]: true }));

      await api.post(`/roteiros/${roteiroAtual.id}/iniciar`, payload);

      navigate(`/roteiros/${roteiroAtual.id}/executar`);
    } catch (err) {
      const status = err?.response?.status;
      const mensagemApi = err?.response?.data?.error;
      const statusRota = String(err?.response?.data?.statusRota || "")
        .trim()
        .toLowerCase();

      if (status === 409 && statusRota === "em_uso_por_outro_usuario") {
        setError("Esta rota já está em uso por outro usuário.");
        return;
      }

      if (status === 409 && statusRota === "finalizado_ate_reset") {
        setError(
          "Esta rota já foi finalizada e só pode ser iniciada novamente após o reset semanal.",
        );
        return;
      }

      if (status === 403 && statusRota === "em_andamento_por_outro") {
        const usuarioNome =
          String(err?.response?.data?.usuarioAssociadoNome || "").trim() ||
          String(err?.response?.data?.usuarioAssociado || "").trim() ||
          "outro usuário";
        setAvisoAndamento({
          roteiroId: roteiroAtual.id,
          usuarioNome,
        });
        return;
      }

      if (status === 400) {
        setError(mensagemApi || "KM inicial inválido para iniciar a rota.");
      } else if (status === 403) {
        setError("Você não tem permissão para esta ação.");
      } else if (status === 404) {
        setError("Roteiro ou veículo não encontrado.");
      } else if (status === 500) {
        setError("Erro interno. Tente novamente.");
      } else {
        setError(mensagemApi || "Erro ao iniciar rota.");
      }
    } finally {
      setIniciandoRoteiros((prev) => ({ ...prev, [roteiroAtual.id]: false }));
    }
  };

  const exigirFinalizarPilotagemAntesDaRota = async (roteiroId) => {
    const roteiroAtual = getRoteiroById(roteiroId);
    if (!roteiroTemVeiculoAssociado(roteiroAtual)) {
      return true;
    }

    const temPilotagemAtiva = await usuarioTemPilotagemAtiva(
      true,
      roteiroAtual,
    );
    if (!temPilotagemAtiva) return true;

    const mensagemBloqueio =
      "Para finalizar a rota, finalize primeiro a pilotagem do veículo. Você será redirecionado para Veículos.";

    setError(mensagemBloqueio);
    navigate("/veiculos", {
      state: {
        origem: "roteiros-finalizacao",
        retornarPara: "/roteiros",
        roteiroIdParaFinalizar: roteiroId,
        alertaFinalizarVeiculo: mensagemBloqueio,
        alertaFinalizarVeiculoToken: `${Date.now()}-${roteiroId}`,
      },
    });

    return false;
  };

  // --- AÇÕES ---
  const handleCriarRoteiro = async () => {
    try {
      const observacaoNormalizada = novaObservacaoRoteiro.trim();
      const veiculoId = normalizarIdOpcional(novoVeiculoId);
      const payload = {
        nome: novoNomeRoteiro,
        diasSemana: novosDiasRoteiro,
        veiculoId,
      };

      // Observação é opcional na criação: só envia se houver texto.
      if (observacaoNormalizada) {
        payload.observacao = observacaoNormalizada;
      }

      await api.post("/roteiros", payload);
      setNovoNomeRoteiro("");
      setNovoVeiculoId("");
      setNovosDiasRoteiro([]);
      setNovaObservacaoRoteiro("");
      setShowModalCriarRoteiro(false);
      setSuccess("Roteiro criado com sucesso!");
      carregarDadosIniciais();
    } catch (err) {
      setError(getMensagemErroVeiculo(err, "Erro ao criar roteiro."));
    }
  };

  const handleExcluirRoteiro = async (roteiro) => {
    const confirmar = window.confirm(
      `Deseja realmente apagar o roteiro "${roteiro.nome}"? Essa ação não pode ser desfeita.`,
    );

    if (!confirmar) return;

    try {
      setError("");
      setSuccess("");
      setApagandoRoteiros((prev) => ({ ...prev, [roteiro.id]: true }));

      const response = await api.delete(`/roteiros/${roteiro.id}`);
      const mensagem =
        response?.data?.message ||
        response?.data?.mensagem ||
        "Roteiro apagado com sucesso.";

      setRoteiros((prev) => prev.filter((r) => r.id !== roteiro.id));
      setSuccess(mensagem);
    } catch (err) {
      const status = err?.response?.status;
      const mensagemBackend = err?.response?.data?.error;

      if (status === 401) {
        setError("Sessão expirada. Faça login novamente.");
      } else if (status === 403) {
        setError("Você não tem permissão para apagar roteiros.");
      } else if (status === 404) {
        setError("Roteiro não encontrado. A lista foi atualizada.");
        setRoteiros((prev) => prev.filter((r) => r.id !== roteiro.id));
      } else if (status === 500) {
        setError(mensagemBackend || "Erro ao apagar roteiro.");
      } else {
        setError(mensagemBackend || "Não foi possível apagar o roteiro.");
      }
    } finally {
      setApagandoRoteiros((prev) => ({ ...prev, [roteiro.id]: false }));
    }
  };

  const handleMoverLoja = async (lojaId, origemId, destinoId) => {
    const roteiroOrigem = origemId ? getRoteiroById(origemId) : null;
    const roteiroDestino = getRoteiroById(destinoId);

    if (
      isRoteiroFinalizado(roteiroOrigem) ||
      isRoteiroFinalizado(roteiroDestino)
    ) {
      setError(
        "Roteiro finalizado não permite adicionar, remover ou mover pontos.",
      );
      return;
    }

    try {
      await api.post("/roteiros/mover-loja", {
        lojaId,
        roteiroOrigemId: origemId,
        roteiroDestinoId: destinoId,
      });
      carregarDadosIniciais();
    } catch (err) {
      setError("Erro ao mover ponto.");
    }
  };

  const handleReordenarLoja = async (roteiroId, lojaId, novaOrdem) => {
    const roteiro = getRoteiroById(roteiroId);
    if (isRoteiroFinalizado(roteiro)) {
      setError("Roteiro finalizado não permite reordenar pontos.");
      return;
    }

    try {
      await api.patch(`/roteiros/${roteiroId}/reordenar-loja`, {
        lojaId,
        novaOrdem,
      });
      carregarDadosIniciais();
    } catch (err) {
      setError("Erro ao reordenar ponto.");
    }
  };

  const handleRemoverPontoDoRoteiro = async (roteiro, loja) => {
    if (isRoteiroFinalizado(roteiro)) {
      setError("Roteiro finalizado não permite remover pontos.");
      return;
    }

    const primeiraConfirmacao = await Swal.fire({
      icon: "warning",
      title: "Remover ponto do roteiro?",
      html: `Deseja remover <b>${loja.nome}</b> deste roteiro?`,
      showCancelButton: true,
      confirmButtonText: "Sim, remover",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#dc2626",
    });
    if (!primeiraConfirmacao.isConfirmed) return;

    const segundaConfirmacao = await Swal.fire({
      icon: "error",
      title: "Confirmar remoção",
      html: `Essa ação não pode ser desfeita.<br/>Confirma a remoção de <b>${loja.nome}</b>?`,
      showCancelButton: true,
      confirmButtonText: "Sim, tenho certeza",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#dc2626",
    });
    if (!segundaConfirmacao.isConfirmed) return;

    try {
      await api.delete(`/roteiros/${roteiro.id}/lojas/${loja.id}`);
      setSuccess("Ponto removido do roteiro com sucesso.");
      carregarDadosIniciais();
    } catch (err) {
      const mensagemBackend = err?.response?.data?.error;
      setError(mensagemBackend || "Erro ao remover ponto do roteiro.");
    }
  };

  const handleDesfinalizarRoteiro = async (roteiro) => {
    if (!roteiro?.id || desfinalizandoRoteiros[roteiro.id]) return;

    const confirmar = window.confirm(
      "Tem certeza que deseja desfinalizar este roteiro? Ele voltará para pendente.",
    );

    if (!confirmar) return;

    try {
      setError("");
      setSuccess("");
      setDesfinalizandoRoteiros((prev) => ({ ...prev, [roteiro.id]: true }));

      const response = await api.post(`/roteiros/${roteiro.id}/desfinalizar`);

      setRoteiros((prev) =>
        prev.map((item) =>
          item.id === roteiro.id
            ? {
                ...item,
                status: String(response?.data?.status || "pendente")
                  .trim()
                  .toLowerCase(),
              }
            : item,
        ),
      );

      setSuccess(
        response?.data?.message || "Roteiro desfinalizado com sucesso.",
      );
      carregarDadosIniciais();
    } catch (err) {
      const status = err?.response?.status;

      if (status === 401) {
        setError("Sessão expirada. Faça login novamente.");
      } else if (status === 403) {
        setError("Você não tem permissão para desfinalizar este roteiro.");
      } else if (status === 404) {
        setError("Roteiro não encontrado.");
      } else if (status === 409) {
        setError("Este roteiro não está finalizado hoje.");
      } else if (status === 500) {
        setError("Erro ao desfinalizar roteiro. Tente novamente.");
      } else {
        setError(
          err?.response?.data?.error ||
            "Erro ao desfinalizar roteiro. Tente novamente.",
        );
      }
    } finally {
      setDesfinalizandoRoteiros((prev) => ({ ...prev, [roteiro.id]: false }));
    }
  };

  const executarFinalizacaoRoteiro = async () => {
    const roteiro = modalFinalizar.roteiro;
    if (!roteiro) return;

    const podeFinalizar = await exigirFinalizarPilotagemAntesDaRota(roteiro.id);
    if (!podeFinalizar) {
      setModalFinalizar({
        aberto: false,
        etapa: 1,
        roteiro: null,
        loading: false,
      });
      return;
    }

    const obterMensagemResumoWhatsappBackend = async (
      roteiroId,
      finalizacaoData,
    ) => {
      const mensagemDireta = String(
        finalizacaoData?.mensagemResumoWhatsapp || "",
      ).trim();
      if (mensagemDireta) {
        return filtrarMensagemFinalizacaoRoteiroManutencoesPorPeriodo({
          mensagem: mensagemDireta,
          finalizacaoData,
          roteiro,
        });
      }

      const hoje = new Date().toISOString().slice(0, 10);
      const resumoRes = await api.get(`/roteiros/${roteiroId}/resumo-execucao`, {
        params: { data: hoje },
      });

      const mensagemResumo = String(
        resumoRes?.data?.mensagemResumoWhatsapp || "",
      ).trim();
      return filtrarMensagemFinalizacaoRoteiroManutencoesPorPeriodo({
        mensagem: mensagemResumo,
        finalizacaoData: resumoRes?.data,
        roteiro,
      });
    };

    const popupReservado = window.open("about:blank", "_blank");

    try {
      setError("");
      setSuccess("");
      setModalFinalizar((prev) => ({ ...prev, loading: true }));

      const res = await api.post(`/roteiros/${roteiro.id}/finalizar`);
      const pendencias = res?.data?.pendencias || [];

      if (pendencias.length > 0) {
        const nomesPendentes = pendencias
          .map((item) => item.maquinaNome)
          .slice(0, 4)
          .join(", ");
        const sufixoMais =
          pendencias.length > 4 ? ` e mais ${pendencias.length - 4}` : "";
        setSuccess(
          `Roteiro finalizado com pendências: ${nomesPendentes}${sufixoMais}. Alerta WhatsApp: ${res?.data?.alertaWhatsApp?.status || "não enviado"}.`,
        );
      } else {
        setSuccess("Roteiro finalizado com sucesso!");
      }

      const mensagemWhatsApp = await obterMensagemResumoWhatsappBackend(
        roteiro.id,
        res?.data,
      );
      const abriuWhatsApp = abrirWhatsAppComMensagem(
        mensagemWhatsApp,
        popupReservado,
      );
      if (!abriuWhatsApp) {
        setSuccess(
          "Roteiro finalizado, mas o navegador bloqueou a abertura do WhatsApp. Libere pop-up para o StarBox.",
        );
      }

      setModalFinalizar({
        aberto: false,
        etapa: 1,
        roteiro: null,
        loading: false,
      });
      carregarDadosIniciais();
    } catch (err) {
      if (popupReservado && !popupReservado.closed) {
        popupReservado.close();
      }
      setError(err?.response?.data?.error || "Erro ao finalizar roteiro.");
      setModalFinalizar((prev) => ({ ...prev, loading: false }));
    }
  };

  const abrirModalFinalizacao = async (roteiro) => {
    const podeFinalizar = await exigirFinalizarPilotagemAntesDaRota(roteiro.id);
    if (!podeFinalizar) return;

    setModalFinalizar({
      aberto: true,
      etapa: 1,
      roteiro,
      loading: false,
    });
  };

  const fecharModalFinalizacao = () => {
    if (modalFinalizar.loading) return;
    setModalFinalizar({
      aberto: false,
      etapa: 1,
      roteiro: null,
      loading: false,
    });
  };

  const avancarConfirmacaoFinalizacao = () => {
    setModalFinalizar((prev) => ({ ...prev, etapa: 2 }));
  };

  // --- DRAG AND DROP HANDLERS ---
  const onDragStart = (loja, roteiroId) => {
    if (!isGestorRoteiro) return;
    const roteiroOrigem = getRoteiroById(roteiroId);
    if (isRoteiroFinalizado(roteiroOrigem)) return;

    setDraggedLoja(loja);
    setDraggedFromRoteiro(roteiroId);
  };

  const onDragOver = (e, index, roteiroDestinoId) => {
    const roteiroOrigem = getRoteiroById(draggedFromRoteiro);
    const roteiroDestino = getRoteiroById(roteiroDestinoId);

    if (
      !isGestorRoteiro ||
      !draggedLoja ||
      isRoteiroFinalizado(roteiroOrigem) ||
      isRoteiroFinalizado(roteiroDestino)
    ) {
      return;
    }

    e.preventDefault();
    atualizarAutoScrollDrag(e.clientY);
    setDraggedOverIndex(index);
  };

  const onDragLeave = () => {
    setDraggedOverIndex(null);
  };

  const onDrop = (e, roteiroDestinoId, dropIndex = null) => {
    e.preventDefault();
    pararAutoScrollDrag();
    setDraggedOverIndex(null);

    if (!isGestorRoteiro) return;

    if (!draggedLoja) return;

    const roteiroOrigem = getRoteiroById(draggedFromRoteiro);
    const roteiroDestino = getRoteiroById(roteiroDestinoId);

    if (
      isRoteiroFinalizado(roteiroOrigem) ||
      isRoteiroFinalizado(roteiroDestino)
    ) {
      setError(
        "Roteiro finalizado não permite adicionar, remover ou mover pontos.",
      );
      setDraggedLoja(null);
      setDraggedFromRoteiro(null);
      return;
    }

    // Se é o mesmo roteiro, reordenar
    if (draggedFromRoteiro === roteiroDestinoId && dropIndex !== null) {
      handleReordenarLoja(roteiroDestinoId, draggedLoja.id, dropIndex);
    }
    // Se é roteiro diferente, mover
    else if (draggedFromRoteiro !== roteiroDestinoId) {
      handleMoverLoja(draggedLoja.id, draggedFromRoteiro, roteiroDestinoId);
    }

    setDraggedLoja(null);
    setDraggedFromRoteiro(null);
  };

  const onDragEnd = () => {
    pararAutoScrollDrag();
    setDraggedOverIndex(null);
    setDraggedLoja(null);
    setDraggedFromRoteiro(null);
  };

  if (loading)
    return (
      <div className="p-20 text-center font-bold">Carregando roteiros...</div>
    );

  return (
    <div className="min-h-screen bg-gray-100 text-[#24094E]">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">🗺️ Gestão de Rotas</h1>
          {isGestorRoteiro && (
            <button
              onClick={() => setShowModalCriarRoteiro(true)}
              className="bg-green-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-green-700 transition-shadow shadow-md"
            >
              + Nova Rota
            </button>
          )}
        </div>

        <div className="mb-6">
          <label className="block text-sm font-bold text-gray-700 mb-2">
            Buscar rota por nome
          </label>
          <input
            type="text"
            value={filtroNomeRoteiro}
            onChange={(e) => setFiltroNomeRoteiro(e.target.value)}
            placeholder="Digite o nome do roteiro..."
            className="w-full max-w-md p-3 border rounded-xl bg-white focus:ring-2 focus:ring-[#24094E] outline-none"
          />
        </div>

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
        {avisoAndamento && (
          <div className="alert alert-warning">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold">
                  Este roteiro está em andamento por {avisoAndamento.usuarioNome}.
                </p>
                <p className="text-xs">
                  Clique em "Ver andamento" para visualizar em modo leitura.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => abrirAndamentoRoteiro(avisoAndamento.roteiroId)}
                >
                  Ver andamento
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => setAvisoAndamento(null)}
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Funcionários veem só os roteiros atribuídos a eles */}
        {!isGestorRoteiro && roteirosDoUsuario.length === 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center text-yellow-700 font-medium mb-6">
            Nenhuma rota atribuída a você no momento.
          </div>
        )}

        {roteirosDoUsuario.length > 0 && roteirosFiltrados.length === 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-6 text-center text-gray-600 font-medium mb-6">
            Nenhuma rota encontrada com esse nome.
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {roteirosFiltrados.map((roteiro) => (
            (() => {
              const roteiroEstaFinalizado = isRoteiroStatusFinalizado(roteiro);
              const execucaoSemanal = normalizarExecucaoSemanal(roteiro);
              const execucaoEmAndamento =
                Boolean(execucaoSemanal?.emAndamento) ||
                isRoteiroEmAndamento(roteiro);
              const usuarioAssociadoId = String(
                execucaoSemanal?.usuarioId || "",
              ).trim();
              const usuarioAtualId = String(usuario?.id || "").trim();
              const execucaoPertenceOutroUsuario =
                execucaoEmAndamento &&
                usuarioAssociadoId &&
                usuarioAtualId &&
                usuarioAssociadoId !== usuarioAtualId;
              const andamentoPorOutroUsuario =
                execucaoPertenceOutroUsuario && !isAdmin;
              const nomeResponsavel =
                execucaoSemanal?.usuarioNome || "outro usuário";

              const podeIniciarRoteiro = usuarioPodeIniciarRoteiro(roteiro);

              return (
            <div
              key={roteiro.id}
              onDragOver={(e) => {
                if (!isGestorRoteiro || isRoteiroFinalizado(roteiro)) return;
                e.preventDefault();
              }}
              onDrop={(e) => {
                if (!isGestorRoteiro || isRoteiroFinalizado(roteiro)) return;
                onDrop(e, roteiro.id);
              }}
              className={`rounded-xl shadow-lg p-6 border-2 transition-all 
                ${roteiroEstaFinalizado ? "bg-green-50 border-green-600" : "bg-white border-transparent"}
                ${draggedLoja && draggedFromRoteiro !== roteiro.id && !isRoteiroFinalizado(roteiro) ? "border-blue-400 border-dashed bg-blue-50" : ""}
              `}
            >
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-extrabold flex items-center gap-2 flex-wrap">
                  {roteiro.nome}
                  {roteiroEstaFinalizado && (
                    <span className="ml-2 px-2 py-1 rounded-full bg-green-200 text-green-800 text-xs font-bold uppercase">
                      Finalizado
                    </span>
                  )}
                  {execucaoEmAndamento && !roteiroEstaFinalizado && (
                    <span
                      className={`ml-2 px-2 py-1 rounded-full text-xs font-bold uppercase ${
                        andamentoPorOutroUsuario
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {execucaoPertenceOutroUsuario
                        ? `Em andamento por ${nomeResponsavel}`
                        : "Seu roteiro em andamento"}
                    </span>
                  )}
                </h2>
                <span
                  className={`text-[10px] px-2 py-1 rounded-full font-bold uppercase ${isRoteiroEmAndamento(roteiro) || roteiroTemPontosConcluidos(roteiro) ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-500"}`}
                >
                  {isRoteiroEmAndamento(roteiro) || roteiroTemPontosConcluidos(roteiro)
                    ? "Ativo"
                    : "Pendente"}
                </span>
              </div>

              {!roteiroEhDeAbastecedor(roteiro) && (
                <p className="text-xs text-gray-500 mb-3">
                  🚗 {getVeiculoResumoRoteiro(roteiro)}
                </p>
              )}

              {/* Seção de Funcionário */}
              <div className="mb-4">
                <label className="text-xs font-bold text-gray-400 block mb-1">
                  RESPONSÁVEL
                </label>
                {isGestorRoteiro ? (
                  <select
                    className="w-full p-2 text-sm border rounded bg-gray-50"
                    value={String(roteiro.funcionarioId || "")}
                    onChange={async (e) => {
                      const rawId = e.target.value;
                      // IDs são UUID — não converter para número
                      const funcionarioId = normalizarIdOpcional(rawId);
                      const veiculoId = normalizarIdOpcional(roteiro.veiculoId);
                      const f = funcionarios.find(
                        (x) => String(x.id) === rawId,
                      );
                      const funcionarioNome = f?.nome || "";

                      // Atualização optimista para não flickar o select
                      setRoteiros((prev) =>
                        prev.map((r) =>
                          r.id === roteiro.id
                            ? { ...r, funcionarioId, funcionarioNome }
                            : r,
                        ),
                      );

                      try {
                        await api.patch(`/roteiros/${roteiro.id}`, {
                          funcionarioId,
                          funcionarioNome,
                          veiculoId,
                        });
                        setSuccess(
                          `Responsável ${funcionarioNome || "removido"} atribuído com sucesso.`,
                        );
                        // Recarregar dados do backend para garantir persistência
                        carregarDadosIniciais();
                      } catch (err) {
                        setError(
                          getMensagemErroVeiculo(
                            err,
                            "Erro ao atribuir responsável ao roteiro.",
                          ),
                        );
                        // Reverter se falhou
                        setRoteiros((prev) =>
                          prev.map((r) =>
                            r.id === roteiro.id
                              ? {
                                  ...r,
                                  funcionarioId: roteiro.funcionarioId,
                                  funcionarioNome: roteiro.funcionarioNome,
                                }
                              : r,
                          ),
                        );
                      }
                    }}
                  >
                    <option value="">Selecione um responsável</option>
                    {funcionarios.map((f) => (
                      <option key={f.id} value={String(f.id)}>
                        {obterLabelResponsavelRoteiro(f)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-sm font-medium">
                    {roteiro.funcionarioNome || "Não atribuído"}
                  </p>
                )}
              </div>

              {/* Seção de Veículo */}
              {!roteiroEhDeAbastecedor(roteiro) && (
                <div className="mb-4">
                  <label className="text-xs font-bold text-gray-400 block mb-1">
                    VEÍCULO
                  </label>
                  {isGestorRoteiro ? (
                    <select
                      className="w-full p-2 text-sm border rounded bg-gray-50"
                      value={String(roteiro.veiculoId || "")}
                      onChange={(e) =>
                        handleAtualizarVeiculoRoteiro(roteiro, e.target.value)
                      }
                    >
                      <option value="">Sem veículo</option>
                      {veiculos.map((veiculo) => (
                        <option key={veiculo.id} value={String(veiculo.id)}>
                          {getVeiculoLabel(veiculo)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-sm font-medium">
                      {getVeiculoResumoRoteiro(roteiro)}
                    </p>
                  )}
                </div>
              )}

              {/* Seção Dias da Semana */}
              <div className="mb-4">
                <label className="text-xs font-bold text-gray-400 block mb-2">
                  DIAS DA SEMANA
                </label>
                <div className="flex flex-wrap gap-1">
                  {DIAS_SEMANA.map(({ label, full }) => {
                    const selecionado = getDiasRoteiro(roteiro).includes(label);
                    return (
                      <button
                        key={label}
                        title={full}
                        disabled={!isGestorRoteiro}
                        onClick={() => toggleDia(roteiro.id, label)}
                        className={`px-2 py-1 rounded-md text-[11px] font-bold transition-colors border
                          ${
                            selecionado
                              ? "bg-[#24094E] text-white border-[#24094E]"
                              : "bg-gray-100 text-gray-400 border-gray-200 hover:border-[#24094E] hover:text-[#24094E]"
                          }
                          ${!isGestorRoteiro ? "cursor-default opacity-70" : "cursor-pointer"}`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                {isGestorRoteiro && diasPendentes[roteiro.id] !== undefined && (
                  <button
                    onClick={() => salvarDias(roteiro.id)}
                    disabled={salvandoDias[roteiro.id]}
                    className="mt-2 w-full py-1 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 disabled:opacity-60 transition-colors"
                  >
                    {salvandoDias[roteiro.id] ? "Salvando..." : "Salvar dias"}
                  </button>
                )}
              </div>

              {/* Seção Orçamento Semanal */}
              <div className="mb-4">
                <label className="text-xs font-bold text-gray-400 block mb-2">
                  ORÇAMENTO SEMANAL
                </label>
                {isGestorRoteiro ? (
                  <>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="w-full p-2 text-sm border rounded bg-gray-50"
                        value={getOrcamentoRoteiro(roteiro)}
                        onChange={(e) =>
                          handleOrcamentoChange(roteiro.id, e.target.value)
                        }
                      />
                      {orcamentosPendentes[roteiro.id] !== undefined && (
                        <button
                          onClick={() => salvarOrcamentoSemanal(roteiro.id)}
                          disabled={salvandoOrcamento[roteiro.id]}
                          className="whitespace-nowrap py-2 px-3 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 disabled:opacity-60 transition-colors"
                        >
                          {salvandoOrcamento[roteiro.id]
                            ? "Salvando..."
                            : "Salvar orçamento"}
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1">
                      Valor padrão: {formatarMoedaBRL(ORCAMENTO_SEMANAL_PADRAO)}
                    </p>
                  </>
                ) : (
                  <p className="text-sm font-semibold text-green-700">
                    {formatarMoedaBRL(getOrcamentoNumericoRoteiro(roteiro))}
                  </p>
                )}
              </div>

              {/* Seção de Observação */}
              <div className="mb-4">
                <label className="text-xs font-bold text-gray-400 block mb-2">
                  OBSERVAÇÃO DO ROTEIRO
                </label>
                {isGestorRoteiro ? (
                  <>
                    <textarea
                      name="observacao"
                      rows="3"
                      className="w-full p-2 text-sm border rounded bg-gray-50 resize-y focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="Ex: conferir máquina M003, levar peças de reposição..."
                      value={getObservacaoRoteiro(roteiro)}
                      onChange={(e) =>
                        handleObservacaoChange(roteiro.id, e.target.value)
                      }
                    />
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="text-[11px] text-gray-500">
                        {getObservacaoRoteiro(roteiro).length}/
                        {LIMITE_OBSERVACAO_ROTEIRO}
                      </span>
                      {observacoesPendentes[roteiro.id] !== undefined && (
                        <button
                          onClick={() => salvarObservacao(roteiro.id)}
                          disabled={salvandoObservacao[roteiro.id]}
                          className="py-1 px-3 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 disabled:opacity-60 transition-colors"
                        >
                          {salvandoObservacao[roteiro.id]
                            ? "Salvando..."
                            : "Salvar observação"}
                        </button>
                      )}
                    </div>
                  </>
                ) : roteiro.observacao?.trim() ? (
                  <p className="text-sm whitespace-pre-wrap bg-gray-50 border border-gray-200 rounded-lg p-3">
                    {roteiro.observacao}
                  </p>
                ) : (
                  <p className="text-xs text-gray-400 italic">
                    Sem observação cadastrada.
                  </p>
                )}
              </div>

              {/* Lista de Pontos */}
              <div className="mb-6">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-gray-400">
                    PONTOS NO DIA
                  </span>
                  {isGestorRoteiro && !isRoteiroFinalizado(roteiro) && (
                    <button
                      onClick={() => {
                        setRoteiroParaAdicionar(roteiro);
                        setFiltroLojaAdicionar("");
                        setShowModalAdicionarLoja(true);
                      }}
                      className="text-blue-600 text-xs font-bold hover:underline"
                    >
                      + Adicionar
                    </button>
                  )}
                </div>
                <div className="min-h-30 bg-gray-50 rounded-lg p-3 border border-gray-100">
                  {roteiro.lojas?.length > 0 ? (
                    (() => {
                      const lojasOrdenadas = [...roteiro.lojas].sort(
                        (a, b) => (a.ordem || 0) - (b.ordem || 0),
                      );
                      const expandida = listaLojasExpandida(roteiro.id);
                      const lojasVisiveis = expandida
                        ? lojasOrdenadas
                        : lojasOrdenadas.slice(0, LIMITE_LOJAS_VISIVEIS_CARD);

                      return (
                        <>
                          {lojasVisiveis.map((loja, index) => (
                            <div
                              key={loja.id}
                              draggable={
                                isGestorRoteiro && !isRoteiroFinalizado(roteiro)
                              }
                              onDragStart={() => onDragStart(loja, roteiro.id)}
                              onDrag={(e) => atualizarAutoScrollDrag(e.clientY)}
                              onDragEnd={onDragEnd}
                              onDragOver={(e) =>
                                onDragOver(e, index, roteiro.id)
                              }
                              onDragLeave={onDragLeave}
                              onDrop={(e) => onDrop(e, roteiro.id, index)}
                              className={`bg-white p-3 rounded-md border shadow-sm mb-2 text-sm flex items-center gap-2 transition-colors
                                ${isGestorRoteiro && !isRoteiroFinalizado(roteiro) ? "cursor-move hover:border-blue-300" : ""}
                                ${draggedOverIndex === index && draggedFromRoteiro === roteiro.id ? "border-blue-500 border-2 bg-blue-50" : "border-gray-200"}
                              `}
                            >
                              <span className="text-gray-400">☰</span>
                              <span className="bg-[#24094E] text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                                {index + 1}
                              </span>
                              <span className="flex-1">🏪 {loja.nome}</span>
                              {isGestorRoteiro && !isRoteiroFinalizado(roteiro) && (
                                <button
                                  type="button"
                                  draggable={false}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoverPontoDoRoteiro(roteiro, loja);
                                  }}
                                  title="Remover ponto do roteiro"
                                  className="text-red-500 hover:text-red-700 hover:bg-red-50 rounded-full w-6 h-6 flex items-center justify-center shrink-0"
                                >
                                  🗑️
                                </button>
                              )}
                            </div>
                          ))}

                          {lojasOrdenadas.length > LIMITE_LOJAS_VISIVEIS_CARD && (
                            <button
                              type="button"
                              onClick={() =>
                                toggleExpandirLojasDoRoteiro(roteiro.id)
                              }
                              className="w-full mt-1 py-2 rounded-md border border-blue-200 text-blue-700 text-xs font-bold hover:bg-blue-50 transition-colors"
                            >
                              {expandida
                                ? "Ver menos"
                                : `Ver mais ${lojasOrdenadas.length - LIMITE_LOJAS_VISIVEIS_CARD} ponto(s)`}
                            </button>
                          )}
                        </>
                      );
                    })()
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 opacity-30">
                      <span className="text-2xl">📦</span>
                      <p className="text-[10px] font-bold">VAZIO</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Botões de Ação com lógica dinâmica */}
              <div className="flex flex-wrap gap-2 mt-auto">
                {!roteiroEstaFinalizado ? (
                  <>
                    {roteiroTemVeiculoAssociado(roteiro) &&
                      podeIniciarRoteiro && (
                        <div className="w-full">
                          <label className="text-[11px] font-bold text-gray-500 block mb-1">
                            KM INICIAL DO VEÍCULO
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            inputMode="numeric"
                            value={getKmInicialInputRoteiro(roteiro)}
                            onChange={(e) =>
                              setKmInicialVeiculoPorRoteiro((prev) => ({
                                ...prev,
                                [roteiro.id]: e.target.value,
                              }))
                            }
                            className="w-full p-2 text-sm border rounded bg-gray-50 focus:ring-2 focus:ring-[#24094E] outline-none"
                            placeholder="Ex: 12345"
                          />
                          <p className="text-[11px] text-gray-500 mt-1">
                            Pré-preenchido com o KM inicial da pilotagem ativa do veículo associado.
                          </p>
                        </div>
                      )}
                    <button
                      onClick={() =>
                        andamentoPorOutroUsuario
                          ? abrirAndamentoRoteiro(roteiro.id)
                          : podeIniciarRoteiro
                            ? iniciarOuContinuarRoteiro(roteiro)
                            : navigate(`/roteiros/${roteiro.id}/executar`)
                      }
                      disabled={
                        Boolean(iniciandoRoteiros[roteiro.id]) ||
                        (!podeIniciarRoteiro &&
                          !andamentoPorOutroUsuario &&
                          !isRoteiroEmAndamento(roteiro) &&
                          !roteiroTemPontosConcluidos(roteiro))
                      }
                      className="flex-1 min-w-35 bg-[#24094E] text-white py-2 rounded-lg font-bold text-sm hover:bg-black transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {iniciandoRoteiros[roteiro.id]
                        ? "Iniciando..."
                        : podeIniciarRoteiro
                          ? "Iniciar rota"
                        : andamentoPorOutroUsuario
                          ? "Ver andamento"
                          : isRoteiroEmAndamento(roteiro) ||
                              roteiroTemPontosConcluidos(roteiro)
                            ? "Continuar rota"
                            : "Começar Rota"}
                    </button>
                    {roteiro.funcionarioId && !roteiroEhDeAbastecedor(roteiro) && (
                      <button
                        onClick={() => abrirModalFinalizacao(roteiro)}
                        disabled={
                          Boolean(desfinalizandoRoteiros[roteiro.id]) ||
                          andamentoPorOutroUsuario
                        }
                        title={
                          andamentoPorOutroUsuario
                            ? "Roteiro em andamento por outro usuário."
                            : ""
                        }
                        className="bg-green-600 text-white py-2 px-3 rounded-lg font-bold text-sm hover:bg-green-700 transition-colors"
                      >
                        Finalizar
                      </button>
                    )}
                    {isGestorRoteiro && (
                      <button
                        onClick={() => handleExcluirRoteiro(roteiro)}
                        disabled={Boolean(apagandoRoteiros[roteiro.id])}
                        className="bg-red-600 text-white py-2 px-3 rounded-lg font-bold text-sm hover:bg-red-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {apagandoRoteiros[roteiro.id]
                          ? "Apagando..."
                          : "Apagar"}
                      </button>
                    )}
                  </>
                ) : isRoteiroFinalizado(roteiro) ? (
                  <>
                    <button
                      onClick={() =>
                        navigate(`/roteiros/${roteiro.id}/executar`)
                      }
                      className="flex-1 min-w-35 bg-green-600 text-white py-2 rounded-lg font-bold text-sm hover:bg-green-700 transition-colors"
                    >
                      Abrir Rota
                    </button>
                    {!roteiroEhDeAbastecedor(roteiro) && (
                      <button
                        onClick={() => handleDesfinalizarRoteiro(roteiro)}
                        disabled={Boolean(desfinalizandoRoteiros[roteiro.id])}
                        className="bg-yellow-500 text-white py-2 px-3 rounded-lg font-bold text-sm hover:bg-yellow-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {desfinalizandoRoteiros[roteiro.id]
                          ? "Desfinalizando..."
                          : "Desfinalizar"}
                      </button>
                    )}
                    {isGestorRoteiro && (
                      <button
                        onClick={() => handleExcluirRoteiro(roteiro)}
                        disabled={Boolean(apagandoRoteiros[roteiro.id])}
                        className="bg-red-600 text-white py-2 px-3 rounded-lg font-bold text-sm hover:bg-red-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {apagandoRoteiros[roteiro.id]
                          ? "Apagando..."
                          : "Apagar"}
                      </button>
                    )}
                  </>
                ) : null}
              </div>
            </div>
              );
            })()
          ))}
        </div>
      </main>

      {/* MODAL CRIAR ROTEIRO */}
      {showModalCriarRoteiro && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h2 className="text-xl font-bold mb-4">Criar Novo Roteiro</h2>
            <input
              autoFocus
              className="w-full p-3 border rounded-xl mb-4 focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Ex: Roteiro Norte - Seg"
              value={novoNomeRoteiro}
              onChange={(e) => setNovoNomeRoteiro(e.target.value)}
            />
            <label className="text-xs font-bold text-gray-400 block mb-2">
              DIAS DA SEMANA
            </label>
            <div className="flex flex-wrap gap-2 mb-5">
              {DIAS_SEMANA.map(({ label, full }) => {
                const selecionado = novosDiasRoteiro.includes(label);
                return (
                  <button
                    key={label}
                    title={full}
                    type="button"
                    onClick={() =>
                      setNovosDiasRoteiro((prev) =>
                        prev.includes(label)
                          ? prev.filter((d) => d !== label)
                          : [...prev, label],
                      )
                    }
                    className={`px-3 py-1.5 rounded-lg text-sm font-bold border transition-colors
                      ${
                        selecionado
                          ? "bg-[#24094E] text-white border-[#24094E]"
                          : "bg-gray-100 text-gray-500 border-gray-200 hover:border-[#24094E] hover:text-[#24094E]"
                      }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <label className="text-xs font-bold text-gray-400 block mb-2">
              VEÍCULO (OPCIONAL)
            </label>
            <select
              className="w-full p-3 border rounded-xl mb-4 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
              value={novoVeiculoId}
              onChange={(e) => setNovoVeiculoId(e.target.value)}
            >
              <option value="">Sem veículo</option>
              {veiculos.map((veiculo) => (
                <option key={veiculo.id} value={String(veiculo.id)}>
                  {getVeiculoLabel(veiculo)}
                </option>
              ))}
            </select>
            <label className="text-xs font-bold text-gray-400 block mb-2">
              Observação do roteiro (opcional)
            </label>
            <textarea
              name="observacao"
              rows="4"
              className="w-full p-3 border rounded-xl mb-1 focus:ring-2 focus:ring-blue-500 outline-none resize-y"
              placeholder="Ex: conferir máquina M003, levar peças de reposição..."
              value={novaObservacaoRoteiro}
              onChange={(e) =>
                setNovaObservacaoRoteiro(
                  e.target.value.slice(0, LIMITE_OBSERVACAO_ROTEIRO),
                )
              }
            />
            <p className="text-xs text-gray-500 mb-4">
              {novaObservacaoRoteiro.length}/{LIMITE_OBSERVACAO_ROTEIRO}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowModalCriarRoteiro(false);
                  setNovoVeiculoId("");
                  setNovosDiasRoteiro([]);
                  setNovaObservacaoRoteiro("");
                }}
                className="flex-1 py-3 text-gray-500 font-bold"
              >
                Voltar
              </button>
              <button
                onClick={handleCriarRoteiro}
                className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700"
              >
                Criar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ADICIONAR PONTO (Simplificado) */}
      {showModalAdicionarLoja && roteiroParaAdicionar && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl max-h-[80vh] flex flex-col">
            <h2 className="text-xl font-bold mb-4">
              Adicionar Ponto a {roteiroParaAdicionar.nome}
            </h2>
            <div className="mb-3">
              <input
                autoFocus
                type="text"
                value={filtroLojaAdicionar}
                onChange={(e) => setFiltroLojaAdicionar(e.target.value)}
                placeholder="Buscar ponto por nome, cidade, bairro ou código..."
                className="w-full p-3 border rounded-xl text-sm focus:ring-2 focus:ring-[#24094E] outline-none"
              />
              <p className="text-xs text-gray-500 mt-1">
                {lojasFiltradasParaAdicionar.length} ponto
                {lojasFiltradasParaAdicionar.length === 1 ? "" : "s"} disponível
                {lojasFiltradasParaAdicionar.length === 1 ? "" : "is"} para
                adicionar
              </p>
            </div>
            {isRoteiroFinalizado(roteiroParaAdicionar) && (
              <div className="mb-3 rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs text-yellow-800">
                Esta rota está finalizada. Não é permitido adicionar pontos.
              </div>
            )}
            <div className="overflow-y-auto space-y-2 mb-4">
              {lojasFiltradasParaAdicionar.length > 0 ? (
                lojasFiltradasParaAdicionar.map((loja) => (
                  <button
                    key={loja.id}
                    onClick={() => {
                      handleMoverLoja(loja.id, null, roteiroParaAdicionar.id);
                      setFiltroLojaAdicionar("");
                      setRoteiroParaAdicionar(null);
                      setShowModalAdicionarLoja(false);
                    }}
                    disabled={isRoteiroFinalizado(roteiroParaAdicionar)}
                    className="w-full text-left p-3 hover:bg-gray-50 rounded-xl border flex justify-between items-center group disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="font-medium text-sm">🏪 {loja.nome}</span>
                    <span className="text-blue-500 opacity-0 group-hover:opacity-100 font-bold text-xs">
                      + ADICIONAR
                    </span>
                  </button>
                ))
              ) : (
                <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-4 text-center text-sm text-gray-500">
                  {filtroLojaAdicionar
                    ? "Nenhum ponto encontrado para este filtro."
                    : "Todos os pontos já foram adicionados a este roteiro."}
                </div>
              )}
            </div>
            <button
              onClick={() => {
                setFiltroLojaAdicionar("");
                setRoteiroParaAdicionar(null);
                setShowModalAdicionarLoja(false);
              }}
              className="w-full py-3 bg-gray-100 rounded-xl font-bold text-gray-500"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

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
              ? `Deseja finalizar o roteiro ${modalFinalizar.roteiro?.nome || ""}?`
              : "Confirma novamente a finalização deste roteiro?"}
          </p>
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
                {modalFinalizar.loading
                  ? "Finalizando..."
                  : "Finalizar Roteiro"}
              </button>
            )}
          </div>
        </div>
      </Modal>

      <Footer />
    </div>
  );
}

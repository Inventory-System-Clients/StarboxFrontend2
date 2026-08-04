import React, { useState, useContext, useEffect, useRef } from "react";
import Swal from "sweetalert2";
import { useLocation, useNavigate } from "react-router-dom";
import { AuthContext } from "../contexts/AuthContext";
import { reconhecerAlertaRevisao } from "../services/revisoesVeiculos";
import {
  obterKmInicialPilotagemAtiva,
  removerKmInicialPilotagemAtiva,
  salvarKmInicialPilotagemAtiva,
} from "../lib/roteiroFinalizacaoWhatsApp";

import api from "../services/api";
const emojiVeiculo = (tipo, emoji) => emoji || (tipo === "moto" ? "🏍️" : "🚗");
export default function ControleVeiculos({
  veiculos = [],
  onRefresh,
  loading,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { usuario } = useContext(AuthContext);
  const [veiculosLista, setVeiculosLista] = useState(veiculos || []);
  const [modalAberto, setModalAberto] = useState(false);
  const [modalEditarAberto, setModalEditarAberto] = useState(false);
  const [veiculoEditando, setVeiculoEditando] = useState(null);
  const [formEditar, setFormEditar] = useState({});
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const [erroEdicao, setErroEdicao] = useState("");
  // Abrir modal de edição
  const abrirModalEditar = (veiculo) => {
    setVeiculoEditando(veiculo);
    setFormEditar({ ...veiculo });
    setErroEdicao("");
    setModalEditarAberto(true);
  };

  const fecharModalEditar = () => {
    if (salvandoEdicao) return;
    setModalEditarAberto(false);
    setVeiculoEditando(null);
    setFormEditar({});
    setErroEdicao("");
  };

  const handleFormEditarChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormEditar((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
    if (erroEdicao) setErroEdicao("");
  };

  const salvarEdicaoVeiculo = async () => {
    if (!veiculoEditando || salvandoEdicao) return;
    // Validação básica
    if (!formEditar.nome || !formEditar.modelo || !formEditar.km) {
      setErroEdicao("Preencha nome, modelo e km.");
      return;
    }
    if (isNaN(Number(formEditar.km)) || Number(formEditar.km) < 0) {
      setErroEdicao("KM deve ser um número maior ou igual a zero.");
      return;
    }
    if (
      formEditar.intervaloRevisaoKm &&
      (isNaN(Number(formEditar.intervaloRevisaoKm)) ||
        Number(formEditar.intervaloRevisaoKm) <= 0)
    ) {
      setErroEdicao(
        "Intervalo de revisão deve ser um número inteiro maior que zero.",
      );
      return;
    }
    try {
      setSalvandoEdicao(true);
      setErroEdicao("");
      const payload = { ...formEditar };
      // Ajuste de tipos
      payload.km = Number(payload.km);
      if (payload.intervaloRevisaoKm)
        payload.intervaloRevisaoKm = Number(payload.intervaloRevisaoKm);
      const { data } = await api.put(
        `/veiculos/${veiculoEditando.id}`,
        payload,
      );
      setVeiculosLista((prev) =>
        prev.map((v) => (v.id === veiculoEditando.id ? { ...v, ...data } : v)),
      );
      Swal.fire({
        icon: "success",
        title: "Veículo atualizado",
        text: "Dados do veículo salvos com sucesso!",
        confirmButtonColor: "#62A1D9",
      });
      fecharModalEditar();
    } catch (error) {
      setErroEdicao(error?.response?.data?.error || "Erro ao salvar edição.");
    } finally {
      setSalvandoEdicao(false);
    }
  };
  const [modalFinalizarAberto, setModalFinalizarAberto] = useState(false);
  const [modalIntervaloAberto, setModalIntervaloAberto] = useState(false);
  const [veiculoSelecionado, setVeiculoSelecionado] = useState(null);
  const [veiculoEditandoIntervalo, setVeiculoEditandoIntervalo] =
    useState(null);
  const [modalExcluirAberto, setModalExcluirAberto] = useState(false);
  const [veiculoExclusao, setVeiculoExclusao] = useState(null);
  const [deletandoVeiculoId, setDeletandoVeiculoId] = useState(null);
  const botaoCancelarExcluirRef = useRef(null);
  const [salvando, setSalvando] = useState(false);
  const [finalizando, setFinalizando] = useState(false);
  const [salvandoIntervalo, setSalvandoIntervalo] = useState(false);
  const [intervaloInput, setIntervaloInput] = useState("");
  const [erroIntervalo, setErroIntervalo] = useState("");
  const [form, setForm] = useState({
    estado: "Bom",
    obs: "",
    km: "",
    modo: "trabalho",
    combustivel: "Cheio",
    limpeza: "esta limpo",
  });

  useEffect(() => {
    setVeiculosLista(Array.isArray(veiculos) ? veiculos : []);
  }, [veiculos]);
  const [formFinalizar, setFormFinalizar] = useState({
    estado: "Bom",
    obs: "",
    km: "",
    combustivel: "Cheio",
    limpeza: "esta limpo",
  });

  const veioDeRoteiros = location?.state?.origem === "roteiros";
  const rotaRetornoPosPilotagem =
    location?.state?.retornarPara || "/roteiros";

  const handleReconhecerAlerta = async (veiculoId) => {
    try {
      await reconhecerAlertaRevisao(veiculoId);
      Swal.fire({
        icon: "success",
        title: "Alerta Reconhecido",
        text: "O alerta de revisão foi reconhecido com sucesso",
        confirmButtonColor: "#62A1D9",
      });
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error("Erro ao reconhecer alerta:", error);
      // Não mostrar erro se funcionalidade não está disponível ainda
      if (error?.message?.includes("ainda não disponível")) {
        Swal.fire({
          icon: "info",
          title: "Funcionalidade em Desenvolvimento",
          text: error.message,
          confirmButtonColor: "#62A1D9",
        });
      } else {
        Swal.fire({
          icon: "error",
          title: "Erro",
          text: "Não foi possível reconhecer o alerta",
          confirmButtonColor: "#62A1D9",
        });
      }
    }
  };

  const abrirModal = (veiculo) => {
    setVeiculoSelecionado(veiculo);
    setForm({
      estado: veiculo.estado,
      obs: "",
      km: veiculo.km,
      modo: "trabalho",
      combustivel: getCombustivelLabel(
        veiculo.nivelCombustivel || veiculo.combustivel || "Cheio",
      ),
      limpeza: "esta limpo",
    });
    setModalAberto(true);
  };

  const abrirModalFinalizar = (veiculo) => {
    setVeiculoSelecionado(veiculo);
    setFormFinalizar({
      estado: veiculo.estado,
      obs: "",
      km: veiculo.km,
      combustivel: getCombustivelLabel(
        veiculo.nivelCombustivel || veiculo.combustivel || "Cheio",
      ),
      limpeza: "esta limpo",
    });
    setModalFinalizarAberto(true);
  };

  const fecharModal = () => {
    setModalAberto(false);
    setVeiculoSelecionado(null);
  };
  const fecharModalFinalizar = () => {
    setModalFinalizarAberto(false);
    setVeiculoSelecionado(null);
  };

  const abrirModalIntervalo = (veiculo) => {
    setVeiculoEditandoIntervalo(veiculo);
    setIntervaloInput(String(obterIntervaloRevisao(veiculo)));
    setErroIntervalo("");
    setModalIntervaloAberto(true);
  };

  const fecharModalIntervalo = () => {
    if (salvandoIntervalo) return;
    setModalIntervaloAberto(false);
    setVeiculoEditandoIntervalo(null);
    setIntervaloInput("");
    setErroIntervalo("");
  };

  const abrirModalExcluir = (veiculo) => {
    if (!veiculo?.id || deletandoVeiculoId) return;
    setVeiculoExclusao(veiculo);
    setModalExcluirAberto(true);
  };

  const fecharModalExcluir = () => {
    if (deletandoVeiculoId) return;
    setModalExcluirAberto(false);
    setVeiculoExclusao(null);
  };

  const sincronizarListaVeiculos = async () => {
    try {
      if (onRefresh) {
        await Promise.resolve(onRefresh());
      }
    } catch (error) {
      console.error("Erro ao sincronizar lista de veículos:", error);
    }
  };

  const confirmarExcluirVeiculo = async () => {
    if (!veiculoExclusao?.id || deletandoVeiculoId) return;

    const veiculoId = veiculoExclusao.id;
    setDeletandoVeiculoId(veiculoId);

    try {
      await api.delete(`/veiculos/${veiculoId}`);
      setVeiculosLista((prev) => prev.filter((v) => v.id !== veiculoId));
      setModalExcluirAberto(false);
      setVeiculoExclusao(null);

      Swal.fire({
        icon: "success",
        title: "Sucesso",
        text: "Veículo removido com sucesso.",
        confirmButtonColor: "#62A1D9",
      });
      return;
    } catch (error) {
      const status = error?.response?.status;

      if (status === 404) {
        Swal.fire({
          icon: "warning",
          title: "Veículo não encontrado",
          text: "Veículo não encontrado.",
          confirmButtonColor: "#62A1D9",
        });
        await sincronizarListaVeiculos();
      } else if (status === 409) {
        console.error(
          "Erro 409 ao excluir veículo:",
          error?.response?.data || error,
        );
        Swal.fire({
          icon: "warning",
          title: "Não foi possível remover",
          text: "Não foi possível remover este veículo porque ele ainda possui vínculos ativos.",
          confirmButtonColor: "#62A1D9",
        });
      } else {
        Swal.fire({
          icon: "error",
          title: "Erro",
          text: "Erro ao remover veículo. Tente novamente.",
          confirmButtonColor: "#62A1D9",
        });
      }
    } finally {
      setDeletandoVeiculoId(null);
    }
  };

  useEffect(() => {
    if (!modalExcluirAberto) return;

    botaoCancelarExcluirRef.current?.focus();

    const handleEsc = (event) => {
      if (event.key === "Escape") {
        fecharModalExcluir();
      }
    };

    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [modalExcluirAberto, deletandoVeiculoId]);

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };
  const handleFormFinalizarChange = (e) => {
    const { name, value } = e.target;
    setFormFinalizar((prev) => ({ ...prev, [name]: value }));
  };

  const validarLimiteKmPorUltimaMovimentacao = (veiculo, kmInformado) => {
    const ultimaMov = ultimasMovs?.[veiculo?.id];
    const kmUltimaMov = Number(ultimaMov?.km);

    if (!Number.isFinite(kmUltimaMov)) {
      return { permitido: true };
    }

    const limiteMaximo = kmUltimaMov + 10000;
    if (kmInformado > limiteMaximo) {
      return {
        permitido: false,
        kmUltimaMov,
        limiteMaximo,
      };
    }

    return { permitido: true };
  };

  // Exemplo: para atualizar o status do veículo na API, use fetch/axios e depois onRefresh()
  const pilotarVeiculo = async () => {
    if (!veiculoSelecionado || salvando) return;
    const kmValue = form.km === "" ? 0 : parseInt(form.km, 10);
    // Bloqueio: só pode pilotar se KM informado for igual ao atual do veículo
    if (kmValue !== Number(veiculoSelecionado.km)) {
      Swal.fire({
        icon: "warning",
        title: "KM inválido",
        text: `O KM informado (${kmValue}) deve ser igual ao KM atual do veículo (${veiculoSelecionado.km}).`,
        confirmButtonColor: "#62A1D9",
      });
      return;
    }

    const validacaoKmPilotar = validarLimiteKmPorUltimaMovimentacao(
      veiculoSelecionado,
      kmValue,
    );

    if (!validacaoKmPilotar.permitido) {
      Swal.fire({
        icon: "warning",
        title: "KM acima do limite",
        text: `O KM informado (${kmValue}) excede o limite permitido com base na última movimentação (${validacaoKmPilotar.kmUltimaMov}). Máximo aceito: ${validacaoKmPilotar.limiteMaximo}.`,
        confirmButtonColor: "#62A1D9",
      });
      return;
    }

    setSalvando(true);
    try {
      await api.put(`/veiculos/${veiculoSelecionado.id}`, {
        ...veiculoSelecionado,
        emUso: true,
        km: kmValue,
        estado: form.estado,
        modo: form.modo,
        nivelCombustivel: getCombustivelLabel(form.combustivel),
        nivelLimpeza: form.limpeza,
      });
      // Registrar movimentação de retirada
      await api.post("/movimentacao-veiculos", {
        veiculoId: veiculoSelecionado.id,
        tipo: "retirada",
        gasolina: form.combustivel
          ? getCombustivelLabel(form.combustivel)
          : undefined,
        nivel_limpeza: form.limpeza,
        estado: form.estado,
        modo: form.modo,
        obs: form.obs || undefined,
        km: kmValue,
      });

      salvarKmInicialPilotagemAtiva({
        usuarioId: usuario?.id,
        veiculoId: veiculoSelecionado.id,
        kmInicial: kmValue,
      });

      if (onRefresh) onRefresh();
      fecharModal();

      if (veioDeRoteiros) {
        navigate(rotaRetornoPosPilotagem, {
          replace: true,
          state: { pilotagemIniciada: true },
        });
      }
    } catch (error) {
      console.error("Erro ao pilotar:", error);
      Swal.fire("Erro", "Não foi possível iniciar o uso do veículo.", "error");
    } finally {
      setSalvando(false);
    }
  };

  const finalizarVeiculo = async () => {
    if (!veiculoSelecionado || finalizando) return;

    if (!usuarioPodeFinalizarPilotagem(veiculoSelecionado)) {
      Swal.fire({
        icon: "warning",
        title: "Veículo em uso",
        text: "Somente o usuário que iniciou a pilotagem pode finalizar este veículo.",
        confirmButtonColor: "#62A1D9",
      });
      return;
    }

    const kmValue =
      formFinalizar.km === "" ? 0 : parseInt(formFinalizar.km, 10);
    // Bloqueio: não pode finalizar com KM menor que o da última movimentação
    const ultimaMov = ultimasMovs[veiculoSelecionado.id];
    if (ultimaMov && kmValue < Number(ultimaMov.km)) {
      Swal.fire({
        icon: "warning",
        title: "KM inválido",
        text: `O KM informado (${kmValue}) não pode ser menor que o KM da última movimentação (${ultimaMov.km}).`,
        confirmButtonColor: "#62A1D9",
      });
      return;
    }

    const validacaoKmFinalizar = validarLimiteKmPorUltimaMovimentacao(
      veiculoSelecionado,
      kmValue,
    );

    if (!validacaoKmFinalizar.permitido) {
      Swal.fire({
        icon: "warning",
        title: "KM acima do limite",
        text: `O KM informado (${kmValue}) excede o limite permitido com base na última movimentação (${validacaoKmFinalizar.kmUltimaMov}). Máximo aceito: ${validacaoKmFinalizar.limiteMaximo}.`,
        confirmButtonColor: "#62A1D9",
      });
      return;
    }

    setFinalizando(true);
    try {
      await api.put(`/veiculos/${veiculoSelecionado.id}`, {
        ...veiculoSelecionado,
        emUso: false,
        km: kmValue,
        estado: formFinalizar.estado,
        nivelCombustivel: getCombustivelLabel(formFinalizar.combustivel),
        nivelLimpeza: formFinalizar.limpeza,
      });
      // Registrar movimentação de devolução
      await api.post("/movimentacao-veiculos", {
        veiculoId: veiculoSelecionado.id,
        tipo: "devolucao",
        gasolina: formFinalizar.combustivel
          ? getCombustivelLabel(formFinalizar.combustivel)
          : undefined,
        nivel_limpeza: formFinalizar.limpeza,
        estado: formFinalizar.estado,
        modo: veiculoSelecionado.modo,
        obs: formFinalizar.obs || undefined,
        km: kmValue,
      });

      removerKmInicialPilotagemAtiva({
        usuarioId: usuario?.id,
        veiculoId: veiculoSelecionado.id,
      });

      if (onRefresh) onRefresh();
      Swal.fire({
        icon: "success",
        title: `${usuario?.nome || "Funcionário"} guardou ${veiculoSelecionado?.nome}`,
        showConfirmButton: true,
        confirmButtonText: "OK",
      });
      fecharModalFinalizar();

      if (location?.state?.origem === "roteiros-finalizacao") {
        navigate(location?.state?.retornarPara || "/roteiros", {
          replace: true,
          state: {
            pilotagemFinalizada: true,
            roteiroIdParaFinalizar: location?.state?.roteiroIdParaFinalizar,
          },
        });
      }
    } catch (error) {
      console.error("Erro ao finalizar:", error);
      Swal.fire("Erro", "Não foi possível finalizar o veículo.", "error");
    } finally {
      setFinalizando(false);
    }
  };

  // Função para exibir o texto do combustível
  function getCombustivelLabel(valor) {
    if (valor == null || valor === "") return "-";
    const mapa = {
      Cheio: "Cheio",
      "3/4": "3/4",
      "Meio tanque": "Meio tanque",
      "1/4": "1/4",
      Reserva: "Reserva",
      Vazio: "Vazio",
      "5 palzinhos": "Cheio",
      "4 palzinhos": "3/4",
      "3 palzinhos": "Meio tanque",
      "2 palzinhos": "1/4",
      "1 palzinho": "Reserva",
      5: "Cheio",
      4: "3/4",
      3: "Meio tanque",
      2: "1/4",
      1: "Reserva",
      0: "Vazio",
    };
    return mapa[valor] || valor;
  }

  const formatarKm = (valor) => Number(valor || 0).toLocaleString("pt-BR");

  const obterIntervaloRevisao = (veiculo) => {
    const valor = Number(veiculo?.intervaloRevisaoKm);
    return Number.isInteger(valor) && valor > 0 ? valor : 10000;
  };

  const obterProximaRevisao = (veiculo) => {
    const proxima = Number(veiculo?.proximaRevisaoKm);
    if (Number.isInteger(proxima) && proxima > 0) {
      return proxima;
    }

    return Number(veiculo?.km || 0) + obterIntervaloRevisao(veiculo);
  };

  const salvarIntervaloRevisao = async () => {
    if (!veiculoEditandoIntervalo || salvandoIntervalo) return;

    const valor = Number(intervaloInput);
    if (!Number.isInteger(valor) || valor <= 0) {
      setErroIntervalo("Informe um KM inteiro maior que zero");
      return;
    }

    try {
      setSalvandoIntervalo(true);
      setErroIntervalo("");

      const { data } = await api.patch(
        `/veiculos/${veiculoEditandoIntervalo.id}/intervalo-revisao`,
        {
          intervaloRevisaoKm: valor,
        },
      );

      const retornoVeiculo = data?.veiculo || {};
      const proximaRevisaoAtualizada =
        retornoVeiculo?.proximaRevisaoKm ??
        Number(veiculoEditandoIntervalo.km || 0) + valor;

      setVeiculosLista((prev) =>
        prev.map((item) =>
          item.id === veiculoEditandoIntervalo.id
            ? {
                ...item,
                ...retornoVeiculo,
                intervaloRevisaoKm: retornoVeiculo?.intervaloRevisaoKm ?? valor,
                proximaRevisaoKm: proximaRevisaoAtualizada,
              }
            : item,
        ),
      );

      Swal.fire({
        icon: "success",
        title: "Intervalo atualizado",
        text: data?.message || "Intervalo de revisão atualizado com sucesso",
        confirmButtonColor: "#62A1D9",
      });

      fecharModalIntervalo();
    } catch (error) {
      const mensagemErro =
        error?.response?.data?.error || "Erro ao atualizar intervalo";
      setErroIntervalo(mensagemErro);
    } finally {
      setSalvandoIntervalo(false);
    }
  };

  const [ultimasMovs, setUltimasMovs] = useState({});

  const normalizarId = (valor) => String(valor ?? "").trim();

  const obterUsuarioDaPilotagemAtiva = (veiculo) => {
    const ultimaMov = ultimasMovs?.[veiculo?.id];
    const tipoUltimaMov = String(ultimaMov?.tipo || "").toLowerCase();

    if (tipoUltimaMov === "devolucao") return "";

    const candidatos = [
      ultimaMov?.usuarioId,
      ultimaMov?.usuario?.id,
      veiculo?.usuarioPilotagemId,
      veiculo?.usuarioIdEmUso,
      veiculo?.usuarioId,
      veiculo?.usuario?.id,
    ];

    return candidatos.map(normalizarId).find(Boolean) || "";
  };

  const usuarioPodeFinalizarPilotagem = (veiculo) => {
    if (!veiculo?.emUso) return false;

    const usuarioDaPilotagem = obterUsuarioDaPilotagemAtiva(veiculo);
    const usuarioLogadoId = normalizarId(usuario?.id);

    if (usuarioDaPilotagem) {
      return usuarioDaPilotagem === usuarioLogadoId;
    }

    const kmInicialLocal = obterKmInicialPilotagemAtiva({
      usuarioId: usuario?.id,
      veiculoId: veiculo?.id,
    });

    return Number.isFinite(Number(kmInicialLocal));
  };

  useEffect(() => {
    // Busca a última movimentação de cada veículo
    async function fetchUltimasMovs() {
      try {
        const { data } = await api.get("/movimentacao-veiculos/ultimas");
        // Espera que a API retorne um objeto { [veiculoId]: movimentacao }
        setUltimasMovs(data || {});
      } catch (error) {
        setUltimasMovs({});
        console.error("Erro ao buscar últimas movimentações:", error);
      }
    }
    fetchUltimasMovs();
  }, [veiculosLista]);

  if (loading) return <div className="p-6">Carregando veículos...</div>;

  // Contar veículos com alerta de revisão
  const veiculosComAlerta = veiculosLista.filter(
    (v) => v.alertaRevisaoPendente,
  );
  const totalAlertas = veiculosComAlerta.length;

  const reconhecerTodosAlertas = async () => {
    try {
      await Promise.all(
        veiculosComAlerta.map((v) => reconhecerAlertaRevisao(v.id)),
      );
      Swal.fire({
        icon: "success",
        title: "Alertas Reconhecidos",
        text: `${totalAlertas} alerta(s) reconhecido(s) com sucesso`,
        confirmButtonColor: "#62A1D9",
      });
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error("Erro ao reconhecer alertas:", error);
      Swal.fire({
        icon: "error",
        title: "Erro",
        text: "Não foi possível reconhecer todos os alertas",
        confirmButtonColor: "#62A1D9",
      });
    }
  };

  const intervaloDigitado = Number(intervaloInput);
  const intervaloPreviewValido =
    Number.isInteger(intervaloDigitado) && intervaloDigitado > 0
      ? intervaloDigitado
      : obterIntervaloRevisao(veiculoEditandoIntervalo);
  const proximaRevisaoPreview =
    Number(veiculoEditandoIntervalo?.km || 0) + intervaloPreviewValido;

  return (
    <div className="p-6">
      {/* Banner de Alertas no Topo */}
      {totalAlertas > 0 && (
        <div className="mb-6 bg-linear-to-r from-yellow-400 to-orange-500 text-white rounded-xl p-6 shadow-xl border-2 border-orange-600">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-4xl">⚠️</span>
                <h3 className="text-2xl font-bold">
                  {totalAlertas} veículo{totalAlertas > 1 ? "s" : ""} precisa
                  {totalAlertas === 1 ? "" : "m"} de revisão
                </h3>
              </div>
              <p className="text-sm mb-3 leading-relaxed">
                Os seguintes veículos atingiram a quilometragem de revisão:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                {veiculosComAlerta.map((v) => (
                  <li key={v.id}>
                    <strong>{v.nome}</strong> - {v.km?.toLocaleString("pt-BR")}{" "}
                    km
                  </li>
                ))}
              </ul>
            </div>
            <button
              onClick={reconhecerTodosAlertas}
              className="bg-white text-orange-600 hover:bg-orange-50 font-bold py-3 px-6 rounded-lg transition-colors shadow-lg whitespace-nowrap"
            >
              OK, Reconhecer Todos
            </button>
          </div>
        </div>
      )}

      {/* Lista de Veículos */}
      <div className="flex flex-wrap gap-6">
        {veiculosLista.map((veiculo) => {
          const mov = ultimasMovs[veiculo.id];
          const podeFinalizarPilotagem = usuarioPodeFinalizarPilotagem(veiculo);
          const isRuim = mov?.estado?.toLowerCase() === "ruim";
          const precisaLimpar = mov?.nivel_limpeza
            ?.toLowerCase()
            .includes("precisa");
          const kmAtual = Number(veiculo?.km || 0);
          const kmProximaRevisao = Number(obterProximaRevisao(veiculo) || 0);
          const kmParaRevisao = kmProximaRevisao - kmAtual;
          const pertoDaRevisao =
            kmParaRevisao >= 0 &&
            kmParaRevisao <= 2000 &&
            !veiculo?.alertaRevisaoPendente;

          let cardClass = veiculo.emUso
            ? "filter grayscale opacity-70"
            : "bg-white";

          if (isRuim && precisaLimpar) {
            cardClass += " bg-red-100 border-2 border-red-400";
          } else if (isRuim) {
            cardClass += " bg-red-100 border-2 border-red-400";
          } else if (pertoDaRevisao) {
            cardClass += " bg-yellow-100 border-2 border-yellow-400";
          } else if (precisaLimpar) {
            cardClass += " bg-yellow-100 border-2 border-yellow-400";
          }
          return (
            <div
              key={veiculo.id}
              className={`rounded-lg shadow-md p-4 w-64 transition-all relative ${cardClass}`}
            >
              {/* Alerta de Revisão Pendente */}
              {veiculo.alertaRevisaoPendente && (
                <div className="mb-4 bg-linear-to-r from-yellow-400 to-orange-500 text-white rounded-lg p-3 shadow-lg border-2 border-orange-600">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xl">⚠️</span>
                        <span className="font-bold text-sm">
                          REVISÃO NECESSÁRIA
                        </span>
                      </div>
                      <p className="text-xs leading-tight">
                        Este veículo atingiu{" "}
                        {veiculo.km?.toLocaleString("pt-BR")} km e precisa de
                        revisão!
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleReconhecerAlerta(veiculo.id)}
                    className="mt-2 w-full bg-white text-orange-600 hover:bg-orange-50 text-xs font-bold py-1.5 px-3 rounded transition-colors"
                  >
                    OK, Entendi
                  </button>
                </div>
              )}

              <div className="flex items-center gap-2 text-2xl mb-2">
                <span>{emojiVeiculo(veiculo.tipo, veiculo.emoji)}</span>
                <span className="font-bold text-lg">{veiculo.nome}</span>
              </div>
              <div className="text-gray-600 text-sm mb-2">
                Modelo: {veiculo.modelo}
              </div>
              <div className="flex gap-4 mb-2">
                <div>
                  <div className="text-xs text-gray-500">Estado</div>
                  <div>{veiculo.estado}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Km</div>
                  <div>{veiculo.km}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Gasolina</div>
                  <div>
                    {getCombustivelLabel(
                      veiculo.nivelCombustivel || veiculo.combustivel,
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-2 mb-2 text-sm space-y-1 rounded-lg bg-blue-50 p-2 border border-blue-100">
                <div className="flex justify-between gap-2">
                  <span className="text-gray-600">Intervalo revisão:</span>
                  <span className="font-semibold text-blue-900">
                    {formatarKm(obterIntervaloRevisao(veiculo))} km
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-gray-600">Próxima revisão:</span>
                  <span className="font-semibold text-blue-900">
                    {formatarKm(obterProximaRevisao(veiculo))} km
                  </span>
                </div>
              </div>

              {!veiculo.emUso ? (
                <button
                  className="mt-2 px-4 py-1 bg-[#62A1D9] text-white rounded hover:bg-[#24094E] disabled:opacity-50"
                  onClick={() => abrirModal(veiculo)}
                  disabled={veiculo.emUso}
                >
                  Pilotar
                </button>
              ) : (
                <>
                  <div className="absolute top-2 right-2 bg-black text-white text-xs px-2 py-1 rounded">
                    Em uso
                  </div>
                  {podeFinalizarPilotagem ? (
                    <button
                      className="mt-2 px-4 py-1 bg-[#733D38] text-white rounded hover:bg-[#A6806A]"
                      onClick={() => abrirModalFinalizar(veiculo)}
                    >
                      Finalizar
                    </button>
                  ) : (
                    <button
                      className="mt-2 px-4 py-1 bg-gray-400 text-white rounded cursor-not-allowed"
                      disabled
                      title="Somente quem iniciou a pilotagem pode finalizar"
                    >
                      Em uso
                    </button>
                  )}
                </>
              )}

              {usuario?.role === "ADMIN" && (
                <div className="flex gap-2 mt-2">
                  <button
                    className="flex-1 px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                    onClick={() => abrirModalEditar(veiculo)}
                  >
                    Editar
                  </button>
                  <button
                    className="flex-1 px-2 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
                    onClick={() => abrirModalIntervalo(veiculo)}
                  >
                    Editar KM Revisão
                  </button>
                  <button
                    className="flex-1 px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                    onClick={() => abrirModalExcluir(veiculo)}
                    disabled={deletandoVeiculoId === veiculo.id}
                  >
                    {deletandoVeiculoId === veiculo.id ? "Excluindo..." : "Excluir"}
                  </button>
                </div>
              )}
              {/* Modal Editar Veículo */}
              {modalEditarAberto && (
                <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
                  <div className="bg-white rounded-lg p-6 w-full max-w-lg shadow-lg relative">
                    <h2 className="text-lg font-bold mb-2 text-blue-900">
                      Editar Veículo
                    </h2>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        salvarEdicaoVeiculo();
                      }}
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium mb-1">
                            Tipo
                          </label>
                          <select
                            name="tipo"
                            value={formEditar.tipo || ""}
                            onChange={handleFormEditarChange}
                            className="w-full border rounded p-2"
                          >
                            <option value="moto">Moto</option>
                            <option value="carro">Carro</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">
                            Nome
                          </label>
                          <input
                            name="nome"
                            value={formEditar.nome || ""}
                            onChange={handleFormEditarChange}
                            className="w-full border rounded p-2"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">
                            Modelo
                          </label>
                          <input
                            name="modelo"
                            value={formEditar.modelo || ""}
                            onChange={handleFormEditarChange}
                            className="w-full border rounded p-2"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">
                            KM
                          </label>
                          <input
                            name="km"
                            type="number"
                            min="0"
                            value={formEditar.km || ""}
                            onChange={handleFormEditarChange}
                            className="w-full border rounded p-2"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">
                            Estado
                          </label>
                          <input
                            name="estado"
                            value={formEditar.estado || ""}
                            onChange={handleFormEditarChange}
                            className="w-full border rounded p-2"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">
                            Emoji
                          </label>
                          <input
                            name="emoji"
                            value={formEditar.emoji || ""}
                            onChange={handleFormEditarChange}
                            className="w-full border rounded p-2"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">
                            Modo
                          </label>
                          <select
                            name="modo"
                            value={formEditar.modo || ""}
                            onChange={handleFormEditarChange}
                            className="w-full border rounded p-2"
                          >
                            <option value="trabalho">Trabalho</option>
                            <option value="emprestado">Emprestado</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">
                            Nível Combustível
                          </label>
                          <input
                            name="nivelCombustivel"
                            value={formEditar.nivelCombustivel || ""}
                            onChange={handleFormEditarChange}
                            className="w-full border rounded p-2"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">
                            Nível Limpeza
                          </label>
                          <input
                            name="nivelLimpeza"
                            value={formEditar.nivelLimpeza || ""}
                            onChange={handleFormEditarChange}
                            className="w-full border rounded p-2"
                          />
                        </div>
                      </div>
                      {erroEdicao && (
                        <p className="text-red-600 mt-2">{erroEdicao}</p>
                      )}
                      <div className="flex justify-end gap-2 mt-4">
                        <button
                          type="button"
                          className="px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400"
                          onClick={fecharModalEditar}
                          disabled={salvandoEdicao}
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          className="px-4 py-2 bg-[#62A1D9] text-white rounded hover:bg-[#24094E] disabled:opacity-50"
                          disabled={salvandoEdicao}
                        >
                          {salvandoEdicao ? "Salvando..." : "Salvar"}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {modalExcluirAberto && veiculoExclusao && (
        <div
          className="fixed inset-0 bg-black/50 z-60 flex items-center justify-center p-4"
          onClick={fecharModalExcluir}
        >
          <div
            className="bg-white w-full max-w-md rounded-xl shadow-2xl border border-gray-200 p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-excluir-veiculo-titulo"
            onClick={(event) => event.stopPropagation()}
          >
            <h3
              id="modal-excluir-veiculo-titulo"
              className="text-lg font-bold text-gray-900"
            >
              Excluir veículo
            </h3>
            <p className="mt-3 text-sm text-gray-700">
              Tem certeza que deseja excluir o veículo <strong>{veiculoExclusao.nome}</strong>?
            </p>
            <p className="mt-1 text-sm text-gray-700">
              Essa ação não pode ser desfeita.
            </p>

            <div className="mt-6 flex flex-col sm:flex-row gap-2 sm:justify-end">
              <button
                ref={botaoCancelarExcluirRef}
                type="button"
                onClick={fecharModalExcluir}
                disabled={Boolean(deletandoVeiculoId)}
                className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarExcluirVeiculo}
                disabled={Boolean(deletandoVeiculoId)}
                className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
              >
                {deletandoVeiculoId ? "Excluindo..." : "Excluir"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar Intervalo de Revisão */}
      {modalIntervaloAberto && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-lg relative">
            <h2 className="text-lg font-bold mb-1 text-blue-900">
              Editar KM de Revisão
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              Veículo: <strong>{veiculoEditandoIntervalo?.nome || "-"}</strong>
            </p>

            <div className="mb-3">
              <label className="block text-sm font-medium mb-1">
                Intervalo de revisão (km)
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={intervaloInput}
                onChange={(e) => {
                  setIntervaloInput(e.target.value);
                  if (erroIntervalo) setErroIntervalo("");
                }}
                className="w-full border rounded p-2"
                placeholder="Ex: 8000"
                onWheel={(e) => e.target.blur()}
              />
            </div>

            <div className="mb-3 text-xs text-gray-600 bg-gray-50 rounded p-2 border">
              <div>
                Km atual:{" "}
                <strong>{formatarKm(veiculoEditandoIntervalo?.km)} km</strong>
              </div>
              <div>
                Próxima revisão estimada:{" "}
                <strong>{formatarKm(proximaRevisaoPreview)} km</strong>
              </div>
            </div>

            {erroIntervalo && (
              <p className="text-sm text-red-600 mb-3">{erroIntervalo}</p>
            )}

            <div className="flex justify-end gap-2">
              <button
                className="px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400 disabled:opacity-50"
                onClick={fecharModalIntervalo}
                disabled={salvandoIntervalo}
              >
                Cancelar
              </button>
              <button
                className="px-4 py-2 bg-[#62A1D9] text-white rounded hover:bg-[#24094E] disabled:opacity-50"
                onClick={salvarIntervaloRevisao}
                disabled={salvandoIntervalo}
              >
                {salvandoIntervalo ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Finalizar */}
      {modalFinalizarAberto && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 shadow-lg relative">
            <h2 className="text-lg font-bold mb-4">
              Finalizar uso de {veiculoSelecionado?.nome}
            </h2>
            <div className="mb-3">
              <label className="block text-sm font-medium">
                Estado da moto
              </label>
              <select
                name="estado"
                value={formFinalizar.estado}
                onChange={handleFormFinalizarChange}
                className="w-full border rounded p-1"
              >
                <option value="Bom">Sem avaria</option>
                <option value="Ruim">Com avaria</option>
              </select>
            </div>
            <div className="mb-3">
              <label className="block text-sm font-medium">Obs:</label>
              <input
                name="obs"
                value={formFinalizar.obs}
                onChange={handleFormFinalizarChange}
                className="w-full border rounded p-1"
                placeholder="Descreva o problema (opcional)"
              />
            </div>
            <div className="mb-3">
              <label className="block text-sm font-medium">Km final</label>
              <input
                name="km"
                type="number"
                value={formFinalizar.km}
                onChange={handleFormFinalizarChange}
                className="w-full border rounded p-1"
                min="0"
                onWheel={(e) => e.target.blur()}
              />
            </div>
            <div className="mb-3">
              <label className="block text-sm font-medium">
                Nível de combustível
              </label>
              <select
                name="combustivel"
                value={formFinalizar.combustivel}
                onChange={handleFormFinalizarChange}
                className="w-full border rounded p-1"
              >
                <option value="Cheio">Cheio</option>
                <option value="3/4">3/4</option>
                <option value="Meio tanque">Meio tanque</option>
                <option value="1/4">1/4</option>
                <option value="Reserva">Reserva</option>
                <option value="Vazio">Vazio</option>
              </select>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium">
                Nível de limpeza
              </label>
              <select
                name="limpeza"
                value={formFinalizar.limpeza}
                onChange={handleFormFinalizarChange}
                className="w-full border rounded p-1"
              >
                <option value="esta limpo">Está limpo</option>
                <option value="precisa limpar">Precisa limpar</option>
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <button
                className="px-4 py-1 bg-[#A6806A] text-white rounded hover:bg-[#733D38]"
                onClick={fecharModalFinalizar}
                disabled={finalizando}
              >
                Cancelar
              </button>
              <button
                className="px-4 py-1 bg-[#62A1D9] text-white rounded hover:bg-[#24094E] disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={finalizarVeiculo}
                disabled={finalizando}
              >
                {finalizando ? "Finalizando..." : "Finalizar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 shadow-lg relative">
            <h2 className="text-lg font-bold mb-4">
              Pilotar {veiculoSelecionado?.nome}
            </h2>
            <div className="mb-3">
              <label className="block text-sm font-medium">
                Estado da moto
              </label>
              <select
                name="estado"
                value={form.estado}
                onChange={handleFormChange}
                className="w-full border rounded p-1"
              >
                <option value="Bom">Sem avaria</option>
                <option value="Ruim">Com avaria</option>
              </select>
            </div>
            <div className="mb-3">
              <label className="block text-sm font-medium">Obs:</label>
              <input
                name="obs"
                value={form.obs}
                onChange={handleFormChange}
                className="w-full border rounded p-1"
                placeholder="Descreva o problema (opcional)"
              />
            </div>
            <div className="mb-3">
              <label className="block text-sm font-medium">Km inicial</label>
              <input
                name="km"
                type="number"
                value={form.km}
                onChange={handleFormChange}
                className="w-full border rounded p-1"
                min="0"
                onWheel={(e) => e.target.blur()}
              />
            </div>
            <div className="mb-3">
              <label className="block text-sm font-medium">Modo</label>
              <select
                name="modo"
                value={form.modo}
                onChange={handleFormChange}
                className="w-full border rounded p-1"
              >
                <option value="trabalho">Trabalho</option>
                <option value="emprestado">Emprestado</option>
              </select>
            </div>
            <div className="mb-3">
              <label className="block text-sm font-medium">
                Nível de combustível
              </label>
              <select
                name="combustivel"
                value={form.combustivel}
                onChange={handleFormChange}
                className="w-full border rounded p-1"
              >
                <option value="Cheio">Cheio</option>
                <option value="3/4">3/4</option>
                <option value="Meio tanque">Meio tanque</option>
                <option value="1/4">1/4</option>
                <option value="Reserva">Reserva</option>
                <option value="Vazio">Vazio</option>
              </select>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium">
                Nível de limpeza
              </label>
              <select
                name="limpeza"
                value={form.limpeza}
                onChange={handleFormChange}
                className="w-full border rounded p-1"
              >
                <option value="esta limpo">Está limpo</option>
                <option value="precisa limpar">Precisa limpar</option>
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <button
                className="px-4 py-1 bg-[#A6806A] text-white rounded hover:bg-[#733D38]"
                onClick={fecharModal}
                disabled={salvando}
              >
                Cancelar
              </button>
              <button
                className="px-4 py-1 bg-[#62A1D9] text-white rounded hover:bg-[#24094E] disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={pilotarVeiculo}
                disabled={salvando}
              >
                {salvando ? "Salvando..." : "Pilotar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

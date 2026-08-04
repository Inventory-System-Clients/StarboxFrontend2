import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import jsPDF from "jspdf";
import api from "../services/api";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer.jsx";
import { PageHeader, Badge, AlertBox } from "../components/UIComponents";
import { PageLoader, EmptyState } from "../components/Loading";
import { useAuth } from "../contexts/AuthContext.jsx";
import ModalEditarMovimentacao from "../components/ModalEditarMovimentacao";

export function LojaDetalhes() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const [loja, setLoja] = useState(null);
  const [produtos, setProdutos] = useState([]);
  const [maquinas, setMaquinas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [maquinaSelecionada, setMaquinaSelecionada] = useState(null);
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [movimentacoesLoja, setMovimentacoesLoja] = useState([]);
  const [loadingMovimentacoes, setLoadingMovimentacoes] = useState(false);
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [relatorioGerado, setRelatorioGerado] = useState(null);
  const [erroRelatorio, setErroRelatorio] = useState("");

  // Estados para modal de edição
  const [modalEdicaoAberto, setModalEdicaoAberto] = useState(false);
  const [movimentacaoSelecionada, setMovimentacaoSelecionada] = useState(null);

  const possuiNumero = (valor) =>
    valor !== null &&
    valor !== undefined &&
    valor !== "" &&
    !Number.isNaN(Number(valor));

  const inteiroSeguro = (valor, fallback = 0) => {
    if (!possuiNumero(valor)) return fallback;
    return parseInt(valor, 10);
  };

  const formatarInteiro = (valor) =>
    Math.round(Number(valor || 0)).toLocaleString("pt-BR");

  const formatarMoeda = (valor) =>
    Number(valor || 0).toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const obterDataMovimentacao = (movimentacao) =>
    new Date(movimentacao.dataColeta || movimentacao.createdAt);

  const formatarDataHora = (valor) => new Date(valor).toLocaleString("pt-BR");

  const abrirWhatsAppComMensagem = (mensagem) => {
    const textoCodificado = encodeURIComponent(mensagem);
    const isMobile = /Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i.test(
      navigator.userAgent,
    );

    const whatsappUrl = isMobile
      ? `whatsapp://send?text=${textoCodificado}`
      : `https://web.whatsapp.com/send?text=${textoCodificado}`;

    const link = document.createElement("a");
    link.href = whatsappUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatarPeriodoSelecionado = () => {
    if (dataInicio && dataFim) {
      const inicio = new Date(`${dataInicio}T00:00:00`).toLocaleDateString(
        "pt-BR",
      );
      const fim = new Date(`${dataFim}T00:00:00`).toLocaleDateString("pt-BR");
      return `${inicio} a ${fim}`;
    }

    if (dataInicio) {
      return `A partir de ${new Date(`${dataInicio}T00:00:00`).toLocaleDateString("pt-BR")}`;
    }

    if (dataFim) {
      return `Até ${new Date(`${dataFim}T00:00:00`).toLocaleDateString("pt-BR")}`;
    }

    return "Todas as datas";
  };

  useEffect(() => {
    carregarDados();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!maquinaSelecionada) return;
    carregarMovimentacoes(maquinaSelecionada.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movimentacoesLoja]);

  useEffect(() => {
    setRelatorioGerado(null);
    setErroRelatorio("");
  }, [dataInicio, dataFim, maquinaSelecionada]);

  // Função para verificar se usuário pode editar uma movimentação
  const podeEditar = (movimentacao) => {
    if (!usuario) return false;
    return usuario.role === "ADMIN" || movimentacao.usuarioId === usuario.id;
  };

  // Função para abrir modal de edição
  const abrirModalEdicao = (movimentacao) => {
    setMovimentacaoSelecionada(movimentacao);
    setModalEdicaoAberto(true);
  };

  // Função para atualizar movimentação na lista após edição
  const atualizarMovimentacao = (movimentacaoAtualizada) => {
    const atualizarLista = (lista) =>
      lista
        .map((mov) =>
          mov.id === movimentacaoAtualizada.id ? movimentacaoAtualizada : mov,
        )
        .sort((a, b) => obterDataMovimentacao(b) - obterDataMovimentacao(a));

    setMovimentacoes((prev) => atualizarLista(prev));
    setMovimentacoesLoja((prev) => atualizarLista(prev));
  };

  const carregarDados = async () => {
    try {
      setLoading(true);
      const [lojaRes, maquinasRes, movimentacoesRes, produtosRes] =
        await Promise.all([
          api.get(`/lojas/${id}`),
          api.get(`/maquinas`),
          api.get(`/movimentacoes?lojaId=${id}&limite=5000`),
          api.get(`/produtos`),
        ]);

      const maquinasDaLoja = maquinasRes.data.filter(
        (m) => String(m.lojaId) === String(id),
      );
      const todasMovimentacoes = (movimentacoesRes.data || []).filter(
        (mov) => String(mov.lojaId || mov.maquina?.lojaId) === String(id),
      );
      const produtosCarregados = produtosRes.data || [];

      // Enriquecer cada máquina com estoque atual e último produto
      const maquinasEnriquecidas = await Promise.all(
        maquinasDaLoja.map(async (maquina) => {
          try {
            // Buscar estoque atual da API
            const estoqueRes = await api.get(`/maquinas/${maquina.id}/estoque`);
            const estoqueAtual = estoqueRes.data.estoqueAtual || 0;

            // Buscar última movimentação desta máquina
            const movsDaMaquina = todasMovimentacoes
              .filter((mov) => mov.maquinaId === maquina.id)
              .sort(
                (a, b) =>
                  new Date(b.dataColeta || b.createdAt) -
                  new Date(a.dataColeta || a.createdAt),
              );

            let ultimoProduto = null;
            if (movsDaMaquina.length > 0) {
              const ultimaMov = movsDaMaquina[0];
              const produtoId = ultimaMov.detalhesProdutos?.[0]?.produtoId;
              ultimoProduto = produtosCarregados.find(
                (p) => String(p.id) === String(produtoId),
              );
            }

            return {
              ...maquina,
              estoqueAtual,
              ultimoProduto,
            };
          } catch (error) {
            console.error(
              `Erro ao buscar dados da máquina ${maquina.id}:`,
              error,
            );
            return {
              ...maquina,
              estoqueAtual: 0,
              ultimoProduto: null,
            };
          }
        }),
      );

      setLoja(lojaRes.data);
      setProdutos(produtosCarregados);
      setMaquinas(maquinasEnriquecidas);
      setMovimentacoesLoja(
        [...todasMovimentacoes].sort(
          (a, b) => obterDataMovimentacao(b) - obterDataMovimentacao(a),
        ),
      );
    } catch (error) {
      setError(
        "Erro ao carregar dados: " +
          (error.response?.data?.error || error.message),
      );
    } finally {
      setLoading(false);
    }
  };

  const carregarMovimentacoes = (maquinaId) => {
    try {
      setLoadingMovimentacoes(true);
      const listaDaMaquina = [...movimentacoesLoja]
        .filter((mov) => String(mov.maquinaId) === String(maquinaId))
        .sort((a, b) => obterDataMovimentacao(b) - obterDataMovimentacao(a));
      setMovimentacoes(listaDaMaquina);
    } catch (error) {
      console.error("Erro ao carregar movimentações:", error);
      setMovimentacoes([]);
    } finally {
      setLoadingMovimentacoes(false);
    }
  };

  const handleSelecionarMaquina = (maquina) => {
    if (maquinaSelecionada?.id === maquina.id) {
      setMaquinaSelecionada(null);
      setMovimentacoes([]);
    } else {
      setMaquinaSelecionada(maquina);
      carregarMovimentacoes(maquina.id);
    }
  };

  const filtrarMovimentacoesPorPeriodo = (lista) => {
    const inicio = dataInicio ? new Date(`${dataInicio}T00:00:00`) : null;
    const fim = dataFim ? new Date(`${dataFim}T23:59:59`) : null;

    return lista.filter((mov) => {
      const dataMovimentacao = obterDataMovimentacao(mov);
      if (inicio && dataMovimentacao < inicio) return false;
      if (fim && dataMovimentacao > fim) return false;
      return true;
    });
  };

  const construirRelatorioMovimentacoes = (escopo) => {
    if (escopo === "selecionada" && !maquinaSelecionada) {
      return {
        error: "Selecione uma máquina para gerar o relatório individual.",
      };
    }

    const maquinasNoEscopo =
      escopo === "selecionada"
        ? maquinas.filter(
            (maquina) => String(maquina.id) === String(maquinaSelecionada?.id),
          )
        : maquinas;

    const movimentacoesBase = movimentacoesLoja.filter((mov) =>
      escopo === "selecionada"
        ? String(mov.maquinaId) === String(maquinaSelecionada?.id)
        : true,
    );

    if (movimentacoesBase.length === 0) {
      return {
        error:
          escopo === "selecionada"
            ? "Nenhuma movimentação encontrada para a máquina selecionada."
            : "Nenhuma movimentação encontrada para este ponto.",
      };
    }

    const maquinaPorId = new Map(
      maquinas.map((maquina) => [String(maquina.id), maquina]),
    );
    const produtoPorId = new Map(
      produtos.map((produto) => [String(produto.id), produto]),
    );
    const inicio = dataInicio ? new Date(`${dataInicio}T00:00:00`) : null;
    const fim = dataFim ? new Date(`${dataFim}T23:59:59`) : null;
    const movimentacoesPorMaquina = new Map();

    movimentacoesBase.forEach((mov) => {
      const chave = String(mov.maquinaId);
      if (!movimentacoesPorMaquina.has(chave)) {
        movimentacoesPorMaquina.set(chave, []);
      }
      movimentacoesPorMaquina.get(chave).push(mov);
    });

    const totais = {
      entradas: 0,
      saidas: 0,
      jogado: 0,
      liquido: 0,
      especie: 0,
      notas: 0,
      digital: 0,
      movimentacoes: 0,
    };
    const blocos = [];
    let maquinasComMovimentacao = 0;
    const chavesOrdenadas = Array.from(movimentacoesPorMaquina.keys()).sort(
      (a, b) => {
        const nomeA = maquinaPorId.get(a)?.nome || "";
        const nomeB = maquinaPorId.get(b)?.nome || "";
        return nomeA.localeCompare(nomeB, "pt-BR", {
          sensitivity: "base",
        });
      },
    );

    chavesOrdenadas.forEach((maquinaIdAtual, indiceMaquina) => {
      const maquinaAtual = maquinaPorId.get(maquinaIdAtual);
      const codigoMaquina = maquinaAtual?.codigo || maquinaIdAtual;
      const nomeMaquina = maquinaAtual?.nome || "Maquina";
      const valorJogada = Number(maquinaAtual?.valorFicha || 0);
      const movimentacoesOrdenadas = [
        ...movimentacoesPorMaquina.get(maquinaIdAtual),
      ].sort((a, b) => obterDataMovimentacao(a) - obterDataMovimentacao(b));

      const totaisMaquina = {
        entradas: 0,
        saidas: 0,
        jogado: 0,
        liquido: 0,
        especie: 0,
        notas: 0,
        digital: 0,
      };
      const blocosMaquina = [];
      let movimentacoesNoPeriodoMaquina = 0;

      let contadorInAnterior = 0;
      let contadorOutAnterior = 0;

      movimentacoesOrdenadas.forEach((mov) => {
        const dataMovimentacao = obterDataMovimentacao(mov);
        const fichas = inteiroSeguro(mov.fichas, 0);
        const sairam = inteiroSeguro(mov.sairam, 0);
        const contadorInAtual = possuiNumero(mov.contadorIn)
          ? inteiroSeguro(mov.contadorIn, contadorInAnterior)
          : contadorInAnterior + fichas;
        const contadorOutAtual = possuiNumero(mov.contadorOut)
          ? inteiroSeguro(mov.contadorOut, contadorOutAnterior)
          : contadorOutAnterior + sairam;
        const diferencaIn = Math.max(0, contadorInAtual - contadorInAnterior);
        const quantidadeSaiu = Math.max(
          0,
          contadorOutAtual - contadorOutAnterior,
        );
        const dentroDoPeriodo =
          (!inicio || dataMovimentacao >= inicio) &&
          (!fim || dataMovimentacao <= fim);

        if (dentroDoPeriodo) {
          const produtoDetalhe = mov.detalhesProdutos?.[0];
          const produtoId =
            produtoDetalhe?.produtoId || produtoDetalhe?.produto?.id;
          const produtoCadastro = produtoId
            ? produtoPorId.get(String(produtoId))
            : null;
          const precoProduto = Number(produtoCadastro?.preco || 0);
          const nomeProduto =
            produtoDetalhe?.produto?.nome ||
            produtoCadastro?.nome ||
            "Produto não identificado";
          const saldo = diferencaIn;
          const jogado = valorJogada > 0 ? diferencaIn / valorJogada : 0;
          const valorMedioSaidaPorPelucia =
            quantidadeSaiu > 0
              ? diferencaIn / quantidadeSaiu - precoProduto
              : 0;
          const jogadasMediasPorPelucia =
            quantidadeSaiu > 0 && valorJogada > 0
              ? diferencaIn / valorJogada / quantidadeSaiu
              : 0;
          const valorNotas = Number(mov.quantidade_notas_entrada || 0);
          const valorDigital = Number(mov.valor_entrada_maquininha_pix || 0);

          totais.entradas += diferencaIn;
          totais.saidas += quantidadeSaiu;
          totais.jogado += jogado;
          totais.liquido += saldo;
          totais.especie += saldo;
          totais.notas += valorNotas;
          totais.digital += valorDigital;
          totais.movimentacoes += 1;

          totaisMaquina.entradas += diferencaIn;
          totaisMaquina.saidas += quantidadeSaiu;
          totaisMaquina.jogado += jogado;
          totaisMaquina.liquido += saldo;
          totaisMaquina.especie += saldo;
          totaisMaquina.notas += valorNotas;
          totaisMaquina.digital += valorDigital;
          movimentacoesNoPeriodoMaquina += 1;

          blocosMaquina.push(
            [
              "-----------------------------------",
              `Movimentacao ${movimentacoesNoPeriodoMaquina}`,
              `${codigoMaquina} | ${nomeMaquina}`,
              `Produto: ${nomeProduto}`,
              `Data: ${formatarDataHora(dataMovimentacao)}`,
              `Lançado por: ${mov.usuario?.nome || "Usuário"}`,
              `E  ${formatarInteiro(contadorInAnterior)}  ${formatarInteiro(contadorInAtual)}  ____ R$${formatarMoeda(diferencaIn)}`,
              `S  ${formatarInteiro(contadorOutAnterior)}  ${formatarInteiro(contadorOutAtual)}  ____ ${formatarInteiro(quantidadeSaiu)}`,
              `Saldo: R$${formatarMoeda(saldo)}`,
              `Valor medio de saida por pelucia: ${formatarMoeda(valorMedioSaidaPorPelucia)}`,
              `Jogadas medias por pelucia: ${formatarMoeda(jogadasMediasPorPelucia)}`,
              "___________________________________",
              "Qtde Maqs....: 01",
              `Entradas.....: ${formatarInteiro(diferencaIn)}`,
              `Saidas.......: ${formatarInteiro(quantidadeSaiu)}`,
              `Jogado.......: ${formatarMoeda(jogado)}`,
              "Cliente....: 0,00",
              `Liquido.....: ${formatarMoeda(saldo)}`,
              `Especie.....: ${formatarMoeda(saldo)}`,
              `Notas........: R$${formatarMoeda(valorNotas)}`,
              `Digital......: R$${formatarMoeda(valorDigital)}`,
              mov.observacoes ? `Observacao...: ${mov.observacoes}` : null,
            ]
              .filter(Boolean)
              .join("\n"),
          );
        }

        contadorInAnterior = contadorInAtual;
        contadorOutAnterior = contadorOutAtual;
      });

      if (movimentacoesNoPeriodoMaquina > 0) {
        maquinasComMovimentacao += 1;
        blocos.push(
          [
            "",
            "===================================",
            `TROCA DE MAQUINA -> ${codigoMaquina} | ${nomeMaquina}`,
            `Maquina ${indiceMaquina + 1} no escopo`,
            `Movimentacoes no periodo: ${formatarInteiro(movimentacoesNoPeriodoMaquina)}`,
            `Entradas da maquina: R$${formatarMoeda(totaisMaquina.entradas)}`,
            `Saidas da maquina..: ${formatarInteiro(totaisMaquina.saidas)}`,
            `Jogado da maquina..: ${formatarMoeda(totaisMaquina.jogado)}`,
            `Liquido da maquina.: ${formatarMoeda(totaisMaquina.liquido)}`,
            "===================================",
            ...blocosMaquina,
          ].join("\n"),
        );
      }
    });

    if (blocos.length === 0) {
      return {
        error: "Nenhuma movimentação encontrada no período selecionado.",
      };
    }

    const escopoLabel =
      escopo === "selecionada"
        ? `Máquina selecionada: ${maquinaSelecionada?.nome || maquinaSelecionada?.codigo || "-"}`
        : "Todas as máquinas do ponto";
    const lojaCodigo = String(loja?.id || id || "")
      .slice(0, 8)
      .toUpperCase();
    const texto = [
      "STAR BOX",
      `*${lojaCodigo} | ${loja?.nome || "Ponto"}*`,
      `Periodo: ${formatarPeriodoSelecionado()}`,
      `Escopo: ${escopoLabel}`,
      "___________________________________",
      `Qtde Maqs....: ${formatarInteiro(escopo === "selecionada" ? 1 : maquinasNoEscopo.length)}`,
      `Maqs c/ mov..: ${formatarInteiro(maquinasComMovimentacao)}`,
      `Movimentacoes: ${formatarInteiro(totais.movimentacoes)}`,
      `Entradas.....: R$${formatarMoeda(totais.entradas)}`,
      `Saidas.......: ${formatarInteiro(totais.saidas)}`,
      `Jogado.......: ${formatarMoeda(totais.jogado)}`,
      `Notas........: R$${formatarMoeda(totais.notas)}`,
      `Digital......: R$${formatarMoeda(totais.digital)}`,
      `Liquido......: ${formatarMoeda(totais.liquido)}`,
      `Especie......: ${formatarMoeda(totais.especie)}`,
      "",
      "========== DETALHE POR MAQUINA ==========",
      ...blocos,
    ].join("\n");

    const nomeEscopo =
      escopo === "selecionada"
        ? `maquina-${String(maquinaSelecionada?.codigo || maquinaSelecionada?.id || "selecionada")}`
        : "todas-as-maquinas";
    const nomeLoja = String(loja?.nome || "loja")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase();

    return {
      titulo: `Relatório de Movimentações - ${loja?.nome || "Ponto"}`,
      subtitulo: [escopoLabel, `Período: ${formatarPeriodoSelecionado()}`],
      texto,
      nomeArquivo: `relatorio-${nomeLoja || "loja"}-${nomeEscopo}.pdf`,
    };
  };

  const handleGerarRelatorio = (escopo) => {
    const resultado = construirRelatorioMovimentacoes(escopo);

    if (resultado?.error) {
      setErroRelatorio(resultado.error);
      setRelatorioGerado(null);
      return;
    }

    setErroRelatorio("");
    setRelatorioGerado(resultado);
  };

  const handleEnviarRelatorioWhatsApp = () => {
    if (!relatorioGerado?.texto) return;
    abrirWhatsAppComMensagem(relatorioGerado.texto);
  };

  const handleGerarPdfRelatorio = () => {
    if (!relatorioGerado?.texto) return;

    const documento = new jsPDF({ unit: "pt", format: "a4" });
    const larguraPagina = documento.internal.pageSize.getWidth();
    const alturaPagina = documento.internal.pageSize.getHeight();
    const margem = 40;
    const larguraTexto = larguraPagina - margem * 2;
    let posicaoY = margem;

    documento.setFont("helvetica", "bold");
    documento.setFontSize(16);
    documento.text(relatorioGerado.titulo, margem, posicaoY);
    posicaoY += 20;

    documento.setFont("helvetica", "normal");
    documento.setFontSize(10);
    relatorioGerado.subtitulo.forEach((linha) => {
      documento.text(linha, margem, posicaoY);
      posicaoY += 14;
    });

    posicaoY += 8;
    documento.setDrawColor(220, 220, 220);
    documento.line(margem, posicaoY, larguraPagina - margem, posicaoY);
    posicaoY += 18;

    documento.setFont("courier", "normal");
    documento.setFontSize(9);

    relatorioGerado.texto.split("\n").forEach((linhaOriginal) => {
      const linha = linhaOriginal || " ";
      const linhasQuebradas = documento.splitTextToSize(linha, larguraTexto);

      linhasQuebradas.forEach((linhaQuebrada) => {
        if (posicaoY > alturaPagina - margem) {
          documento.addPage();
          posicaoY = margem;
          documento.setFont("courier", "normal");
          documento.setFontSize(9);
        }

        documento.text(linhaQuebrada, margem, posicaoY);
        posicaoY += 12;
      });
    });

    documento.save(relatorioGerado.nomeArquivo);
  };

  if (loading) return <PageLoader />;
  if (error || !loja) {
    return (
      <div className="min-h-screen bg-background-light bg-pattern teddy-pattern">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <AlertBox type="error" message={error || "Ponto não encontrado"} />
        </div>
        <Footer />
      </div>
    );
  }

  const maquinasAtivas = maquinas.filter((m) => m.ativo).length;
  const capacidadeTotal = maquinas.reduce(
    (sum, m) => sum + (m.capacidadePadrao || 0),
    0,
  );
  const estoqueTotal = maquinas.reduce(
    (sum, m) => sum + (m.estoqueAtual || 0),
    0,
  );
  const ocupacaoMedia =
    capacidadeTotal > 0
      ? Math.round((estoqueTotal / capacidadeTotal) * 100)
      : 0;
  const movimentacoesFiltradas = filtrarMovimentacoesPorPeriodo(movimentacoes);

  return (
    <div className="min-h-screen bg-background-light bg-pattern teddy-pattern">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title={loja.nome}
          subtitle="Detalhes do ponto e suas máquinas"
          icon="🏪"
          action={{
            label: "Editar Ponto",
            onClick: () => navigate(`/lojas/${id}/editar`),
          }}
        />

        {/* Informações do Ponto */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-2 card-gradient">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <svg
                className="w-5 h-5 text-primary"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
              Informações do Ponto
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold text-gray-500">
                  Nome
                </label>
                <p className="text-lg font-bold text-gray-900">{loja.nome}</p>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-500">
                  Status
                </label>
                <div className="mt-1">
                  <Badge variant={loja.ativo ? "success" : "danger"}>
                    {loja.ativo ? "Ativa" : "Inativa"}
                  </Badge>
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="text-sm font-semibold text-gray-500">
                  Endereço Completo
                </label>
                <p className="text-gray-900">
                  {[
                    loja.endereco,
                    loja.numero && `nº ${loja.numero}`,
                    loja.bairro,
                    loja.cidade &&
                      loja.estado &&
                      `${loja.cidade}/${loja.estado}`,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                  {loja.cep && (
                    <span className="text-gray-600"> - CEP: {loja.cep}</span>
                  )}
                </p>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-500">
                  Telefone
                </label>
                <p className="text-gray-900">{loja.telefone}</p>
              </div>

              {loja.responsavel && (
                <div>
                  <label className="text-sm font-semibold text-gray-500">
                    Responsável
                  </label>
                  <p className="text-gray-900">{loja.responsavel}</p>
                </div>
              )}
            </div>
          </div>

          {/* Estatísticas */}
          <div className="space-y-4">
            <div className="stat-card bg-linear-to-br from-primary/10 to-primary/5">
              <div className="text-3xl mb-2">🎰</div>
              <div className="text-2xl font-bold text-gray-900">
                {maquinas.length}
              </div>
              <div className="text-sm text-gray-600">Total de Máquinas</div>
            </div>

            <div className="stat-card bg-linear-to-br from-green-500/10 to-green-500/5">
              <div className="text-3xl mb-2">✅</div>
              <div className="text-2xl font-bold text-gray-900">
                {maquinasAtivas}
              </div>
              <div className="text-sm text-gray-600">Máquinas Ativas</div>
            </div>

            <div className="stat-card bg-linear-to-br from-secondary/10 to-secondary/5">
              <div className="text-3xl mb-2">📊</div>
              <div className="text-2xl font-bold text-gray-900">
                {ocupacaoMedia}%
              </div>
              <div className="text-sm text-gray-600">Ocupação Média</div>
            </div>
          </div>
        </div>

        {/* Lista de Máquinas */}
        <div className="card-gradient">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <svg
                className="w-5 h-5 text-primary"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M3 12v3c0 1.657 3.134 3 7 3s7-1.343 7-3v-3c0 1.657-3.134 3-7 3s-7-1.343-7-3z" />
                <path d="M3 7v3c0 1.657 3.134 3 7 3s7-1.343 7-3V7c0 1.657-3.134 3-7 3S3 8.657 3 7z" />
                <path d="M17 5c0 1.657-3.134 3-7 3S3 6.657 3 5s3.134-3 7-3 7 1.343 7 3z" />
              </svg>
              Máquinas do Ponto ({maquinas.length})
            </h3>
            <button
              onClick={() => navigate("/maquinas/nova")}
              className="btn-primary text-sm"
            >
              + Nova Máquina
            </button>
          </div>

          {maquinas.length > 0 ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                {maquinas.map((maquina) => {
                  // Estoque calculado a partir de movimentações, não está no objeto máquina
                  const estoqueAtual = maquina.estoqueAtual || 0;
                  const ocupacao =
                    maquina.capacidadePadrao > 0
                      ? Math.round(
                          (estoqueAtual / maquina.capacidadePadrao) * 100,
                        )
                      : 0;
                  const isSelected = maquinaSelecionada?.id === maquina.id;

                  return (
                    <div
                      key={maquina.id}
                      className={`p-4 bg-white rounded-lg border-2 transition-all ${
                        isSelected
                          ? "border-primary shadow-lg"
                          : "border-gray-200 hover:border-primary"
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div
                          className="flex-1 cursor-pointer"
                          onClick={() => handleSelecionarMaquina(maquina)}
                        >
                          <h4 className="font-bold text-gray-900">
                            {maquina.nome}
                          </h4>
                          <p className="text-sm text-gray-500">
                            {maquina.codigo}
                            {maquina.tipo ? ` | ${maquina.tipo}` : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={maquina.ativo ? "success" : "danger"}>
                            {maquina.ativo ? "Ativa" : "Inativa"}
                          </Badge>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/maquinas/${maquina.id}/editar`);
                            }}
                            className="text-primary hover:text-primary-dark"
                            title="Editar máquina"
                          >
                            ✏️
                          </button>
                        </div>
                      </div>

                      <div
                        className="space-y-2 cursor-pointer"
                        onClick={() => handleSelecionarMaquina(maquina)}
                      >
                        {maquina.ultimoProduto && (
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Tipo:</span>
                            <span className="font-semibold flex items-center gap-1">
                              <span>{maquina.ultimoProduto.emoji || "🧸"}</span>
                              <span>{maquina.ultimoProduto.nome}</span>
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Capacidade:</span>
                          <span className="font-semibold">
                            {maquina.capacidadePadrao || 0}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Estoque Atual:</span>
                          <span className="font-semibold text-primary">
                            {estoqueAtual}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Comissão Ponto:</span>
                          <span className="font-semibold">
                            {maquina.comissaoLojaPercentual !== null &&
                            maquina.comissaoLojaPercentual !== undefined &&
                            maquina.comissaoLojaPercentual !== ""
                              ? `${parseFloat(maquina.comissaoLojaPercentual).toFixed(2)}%`
                              : "-"}
                          </span>
                        </div>

                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-gray-600">Ocupação:</span>
                            <span className="font-semibold">
                              {ocupacao}% (
                              {maquina.capacidadePadrao - estoqueAtual} faltam)
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all ${
                                ocupacao < 30
                                  ? "bg-red-500"
                                  : ocupacao < 60
                                    ? "bg-yellow-500"
                                    : "bg-green-500"
                              }`}
                              style={{ width: `${Math.min(ocupacao, 100)}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {maquina.modelo && (
                        <p className="text-xs text-gray-500 mt-3">
                          Modelo: {maquina.modelo}
                        </p>
                      )}

                      {isSelected && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <p className="text-xs text-primary font-medium">
                            👇 Ver histórico abaixo
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="card mt-6">
                <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 mb-4">
                  <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <span className="text-2xl">📄</span>
                    Relatório do Período
                  </h3>
                  <p className="text-sm text-gray-600">
                    {maquinaSelecionada
                      ? `Máquina selecionada: ${maquinaSelecionada.nome}`
                      : "Sem máquina selecionada. Você ainda pode gerar o consolidado de todo o ponto."}
                  </p>
                </div>

                <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        📅 Data Inicial
                      </label>
                      <input
                        type="date"
                        value={dataInicio}
                        onChange={(e) => setDataInicio(e.target.value)}
                        className="input-field w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        📅 Data Final
                      </label>
                      <input
                        type="date"
                        value={dataFim}
                        onChange={(e) => setDataFim(e.target.value)}
                        className="input-field w-full"
                      />
                    </div>
                  </div>
                  {(dataInicio || dataFim) && (
                    <button
                      onClick={() => {
                        setDataInicio("");
                        setDataFim("");
                      }}
                      className="mt-2 text-sm text-primary hover:text-primary-dark flex items-center gap-1"
                    >
                      ✕ Limpar filtros
                    </button>
                  )}
                </div>

                <div className="flex flex-col lg:flex-row gap-3">
                  <button
                    type="button"
                    onClick={() => handleGerarRelatorio("selecionada")}
                    disabled={!maquinaSelecionada}
                    className={
                      maquinaSelecionada
                        ? "btn-secondary w-full lg:w-auto"
                        : "w-full lg:w-auto px-4 py-2 rounded-lg font-semibold bg-gray-200 text-gray-500 cursor-not-allowed"
                    }
                  >
                    Gerar relatório da máquina selecionada
                  </button>
                  <button
                    type="button"
                    onClick={() => handleGerarRelatorio("todas")}
                    className="btn-primary w-full lg:w-auto"
                  >
                    Gerar relatório de todas as máquinas
                  </button>
                </div>

                {erroRelatorio && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    {erroRelatorio}
                  </div>
                )}

                {relatorioGerado && (
                  <div className="mt-4 space-y-4">
                    <div className="flex flex-col lg:flex-row gap-3">
                      <button
                        type="button"
                        onClick={handleEnviarRelatorioWhatsApp}
                        className="w-full lg:w-auto px-4 py-2 rounded-lg font-bold text-sm bg-green-600 text-white hover:bg-green-700 transition-colors"
                      >
                        Enviar relatório via WhatsApp
                      </button>
                      <button
                        type="button"
                        onClick={handleGerarPdfRelatorio}
                        className="w-full lg:w-auto px-4 py-2 rounded-lg font-bold text-sm bg-amber-500 text-white hover:bg-amber-600 transition-colors"
                      >
                        Gerar PDF do relatório
                      </button>
                    </div>

                    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                        <p className="font-semibold text-gray-900">
                          {relatorioGerado.titulo}
                        </p>
                        <p className="text-sm text-gray-600">
                          {relatorioGerado.subtitulo.join(" • ")}
                        </p>
                      </div>
                      <pre className="p-4 text-xs md:text-sm whitespace-pre-wrap font-mono text-gray-800 max-h-105 overflow-auto bg-white">
                        {relatorioGerado.texto}
                      </pre>
                    </div>
                  </div>
                )}
              </div>

              {/* Histórico de Movimentações */}
              {maquinaSelecionada && (
                <div className="card mt-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <span className="text-2xl">🔄</span>
                    Histórico de Movimentações - {maquinaSelecionada.nome}
                  </h3>

                  {loadingMovimentacoes ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                      <p className="text-gray-600 mt-4">
                        Carregando movimentações...
                      </p>
                    </div>
                  ) : movimentacoesFiltradas.length > 0 ? (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {movimentacoesFiltradas.map((mov) => (
                        <div
                          key={mov.id}
                          className="p-4 border border-gray-200 rounded-lg bg-white hover:bg-gray-50"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-gray-600">
                              {new Date(mov.createdAt).toLocaleDateString(
                                "pt-BR",
                              )}{" "}
                              às{" "}
                              {new Date(mov.createdAt).toLocaleTimeString(
                                "pt-BR",
                              )}
                            </span>
                            {podeEditar(mov) && (
                              <button
                                onClick={() => abrirModalEdicao(mov)}
                                className="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors flex items-center gap-1"
                                title="Editar movimentação"
                              >
                                <svg
                                  className="w-3 h-3"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                  />
                                </svg>
                                Editar
                              </button>
                            )}
                          </div>
                          <div className="grid grid-cols-5 gap-4 mt-3 text-sm">
                            <div>
                              <p className="text-gray-600">Total Pré</p>
                              <p className="font-semibold">
                                {mov.totalPre || 0}
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-600">Saíram</p>
                              <p className="font-semibold text-red-600">
                                {mov.sairam || 0}
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-600">Abastecidas</p>
                              <p className="font-semibold text-green-600">
                                {mov.abastecidas || 0}
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-600 flex items-center gap-1">
                                <span>📦</span> Total Atual
                              </p>
                              <p className="font-semibold text-purple-600">
                                {mov.totalPos ??
                                  (mov.totalPre || 0) + (mov.abastecidas || 0)}
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-600 flex items-center gap-1">
                                <span>🎫</span> Fichas
                              </p>
                              <p className="font-semibold text-blue-600">
                                {mov.fichas || 0}
                              </p>
                            </div>
                          </div>

                          {/* Contadores da Máquina */}
                          {(mov.contadorIn || mov.contadorOut) && (
                            <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-gray-200">
                              <div className="flex items-center gap-2">
                                <span className="text-lg">⬆️</span>
                                <div>
                                  <p className="text-xs text-gray-600">
                                    Contador Entrada
                                  </p>
                                  <p className="font-bold text-blue-600">
                                    {mov.contadorIn?.toLocaleString("pt-BR") ||
                                      "-"}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-lg">⬇️</span>
                                <div>
                                  <p className="text-xs text-gray-600">
                                    Contador Saída
                                  </p>
                                  <p className="font-bold text-purple-600">
                                    {mov.contadorOut?.toLocaleString("pt-BR") ||
                                      "-"}
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Justificativa de Quebra de Ordem */}
                          {mov.justificativa_ordem && (
                            <div className="mt-3 pt-3 border-t border-orange-200 bg-orange-50 p-3 rounded-lg">
                              <p className="text-xs font-bold text-orange-800 mb-1 flex items-center gap-1">
                                ⚠️ ORDEM DO ROTEIRO ALTERADA
                              </p>
                              <p className="text-sm text-orange-900">
                                <strong>Justificativa:</strong>{" "}
                                {mov.justificativa_ordem}
                              </p>
                            </div>
                          )}

                          {mov.observacoes && (
                            <p className="text-sm text-gray-600 mt-3 italic">
                              💬 {mov.observacoes}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <p className="text-6xl mb-4">📭</p>
                      <p className="text-gray-600">
                        {movimentacoes.length > 0
                          ? "Nenhuma movimentação encontrada para esta máquina no período selecionado"
                          : "Nenhuma movimentação registrada para esta máquina"}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <EmptyState
              icon="🎰"
              title="Nenhuma máquina cadastrada"
              message="Este ponto ainda não possui máquinas cadastradas. Adicione a primeira máquina!"
              action={{
                label: "Nova Máquina",
                onClick: () => navigate("/maquinas/nova"),
              }}
            />
          )}
        </div>
      </div>

      {/* Modal de edição de movimentação */}
      {modalEdicaoAberto && movimentacaoSelecionada && (
        <ModalEditarMovimentacao
          movimentacao={movimentacaoSelecionada}
          onClose={() => setModalEdicaoAberto(false)}
          onSucesso={atualizarMovimentacao}
        />
      )}

      <Footer />
    </div>
  );
}

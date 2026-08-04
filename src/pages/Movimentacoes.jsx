import { useState, useEffect, useMemo } from "react";
import api from "../services/api";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer.jsx";
import {
  PageHeader,
  StatsGrid,
  DataTable,
  Badge,
  AlertBox,
} from "../components/UIComponents";
import RegistrarDinheiro from "../components/RegistrarDinheiro";
import { PageLoader, EmptyState } from "../components/Loading";
import { useAuth } from "../contexts/AuthContext.jsx";
import AvisosMaquinasFaltam from "../components/AvisosMaquinasFaltam";
import TabelaMovimentacoesEstoqueDeLoja from "../components/TabelaMovimentacoesEstoqueDeLoja";
import ModalEditarMovimentacao from "../components/ModalEditarMovimentacao";

export function Movimentacoes() {
  const [modalRegistrarDinheiro, setModalRegistrarDinheiro] = useState(false);
  const { usuario } = useAuth();
  const isFuncionarioAbastecedor = [
    "FUNCIONARIO",
    "ABASTECEDOR",
  ].includes(usuario?.role);
  const isPerfilFuncionario = [
    "FUNCIONARIO",
    "FUNCIONARIO_TODAS_LOJAS",
    "ABASTECEDOR",
  ].includes(usuario?.role);

  // --- ESTADOS ---
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [movimentacoesEstoqueLoja, setMovimentacoesEstoqueLoja] = useState([]);

  // Filtros Estoque Loja
  const [filtroLojaEstoque, setFiltroLojaEstoque] = useState("");
  const [filtroDataEstoque, setFiltroDataEstoque] = useState("");
  const [filtroResponsavelEstoque, setFiltroResponsavelEstoque] = useState("");

  // Ações Estoque Loja
  const [editandoEstoqueLoja, setEditandoEstoqueLoja] = useState(null);
  const [excluindoEstoqueLoja, setExcluindoEstoqueLoja] = useState(null);

  // Dados Gerais
  const [maquinas, setMaquinas] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [produtoIdsEstoqueUsuario, setProdutoIdsEstoqueUsuario] = useState([]);
  const [produtoIdsEstoqueLoja, setProdutoIdsEstoqueLoja] = useState([]);
  const [lojas, setLojas] = useState([]);

  // UI States
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [salvandoMovimentacao, setSalvandoMovimentacao] = useState(false);

  // Filtros Movimentações
  const [filtroLojaForm, setFiltroLojaForm] = useState("");
  const [filtroLojaListagem, setFiltroLojaListagem] = useState("");

  // Estados para modal de edição
  const [modalEdicaoAberto, setModalEdicaoAberto] = useState(false);
  const [movimentacaoSelecionada, setMovimentacaoSelecionada] = useState(null);

  // Edição antiga (DEPRECADO - manter por compatibilidade)
  const [editandoMovimentacao, setEditandoMovimentacao] = useState(null);
  const [formEdicao, setFormEdicao] = useState({
    fichas: "",
    abastecidas: "",
    quantidade_notas_entrada: "",
    valor_entrada_maquininha_pix: "",
  });

  // Formulário Nova Movimentação
  const [formData, setFormData] = useState({
    maquina_id: "",
    produto_id: "",
    quantidadeAtualMaquina: "",
    quantidadeAdicionada: "",
    fichas: "",
    contadorIn: "",
    contadorOut: "",
    observacao: "",
    retiradaEstoque: false,
    retiradaProduto: 0,
    retiradaProdutoDevolverEstoque: false,
    origemEstoque: "usuario",
    ignoreInOut: false,
  });

  // Estados auxiliares
  const [estoqueAnterior, setEstoqueAnterior] = useState(0);
  const [alertaDivergencia, setAlertaDivergencia] = useState(null);
  const [resumoContadores, setResumoContadores] = useState(null);

  // --- EFEITOS ---
  useEffect(() => {
    carregarDados();
    carregarMovimentacoesEstoqueLoja();
  }, []);

  useEffect(() => {
    if (!showForm || !isFuncionarioAbastecedor) return;

    setFormData((prev) => ({
      ...prev,
      contadorIn: "",
      contadorOut: "",
      ignoreInOut: true,
    }));
  }, [showForm, isFuncionarioAbastecedor]);

  // Atualizar estoque anterior quando seleciona máquina
  useEffect(() => {
    if (formData.maquina_id) {
      const maquina = maquinas.find((m) => m.id === formData.maquina_id);
      if (maquina) {
        setEstoqueAnterior(maquina.estoqueAtual || 0);
      }
    }
  }, [formData.maquina_id, maquinas]);

  // Verificar divergência entre contador OUT e total pre informado
  useEffect(() => {
    const verificarDivergencia = async () => {
      if (isFuncionarioAbastecedor || !formData.maquina_id) {
        setAlertaDivergencia(null);
        setResumoContadores(null);
        return;
      }

      try {
        const params = { maquinaId: formData.maquina_id };
        if (!formData.ignoreInOut) {
          if (formData.contadorIn !== "")
            params.contadorIn = formData.contadorIn;
          if (formData.contadorOut !== "") {
            params.contadorOut = formData.contadorOut;
          }
        }

        const response = await api.get(
          `/maquinas/${formData.maquina_id}/calcular-quantidade`,
          { params },
        );

        setResumoContadores(response.data);

        if (
          formData.ignoreInOut ||
          formData.contadorOut === "" ||
          formData.quantidadeAtualMaquina === ""
        ) {
          setAlertaDivergencia(null);
          return;
        }

        const contadorOutAtual = parseInt(formData.contadorOut, 10);
        const totalPreInformado = parseInt(formData.quantidadeAtualMaquina, 10);

        if (Number.isNaN(contadorOutAtual) || Number.isNaN(totalPreInformado)) {
          setAlertaDivergencia(null);
          return;
        }

        const contadorOutSugerido = parseInt(
          response.data?.contadorOutSugerido ?? 0,
          10,
        );

        if (contadorOutAtual < contadorOutSugerido) {
          setAlertaDivergencia({
            tipo: "out_abaixo_sugerido",
            contadorOutAtual,
            contadorOutSugerido,
          });
          return;
        }

        const totalPreEsperado = parseInt(
          response.data?.totalPreEsperado ??
            response.data?.quantidadeAtual ??
            0,
          10,
        );
        const diferenca = Math.abs(totalPreInformado - totalPreEsperado);

        if (diferenca > 0) {
          setAlertaDivergencia({
            tipo: "quantidade_divergente",
            totalPreInformado,
            totalPreEsperado,
            diferenca,
          });
        } else {
          setAlertaDivergencia(null);
        }
      } catch (error) {
        console.error("Erro ao verificar divergência:", error);
        setResumoContadores(null);
        setAlertaDivergencia(null);
      }
    };

    verificarDivergencia();
  }, [
    isFuncionarioAbastecedor,
    formData.maquina_id,
    formData.contadorIn,
    formData.contadorOut,
    formData.quantidadeAtualMaquina,
    formData.ignoreInOut,
  ]);

  // --- FUNÇÕES DE CARREGAMENTO ---
  const carregarDados = async () => {
    try {
      setLoading(true);
      const [movRes, maqRes, prodRes, lojasRes, estoqueUsuarioRes] =
        await Promise.all([
          api.get("/movimentacoes"),
          api.get("/maquinas"),
          api.get("/produtos"),
          api.get("/lojas"),
          isPerfilFuncionario
            ? api
                .get("/estoque-usuarios/me")
                .catch(() => ({ data: { estoque: [] } }))
            : Promise.resolve({ data: { estoque: [] } }),
        ]);

      console.log("🔍 Movimentações carregadas:", movRes.data);
      console.log(
        "🔍 Movimentações com justificativa:",
        movRes.data
          ?.filter((m) => m.justificativa_ordem)
          .map((m) => ({
            id: m.id,
            justificativa: m.justificativa_ordem,
            data: m.createdAt,
          })),
      );

      const produtosData = Array.isArray(prodRes.data) ? prodRes.data : [];
      const estoqueUsuarioData = Array.isArray(estoqueUsuarioRes?.data?.estoque)
        ? estoqueUsuarioRes.data.estoque
        : Array.isArray(estoqueUsuarioRes?.data)
          ? estoqueUsuarioRes.data
          : [];

      const produtoIdsUsuario = estoqueUsuarioData
        .filter((item) => Number(item?.quantidade || 0) > 0)
        .map((item) => String(item?.produtoId));

      setMovimentacoes(movRes.data || []);
      setMaquinas(maqRes.data || []);
      setProdutos(produtosData);
      setProdutoIdsEstoqueUsuario(produtoIdsUsuario);
      setLojas(lojasRes.data || []);
    } catch (err) {
      console.error("Erro ao carregar dados:", err);
      setError("Erro ao carregar dados iniciais.");
    } finally {
      setLoading(false);
    }
  };

  const carregarMovimentacoesEstoqueLoja = async () => {
    try {
      const res = await api.get("/movimentacao-estoque-loja");
      setMovimentacoesEstoqueLoja(res.data || []);
    } catch (error) {
      console.error(
        "Erro ao carregar movimentações de estoque de loja:",
        error,
      );
      setMovimentacoesEstoqueLoja([]);
    }
  };

  // --- HANDLERS ---
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
    // Limpar mensagens de erro/sucesso ao editar
    if (error) setError("");
    if (success) setSuccess("");
  };

  useEffect(() => {
    const carregarEstoqueLojaMaquina = async () => {
      if (!isPerfilFuncionario || !formData.maquina_id) {
        setProdutoIdsEstoqueLoja([]);
        return;
      }

      const maquinaSelecionada = maquinas.find(
        (m) => String(m.id) === String(formData.maquina_id),
      );
      const lojaDaMaquinaId =
        maquinaSelecionada?.lojaId || maquinaSelecionada?.loja?.id || null;

      if (!lojaDaMaquinaId) {
        setProdutoIdsEstoqueLoja([]);
        return;
      }

      const estoqueLojaRes = await api
        .get(`/estoque-lojas/${lojaDaMaquinaId}`)
        .catch(() => ({ data: [] }));
      const estoqueLojaData = Array.isArray(estoqueLojaRes.data)
        ? estoqueLojaRes.data
        : [];

      setProdutoIdsEstoqueLoja(
        estoqueLojaData.map((item) => String(item?.produtoId)),
      );
    };

    carregarEstoqueLojaMaquina();
  }, [isPerfilFuncionario, maquinas, formData.maquina_id]);

  const produtosDisponiveis = useMemo(() => {
    if (!isPerfilFuncionario) return produtos;

    const origemSelecionada = formData.origemEstoque || "usuario";
    const idsPermitidos =
      origemSelecionada === "loja"
        ? produtoIdsEstoqueLoja
        : produtoIdsEstoqueUsuario;

    return produtos.filter((produto) =>
      idsPermitidos.includes(String(produto.id)),
    );
  }, [
    produtos,
    isPerfilFuncionario,
    formData.origemEstoque,
    produtoIdsEstoqueUsuario,
    produtoIdsEstoqueLoja,
  ]);

  useEffect(() => {
    if (!formData.produto_id) return;

    const produtoAindaDisponivel = produtosDisponiveis.some(
      (produto) => String(produto.id) === String(formData.produto_id),
    );

    if (!produtoAindaDisponivel) {
      setFormData((prev) => ({
        ...prev,
        produto_id: "",
      }));
    }
  }, [produtosDisponiveis, formData.produto_id]);

  // --- CORREÇÃO AQUI: Função handleSubmit recriada com o TRY ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSalvandoMovimentacao(true);
    setError("");
    setSuccess("");

    try {
      // Converter valores do formulário
      const totalPre = parseInt(formData.quantidadeAtualMaquina) || 0; // valor digitado pelo usuário
      const quantidadeAdicionada = parseInt(formData.quantidadeAdicionada) || 0;
      const fichas = parseInt(formData.fichas) || 0;

      // totalPos = totalPre + abastecidas - retiradaProduto
      const retiradaProduto = parseInt(formData.retiradaProduto) || 0;
      const totalPos = totalPre + quantidadeAdicionada - retiradaProduto;

      // Buscar a última movimentação da máquina selecionada para pegar o totalPos anterior
      let ultimoTotalPos = 0;
      let movimentacoesMaquina = movimentacoes
        .filter((m) => {
          // Considera tanto maquinaId quanto maquina_id
          return (
            m.maquinaId === formData.maquina_id ||
            m.maquina_id === formData.maquina_id
          );
        })
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      if (movimentacoesMaquina.length > 0) {
        ultimoTotalPos =
          movimentacoesMaquina[0].totalPos ||
          movimentacoesMaquina[0].totalPos ||
          0;
      }

      // sairam = totalPos da movimentação anterior - totalPre da atual
      // retiradaProduto NÃO conta em quantidadeSaiu nem no financeiro
      const quantidadeSaiu = Math.max(0, ultimoTotalPos - totalPre);

      console.log("📊 [handleSubmit] Cálculos da movimentação:");
      console.log("   📌 totalPos anterior:", ultimoTotalPos);
      console.log("   📌 Quantidade atual informada (totalPre):", totalPre);
      console.log(
        "   📌 Quantidade adicionada (abastecidas):",
        quantidadeAdicionada,
      );
      console.log("   📌 Calculado que saiu (sairam):", quantidadeSaiu);
      console.log("   📌 Novo total (totalPos):", totalPos);

      // Preparar observação
      let observacaoFinal = formData.observacao?.trim() || "";
      if (formData.retiradaEstoque) {
        const notaRetirada = "⚠️ RETIRADA DE ESTOQUE - NÃO É VENDA";
        observacaoFinal = observacaoFinal
          ? `${notaRetirada}. ${observacaoFinal}`
          : notaRetirada;
      }

      const deveIgnorarContadores =
        isFuncionarioAbastecedor || formData.ignoreInOut;

      // Transformar para o formato do backend
      const data = {
        maquinaId: formData.maquina_id,
        totalPre: totalPre,
        sairam: quantidadeSaiu,
        abastecidas: quantidadeAdicionada,
        totalPos: totalPos,
        fichas: fichas,
        contadorIn: deveIgnorarContadores
          ? null
          : formData.contadorIn === ""
            ? null
            : parseInt(formData.contadorIn),
        contadorOut: deveIgnorarContadores
          ? null
          : formData.contadorOut === ""
            ? null
            : parseInt(formData.contadorOut),
        quantidade_notas_entrada: null,
        valor_entrada_maquininha_pix: null,
        ignoreInOut: Boolean(formData.ignoreInOut),
        retiradaEstoque: formData.retiradaEstoque,
        origemEstoque: formData.origemEstoque || "usuario",
        contadorMaquina: null,
        observacoes: observacaoFinal || null,
        produtos: [
          {
            produtoId: formData.produto_id,
            quantidadeSaiu: quantidadeSaiu,
            quantidadeAbastecida: quantidadeAdicionada,
            retiradaProduto: retiradaProduto,
            retiradaProdutoDevolverEstoque:
              formData.retiradaProdutoDevolverEstoque || false,
          },
        ],
      };

      console.log("Movimentacao enviada:", data);

      const enviarMovimentacao = (confirmarUsoEstoqueLoja = false) =>
        api.post("/movimentacoes", {
          ...data,
          confirmarUsoEstoqueLoja,
        });

      try {
        await enviarMovimentacao(false);
      } catch (postError) {
        const precisaConfirmarLoja =
          postError?.response?.status === 409 &&
          postError?.response?.data?.codigo === "CONFIRMAR_USO_ESTOQUE_LOJA";

        if (!precisaConfirmarLoja) {
          throw postError;
        }

        const detalhes = postError?.response?.data?.detalhes || [];
        const resumoDetalhes = detalhes
          .map((item) => {
            const nome = item.produtoNome || item.produtoId;
            return `- ${nome}: saldo pessoal ${item.saldoUsuario}`;
          })
          .join("\n");

        const confirmar = window.confirm(
          `Voce possui saldo no estoque pessoal para alguns produtos:\n\n${resumoDetalhes}\n\nDeseja retirar do estoque do ponto mesmo assim?`,
        );

        if (!confirmar) {
          setError("Movimentacao cancelada. Origem de estoque nao confirmada.");
          return;
        }

        await enviarMovimentacao(true);
      }

      // Logs para depuração do filtro
      console.log("Todas movimentações:", movimentacoes);
      console.log(
        "ID da máquina selecionada:",
        formData.maquina_id,
        "(tipo:",
        typeof formData.maquina_id,
        ")",
      );
      movimentacoesMaquina = movimentacoes
        .filter((m) => {
          const id1 = m.maquinaId !== undefined ? m.maquinaId : m.maquina_id;
          console.log(
            "Comparando:",
            id1,
            "(tipo:",
            typeof id1,
            ") com",
            formData.maquina_id,
            "(tipo:",
            typeof formData.maquina_id,
            ")",
          );
          return id1 === formData.maquina_id;
        })
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      console.log("Movimentações filtradas:", movimentacoesMaquina);
      ultimoTotalPos = 0;
      if (movimentacoesMaquina.length > 0) {
        ultimoTotalPos = movimentacoesMaquina[0].totalPos || 0;
      }
      console.log("Último totalPos encontrado:", ultimoTotalPos);

      setFormData({
        maquina_id: "",
        produto_id: "",
        quantidadeAtualMaquina: "",
        quantidadeAdicionada: "",
        fichas: "",
        contadorIn: "",
        contadorOut: "",
        observacao: "",
        retiradaEstoque: false,
        retiradaProduto: 0,
        retiradaProdutoDevolverEstoque: false,
        origemEstoque: "usuario",
        ignoreInOut: isFuncionarioAbastecedor,
      });
      setEstoqueAnterior(0);
      setFiltroLojaForm("");
      setShowForm(false);

      // Recarregar dados
      carregarDados();
    } catch (error) {
      console.error("❌ [handleSubmit] Erro:", error);

      if (error?.response?.status === 409) {
        setError(
          error.response?.data?.error ||
            "Esta máquina tem manutenção pendente. Vá na aba Manutenções, resolva primeiro e depois lance a movimentação.",
        );
        return;
      }

      setError(
        error.response?.data?.error ||
          error.response?.data?.message ||
          "Erro ao registrar movimentação",
      );
    } finally {
      setSalvandoMovimentacao(false);
    }
  };

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
    setMovimentacoes((prev) =>
      prev.map((mov) =>
        mov.id === movimentacaoAtualizada.id ? movimentacaoAtualizada : mov
      )
    );
  };

  // DEPRECADO: Manter por compatibilidade com código antigo
  const iniciarEdicao = (movimentacao) => {
    // Usar o novo modal em vez da edição inline
    abrirModalEdicao(movimentacao);
  };

  const cancelarEdicao = () => {
    setEditandoMovimentacao(null);
    setFormEdicao({
      fichas: "",
      abastecidas: "",
      quantidade_notas_entrada: "",
      valor_entrada_maquininha_pix: "",
    });
  };

  const salvarEdicao = async () => {
    try {
      await api.put(`/movimentacoes/${editandoMovimentacao.id}`, {
        fichas: parseInt(formEdicao.fichas) || 0,
        abastecidas: parseInt(formEdicao.abastecidas) || 0,
        quantidade_notas_entrada:
          formEdicao.quantidade_notas_entrada !== ""
            ? parseFloat(formEdicao.quantidade_notas_entrada)
            : null,
        valor_entrada_maquininha_pix:
          formEdicao.valor_entrada_maquininha_pix !== ""
            ? parseFloat(formEdicao.valor_entrada_maquininha_pix)
            : null,
      });
      setSuccess("Movimentação atualizada com sucesso!");
      cancelarEdicao();
      carregarDados();
    } catch (error) {
      console.error("Erro ao atualizar:", error);
      setError("Erro ao atualizar movimentação");
    }
  };
  const confirmarExclusaoLoja = async () => {
    if (!excluindoEstoqueLoja) return;

    try {
      await api.delete(`/movimentacao-estoque-loja/${excluindoEstoqueLoja.id}`);
      setSuccess("Movimentação de estoque de ponto excluída com sucesso!");
      carregarMovimentacoesEstoqueLoja(); // Recarrega a lista
    } catch (err) {
      console.error("Erro ao excluir:", err);
      setError("Erro ao excluir movimentação de ponto.");
    } finally {
      setExcluindoEstoqueLoja(null); // Fecha o modal
    }
  };

  // Função para salvar edição de loja (Exemplo editando o Responsável)
  const salvarEdicaoLoja = async (e) => {
    e.preventDefault();
    if (!editandoEstoqueLoja) return;

    try {
      await api.put(`/movimentacao-estoque-loja/${editandoEstoqueLoja.id}`, {
        lojaId: editandoEstoqueLoja.loja?.id || editandoEstoqueLoja.lojaId,
        usuarioId: usuario.id,
        produtos: editandoEstoqueLoja.produtosEnviados.map((p) => ({
          produtoId: p.produto?.id || p.produtoId,
          quantidade: Number(p.quantidade),
          tipoMovimentacao: p.tipoMovimentacao || "saida",
        })),
      });

      setSuccess("Movimentação de ponto atualizada!");
      carregarMovimentacoesEstoqueLoja();
      if (typeof carregarDados === "function") carregarDados();
      setEditandoEstoqueLoja(null);
    } catch (err) {
      console.error("Erro ao editar:", err);
      setError("Erro ao atualizar movimentação de ponto.");
    }
  };

  // --- CÁLCULOS DE ESTATÍSTICAS ---
  const entradas = movimentacoes.filter((m) => m.abastecidas > 0);
  const saidas = movimentacoes.filter((m) => m.sairam > 0);
  const totalEntradas = entradas.reduce(
    (sum, m) => sum + (m.abastecidas || 0),
    0,
  );
  const totalSaidas = saidas.reduce((sum, m) => sum + (m.sairam || 0), 0);

  const movimentacoesFiltradas = filtroLojaListagem
    ? movimentacoes
        .filter((mov) => {
          const maquina = maquinas.find((m) => m.id === mov.maquinaId);
          return maquina?.lojaId === filtroLojaListagem;
        })
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    : movimentacoes.sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
      );

  const stats = [
    {
      label: "Total de Entradas",
      value: totalEntradas,
      icon: "📥",
      gradient: "bg-gradient-to-br from-green-500 to-green-600",
      subtitle: "Produtos abastecidos",
    },
    {
      label: "Total de Saídas",
      value: totalSaidas,
      icon: "📤",
      gradient: "bg-gradient-to-br from-red-500 to-red-600",
      subtitle: "Produtos vendidos",
    },
    {
      label: "Saldo",
      value: totalEntradas - totalSaidas,
      icon: "📊",
      gradient: "bg-gradient-to-br from-blue-500 to-blue-600",
      subtitle: "Diferença entrada/saída",
    },
    {
      label: "Movimentações",
      value: movimentacoes.length,
      icon: "🔄",
      gradient: "bg-gradient-to-br from-purple-500 to-purple-600",
      subtitle: "Total de registros",
    },
  ];

  const columns = [
    {
      key: "data",
      label: "Data/Hora",
      render: (mov) => {
        const data = new Date(mov.dataColeta || mov.createdAt);
        return (
          <div>
            <div className="font-semibold">
              {data.toLocaleDateString("pt-BR")}
            </div>
            <div className="text-xs text-gray-500">
              {data.toLocaleTimeString("pt-BR")}
            </div>
          </div>
        );
      },
    },
    {
      key: "usuario",
      label: "Usuário",
      render: (mov) => (
        <div className="flex items-center gap-1">
          <span className="text-lg">👤</span>
          <span className="text-sm font-medium text-gray-700">
            {mov.usuario?.nome || "Não informado"}
          </span>
        </div>
      ),
    },
    {
      key: "tipo",
      label: "Tipo",
      render: (mov) => {
        const isEntrada = mov.abastecidas > 0;
        return (
          <Badge variant={isEntrada ? "success" : "danger"}>
            {isEntrada ? "📥 Entrada" : "📤 Saída"}
          </Badge>
        );
      },
    },
    {
      key: "produto",
      label: "Produto",
      render: (mov) => {
        const produtoId = mov.detalhesProdutos?.[0]?.produtoId;
        const produto = produtos.find((p) => p.id === produtoId);
        return produto ? (
          <div className="flex items-center gap-2">
            <span className="text-xl">{produto.emoji || "🧸"}</span>
            <span>{produto.nome}</span>
          </div>
        ) : (
          `N/A (ID: ${produtoId || "undefined"})`
        );
      },
    },
    {
      key: "maquina",
      label: "Máquina",
      render: (mov) => {
        const maquina =
          mov.maquina || maquinas.find((m) => m.id === mov.maquinaId);
        if (!maquina) return `N/A (ID: ${mov.maquinaId})`;
        const loja = lojas.find((l) => l.id === maquina.lojaId);
        return (
          <div>
            <div className="font-semibold">
              {maquina.codigo}
              <span className="text-gray-500 text-xs ml-1">
                - {maquina.nome}
              </span>
            </div>
            <div className="text-xs text-gray-500">{loja?.nome || "N/A"}</div>
          </div>
        );
      },
    },
    {
      key: "saida",
      label: "Saída",
      render: (mov) => (
        <div className="flex items-center gap-1">
          <span className="text-lg">📤</span>
          <span className="font-bold text-red-600">
            {mov.sairam > 0 ? `-${mov.sairam}` : "-"}
          </span>
        </div>
      ),
    },
    {
      key: "entrada",
      label: "Entrada",
      render: (mov) => (
        <div className="flex items-center gap-1">
          <span className="text-lg">📥</span>
          <span className="font-bold text-green-600">
            {mov.abastecidas > 0 ? `+${mov.abastecidas}` : "-"}
          </span>
        </div>
      ),
    },
    {
      key: "fichas",
      label: "Fichas",
      render: (mov) => (
        <div className="flex items-center gap-1">
          <span className="text-lg">🎫</span>
          <span className="font-semibold text-blue-600">{mov.fichas || 0}</span>
        </div>
      ),
    },
    {
      key: "contadorIn",
      label: "IN",
      render: (mov) => (
        <div className="flex items-center gap-1">
          <span className="text-lg">⬆️</span>
          <span className="font-semibold text-blue-600">
            {mov.contadorIn?.toLocaleString("pt-BR") || "-"}
          </span>
        </div>
      ),
    },
    {
      key: "contadorOut",
      label: "OUT",
      render: (mov) => (
        <div className="flex items-center gap-1">
          <span className="text-lg">⬇️</span>
          <span className="font-semibold text-purple-600">
            {mov.contadorOut?.toLocaleString("pt-BR") || "-"}
          </span>
        </div>
      ),
    },
    {
      key: "justificativa",
      label: "Quebra de Ordem",
      render: (mov) => {
        console.log(
          `🔍 Renderizando justificativa para mov ${mov.id}:`,
          mov.justificativa_ordem,
        );
        return mov.justificativa_ordem ? (
          <div className="max-w-xs">
            <div className="px-2 py-1 bg-orange-50 border border-orange-200 rounded text-xs">
              <span className="font-bold text-orange-800">⚠️</span>
              <p className="text-orange-900 mt-1">{mov.justificativa_ordem}</p>
            </div>
          </div>
        ) : (
          <span className="text-gray-400 text-xs">-</span>
        );
      },
    },
    {
      key: "observacao",
      label: "Observação",
      render: (mov) => (
        <span className="text-sm text-gray-600">{mov.observacoes || "-"}</span>
      ),
    },
  ];

  if (usuario?.role === "ADMIN") {
    columns.push({
      key: "acoes",
      label: "Ações",
      render: (mov) => {
        // Verificar se o usuário pode editar (ADMIN ou criador)
        const podeEditarMov = podeEditar(mov);
        
        return (
          <button
            onClick={() => abrirModalEdicao(mov)}
            disabled={!podeEditarMov}
            className={`px-3 py-1 ${
              podeEditarMov
                ? "bg-blue-500 hover:bg-blue-600"
                : "bg-gray-300 cursor-not-allowed"
            } text-white text-sm rounded-lg transition-colors flex items-center gap-1`}
            title={podeEditarMov ? "Editar movimentação" : "Sem permissão para editar"}
          >
            <svg
              className="w-4 h-4"
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
        );
      },
    });
  } else {
    // Para não-ADMIN, permitir editar apenas suas próprias movimentações
    columns.push({
      key: "acoes",
      label: "Ações",
      render: (mov) => {
        const podeEditarMov = podeEditar(mov);
        
        if (!podeEditarMov) return null;
        
        return (
          <button
            onClick={() => abrirModalEdicao(mov)}
            className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-lg transition-colors flex items-center gap-1"
            title="Editar movimentação"
          >
            <svg
              className="w-4 h-4"
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
        );
      },
    });
  }

  if (loading) return <PageLoader />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#62A1D9] via-[#A6806A] to-[#24094E] text-[#24094E]">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header com dois botões lado a lado */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <PageHeader
            title="Movimentações"
            subtitle="Registre entradas e saídas de produtos nas máquinas"
            icon="🔄"
            action={null}
          />
          <div className="flex gap-3">
            <button
              className="px-6 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 font-bold shadow text-base"
              onClick={() => setShowForm((v) => !v)}
            >
              {showForm ? "Cancelar" : "Nova Movimentação"}
            </button>
            <button
              className="px-6 py-2 bg-blue-700 text-white rounded hover:bg-blue-800 font-bold shadow text-base"
              onClick={() => setModalRegistrarDinheiro(true)}
            >
              Registrar Dinheiro
            </button>
          </div>
        </div>
        {/* Modal Registrar Dinheiro */}
        {modalRegistrarDinheiro && (
          <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
            <div
              className="bg-white rounded-lg p-6 shadow-lg relative"
              style={{ minWidth: 520 }}
            >
              <button
                onClick={() => setModalRegistrarDinheiro(false)}
                style={{
                  position: "absolute",
                  top: 12,
                  right: 16,
                  fontSize: 22,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#888",
                }}
                aria-label="Fechar"
              >
                ×
              </button>
              <RegistrarDinheiro
                lojas={lojas}
                maquinas={maquinas}
                onSubmit={async (data) => {
                  try {
                    setError("");
                    setSuccess("");
                    await api.post("/registro-dinheiro", data);
                    setSuccess("Registro de dinheiro salvo com sucesso!");
                    setModalRegistrarDinheiro(false);
                  } catch (err) {
                    setError(
                      err?.response?.data?.error ||
                        "Erro ao registrar dinheiro.",
                    );
                  }
                }}
              />
            </div>
          </div>
        )}

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

        {usuario?.role === "ADMIN" && <StatsGrid stats={stats} />}

        <AvisosMaquinasFaltam lojas={lojas} />

        {/* Filtro por Ponto - Apenas para ADMIN */}
        {usuario?.role === "ADMIN" && (
          <div className="card-gradient mb-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="text-2xl">🔍</span>
              Filtrar Movimentações
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  🏪 Filtrar por Ponto
                </label>
                <select
                  value={filtroLojaListagem}
                  onChange={(e) => setFiltroLojaListagem(e.target.value)}
                  className="input-field"
                >
                  <option value="">Todos os pontos</option>
                  {lojas.map((loja) => (
                    <option key={loja.id} value={loja.id}>
                      {loja.nome}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {showForm && (
          <div className="card-gradient mb-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="text-2xl">📝</span>
              Registrar Movimentação
            </h3>

            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800 flex items-center gap-2">
                <svg
                  className="w-4 h-4"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                    clipRule="evenodd"
                  />
                </svg>
                <strong>Como funciona:</strong> Informe quantos produtos tem
                AGORA na máquina (o sistema calcula o que saiu). Se abastecer,
                informe quantos foram adicionados.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {!isFuncionarioAbastecedor ? (
                <>
                  {/* Contadores da Máquina */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        📥 Contador Entrada (Entrada)
                      </label>
                      <input
                        type="number"
                        name="contadorIn"
                        value={formData.contadorIn}
                        onChange={handleChange}
                        className="input-field"
                        placeholder="0"
                        min="0"
                        required={!formData.ignoreInOut}
                        disabled={formData.ignoreInOut}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Número do contador Entrada da máquina
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        📤 Contador Saída (Saída)
                      </label>
                      <input
                        type="number"
                        name="contadorOut"
                        value={formData.contadorOut}
                        onChange={handleChange}
                        className="input-field"
                        placeholder="0"
                        min="0"
                        required={!formData.ignoreInOut}
                        disabled={formData.ignoreInOut}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Número do contador Saída da máquina
                      </p>
                    </div>
                  </div>
                  {/* Checkbox para ignorar IN/OUT */}
                  <div className="flex items-center mt-2 mb-4">
                    <input
                      type="checkbox"
                      id="ignoreInOut"
                      name="ignoreInOut"
                      checked={formData.ignoreInOut || false}
                      onChange={handleChange}
                      className="mr-2"
                    />
                    <label
                      htmlFor="ignoreInOut"
                      className="text-sm text-gray-700"
                    >
                      Não preciso informar IN/OUT nesta movimentação
                    </label>
                  </div>

                  {resumoContadores && (
                    <div className="mb-4 p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
                      <p className="text-sm font-semibold text-indigo-900">
                        Sugestões automáticas de contagem
                      </p>
                      <p className="text-xs text-indigo-700 mt-1">
                        OUT sugerido acumulado:{" "}
                        {resumoContadores.contadorOutSugerido || 0}
                      </p>
                      <p className="text-xs text-indigo-700">
                        Era para ter na máquina:{" "}
                        {resumoContadores.totalPreEsperado ?? 0}
                      </p>
                      <p className="text-xs text-indigo-700">
                        Sugestão de abastecimento:{" "}
                        {resumoContadores.sugestaoAbastecimento ?? 0}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <p className="text-sm text-gray-700">
                    Para o perfil de funcionário, os campos IN/OUT não precisam
                    ser digitados nesta movimentação.
                  </p>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    📦 Quantidade Atual na Máquina *
                  </label>
                  <input
                    type="number"
                    name="quantidadeAtualMaquina"
                    value={formData.quantidadeAtualMaquina}
                    onChange={handleChange}
                    className="input-field"
                    placeholder="0"
                    min="0"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Quantos produtos tem agora
                  </p>
                  {formData.quantidadeAtualMaquina && estoqueAnterior > 0 && (
                    <p className="text-xs font-semibold text-red-600 mt-1">
                      🔻 Saíram:{" "}
                      {Math.max(
                        0,
                        estoqueAnterior -
                          parseInt(formData.quantidadeAtualMaquina || 0),
                      )}{" "}
                      unidades
                    </p>
                  )}
                  {alertaDivergencia && (
                    <div className="mt-2 p-3 bg-yellow-50 border-l-4 border-yellow-400 rounded">
                      <div className="flex items-start">
                        <span className="text-yellow-600 text-lg mr-2">⚠️</span>
                        <div className="flex-1">
                          <p className="text-xs font-bold text-yellow-800 mb-1">
                            Atenção: Possível erro de contagem!
                          </p>
                          {alertaDivergencia.tipo === "out_abaixo_sugerido" ? (
                            <p className="text-xs text-yellow-700">
                              OUT digitado ({alertaDivergencia.contadorOutAtual}
                              ) está abaixo do OUT sugerido acumulado (
                              {alertaDivergencia.contadorOutSugerido}).
                            </p>
                          ) : (
                            <p className="text-xs text-yellow-700">
                              Era para ter {alertaDivergencia.totalPreEsperado}{" "}
                              na máquina, mas foi informado{" "}
                              {alertaDivergencia.totalPreInformado}.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    📥 Quantidade Adicionada
                  </label>
                  <input
                    type="number"
                    name="quantidadeAdicionada"
                    value={formData.quantidadeAdicionada}
                    onChange={handleChange}
                    className="input-field"
                    placeholder="0"
                    min="0"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Quantos produtos foram adicionados
                  </p>
                  {formData.quantidadeAdicionada &&
                    formData.quantidadeAtualMaquina && (
                      <p className="text-xs font-semibold text-green-600 mt-1">
                        ✅ Novo total:{" "}
                        {parseInt(formData.quantidadeAtualMaquina || 0) +
                          parseInt(formData.quantidadeAdicionada || 0)}{" "}
                        unidades
                      </p>
                    )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    🎫 Quantidade de Fichas
                  </label>
                  <input
                    type="number"
                    name="fichas"
                    value={formData.fichas}
                    onChange={handleChange}
                    className="input-field"
                    placeholder="0"
                    min="0"
                    disabled={formData.retiradaEstoque}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Fichas coletadas da máquina
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    ❌ Retirada de Produto
                  </label>
                  <input
                    type="number"
                    name="retiradaProduto"
                    value={formData.retiradaProduto}
                    onChange={handleChange}
                    className="input-field"
                    placeholder="0"
                    min="0"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Quantidade de produtos retirados (não conta como saída
                    financeira)
                  </p>
                  <label className="flex items-center mt-2 gap-2">
                    <input
                      type="checkbox"
                      name="retiradaProdutoDevolverEstoque"
                      checked={formData.retiradaProdutoDevolverEstoque || false}
                      onChange={handleChange}
                      className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                    />
                    <span className="text-xs text-green-700">
                      Devolver retirada para o estoque do ponto
                    </span>
                  </label>
                </div>
              </div>

              {/* Checkbox de Retirada de Estoque */}
              <div className="p-4 bg-linear-to-r from-orange-50 to-yellow-50 border-2 border-orange-200 rounded-lg">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    name="retiradaEstoque"
                    checked={formData.retiradaEstoque}
                    onChange={handleChange}
                    className="w-5 h-5 text-orange-600 bg-gray-100 border-gray-300 rounded focus:ring-orange-500 focus:ring-2 cursor-pointer"
                  />
                  <div className="flex-1">
                    <span className="text-sm font-bold text-orange-900">
                      📦 Retirada de Estoque (não conta como dinheiro)
                    </span>
                    <p className="text-xs text-orange-700 mt-1">
                      Marque esta opção quando estiver retirando produtos da
                      máquina sem que seja uma venda (exemplo: produtos
                      danificados, devolução, transferência). As fichas serão
                      automaticamente zeradas.
                    </p>
                  </div>
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Ponto *
                  </label>
                  <select
                    value={filtroLojaForm}
                    onChange={(e) => {
                      setFiltroLojaForm(e.target.value);
                      setFormData({ ...formData, maquina_id: "" });
                    }}
                    className="select-field"
                    required
                  >
                    <option value="">Selecione um ponto...</option>
                    {lojas
                      .filter((l) => l.ativo)
                      .map((loja) => (
                        <option key={loja.id} value={loja.id}>
                          {loja.nome}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Máquina *
                  </label>
                  <select
                    name="maquina_id"
                    value={formData.maquina_id}
                    onChange={handleChange}
                    className="select-field"
                    required
                    disabled={!filtroLojaForm}
                  >
                    <option value="">
                      {filtroLojaForm
                        ? "Selecione uma máquina..."
                        : "Primeiro selecione um ponto"}
                    </option>
                    {maquinas
                      .filter(
                        (m) => !filtroLojaForm || m.lojaId === filtroLojaForm,
                      )
                      .map((maquina) => (
                        <option key={maquina.id} value={maquina.id}>
                          {maquina.nome} - {maquina.codigo}
                        </option>
                      ))}
                  </select>
                  {filtroLojaForm && (
                    <p className="text-xs text-gray-500 mt-1">
                      💡 Mostrando apenas máquinas do ponto selecionado
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Produto *
                  </label>
                  <select
                    name="produto_id"
                    value={formData.produto_id}
                    onChange={handleChange}
                    className="select-field"
                  >
                    <option value="">Nenhum produto</option>
                    {produtosDisponiveis.map((produto) => (
                      <option key={produto.id} value={produto.id}>
                        {produto.emoji || "🧸"} {produto.nome}
                      </option>
                    ))}
                  </select>
                  {isPerfilFuncionario && produtosDisponiveis.length === 0 && (
                    <p className="text-xs text-orange-600 mt-1">
                      {formData.origemEstoque === "loja"
                        ? "Nenhum produto cadastrado no estoque desta loja."
                        : "Nenhum produto com saldo disponível no seu estoque."}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Origem do Estoque
                  </label>
                  <select
                    name="origemEstoque"
                    value={formData.origemEstoque || "usuario"}
                    onChange={handleChange}
                    className="select-field"
                  >
                    <option value="usuario">Meu estoque</option>
                    <option value="loja">Estoque do ponto</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Ao escolher estoque do ponto, pode ser solicitada
                    confirmação.
                  </p>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Observação
                  </label>
                  <textarea
                    name="observacao"
                    value={formData.observacao}
                    onChange={handleChange}
                    className="input-field"
                    rows="2"
                    placeholder="Informações adicionais sobre a movimentação..."
                  />
                </div>
              </div>

              <div className="flex gap-4 justify-end pt-4 border-t border-gray-200">
                {error && (
                  <AlertBox
                    type="error"
                    message={error}
                    onClose={() => setError("")}
                  />
                )}
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setFiltroLojaForm("");
                  }}
                  className="btn-secondary"
                  disabled={salvandoMovimentacao}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={salvandoMovimentacao}
                >
                  {salvandoMovimentacao ? (
                    <span className="flex items-center gap-2">
                      <svg
                        className="animate-spin h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      Salvando...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      Registrar Movimentação
                    </span>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Histórico de Movimentações - Apenas para ADMIN */}
        {usuario?.role === "ADMIN" && (
          <div className="card-gradient">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="text-2xl">📋</span>
              Histórico de Movimentações
              {filtroLojaListagem && (
                <span className="text-sm text-gray-600 font-normal">
                  ({movimentacoesFiltradas.length} de {movimentacoes.length}{" "}
                  registros)
                </span>
              )}
            </h3>

            {(() => {
              console.log(
                "🔍 Movimentações filtradas para exibição:",
                movimentacoesFiltradas,
              );
              console.log(
                "🔍 Movimentações com justificativa na lista filtrada:",
                movimentacoesFiltradas.filter((m) => m.justificativa_ordem),
              );
              return null;
            })()}

            {movimentacoesFiltradas.length > 0 ? (
              <DataTable headers={columns} data={movimentacoesFiltradas} />
            ) : (
              <EmptyState
                icon="🔄"
                title={
                  filtroLojaListagem
                    ? "Nenhuma movimentação encontrada"
                    : "Nenhuma movimentação registrada"
                }
                message={
                  filtroLojaListagem
                    ? "Não há movimentações para o ponto selecionado."
                    : "Registre sua primeira movimentação para começar o controle de estoque!"
                }
                action={{
                  label: "Nova Movimentação",
                  onClick: () => setShowForm(true),
                }}
              />
            )}
          </div>
        )}

        {/* Seção Movimentações de Estoque de Loja - visível apenas para ADMIN */}
        {usuario?.role === "ADMIN" && (
          <div className="mt-12">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <span className="text-3xl">🏪</span>
              Movimentações de Estoque de Loja
            </h2>
            {/* Filtros */}
            <div className="mb-4 flex flex-wrap gap-4">
              <select
                className="input-field"
                value={filtroLojaEstoque}
                onChange={(e) => setFiltroLojaEstoque(e.target.value)}
              >
                <option value="">Todas as lojas</option>
                {lojas.map((loja) => (
                  <option key={loja.id} value={loja.id}>
                    {loja.nome}
                  </option>
                ))}
              </select>
              <input
                type="date"
                className="input-field"
                value={filtroDataEstoque}
                onChange={(e) => setFiltroDataEstoque(e.target.value)}
              />
              <input
                type="text"
                className="input-field"
                placeholder="Responsável"
                value={filtroResponsavelEstoque}
                onChange={(e) => setFiltroResponsavelEstoque(e.target.value)}
              />
            </div>
            <TabelaMovimentacoesEstoqueDeLoja
              movimentacoesEstoqueLoja={movimentacoesEstoqueLoja}
              lojas={lojas}
              filtroLojaEstoque={filtroLojaEstoque}
              filtroDataEstoque={filtroDataEstoque}
              filtroResponsavelEstoque={filtroResponsavelEstoque}
              setEditandoEstoqueLoja={setEditandoEstoqueLoja}
              setExcluindoEstoqueLoja={setExcluindoEstoqueLoja}
              onChangeEstoqueLoja={carregarDados}
            />
          </div>
        )}

        {/* Modal de Edição */}
        {editandoMovimentacao && usuario?.role === "ADMIN" && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <span className="text-2xl">✏️</span>
                  Editar Movimentação
                </h3>
                <button
                  onClick={cancelarEdicao}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">
                    <strong>Data:</strong>{" "}
                    {new Date(
                      editandoMovimentacao.dataColeta ||
                        editandoMovimentacao.createdAt,
                    ).toLocaleString("pt-BR")}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    <strong>Máquina:</strong>{" "}
                    {maquinas.find(
                      (m) => m.id === editandoMovimentacao.maquinaId,
                    )?.codigo || "N/A"}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    🎫 Quantidade de Fichas
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formEdicao.fichas}
                    onChange={(e) =>
                      setFormEdicao({ ...formEdicao, fichas: e.target.value })
                    }
                    className="input-field"
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    📦 Quantidade Abastecida
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formEdicao.abastecidas}
                    onChange={(e) =>
                      setFormEdicao({
                        ...formEdicao,
                        abastecidas: e.target.value,
                      })
                    }
                    className="input-field"
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    💵 Quantidade de Notas
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formEdicao.quantidade_notas_entrada}
                    onChange={(e) =>
                      setFormEdicao({
                        ...formEdicao,
                        quantidade_notas_entrada: e.target.value,
                      })
                    }
                    className="input-field"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    💳 Valor Digital (Pix/Maquininha) (R$)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formEdicao.valor_entrada_maquininha_pix}
                    onChange={(e) =>
                      setFormEdicao({
                        ...formEdicao,
                        valor_entrada_maquininha_pix: e.target.value,
                      })
                    }
                    className="input-field"
                    placeholder="0.00"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={cancelarEdicao}
                    className="flex-1 btn-secondary"
                  >
                    Cancelar
                  </button>
                  <button onClick={salvarEdicao} className="flex-1 btn-primary">
                    Salvar Alterações
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      {/* --- MODAL DE EXCLUSÃO DE ESTOQUE LOJA --- */}
      {excluindoEstoqueLoja && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                <svg
                  className="h-6 w-6 text-red-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900">
                Excluir Movimentação?
              </h3>
              <p className="text-sm text-gray-500 mt-2">
                Tem certeza que deseja excluir esta movimentação de estoque da
                loja? Esta ação não pode ser desfeita.
              </p>
              <div className="mt-6 flex justify-center gap-3">
                <button
                  onClick={() => setExcluindoEstoqueLoja(null)}
                  className="btn-secondary"
                >
                  Cancelar
                </button>
                <button onClick={confirmarExclusaoLoja} className="btn-danger">
                  Sim, Excluir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL DE EDIÇÃO DE ESTOQUE LOJA --- */}
      {editandoEstoqueLoja && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              ✏️ Editar Produtos Enviados
            </h3>
            <form onSubmit={salvarEdicaoLoja}>
              <div className="p-3 bg-gray-50 rounded mb-4">
                <p className="text-xs text-gray-500">
                  Data:{" "}
                  {editandoEstoqueLoja.data
                    ? new Date(editandoEstoqueLoja.data).toLocaleString("pt-BR")
                    : "-"}
                </p>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Produtos Enviados
                </label>
                {editandoEstoqueLoja.produtosEnviados &&
                editandoEstoqueLoja.produtosEnviados.length > 0 ? (
                  editandoEstoqueLoja.produtosEnviados.map((prod, idx) => (
                    <div
                      key={prod.id || idx}
                      className="flex gap-2 mb-2 items-center"
                    >
                      <span className="min-w-30">
                        {prod.produto?.nome || prod.produtoId}
                      </span>
                      <input
                        type="number"
                        min="0"
                        value={prod.quantidade}
                        onChange={(e) => {
                          const novaLista =
                            editandoEstoqueLoja.produtosEnviados.map((p, i) =>
                              i === idx
                                ? { ...p, quantidade: e.target.value }
                                : p,
                            );
                          setEditandoEstoqueLoja({
                            ...editandoEstoqueLoja,
                            produtosEnviados: novaLista,
                          });
                        }}
                        className="input-field w-24"
                      />
                      <select
                        value={prod.tipoMovimentacao}
                        onChange={(e) => {
                          const novaLista =
                            editandoEstoqueLoja.produtosEnviados.map((p, i) =>
                              i === idx
                                ? { ...p, tipoMovimentacao: e.target.value }
                                : p,
                            );
                          setEditandoEstoqueLoja({
                            ...editandoEstoqueLoja,
                            produtosEnviados: novaLista,
                          });
                        }}
                        className="input-field w-28"
                      >
                        <option value="entrada">Entrada</option>
                        <option value="saida">Saída</option>
                      </select>
                    </div>
                  ))
                ) : (
                  <span className="text-gray-500">Nenhum produto enviado</span>
                )}
              </div>
              <div className="flex gap-3 justify-end mt-6">
                <button
                  type="button"
                  onClick={() => setEditandoEstoqueLoja(null)}
                  className="btn-secondary"
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
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

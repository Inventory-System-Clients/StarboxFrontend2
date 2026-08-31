import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";

import api, { basesSecundariasAPI } from "../services/api";
import { listarRevisoesPendentes } from "../services/revisoesVeiculos";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer.jsx";
import { PageLoader } from "../components/Loading";
import { Badge } from "../components/UIComponents";
import AlertAdmin from "../components/AlertAdmin";
import { useAuth } from "../contexts/AuthContext.jsx";
import DashboardGastosRoteirosTab from "../components/DashboardGastosRoteirosTab";
import AjusteMaquinaAtual from "../components/AjusteMaquinaAtual";
import PainelAbastecedor from "../components/PainelAbastecedor";
import PainelFuncionarioTodasLojas from "../components/PainelFuncionarioTodasLojas";
import { compartilharEstoquePessoal } from "../lib/compartilharEstoque";

import Swal from "sweetalert2";

export function Dashboard() {
  const { usuario } = useAuth();
  // Estado para saber se há manutenção pendente atribuída ao usuário
  const [temManutencaoPendente, setTemManutencaoPendente] = useState(false);
  // Buscar manutenções pendentes atribuídas ao usuário
  useEffect(() => {
    let cancelado = false;
    async function buscarManutencoesPendentes() {
      if (!usuario?.id) return;
      try {
        const res = await api.get(
          "/manutencoes?status=pendente&all=true",
        );
        const pendentes = Array.isArray(res.data) ? res.data : [];
        const atribuida = pendentes.some((m) => m.funcionarioId === usuario.id);
        if (!cancelado) setTemManutencaoPendente(atribuida);
      } catch {
        if (!cancelado) setTemManutencaoPendente(false);
      }
    }
    buscarManutencoesPendentes();
    // Atualiza a cada 30s
    const interval = setInterval(buscarManutencoesPendentes, 30000);
    return () => {
      cancelado = true;
      clearInterval(interval);
    };
  }, [usuario?.id]);
  const navigate = useNavigate();
  const [mostrarTodosAlertasMaquinas, setMostrarTodosAlertasMaquinas] =
    useState(false);
  const [produtos, setProdutos] = useState([]);

  const isFuncionario =
    usuario?.role === "FUNCIONARIO" || usuario?.role === "ABASTECEDOR";
  // Abastecedor so usa Rotas e Gerenciamento de Estoque no dia a dia — o resto do
  // dashboard (alerta de inatividade, manutencoes etc.) nao se aplica a ele.
  const isAbastecedor = usuario?.role === "ABASTECEDOR";
  const isFuncionarioTodasLojas = usuario?.role === "FUNCIONARIO_TODAS_LOJAS";
  const isAdminLike =
    usuario?.role === "ADMIN" ||
    usuario?.role === "GERENCIADOR" ||
    usuario?.role === "GERENTE";
  const roleUsuarioNormalizado = String(usuario?.role || "").toUpperCase();
  const ocultarAbaRevisaoVeiculos =
    roleUsuarioNormalizado === "FUNCIONARIO" ||
    roleUsuarioNormalizado === "FUNCIONARIO_TODAS_LOJAS" ||
    roleUsuarioNormalizado.includes("ABASTECEDOR");
  const podeVerAbaRevisaoVeiculos =
    !ocultarAbaRevisaoVeiculos &&
    roleUsuarioNormalizado !== "CONTROLADOR_ESTOQUE";
  const resumoCardsGridClass = "grid gap-4 md:gap-6 mb-8";

  // Lembrete de compartilhar o estoque pessoal: toda sexta-feira, só pra
  // quem tem estoque pessoal de verdade (funcionário/abastecedor). Some
  // depois de compartilhar ou dispensar, volta na sexta seguinte porque a
  // chave do localStorage inclui a data do dia.
  const [lembreteEstoqueVisivel, setLembreteEstoqueVisivel] = useState(false);
  const [compartilhandoEstoqueLembrete, setCompartilhandoEstoqueLembrete] =
    useState(false);
  const chaveLembreteEstoqueHoje = () => {
    const hoje = new Date().toISOString().slice(0, 10);
    return `starbox:lembrete-estoque:${usuario?.id}:${hoje}`;
  };

  useEffect(() => {
    if (!usuario?.id || !(isFuncionario || isFuncionarioTodasLojas)) {
      setLembreteEstoqueVisivel(false);
      return;
    }
    const hojeEhSexta = new Date().getDay() === 5;
    if (!hojeEhSexta) {
      setLembreteEstoqueVisivel(false);
      return;
    }
    const jaTratadoHoje = localStorage.getItem(chaveLembreteEstoqueHoje());
    setLembreteEstoqueVisivel(!jaTratadoHoje);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario?.id, isFuncionario, isFuncionarioTodasLojas]);

  const dispensarLembreteEstoque = () => {
    localStorage.setItem(chaveLembreteEstoqueHoje(), "1");
    setLembreteEstoqueVisivel(false);
  };

  const handleCompartilharEstoqueLembrete = async () => {
    if (compartilhandoEstoqueLembrete) return;
    // Reserva a aba durante o clique para evitar bloqueio e nao trocar a aba atual.
    const popupReservado = window.open("about:blank", "_blank");
    try {
      setCompartilhandoEstoqueLembrete(true);
      await compartilharEstoquePessoal(usuario, popupReservado);
      dispensarLembreteEstoque();
    } catch {
      Swal.fire(
        "Erro",
        "Não foi possível carregar o estoque pra compartilhar.",
        "error",
      );
    } finally {
      setCompartilhandoEstoqueLembrete(false);
    }
  };
  const [stats, setStats] = useState({
    alertas: [],
    balanco: null,
    loading: true,
  });
  const [basesSecundarias, setBasesSecundarias] = useState([]);
  const [loadingBasesSecundarias, setLoadingBasesSecundarias] = useState(false);
  const [erroBasesSecundarias, setErroBasesSecundarias] = useState("");
  const [modalBaseSecundariaAberto, setModalBaseSecundariaAberto] =
    useState(false);
  const [salvandoBaseSecundaria, setSalvandoBaseSecundaria] = useState(false);
  const [baseSecundariaEditando, setBaseSecundariaEditando] = useState(null);
  const [formBaseSecundaria, setFormBaseSecundaria] = useState({
    nomeBase: "",
    ativo: true,
  });
  const [produtosSelecionadosBaseSecundaria, setProdutosSelecionadosBaseSecundaria] =
    useState([]);
  const [quantidadePorProdutoBaseSecundaria, setQuantidadePorProdutoBaseSecundaria] =
    useState({});
  const [buscaProdutoBaseSecundaria, setBuscaProdutoBaseSecundaria] =
    useState("");
  const [errosFormBaseSecundaria, setErrosFormBaseSecundaria] = useState({});

  const [mostrarDetalhesProdutos, setMostrarDetalhesProdutos] = useState(false);
  const [vendasPorProduto, setVendasPorProduto] = useState([]);
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");

  const isAdminEstrito = usuario?.role === "ADMIN";

  const normalizarBaseSecundaria = useCallback((base) => {
    const quantidadeNumerica = Number(base?.quantidadeProdutos);
    return {
      id: base?.id || `base-${Date.now()}`,
      nomeBase: String(base?.nomeBase || ""),
      quantidadeProdutos: Number.isNaN(quantidadeNumerica)
        ? 0
        : quantidadeNumerica,
      modelosProdutos: String(base?.modelosProdutos || ""),
      ativo: Boolean(base?.ativo ?? true),
      createdAt: base?.createdAt || null,
      updatedAt: base?.updatedAt || null,
    };
  }, []);

  const formatarDataAtualizacaoBaseSecundaria = useCallback((dataTexto) => {
    if (!dataTexto) return "Não informado";
    const data = new Date(dataTexto);
    if (Number.isNaN(data.getTime())) return "Não informado";
    return data.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, []);

  const carregarBasesSecundarias = useCallback(async () => {
    if (!isAdminEstrito) {
      setBasesSecundarias([]);
      setLoadingBasesSecundarias(false);
      setErroBasesSecundarias("");
      return;
    }

    try {
      setLoadingBasesSecundarias(true);
      setErroBasesSecundarias("");
      const payload = await basesSecundariasAPI.listar();
      const listaBases = Array.isArray(payload) ? payload : [];
      setBasesSecundarias(listaBases.map(normalizarBaseSecundaria));
    } catch (error) {
      console.error("Erro ao carregar bases secundarias:", error);
      setErroBasesSecundarias(
        error?.response?.data?.message ||
          "Não foi possível carregar as bases secundárias.",
      );
      setBasesSecundarias([]);
    } finally {
      setLoadingBasesSecundarias(false);
    }
  }, [isAdminEstrito, normalizarBaseSecundaria]);

  const abrirModalCriarBaseSecundaria = () => {
    setBaseSecundariaEditando(null);
    setErrosFormBaseSecundaria({});
    setProdutosSelecionadosBaseSecundaria([]);
    setQuantidadePorProdutoBaseSecundaria({});
    setBuscaProdutoBaseSecundaria("");
    setFormBaseSecundaria({
      nomeBase: "",
      ativo: true,
    });
    setModalBaseSecundariaAberto(true);
  };

  const abrirModalEditarBaseSecundaria = (base) => {
    const modelosTexto = String(base?.modelosProdutos || "");
    const itensModelos = modelosTexto
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    const produtosSelecionados = [];
    const quantidadesMap = {};

    for (const itemModelo of itensModelos) {
      const matchComParenteses = itemModelo.match(/^(.*)\((\d+)\)$/);
      const matchComX = itemModelo.match(/^(.*)\s+x\s*(\d+)$/i);

      let nomeProduto = itemModelo;
      let quantidade = 1;

      if (matchComParenteses) {
        nomeProduto = matchComParenteses[1].trim();
        quantidade = Number.parseInt(matchComParenteses[2], 10) || 1;
      } else if (matchComX) {
        nomeProduto = matchComX[1].trim();
        quantidade = Number.parseInt(matchComX[2], 10) || 1;
      }

      const produtoEncontrado = (produtos || []).find(
        (produto) =>
          String(produto?.nome || "").trim().toLowerCase() ===
          nomeProduto.toLowerCase(),
      );

      if (!produtoEncontrado) continue;

      const produtoId = String(produtoEncontrado.id);
      if (!produtosSelecionados.includes(produtoId)) {
        produtosSelecionados.push(produtoId);
      }

      quantidadesMap[produtoId] = String(
        (Number.parseInt(quantidadesMap[produtoId], 10) || 0) + quantidade,
      );
    }

    const quantidadeTotalBase = Number.parseInt(base?.quantidadeProdutos, 10) || 0;
    const somaQuantidades = produtosSelecionados.reduce(
      (acc, produtoId) => acc + (Number.parseInt(quantidadesMap[produtoId], 10) || 0),
      0,
    );

    if (quantidadeTotalBase > somaQuantidades && produtosSelecionados.length > 0) {
      const primeiroProdutoId = produtosSelecionados[0];
      quantidadesMap[primeiroProdutoId] = String(
        (Number.parseInt(quantidadesMap[primeiroProdutoId], 10) || 0) +
          (quantidadeTotalBase - somaQuantidades),
      );
    }

    setBaseSecundariaEditando(base);
    setErrosFormBaseSecundaria({});
    setProdutosSelecionadosBaseSecundaria(produtosSelecionados);
    setQuantidadePorProdutoBaseSecundaria(quantidadesMap);
    setBuscaProdutoBaseSecundaria("");
    setFormBaseSecundaria({
      nomeBase: base?.nomeBase || "",
      ativo: base?.ativo ?? true,
    });
    setModalBaseSecundariaAberto(true);
  };

  const fecharModalBaseSecundaria = () => {
    if (salvandoBaseSecundaria) return;
    setModalBaseSecundariaAberto(false);
  };

  const validarFormBaseSecundaria = () => {
    const erros = {};
    const nomeBase = (formBaseSecundaria.nomeBase || "").trim();

    if (!nomeBase) {
      erros.nomeBase = "O nome da base é obrigatório.";
    }

    const possuiQuantidadeInvalida = produtosSelecionadosBaseSecundaria.some(
      (produtoId) => {
        const quantidade = Number.parseInt(
          quantidadePorProdutoBaseSecundaria[produtoId],
          10,
        );
        return !Number.isInteger(quantidade) || quantidade < 0;
      },
    );

    if (possuiQuantidadeInvalida) {
      erros.quantidadeProdutos =
        "A quantidade por produto deve ser um inteiro maior ou igual a zero.";
    }

    setErrosFormBaseSecundaria(erros);
    return Object.keys(erros).length === 0;
  };

  const salvarBaseSecundaria = async (e) => {
    e.preventDefault();

    if (!isAdminEstrito || salvandoBaseSecundaria) return;
    if (!validarFormBaseSecundaria()) return;

    const produtosSelecionadosComQuantidade = (produtos || [])
      .filter((produto) =>
        produtosSelecionadosBaseSecundaria.includes(String(produto.id)),
      )
      .map((produto) => {
        const produtoId = String(produto.id);
        const quantidade =
          Number.parseInt(quantidadePorProdutoBaseSecundaria[produtoId], 10) || 0;

        return {
          nome: String(produto.nome || "").trim(),
          quantidade,
        };
      })
      .filter(Boolean);

    const quantidadeTotalProdutos = produtosSelecionadosComQuantidade.reduce(
      (acc, item) => acc + item.quantidade,
      0,
    );

    const payload = {
      nomeBase: formBaseSecundaria.nomeBase.trim(),
      quantidadeProdutos: quantidadeTotalProdutos,
      modelosProdutos: produtosSelecionadosComQuantidade
        .map((item) => `${item.nome} (${item.quantidade})`)
        .join(", "),
      ativo: Boolean(formBaseSecundaria.ativo),
    };

    try {
      setSalvandoBaseSecundaria(true);
      let baseAtualizada;

      if (baseSecundariaEditando?.id) {
        const resposta = await basesSecundariasAPI.editar(
          baseSecundariaEditando.id,
          payload,
        );
        baseAtualizada = normalizarBaseSecundaria({
          ...baseSecundariaEditando,
          ...payload,
          ...(resposta || {}),
        });

        setBasesSecundarias((prev) =>
          prev.map((base) =>
            base.id === baseSecundariaEditando.id ? baseAtualizada : base,
          ),
        );
      } else {
        const resposta = await basesSecundariasAPI.criar(payload);
        baseAtualizada = normalizarBaseSecundaria(resposta || payload);

        setBasesSecundarias((prev) => [baseAtualizada, ...prev]);
      }

      setModalBaseSecundariaAberto(false);
      Swal.fire({
        icon: "success",
        title: "Sucesso",
        text: baseSecundariaEditando
          ? "Base secundária atualizada com sucesso."
          : "Base secundária adicionada com sucesso.",
        confirmButtonColor: "#fbbf24",
      });
    } catch (error) {
      console.error("Erro ao salvar base secundaria:", error);
      Swal.fire({
        icon: "error",
        title: "Erro ao salvar",
        text:
          error?.response?.data?.message ||
          "Não foi possível salvar a base secundária.",
        confirmButtonColor: "#ef4444",
      });
    } finally {
      setSalvandoBaseSecundaria(false);
    }
  };

  const toggleProdutoBaseSecundaria = (produtoId) => {
    setProdutosSelecionadosBaseSecundaria((prev) => {
      const idTexto = String(produtoId);
      if (prev.includes(idTexto)) {
        setQuantidadePorProdutoBaseSecundaria((quantidadesPrev) => {
          const proximo = { ...quantidadesPrev };
          delete proximo[idTexto];
          return proximo;
        });
        return prev.filter((item) => item !== idTexto);
      }

      setQuantidadePorProdutoBaseSecundaria((quantidadesPrev) => ({
        ...quantidadesPrev,
        [idTexto]: quantidadesPrev[idTexto] || "1",
      }));

      return [...prev, idTexto];
    });
  };

  const atualizarQuantidadeProdutoBaseSecundaria = (produtoId, valorDigitado) => {
    const somenteNumeros = String(valorDigitado || "").replace(/\D/g, "");
    setQuantidadePorProdutoBaseSecundaria((prev) => ({
      ...prev,
      [String(produtoId)]: somenteNumeros,
    }));
  };

  const produtosFiltradosBaseSecundaria = (produtos || []).filter((produto) => {
    const termoBusca = buscaProdutoBaseSecundaria.trim().toLowerCase();
    if (!termoBusca) return true;
    return String(produto?.nome || "").toLowerCase().includes(termoBusca);
  });

  const [alertasEstoqueLoja, setAlertasEstoqueLoja] = useState([]);
  const [alertasEstoqueUsuario, setAlertasEstoqueUsuario] = useState([]);
  const [revisoesPendentes, setRevisoesPendentes] = useState([]);
  const [alertaInatividadeLojas, setAlertaInatividadeLojas] = useState({
    lojas: [],
    carregando: false,
  });

  // Função para remover produto do estoque da loja (usando o id do registro)

  const carregarAlertasEstoqueLoja = async () => {
    try {
      // Uma única chamada batched no backend em vez de 1 requisição por loja.
      const res = await api.get("/estoque-lojas/alertas");
      const alertas = Array.isArray(res.data?.alertas) ? res.data.alertas : [];

      setAlertasEstoqueLoja(
        alertas.map((alerta) => ({
          ...alerta,
          lojaId: alerta.loja?.id,
          lojaNome: alerta.loja?.nome,
          produtoId: alerta.produto?.id,
        })),
      );
    } catch (error) {
      console.error("Erro ao carregar alertas de estoque de lojas:", error);
      setAlertasEstoqueLoja([]);
    }
  };

  const carregarAlertasEstoqueUsuario = async () => {
    try {
      const response = await api.get("/estoque-usuarios/me/alertas");
      const alertas = Array.isArray(response.data)
        ? response.data
        : response.data?.alertas || [];
      setAlertasEstoqueUsuario(alertas);
    } catch (error) {
      console.error("Erro ao carregar alertas de estoque do usuario:", error);
      setAlertasEstoqueUsuario([]);
    }
  };

  // O cálculo (última movimentação/retirada por loja) roda no backend em
  // 2 queries agregadas, em vez de baixar aqui todas as movimentações e todo
  // o fluxo de caixa dos últimos 90 dias só para achar o máximo por loja.
  const carregarAlertaInatividadeLojas = useCallback(async () => {
    setAlertaInatividadeLojas((prev) => ({ ...prev, carregando: true }));

    try {
      const res = await api.get("/relatorios/alertas-inatividade-lojas");
      const lojasComAlerta = Array.isArray(res.data?.lojas)
        ? res.data.lojas
        : [];
      setAlertaInatividadeLojas({ lojas: lojasComAlerta, carregando: false });
    } catch (error) {
      console.error(
        "Erro ao calcular alerta de inatividade das lojas:",
        error,
      );
      setAlertaInatividadeLojas({ lojas: [], carregando: false });
    }
  }, []);

  const carregarDados = useCallback(async () => {
    try {
      const isAdmin =
        usuario?.role === "ADMIN" ||
        usuario?.role === "GERENCIADOR" ||
        usuario?.role === "GERENTE";

      const requisicoes = [
        api.get("/produtos", { params: { all: true } }).catch((err) => {
          console.error("Erro ao carregar produtos:", err.message);
          return { data: [] };
        }),
      ];

      // Adicionar requisições de relatórios apenas para ADMIN
      if (isAdmin) {
        requisicoes.unshift(
          api.get("/relatorios/alertas-estoque").catch((err) => {
            console.error("Erro ao carregar alertas de máquinas:", err.message);
            return { data: { alertas: [] } };
          }),
          // Já vem com totalDinheiro/totalCartaoPix/receitaReal calculados
          // no backend — não precisa mais buscar as movimentações da semana
          // aqui só pra somar esses dois campos.
          api.get("/relatorios/balanco-semanal").catch((err) => {
            console.error("Erro ao carregar balanço:", err.message);
            return { data: null };
          }),
        );
      }

      const resultados = await Promise.all(requisicoes);

      let alertasRes, balancoRes, produtosRes;

      if (isAdmin) {
        [alertasRes, balancoRes, produtosRes] = resultados;
      } else {
        [produtosRes] = resultados;
        alertasRes = { data: { alertas: [] } };
        balancoRes = { data: null };
      }

      console.log("Produtos carregados:", produtosRes.data);
      if (isAdmin) {
        console.log("Balanço semanal:", balancoRes.data);
      }

      const balancoData = balancoRes.data || { totais: {} };
      if (!balancoData.totais) balancoData.totais = {};

      // Buscar lucro diário do backend
      try {
        const lucroDiarioRes = await api.get("/dashboard/lucro-diario");
        balancoData.lucroPorDia = lucroDiarioRes.data;
      } catch (err) {
        console.error("Erro ao buscar lucro diário:", err);
        balancoData.lucroPorDia = {};
      }

      // Valor esperado diário (calculado pelos contadores das máquinas na
      // retirada de dinheiro, usado na conferência de FluxoCaixa) — é o que
      // alimenta o card "Comparativo Mensal".
      try {
        const valorEsperadoRes = await api.get(
          "/dashboard/valor-esperado-diario",
        );
        balancoData.valorEsperadoPorDia = valorEsperadoRes.data;
      } catch (err) {
        console.error("Erro ao buscar valor esperado diário:", err);
        balancoData.valorEsperadoPorDia = {};
      }

      setStats({
        alertas: alertasRes.data?.alertas || [],
        balanco: balancoData,
        loading: false,
      });
      setProdutos(produtosRes.data || []);

      // Alertas de estoque dos pontos só aparecem pra admin/gerenciador,
      // então só vale a pena buscar pra quem realmente vê o widget.
      if (isAdminLike) {
        carregarAlertasEstoqueLoja();
      }

      carregarAlertaInatividadeLojas();

      carregarAlertasEstoqueUsuario();
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      setStats({ alertas: [], balanco: null, loading: false });
    }
  }, [carregarAlertaInatividadeLojas, usuario]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  // Carregar revisões pendentes
  useEffect(() => {
    if (!podeVerAbaRevisaoVeiculos) {
      setRevisoesPendentes([]);
      return;
    }

    const carregarRevisoes = async () => {
      const revisoes = await listarRevisoesPendentes();
      setRevisoesPendentes(revisoes.slice(0, 5)); // Top 5
    };

    carregarRevisoes();

    // Atualizar a cada 5 minutos
    const interval = setInterval(carregarRevisoes, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [podeVerAbaRevisaoVeiculos]);

  useEffect(() => {
    carregarBasesSecundarias();
  }, [carregarBasesSecundarias]);

  const abrirDetalheAlertaInatividade = () => {
    const linhasHtml = alertaInatividadeLojas.lojas
      .map((loja) => {
        const ultimaMov = loja.ultimaMovimentacao
          ? loja.ultimaMovimentacao.toLocaleDateString("pt-BR")
          : "Nunca";
        const ultimaRetirada = loja.ultimaRetirada
          ? loja.ultimaRetirada.toLocaleDateString("pt-BR")
          : "Nunca";

        return `
          <tr>
            <td style="padding:8px;border:1px solid #e5e7eb;">${loja.lojaNome}</td>
            <td style="padding:8px;border:1px solid #e5e7eb;text-align:center;">${loja.diasSemMov}</td>
            <td style="padding:8px;border:1px solid #e5e7eb;text-align:center;">${loja.diasSemRetirada}</td>
            <td style="padding:8px;border:1px solid #e5e7eb;">${ultimaMov}</td>
            <td style="padding:8px;border:1px solid #e5e7eb;">${ultimaRetirada}</td>
          </tr>
        `;
      })
      .join("");

    Swal.fire({
      title: "Lojas com inatividade crítica",
      width: 1000,
      confirmButtonText: "Fechar",
      confirmButtonColor: "#dc2626",
      html: `
        <div style="text-align:left;max-height:60vh;overflow:auto;font-size:14px;">
          <p style="margin-bottom:10px;">
            Critério: <strong>mais de 15 dias sem movimentação</strong> e <strong>mais de 15 dias sem retirada de dinheiro</strong>.
          </p>
          <table style="width:100%;border-collapse:collapse;">
            <thead>
              <tr style="background:#fee2e2;">
                <th style="padding:8px;border:1px solid #e5e7eb;text-align:left;">Ponto</th>
                <th style="padding:8px;border:1px solid #e5e7eb;text-align:center;">Dias sem movimentação</th>
                <th style="padding:8px;border:1px solid #e5e7eb;text-align:center;">Dias sem retirada</th>
                <th style="padding:8px;border:1px solid #e5e7eb;text-align:left;">Última movimentação</th>
                <th style="padding:8px;border:1px solid #e5e7eb;text-align:left;">Última retirada</th>
              </tr>
            </thead>
            <tbody>${linhasHtml}</tbody>
          </table>
        </div>
      `,
    });
  };

  const carregarVendasPorProduto = async () => {
    try {
      // Buscar todos os dados necessários
      const [movRes, produtosRes, lojasRes, maquinasRes] = await Promise.all([
        api.get("/movimentacoes", { params: { pageSize: 1000 } }),
        api.get("/produtos", { params: { all: true } }),
        api.get("/lojas", { params: { all: true } }),
        api.get("/maquinas", { params: { all: true } }),
      ]);

      const movimentacoes = Array.isArray(movRes.data?.data)
        ? movRes.data.data
        : Array.isArray(movRes.data)
          ? movRes.data
          : [];
      const produtosData = produtosRes.data || [];
      const lojasData = lojasRes.data || [];
      const maquinasData = maquinasRes.data || [];

      console.log("Movimentações:", movimentacoes);
      console.log("Produtos:", produtosData);
      console.log("Lojas:", lojasData);
      console.log("Máquinas:", maquinasData);

      // Agrupar vendas por produto
      const produtosMap = {};

      movimentacoes.forEach((mov) => {
        if (mov.detalhesProdutos && Array.isArray(mov.detalhesProdutos)) {
          mov.detalhesProdutos.forEach((detalhe) => {
            const produtoId = detalhe.produtoId;
            const quantidadeSaiu = detalhe.quantidadeSaiu || 0;

            // Buscar o produto no array de produtos
            const produto = produtosData.find((p) => p.id === produtoId);
            const produtoNome = produto?.nome || `Produto ${produtoId}`;

            if (!produtosMap[produtoId]) {
              produtosMap[produtoId] = {
                id: produtoId,
                nome: produtoNome,
                emoji: produto?.emoji || "🧸",
                totalVendido: 0,
                vendasPorLoja: {},
              };
            }

            produtosMap[produtoId].totalVendido += quantidadeSaiu;

            // Buscar a máquina e depois a loja
            const maquina =
              maquinasData.find((m) => m.id === mov.maquinaId) || mov.maquina;
            let lojaNome = "Ponto não identificado";

            if (maquina) {
              // Se a máquina tem loja como objeto
              if (maquina.loja?.nome) {
                lojaNome = maquina.loja.nome;
              }
              // Se a máquina tem lojaId
              else if (maquina.lojaId) {
                const loja = lojasData.find((l) => l.id === maquina.lojaId);
                lojaNome = loja?.nome || lojaNome;
              }
            }

            if (!produtosMap[produtoId].vendasPorLoja[lojaNome]) {
              produtosMap[produtoId].vendasPorLoja[lojaNome] = 0;
            }
            produtosMap[produtoId].vendasPorLoja[lojaNome] += quantidadeSaiu;
          });
        }
      });

      // Converter para array e ordenar por total vendido
      const produtosArray = Object.values(produtosMap)
        .filter((p) => p.totalVendido > 0)
        .sort((a, b) => b.totalVendido - a.totalVendido);

      console.log("Produtos agrupados:", produtosArray);
      setVendasPorProduto(produtosArray);
    } catch (error) {
      console.error("Erro ao carregar vendas por produto:", error);
      setVendasPorProduto([]);
    }
  };

  const toggleDetalhesProdutos = () => {
    if (!mostrarDetalhesProdutos && vendasPorProduto.length === 0) {
      carregarVendasPorProduto();
    }
    setMostrarDetalhesProdutos(!mostrarDetalhesProdutos);
  };

  const abrirDetalheComparativoMensal = () => {
    const hoje = new Date();
    const diaAtual = hoje.getDate();
    const mesAtual = hoje.getMonth() + 1;
    const anoAtual = hoje.getFullYear();

    let total = 0;
    const linhasHtml = [];
    for (let d = 1; d <= diaAtual; d++) {
      const dataStr = `${anoAtual}-${String(mesAtual).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const valor = Number(stats.balanco?.valorEsperadoPorDia?.[dataStr] || 0);
      total += valor;
      linhasHtml.push(`
        <tr>
          <td style="padding:8px;border:1px solid #e5e7eb;">${dataStr}</td>
          <td style="padding:8px;border:1px solid #e5e7eb;text-align:right;">R$ ${valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
        </tr>
      `);
    }

    Swal.fire({
      title: "Detalhamento do Valor Esperado do Mês",
      width: 900,
      confirmButtonText: "Fechar",
      confirmButtonColor: "#f59e0b",
      html: `
        <div style="text-align:left;max-height:60vh;overflow:auto;font-size:14px;">
          <p style="margin-bottom:8px;"><strong>Fonte dos dados:</strong> endpoint <code>/dashboard/valor-esperado-diario</code>.</p>
          <p style="margin-bottom:12px;"><strong>Regra:</strong> valor esperado calculado pelos contadores das máquinas no momento da retirada de dinheiro (mesmo número usado na conferência de FluxoCaixa) — não é o faturamento já confirmado, é o que se espera receber. Somado dia a dia até o dia atual do mês.</p>
          <table style="width:100%;border-collapse:collapse;">
            <thead>
              <tr style="background:#f3f4f6;">
                <th style="padding:8px;border:1px solid #e5e7eb;text-align:left;">Data</th>
                <th style="padding:8px;border:1px solid #e5e7eb;text-align:right;">Valor esperado</th>
              </tr>
            </thead>
            <tbody>
              ${linhasHtml.join("")}
              <tr style="background:#fef3c7;font-weight:700;">
                <td style="padding:8px;border:1px solid #e5e7eb;text-align:right;">Total até hoje</td>
                <td style="padding:8px;border:1px solid #e5e7eb;text-align:right;">R$ ${total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
              </tr>
            </tbody>
          </table>
        </div>
      `,
    });
  };

  if (stats.loading) {
    return <PageLoader />;
  }

  console.log("Estado stats no render:", stats);
  console.log("Fichas no render:", stats.balanco?.totais?.totalFichas);
  console.log("LucroPorDia no render:", stats.balanco?.lucroPorDia);

  return (
    <div className="min-h-screen bg-[rgb(242, 242, 242)];">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header com boas-vindas */}
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2 text-[#24094E]">
              <span className="bg-linear-to-r from-[#62A1D9] via-[#A6806A] to-[#733D38] text-transparent bg-clip-text">
                Dashboard
              </span>{" "}
              🧸
            </h1>
            <p className="text-[#733D38]">
              Visão geral do seu sistema de pelúcias
            </p>
          </div>
          <div className="flex items-center gap-3">
            {!isAbastecedor && alertaInatividadeLojas.lojas.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={
                    isAdminLike ? abrirDetalheAlertaInatividade : undefined
                  }
                  disabled={!isAdminLike}
                  title={
                    isAdminLike
                      ? `Alerta: ${alertaInatividadeLojas.lojas.length} ponto(s) sem movimentação e retirada há mais de 15 dias. Clique para detalhes.`
                      : "Alerta de inatividade de pontos"
                  }
                  className={`w-11 h-11 rounded-full bg-red-600 text-white text-xl flex items-center justify-center shadow-md alert-fade-red ${
                    isAdminLike ? "cursor-pointer" : "cursor-default opacity-90"
                  }`}
                >
                  🚨
                </button>
              </>
            )}
            <button
              onClick={carregarDados}
              className="bg-[#62A1D9] hover:bg-[#24094E] text-white font-bold px-4 py-2 rounded-lg flex items-center gap-2 shadow transition-colors"
              title="Atualizar dados"
            >
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
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Atualizar
            </button>
          </div>
        </div>

        {lembreteEstoqueVisivel && (
          <div className="mb-6 flex flex-col gap-3 rounded-xl border-2 border-orange-300 bg-orange-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="text-2xl" aria-hidden="true">
                📤
              </span>
              <div>
                <p className="font-bold text-orange-900">
                  Sexta-feira: compartilhe seu estoque
                </p>
                <p className="text-sm text-orange-800">
                  Manda seu estoque pessoal atualizado no WhatsApp antes de
                  fechar a semana.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={handleCompartilharEstoqueLembrete}
                disabled={compartilhandoEstoqueLembrete}
                className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-bold text-white hover:bg-orange-700 disabled:opacity-60"
              >
                {compartilhandoEstoqueLembrete
                  ? "Enviando..."
                  : "Compartilhar agora"}
              </button>
              <button
                type="button"
                onClick={dispensarLembreteEstoque}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-orange-700 hover:bg-orange-100"
              >
                Agora não
              </button>
            </div>
          </div>
        )}

        {isAbastecedor && <PainelAbastecedor />}
        {isFuncionarioTodasLojas && <PainelFuncionarioTodasLojas />}

        {/* Cards de Resumo com design moderno - Apenas para ADMIN */}
        {isAdminLike ? (
          <div
            className={resumoCardsGridClass}
            style={{
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            }}
          >
            {/* Faturamento Semanal */}
            {usuario?.role === "ADMIN" && (
              <div
                className="stat-card bg-linear-to-br from-yellow-500 to-orange-500 p-4 sm:p-6 rounded-xl shadow-md flex flex-col justify-between min-h-30 cursor-pointer"
                onClick={abrirDetalheComparativoMensal}
              >
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium opacity-90">
                      Comparativo Mensal
                      <span className="block text-[10px] font-semibold uppercase tracking-wide opacity-80">
                        Valor Esperado
                      </span>
                    </h3>
                    <svg
                      className="w-8 h-8 opacity-80"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"
                      />
                    </svg>
                  </div>
                  <p className="text-3xl font-bold">
                    R${" "}
                    {(() => {
                      // Valor esperado consolidado do mês atual (todas as lojas) —
                      // calculado pelos contadores das máquinas na retirada de
                      // dinheiro, não o faturamento já confirmado.
                      const hoje = new Date();
                      const diaAtual = hoje.getDate();
                      const mesAtual = hoje.getMonth() + 1;
                      const anoAtual = hoje.getFullYear();
                      let totalValorEsperadoMes = 0;
                      for (let d = 1; d <= diaAtual; d++) {
                        const dataStr = `${anoAtual}-${String(mesAtual).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                        totalValorEsperadoMes += Number(
                          stats.balanco?.valorEsperadoPorDia?.[dataStr] || 0,
                        );
                      }
                      return totalValorEsperadoMes.toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                      });
                    })()}
                  </p>
                  <p className="text-xs opacity-75 mt-1">
                    📊 Valor esperado (mês atual, até hoje)
                  </p>
                  {/* Comparação do valor esperado com o mês anterior */}
                  {(() => {
                    const hoje = new Date();
                    const diaAtual = hoje.getDate();
                    const mesAtual = hoje.getMonth() + 1;
                    const anoAtual = hoje.getFullYear();
                    function getValorEsperadoPeriodo(stats, ano, mes, dias) {
                      let total = 0;
                      for (let d = 1; d <= dias; d++) {
                        const dataStr = `${ano}-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                        total += Number(
                          stats.balanco?.valorEsperadoPorDia?.[dataStr] || 0,
                        );
                      }
                      return total;
                    }
                    const valorEsperadoPeriodoAtual = getValorEsperadoPeriodo(
                      stats,
                      anoAtual,
                      mesAtual,
                      diaAtual,
                    );
                    const mesAnterior = mesAtual === 1 ? 12 : mesAtual - 1;
                    const anoMesAnterior =
                      mesAtual === 1 ? anoAtual - 1 : anoAtual;
                    const valorEsperadoPeriodoAnterior = getValorEsperadoPeriodo(
                      stats,
                      anoMesAnterior,
                      mesAnterior,
                      diaAtual,
                    );
                    const diff =
                      valorEsperadoPeriodoAtual - valorEsperadoPeriodoAnterior;
                    const percent =
                      valorEsperadoPeriodoAnterior > 0
                        ? (diff / valorEsperadoPeriodoAnterior) * 100
                        : 0;
                    return (
                      <div className="mt-2 text-xs font-semibold">
                        Valor esperado até hoje vs mês passado:
                        <span
                          className={
                            percent >= 0 ? "text-green-700" : "text-red-700"
                          }
                        >
                          {percent >= 0 ? "▲" : "▼"}{" "}
                          {Math.abs(percent).toFixed(1)}%
                        </span>
                        <span className="ml-2 text-gray-700">
                          (R${" "}
                          {valorEsperadoPeriodoAtual.toLocaleString("pt-BR", {
                            minimumFractionDigits: 2,
                          })}{" "}
                          vs R${" "}
                          {valorEsperadoPeriodoAnterior.toLocaleString(
                            "pt-BR",
                            { minimumFractionDigits: 2 },
                          )}
                          )
                        </span>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}
            {/* Prêmios Saídos */}
            <div className="stat-card bg-linear-to-br from-green-500 to-green-600 p-4 sm:p-6 rounded-xl shadow-md flex flex-col justify-between min-h-30">
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium opacity-90">
                    Prêmios Saídos
                  </h3>
                  <svg
                    className="w-8 h-8 opacity-80"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"
                    />
                  </svg>
                </div>
                <p className="text-3xl font-bold">
                  {stats.balanco?.totais?.totalSairam || 0}
                </p>
                <p className="text-xs opacity-75 mt-1">🎁 Pelúcias entregues</p>
              </div>
            </div>
            {/* Alertas de Estoque */}
            <div
              className="stat-card bg-linear-to-br from-red-500 to-red-600 p-4 sm:p-6 rounded-xl shadow-md flex flex-col justify-between min-h-30 cursor-pointer"
              onClick={() => {
                const alertSection = document.getElementById(
                  "alertas-estoque-maquinas",
                );
                if (alertSection) {
                  alertSection.scrollIntoView({ behavior: "smooth" });
                }
              }}
            >
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium opacity-90">
                    Alertas de Estoque
                  </h3>
                  <svg
                    className="w-8 h-8 opacity-80"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                </div>
                <p className="text-3xl font-bold">
                  {stats.alertas.length + alertasEstoqueLoja.length}
                </p>
                <p className="text-xs opacity-75 mt-1">
                  ⚠️ {stats.alertas.length} máquinas · 🏪{" "}
                  {alertasEstoqueLoja.length} pontos
                </p>
              </div>
            </div>

            {/* Financeiro, Veículos, Quebra de Ordem, Estoque, Manutenções, Pontos, Máquinas e Roteiros */}
            {/* Financeiro */}
            {usuario?.role === "ADMIN" && (
              <div
                className="stat-card bg-linear-to-br from-blue-500 to-blue-700 p-4 sm:p-6 rounded-xl shadow-md flex flex-col justify-between min-h-30 cursor-pointer"
                onClick={() => navigate("/financeiro/")}
              >
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium opacity-90">
                      Financeiro
                    </h3>
                    <svg
                      className="w-8 h-8 opacity-80"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <p className="text-3xl font-bold">💸</p>
                  <p className="text-xs opacity-75 mt-1">Gestão Financeira</p>
                </div>
              </div>
            )}
            {/* Veículos */}
            <div
              className="stat-card bg-linear-to-br from-gray-700 to-gray-900 p-4 sm:p-6 rounded-xl shadow-md flex flex-col justify-between min-h-30 cursor-pointer"
              onClick={() => navigate("/veiculos")}
            >
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium opacity-90">Veículos</h3>
                  <svg
                    className="w-8 h-8 opacity-80"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 13l2-2m0 0l7-7 7 7M5 11v8a2 2 0 002 2h10a2 2 0 002-2v-8"
                    />
                  </svg>
                </div>
                <p className="text-3xl font-bold">🚗🏍️</p>
                <p className="text-xs opacity-75 mt-1">
                  Acessar controle de veículos
                </p>
              </div>
            </div>
            {/* Quebra de Ordem */}
            <div
              className="stat-card bg-linear-to-br from-orange-500 to-orange-700 p-4 sm:p-6 rounded-xl shadow-md flex flex-col justify-between min-h-30 cursor-pointer"
              onClick={() => navigate("/quebra-ordem")}
            >
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium opacity-90">
                    Quebra Ordem
                  </h3>
                  <svg
                    className="w-8 h-8 opacity-80"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                </div>
                <p className="text-3xl font-bold">⚠️📋</p>
                <p className="text-xs opacity-75 mt-1">
                  Histórico de quebras de ordem
                </p>
              </div>
            </div>
            {/* Estoque por Usuário */}
            <div
              className="stat-card bg-linear-to-br from-cyan-500 to-cyan-700 p-4 sm:p-6 rounded-xl shadow-md flex flex-col justify-between min-h-30 cursor-pointer"
              onClick={() => navigate("/estoque-usuarios")}
            >
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium opacity-90">
                    Gerenciamento de Estoque
                  </h3>
                  <svg
                    className="w-8 h-8 opacity-80"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M20 13V7a2 2 0 00-2-2h-3V3m0 2h-4m4 0v2M4 7h16M4 7v10a2 2 0 002 2h12a2 2 0 002-2V7"
                    />
                  </svg>
                </div>
                <p className="text-3xl font-bold">📦</p>
                <p className="text-xs opacity-75 mt-1">
                  {alertasEstoqueUsuario.length} alertas pendentes
                </p>
              </div>
            </div>
            {/* Manutenções */}
            <div
              className={`stat-card bg-linear-to-br from-indigo-500 to-indigo-700 p-4 sm:p-6 rounded-xl shadow-md flex flex-col justify-between min-h-30 cursor-pointer${temManutencaoPendente ? " maintenance-blink" : ""}`}
              onClick={() => navigate("/manutencoes")}
            >
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium opacity-90">
                    Manutenções
                  </h3>
                  <svg
                    className="w-8 h-8 opacity-80"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9.75 17L9 21l3-1 3 1-.75-4M9 13V7a3 3 0 116 0v6m-6 0h6"
                    />
                  </svg>
                </div>
                <p className="text-3xl font-bold">🛠️</p>
                <p className="text-xs opacity-75 mt-1">
                  Acessar manutenções do sistema
                </p>
              </div>
            </div>
            {/* Base de Peças Defeituosas */}
            <div
              className="stat-card bg-linear-to-br from-amber-600 to-orange-700 p-4 sm:p-6 rounded-xl shadow-md flex flex-col justify-between min-h-30 cursor-pointer"
              onClick={() => navigate("/admin/pecas-defeituosas")}
            >
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium opacity-90">
                    Base Defeituosas
                  </h3>
                  <svg
                    className="w-8 h-8 opacity-80"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                    />
                  </svg>
                </div>
                <p className="text-3xl font-bold">♻️</p>
                <p className="text-xs opacity-75 mt-1">
                  Confirmar devoluções e limpar base
                </p>
              </div>
            </div>
            {/* Pontos */}
            <div
              className="stat-card bg-linear-to-br from-teal-500 to-teal-700 p-4 sm:p-6 rounded-xl shadow-md flex flex-col justify-between min-h-30 cursor-pointer"
              onClick={() => navigate("/lojas")}
            >
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium opacity-90">Pontos</h3>
                  <svg
                    className="w-8 h-8 opacity-80"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                </div>
                <p className="text-3xl font-bold">🏪</p>
                <p className="text-xs opacity-75 mt-1">Acessar tela de pontos</p>
              </div>
            </div>
            {/* Máquinas */}
            <div
              className="stat-card bg-linear-to-br from-fuchsia-500 to-fuchsia-700 p-4 sm:p-6 rounded-xl shadow-md flex flex-col justify-between min-h-30 cursor-pointer"
              onClick={() => navigate("/maquinas")}
            >
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium opacity-90">Máquinas</h3>
                  <svg
                    className="w-8 h-8 opacity-80"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2M5 21H3m16 0h-2M9 7h6M9 11h6M9 15h6"
                    />
                  </svg>
                </div>
                <p className="text-3xl font-bold">🎰</p>
                <p className="text-xs opacity-75 mt-1">Acessar tela de máquinas</p>
              </div>
            </div>
            {/* Roteiros */}
            <div
              className="stat-card bg-linear-to-br from-violet-600 to-purple-800 p-4 sm:p-6 rounded-xl shadow-md flex flex-col justify-between min-h-30 cursor-pointer"
              onClick={() => navigate("/roteiros")}
            >
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium opacity-90">Roteiros</h3>
                  <svg
                    className="w-8 h-8 opacity-80"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                    />
                  </svg>
                </div>
                <p className="text-3xl font-bold">🗺️</p>
                <p className="text-xs opacity-75 mt-1">Acessar tela de roteiros</p>
              </div>
            </div>
          </div>
        ) : (
          <div
            className="grid gap-4 md:gap-6 mb-8"
            style={{
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            }}
          >
            {!isFuncionario &&
              !isFuncionarioTodasLojas &&
              usuario?.role !== "CONTROLADOR_ESTOQUE" && (
              <div
                className="stat-card bg-linear-to-br from-gray-700 to-gray-900 p-4 sm:p-6 rounded-xl shadow-md flex flex-col justify-between min-h-30 cursor-pointer"
                onClick={() => navigate("/veiculos")}
              >
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium opacity-90">Veículos</h3>
                    <svg
                      className="w-8 h-8 opacity-80"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 13l2-2m0 0l7-7 7 7M5 11v8a2 2 0 002 2h10a2 2 0 002-2v-8"
                      />
                    </svg>
                  </div>
                  <p className="text-3xl font-bold">🚗🏍️</p>
                  <p className="text-xs opacity-75 mt-1">
                    Acessar controle de veículos
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Card do Depósito Principal - Apenas ADMIN */}
        {isAdminLike && (
          <div className="card-gradient mb-8 border-l-4 border-orange-500 p-4 sm:p-8 rounded-xl shadow-md sm:flex-row items-center justify-between gap-6">
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2 flex items-center gap-3">
                <span className="bg-linear-to-br from-orange-500 to-orange-600 p-2 sm:p-3 rounded-xl text-white">
                  🏭
                </span>
                Base Principal
              </h2>
              <p className="text-gray-600 text-sm sm:text-base">
                Gerencie o estoque central do sistema. Todo estoque distribuído
                para lojas e funcionários é descontado automaticamente daqui.
              </p>
            </div>
            <div className="text-left sm:text-right mt-4 sm:mt-0 flex flex-col items-end">
              <button
                className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-6 py-2 rounded-lg shadow transition-colors flex items-center gap-2"
                onClick={() => navigate("/deposito-principal")}
              >
                <span className="text-2xl">🏭</span> Ver Depósito
              </button>
            </div>
          </div>
        )}

        {isAdminEstrito && (
          <AjusteMaquinaAtual />
        )}

        {isAdminEstrito && (
          <div className="card-gradient mb-8 border-l-4 border-cyan-500 p-4 sm:p-8 rounded-xl shadow-md">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2 flex items-center gap-3">
                  <span className="bg-linear-to-br from-cyan-500 to-cyan-700 p-2 sm:p-3 rounded-xl text-white">
                    🧱
                  </span>
                  Bases Secundarias
                </h2>
                <p className="text-gray-600 text-sm sm:text-base">
                  Controle informativo por base: quantidade de produtos e
                  modelos cadastrados.
                </p>
              </div>

              <button
                type="button"
                className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold px-5 py-2 rounded-lg shadow transition-colors"
                onClick={abrirModalCriarBaseSecundaria}
              >
                Adicionar base secundaria
              </button>
            </div>

            {loadingBasesSecundarias ? (
              <div className="rounded-lg bg-white/70 border border-cyan-100 p-4 text-sm text-cyan-900">
                Carregando bases secundarias...
              </div>
            ) : erroBasesSecundarias ? (
              <div className="rounded-lg bg-red-50 border border-red-200 p-4">
                <p className="text-sm text-red-700 mb-3">{erroBasesSecundarias}</p>
                <button
                  type="button"
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg"
                  onClick={carregarBasesSecundarias}
                >
                  Tentar novamente
                </button>
              </div>
            ) : basesSecundarias.length === 0 ? (
              <div className="rounded-lg bg-white/70 border border-gray-200 p-5 text-center">
                <p className="text-4xl mb-2">📭</p>
                <p className="text-gray-700 font-semibold">
                  Nenhuma base secundária cadastrada.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {basesSecundarias.map((base) => (
                  <article
                    key={base.id}
                    className="bg-white border border-cyan-100 rounded-xl p-5 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <h3 className="text-lg font-bold text-gray-900">
                        {base.nomeBase}
                      </h3>
                      <span
                        className={`text-xs font-bold px-2 py-1 rounded-full ${
                          base.ativo
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {base.ativo ? "Ativa" : "Inativa"}
                      </span>
                    </div>

                    <p className="text-sm text-gray-700 mb-2">
                      <strong>Quantidade de produtos:</strong>{" "}
                      {base.quantidadeProdutos}
                    </p>

                    <p className="text-sm text-gray-700 mb-2">
                      <strong>Modelos:</strong>{" "}
                      {base.modelosProdutos || "Não informado"}
                    </p>

                    <p className="text-xs text-gray-500 mb-4">
                      Última atualização:{" "}
                      {formatarDataAtualizacaoBaseSecundaria(base.updatedAt)}
                    </p>

                    <div className="flex justify-end">
                      <button
                        type="button"
                        className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-800 text-white text-sm font-semibold"
                        onClick={() => abrirModalEditarBaseSecundaria(base)}
                      >
                        Editar
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}

        {podeVerAbaRevisaoVeiculos && (
          <div className="card-gradient mb-8 border-l-4 border-gray-700 p-4 sm:p-8 rounded-xl shadow-md  sm:flex-row items-center justify-between gap-6">
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2 flex items-center gap-3">
                <span className="bg-linear-to-br from-gray-700 to-gray-900 p-2 sm:p-3 rounded-xl text-white">
                  🔧
                </span>
                Revisões de Veículos
              </h2>
              <p className="text-gray-600 text-sm sm:text-base">
                Acompanhe e gerencie as revisões periódicas de todos os veículos
                da frota.
              </p>
            </div>
            <div className="text-left sm:text-right mt-4 sm:mt-0 flex flex-col items-end">
              <button
                className="bg-gray-700 hover:bg-gray-800 text-white font-bold px-6 py-2 rounded-lg shadow transition-colors flex items-center gap-2"
                onClick={() => navigate("/veiculos/revisoes-pendentes")}
              >
                <span className="text-2xl">🔧</span> Ver Revisões
              </button>
            </div>
          </div>
        )}

        {/* Card de Revisões Pendentes */}
        {podeVerAbaRevisaoVeiculos && revisoesPendentes.length > 0 && (
            <div className="card-gradient mb-8 border-l-4 border-red-500 p-4 sm:p-8 rounded-xl shadow-md">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                <div className="flex-1 min-w-0">
                  <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2 flex items-center gap-3">
                    <span className="bg-linear-to-br from-red-500 to-red-600 p-2 sm:p-3 rounded-xl text-white">
                      🔧
                    </span>
                    Revisões de Veículos Pendentes
                  </h2>
                  <p className="text-gray-600 text-sm sm:text-base mb-4">
                    {revisoesPendentes.length}{" "}
                    {revisoesPendentes.length === 1
                      ? "veículo precisa"
                      : "veículos precisam"}{" "}
                    de revisão
                  </p>

                  <div className="space-y-2">
                    {revisoesPendentes.slice(0, 3).map((revisao) => (
                      <div
                        key={revisao.veiculoId}
                        className="bg-white/50 rounded-lg p-3 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">🚗</span>
                          <div>
                            <p className="font-bold text-gray-900">
                              {revisao.veiculoNome}
                            </p>
                            <p className="text-sm text-gray-600">
                              KM Atual:{" "}
                              {revisao.kmAtual.toLocaleString("pt-BR")} |
                              Revisão devida:{" "}
                              {revisao.kmRevisaoDevida.toLocaleString("pt-BR")}
                            </p>
                          </div>
                        </div>
                        <span className="bg-red-500 text-white px-3 py-1 rounded-full text-xs font-bold">
                          Atrasada
                        </span>
                      </div>
                    ))}
                  </div>

                  {revisoesPendentes.length > 3 && (
                    <p className="text-sm text-gray-500 mt-2">
                      + {revisoesPendentes.length - 3} mais
                      {revisoesPendentes.length - 3 === 1
                        ? "veículo"
                        : "veículos"}
                    </p>
                  )}
                </div>

                <div className="text-left sm:text-right mt-4 sm:mt-0 flex flex-col items-end">
                  <button
                    className="bg-red-500 hover:bg-red-600 text-white font-bold px-6 py-2 rounded-lg shadow transition-colors flex items-center gap-2"
                    onClick={() => navigate("/veiculos/revisoes-pendentes")}
                  >
                    <span className="text-2xl">🔧</span> Ver Revisões
                  </button>
                </div>
              </div>
            </div>
          )}

        {isAdminLike && <DashboardGastosRoteirosTab />}

        {/* Estatísticas de Produtos Totais - Apenas para ADMIN */}
        {isAdminLike && stats.balanco?.distribuicaoLojas?.length > 0 && (
          <div className="card-gradient mb-8 border-l-4 border-pink-500 p-4 sm:p-8 rounded-xl shadow-md">
            <div
              className="flex flex-col sm:flex-row items-start sm:items-center justify-between cursor-pointer hover:bg-pink-50/50 transition-colors rounded-xl p-2 sm:p-4 -m-2"
              onClick={toggleDetalhesProdutos}
            >
              <div className="flex-1 min-w-0">
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2 flex items-center gap-3">
                  <span className="bg-linear-to-br from-pink-500 to-pink-600 p-2 sm:p-3 rounded-xl text-white">
                    🎁
                  </span>
                  Total de Produtos Vendidos
                </h2>
                <p className="text-gray-600 text-sm sm:text-base">
                  Soma de todos os pontos no período
                </p>
              </div>
              <div className="text-left sm:text-right mt-4 sm:mt-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl sm:text-5xl font-bold text-gradient">
                    {stats.balanco.distribuicaoLojas.reduce(
                      (total, loja) =>
                        total + (loja.produtosVendidos || loja.sairam || 0),
                      0,
                    )}
                  </span>
                  <span className="text-lg sm:text-2xl text-gray-600">
                    unidades
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-gray-500 mt-2">
                  📊 {stats.balanco.distribuicaoLojas.length}{" "}
                  {stats.balanco.distribuicaoLojas.length === 1
                    ? "ponto"
                    : "pontos"}{" "}
                  ativas
                </p>
                <button className="mt-2 text-xs text-pink-600 font-semibold hover:text-pink-700 flex items-center gap-1">
                  {mostrarDetalhesProdutos ? "▼ Ocultar" : "▶ Ver detalhes"}
                </button>
              </div>
            </div>

            {/* Detalhes de Vendas por Produto */}
            {mostrarDetalhesProdutos && (
              <div className="mt-6 pt-6 border-t-2 border-pink-200">
                <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <span className="text-2xl">📦</span>
                  Vendas Detalhadas por Produto
                </h3>

                {vendasPorProduto.length > 0 ? (
                  <div className="space-y-4">
                    {vendasPorProduto.map((produto) => (
                      <div
                        key={produto.id}
                        className="bg-linear-to-r from-pink-50 to-purple-50 p-5 rounded-xl border-2 border-pink-200 hover:shadow-md transition-all"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-lg font-bold text-gray-900 flex items-center gap-3">
                            <span className="bg-pink-500 text-white w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold">
                              {produto.totalVendido}
                            </span>
                            <span className="text-2xl">{produto.emoji}</span>
                            <span>{produto.nome}</span>
                          </h4>
                          <span className="badge bg-pink-100 text-pink-700 border-pink-300 text-base px-4 py-2">
                            {produto.totalVendido}{" "}
                            {produto.totalVendido === 1
                              ? "unidade vendida"
                              : "unidades vendidas"}
                          </span>
                        </div>

                        {/* Vendas por Ponto */}
                        <div className="mt-3 pl-10">
                          <p className="text-sm font-semibold text-gray-700 mb-2">
                            📍 Vendas por ponto:
                          </p>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                            {Object.entries(produto.vendasPorLoja).map(
                              ([loja, quantidade]) => (
                                <div
                                  key={loja}
                                  className="bg-white px-3 py-2 rounded-lg border border-pink-200 flex items-center justify-between"
                                >
                                  <span className="text-sm text-gray-700">
                                    {loja}
                                  </span>
                                  <span className="text-sm font-bold text-pink-600">
                                    {quantidade}
                                  </span>
                                </div>
                              ),
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500 mx-auto mb-4"></div>
                    <p className="text-gray-600">
                      Carregando detalhes dos produtos...
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Alertas de Estoque - Apenas para ADMIN */}
        {isAdminLike && stats.alertas.length > 0 && (
          <div
            className="card mb-8 border-l-4 border-red-500"
            id="alertas-estoque-maquinas"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <span className="bg-red-100 p-2 rounded-lg">⚠️</span>
                Alertas de Estoque em Máquinas
              </h2>
              <span className="badge badge-danger">
                {stats.alertas.length}{" "}
                {stats.alertas.length === 1 ? "alerta" : "alertas"}
              </span>
            </div>
            <div className="space-y-3">
              {stats.alertas.slice(0, 5).map((alerta, index) => (
                <div
                  key={index}
                  className={`p-5 rounded-xl border-l-4 transition-all duration-200 hover:scale-[1.02] ${
                    alerta.nivelAlerta === "CRÍTICO"
                      ? "bg-linear-to-r from-red-50 to-red-100/50 border-red-500 shadow-red-100 shadow-md"
                      : alerta.nivelAlerta === "ALTO"
                        ? "bg-linear-to-r from-orange-50 to-orange-100/50 border-orange-500 shadow-orange-100 shadow-md"
                        : "bg-linear-to-r from-yellow-50 to-yellow-100/50 border-yellow-500 shadow-yellow-100 shadow-md"
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-lg text-gray-900">
                          {alerta.maquina?.codigo || "-"}
                        </span>
                        <span className="text-gray-600">-</span>
                        <span className="text-gray-800 font-medium">
                          {alerta.maquina.nome}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 flex items-center gap-1">
                        <svg
                          className="w-4 h-4"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                            clipRule="evenodd"
                          />
                        </svg>
                        {alerta.maquina.loja}
                      </p>
                      {alerta.produto?.codigo && (
                        <p className="text-xs text-gray-500 mt-1">
                          Código: {alerta.produto?.codigo}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-bold text-gray-900">
                          {alerta.quantidade}
                        </span>
                        <span className="text-lg text-gray-600">un</span>
                      </div>
                      <p className="text-xs text-gray-600 mt-1 bg-white/60 px-2 py-1 rounded-full">
                        {alerta.estoqueAtual}/{alerta.capacidadePadrao} unidades
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {stats.alertas.length > 5 && !mostrarTodosAlertasMaquinas && (
              <button
                className="block mt-6 w-full text-center bg-linear-to-r from-primary/10 to-accent-yellow/10 hover:from-primary/20 hover:to-accent-yellow/20 text-primary font-bold py-3 rounded-xl transition-all duration-200"
                onClick={() => setMostrarTodosAlertasMaquinas(true)}
              >
                Ver todos os alertas ({stats.alertas.length})
              </button>
            )}
            {mostrarTodosAlertasMaquinas && (
              <div className="mt-6 space-y-3">
                {stats.alertas.slice(5).map((alerta, index) =>
                  (() => {
                    const percentualAtual =
                      alerta.estoqueMinimo > 0
                        ? Math.round(
                            (alerta.quantidade / alerta.estoqueMinimo) * 100,
                          )
                        : 0;

                    return (
                      <div
                        key={index}
                        className={`p-5 rounded-xl border-l-4 transition-all duration-200 hover:scale-[1.02] ${
                          alerta.nivelAlerta === "CRÍTICO"
                            ? "bg-linear-to-r from-red-50 to-red-100/50 border-red-500 shadow-red-100 shadow-md"
                            : alerta.nivelAlerta === "ALTO"
                              ? "bg-linear-to-r from-orange-50 to-orange-100/50 border-orange-500 shadow-orange-100 shadow-md"
                              : "bg-linear-to-r from-yellow-50 to-yellow-100/50 border-yellow-500 shadow-yellow-100 shadow-md"
                        }`}
                        title={alerta.produtoNome}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-2xl">
                                {alerta.produto.emoji || "📦"}
                              </span>
                              <span className="font-bold text-lg text-gray-900">
                                {alerta.produto.nome}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 flex items-center gap-1">
                              <svg
                                className="w-4 h-4"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                                  clipRule="evenodd"
                                />
                              </svg>
                              {alerta.lojaNome}
                            </p>
                            {alerta.produto.codigo && (
                              <p className="text-xs text-gray-500 mt-1">
                                Código: {alerta.produto.codigo}
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            <div className="flex items-baseline gap-1">
                              <span className="text-3xl font-bold text-gray-900">
                                {alerta.quantidade}
                              </span>
                              <span className="text-lg text-gray-600">un</span>
                            </div>
                            <p className="text-xs text-gray-600 mt-1 bg-white/60 px-2 py-1 rounded-full">
                              Min: {alerta.estoqueMinimo} · {percentualAtual}%
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })(),
                )}
                <button
                  className="mt-4 w-full text-center bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold py-2 rounded-xl transition-all duration-200"
                  onClick={() => setMostrarTodosAlertasMaquinas(false)}
                >
                  Fechar lista de alertas
                </button>
              </div>
            )}
          </div>
        )}

        {/* Alertas de Estoque de Lojas - Apenas para ADMIN */}
        {isAdminLike && alertasEstoqueLoja.length > 0 && (
          <div className="card mb-8 border-l-4 border-orange-500">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <span className="bg-orange-100 p-2 rounded-lg">🏪</span>
                Alertas de Estoque nos Pontos
              </h2>
              <span className="badge bg-orange-100 text-orange-700 border-orange-300">
                {alertasEstoqueLoja.length}{" "}
                {alertasEstoqueLoja.length === 1 ? "produto" : "produtos"}
              </span>
            </div>
            <div className="space-y-3">
              {alertasEstoqueLoja.slice(0, 5).map((alerta, index) => {
                const percentualAtual =
                  alerta.estoqueMinimo > 0
                    ? Math.round(
                        (alerta.quantidade / alerta.estoqueMinimo) * 100,
                      )
                    : 0;
                const nivelAlerta =
                  percentualAtual <= 25
                    ? "CRÍTICO"
                    : percentualAtual <= 50
                      ? "ALTO"
                      : "MÉDIO";

                return (
                  <div
                    key={`${alerta.lojaId}-${alerta.produtoId}-${index}`}
                    className={`p-5 rounded-xl border-l-4 transition-all duration-200 hover:scale-[1.02] ${
                      nivelAlerta === "CRÍTICO"
                        ? "bg-linear-to-r from-red-50 to-red-100/50 border-red-500 shadow-red-100 shadow-md"
                        : nivelAlerta === "ALTO"
                          ? "bg-linear-to-r from-orange-50 to-orange-100/50 border-orange-500 shadow-orange-100 shadow-md"
                          : "bg-linear-to-r from-yellow-50 to-yellow-100/50 border-yellow-500 shadow-yellow-100 shadow-md"
                    }`}
                    title={alerta.produtoNome}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-2xl">
                            {alerta.produto.emoji || "📦"}
                          </span>
                          <span className="font-bold text-lg text-gray-900">
                            {alerta.produto.nome}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 flex items-center gap-1">
                          <svg
                            className="w-4 h-4"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                              clipRule="evenodd"
                            />
                          </svg>
                          {alerta.lojaNome}
                        </p>
                        {alerta.produto.codigo && (
                          <p className="text-xs text-gray-500 mt-1">
                            Código: {alerta.produto.codigo}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl font-bold text-gray-900">
                            {alerta.quantidade}
                          </span>
                          <span className="text-lg text-gray-600">un</span>
                        </div>
                        <p className="text-xs text-gray-600 mt-1 bg-white/60 px-2 py-1 rounded-full">
                          Min: {alerta.estoqueMinimo} · {percentualAtual}%
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {alertasEstoqueLoja.length > 5 && (
              <Link
                to="/lojas"
                className="block mt-6 text-center bg-linear-to-r from-orange-500/10 to-orange-600/10 hover:from-orange-500/20 hover:to-orange-600/20 text-orange-700 font-bold py-3 rounded-xl transition-all duration-200"
              >
                Ver todos os alertas de pontos ({alertasEstoqueLoja.length})
              </Link>
            )}
          </div>
        )}
      </div>

      {isAdminEstrito && modalBaseSecundariaAberto && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden">
            <div className="bg-linear-to-r from-cyan-600 to-cyan-700 p-5 text-white">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl sm:text-2xl font-bold">
                  {baseSecundariaEditando
                    ? "Editar Base Secundaria"
                    : "Adicionar Base Secundaria"}
                </h2>
                <button
                  type="button"
                  onClick={fecharModalBaseSecundaria}
                  disabled={salvandoBaseSecundaria}
                  className="rounded-lg p-2 hover:bg-white/20 transition-colors"
                  aria-label="Fechar modal"
                >
                  ✕
                </button>
              </div>
            </div>

            <form onSubmit={salvarBaseSecundaria} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Nome da base*
                </label>
                <input
                  type="text"
                  value={formBaseSecundaria.nomeBase}
                  onChange={(e) =>
                    setFormBaseSecundaria((prev) => ({
                      ...prev,
                      nomeBase: e.target.value,
                    }))
                  }
                  className="input-primary w-full border border-black"
                  placeholder="Ex.: Base Secundaria 02"
                  maxLength={120}
                />
                {errosFormBaseSecundaria.nomeBase && (
                  <p className="text-xs text-red-600 mt-1">
                    {errosFormBaseSecundaria.nomeBase}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Quantidade total de produtos
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={produtosSelecionadosBaseSecundaria.reduce(
                    (acc, produtoId) =>
                      acc +
                      (Number.parseInt(
                        quantidadePorProdutoBaseSecundaria[produtoId],
                        10,
                      ) ||
                        0),
                    0,
                  )}
                  readOnly
                  className="input-primary w-full border border-black"
                />
                {errosFormBaseSecundaria.quantidadeProdutos && (
                  <p className="text-xs text-red-600 mt-1">
                    {errosFormBaseSecundaria.quantidadeProdutos}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Produtos cadastrados
                </label>
                <input
                  type="text"
                  value={buscaProdutoBaseSecundaria}
                  onChange={(e) =>
                    setBuscaProdutoBaseSecundaria(e.target.value)
                  }
                  className="input-primary w-full border border-black"
                  placeholder="Buscar produto por nome"
                />

                <div className="mt-3 border border-gray-200 rounded-lg max-h-52 overflow-y-auto p-2 space-y-1 bg-gray-50">
                  {produtosFiltradosBaseSecundaria.length === 0 ? (
                    <p className="text-xs text-gray-500 p-2">
                      Nenhum produto encontrado.
                    </p>
                  ) : (
                    produtosFiltradosBaseSecundaria.map((produto) => {
                      const produtoId = String(produto.id);
                      const marcado =
                        produtosSelecionadosBaseSecundaria.includes(produtoId);

                      return (
                        <div
                          key={produtoId}
                          className="flex items-center gap-2 text-sm text-gray-700 p-2 rounded hover:bg-white"
                        >
                          <input
                            type="checkbox"
                            checked={marcado}
                            onChange={() =>
                              toggleProdutoBaseSecundaria(produtoId)
                            }
                            className="w-4 h-4"
                          />
                          <span className="text-base">{produto?.emoji || "📦"}</span>
                          <span className="flex-1">
                            {produto?.nome || "Produto sem nome"}
                          </span>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={
                              quantidadePorProdutoBaseSecundaria[produtoId] || ""
                            }
                            onChange={(e) =>
                              atualizarQuantidadeProdutoBaseSecundaria(
                                produtoId,
                                e.target.value,
                              )
                            }
                            disabled={!marcado}
                            placeholder="Qtd"
                            className="w-20 px-2 py-1 border border-gray-300 rounded bg-white disabled:bg-gray-100 disabled:text-gray-400"
                          />
                        </div>
                      );
                    })
                  )}
                </div>

                <p className="text-xs text-gray-600 mt-2">
                  {produtosSelecionadosBaseSecundaria.length} produto(s)
                  selecionado(s).
                </p>
              </div>

              <div className="flex items-center gap-3">
                <input
                  id="base-secundaria-ativo"
                  type="checkbox"
                  checked={formBaseSecundaria.ativo}
                  onChange={(e) =>
                    setFormBaseSecundaria((prev) => ({
                      ...prev,
                      ativo: e.target.checked,
                    }))
                  }
                  className="w-4 h-4"
                />
                <label
                  htmlFor="base-secundaria-ativo"
                  className="text-sm text-gray-700 font-medium"
                >
                  Base ativa
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-200">
                <button
                  type="button"
                  onClick={fecharModalBaseSecundaria}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50"
                  disabled={salvandoBaseSecundaria}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white font-semibold"
                  disabled={salvandoBaseSecundaria}
                >
                  {salvandoBaseSecundaria
                    ? "Salvando..."
                    : baseSecundariaEditando
                      ? "Salvar edição"
                      : "Adicionar base"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}

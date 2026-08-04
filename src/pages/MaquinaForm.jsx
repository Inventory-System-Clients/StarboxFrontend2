import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../services/api";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer.jsx";
import { PageHeader, AlertBox } from "../components/UIComponents";
import { PageLoader } from "../components/Loading";

const normalizarNomeGasto = (nome) =>
  String(nome || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");

const obterValorAluguelDaLista = (lista) => {
  const gastoAluguel = (Array.isArray(lista) ? lista : []).find(
    (item) => normalizarNomeGasto(item?.nome) === "aluguel",
  );

  const valor = Number(gastoAluguel?.valor || 0);
  return Number.isFinite(valor) ? valor : 0;
};

export function MaquinaForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [formData, setFormData] = useState({
    codigo: "",
    nome: "",
    loja_id: "",
    tipo: "",
    capacidadePadrao: "",
    valorFicha: "",
    usaFichas: false,
    comissaoLojaPercentual: "",
    fichasNecessarias: "",
    forcaForte: "",
    forcaFraca: "",
    forcaPremium: "",
    jogadasPremium: "",
    percentualAlertaEstoque: "",
    contadorInInicial: "",
    contadorOutInicial: "",
    localizacao: "",
    ativo: true,
  });

  const [lojas, setLojas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loadingTiposMaquina, setLoadingTiposMaquina] = useState(false);
  const [tiposMaquinaExistentes, setTiposMaquinaExistentes] = useState([]);
  const [mostrarSugestoesTipo, setMostrarSugestoesTipo] = useState(false);
  const [valorAluguelPonto, setValorAluguelPonto] = useState(0);
  const [loadingRegraComissao, setLoadingRegraComissao] = useState(false);

  useEffect(() => {
    carregarLojas();
    carregarTiposMaquina();
    if (isEdit) {
      carregarMaquina();
    } else {
      carregarProximoCodigo();
      setLoadingData(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    const lojaIdSelecionada = formData.loja_id;

    if (!lojaIdSelecionada) {
      setValorAluguelPonto(0);
      return;
    }

    carregarRegraComissaoPorLoja(lojaIdSelecionada);
  }, [formData.loja_id]);

  const carregarProximoCodigo = async () => {
    try {
      const response = await api.get("/maquinas");
      const maquinas = response.data;

      if (!maquinas || maquinas.length === 0) {
        setFormData((prev) => ({ ...prev, codigo: "1" }));
        return;
      }

      // Extrai números dos códigos existentes
      const codigos = maquinas.map((m) => {
        const codigo = String(m.codigo || "");
        // Extrai apenas números do código (ex: "MAQ-001" -> 1, "123" -> 123)
        const numero = parseInt(codigo.replace(/\D/g, ""), 10);
        return isNaN(numero) ? 0 : numero;
      });

      // Encontra o maior código e incrementa
      const maiorCodigo = Math.max(...codigos, 0);
      const proximoCodigo = maiorCodigo + 1;

      setFormData((prev) => ({ ...prev, codigo: String(proximoCodigo) }));
    } catch (error) {
      console.error("Erro ao carregar próximo código:", error);
      // Em caso de erro, deixa vazio para o usuário preencher
      setFormData((prev) => ({ ...prev, codigo: "" }));
    }
  };

  const carregarLojas = async () => {
    try {
      const response = await api.get("/lojas");
      setLojas(response.data.filter((l) => l.ativo));
    } catch (error) {
      setError(
        "Erro ao carregar lojas: " +
          (error.response?.data?.error || error.message),
      );
    }
  };

  const carregarTiposMaquina = async () => {
    try {
      setLoadingTiposMaquina(true);
      const response = await api.get("/maquinas/tipos");
      const lista = Array.isArray(response.data)
        ? response.data
        : Array.isArray(response.data?.tipos)
          ? response.data.tipos
          : [];

      const tiposUnicos = Array.from(
        new Set(lista.map((item) => String(item || "").trim()).filter(Boolean)),
      ).sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));

      setTiposMaquinaExistentes(tiposUnicos);
    } catch (error) {
      console.error("Erro ao carregar tipos de máquina:", error);
      setTiposMaquinaExistentes([]);
    } finally {
      setLoadingTiposMaquina(false);
    }
  };

  const carregarMaquina = async () => {
    try {
      setLoadingData(true);
      const response = await api.get(`/maquinas/${id}`);
      setFormData({
        codigo: response.data.codigo || "",
        nome: response.data.nome || "",
        loja_id: response.data.lojaId ? String(response.data.lojaId) : "",
        tipo: response.data.tipo || "",
        capacidadePadrao: response.data.capacidadePadrao || "",
        valorFicha: response.data.valorFicha || "",
        usaFichas:
          response.data.usaFichas === true ||
          response.data.usa_fichas === true ||
          response.data.usaFichas === 1 ||
          response.data.usa_fichas === 1,
        comissaoLojaPercentual:
          response.data.comissaoLojaPercentual !== null &&
          response.data.comissaoLojaPercentual !== undefined
            ? String(response.data.comissaoLojaPercentual)
            : "",
        fichasNecessarias: response.data.fichasNecessarias || "",
        forcaForte: response.data.forcaForte || "",
        forcaFraca: response.data.forcaFraca || "",
        forcaPremium: response.data.forcaPremium || "",
        jogadasPremium: response.data.jogadasPremium || "",
        percentualAlertaEstoque: response.data.percentualAlertaEstoque || 20,
        contadorInInicial: "",
        contadorOutInicial: "",
        localizacao: response.data.localizacao || "",
        ativo: response.data.ativo !== undefined ? response.data.ativo : true,
      });
    } catch (error) {
      setError(
        "Erro ao carregar máquina: " +
          (error.response?.data?.error || error.message),
      );
    } finally {
      setLoadingData(false);
    }
  };

  const carregarRegraComissaoPorLoja = async (lojaId) => {
    try {
      setLoadingRegraComissao(true);
      const response = await api.get(`/gastos-fixos-loja/${lojaId}`);
      const aluguel = obterValorAluguelDaLista(response.data);

      setValorAluguelPonto(aluguel);
      setFormData((prev) => ({
        ...prev,
        comissaoLojaPercentual: aluguel > 0 ? "0" : prev.comissaoLojaPercentual,
      }));
    } catch (error) {
      console.error("Erro ao carregar gastos fixos do ponto:", error);
      setValorAluguelPonto(0);
    } finally {
      setLoadingRegraComissao(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    if (name === "comissaoLojaPercentual" && valorAluguelPonto > 0) {
      setFormData({
        ...formData,
        comissaoLojaPercentual: "0",
      });
      return;
    }

    setFormData({
      ...formData,
      [name]: type === "checkbox" ? checked : value,
    });
  };

  const tiposSugeridos = tiposMaquinaExistentes.filter((tipo) => {
    const termo = String(formData.tipo || "")
      .trim()
      .toLocaleLowerCase("pt-BR");

    if (!termo) return true;
    return tipo.toLocaleLowerCase("pt-BR").includes(termo);
  });

  const selecionarTipoSugerido = (tipo) => {
    setFormData((prev) => ({ ...prev, tipo }));
    setMostrarSugestoesTipo(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      // Validação adicional
      console.log("FormData completo:", formData); // Debug
      console.log(
        "loja_id:",
        formData.loja_id,
        "tipo:",
        typeof formData.loja_id,
      ); // Debug

      if (!formData.loja_id || formData.loja_id === "") {
        setError("Por favor, selecione um ponto");
        setLoading(false);
        return;
      }

      if (!formData.codigo || formData.codigo.trim() === "") {
        setError("Por favor, informe o código da máquina");
        setLoading(false);
        return;
      }

      if (
        valorAluguelPonto > 0 &&
        Number(formData.comissaoLojaPercentual || 0) !== 0
      ) {
        setError(
          "Este ponto possui aluguel maior que zero. A comissão da máquina deve ser 0%.",
        );
        setLoading(false);
        return;
      }

      if (
        valorAluguelPonto <= 0 &&
        String(formData.comissaoLojaPercentual || "").trim() === ""
      ) {
        setError(
          "Este ponto não possui aluguel. Informe a comissão da máquina.",
        );
        setLoading(false);
        return;
      }

      const contadorInInicialInformado =
        formData.contadorInInicial !== "" &&
        formData.contadorInInicial !== null;
      const contadorOutInicialInformado =
        formData.contadorOutInicial !== "" &&
        formData.contadorOutInicial !== null;

      if (
        !isEdit &&
        contadorInInicialInformado !== contadorOutInicialInformado
      ) {
        setError(
          "Para lançar movimentação inicial, preencha IN e OUT inicial juntos.",
        );
        setLoading(false);
        return;
      }

      const data = {
        codigo: formData.codigo.trim(),
        nome: formData.nome.trim() || null,
        lojaId: formData.loja_id,
        tipo: formData.tipo?.trim() || null,
        capacidadePadrao: parseInt(formData.capacidadePadrao, 10) || 0,
        valorFicha: parseFloat(formData.valorFicha) || 0,
        usaFichas: Boolean(formData.usaFichas),
        comissaoLojaPercentual:
          formData.comissaoLojaPercentual === ""
            ? null
            : parseFloat(formData.comissaoLojaPercentual),
        fichasNecessarias: parseInt(formData.fichasNecessarias, 10) || null,
        forcaForte: parseInt(formData.forcaForte, 10) || null,
        forcaFraca: parseInt(formData.forcaFraca, 10) || null,
        forcaPremium: parseInt(formData.forcaPremium, 10) || null,
        jogadasPremium: parseInt(formData.jogadasPremium, 10) || null,
        percentualAlertaEstoque:
          parseInt(formData.percentualAlertaEstoque, 10) || 20,
        localizacao: formData.localizacao?.trim() || null,
        ativo: formData.ativo,
      };

      console.log("Dados enviados:", JSON.stringify(data, null, 2)); // Debug detalhado

      if (isEdit) {
        await api.put(`/maquinas/${id}`, data);
        setSuccess("Máquina atualizada com sucesso!");
      } else {
        const responseNovaMaquina = await api.post("/maquinas", data);

        if (contadorInInicialInformado && contadorOutInicialInformado) {
          const novaMaquinaId =
            responseNovaMaquina?.data?.id ||
            responseNovaMaquina?.data?.maquina?.id;

          if (!novaMaquinaId) {
            throw new Error(
              "Máquina criada, mas não foi possível identificar o ID para lançar movimentação inicial.",
            );
          }

          const contadorInInicial = parseInt(formData.contadorInInicial, 10);
          const contadorOutInicial = parseInt(formData.contadorOutInicial, 10);
          const dataColetaInicial = new Date(Date.now() - 5000).toISOString();

          const payloadMovimentacaoInicial = {
            maquinaId: novaMaquinaId,
            totalPre: 0,
            sairam: 0,
            abastecidas: 0,
            totalPos: 0,
            fichas: 0,
            dataColeta: dataColetaInicial,
            contadorInAnterior: contadorInInicial,
            contadorOutAnterior: contadorOutInicial,
            contadorIn: contadorInInicial,
            contadorOut: contadorOutInicial,
            contadorInDigital: contadorInInicial,
            contadorOutDigital: contadorOutInicial,
            quantidade_notas_entrada: null,
            valor_entrada_maquininha_pix: null,
            ignoreInOut: false,
            retiradaEstoque: false,
            origemEstoque: "usuario",
            contadorMaquina: null,
            observacoes:
              "Movimentação inicial automática no cadastro da máquina",
            produtos: [],
            retiradaProduto: 0,
          };

          const normalizarListaMovimentacoes = (resposta) =>
            Array.isArray(resposta?.data)
              ? resposta.data
              : Array.isArray(resposta?.data?.rows)
                ? resposta.data.rows
                : Array.isArray(resposta?.data?.movimentacoes)
                  ? resposta.data.movimentacoes
                  : [];

          const existeMovimentacaoInicial = (lista) =>
            lista.some((mov) => {
              const inAtual = Number(mov?.contadorIn ?? mov?.contadorInDigital);
              const outAtual = Number(
                mov?.contadorOut ?? mov?.contadorOutDigital,
              );
              const inAnterior = Number(mov?.contadorInAnterior);
              const outAnterior = Number(mov?.contadorOutAnterior);

              return (
                String(mov?.maquinaId || mov?.maquina_id) ===
                  String(novaMaquinaId) &&
                inAtual === contadorInInicial &&
                outAtual === contadorOutInicial &&
                (inAnterior === contadorInInicial ||
                  Number.isNaN(inAnterior)) &&
                (outAnterior === contadorOutInicial ||
                  Number.isNaN(outAnterior))
              );
            });

          const respostaAntesCriacaoMov = await api
            .get("/movimentacoes", {
              params: { maquinaId: novaMaquinaId, limite: 5 },
            })
            .catch(() => ({ data: [] }));

          const listaAntesCriacao = normalizarListaMovimentacoes(
            respostaAntesCriacaoMov,
          );

          // Se o backend já criou a movimentação inicial no fluxo de cadastro,
          // não envia novamente para evitar duplicidade.
          if (existeMovimentacaoInicial(listaAntesCriacao)) {
            setSuccess("Máquina criada com sucesso!");
            setTimeout(() => navigate("/maquinas"), 1500);
            return;
          }

          try {
            await api.post("/movimentacoes", payloadMovimentacaoInicial);
          } catch (erroMovimentacaoInicial) {
            // Alguns cenários retornam 500 mesmo com persistência concluída.
            const respostaConsulta = await api
              .get("/movimentacoes", {
                params: { maquinaId: novaMaquinaId, limite: 5 },
              })
              .catch(() => ({ data: [] }));

            const listaMovimentacoes =
              normalizarListaMovimentacoes(respostaConsulta);

            const movimentacaoInicialEncontrada =
              existeMovimentacaoInicial(listaMovimentacoes);

            if (!movimentacaoInicialEncontrada) {
              throw erroMovimentacaoInicial;
            }
          }
        }

        setSuccess("Máquina criada com sucesso!");
      }

      setTimeout(() => navigate("/maquinas"), 1500);
    } catch (error) {
      setError(error.response?.data?.error || "Erro ao salvar máquina");
    } finally {
      setLoading(false);
    }
  };

  if (loadingData) return <PageLoader />;

  return (
    <div className="min-h-screen bg-background-light bg-pattern teddy-pattern">
      <Navbar />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title={isEdit ? "Editar Máquina" : "Nova Máquina"}
          subtitle={
            isEdit
              ? "Atualize as informações da máquina"
              : "Cadastre uma nova máquina no sistema"
          }
          icon="🎰"
        />

        {error && (
          <AlertBox type="error" message={error} onClose={() => setError("")} />
        )}
        {success && <AlertBox type="success" message={success} />}

        <div className="card-gradient">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Informações Básicas */}
            <div>
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
                Informações Básicas
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Código da Máquina *
                  </label>
                  <input
                    type="text"
                    name="codigo"
                    value={formData.codigo}
                    onChange={handleChange}
                    className="input-field"
                    placeholder="Ex: MAQ-001"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Nome
                  </label>
                  <input
                    type="text"
                    name="nome"
                    value={formData.nome}
                    onChange={handleChange}
                    className="input-field"
                    placeholder="Ex: Máquina Principal"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Ponto *
                  </label>
                  <select
                    name="loja_id"
                    value={formData.loja_id}
                    onChange={handleChange}
                    className="select-field"
                    required
                  >
                    <option value="">Selecione um ponto...</option>
                    {lojas.map((loja) => (
                      <option key={loja.id} value={loja.id}>
                        {loja.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      name="ativo"
                      checked={formData.ativo}
                      onChange={handleChange}
                      className="w-5 h-5 text-primary rounded focus:ring-2 focus:ring-primary"
                    />
                    <span className="text-sm font-semibold text-gray-700">
                      Máquina Ativa
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* Configurações */}
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-primary"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
                </svg>
                Configurações
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Tipo de Máquina
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      name="tipo"
                      value={formData.tipo}
                      onChange={handleChange}
                      onFocus={() => setMostrarSugestoesTipo(true)}
                      onBlur={() => {
                        setTimeout(() => setMostrarSugestoesTipo(false), 120);
                      }}
                      className="input-field"
                      placeholder="Digite para buscar ou criar"
                      autoComplete="off"
                    />

                    {mostrarSugestoesTipo && (
                      <div className="absolute z-20 mt-1 w-full max-h-56 overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                        {tiposSugeridos.length > 0 ? (
                          tiposSugeridos.map((tipo) => (
                            <button
                              type="button"
                              key={tipo}
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => selecionarTipoSugerido(tipo)}
                              className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                            >
                              {tipo}
                            </button>
                          ))
                        ) : (
                          <div className="px-3 py-2 text-sm text-gray-500">
                            Nenhum tipo encontrado
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {loadingTiposMaquina
                      ? "Carregando tipos existentes..."
                      : "Digite para buscar rapidamente. Se não existir, informe um novo tipo e salve a máquina."}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Capacidade Padrão *
                  </label>
                  <input
                    type="number"
                    name="capacidadePadrao"
                    value={formData.capacidadePadrao}
                    onChange={handleChange}
                    className="input-field"
                    placeholder="Ex: 100"
                    min="0"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Capacidade máxima de produtos
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Valor da Jogada (R$)
                  </label>
                  <input
                    type="number"
                    name="valorFicha"
                    value={formData.valorFicha}
                    onChange={handleChange}
                    className="input-field"
                    placeholder="Ex: 2.00"
                    min="0"
                    step="0.01"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Valor cobrado por ficha
                  </p>
                </div>

                <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      name="usaFichas"
                      checked={Boolean(formData.usaFichas)}
                      onChange={handleChange}
                      className="mt-1 w-5 h-5 text-indigo-600 bg-gray-100 border-gray-300 rounded focus:ring-indigo-500 focus:ring-2 cursor-pointer"
                    />
                    <div>
                      <span className="text-sm font-bold text-gray-900">
                        Usa fichas
                      </span>
                      <p className="text-xs text-gray-600 mt-1">
                        Quando marcado, o saldo da leitura sera a diferenca do
                        IN multiplicada pelo valor da jogada desta maquina.
                      </p>
                    </div>
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Comissão do Ponto{" "}
                    {valorAluguelPonto > 0 ? "(fixa em 0%)" : "(%) *"}
                  </label>
                  <input
                    type="number"
                    name="comissaoLojaPercentual"
                    value={formData.comissaoLojaPercentual}
                    onChange={handleChange}
                    className="input-field"
                    placeholder={valorAluguelPonto > 0 ? "0" : "Ex: 15"}
                    min="0"
                    max="100"
                    step="0.01"
                    required={valorAluguelPonto <= 0}
                    disabled={valorAluguelPonto > 0 || loadingRegraComissao}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {loadingRegraComissao
                      ? "Carregando regra do ponto..."
                      : valorAluguelPonto > 0
                        ? `Este ponto possui aluguel de R$ ${valorAluguelPonto.toFixed(2)}. A comissão deve permanecer em 0%.`
                        : "Sem aluguel cadastrado para o ponto. O preenchimento da comissão é obrigatório."}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    🎫 Fichas para Jogar
                  </label>
                  <input
                    type="number"
                    name="fichasNecessarias"
                    value={formData.fichasNecessarias}
                    onChange={handleChange}
                    className="input-field"
                    placeholder="Ex: 1"
                    min="1"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Quantas fichas são necessárias para liberar uma jogada
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    💪 Força Forte (%)
                  </label>
                  <input
                    type="number"
                    name="forcaForte"
                    value={formData.forcaForte}
                    onChange={handleChange}
                    className="input-field"
                    placeholder="Ex: 90"
                    min="0"
                    max="100"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Parâmetro de força forte da garra (0-100%)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    🤏 Força Fraca (%)
                  </label>
                  <input
                    type="number"
                    name="forcaFraca"
                    value={formData.forcaFraca}
                    onChange={handleChange}
                    className="input-field"
                    placeholder="Ex: 30"
                    min="0"
                    max="100"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Parâmetro de força fraca da garra (0-100%)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    ⭐ Força Premium (%)
                  </label>
                  <input
                    type="number"
                    name="forcaPremium"
                    value={formData.forcaPremium}
                    onChange={handleChange}
                    className="input-field"
                    placeholder="Ex: 100"
                    min="0"
                    max="100"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Parâmetro de força premium da garra (0-100%)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    🎮 Jogadas para Força Premium
                  </label>
                  <input
                    type="number"
                    name="jogadasPremium"
                    value={formData.jogadasPremium}
                    onChange={handleChange}
                    className="input-field"
                    placeholder="Ex: 10"
                    min="1"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Quantidade de jogadas com força premium
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Alerta de Estoque (%)
                  </label>
                  <input
                    type="number"
                    name="percentualAlertaEstoque"
                    value={formData.percentualAlertaEstoque}
                    onChange={handleChange}
                    className="input-field"
                    placeholder="Ex: 20"
                    min="0"
                    max="100"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Percentual mínimo para alerta (padrão: 20%)
                  </p>
                </div>

                {!isEdit && (
                  <>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Contador Entrada Inicial
                      </label>
                      <input
                        type="number"
                        name="contadorInInicial"
                        value={formData.contadorInInicial}
                        onChange={handleChange}
                        className="input-field"
                        placeholder="Ex: 1000"
                        min="0"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Opcional. Preencha junto com OUT para lançar
                        movimentação inicial automática.
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Contador Saída Inicial
                      </label>
                      <input
                        type="number"
                        name="contadorOutInicial"
                        value={formData.contadorOutInicial}
                        onChange={handleChange}
                        className="input-field"
                        placeholder="Ex: 500"
                        min="0"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Opcional. Se preencher um, preencha o outro também.
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Informações Adicionais */}
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-primary"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z"
                    clipRule="evenodd"
                  />
                </svg>
                Localização
              </h3>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Localização no Ponto
                  </label>
                  <textarea
                    name="localizacao"
                    value={formData.localizacao}
                    onChange={handleChange}
                    className="input-field"
                    rows="3"
                    placeholder="Ex: Entrada principal, lado direito próximo ao balcão..."
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Descrição da localização da máquina no ponto
                  </p>
                </div>
              </div>
            </div>

            {/* Botões */}
            <div className="flex gap-4 justify-end pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={() => navigate("/maquinas")}
                className="btn-secondary"
                disabled={loading}
              >
                Cancelar
              </button>
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? (
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
                    {isEdit ? "Atualizar Máquina" : "Criar Máquina"}
                  </span>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      <Footer />
    </div>
  );
}

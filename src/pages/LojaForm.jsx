import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../services/api";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer.jsx";
import { PageHeader, AlertBox } from "../components/UIComponents";
import { PageLoader } from "../components/Loading";

export function LojaForm() {
  const GASTOS_FIXOS_PREDEFINIDOS = ["Aluguel", "machine pay", "data tem"];

  const normalizarNomeGasto = (nome) =>
    String(nome || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "");

  const ALIASES_GASTOS_FIXOS = new Map([["chipdatatem", "datatem"]]);

  const resolverChaveGastoFixo = (nome) => {
    const chaveNormalizada = normalizarNomeGasto(nome);
    return ALIASES_GASTOS_FIXOS.get(chaveNormalizada) || chaveNormalizada;
  };

  const VALORES_BASE_GASTOS_FIXOS = new Map([
    ["aluguel", "0"],
    ["machinepay", "0"],
    ["datatem", "0"],
  ]);

  const NOMES_GASTOS_FIXOS_PADRAO = new Set([
    ...GASTOS_FIXOS_PREDEFINIDOS.map(resolverChaveGastoFixo),
    ...Array.from(ALIASES_GASTOS_FIXOS.keys()),
  ]);

  const criarGastosFixosPadrao = (valoresPorNome = new Map()) =>
    GASTOS_FIXOS_PREDEFINIDOS.map((nome) => ({
      nome,
      valor:
        valoresPorNome.get(resolverChaveGastoFixo(nome)) ||
        VALORES_BASE_GASTOS_FIXOS.get(resolverChaveGastoFixo(nome)) ||
        "",
      isPadrao: true,
    }));

  const criarGastoFixoExtraVazio = () => ({
    nome: "",
    valor: "",
    isPadrao: false,
  });

  const parseValorMonetario = (valor) => {
    const texto = String(valor ?? "").trim();
    if (!texto) return 0;

    const limpo = texto.replace(/[^\d.,-]/g, "");
    const normalizado =
      limpo.includes(",") && limpo.includes(".")
        ? limpo.replace(/\./g, "").replace(",", ".")
        : limpo.replace(",", ".");

    const numero = Number(normalizado);
    return Number.isFinite(numero) ? numero : 0;
  };

  const normalizarIdLoja = (valor) => {
    if (valor === null || valor === undefined) return "";
    return String(valor);
  };

  const extrairListaGastosFixos = (payload, lojaIdAtual) => {
    const listaPorLojaId =
      payload?.gastosPorLoja?.[lojaIdAtual] ||
      payload?.gastosFixosPorLoja?.[lojaIdAtual] ||
      payload?.data?.gastosPorLoja?.[lojaIdAtual] ||
      payload?.data?.gastosFixosPorLoja?.[lojaIdAtual];

    if (Array.isArray(listaPorLojaId)) {
      return listaPorLojaId;
    }

    const candidatos = [
      payload,
      payload?.gastos,
      payload?.gastosFixos,
      payload?.data,
      payload?.data?.gastos,
      payload?.data?.gastosFixos,
      payload?.items,
      payload?.results,
    ];

    const lista = candidatos.find(Array.isArray) || [];

    if (!Array.isArray(lista) || lista.length === 0) {
      if (
        payload &&
        typeof payload === "object" &&
        !Array.isArray(payload) &&
        (payload.nome || payload.valor !== undefined)
      ) {
        return [payload];
      }

      return [];
    }

    const lojaIdAtualNormalizado = normalizarIdLoja(lojaIdAtual);
    const possuiLojaIdNaLista = lista.some(
      (item) => item?.lojaId !== undefined && item?.lojaId !== null,
    );

    if (!possuiLojaIdNaLista) {
      return lista;
    }

    return lista.filter(
      (item) => normalizarIdLoja(item?.lojaId) === lojaIdAtualNormalizado,
    );
  };

  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [formData, setFormData] = useState({
    nome: "",
    endereco: "",
    numero: "",
    bairro: "",
    cidade: "",
    estado: "",
    cep: "",
    telefone: "",
    responsavel: "",
    ativo: true,
  });

  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(isEdit);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loadingGastosFixos, setLoadingGastosFixos] = useState(false);

  const [gastosFixos, setGastosFixos] = useState(criarGastosFixosPadrao());

  // Estados para gerenciar estoque do depósito
  const [produtos, setProdutos] = useState([]);
  const [estoque, setEstoque] = useState([]);
  const [loadingEstoque, setLoadingEstoque] = useState(false);
  const [salvandoEstoque, setSalvandoEstoque] = useState(false);

  useEffect(() => {
    if (isEdit) {
      carregarLoja();
    }
    carregarProdutos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (isEdit && produtos.length > 0) {
      carregarEstoque();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, produtos]);

  useEffect(() => {
    if (isEdit) {
      carregarGastosFixos();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, id]);

  const carregarProdutos = async () => {
    try {
      const response = await api.get("/produtos");
      setProdutos(response.data || []);
    } catch (error) {
      console.error("Erro ao carregar produtos:", error);
    }
  };

  const carregarEstoque = async () => {
    try {
      setLoadingEstoque(true);
      const response = await api.get(`/estoque-lojas/${id}`);
      setEstoque(response.data || []);
    } catch (error) {
      console.error("Erro ao carregar estoque:", error);
      setEstoque([]);
    } finally {
      setLoadingEstoque(false);
    }
  };

  const carregarLoja = async () => {
    try {
      setLoadingData(true);
      const response = await api.get(`/lojas/${id}`);
      setFormData(response.data);
    } catch (error) {
      setError(
        "Erro ao carregar loja: " +
          (error.response?.data?.error || error.message),
      );
    } finally {
      setLoadingData(false);
    }
  };

  const carregarGastosFixos = async () => {
    try {
      setLoadingGastosFixos(true);
      const response = await api.get(`/gastos-fixos-loja/${id}`, {
        params: { lojaId: id },
      });
      const listaRecebida = extrairListaGastosFixos(response.data, id);

      const valoresPorNome = new Map();
      const gastosExtras = [];

      listaRecebida.forEach((item) => {
        const nome = String(item?.nome || "").trim();
        const chave = resolverChaveGastoFixo(nome);

        const valorTexto =
          item?.valor !== null && item?.valor !== undefined
            ? String(item.valor)
            : "";

        if (!nome && !valorTexto) {
          return;
        }

        if (NOMES_GASTOS_FIXOS_PADRAO.has(chave)) {
          valoresPorNome.set(chave, valorTexto);
          return;
        }

        gastosExtras.push({
          nome,
          valor: valorTexto,
          isPadrao: false,
        });
      });

      setGastosFixos([
        ...criarGastosFixosPadrao(valoresPorNome),
        ...gastosExtras,
      ]);
    } catch (error) {
      console.error("Erro ao carregar gastos fixos:", error);
      setGastosFixos(criarGastosFixosPadrao());
    } finally {
      setLoadingGastosFixos(false);
    }
  };

  const adicionarGastoFixo = () => {
    setGastosFixos((prev) => [...prev, criarGastoFixoExtraVazio()]);
  };

  const removerGastoFixo = (index) => {
    setGastosFixos((prev) => {
      if (prev[index]?.isPadrao) return prev;
      return prev.filter((_, idx) => idx !== index);
    });
  };

  const alterarGastoFixo = (index, campo, valor) => {
    setGastosFixos((prev) =>
      prev.map((gasto, idx) => {
        if (idx !== index) return gasto;
        if (campo === "nome" && gasto.isPadrao) return gasto;

        return {
          ...gasto,
          [campo]: campo === "valor" ? valor.replace(/[^0-9.,]/g, "") : valor,
        };
      }),
    );
  };

  const salvarGastosFixosDaLoja = async (lojaId) => {
    const gastosComDados = gastosFixos.filter(
      (item) => item.isPadrao || item.nome.trim() || item.valor.trim(),
    );

    const gastoExtraSemNome = gastosComDados.find(
      (item) => !item.isPadrao && !item.nome.trim(),
    );

    if (gastoExtraSemNome) {
      throw new Error(
        "Preencha o nome de todos os gastos extras antes de salvar",
      );
    }

    const payload = {
      lojaId,
      gastos: gastosComDados.map((item) => ({
        nome: item.nome.trim(),
        valor: parseValorMonetario(item.valor),
      })),
    };

    await api.post(`/gastos-fixos-loja/${lojaId}`, payload);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === "checkbox" ? checked : value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      // Validação
      if (!formData.nome || formData.nome.trim() === "") {
        setError("Por favor, informe o nome do ponto");
        setLoading(false);
        return;
      }

      const data = {
        nome: formData.nome.trim(),
        endereco: formData.endereco.trim(),
        numero: formData.numero?.trim() || null,
        bairro: formData.bairro?.trim() || null,
        cidade: formData.cidade.trim(),
        estado: formData.estado,
        cep: formData.cep?.trim() || null,
        telefone: formData.telefone.trim(),
        responsavel: formData.responsavel?.trim() || null,
        ativo: formData.ativo,
      };

      let lojaIdSalva = id;

      if (isEdit) {
        await api.put(`/lojas/${id}`, data);
        lojaIdSalva = id;
      } else {
        const respostaCriacao = await api.post("/lojas", data);
        lojaIdSalva = respostaCriacao.data?.id;
      }

      if (lojaIdSalva) {
        await salvarGastosFixosDaLoja(lojaIdSalva);
      }

      setSuccess(
        isEdit
          ? "Ponto e gastos fixos atualizados com sucesso!"
          : "Ponto e gastos fixos criados com sucesso!",
      );

      setTimeout(() => navigate("/lojas"), 1500);
    } catch (error) {
      setError(
        error.response?.data?.error || error.message || "Erro ao salvar loja",
      );
    } finally {
      setLoading(false);
    }
  };

  const atualizarQuantidadeEstoque = (produtoId, quantidade) => {
    setEstoque((prev) => {
      const itemExiste = prev.find((item) => item.produtoId === produtoId);
      if (itemExiste) {
        return prev.map((item) =>
          item.produtoId === produtoId
            ? { ...item, quantidade: parseInt(quantidade) || 0 }
            : item,
        );
      } else {
        return [
          ...prev,
          {
            produtoId,
            quantidade: parseInt(quantidade) || 0,
            estoqueMinimo: 0,
          },
        ];
      }
    });
  };

  const atualizarEstoqueMinimoEstoque = (produtoId, estoqueMinimo) => {
    setEstoque((prev) => {
      const itemExiste = prev.find((item) => item.produtoId === produtoId);
      if (itemExiste) {
        return prev.map((item) =>
          item.produtoId === produtoId
            ? { ...item, estoqueMinimo: parseInt(estoqueMinimo) || 0 }
            : item,
        );
      } else {
        return [
          ...prev,
          {
            produtoId,
            quantidade: 0,
            estoqueMinimo: parseInt(estoqueMinimo) || 0,
          },
        ];
      }
    });
  };

  const salvarEstoque = async () => {
    try {
      setSalvandoEstoque(true);
      setError("");

      // Validar se os produtos existem antes de salvar
      const produtosValidos = estoque.filter((item) => {
        const produtoExiste = produtos.some((p) => p.id === item.produtoId);
        if (!produtoExiste) {
          console.warn(
            `⚠️ Produto ${item.produtoId} não existe mais, ignorando...`,
          );
        }
        return produtoExiste;
      });

      console.log(
        `📊 Salvando ${produtosValidos.length} produtos válidos (incluindo quantidades zeradas)`,
      );

      // Sempre usar POST que faz findOrCreate automaticamente
      for (const item of produtosValidos) {
        try {
          // POST /estoque-lojas/:lojaId cria ou atualiza usando findOrCreate
          await api.post(`/estoque-lojas/${id}`, {
            produtoId: item.produtoId,
            quantidade: item.quantidade || 0,
            estoqueMinimo: item.estoqueMinimo || 0,
          });
        } catch (itemError) {
          console.error(
            `❌ Erro ao salvar produto ${item.produtoId}:`,
            itemError.response?.data || itemError.message,
          );
          // Continuar com os próximos itens mesmo se um falhar
        }
      }

      setSuccess("Estoque atualizado com sucesso!");
      await carregarEstoque();
    } catch (error) {
      setError(
        "Erro ao salvar estoque: " +
          (error.response?.data?.error || error.message),
      );
    } finally {
      setSalvandoEstoque(false);
    }
  };

  const getQuantidadeProduto = (produtoId) => {
    const item = estoque.find((e) => e.produtoId === produtoId);
    return item?.quantidade || 0;
  };

  const getEstoqueMinimoProduto = (produtoId) => {
    const item = estoque.find((e) => e.produtoId === produtoId);
    return item?.estoqueMinimo || 0;
  };

  if (loadingData) return <PageLoader />;

  return (
    <div className="min-h-screen bg-background-light bg-pattern teddy-pattern">
      <Navbar />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title={isEdit ? "Editar Ponto" : "Novo Ponto"}
          subtitle={
            isEdit
              ? "Atualize as informações do ponto"
              : "Cadastre um novo ponto no sistema"
          }
          icon="🏪"
        />

        {error && (
          <AlertBox type="error" message={error} onClose={() => setError("")} />
        )}
        {success && <AlertBox type="success" message={success} />}

        <div className="card-gradient">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Gastos Fixos */}
            <div>
              <div className="flex items-center justify-between mb-4 gap-3">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <svg
                    className="w-5 h-5 text-primary"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm1 4a1 1 0 10-2 0v3H6a1 1 0 100 2h3v3a1 1 0 102 0v-3h3a1 1 0 100-2h-3V6z" />
                  </svg>
                  Gastos Fixos (padrao para todas as maquinas)
                </h3>
                <button
                  type="button"
                  onClick={adicionarGastoFixo}
                  className="btn-secondary"
                >
                  + Adicionar gasto extra
                </button>
              </div>

              {loadingGastosFixos && isEdit && (
                <div className="text-sm text-gray-600 mb-3">
                  Carregando gastos fixos...
                </div>
              )}

              <div className="space-y-3">
                {gastosFixos.map((gasto, index) => (
                  <div
                    key={`gasto-fixo-${index}`}
                    className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                      <div className="md:col-span-7">
                        <label className="block text-sm font-semibold text-gray-700 mb-1">
                          Nome do gasto
                        </label>
                        <input
                          type="text"
                          className={
                            gasto.isPadrao
                              ? "input-field bg-gray-100 text-gray-600 cursor-not-allowed"
                              : "input-field"
                          }
                          value={gasto.nome}
                          placeholder={gasto.isPadrao ? "" : "Ex: Limpeza"}
                          readOnly={gasto.isPadrao}
                          disabled={gasto.isPadrao}
                          onChange={(e) =>
                            alterarGastoFixo(index, "nome", e.target.value)
                          }
                        />
                      </div>

                      <div className="md:col-span-3">
                        <label className="block text-sm font-semibold text-gray-700 mb-1">
                          Valor
                        </label>
                        <input
                          type="text"
                          inputMode="decimal"
                          pattern="[0-9.,]*"
                          className="input-field"
                          placeholder="0,00"
                          value={gasto.valor}
                          onChange={(e) =>
                            alterarGastoFixo(index, "valor", e.target.value)
                          }
                        />
                      </div>

                      <div className="md:col-span-2">
                        {!gasto.isPadrao && (
                          <button
                            type="button"
                            onClick={() => removerGastoFixo(index)}
                            className="w-full px-3 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                          >
                            Remover
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

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
                    Nome do Ponto *
                  </label>
                  <input
                    type="text"
                    name="nome"
                    value={formData.nome}
                    onChange={handleChange}
                    className="input-field"
                    placeholder="Ex: Ponto Shopping Center"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Responsável
                  </label>
                  <input
                    type="text"
                    name="responsavel"
                    value={formData.responsavel}
                    onChange={handleChange}
                    className="input-field"
                    placeholder="Nome do responsável"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Telefone *
                  </label>
                  <input
                    type="tel"
                    name="telefone"
                    value={formData.telefone}
                    onChange={handleChange}
                    className="input-field"
                    placeholder="(11) 99999-9999"
                    required
                  />
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
                      Ponto Ativo
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* Endereço */}
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-primary"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                    clipRule="evenodd"
                  />
                </svg>
                Endereço
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Endereço *
                  </label>
                  <input
                    type="text"
                    name="endereco"
                    value={formData.endereco}
                    onChange={handleChange}
                    className="input-field"
                    placeholder="Ex: Rua das Flores"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Número
                  </label>
                  <input
                    type="text"
                    name="numero"
                    value={formData.numero}
                    onChange={handleChange}
                    className="input-field"
                    placeholder="Ex: 123"
                    maxLength={20}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Bairro
                  </label>
                  <input
                    type="text"
                    name="bairro"
                    value={formData.bairro}
                    onChange={handleChange}
                    className="input-field"
                    placeholder="Ex: Centro"
                    maxLength={100}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Cidade *
                  </label>
                  <input
                    type="text"
                    name="cidade"
                    value={formData.cidade}
                    onChange={handleChange}
                    className="input-field"
                    placeholder="São Paulo"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Estado *
                  </label>
                  <select
                    name="estado"
                    value={formData.estado}
                    onChange={handleChange}
                    className="select-field"
                    required
                  >
                    <option value="">Selecione...</option>
                    <option value="AC">Acre</option>
                    <option value="AL">Alagoas</option>
                    <option value="AP">Amapá</option>
                    <option value="AM">Amazonas</option>
                    <option value="BA">Bahia</option>
                    <option value="CE">Ceará</option>
                    <option value="DF">Distrito Federal</option>
                    <option value="ES">Espírito Santo</option>
                    <option value="GO">Goiás</option>
                    <option value="MA">Maranhão</option>
                    <option value="MT">Mato Grosso</option>
                    <option value="MS">Mato Grosso do Sul</option>
                    <option value="MG">Minas Gerais</option>
                    <option value="PA">Pará</option>
                    <option value="PB">Paraíba</option>
                    <option value="PR">Paraná</option>
                    <option value="PE">Pernambuco</option>
                    <option value="PI">Piauí</option>
                    <option value="RJ">Rio de Janeiro</option>
                    <option value="RN">Rio Grande do Norte</option>
                    <option value="RS">Rio Grande do Sul</option>
                    <option value="RO">Rondônia</option>
                    <option value="RR">Roraima</option>
                    <option value="SC">Santa Catarina</option>
                    <option value="SP">São Paulo</option>
                    <option value="SE">Sergipe</option>
                    <option value="TO">Tocantins</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    CEP
                  </label>
                  <input
                    type="text"
                    name="cep"
                    value={formData.cep}
                    onChange={handleChange}
                    className="input-field"
                    placeholder="00000-000"
                  />
                </div>
              </div>
            </div>

            {/* Estoque do Depósito - Apenas para edição */}
            {isEdit && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <svg
                      className="w-5 h-5 text-primary"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M4 3a2 2 0 100 4h12a2 2 0 100-4H4z" />
                      <path
                        fillRule="evenodd"
                        d="M3 8h14v7a2 2 0 01-2 2H5a2 2 0 01-2-2V8zm5 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Estoque do Depósito
                  </h3>
                  {loadingEstoque && (
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                  )}
                </div>

                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <p className="text-sm text-gray-600">
                    💡 Configure aqui o estoque de produtos disponíveis no
                    depósito deste ponto. Estes produtos podem ser transferidos
                    para as máquinas.
                  </p>
                </div>

                {produtos.length > 0 ? (
                  <div className="space-y-3">
                    {produtos.map((produto) => (
                      <div
                        key={produto.id}
                        className="border-2 border-gray-200 rounded-lg p-4 hover:border-primary/30 transition-colors bg-white"
                      >
                        <div className="flex items-center gap-4">
                          <span className="text-3xl">
                            {produto.emoji || "📦"}
                          </span>
                          <div className="flex-1">
                            <h4 className="font-bold text-gray-900">
                              {produto.nome}
                            </h4>
                            {produto.codigo && (
                              <p className="text-xs text-gray-500">
                                Cód: {produto.codigo}
                              </p>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-semibold text-gray-600 mb-1">
                                Quantidade
                              </label>
                              <input
                                type="number"
                                min="0"
                                value={getQuantidadeProduto(produto.id)}
                                onChange={(e) =>
                                  atualizarQuantidadeEstoque(
                                    produto.id,
                                    e.target.value,
                                  )
                                }
                                className="input-field text-center w-24"
                                disabled={loadingEstoque}
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-gray-600 mb-1">
                                Estoque Mín.
                              </label>
                              <input
                                type="number"
                                min="0"
                                value={getEstoqueMinimoProduto(produto.id)}
                                onChange={(e) =>
                                  atualizarEstoqueMinimoEstoque(
                                    produto.id,
                                    e.target.value,
                                  )
                                }
                                className="input-field text-center w-24"
                                disabled={loadingEstoque}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}

                    <div className="flex justify-end pt-4">
                      <button
                        type="button"
                        onClick={salvarEstoque}
                        className="btn-primary"
                        disabled={salvandoEstoque || loadingEstoque}
                      >
                        {salvandoEstoque ? (
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
                            Salvando Estoque...
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
                            Salvar Estoque
                          </span>
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p className="text-4xl mb-2">📦</p>
                    <p>Nenhum produto cadastrado no sistema</p>
                    <p className="text-sm mt-1">
                      Cadastre produtos primeiro em Produtos
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Botões */}
            <div className="flex gap-4 justify-end pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={() => navigate("/lojas")}
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
                    {isEdit ? "Atualizar Ponto" : "Criar Ponto"}
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

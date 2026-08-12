import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer.jsx";
import api from "../services/api";
import { useAuth } from "../contexts/AuthContext.jsx";

// Página dedicada de lançamento de gasto semanal do roteiro, pro
// funcionário — reimplementa (não extrai/compartilha) o mesmo bloco que
// existe embutido em RoteiroExecucaoConteudo.jsx pra ADMIN/GERENCIADOR, pra
// não mexer naquele componente gigante além do necessário. Mesma lógica,
// mesmas validações, mesmos endpoints.
const CATEGORIAS_GASTO = [
  { value: "transporte", label: "Transporte" },
  { value: "estadia", label: "Estadia" },
  { value: "abastecimento", label: "Abastecimento" },
  { value: "alimentacao", label: "Alimentação" },
  { value: "outros", label: "Outros" },
];

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

const parseValorMonetario = (valorTexto) => {
  const texto = String(valorTexto || "").trim();
  if (!texto) return 0;
  return Number(texto.replace(",", "."));
};

const getLabelCategoriaGasto = (categoria) =>
  CATEGORIAS_GASTO.find((item) => item.value === categoria)?.label ||
  categoria;

const carregarDadosRoteiro = async (roteiroId) => {
  const endpoints = [`/roteiros/${roteiroId}/executar`, `/roteiros/${roteiroId}`];
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

export default function LancarGasto() {
  const { usuario } = useAuth();

  const [carregandoRoteiros, setCarregandoRoteiros] = useState(true);
  const [meusRoteiros, setMeusRoteiros] = useState([]);
  const [roteiroSelecionadoId, setRoteiroSelecionadoId] = useState("");
  const [roteiro, setRoteiro] = useState(null);
  const [carregandoRoteiro, setCarregandoRoteiro] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [gastoForm, setGastoForm] = useState({
    categoria: "transporte",
    valor: "",
    quilometragem: "",
    litros: "",
    nivelCombustivel: "Cheio",
    observacao: "",
  });
  const [lancandoGasto, setLancandoGasto] = useState(false);

  useEffect(() => {
    if (!usuario?.id) return;

    let ativo = true;

    const carregarMeusRoteiros = async () => {
      try {
        setCarregandoRoteiros(true);
        setError("");
        const res = await api.get("/roteiros");
        if (!ativo) return;

        const todos = Array.isArray(res.data) ? res.data : [];
        const meus = todos.filter(
          (r) =>
            String(r.funcionarioId) === String(usuario.id) &&
            r.permiteGastos !== false,
        );

        setMeusRoteiros(meus);
        if (meus.length === 1) {
          setRoteiroSelecionadoId(String(meus[0].id));
        }
      } catch (err) {
        if (!ativo) return;
        console.error("Erro ao carregar roteiros:", err);
        setError("Erro ao carregar seus roteiros.");
      } finally {
        if (ativo) setCarregandoRoteiros(false);
      }
    };

    carregarMeusRoteiros();

    return () => {
      ativo = false;
    };
  }, [usuario?.id]);

  const recarregarRoteiroSelecionado = async () => {
    if (!roteiroSelecionadoId) {
      setRoteiro(null);
      return;
    }

    try {
      setCarregandoRoteiro(true);
      setError("");
      const res = await carregarDadosRoteiro(roteiroSelecionadoId);
      setRoteiro(res?.data || null);
    } catch (err) {
      console.error("Erro ao carregar roteiro:", err);
      setError(
        err?.response?.data?.error || "Erro ao carregar dados do roteiro.",
      );
      setRoteiro(null);
    } finally {
      setCarregandoRoteiro(false);
    }
  };

  useEffect(() => {
    recarregarRoteiroSelecionado();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roteiroSelecionadoId]);

  const handleLancarGasto = async () => {
    if (!roteiroSelecionadoId || !roteiro) return;

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

      const res = await api.post(
        `/roteiros/${roteiroSelecionadoId}/gastos`,
        payload,
      );

      setSuccess(res?.data?.message || "Gasto semanal registrado com sucesso.");
      setGastoForm((prev) => ({
        ...prev,
        valor: "",
        quilometragem: "",
        litros: "",
        observacao: "",
      }));
      await recarregarRoteiroSelecionado();
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

  const orcamentoConvertido = Number(
    roteiro?.orcamentoSemanal ?? roteiro?.orcamentoDiario,
  );
  const totalGastoConvertido = Number(
    roteiro?.totalGastoSemana ?? roteiro?.totalGastoHoje,
  );
  const saldoConvertido = Number(
    roteiro?.saldoGastoSemana ?? roteiro?.saldoGastoHoje,
  );
  const inicioSemanaGastos = String(
    roteiro?.periodoGastos?.inicioSemana || "",
  ).trim();
  const fimSemanaGastos = String(roteiro?.periodoGastos?.fimSemana || "").trim();

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
  const percentualSaldoBarra = Math.max(0, Math.min(100, percentualSaldo * 100));
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
    ...(roteiro?.gastosSemana || roteiro?.gastosHoje || []),
  ].sort((a, b) => new Date(b.dataHora) - new Date(a.dataHora));

  return (
    <div className="min-h-screen bg-background-light">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">
          💸 Lançar Gasto
        </h1>
        <p className="text-sm text-gray-600 mb-6">
          Registre gastos semanais (transporte, estadia, abastecimento etc.)
          do seu roteiro.
        </p>

        {error ? (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}
        {success ? (
          <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {success}
          </div>
        ) : null}

        <div className="bg-white rounded-xl shadow p-5 border border-gray-200 mb-6">
          <label className="block text-sm font-bold text-gray-700 mb-1">
            Roteiro
          </label>
          {carregandoRoteiros ? (
            <p className="text-sm text-gray-500">Carregando seus roteiros...</p>
          ) : meusRoteiros.length === 0 ? (
            <p className="text-sm text-gray-500">
              Nenhum roteiro disponível para lançar gastos.
            </p>
          ) : (
            <select
              className="w-full p-3 border rounded-lg bg-white"
              value={roteiroSelecionadoId}
              onChange={(e) => setRoteiroSelecionadoId(e.target.value)}
            >
              <option value="" disabled>
                Selecione um roteiro
              </option>
              {meusRoteiros.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nome}
                </option>
              ))}
            </select>
          )}
        </div>

        {carregandoRoteiro ? (
          <div className="bg-white rounded-xl shadow p-5 border border-gray-200 text-center text-gray-500">
            Carregando dados do roteiro...
          </div>
        ) : roteiro ? (
          <section className="bg-white rounded-xl shadow p-5 border border-gray-200">
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

            {gastosSemanaOrdenados.length > 0 ? (
              <div className="sm:hidden space-y-2">
                {gastosSemanaOrdenados.map((gasto) => {
                  const dataHoraFormatada = formatarDataHora(gasto.dataHora);
                  return (
                    <div
                      key={gasto.id}
                      className="rounded-lg border border-gray-200 p-3 text-sm space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold">
                          {getLabelCategoriaGasto(gasto.categoria)}
                        </span>
                        <span className="font-semibold text-gray-800">
                          {formatarMoedaBRL(gasto.valor)}
                        </span>
                      </div>
                      <p className="text-gray-600">
                        KM: {gasto.quilometragem ?? "-"}
                      </p>
                      <p className="text-gray-600">
                        Observação: {gasto.observacao?.trim() || "-"}
                      </p>
                      <p className="text-gray-600">
                        Funcionário: {gasto.usuario?.nome || usuario?.nome || "-"}
                      </p>
                      <p className="text-gray-600">
                        {dataHoraFormatada.data} às {dataHoraFormatada.hora}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="sm:hidden px-3 py-4 text-center text-gray-500 italic">
                Nenhum gasto lançado nesta semana para este roteiro.
              </p>
            )}

            <div className="hidden sm:block overflow-x-auto rounded-lg border border-gray-200">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-bold">Categoria</th>
                    <th className="px-3 py-2 text-left font-bold">Valor</th>
                    <th className="px-3 py-2 text-left font-bold">KM</th>
                    <th className="px-3 py-2 text-left font-bold">Observação</th>
                    <th className="px-3 py-2 text-left font-bold">
                      Funcionário
                    </th>
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
        ) : null}
      </main>

      <Footer />
    </div>
  );
}

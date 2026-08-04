import { useState, useEffect } from "react";
import api from "../services/api";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer.jsx";
import { PageHeader, AlertBox } from "../components/UIComponents";
import { PageLoader } from "../components/Loading";
import { useAuth } from "../contexts/AuthContext.jsx";

const parseNumeroFluxo = (valor) => {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
};

const arredondarMoeda = (valor) => {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return 0;
  return Math.round(numero * 100) / 100;
};

const pickNumeroFluxo = (...valores) => {
  for (const valor of valores) {
    const numero = parseNumeroFluxo(valor);
    if (numero !== null) return numero;
  }
  return null;
};

const calcularValorEsperadoFluxo = (fluxo) => {
  const movimentacao = fluxo?.movimentacao || {};
  const valorEsperadoSalvo = pickNumeroFluxo(
    fluxo?.valorEsperado,
    fluxo?.valorEsperadoCalculado,
    movimentacao?.valorFaturado,
  );

  if (valorEsperadoSalvo !== null) {
    return arredondarMoeda(valorEsperadoSalvo);
  }

  const contadorInAtual = parseNumeroFluxo(
    movimentacao?.contadorIn ?? movimentacao?.contadorInDigital,
  );
  const contadorInAnterior = parseNumeroFluxo(
    fluxo?.contadorInAnteriorCronologico ??
      movimentacao?.contadorInAnterior ??
      fluxo?.contadorInAnterior ??
      fluxo?.ultimoContadorInRetirada,
  );

  const contadorOutAtual = parseNumeroFluxo(
    movimentacao?.contadorOut ?? movimentacao?.contadorOutDigital,
  );
  const contadorOutAnterior = parseNumeroFluxo(
    fluxo?.contadorOutAnteriorCronologico ??
      movimentacao?.contadorOutAnterior ??
      fluxo?.contadorOutAnterior ??
      fluxo?.ultimoContadorOutRetirada,
  );

  const diferencaContadorIn =
    contadorInAtual !== null && contadorInAnterior !== null
      ? Math.max(0, contadorInAtual - contadorInAnterior)
      : null;

  const diferencaContadorOut =
    contadorOutAtual !== null && contadorOutAnterior !== null
      ? Math.max(0, contadorOutAtual - contadorOutAnterior)
      : null;

  const diferencaBase =
    diferencaContadorIn !== null ? diferencaContadorIn : diferencaContadorOut;

  return arredondarMoeda(diferencaBase ?? 0);
};

const obterValorRetiradoDigitalFluxo = (fluxo) =>
  arredondarMoeda(
    pickNumeroFluxo(
      fluxo?.valorRetiradoDigital,
      fluxo?.valorRetiradoCartaoPix,
      fluxo?.valorDigital,
      fluxo?.cartaoPix,
      fluxo?.pixCartao,
    ) ?? 0,
  );

const obterValorRetiradoFisicoFluxo = (fluxo) => {
  const fisico = pickNumeroFluxo(
    fluxo?.valorRetiradoFisico,
    fluxo?.valorRetiradoDinheiro,
    fluxo?.valorFisico,
    fluxo?.dinheiro,
  );

  if (fisico !== null) return arredondarMoeda(fisico);

  const total = pickNumeroFluxo(fluxo?.valorRetiradoTotal);
  const digital = obterValorRetiradoDigitalFluxo(fluxo);

  if (total !== null) return arredondarMoeda(Math.max(0, total - digital));

  return arredondarMoeda(pickNumeroFluxo(fluxo?.valorRetirado) ?? 0);
};

const fluxoEstaPreenchido = (fluxo) => {
  const conferencia = String(fluxo?.conferencia || "").toLowerCase();
  if (conferencia === "pendente") return false;
  if (conferencia) return true;

  return (
    parseNumeroFluxo(fluxo?.valorRetiradoFisico) !== null ||
    parseNumeroFluxo(fluxo?.valorRetiradoDinheiro) !== null ||
    parseNumeroFluxo(fluxo?.valorFisico) !== null ||
    parseNumeroFluxo(fluxo?.valorRetiradoDigital) !== null ||
    parseNumeroFluxo(fluxo?.valorRetiradoCartaoPix) !== null ||
    parseNumeroFluxo(fluxo?.valorDigital) !== null ||
    parseNumeroFluxo(fluxo?.valorRetirado) !== null ||
    parseNumeroFluxo(fluxo?.valorRetiradoTotal) !== null
  );
};

export default function FluxoCaixa() {
  const { usuario } = useAuth();
  const [fluxos, setFluxos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtros, setFiltros] = useState({
    dataInicio: formatDate(
      new Date(new Date().setDate(new Date().getDate() - 7)),
    ),
    dataFim: formatDate(new Date()),
    lojaId: "",
    status: "todos",
  });
  const [resumo, setResumo] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [lojas, setLojas] = useState([]);

  const roundTo2 = (valor) => {
    return arredondarMoeda(valor);
  };

  useEffect(() => {
    carregarLojas();
  }, []);

  useEffect(() => {
    carregarFluxos();
    carregarResumo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtros]);

  const carregarLojas = async () => {
    try {
      const response = await api.get("/lojas");
      setLojas(response.data || []);
    } catch (error) {
      console.error("Erro ao carregar lojas:", error);
    }
  };

  const carregarFluxos = async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      params.append("dataInicio", filtros.dataInicio);
      params.append("dataFim", filtros.dataFim);
      if (filtros.lojaId) params.append("lojaId", filtros.lojaId);
      if (filtros.status !== "todos") params.append("status", filtros.status);

      const response = await api.get(`/fluxo-caixa?${params}`);
      setFluxos(response.data || []);
    } catch (error) {
      console.error("Erro ao carregar fluxo de caixa:", error);
      setError("Erro ao carregar dados do fluxo de caixa");
    } finally {
      setLoading(false);
    }
  };

  const carregarResumo = async () => {
    try {
      const params = new URLSearchParams();
      params.append("dataInicio", filtros.dataInicio);
      params.append("dataFim", filtros.dataFim);
      if (filtros.lojaId) params.append("lojaId", filtros.lojaId);

      const response = await api.get(`/fluxo-caixa/resumo?${params}`);
      setResumo(response.data);
    } catch (error) {
      console.error("Erro ao carregar resumo:", error);
    }
  };

  const conferirFluxo = async (
    fluxoId,
    valorRetiradoFisico,
    valorRetiradoDigital,
    conferencia,
    observacoes,
    valorEsperado,
  ) => {
    try {
      setError("");
      setSuccess("");

      const fisico = roundTo2(valorRetiradoFisico);
      const digital = roundTo2(valorRetiradoDigital);
      const esperado = roundTo2(valorEsperado);

      if (fisico < 0 || digital < 0) {
        setError("❌ Os valores de retirada não podem ser negativos.");
        return;
      }

      const payload = {
        valorRetiradoFisico: fisico,
        valorRetiradoDigital: digital,
        conferencia,
        observacoes: observacoes || null,
      };

      // Se valorEsperado foi fornecido, incluir no payload
      if (valorEsperado !== undefined && valorEsperado !== null) {
        payload.valorEsperado = esperado;
      }

      const response = await api.put(`/fluxo-caixa/${fluxoId}`, payload);

      if (response.status === 200) {
        setSuccess("✅ Conferência registrada com sucesso!");
        await carregarFluxos();
        await carregarResumo();
        setTimeout(() => setSuccess(""), 3000);
      }
    } catch (error) {
      console.error("Erro ao conferir:", error);
      setError(
        "❌ Erro ao conferir fluxo de caixa: " +
          (error.response?.data?.error || error.message),
      );
    }
  };

  const fluxosFiltrados = fluxos.filter((fluxo) => {
    const lojaFluxoId = String(
      fluxo?.movimentacao?.maquina?.lojaId ||
        fluxo?.movimentacao?.maquina?.loja?.id ||
        "",
    );

    if (filtros.lojaId && lojaFluxoId !== String(filtros.lojaId)) {
      return false;
    }

    const dataFluxo =
      fluxo?.movimentacao?.dataColeta ||
      fluxo?.movimentacao?.createdAt ||
      fluxo?.createdAt ||
      fluxo?.updatedAt;

    if (!dataFluxo) return false;

    const dataObj = new Date(dataFluxo);
    if (Number.isNaN(dataObj.getTime())) {
      return false;
    }
    const dataSomenteDia = formatLocalDateKey(dataObj);

    if (filtros.dataInicio && dataSomenteDia < filtros.dataInicio) {
      return false;
    }

    if (filtros.dataFim && dataSomenteDia > filtros.dataFim) {
      return false;
    }

    return true;
  });

  const fluxosComBaseContadores = (() => {
    const obterContadorInAtual = (fluxo) =>
      parseNumeroFluxo(
        fluxo?.movimentacao?.contadorIn ??
          fluxo?.movimentacao?.contadorInDigital,
      );

    const obterContadorOutAtual = (fluxo) =>
      parseNumeroFluxo(
        fluxo?.movimentacao?.contadorOut ??
          fluxo?.movimentacao?.contadorOutDigital,
      );

    const normalizarNumeroOrdenacao = (
      valor,
      fallback = Number.MAX_SAFE_INTEGER,
    ) => (valor === null ? fallback : valor);

    const obterIdMovimentacao = (fluxo) =>
      String(fluxo?.movimentacao?.id || fluxo?.id || "");

    const obterMaquinaId = (fluxo) =>
      String(
        fluxo?.movimentacao?.maquinaId ||
          fluxo?.movimentacao?.maquina?.id ||
          "",
      );

    const obterDataFluxo = (fluxo) => {
      const data =
        fluxo?.movimentacao?.dataColeta ||
        fluxo?.movimentacao?.createdAt ||
        fluxo?.createdAt ||
        fluxo?.updatedAt;
      const dataMs = new Date(data).getTime();
      return Number.isFinite(dataMs) ? dataMs : 0;
    };

    const ordenadosPorData = [...fluxosFiltrados]
      .map((fluxo, indiceOriginal) => ({ fluxo, indiceOriginal }))
      .sort((itemA, itemB) => {
        const a = itemA.fluxo;
        const b = itemB.fluxo;

        const diferencaData = obterDataFluxo(a) - obterDataFluxo(b);
        if (diferencaData !== 0) return diferencaData;

        const maquinaA = obterMaquinaId(a);
        const maquinaB = obterMaquinaId(b);
        const diferencaMaquina = maquinaA.localeCompare(maquinaB, "pt-BR", {
          numeric: true,
          sensitivity: "base",
        });
        if (diferencaMaquina !== 0) return diferencaMaquina;

        const inA = normalizarNumeroOrdenacao(obterContadorInAtual(a));
        const inB = normalizarNumeroOrdenacao(obterContadorInAtual(b));
        if (inA !== inB) return inA - inB;

        const outA = normalizarNumeroOrdenacao(obterContadorOutAtual(a));
        const outB = normalizarNumeroOrdenacao(obterContadorOutAtual(b));
        if (outA !== outB) return outA - outB;

        const idA = obterIdMovimentacao(a);
        const idB = obterIdMovimentacao(b);
        const diferencaId = idA.localeCompare(idB, "pt-BR", {
          numeric: true,
          sensitivity: "base",
        });
        if (diferencaId !== 0) return diferencaId;

        return itemA.indiceOriginal - itemB.indiceOriginal;
      })
      .map((item) => item.fluxo);

    const ultimoContadorPorMaquina = new Map();
    const enriquecidoPorId = new Map();

    ordenadosPorData.forEach((fluxo) => {
      const maquinaId = obterMaquinaId(fluxo);
      const anterior = ultimoContadorPorMaquina.get(maquinaId) || {};

      const contadorInAnteriorInformado =
        fluxo?.movimentacao?.contadorInAnterior ??
        fluxo?.contadorInAnterior ??
        fluxo?.ultimoContadorInRetirada ??
        null;

      const contadorOutAnteriorInformado =
        fluxo?.movimentacao?.contadorOutAnterior ??
        fluxo?.contadorOutAnterior ??
        fluxo?.ultimoContadorOutRetirada ??
        null;

      // Para manter consistência em cenário de contador digital/mecânico,
      // o "anterior" principal deve seguir a cadeia cronológica por máquina.
      const contadorInAnteriorCronologico =
        anterior.contadorInAtual ?? contadorInAnteriorInformado;

      const contadorOutAnteriorCronologico =
        anterior.contadorOutAtual ?? contadorOutAnteriorInformado;

      const contadorInAnteriorCalculado = contadorInAnteriorCronologico;

      const contadorOutAnteriorCalculado = contadorOutAnteriorCronologico;

      enriquecidoPorId.set(fluxo.id, {
        ultimoContadorInRetirada: contadorInAnteriorCalculado,
        ultimoContadorOutRetirada: contadorOutAnteriorCalculado,
        contadorInAnteriorCronologico,
        contadorOutAnteriorCronologico,
      });

      const contadorInAtual = obterContadorInAtual(fluxo);
      const contadorOutAtual = obterContadorOutAtual(fluxo);

      if (maquinaId) {
        ultimoContadorPorMaquina.set(maquinaId, {
          contadorInAtual:
            contadorInAtual !== null
              ? contadorInAtual
              : anterior.contadorInAtual,
          contadorOutAtual:
            contadorOutAtual !== null
              ? contadorOutAtual
              : anterior.contadorOutAtual,
        });
      }
    });

    return fluxosFiltrados.map((fluxo) => ({
      ...fluxo,
      ...(enriquecidoPorId.get(fluxo.id) || {}),
    }));
  })();

  const resumoCalculado = fluxosComBaseContadores.reduce(
    (acc, fluxo) => {
      const valorEsperado = calcularValorEsperadoFluxo(fluxo);
      const valorFisico = obterValorRetiradoFisicoFluxo(fluxo);
      const valorDigital = obterValorRetiradoDigitalFluxo(fluxo);
      const valorRetirado = roundTo2(valorFisico + valorDigital);

      acc.valorTotalEsperado += valorEsperado;

      if (fluxoEstaPreenchido(fluxo)) {
        acc.valorTotalRetiradoFisico += valorFisico;
        acc.valorTotalRetiradoDigital += valorDigital;
        acc.valorTotalRetirado += valorRetirado;
        acc.diferencaTotal += valorRetirado - valorEsperado;
      }

      return acc;
    },
    {
      valorTotalRetirado: 0,
      valorTotalRetiradoFisico: 0,
      valorTotalRetiradoDigital: 0,
      valorTotalEsperado: 0,
      diferencaTotal: 0,
    },
  );

  Object.keys(resumoCalculado).forEach((chave) => {
    resumoCalculado[chave] = roundTo2(resumoCalculado[chave]);
  });

  return (
    <div className="min-h-screen bg-background-light bg-pattern teddy-pattern">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title="💰 Fluxo de Caixa"
          subtitle="Controle e conferência de retiradas de dinheiro das máquinas"
          icon="💰"
        />

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

        {/* Resumo/Cards */}
        {resumo && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            <div className="stat-card bg-linear-to-br from-blue-500/10 to-blue-500/5">
              <div className="text-3xl mb-2">💵</div>
              <div className="text-xl font-bold text-gray-900">
                R${" "}
                {resumoCalculado.valorTotalRetirado.toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                })}
              </div>
              <div className="text-sm text-gray-600">Lucro Geral</div>
            </div>

            <div className="stat-card bg-linear-to-br from-green-500/10 to-green-500/5">
              <div className="text-3xl mb-2">💵</div>
              <div className="text-xl font-bold text-gray-900">
                R${" "}
                {resumoCalculado.valorTotalRetiradoFisico.toLocaleString(
                  "pt-BR",
                  { minimumFractionDigits: 2 },
                )}
              </div>
              <div className="text-sm text-gray-600">Total Físico</div>
            </div>

            <div className="stat-card bg-linear-to-br from-cyan-500/10 to-cyan-500/5">
              <div className="text-3xl mb-2">📱</div>
              <div className="text-xl font-bold text-gray-900">
                R${" "}
                {resumoCalculado.valorTotalRetiradoDigital.toLocaleString(
                  "pt-BR",
                  { minimumFractionDigits: 2 },
                )}
              </div>
              <div className="text-sm text-gray-600">Total Digital</div>
            </div>

            <div className="stat-card bg-linear-to-br from-yellow-500/10 to-yellow-500/5">
              <div className="text-3xl mb-2">🎯</div>
              <div className="text-xl font-bold text-gray-900">
                R${" "}
                {resumoCalculado.valorTotalEsperado.toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                })}
              </div>
              <div className="text-sm text-gray-600">Valor Esperado Total</div>
            </div>

            <div className="stat-card bg-linear-to-br from-purple-500/10 to-purple-500/5">
              <div className="text-3xl mb-2">📊</div>
              <div
                className={`text-xl font-bold ${resumoCalculado.diferencaTotal >= 0 ? "text-green-600" : "text-red-600"}`}
              >
                {resumoCalculado.diferencaTotal >= 0 ? "+" : ""}R${" "}
                {Math.abs(resumoCalculado.diferencaTotal).toLocaleString(
                  "pt-BR",
                  {
                    minimumFractionDigits: 2,
                  },
                )}
              </div>
              <div className="text-sm text-gray-600">Diferença Total</div>
            </div>
          </div>
        )}

        {/* Filtros */}
        <div className="card-gradient mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Data Início
              </label>
              <input
                type="date"
                value={filtros.dataInicio}
                onChange={(e) =>
                  setFiltros((prev) => ({
                    ...prev,
                    dataInicio: e.target.value,
                  }))
                }
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Data Fim
              </label>
              <input
                type="date"
                value={filtros.dataFim}
                onChange={(e) =>
                  setFiltros((prev) => ({ ...prev, dataFim: e.target.value }))
                }
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Ponto
              </label>
              <select
                value={filtros.lojaId}
                onChange={(e) =>
                  setFiltros((prev) => ({ ...prev, lojaId: e.target.value }))
                }
                className="select-field"
              >
                <option value="">Todos os pontos</option>
                {lojas.map((loja) => (
                  <option key={loja.id} value={loja.id}>
                    {loja.nome}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Status
              </label>
              <select
                value={filtros.status}
                onChange={(e) =>
                  setFiltros((prev) => ({ ...prev, status: e.target.value }))
                }
                className="select-field"
              >
                <option value="todos">Todos</option>
                <option value="pendente">⏳ Pendentes</option>
                <option value="bateu">✅ Bateu</option>
                <option value="nao_bateu">❌ Não Bateu</option>
              </select>
            </div>
          </div>
        </div>

        {/* Tabela de Fluxos */}
        <div className="card-gradient">
          <div className="mb-4">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <svg
                className="w-5 h-5 text-primary"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                <path
                  fillRule="evenodd"
                  d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z"
                  clipRule="evenodd"
                />
              </svg>
              Retiradas de Dinheiro ({fluxosComBaseContadores.length})
            </h3>
            <p className="text-xs text-gray-600 mt-2 flex items-start gap-2">
              <span className="text-blue-600">💡</span>
              <span>
                Na conferência, informe separadamente o valor retirado em
                <strong className="text-blue-700"> dinheiro físico</strong> e
                <strong className="text-cyan-700"> digital</strong>.
              </span>
            </p>
          </div>

          {loading ? (
            <PageLoader />
          ) : fluxosComBaseContadores.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📭</div>
              <p className="text-gray-600 font-medium">
                Nenhuma retirada de dinheiro encontrada no período selecionado.
              </p>
              <p className="text-sm text-gray-500 mt-2">
                As movimentações marcadas como "Retirada de Dinheiro" aparecerão
                aqui.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ponto / Máquina
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Funcionário
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Data / Horário
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Valor Esperado
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Físico
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Digital
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Retirado
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {fluxosComBaseContadores.map((fluxo) => (
                    <ItemFluxoCaixa
                      key={fluxo.id}
                      fluxo={fluxo}
                      onConferir={conferirFluxo}
                      isAdmin={usuario?.role === "ADMIN"}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
}

// Componente Item da Tabela
function ItemFluxoCaixa({ fluxo, onConferir, isAdmin }) {
  const roundTo2 = (valor) => {
    return arredondarMoeda(valor);
  };

  const valorEsperadoInicial = calcularValorEsperadoFluxo(fluxo);
  const valorRetiradoFisicoInicial = obterValorRetiradoFisicoFluxo(fluxo);
  const valorRetiradoDigitalInicial = obterValorRetiradoDigitalFluxo(fluxo);
  const valorRetiradoTotalInicial = roundTo2(
    valorRetiradoFisicoInicial + valorRetiradoDigitalInicial,
  );

  const [editando, setEditando] = useState(false);
  const [formConferencia, setFormConferencia] = useState({
    valorRetiradoFisico: valorRetiradoFisicoInicial,
    valorRetiradoDigital: valorRetiradoDigitalInicial,
    valorEsperado: valorEsperadoInicial,
    conferencia: fluxo.conferencia || "pendente",
    observacoes: fluxo.observacoes || "",
  });

  useEffect(() => {
    setFormConferencia({
      valorRetiradoFisico: valorRetiradoFisicoInicial,
      valorRetiradoDigital: valorRetiradoDigitalInicial,
      valorEsperado: valorEsperadoInicial,
      conferencia: fluxo.conferencia || "pendente",
      observacoes: fluxo.observacoes || "",
    });
  }, [
    fluxo.id,
    fluxo.valorRetirado,
    fluxo.valorRetiradoFisico,
    fluxo.valorRetiradoDinheiro,
    fluxo.valorFisico,
    fluxo.valorRetiradoDigital,
    fluxo.valorRetiradoCartaoPix,
    fluxo.valorDigital,
    fluxo.valorRetiradoTotal,
    fluxo.conferencia,
    fluxo.observacoes,
    valorEsperadoInicial,
    valorRetiradoFisicoInicial,
    valorRetiradoDigitalInicial,
  ]);

  const handleSalvar = () => {
    const fisico = roundTo2(formConferencia.valorRetiradoFisico);
    const digital = roundTo2(formConferencia.valorRetiradoDigital);

    if (fisico < 0 || digital < 0) {
      alert("⚠️ Os valores de retirada não podem ser negativos");
      return;
    }

    if (
      formConferencia.valorEsperado === "" ||
      formConferencia.valorEsperado === null ||
      formConferencia.valorEsperado === undefined
    ) {
      alert("⚠️ Digite o valor esperado");
      return;
    }

    if (formConferencia.conferencia === "pendente") {
      alert("⚠️ Selecione se o valor bateu ou não bateu");
      return;
    }

    onConferir(
      fluxo.id,
      fisico,
      digital,
      formConferencia.conferencia,
      formConferencia.observacoes,
      formConferencia.valorEsperado,
    );
    setEditando(false);
  };

  const valorEsperado = roundTo2(
    editando ? formConferencia.valorEsperado : valorEsperadoInicial,
  );
  const valorRetiradoFisico = roundTo2(
    editando ? formConferencia.valorRetiradoFisico : valorRetiradoFisicoInicial,
  );
  const valorRetiradoDigital = roundTo2(
    editando
      ? formConferencia.valorRetiradoDigital
      : valorRetiradoDigitalInicial,
  );
  const valorRetiradoTotal = editando
    ? roundTo2(valorRetiradoFisico + valorRetiradoDigital)
    : valorRetiradoTotalInicial;
  const diferenca = roundTo2(valorRetiradoTotal - valorEsperado);

  const getStatusBadge = (status) => {
    switch (status) {
      case "pendente":
        return "bg-yellow-100 text-yellow-800";
      case "bateu":
        return "bg-green-100 text-green-800";
      case "nao_bateu":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "pendente":
        return "⏳";
      case "bateu":
        return "✅";
      case "nao_bateu":
        return "❌";
      default:
        return "❓";
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case "pendente":
        return "Pendente";
      case "bateu":
        return "Bateu";
      case "nao_bateu":
        return "Não Bateu";
      default:
        return status;
    }
  };

  const dataMovimentacao =
    fluxo?.movimentacao?.dataColeta ||
    fluxo?.movimentacao?.createdAt ||
    fluxo?.createdAt ||
    fluxo?.updatedAt;
  const dataHoraMovimentacao = formatDateTime(dataMovimentacao);

  return (
    <tr
      className={`${fluxo.conferencia === "bateu" ? "bg-green-50" : fluxo.conferencia === "nao_bateu" ? "bg-red-50" : ""} hover:bg-gray-50 transition-colors`}
    >
      <td className="px-4 py-4 text-sm text-gray-900">
        <div className="font-semibold">
          {fluxo.movimentacao.maquina.loja.nome}
        </div>
        <div className="text-xs text-gray-600">
          {[
            fluxo.movimentacao.maquina.loja.endereco,
            fluxo.movimentacao.maquina.loja.numero &&
              `nº ${fluxo.movimentacao.maquina.loja.numero}`,
            fluxo.movimentacao.maquina.loja.bairro,
          ]
            .filter(Boolean)
            .join(", ")}
        </div>
        <div className="text-xs text-gray-500 mt-1">
          <strong>{fluxo.movimentacao.maquina.nome}</strong> (
          {fluxo.movimentacao.maquina.codigo})
        </div>
      </td>
      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
        <div>{fluxo.movimentacao.usuario.nome}</div>
        <div className="text-xs text-gray-500">
          {fluxo.movimentacao.usuario.email}
        </div>
      </td>
      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
        <div className="font-semibold">
          {dataHoraMovimentacao?.hora || "--:--"}
        </div>
        {dataHoraMovimentacao?.data && (
          <div className="text-xs text-gray-500">
            {dataHoraMovimentacao.data}
          </div>
        )}
      </td>
      <td className="px-4 py-4 whitespace-nowrap text-sm text-right font-semibold text-gray-900">
        <div className="flex flex-col items-end gap-1">
          <span>
            R${" "}
            {valorEsperado.toLocaleString("pt-BR", {
              minimumFractionDigits: 2,
            })}
          </span>
        </div>
      </td>
      <td className="px-4 py-4 whitespace-nowrap text-sm text-right">
        {editando ? (
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-600 font-semibold">
              Físico:
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formConferencia.valorRetiradoFisico}
              onChange={(e) =>
                setFormConferencia((prev) => ({
                  ...prev,
                  valorRetiradoFisico: e.target.value,
                }))
              }
              placeholder="0.00"
              className="w-32 px-2 py-1 border-2 border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>
        ) : (
          <span className="font-bold text-gray-900">
            R${" "}
            {valorRetiradoFisico.toLocaleString("pt-BR", {
              minimumFractionDigits: 2,
            })}
          </span>
        )}
      </td>
      <td className="px-4 py-4 whitespace-nowrap text-sm text-right">
        {editando ? (
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-600 font-semibold">
              Digital:
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formConferencia.valorRetiradoDigital}
              onChange={(e) =>
                setFormConferencia((prev) => ({
                  ...prev,
                  valorRetiradoDigital: e.target.value,
                }))
              }
              placeholder="0.00"
              className="w-28 px-2 py-1 border-2 border-cyan-500 rounded focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>
        ) : (
          <span className="font-bold text-gray-900">
            R${" "}
            {valorRetiradoDigital.toLocaleString("pt-BR", {
              minimumFractionDigits: 2,
            })}
          </span>
        )}
      </td>
      <td className="px-4 py-4 whitespace-nowrap text-sm text-right">
        <div>
          <div className="font-bold text-gray-900">
            R${" "}
            {valorRetiradoTotal.toLocaleString("pt-BR", {
              minimumFractionDigits: 2,
            })}
          </div>
          <div
            className={`text-xs font-semibold ${diferenca > 0 ? "text-green-600" : diferenca < 0 ? "text-red-600" : "text-gray-500"}`}
          >
            {diferenca > 0 ? "+" : ""}R${" "}
            {Math.abs(diferenca).toLocaleString("pt-BR", {
              minimumFractionDigits: 2,
            })}
          </div>
        </div>
      </td>
      <td className="px-4 py-4 whitespace-nowrap text-sm text-center">
        {editando ? (
          <select
            value={formConferencia.conferencia}
            onChange={(e) =>
              setFormConferencia((prev) => ({
                ...prev,
                conferencia: e.target.value,
              }))
            }
            className="px-3 py-1 border-2 border-primary rounded focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="pendente">⏳ Pendente</option>
            <option value="bateu">✅ Bateu</option>
            <option value="nao_bateu">❌ Não Bateu</option>
          </select>
        ) : (
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(fluxo.conferencia)}`}
          >
            {getStatusIcon(fluxo.conferencia)}{" "}
            {getStatusText(fluxo.conferencia)}
          </span>
        )}
      </td>
      <td className="px-4 py-4 whitespace-nowrap text-sm text-center">
        {isAdmin ? (
          editando ? (
            <div className="flex gap-2 justify-center">
              <button
                onClick={handleSalvar}
                className="px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-xs font-semibold"
              >
                ✅ Salvar
              </button>
              <button
                onClick={() => {
                  setEditando(false);
                  setFormConferencia({
                    valorRetiradoFisico: valorRetiradoFisicoInicial,
                    valorRetiradoDigital: valorRetiradoDigitalInicial,
                    valorEsperado: valorEsperadoInicial,
                    conferencia: fluxo.conferencia || "pendente",
                    observacoes: fluxo.observacoes || "",
                  });
                }}
                className="px-3 py-1 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors text-xs font-semibold"
              >
                ❌ Cancelar
              </button>
            </div>
          ) : fluxo.conferencia === "pendente" ? (
            <button
              onClick={() => setEditando(true)}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors text-xs font-semibold"
            >
              📝 Conferir
            </button>
          ) : (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
              🔒 Bloqueado
            </span>
          )
        ) : (
          <span className="text-gray-400 text-xs italic">Somente admin</span>
        )}
      </td>
    </tr>
  );
}

// Função auxiliar para formatar data
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatLocalDateKey(value) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return formatDate(date);
}

function formatDateTime(value) {
  if (!value) return null;

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return {
    data: date.toLocaleDateString("pt-BR"),
    hora: date.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
}

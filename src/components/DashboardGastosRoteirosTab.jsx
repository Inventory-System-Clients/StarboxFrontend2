import { useEffect, useMemo, useState } from "react";
import api from "../services/api";
import { AlertBox } from "./UIComponents";

const CATEGORIAS_GASTO = [
  { value: "transporte", label: "Transporte" },
  { value: "estadia", label: "Estadia" },
  { value: "abastecimento", label: "Abastecimento" },
  { value: "alimentacao", label: "Alimentação" },
  { value: "outros", label: "Outros" },
];

const getCategoriaLabel = (categoria) =>
  CATEGORIAS_GASTO.find((item) => item.value === categoria)?.label ||
  categoria ||
  "-";

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

const getFiltrosPadrao = () => {
  const hoje = new Date();
  const seteDiasAtras = new Date(hoje.getTime() - 7 * 24 * 60 * 60 * 1000);

  return {
    dataInicio: seteDiasAtras.toISOString().slice(0, 10),
    dataFim: hoje.toISOString().slice(0, 10),
    roteiroId: "",
    usuarioId: "",
    categoria: "",
  };
};

export default function DashboardGastosRoteirosTab() {
  const [filtros, setFiltros] = useState(() => getFiltrosPadrao());
  const [roteiros, setRoteiros] = useState([]);
  const [funcionarios, setFuncionarios] = useState([]);
  const [resumo, setResumo] = useState({
    totalRegistros: 0,
    totalValor: 0,
    gastos: [],
  });
  const [loading, setLoading] = useState(false);
  const [loadingFiltros, setLoadingFiltros] = useState(false);
  const [error, setError] = useState("");

  const resumoSobraRotasFiltradas = useMemo(() => {
    const mapa = new Map();

    const obterInfoRoteiro = (roteiroId) => {
      const id = String(roteiroId || "").trim();
      if (!id) return null;

      return (
        roteiros.find((item) => String(item?.id || "").trim() === id) || null
      );
    };

    for (const gasto of Array.isArray(resumo.gastos) ? resumo.gastos : []) {
      const roteiroId = String(gasto?.roteiro?.id || gasto?.roteiroId || "").trim();
      if (!roteiroId) continue;

      const atual =
        mapa.get(roteiroId) || {
          roteiroId,
          nomeRoteiro: gasto?.roteiro?.nome || "Roteiro",
          totalGastoFiltrado: 0,
          sobraDireta: null,
          orcamentoDiario: null,
        };

      atual.totalGastoFiltrado += Number(gasto?.valor || 0);

      const sobraNoGasto = Number(
        gasto?.sobraValorDespesa ??
          gasto?.saldoDespesa ??
          gasto?.saldoGastoHoje ??
          gasto?.roteiro?.saldoGastoHoje,
      );
      if (Number.isFinite(sobraNoGasto)) {
        atual.sobraDireta = sobraNoGasto;
      }

      const orcamentoNoGasto = Number(
        gasto?.orcamentoDiario ?? gasto?.roteiro?.orcamentoDiario,
      );
      if (Number.isFinite(orcamentoNoGasto)) {
        atual.orcamentoDiario = orcamentoNoGasto;
      }

      const infoRoteiro = obterInfoRoteiro(roteiroId);
      if (infoRoteiro) {
        atual.nomeRoteiro = infoRoteiro?.nome || atual.nomeRoteiro;

        const saldoNoRoteiro = Number(infoRoteiro?.saldoGastoHoje);
        if (Number.isFinite(saldoNoRoteiro)) {
          atual.sobraDireta = saldoNoRoteiro;
        }

        const orcamentoNoRoteiro = Number(infoRoteiro?.orcamentoDiario);
        if (Number.isFinite(orcamentoNoRoteiro)) {
          atual.orcamentoDiario = orcamentoNoRoteiro;
        }
      }

      mapa.set(roteiroId, atual);
    }

    const rotas = Array.from(mapa.values())
      .map((item) => {
        const sobraCalculada =
          Number.isFinite(item.sobraDireta)
            ? item.sobraDireta
            : Number.isFinite(item.orcamentoDiario)
              ? item.orcamentoDiario - item.totalGastoFiltrado
              : null;

        return {
          ...item,
          sobra: Number.isFinite(sobraCalculada) ? sobraCalculada : null,
        };
      })
      .sort((a, b) =>
        String(a.nomeRoteiro || "").localeCompare(
          String(b.nomeRoteiro || ""),
          "pt-BR",
          { sensitivity: "base" },
        ),
      );

    const totalSobra = rotas.reduce(
      (acc, rota) => acc + (Number.isFinite(rota.sobra) ? rota.sobra : 0),
      0,
    );

    return {
      totalSobra,
      rotas,
    };
  }, [resumo.gastos, roteiros]);

  const buscarGastos = async (filtrosAlvo = filtros) => {
    try {
      setLoading(true);
      setError("");

      const params = {
        dataInicio: filtrosAlvo.dataInicio || undefined,
        dataFim: filtrosAlvo.dataFim || undefined,
        roteiroId: filtrosAlvo.roteiroId || undefined,
        usuarioId: filtrosAlvo.usuarioId || undefined,
        categoria: filtrosAlvo.categoria || undefined,
      };

      const response = await api.get("/dashboard/gastos-roteiros", { params });
      const data = response.data || {};

      setResumo({
        totalRegistros: Number(data.totalRegistros || 0),
        totalValor: Number(data.totalValor || 0),
        gastos: Array.isArray(data.gastos) ? data.gastos : [],
      });
    } catch (err) {
      setError(
        err?.response?.data?.error || "Erro ao carregar gastos de roteiros.",
      );
      setResumo({
        totalRegistros: 0,
        totalValor: 0,
        gastos: [],
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const carregarDadosIniciais = async () => {
      try {
        setLoadingFiltros(true);
        const [roteirosRes, funcionariosRes] = await Promise.all([
          api.get("/roteiros/com-status"),
          api.get("/usuarios/funcionarios"),
        ]);

        setRoteiros(Array.isArray(roteirosRes.data) ? roteirosRes.data : []);
        setFuncionarios(
          Array.isArray(funcionariosRes.data) ? funcionariosRes.data : [],
        );
      } catch (err) {
        setError(
          err?.response?.data?.error ||
            "Erro ao carregar opções de filtros de gastos.",
        );
      } finally {
        setLoadingFiltros(false);
      }
    };

    carregarDadosIniciais();
    buscarGastos();
  }, []);

  const handleAplicarFiltros = async (e) => {
    e.preventDefault();
    await buscarGastos();
  };

  const handleLimparFiltros = async () => {
    const novosFiltros = getFiltrosPadrao();
    setFiltros(novosFiltros);
    await buscarGastos(novosFiltros);
  };

  return (
    <div className="card-gradient mb-8 border-l-4 border-cyan-600 p-4 sm:p-8 rounded-xl shadow-md">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2 flex items-center gap-3">
            <span className="bg-linear-to-br from-cyan-600 to-blue-700 p-2 sm:p-3 rounded-xl text-white">
              💳
            </span>
            Gastos de Roteiro
          </h2>
          <p className="text-gray-600 text-sm sm:text-base">
            Acompanhe os lançamentos diários por roteiro, funcionário, categoria
            e período.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="badge bg-cyan-100 text-cyan-700 border-cyan-300">
            {resumo.totalRegistros} registros
          </span>
          <span className="badge bg-green-100 text-green-700 border-green-300">
            Total: {formatarMoedaBRL(resumo.totalValor)}
          </span>
          <span className="badge bg-emerald-100 text-emerald-700 border-emerald-300">
            Sobra: {formatarMoedaBRL(resumoSobraRotasFiltradas.totalSobra)}
          </span>
        </div>
      </div>

      {resumoSobraRotasFiltradas.rotas.length > 0 && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-xs font-bold text-emerald-800 mb-2">
            Sobra por rota filtrada
          </p>
          <div className="flex flex-wrap gap-2">
            {resumoSobraRotasFiltradas.rotas.map((rota) => (
              <span
                key={rota.roteiroId}
                className="inline-flex items-center rounded-full border border-emerald-300 bg-white px-3 py-1 text-xs text-emerald-800"
                title={`Gasto no período: ${formatarMoedaBRL(rota.totalGastoFiltrado)}`}
              >
                {rota.nomeRoteiro}: {Number.isFinite(rota.sobra) ? formatarMoedaBRL(rota.sobra) : "Não informado"}
              </span>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4">
          <AlertBox type="error" message={error} onClose={() => setError("")} />
        </div>
      )}

      <form
        onSubmit={handleAplicarFiltros}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 mb-4"
      >
        <div>
          <label className="block text-xs font-bold text-gray-600 mb-1">
            Data início
          </label>
          <input
            type="date"
            className="w-full p-2 border rounded-lg bg-white"
            value={filtros.dataInicio}
            onChange={(e) =>
              setFiltros((prev) => ({ ...prev, dataInicio: e.target.value }))
            }
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-600 mb-1">
            Data fim
          </label>
          <input
            type="date"
            className="w-full p-2 border rounded-lg bg-white"
            value={filtros.dataFim}
            onChange={(e) =>
              setFiltros((prev) => ({ ...prev, dataFim: e.target.value }))
            }
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-600 mb-1">
            Roteiro
          </label>
          <select
            className="w-full p-2 border rounded-lg bg-white"
            value={filtros.roteiroId}
            onChange={(e) =>
              setFiltros((prev) => ({ ...prev, roteiroId: e.target.value }))
            }
            disabled={loadingFiltros}
          >
            <option value="">Todos</option>
            {roteiros.map((roteiro) => (
              <option key={roteiro.id} value={roteiro.id}>
                {roteiro.nome}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-600 mb-1">
            Funcionário
          </label>
          <select
            className="w-full p-2 border rounded-lg bg-white"
            value={filtros.usuarioId}
            onChange={(e) =>
              setFiltros((prev) => ({ ...prev, usuarioId: e.target.value }))
            }
            disabled={loadingFiltros}
          >
            <option value="">Todos</option>
            {funcionarios.map((funcionario) => (
              <option key={funcionario.id} value={funcionario.id}>
                {funcionario.nome}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-600 mb-1">
            Categoria
          </label>
          <select
            className="w-full p-2 border rounded-lg bg-white"
            value={filtros.categoria}
            onChange={(e) =>
              setFiltros((prev) => ({ ...prev, categoria: e.target.value }))
            }
          >
            <option value="">Todas</option>
            {CATEGORIAS_GASTO.map((categoria) => (
              <option key={categoria.value} value={categoria.value}>
                {categoria.label}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2 lg:col-span-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={handleLimparFiltros}
            className="px-4 py-2 rounded-lg bg-gray-200 text-gray-700 font-semibold hover:bg-gray-300 transition-colors"
            disabled={loading}
          >
            Limpar filtros
          </button>
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-cyan-600 text-white font-semibold hover:bg-cyan-700 transition-colors disabled:opacity-60"
            disabled={loading}
          >
            {loading ? "Carregando..." : "Aplicar filtros"}
          </button>
        </div>
      </form>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left font-bold">Roteiro</th>
              <th className="px-3 py-2 text-left font-bold">Funcionário</th>
              <th className="px-3 py-2 text-left font-bold">Categoria</th>
              <th className="px-3 py-2 text-left font-bold">Valor</th>
              <th className="px-3 py-2 text-left font-bold">Observação</th>
              <th className="px-3 py-2 text-left font-bold">Data</th>
              <th className="px-3 py-2 text-left font-bold">Hora</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-3 py-4 text-center text-gray-500">
                  Carregando gastos...
                </td>
              </tr>
            ) : resumo.gastos.length > 0 ? (
              resumo.gastos.map((gasto) => {
                const dataHora = formatarDataHora(gasto.dataHora);
                return (
                  <tr key={gasto.id} className="border-t border-gray-100">
                    <td className="px-3 py-2">{gasto.roteiro?.nome || "-"}</td>
                    <td className="px-3 py-2">{gasto.usuario?.nome || "-"}</td>
                    <td className="px-3 py-2">
                      {getCategoriaLabel(gasto.categoria)}
                    </td>
                    <td className="px-3 py-2 font-semibold text-gray-800">
                      {formatarMoedaBRL(gasto.valor)}
                    </td>
                    <td className="px-3 py-2 text-gray-600">
                      {gasto.observacao?.trim() || "-"}
                    </td>
                    <td className="px-3 py-2 text-gray-600">{dataHora.data}</td>
                    <td className="px-3 py-2 text-gray-600">{dataHora.hora}</td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td
                  colSpan={7}
                  className="px-3 py-4 text-center text-gray-500 italic"
                >
                  Nenhum gasto encontrado para os filtros informados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import React, { useContext, useEffect, useState } from "react";
import { AuthContext } from "../contexts/AuthContext";
import api from "../services/api";

// Função para converter valores antigos de combustível para novos rótulos
const converterNivelCombustivel = (valor) => {
  if (!valor) return "-";
  const mapa = {
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
};

export default function AbastecimentosVeiculos({ veiculos = [] }) {
  const { usuario } = useContext(AuthContext);
  const [abastecimentos, setAbastecimentos] = useState([]);
  const [filtroVeiculo, setFiltroVeiculo] = useState("");
  const [filtroDataInicio, setFiltroDataInicio] = useState("");
  const [filtroDataFim, setFiltroDataFim] = useState("");
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    if (!usuario || usuario.role !== "ADMIN") return;
    const fetchAbastecimentos = async () => {
      setCarregando(true);
      try {
        const params = {};
        if (filtroVeiculo) params.veiculoId = filtroVeiculo;
        if (filtroDataInicio) params.dataInicio = filtroDataInicio;
        if (filtroDataFim) params.dataFim = filtroDataFim;
        const { data } = await api.get(
          "/movimentacao-veiculos/abastecimentos",
          {
            params,
          },
        );
        setAbastecimentos(data);
      } catch (e) {
        setAbastecimentos([]);
        console.error("Erro ao buscar abastecimentos:", e);
      } finally {
        setCarregando(false);
      }
    };
    fetchAbastecimentos();
  }, [usuario, filtroVeiculo, filtroDataInicio, filtroDataFim]);

  if (!usuario || usuario.role !== "ADMIN") return null;

  // Agrupar por veículo (ordem já é veiculoId ASC, dataHora ASC do backend)
  const porVeiculo = {};
  abastecimentos.forEach((ab) => {
    const vid = ab.veiculoId || ab.veiculoid;
    if (!porVeiculo[vid]) porVeiculo[vid] = [];
    porVeiculo[vid].push(ab);
  });

  // Calcular média km/L por veículo e por abastecimento individual
  // const calcularKmL = (lista, idx) => {
  //   if (idx === 0) return null;
  //   const atual = lista[idx];
  //   const anterior = lista[idx - 1];
  //   const kmAtual = Number(atual.km) || 0;
  //   const kmAnterior = Number(anterior.km) || 0;
  //   const litros = Number(atual.litros) || 0;
  //   if (kmAtual > kmAnterior && litros > 0) {
  //     return ((kmAtual - kmAnterior) / litros).toFixed(2);
  //   }
  //   return null;
  // };

  const resumoPorVeiculo = Object.keys(porVeiculo).map((vid) => {
    const lista = porVeiculo[vid];
    const totalLitros = lista.reduce((s, a) => s + (Number(a.litros) || 0), 0);
    let totalKm = 0;
    let totalLitrosMediavel = 0;
    for (let i = 1; i < lista.length; i++) {
      const kmDelta =
        (Number(lista[i].km) || 0) - (Number(lista[i - 1].km) || 0);
      const litros = Number(lista[i].litros) || 0;
      if (kmDelta > 0 && litros > 0) {
        totalKm += kmDelta;
        totalLitrosMediavel += litros;
      }
    }
    const media =
      totalLitrosMediavel > 0
        ? (totalKm / totalLitrosMediavel).toFixed(2)
        : null;
    return {
      vid,
      nome: lista[0]?.veiculo?.nome || "-",
      modelo: lista[0]?.veiculo?.modelo || "-",
      qtd: lista.length,
      totalLitros: totalLitros.toFixed(1),
      media,
    };
  });

  return (
    <div className="p-0 md:p-2">
      <h2 className="text-2xl font-bold mb-6 text-[#24094E] tracking-tight drop-shadow-sm">
        ⛽ Abastecimentos
      </h2>

      {/* Resumo por veículo */}
      {resumoPorVeiculo.length > 0 && (
        <div className="mb-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {resumoPorVeiculo.map((r) => (
            <div
              key={r.vid}
              className="bg-green-50 border border-green-200 rounded-xl p-3 shadow-sm"
            >
              <p className="font-bold text-sm text-green-800 truncate">
                {r.nome}
              </p>
              <p className="text-xs text-gray-500 mb-1">{r.modelo}</p>
              <p className="text-sm">
                <span className="font-semibold">{r.totalLitros} L</span> total •{" "}
                {r.qtd} vez(es)
              </p>
              <p className="text-sm font-semibold text-blue-700">
                {r.media ? `${r.media} km/L` : "—"} média
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Filtros */}
      <div className="mb-4 flex flex-col sm:flex-row gap-3 flex-wrap items-end">
        <div>
          <label className="block text-xs font-medium text-[#24094E] mb-1">
            Veículo
          </label>
          <select
            className="border border-[#62A1D9] rounded-lg p-2 focus:ring-2 focus:ring-[#62A1D9] text-sm"
            value={filtroVeiculo}
            onChange={(e) => setFiltroVeiculo(e.target.value)}
          >
            <option value="">Todos</option>
            {veiculos.map((v) => (
              <option key={v.id} value={v.id}>
                {v.nome}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-[#24094E] mb-1">
            De
          </label>
          <input
            type="date"
            className="border border-[#62A1D9] rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#62A1D9]"
            value={filtroDataInicio}
            onChange={(e) => setFiltroDataInicio(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#24094E] mb-1">
            Até
          </label>
          <input
            type="date"
            className="border border-[#62A1D9] rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#62A1D9]"
            value={filtroDataFim}
            onChange={(e) => setFiltroDataFim(e.target.value)}
          />
        </div>
        {(filtroVeiculo || filtroDataInicio || filtroDataFim) && (
          <button
            className="text-sm text-red-500 hover:text-red-700 underline self-end"
            onClick={() => {
              setFiltroVeiculo("");
              setFiltroDataInicio("");
              setFiltroDataFim("");
            }}
          >
            Limpar filtros
          </button>
        )}
      </div>

      <div className="mb-2 text-sm text-[#A6806A]">
        {carregando
          ? "Buscando registros..."
          : `Registros encontrados: ${abastecimentos.length}`}
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto rounded-xl border border-[#62A1D9] shadow bg-white">
        <table className="min-w-full text-sm text-[#24094E]">
          <thead>
            <tr className="bg-[#62A1D9] text-white">
              <th className="px-4 py-3 border-b font-semibold">Veículo</th>
              <th className="px-4 py-3 border-b font-semibold">Data/Hora</th>
              <th className="px-4 py-3 border-b font-semibold">KM</th>
              <th className="px-4 py-3 border-b font-semibold">Litros</th>
              <th className="px-4 py-3 border-b font-semibold">Nível após</th>
              {/* <th className="px-4 py-3 border-b font-semibold">km/L (est.)</th> */}
              <th className="px-4 py-3 border-b font-semibold">Usuário</th>
            </tr>
          </thead>
          <tbody>
            {carregando ? (
              <tr>
                <td
                  colSpan={7}
                  className="text-center p-6 text-[#62A1D9] font-semibold animate-pulse"
                >
                  Carregando...
                </td>
              </tr>
            ) : abastecimentos.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center p-6 text-[#A6806A]">
                  Nenhum abastecimento registrado.
                </td>
              </tr>
            ) : (
              abastecimentos.map((ab) => {
                // const vid = ab.veiculoId || ab.veiculoid;
                // const lista = porVeiculo[vid] || [];
                // const posNaLista = lista.findIndex((a) => a.id === ab.id);
                // const kml = calcularKmL(lista, posNaLista);
                return (
                  <tr
                    key={ab.id}
                    className="text-center hover:bg-green-50 transition border-t"
                  >
                    <td className="px-4 py-2 border-b font-medium">
                      {ab.veiculo?.nome || "-"}
                    </td>
                    <td className="px-4 py-2 border-b whitespace-nowrap">
                      {new Date(ab.dataHora).toLocaleString("pt-BR")}
                    </td>
                    <td className="px-4 py-2 border-b">
                      {ab.km != null
                        ? Number(ab.km).toLocaleString("pt-BR")
                        : "-"}
                    </td>
                    <td className="px-4 py-2 border-b font-semibold text-green-700">
                      {ab.litros ? `${Number(ab.litros).toFixed(1)} L` : "-"}
                    </td>
                    <td className="px-4 py-2 border-b">
                      {converterNivelCombustivel(ab.gasolina)}
                    </td>
                    {/* <td className="px-4 py-2 border-b font-semibold text-blue-700">
                      {kml ? `${kml} km/L` : "—"}
                    </td> */}
                    <td className="px-4 py-2 border-b">
                      {ab.usuario?.nome || "-"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

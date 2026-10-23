import { useState } from "react";

import api from "../services/api";

const formatarData = (dataTexto) => {
  if (!dataTexto) return "-";
  const data = new Date(dataTexto);
  if (Number.isNaN(data.getTime())) return "-";
  return data.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatarLoja = (loja) => {
  if (!loja) return "Loja removida";
  return loja.cidade ? `${loja.nome} - ${loja.cidade}` : loja.nome;
};

export default function HistoricoPontosMaquina() {
  const [busca, setBusca] = useState("");
  const [resultados, setResultados] = useState([]);
  const [pesquisou, setPesquisou] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  const pesquisar = async (event) => {
    event.preventDefault();
    const termo = busca.trim();
    if (!termo) return;

    try {
      setCarregando(true);
      setErro("");
      const response = await api.get("/maquinas/historico-pontos", {
        params: { busca: termo },
      });
      setResultados(Array.isArray(response.data) ? response.data : []);
      setPesquisou(true);
    } catch (error) {
      setResultados([]);
      setErro(
        error?.response?.data?.error ||
          "Nao foi possivel carregar o historico de pontos.",
      );
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="mt-12">
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <span className="text-3xl">📍</span>
        Historico de Pontos da Maquina
      </h2>

      <form onSubmit={pesquisar} className="mb-4 flex flex-wrap gap-4">
        <input
          type="text"
          className="input-field flex-1 min-w-60"
          placeholder="Digite o codigo ou id da maquina"
          value={busca}
          onChange={(event) => setBusca(event.target.value)}
        />
        <button
          type="submit"
          className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={!busca.trim() || carregando}
        >
          {carregando ? "Pesquisando..." : "Pesquisar"}
        </button>
      </form>

      {erro && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700 mb-4">
          {erro}
        </div>
      )}

      {pesquisou && !erro && resultados.length === 0 && (
        <div className="rounded-lg bg-white/70 border border-gray-200 p-4 text-sm text-gray-600">
          Nenhuma maquina encontrada.
        </div>
      )}

      <div className="space-y-6">
        {resultados.map((maquina) => (
          <div
            key={maquina.id}
            className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
              <h3 className="text-lg font-bold text-gray-900">
                {maquina.codigo} - {maquina.nome || "Maquina"}
                {maquina.ativo === false && (
                  <span className="ml-2 text-xs font-semibold text-red-600">
                    (inativa)
                  </span>
                )}
              </h3>
              <p className="text-sm text-gray-600">
                Ponto atual:{" "}
                <span className="font-semibold">
                  {formatarLoja(maquina.lojaAtual)}
                </span>
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="py-2 pr-4">Ponto</th>
                    <th className="py-2 pr-4">Entrada</th>
                    <th className="py-2 pr-4">Saida</th>
                    <th className="py-2 pr-4">Registrado por</th>
                  </tr>
                </thead>
                <tbody>
                  {maquina.historico.map((item) => (
                    <tr key={item.id} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-medium text-gray-900">
                        {formatarLoja(item.loja)}
                      </td>
                      <td className="py-2 pr-4">
                        {formatarData(item.dataEntrada)}
                      </td>
                      <td className="py-2 pr-4">
                        {item.dataSaida ? (
                          formatarData(item.dataSaida)
                        ) : (
                          <span className="text-emerald-700 font-semibold">
                            Atual
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-4 text-gray-600">
                        {item.usuario?.nome || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

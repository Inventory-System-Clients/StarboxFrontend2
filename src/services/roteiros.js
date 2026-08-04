// Busca relatório de roteiro por período (lojas e dias sem movimentação)
export async function buscarRelatorioRoteiroPeriodo(roteiroId, dataInicio, dataFim) {
  const res = await api.get(`/roteiros/${roteiroId}/relatorio-periodo`, {
    params: { dataInicio, dataFim },
  });
  return res.data;
}
// Adiciona função para buscar roteiros no frontend
import api from "../services/api";

export async function buscarRoteiros() {
  const res = await api.get("/roteiros");
  return res.data || [];
}

import api from "./api";

/**
 * Serviço para o alerta de "jogadas médias por pelúcia fora da faixa".
 */

export const listarAlertasMediaFichas = async () => {
  const response = await api.get("/alertas-media-jogadas");
  return response.data;
};

export const resolverAlertaMediaFichas = async (alertaId) => {
  const response = await api.post(`/alertas-media-jogadas/${alertaId}/resolver`);
  return response.data;
};

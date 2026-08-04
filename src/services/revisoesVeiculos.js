import api from "./api";

/**
 * Serviço para gerenciar revisões de veículos
 */

/**
 * Listar todas as revisões pendentes
 */
export const listarRevisoesPendentes = async () => {
  try {
    const response = await api.get("/revisoes-veiculos");
    return response.data;
  } catch (error) {
    // Se endpoint não existe ainda (404), retorna array vazio
    if (error?.response?.status === 404) {
      console.info("Endpoint de revisões ainda não implementado no backend");
      return [];
    }
    throw error;
  }
};

/**
 * Reconhecer alerta de revisão (remove o alerta visual)
 * @param {string} veiculoId - ID do veículo
 */
export const reconhecerAlertaRevisao = async (veiculoId) => {
  try {
    const response = await api.post(`/revisoes-veiculos/${veiculoId}/reconhecer`);
    return response.data;
  } catch (error) {
    if (error?.response?.status === 404) {
      throw new Error("Funcionalidade ainda não disponível no backend");
    }
    throw error;
  }
};

/**
 * Verificar revisão de um veículo específico
 * @param {string} veiculoId - ID do veículo
 */
export const verificarRevisaoVeiculo = async (veiculoId) => {
  try {
    const response = await api.post(`/revisoes-veiculos/${veiculoId}/verificar`);
    return response.data;
  } catch (error) {
    if (error?.response?.status === 404) {
      throw new Error("Funcionalidade ainda não disponível no backend");
    }
    throw error;
  }
};

/**
 * Marcar revisão como concluída
 * @param {string} veiculoId - ID do veículo
 * @param {number} kmRevisao - KM em que a revisão foi feita (opcional)
 */
export const concluirRevisao = async (veiculoId, kmRevisao = null) => {
  try {
    const payload = kmRevisao ? { kmRevisao } : {};
    const response = await api.post(
      `/revisoes-veiculos/${veiculoId}/concluir`,
      payload
    );
    return response.data;
  } catch (error) {
    if (error?.response?.status === 404) {
      throw new Error("Funcionalidade ainda não disponível no backend");
    }
    throw error;
  }
};

/**
 * Verificar todas as revisões (Admin apenas)
 */
export const verificarTodasRevisoes = async () => {
  try {
    const response = await api.post("/revisoes-veiculos/verificar-todas");
    return response.data;
  } catch (error) {
    if (error?.response?.status === 404) {
      throw new Error("Funcionalidade ainda não disponível no backend");
    }
    throw error;
  }
};

/**
 * Obter contador de revisões pendentes
 */
export const contarRevisoesPendentes = async () => {
  try {
    const revisoes = await listarRevisoesPendentes();
    return revisoes.length;
  } catch (error) {
    // Silenciosamente retorna 0 se houver erro
    // (não logar erro pois endpoint pode não existir ainda)
    return 0;
  }
};

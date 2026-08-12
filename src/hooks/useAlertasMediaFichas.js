import { useCallback, useEffect, useState } from "react";
import { listarAlertasMediaFichas } from "../services/alertasMediaFichas";

// Alerta de "jogadas médias por pelúcia fora da faixa esperada" — o backend
// já filtra por usuário quando não é admin/gerenciador (ver
// backend2/src/services/alertaMediaFichasService.js), então aqui é só
// buscar e expor. Hook separado (não dentro do carregar() da
// AlertasContext) pra funcionar também pra funcionário comum, mesmo padrão
// de useManutencoesPersistentes.
export function useAlertasMediaFichas({ ativo = true } = {}) {
  const [alertasMediaFichas, setAlertasMediaFichas] = useState([]);
  const [carregando, setCarregando] = useState(false);

  const carregar = useCallback(async () => {
    if (!ativo) return;
    setCarregando(true);
    try {
      const data = await listarAlertasMediaFichas();
      setAlertasMediaFichas(Array.isArray(data?.alertas) ? data.alertas : []);
    } catch (err) {
      console.error(
        "Erro ao buscar alertas de média fora do padrão:",
        err?.response?.data || err,
      );
      setAlertasMediaFichas([]);
    } finally {
      setCarregando(false);
    }
  }, [ativo]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return { alertasMediaFichas, carregando, recarregar: carregar };
}

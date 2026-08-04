import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../services/api";

// Janela de histórico usada só pelo alerta de "manutenções persistentes": o
// alerta compara as 2 últimas manutenções concluídas de cada máquina, então
// não precisa do histórico completo, apenas de um período recente o
// suficiente pra cobrir o intervalo de alerta.
const JANELA_PERSISTENTES_DIAS = 180;

export const INTERVALO_ALERTA_PERSISTENTE_DIAS = 45;

const manutencaoAtribuidaAoUsuario = (manutencao, usuarioId) =>
  String(manutencao?.funcionarioId || "") === String(usuarioId || "");

// Detecta máquinas com manutenção concluída mais de uma vez em um intervalo
// curto (indício de que a manutenção anterior não resolveu o problema).
// Compartilhado entre a tela de Manutenções e a central de Alertas.
export function useManutencoesPersistentes({
  isAdmin,
  usuarioId,
  ativo = true,
}) {
  const [manutencoesConcluidasRecentes, setManutencoesConcluidasRecentes] =
    useState([]);
  const [carregando, setCarregando] = useState(false);

  const carregar = useCallback(async () => {
    if (!ativo) return;
    setCarregando(true);
    try {
      const dataInicio = new Date(
        Date.now() - JANELA_PERSISTENTES_DIAS * 24 * 60 * 60 * 1000,
      )
        .toISOString()
        .slice(0, 10);
      const res = await api.get("/manutencoes", {
        params: { all: true, dataInicio },
      });
      setManutencoesConcluidasRecentes(res.data || []);
    } catch (err) {
      console.error(
        "Erro ao buscar manutenções concluídas recentes:",
        err?.response?.data || err,
      );
      setManutencoesConcluidasRecentes([]);
    } finally {
      setCarregando(false);
    }
  }, [ativo]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const manutencoesPersistentes = useMemo(() => {
    const manutencoesBase = isAdmin
      ? manutencoesConcluidasRecentes
      : manutencoesConcluidasRecentes.filter((m) =>
          manutencaoAtribuidaAoUsuario(m, usuarioId),
        );

    const limiteIntervaloMs =
      INTERVALO_ALERTA_PERSISTENTE_DIAS * 24 * 60 * 60 * 1000;

    const concluidas = manutencoesBase.filter(
      (m) => (m.status === "feito" || m.status === "concluida") && m.maquinaId,
    );

    const agrupadasPorMaquina = concluidas.reduce((acc, manutencao) => {
      const chave = String(manutencao.maquinaId);
      if (!acc[chave]) acc[chave] = [];
      acc[chave].push(manutencao);
      return acc;
    }, {});

    return Object.values(agrupadasPorMaquina)
      .filter((lista) => lista.length > 1)
      .map((lista) => {
        const ordenadas = [...lista].sort((a, b) => {
          const dataA = new Date(a.concluidoEm || a.createdAt).getTime();
          const dataB = new Date(b.concluidoEm || b.createdAt).getTime();
          return dataB - dataA;
        });

        const dataAtualTs = new Date(
          ordenadas[0].concluidoEm || ordenadas[0].createdAt,
        ).getTime();
        const dataUltimaTs = new Date(
          ordenadas[1].concluidoEm || ordenadas[1].createdAt,
        ).getTime();

        if (!Number.isFinite(dataAtualTs) || !Number.isFinite(dataUltimaTs)) {
          return null;
        }

        const intervaloEntreManutencoesMs = Math.abs(
          dataAtualTs - dataUltimaTs,
        );

        if (intervaloEntreManutencoesMs > limiteIntervaloMs) {
          return null;
        }

        return {
          maquinaId: ordenadas[0].maquinaId,
          maquinaNome: ordenadas[0].maquina?.codigo || "Máquina sem código",
          lojaNome: ordenadas[0].loja?.nome || "Ponto não informado",
          dataAtual: ordenadas[0].concluidoEm || ordenadas[0].createdAt,
          dataUltima: ordenadas[1].concluidoEm || ordenadas[1].createdAt,
        };
      })
      .filter(Boolean)
      .sort(
        (a, b) =>
          new Date(b.dataAtual).getTime() - new Date(a.dataAtual).getTime(),
      );
  }, [isAdmin, manutencoesConcluidasRecentes, usuarioId]);

  return { manutencoesPersistentes, carregando, recarregar: carregar };
}

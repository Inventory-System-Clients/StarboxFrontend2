import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import api, { billsAPI } from "../services/api";
import { useAuth } from "./AuthContext.jsx";
import {
  getNextMonthKeys,
  getBillOccurrenceForMonth,
  getDaysUntilDue,
} from "../lib/financeiroRecurringBills";
import { useManutencoesPersistentes } from "../hooks/useManutencoesPersistentes";

const AlertasContext = createContext(null);

const INTERVALO_ATUALIZACAO_MS = 3 * 60 * 1000;

const extrairAlertas = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.alertas)) return data.alertas;
  return [];
};

export function AlertasProvider({ children }) {
  const { usuario } = useAuth();
  const podeVerAlertas = ["ADMIN", "GERENCIADOR"].includes(usuario?.role);

  const [estoque, setEstoque] = useState([]);
  const [movimentacaoInconsistente, setMovimentacaoInconsistente] = useState(
    [],
  );
  const [abastecimentoIncompleto, setAbastecimentoIncompleto] = useState([]);
  const [contasVencidas, setContasVencidas] = useState([]);
  const [contasProximas, setContasProximas] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const emAndamentoRef = useRef(false);

  const {
    manutencoesPersistentes,
    carregando: carregandoManutencoes,
    recarregar: recarregarManutencoes,
  } = useManutencoesPersistentes({
    isAdmin: true,
    usuarioId: usuario?.id,
    ativo: podeVerAlertas,
  });

  const carregar = useCallback(async () => {
    if (!podeVerAlertas || emAndamentoRef.current) return;

    emAndamentoRef.current = true;
    setCarregando(true);

    try {
      const [estoqueRes, movRes, abastRes, personalBills, companyBills] =
        await Promise.all([
          api
            .get("/relatorios/alertas-estoque")
            .catch(() => ({ data: { alertas: [] } })),
          api
            .get("/relatorios/alertas-movimentacao-inconsistente")
            .catch(() => ({ data: { alertas: [] } })),
          api
            .get("/relatorios/alertas-abastecimento-incompleto")
            .catch(() => ({ data: { alertas: [] } })),
          billsAPI.getAll({ bill_type: "personal" }).catch(() => []),
          billsAPI.getAll({ bill_type: "company" }).catch(() => []),
        ]);

      setEstoque(extrairAlertas(estoqueRes.data));
      setMovimentacaoInconsistente(extrairAlertas(movRes.data));
      setAbastecimentoIncompleto(extrairAlertas(abastRes.data));

      const bills = [
        ...(Array.isArray(personalBills) ? personalBills : []),
        ...(Array.isArray(companyBills) ? companyBills : []),
      ];

      // Mesma lógica de ocorrência mensal usada na tela de Contas, pra
      // "vencida aqui" ser consistente com "vencida lá".
      const monthWindow = getNextMonthKeys(2);
      const currentMonthKey = monthWindow[0]?.key || "";
      const nextMonthKey = monthWindow[1]?.key || "";

      const vencidas = bills
        .map((bill) => {
          const occurrence = getBillOccurrenceForMonth(
            bill,
            currentMonthKey,
            currentMonthKey,
          );
          return occurrence ? { bill, occurrence } : null;
        })
        .filter(Boolean)
        .filter(
          ({ occurrence }) =>
            occurrence.status !== "paid" &&
            getDaysUntilDue(occurrence.dueDate) < 0,
        )
        .sort(
          (a, b) =>
            new Date(a.occurrence.dueDate) - new Date(b.occurrence.dueDate),
        );

      const proximas = [currentMonthKey, nextMonthKey]
        .filter(Boolean)
        .flatMap((monthKey) =>
          bills
            .map((bill) => {
              const occurrence = getBillOccurrenceForMonth(
                bill,
                monthKey,
                currentMonthKey,
              );
              return occurrence ? { bill, occurrence } : null;
            })
            .filter(Boolean),
        )
        .filter(({ occurrence }) => {
          if (occurrence.status === "paid") return false;
          const dias = getDaysUntilDue(occurrence.dueDate);
          return dias >= 0 && dias <= 3;
        })
        .sort(
          (a, b) =>
            new Date(a.occurrence.dueDate) - new Date(b.occurrence.dueDate),
        );

      setContasVencidas(vencidas);
      setContasProximas(proximas);
    } catch (error) {
      console.error("Erro ao carregar alertas:", error);
    } finally {
      emAndamentoRef.current = false;
      setCarregando(false);
    }
  }, [podeVerAlertas]);

  useEffect(() => {
    if (!podeVerAlertas) return;
    carregar();
    const intervalo = setInterval(carregar, INTERVALO_ATUALIZACAO_MS);
    return () => clearInterval(intervalo);
  }, [podeVerAlertas, carregar]);

  const tipos = [
    {
      id: "estoque",
      label: "Estoque baixo em máquina",
      icone: "🎮",
      cor: "red",
      itens: estoque,
      total: estoque.length,
    },
    {
      id: "movimentacao-inconsistente",
      label: "Movimentação inconsistente",
      icone: "🔄",
      cor: "purple",
      itens: movimentacaoInconsistente,
      total: movimentacaoInconsistente.length,
    },
    {
      id: "abastecimento-incompleto",
      label: "Abastecimento incompleto",
      icone: "📦",
      cor: "amber",
      itens: abastecimentoIncompleto,
      total: abastecimentoIncompleto.length,
    },
    {
      id: "manutencao-recorrente",
      label: "Manutenção recorrente",
      icone: "🔁",
      cor: "rose",
      itens: manutencoesPersistentes,
      total: manutencoesPersistentes.length,
    },
    {
      id: "contas-vencidas",
      label: "Contas vencidas",
      icone: "💰",
      cor: "red",
      itens: contasVencidas,
      total: contasVencidas.length,
    },
    {
      id: "contas-proximas",
      label: "Contas a vencer (3 dias)",
      icone: "⏰",
      cor: "yellow",
      itens: contasProximas,
      total: contasProximas.length,
    },
  ];

  const totalGeral = tipos.reduce((soma, tipo) => soma + tipo.total, 0);

  const recarregar = useCallback(
    () => Promise.all([carregar(), recarregarManutencoes()]),
    [carregar, recarregarManutencoes],
  );

  return (
    <AlertasContext.Provider
      value={{
        tipos,
        totalGeral,
        carregando: carregando || carregandoManutencoes,
        recarregar,
        podeVerAlertas,
      }}
    >
      {children}
    </AlertasContext.Provider>
  );
}

export function useAlertas() {
  const context = useContext(AlertasContext);
  if (!context) {
    throw new Error("useAlertas deve ser usado dentro de um AlertasProvider");
  }
  return context;
}

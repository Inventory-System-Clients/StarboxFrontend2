import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { billsAPI } from "../services/api";
import { AlertCircle, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import Header from "../components/Header";
import Footer from "../components/Footer";
import {
  getNextMonthKeys,
  getBillOccurrenceForMonth,
  getDaysUntilDue,
  toNumber,
} from "../lib/financeiroRecurringBills";

const formatMoney = (value) => {
  const numericValue = toNumber(value);
  return numericValue === null ? "--" : `R$ ${numericValue.toFixed(2)}`;
};

const formatDate = (value) => {
  if (!value) return "--";
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return "--";
  return parsedDate.toLocaleDateString("pt-BR");
};

export default function AlertsPage() {
  const navigate = useNavigate();
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);

  // Precisa da janela de 2 meses porque uma conta "próxima do vencimento"
  // (até 3 dias) pode cair no mês seguinte quando estamos perto da virada.
  const monthWindow = useMemo(() => getNextMonthKeys(2), []);
  const currentMonth = monthWindow[0] || null;
  const currentMonthKey = currentMonth?.key || "";
  const nextMonthKey = monthWindow[1]?.key || "";

  useEffect(() => {
    fetchBills();
  }, []);

  const fetchBills = async () => {
    setLoading(true);
    try {
      const [personalResult, companyResult] = await Promise.allSettled([
        billsAPI.getAll({ bill_type: "personal" }),
        billsAPI.getAll({ bill_type: "company" }),
      ]);

      const nextBills = [];
      if (personalResult.status === "fulfilled" && Array.isArray(personalResult.value)) {
        nextBills.push(...personalResult.value);
      }
      if (companyResult.status === "fulfilled" && Array.isArray(companyResult.value)) {
        nextBills.push(...companyResult.value);
      }

      setBills(nextBills);
    } catch (error) {
      toast.error("Erro ao carregar contas");
    } finally {
      setLoading(false);
    }
  };

  // Vencidas do mês atual: a ocorrência daquele mês existe, ainda não foi
  // paga, e o vencimento já passou. Reaproveita a mesma lógica de ocorrência
  // mensal usada na aba de Contas, então "vencida aqui" == "vencida lá".
  const overdueBills = bills
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
        occurrence.status !== "paid" && getDaysUntilDue(occurrence.dueDate) < 0,
    )
    .sort((a, b) => new Date(a.occurrence.dueDate) - new Date(b.occurrence.dueDate));

  // Próximas do vencimento: até 3 dias pra vencer, ainda não vencidas e não
  // pagas. Olha o mês atual e o seguinte, porque perto da virada do mês uma
  // conta "em até 3 dias" pode já estar tecnicamente no próximo mês.
  const upcomingBills = [currentMonthKey, nextMonthKey]
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
    .sort((a, b) => new Date(a.occurrence.dueDate) - new Date(b.occurrence.dueDate));

  const handleOpenBill = (bill) => {
    const type = bill.bill_type === "company" ? "company" : "personal";
    navigate(`/financeiro/contas/${type}`, {
      state: { highlightBillId: bill.id },
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col app-container overflow-x-hidden">
      <Header />

      <main className="flex-1 container mx-auto px-4 py-8 overflow-x-hidden">
        <div className="fade-in">
          <div className="mb-8">
            <h1
              className="text-4xl font-bold text-gray-800 mb-2"
              data-testid="page-title"
            >
              Avisos de Vencimento
            </h1>
            <p className="text-gray-600">
              Contas vencidas em {currentMonth?.label || "-"} e contas
              próximas do vencimento (até 3 dias)
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            <div
              className="bg-white rounded-xl shadow-md p-6 border-l-4 border-red-500"
              data-testid="summary-overdue"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">
                    Vencidas em {currentMonth?.label || "-"}
                  </p>
                  <p className="text-3xl font-bold text-red-600">
                    {overdueBills.length}
                  </p>
                </div>
                <div className="p-3 bg-red-100 rounded-lg">
                  <AlertCircle className="text-red-600" size={28} />
                </div>
              </div>
            </div>

            <div
              className="bg-white rounded-xl shadow-md p-6 border-l-4 border-yellow-500"
              data-testid="summary-upcoming"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">
                    Próximas do vencimento (até 3 dias)
                  </p>
                  <p className="text-3xl font-bold text-yellow-600">
                    {upcomingBills.length}
                  </p>
                </div>
                <div className="p-3 bg-yellow-100 rounded-lg">
                  <AlertCircle className="text-yellow-600" size={28} />
                </div>
              </div>
            </div>
          </div>

          <h2 className="text-xl font-semibold text-red-700 mb-4">
            Vencidas
          </h2>
          {overdueBills.length === 0 ? (
            <div className="bg-white rounded-xl shadow-md p-6 text-center border border-purple-100 mb-8">
              <p className="text-gray-600">
                Nenhuma conta vencida em {currentMonth?.label || "este mês"}.
              </p>
            </div>
          ) : (
            <div className="space-y-4 mb-8">
              {overdueBills.map(({ bill, occurrence }) => (
                <div
                  key={bill.id}
                  className="bg-white rounded-xl shadow-md p-6 border-2 border-red-200 bg-red-50/40 slide-in card-hover cursor-pointer"
                  data-testid={`alert-overdue-${bill.id}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleOpenBill(bill)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      handleOpenBill(bill);
                    }
                  }}
                  title="Clique para ver esta conta em Contas Empresariais/Particulares"
                >
                  <div className="flex flex-wrap items-start gap-4">
                    <div className="p-3 rounded-lg bg-red-100 shrink-0">
                      <AlertCircle className="text-red-600" size={24} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
                        <div className="min-w-0">
                          <p className="text-xs text-gray-500 uppercase font-semibold tracking-wide mb-1">
                            Nome da Conta
                          </p>
                          <h3 className="text-lg font-bold text-blue-700 mb-1 wrap-break-word">
                            {bill.name || "Conta sem nome"}
                          </h3>
                        </div>
                        <span className="shrink-0 px-3 py-1 rounded-full text-xs font-semibold bg-red-500 text-white">
                          {bill.bill_type === "company"
                            ? "Empresarial"
                            : "Particular"}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 p-4 bg-white/60 rounded-lg">
                        <div>
                          <p className="text-xs text-gray-500 mb-1">
                            Vencimento
                          </p>
                          <p className="font-semibold text-gray-800">
                            {formatDate(occurrence.dueDate)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Valor</p>
                          <p className="font-semibold text-gray-800">
                            {formatMoney(bill.value ?? bill.amount)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">
                            Atraso
                          </p>
                          <p className="font-semibold text-red-600">
                            {Math.abs(getDaysUntilDue(occurrence.dueDate))}{" "}
                            dia(s)
                          </p>
                        </div>
                      </div>
                    </div>

                    <ChevronRight
                      className="text-gray-400 shrink-0 self-center"
                      size={22}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          <h2 className="text-xl font-semibold text-yellow-700 mb-4">
            Próximas do Vencimento
          </h2>
          {upcomingBills.length === 0 ? (
            <div className="bg-white rounded-xl shadow-md p-6 text-center border border-purple-100">
              <p className="text-gray-600">
                Nenhuma conta com vencimento nos próximos 3 dias.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {upcomingBills.map(({ bill, occurrence }) => {
                const dias = getDaysUntilDue(occurrence.dueDate);
                return (
                  <div
                    key={bill.id}
                    className="bg-white rounded-xl shadow-md p-6 border-2 border-yellow-200 bg-yellow-50/40 slide-in card-hover cursor-pointer"
                    data-testid={`alert-upcoming-${bill.id}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleOpenBill(bill)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        handleOpenBill(bill);
                      }
                    }}
                    title="Clique para ver esta conta em Contas Empresariais/Particulares"
                  >
                    <div className="flex flex-wrap items-start gap-4">
                      <div className="p-3 rounded-lg bg-yellow-100 shrink-0">
                        <AlertCircle className="text-yellow-600" size={24} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
                          <div className="min-w-0">
                            <p className="text-xs text-gray-500 uppercase font-semibold tracking-wide mb-1">
                              Nome da Conta
                            </p>
                            <h3 className="text-lg font-bold text-blue-700 mb-1 wrap-break-word">
                              {bill.name || "Conta sem nome"}
                            </h3>
                          </div>
                          <span className="shrink-0 px-3 py-1 rounded-full text-xs font-semibold bg-yellow-500 text-white">
                            {bill.bill_type === "company"
                              ? "Empresarial"
                              : "Particular"}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 p-4 bg-white/60 rounded-lg">
                          <div>
                            <p className="text-xs text-gray-500 mb-1">
                              Vencimento
                            </p>
                            <p className="font-semibold text-gray-800">
                              {formatDate(occurrence.dueDate)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">
                              Valor
                            </p>
                            <p className="font-semibold text-gray-800">
                              {formatMoney(bill.value ?? bill.amount)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">
                              Vence em
                            </p>
                            <p className="font-semibold text-yellow-700">
                              {dias === 0 ? "Hoje" : `${dias} dia(s)`}
                            </p>
                          </div>
                        </div>
                      </div>

                      <ChevronRight
                        className="text-gray-400 shrink-0 self-center"
                        size={22}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}

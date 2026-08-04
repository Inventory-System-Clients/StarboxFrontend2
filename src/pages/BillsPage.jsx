import React, { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useLocation } from "react-router-dom";
import { billsAPI, categoriesAPI } from "../services/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Plus,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  Filter,
  Search,
} from "lucide-react";
import BillModal from "../components/BillModal";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "sonner";
import Header from "../components/Header";
import Footer from "../components/Footer";
import {
  buildRecurringNextOpenUpdatePayload,
  isRecurringBill,
  getNextMonthKeys,
  getBillOccurrenceForMonth,
} from "../lib/financeiroRecurringBills";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";

const normalizeFilterValue = (value) => (value === "all" ? "" : value);

export default function BillsPage() {
  const { type } = useParams();
  const location = useLocation();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const billType = type === "company" ? "company" : "personal";
  const pageTitle =
    type === "company" ? "Contas Empresariais" : "Contas Particulares";

  const [bills, setBills] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingBill, setEditingBill] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState({
    open: false,
    billId: null,
  });
  const [detailsModal, setDetailsModal] = useState({
    open: false,
    bill: null,
  });

  // Permite chegar aqui já filtrado (ex: a partir dos boxes do dashboard),
  // pré-aplicando o filtro de status igual a como o highlight de conta
  // funciona vindo dos avisos.
  const [filters, setFilters] = useState({
    status: location.state?.presetStatusFilter || "",
    category: "",
    city: "",
    search: "",
  });

  // Janela rolante de 12 meses (mês atual + próximos 11) para a visão em
  // DDA. Calculada uma vez ao montar a página.
  const monthKeys = useMemo(() => getNextMonthKeys(12), []);
  const currentMonthKey = monthKeys[0]?.key || "";
  const [selectedMonthKey, setSelectedMonthKey] = useState(currentMonthKey);

  // Quando chegamos aqui a partir de um aviso (aba Avisos), a conta clicada
  // deve ficar destacada e visível assim que a lista carregar. O mês
  // destacável é sempre o atual, pois é dele que os avisos partem.
  const [highlightedBillId, setHighlightedBillId] = useState(
    location.state?.highlightBillId || null,
  );
  const rowRefs = useRef({});

  useEffect(() => {
    fetchData();
  }, [billType]);

  useEffect(() => {
    if (loading || !highlightedBillId) return;

    const row = rowRefs.current[highlightedBillId];
    if (row) {
      row.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    const timeoutId = setTimeout(() => setHighlightedBillId(null), 4000);
    return () => clearTimeout(timeoutId);
  }, [loading, highlightedBillId, selectedMonthKey]);

  const fetchData = async () => {
    try {
      const [billsData, categoriesData] = await Promise.all([
        billsAPI.getAll({ bill_type: billType }),
        categoriesAPI.getAll(),
      ]);
      console.log("Bills retornados da API:", billsData);
      setBills(billsData);
      setCategories(categoriesData);
    } catch (error) {
      toast.error("Erro ao carregar contas");
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (bill, newStatus) => {
    try {
      if (isRecurringBill(bill) && newStatus === "paid") {
        await billsAPI.update(
          bill.id,
          buildRecurringNextOpenUpdatePayload(bill),
        );
        await billsAPI.updateStatus(bill.id, "open");
      } else {
        await billsAPI.updateStatus(bill.id, newStatus);
      }

      toast.success(
        `Conta marcada como ${newStatus === "paid" ? "paga" : "em aberto"}!`,
      );
      fetchData();
    } catch (error) {
      toast.error(
        error.response?.data?.detail || "Erro ao atualizar status da conta",
      );
    }
  };

  // Marca o pagamento de uma ocorrência mensal específica na visão DDA.
  // O mês "nativo" (o ciclo atual em aberto da conta) continua usando o
  // fluxo já existente (que funciona com o backend atual). Meses fora do
  // ciclo nativo (pré-pagamento de meses futuros, por exemplo) dependem do
  // endpoint novo de ocorrências no backend.
  const handleOccurrenceStatusChange = async (bill, occurrence, newStatus) => {
    if (occurrence.isNative) {
      await handleStatusChange(bill, newStatus);
      return;
    }

    try {
      await billsAPI.setOccurrenceStatus(bill.id, occurrence.monthKey, newStatus);
      toast.success(
        `Mês marcado como ${newStatus === "paid" ? "pago" : "em aberto"}!`,
      );
      fetchData();
    } catch (error) {
      toast.error(
        error.response?.data?.detail ||
          "Ainda não é possível marcar meses futuros/avulsos individualmente — recurso pendente no backend.",
      );
    }
  };

  const handleDelete = async () => {
    try {
      await billsAPI.delete(deleteDialog.billId);
      toast.success("Conta excluída com sucesso!");
      setDeleteDialog({ open: false, billId: null });
      fetchData();
    } catch (error) {
      toast.error("Erro ao excluir conta");
    }
  };

  const handleEdit = (bill) => {
    setEditingBill(bill);
    setShowModal(true);
  };

  const handleViewDetails = (bill) => {
    setDetailsModal({ open: true, bill });
  };

  // Linhas do mês selecionado na aba DDA: cada conta contribui com, no
  // máximo, uma ocorrência para o mês em foco (recorrente ou avulsa).
  const monthlyRows = useMemo(() => {
    return bills
      .map((bill) => {
        const occurrence = getBillOccurrenceForMonth(
          bill,
          selectedMonthKey,
          currentMonthKey,
        );
        return occurrence ? { bill, occurrence } : null;
      })
      .filter(Boolean)
      .sort(
        (a, b) => new Date(a.occurrence.dueDate) - new Date(b.occurrence.dueDate),
      );
  }, [bills, selectedMonthKey, currentMonthKey]);

  const filteredRows = monthlyRows.filter(({ bill, occurrence }) => {
    const statusFilter = normalizeFilterValue(filters.status);
    const categoryFilter = normalizeFilterValue(filters.category);

    if (statusFilter && occurrence.status !== statusFilter) return false;
    if (categoryFilter && bill.category !== categoryFilter) return false;
    if (
      filters.city &&
      !String(bill.city || "")
        .toLowerCase()
        .includes(filters.city.toLowerCase())
    )
      return false;
    if (
      filters.search &&
      !bill.name
        ?.toLowerCase()
        .includes(filters.search.toLowerCase())
    )
      return false;
    return true;
  });

  const getDaysUntilDue = (dueDate) => {
    const today = new Date();
    const due = new Date(dueDate);
    const diffTime = due - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Vermelha somente quando o vencimento já passou (dias < 0) e a
  // ocorrência daquele mês ainda não foi marcada como paga.
  const getStatusColor = (occurrence) => {
    if (occurrence.status === "paid") return "bg-green-100 text-green-700";
    const days = getDaysUntilDue(occurrence.dueDate);
    if (days < 0) return "bg-red-100 text-red-700";
    if (days <= 1) return "bg-red-100 text-red-700";
    if (days <= 3) return "bg-yellow-100 text-yellow-700";
    return "bg-blue-100 text-blue-700";
  };

  // Contagem de contas em aberto/vencidas por mês, só para o badge das abas.
  const monthSummaries = useMemo(() => {
    return monthKeys.map((month) => {
      let openCount = 0;
      let overdueCount = 0;
      bills.forEach((bill) => {
        const occurrence = getBillOccurrenceForMonth(
          bill,
          month.key,
          currentMonthKey,
        );
        if (!occurrence || occurrence.status === "paid") return;
        openCount += 1;
        if (getDaysUntilDue(occurrence.dueDate) < 0) overdueCount += 1;
      });
      return { ...month, openCount, overdueCount };
    });
  }, [bills, monthKeys, currentMonthKey]);

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
    <div className="min-h-screen flex flex-col app-container">
      <Header />

      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="fade-in">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 space-y-4 sm:space-y-0">
            <div>
              <h1
                className="text-4xl font-bold text-gray-800 mb-2"
                data-testid="page-title"
              >
                {pageTitle}
              </h1>
              <p className="text-gray-600">
                Gerencie suas contas{" "}
                {type === "company" ? "empresariais" : "particulares"}
              </p>
            </div>
            <Button
              onClick={() => {
                setEditingBill(null);
                setShowModal(true);
              }}
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 shadow-lg btn-primary"
              data-testid="btn-add-bill"
            >
              <Plus size={20} className="mr-2" />
              Nova Conta
            </Button>
          </div>

          <div className="bg-white rounded-xl shadow-md p-4 mb-6 border border-purple-100">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                Visão mensal (DDA)
              </h2>
              <span className="text-xs text-gray-400">
                Mês atual + próximos 11 meses
              </span>
            </div>
            <div
              className="flex gap-2 overflow-x-auto pb-1"
              data-testid="month-tabs"
            >
              {monthSummaries.map((month) => {
                const isSelected = month.key === selectedMonthKey;
                return (
                  <button
                    key={month.key}
                    type="button"
                    onClick={() => setSelectedMonthKey(month.key)}
                    data-testid={`month-tab-${month.key}`}
                    className={`relative shrink-0 px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                      isSelected
                        ? "bg-purple-600 text-white border-purple-600 shadow"
                        : "bg-white text-gray-600 border-gray-200 hover:border-purple-300 hover:text-purple-700"
                    }`}
                  >
                    {month.label}
                    {month.overdueCount > 0 && (
                      <span
                        className={`ml-2 inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full text-[10px] font-bold ${
                          isSelected
                            ? "bg-white text-red-600"
                            : "bg-red-100 text-red-700"
                        }`}
                        title={`${month.overdueCount} conta(s) vencida(s)`}
                      >
                        {month.overdueCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6 mb-6 border border-purple-100">
            <div className="flex items-center space-x-2 mb-4">
              <Filter size={20} className="text-purple-600" />
              <h2 className="text-lg font-semibold text-gray-800">Filtros</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="text-sm text-gray-600 mb-1 block">
                  Buscar
                </label>
                <div className="relative">
                  <Search
                    className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                    size={18}
                  />
                  <Input
                    placeholder="Nome da conta"
                    value={filters.search}
                    onChange={(e) =>
                      setFilters({ ...filters, search: e.target.value })
                    }
                    className="pl-10"
                    data-testid="filter-search"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-600 mb-1 block">
                  Status
                </label>
                <Select
                  value={filters.status}
                  onValueChange={(value) =>
                    setFilters({ ...filters, status: normalizeFilterValue(value) })
                  }
                >
                  <SelectTrigger data-testid="filter-status">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="open">Em Aberto</SelectItem>
                    <SelectItem value="paid">Paga</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm text-gray-600 mb-1 block">
                  Categoria
                </label>
                <Select
                  value={filters.category}
                  onValueChange={(value) =>
                    setFilters({
                      ...filters,
                      category: normalizeFilterValue(value),
                    })
                  }
                >
                  <SelectTrigger data-testid="filter-category">
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.name}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm text-gray-600 mb-1 block">
                  Cidade
                </label>
                <Input
                  placeholder="Filtrar por cidade"
                  value={filters.city}
                  onChange={(e) =>
                    setFilters({ ...filters, city: e.target.value })
                  }
                  data-testid="filter-city"
                />
              </div>
            </div>
            {(filters.status ||
              filters.category ||
              filters.city ||
              filters.search) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setFilters({ status: "", category: "", city: "", search: "" })
                }
                className="mt-3 text-purple-600 hover:text-purple-700"
                data-testid="btn-clear-filters"
              >
                Limpar Filtros
              </Button>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-md border border-purple-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="bills-table">
                <thead className="bg-gradient-to-r from-purple-50 to-blue-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                      Conta
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                      🔢 Número
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                      Beneficiário
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                      Vencimento
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                      Valor
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                      Categoria
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                      Cidade
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                      Status
                    </th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan="9"
                        className="px-6 py-12 text-center text-gray-500"
                      >
                        Nenhuma conta encontrada neste mês
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map(({ bill, occurrence }) => (
                      <tr
                        key={`${bill.id}-${occurrence.monthKey}`}
                        ref={(el) => {
                          rowRefs.current[bill.id] = el;
                        }}
                        className={`transition-colors ${
                          highlightedBillId === bill.id
                            ? "bg-yellow-100 hover:bg-yellow-100 ring-2 ring-inset ring-yellow-400"
                            : "hover:bg-purple-50"
                        }`}
                        data-testid={`bill-row-${bill.id}-${occurrence.monthKey}`}
                      >
                        <td className="px-6 py-4">
                          <div>
                            <button
                              onClick={() => handleViewDetails(bill)}
                              className="font-medium text-blue-600 hover:text-blue-800 hover:underline cursor-pointer text-left"
                              title="Clique para ver todos os detalhes"
                            >
                              {bill.name}
                            </button>
                            {isRecurringBill(bill) && (
                              <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold" title="Conta recorrente mensal">
                                🔁 Mensal
                              </span>
                            )}
                            {bill.observations && (
                              <p className="text-sm text-gray-500 mt-1">
                                {bill.observations}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {bill.numero ? (
                            <span className="font-mono text-sm bg-gray-100 px-3 py-1 rounded-md border border-gray-200 text-gray-700 font-semibold">
                              {bill.numero}
                            </span>
                          ) : (
                            <span className="text-gray-400 italic text-sm">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {bill.beneficiario ? (
                            <span className="text-gray-700 font-medium" title={bill.beneficiario}>
                              👤 {bill.beneficiario}
                            </span>
                          ) : (
                            <span className="text-gray-400 italic">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-gray-700">
                          {new Date(occurrence.dueDate).toLocaleDateString("pt-BR")}
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-semibold text-gray-800">
                            R$ {(bill.value !== undefined && bill.value !== null && !isNaN(Number(bill.value)) && isFinite(Number(bill.value)))
                              ? Number(bill.value).toFixed(2)
                              : "--"}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm">
                            {bill.category}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-gray-700">{bill.city}</td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(occurrence)}`}
                          >
                            {occurrence.status === "paid"
                              ? "Paga"
                              : getDaysUntilDue(occurrence.dueDate) < 0
                                ? "Vencida"
                                : "Em Aberto"}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center space-x-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                handleOccurrenceStatusChange(
                                  bill,
                                  occurrence,
                                  occurrence.status === "paid" ? "open" : "paid",
                                )
                              }
                              className={`${
                                occurrence.status === "paid"
                                  ? "text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50"
                                  : "text-green-600 hover:text-green-700 hover:bg-green-50"
                              }`}
                              title={
                                occurrence.status === "paid"
                                  ? "Marcar como em aberto"
                                  : "Marcar como paga"
                              }
                              data-testid={`btn-toggle-status-${bill.id}-${occurrence.monthKey}`}
                            >
                              {occurrence.status === "paid" ? (
                                <XCircle size={18} />
                              ) : (
                                <CheckCircle size={18} />
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEdit(bill)}
                              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              title="Editar conta"
                              data-testid={`btn-edit-${bill.id}`}
                            >
                              <Edit size={18} />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                setDeleteDialog({
                                  open: true,
                                  billId: bill.id,
                                })
                              }
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              title="Excluir conta"
                              data-testid={`btn-delete-${bill.id}`}
                            >
                              <Trash2 size={18} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      <Footer />

      {showModal && (
        <BillModal
          open={showModal}
          onClose={() => {
            setShowModal(false);
            setEditingBill(null);
          }}
          onSuccess={() => {
            fetchData();
            setShowModal(false);
            setEditingBill(null);
          }}
          categories={categories}
          bill={editingBill}
          defaultType={billType}
        />
      )}

      <AlertDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, billId: null })}
      >
        <AlertDialogContent
          className="max-w-md overflow-hidden border-red-100 p-0 shadow-[0_24px_80px_rgba(15,23,42,0.28)]"
          data-testid="delete-dialog"
        >
          <div className="bg-gradient-to-r from-red-600 via-rose-600 to-purple-700 px-6 py-5 text-white">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/18 ring-1 ring-white/25">
                <Trash2 size={22} />
              </div>
              <AlertDialogHeader className="space-y-1 text-left">
                <AlertDialogTitle className="text-xl font-bold text-white">
                  Confirmar exclusão
                </AlertDialogTitle>
                <AlertDialogDescription className="text-sm text-red-50">
                  Esta conta será removida da sua lista financeira.
                </AlertDialogDescription>
              </AlertDialogHeader>
            </div>
          </div>

          <div className="px-6 py-5">
            <p className="text-sm leading-6 text-slate-600">
              Tem certeza que deseja excluir esta conta? Esta ação não pode ser
              desfeita.
            </p>
          </div>

          <AlertDialogFooter className="border-t border-slate-100 bg-slate-50 px-6 py-4">
            <AlertDialogCancel
              className="border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-100"
              data-testid="btn-cancel-delete"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 text-white shadow-sm hover:bg-red-700"
              data-testid="btn-confirm-delete"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal de Detalhes da Conta */}
      {detailsModal.open && detailsModal.bill && (
        <div
          className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4"
          onClick={() => setDetailsModal({ open: false, bill: null })}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-4 flex justify-between items-center rounded-t-xl">
              <h2 className="text-2xl font-bold flex items-center">
                📋 Detalhes da Conta
              </h2>
              <button
                onClick={() => setDetailsModal({ open: false, bill: null })}
                className="text-white hover:text-gray-200 text-3xl font-bold leading-none"
                title="Fechar"
              >
                ×
              </button>
            </div>

            {/* Body */}
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Nome da Conta */}
                <div className="md:col-span-2">
                  <label className="text-xs text-gray-500 uppercase font-semibold tracking-wide">
                    Nome da Conta
                  </label>
                  <p className="text-xl font-bold text-gray-800 mt-1">
                    {detailsModal.bill.name}
                  </p>
                </div>

                {/* Número */}
                {detailsModal.bill.numero && (
                  <div className="md:col-span-2">
                    <label className="text-xs text-gray-500 uppercase font-semibold tracking-wide">
                      🔢 Número do Documento/Boleto
                    </label>
                    <p className="text-xl font-mono font-bold text-blue-600 mt-2 bg-blue-50 px-4 py-2 rounded-lg border-2 border-blue-200 inline-block">
                      {detailsModal.bill.numero}
                    </p>
                  </div>
                )}

                {/* Beneficiário */}
                <div className="md:col-span-2">
                  <label className="text-xs text-gray-500 uppercase font-semibold tracking-wide">
                    👤 Beneficiário
                  </label>
                  <p className="text-lg font-semibold text-blue-600 mt-1">
                    {detailsModal.bill.beneficiario || (
                      <span className="text-gray-400 italic">Não informado</span>
                    )}
                  </p>
                </div>

                {/* Valor */}
                <div>
                  <label className="text-xs text-gray-500 uppercase font-semibold tracking-wide">
                    💰 Valor
                  </label>
                  <p className="text-3xl font-bold text-green-600 mt-1">
                    R$ {(detailsModal.bill.value !== undefined && detailsModal.bill.value !== null && !isNaN(Number(detailsModal.bill.value)) && isFinite(Number(detailsModal.bill.value)))
                      ? Number(detailsModal.bill.value).toFixed(2)
                      : (detailsModal.bill.amount !== undefined && detailsModal.bill.amount !== null && !isNaN(Number(detailsModal.bill.amount)) && isFinite(Number(detailsModal.bill.amount)))
                      ? Number(detailsModal.bill.amount).toFixed(2)
                      : "0.00"}
                  </p>
                </div>

                {/* Data de Vencimento */}
                <div>
                  <label className="text-xs text-gray-500 uppercase font-semibold tracking-wide">
                    📅 Data de Vencimento
                  </label>
                  <p className="text-lg font-semibold text-gray-700 mt-1">
                    {new Date(detailsModal.bill.due_date).toLocaleDateString("pt-BR")}
                  </p>
                </div>

                {/* Recorrente */}
                <div>
                  <label className="text-xs text-gray-500 uppercase font-semibold tracking-wide">
                    🔁 Recorrente
                  </label>
                  <div className="mt-1">
                    {isRecurringBill(detailsModal.bill) ? (
                      <span className="inline-block px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-semibold">
                        ✅ Sim - Repete todo mês no dia {new Date(detailsModal.bill.due_date).getDate()}
                      </span>
                    ) : (
                      <span className="inline-block px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-semibold">
                        ❌ Não
                      </span>
                    )}
                  </div>
                </div>

                {/* Categoria */}
                <div>
                  <label className="text-xs text-gray-500 uppercase font-semibold tracking-wide">
                    📂 Categoria
                  </label>
                  <p className="text-lg font-semibold text-gray-700 mt-1">
                    {detailsModal.bill.category || (
                      <span className="text-gray-400 italic">Sem categoria</span>
                    )}
                  </p>
                </div>

                {/* Cidade */}
                <div>
                  <label className="text-xs text-gray-500 uppercase font-semibold tracking-wide">
                    🏙️ Cidade
                  </label>
                  <p className="text-lg font-semibold text-gray-700 mt-1">
                    {detailsModal.bill.city || (
                      <span className="text-gray-400 italic">Não informada</span>
                    )}
                  </p>
                </div>

                {/* Status */}
                <div>
                  <label className="text-xs text-gray-500 uppercase font-semibold tracking-wide">
                    📊 Status
                  </label>
                  <div className="mt-1">
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
                        detailsModal.bill.status === "paid"
                          ? "bg-green-100 text-green-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {detailsModal.bill.status === "paid" ? "✅ Pago" : "⏳ Pendente"}
                    </span>
                  </div>
                </div>

                {/* Tipo */}
                <div>
                  <label className="text-xs text-gray-500 uppercase font-semibold tracking-wide">
                    🏢 Tipo
                  </label>
                  <p className="text-lg font-semibold text-gray-700 mt-1">
                    {detailsModal.bill.bill_type === "company"
                      ? "🏢 Empresarial"
                      : "👤 Pessoal"}
                  </p>
                </div>

                {/* Método de Pagamento */}
                <div>
                  <label className="text-xs text-gray-500 uppercase font-semibold tracking-wide">
                    💳 Método de Pagamento
                  </label>
                  <p className="text-lg font-semibold text-gray-700 mt-1">
                    {detailsModal.bill.payment_method === "boleto" && "📄 Boleto"}
                    {detailsModal.bill.payment_method === "pix" && "💸 PIX"}
                    {detailsModal.bill.payment_method === "email" && "📧 Email"}
                    {detailsModal.bill.payment_method === "app" && "📱 App"}
                    {!detailsModal.bill.payment_method && (
                      <span className="text-gray-400 italic">Não informado</span>
                    )}
                  </p>
                </div>

                {/* Detalhes de Pagamento */}
                {detailsModal.bill.payment_details && (
                  <div className="md:col-span-2">
                    <label className="text-xs text-gray-500 uppercase font-semibold tracking-wide">
                      📝 Detalhes de Pagamento
                    </label>
                    <p className="text-lg font-semibold text-gray-700 mt-1">
                      {detailsModal.bill.payment_details}
                    </p>
                  </div>
                )}

                {/* Boleto em Mãos */}
                <div>
                  <label className="text-xs text-gray-500 uppercase font-semibold tracking-wide">
                    📋 Boleto em Mãos
                  </label>
                  <p className="text-lg font-semibold text-gray-700 mt-1">
                    {detailsModal.bill.boleto_em_maos ? "✅ Sim" : "❌ Não"}
                  </p>
                </div>

                {/* Observacoes */}
                <div className="md:col-span-2">
                  <label className="text-xs text-gray-500 uppercase font-semibold tracking-wide">
                    📝 Observações
                  </label>
                  <div className="mt-1 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                      {detailsModal.bill.observations || (
                        <span className="text-gray-400 italic">Nenhuma observação registrada</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-gray-50 px-6 py-4 flex justify-end border-t rounded-b-xl">
              <Button
                onClick={() => setDetailsModal({ open: false, bill: null })}
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
              >
                Fechar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


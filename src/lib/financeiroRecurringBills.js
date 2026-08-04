export const parseLocalDate = (dateValue) => {
  if (!dateValue) return null;
  const [year, month, day] = String(dateValue).slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
};

export const formatDateInput = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const getMonthKey = (dateValue) => {
  const date = parseLocalDate(dateValue);
  if (!date) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

export const addMonthsKeepingDay = (dateValue, monthsToAdd) => {
  const date = parseLocalDate(dateValue);
  if (!date) return dateValue;
  const originalDay = date.getDate();
  const target = new Date(date.getFullYear(), date.getMonth() + monthsToAdd, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(originalDay, lastDay));
  return formatDateInput(target);
};

export const MONTH_LABELS_PT = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

// Janela rolante de meses usada na visão de DDA das contas: sempre o mês
// atual + os próximos 11, nunca fixa ao calendário (dez/jan não "reseta").
export const getNextMonthKeys = (count = 12, fromDate = new Date()) => {
  const base = new Date(fromDate.getFullYear(), fromDate.getMonth(), 1);
  const keys = [];
  for (let i = 0; i < count; i += 1) {
    const current = new Date(base.getFullYear(), base.getMonth() + i, 1);
    keys.push({
      key: `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}`,
      label: `${MONTH_LABELS_PT[current.getMonth()]}/${String(current.getFullYear()).slice(-2)}`,
      year: current.getFullYear(),
      monthIndex: current.getMonth(),
    });
  }
  return keys;
};

// Desloca o due_date de uma conta recorrente para o mês alvo (mesmo dia,
// ajustado para o último dia do mês quando necessário), sem depender de
// quantos ciclos já rolaram — funciona tanto para meses futuros quanto
// (defensivamente) para meses anteriores ao due_date atual.
export const buildDueDateForMonthKey = (bill, monthKey) => {
  const billMonthKey = getMonthKey(bill.due_date);
  if (!billMonthKey || !monthKey) return null;
  const [billYear, billMonth] = billMonthKey.split("-").map(Number);
  const [targetYear, targetMonth] = monthKey.split("-").map(Number);
  const monthsDiff = (targetYear - billYear) * 12 + (targetMonth - billMonth);
  return addMonthsKeepingDay(bill.due_date, monthsDiff);
};

// Resolve a ocorrência (vencimento + status) de uma conta para um mês
// específico da janela do DDA.
//
// - Contas não recorrentes só aparecem no mês do próprio due_date, exceto
//   quando estão vencidas e não pagas: nesse caso "carregam" para a aba do
//   mês atual, para não sumirem da visão.
// - Contas recorrentes: se o backend já mandar `bill.occurrences` (lista de
//   `{ month, due_date, status, paid_at }`), usamos o valor vindo de lá. Sem
//   isso, inferimos localmente: o mês nativo (o due_date/status atual do
//   registro) usa o status real; meses antes dele são considerados pagos
//   (o rolamento de due_date já "passou" por eles); meses depois ficam em
//   aberto. Um ciclo vencido e não pago sempre aparece na aba do mês atual.
export const getBillOccurrenceForMonth = (bill, monthKey, currentMonthKey) => {
  const billMonthKey = getMonthKey(bill.due_date);
  if (!billMonthKey) return null;

  const isOverdueUnpaidNative =
    billMonthKey < currentMonthKey && bill.status !== "paid";

  if (!isRecurringBill(bill)) {
    if (billMonthKey === monthKey) {
      return {
        monthKey,
        dueDate: bill.due_date,
        status: bill.status,
        paidAt: bill.paid_at || null,
        isNative: true,
      };
    }
    if (isOverdueUnpaidNative && monthKey === currentMonthKey) {
      return {
        monthKey,
        dueDate: bill.due_date,
        status: bill.status,
        paidAt: bill.paid_at || null,
        isNative: true,
      };
    }
    return null;
  }

  if (Array.isArray(bill.occurrences)) {
    const found = bill.occurrences.find((occ) => occ.month === monthKey);
    if (found) {
      return {
        monthKey,
        dueDate: found.due_date,
        status: found.status,
        paidAt: found.paid_at || null,
        isNative: billMonthKey === monthKey,
      };
    }
  }

  if (billMonthKey === monthKey) {
    return {
      monthKey,
      dueDate: bill.due_date,
      status: bill.status,
      paidAt: bill.paid_at || null,
      isNative: true,
    };
  }

  if (isOverdueUnpaidNative && monthKey === currentMonthKey) {
    return {
      monthKey,
      dueDate: bill.due_date,
      status: bill.status,
      paidAt: bill.paid_at || null,
      isNative: true,
    };
  }

  if (monthKey < currentMonthKey) return null;

  const dueDate = buildDueDateForMonthKey(bill, monthKey);
  if (!dueDate) return null;

  return {
    monthKey,
    dueDate,
    status: monthKey < billMonthKey ? "paid" : "open",
    paidAt: null,
    isNative: false,
  };
};

export const getRecurringKey = (bill) =>
  [
    bill.bill_type,
    bill.name,
    bill.numero,
    bill.beneficiario,
    bill.category,
    bill.city,
    bill.value ?? bill.amount,
  ]
    .map((value) => String(value ?? "").trim().toLowerCase())
    .join("|");

export const buildRecurringBillOccurrences = (sourceBills) => {
  const bills = Array.isArray(sourceBills) ? sourceBills : [];
  return [...bills].sort((first, second) => {
    const firstDate = parseLocalDate(first.due_date);
    const secondDate = parseLocalDate(second.due_date);
    return firstDate - secondDate;
  });
};

// Contas antigas (criadas antes destes campos existirem no formulário) podem
// não ter valor algum para eles. Enviar `undefined` faz o JSON omitir o campo
// por completo, o que pode ser rejeitado por uma validação de campo
// obrigatório no backend — por isso tudo aqui recebe um valor concreto.
export const buildRecurringNextOpenUpdatePayload = (bill) => {
  const projectedValue = bill.value ?? bill.amount ?? 0;
  return {
    name: bill.name ?? "",
    numero: bill.numero ?? "",
    due_date: addMonthsKeepingDay(bill.due_date, 1),
    city: bill.city ?? "",
    category: bill.category ?? "",
    observations: bill.observations ?? "",
    bill_type: bill.bill_type ?? "",
    value: Number(projectedValue) || 0,
    payment_method: bill.payment_method ?? "",
    payment_details: bill.payment_details ?? "",
    boleto_em_maos: bill.boleto_em_maos ?? false,
    recorrente: true,
    beneficiario: bill.beneficiario ?? "",
    status: "open",
  };
};

// Tolerante ao formato exato que o backend usa para o campo (bool, ou string
// "true"/"1" em registros mais antigos) para que a recorrência de fato dispare
// sempre que a conta estiver marcada como recorrente, independente da origem.
export const isRecurringBill = (bill) => {
  const value = bill?.recorrente;
  return value === true || value === "true" || value === 1 || value === "1";
};

export const toNumber = (value) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
};

export const normalizeDate = (value) => {
  if (!value) return "";
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return String(value).split("T")[0];
  }
  return parsedDate.toISOString().split("T")[0];
};

export const getAlertIdCandidates = (alert) =>
  [alert?.bill_id, alert?.billId, alert?.id].filter(
    (value) => value !== undefined && value !== null && value !== "",
  );

export const isSameBill = (bill, alert) => {
  if (!bill || !alert) return false;

  const alertIds = getAlertIdCandidates(alert);
  if (
    bill.id !== undefined &&
    bill.id !== null &&
    alertIds.some((candidateId) => String(candidateId) === String(bill.id))
  ) {
    return true;
  }

  const billName = (bill.name || "").trim().toLowerCase();
  const alertName = (alert.account || alert.name || "").trim().toLowerCase();
  if (!billName || !alertName || billName !== alertName) return false;

  const sameDate =
    normalizeDate(bill.due_date) === normalizeDate(alert.due_date);
  const billValue = toNumber(bill.value ?? bill.amount);
  const alertValue = toNumber(alert.value);
  const sameValue =
    billValue !== null && alertValue !== null
      ? Math.abs(billValue - alertValue) < 0.01
      : true;

  return sameDate && sameValue;
};

export const getDaysUntilDue = (dueDate) => {
  const due = parseLocalDate(dueDate);
  if (!due) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return Math.ceil((due - today) / (1000 * 60 * 60 * 24));
};

export const getUrgencyFromBill = (bill) => {
  if (bill.status === "paid") return "green";
  const days = getDaysUntilDue(bill.due_date);
  if (days <= 1) return "red";
  if (days <= 3) return "yellow";
  return "green";
};

export const buildAlertFromBill = (bill) => ({
  id: `fallback-${bill.id}`,
  bill_id: bill.id,
  account: bill.name,
  category: bill.category,
  city: bill.city,
  due_date: bill.due_date,
  value: bill.value ?? bill.amount,
  status: bill.status,
  bill_type: bill.bill_type,
  urgency: getUrgencyFromBill(bill),
  days_until_due: getDaysUntilDue(bill.due_date),
  recorrente: isRecurringBill(bill),
});

// O backend nem sempre gera um aviso para toda conta em aberto (ex: alguma
// regra própria de janela de dias, paginação, etc.), então aqui completamos
// a lista com um aviso "de fallback" para qualquer conta (recorrente ou não)
// que esteja em aberto e ainda não tenha um aviso correspondente vindo do
// backend — assim nenhuma conta vencida fica de fora da tela de Avisos.
export const mergeAlertsWithRecurringBills = (sourceAlerts, sourceBills) => {
  const alerts = Array.isArray(sourceAlerts) ? sourceAlerts : [];
  const billsWithRecurringOccurrences = buildRecurringBillOccurrences(sourceBills);
  const fallbackAlerts = billsWithRecurringOccurrences
    .filter((bill) => bill.status !== "paid")
    .filter((bill) => !alerts.some((alert) => isSameBill(bill, alert)))
    .map(buildAlertFromBill);

  return {
    alerts: [...alerts, ...fallbackAlerts],
    bills: billsWithRecurringOccurrences,
  };
};

export const sumAlertValues = (alerts) =>
  alerts.reduce((total, alert) => total + (Number(alert.value) || 0), 0);

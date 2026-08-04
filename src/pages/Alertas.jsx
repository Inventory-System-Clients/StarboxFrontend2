import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer.jsx";
import { PageHeader } from "../components/UIComponents";
import { EmptyState } from "../components/Loading";
import AlertAdmin from "../components/AlertAdmin";
import { useAlertas } from "../contexts/AlertasContext.jsx";
import { INTERVALO_ALERTA_PERSISTENTE_DIAS } from "../hooks/useManutencoesPersistentes";

const CORES_TILE = {
  red: "from-red-500 to-red-600",
  purple: "from-purple-500 to-purple-600",
  amber: "from-amber-500 to-amber-600",
  rose: "from-rose-500 to-rose-600",
  yellow: "from-yellow-500 to-yellow-600",
};

const formatarMoeda = (valor) => {
  const numero = Number(valor);
  return Number.isFinite(numero) ? `R$ ${numero.toFixed(2)}` : "--";
};

const formatarData = (valor) => {
  if (!valor) return "--";
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? "--" : data.toLocaleDateString("pt-BR");
};

const diasEntre = (valor) => {
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return null;
  return Math.ceil((data.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
};

function TileAlerta({ tipo, onClick }) {
  const gradiente = CORES_TILE[tipo.cor] || "from-gray-500 to-gray-600";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative rounded-xl p-4 text-left text-white shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl bg-linear-to-br ${gradiente} ${
        tipo.total > 0 ? "" : "opacity-60"
      }`}
    >
      <div className="text-2xl">{tipo.icone}</div>
      <div className="mt-2 text-sm font-semibold leading-tight">{tipo.label}</div>
      <div className="mt-1 text-3xl font-extrabold">{tipo.total}</div>
    </button>
  );
}

function SecaoEstoque({ itens, navigate }) {
  if (itens.length === 0) {
    return <p className="text-sm text-gray-500">Nenhum alerta de estoque no momento.</p>;
  }
  return (
    <div className="grid gap-3">
      {itens.map((alerta, index) => (
        <div
          key={alerta.maquina?.id || index}
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-4"
        >
          <div>
            <p className="font-bold text-gray-900">
              {alerta.maquina?.codigo} {alerta.maquina?.nome ? `- ${alerta.maquina.nome}` : ""}
            </p>
            <p className="text-sm text-gray-600">
              {alerta.maquina?.loja} · Estoque {alerta.estoqueAtual}/{alerta.capacidadePadrao} (
              {alerta.percentualAtual}%) · {alerta.nivelAlerta}
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate(`/maquinas/${alerta.maquina?.id}`)}
            className="px-4 py-2 text-sm bg-gray-100 text-[#24094E] font-semibold rounded-lg hover:bg-gray-200 transition-colors"
          >
            Ver Máquina
          </button>
        </div>
      ))}
    </div>
  );
}

function SecaoManutencaoRecorrente({ itens, navigate }) {
  if (itens.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        Nenhuma máquina com manutenção recorrente nos últimos {INTERVALO_ALERTA_PERSISTENTE_DIAS} dias.
      </p>
    );
  }
  return (
    <div className="grid gap-3">
      {itens.map((item) => (
        <div
          key={item.maquinaId}
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4"
        >
          <div>
            <p className="font-bold text-gray-900">
              {item.maquinaNome} - {item.lojaNome}
            </p>
            <p className="text-sm text-gray-600">
              Última manutenção: {formatarData(item.dataUltima)} · Manutenção atual: {formatarData(item.dataAtual)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/manutencoes")}
            className="px-4 py-2 text-sm bg-gray-100 text-[#24094E] font-semibold rounded-lg hover:bg-gray-200 transition-colors"
          >
            Ver Manutenções
          </button>
        </div>
      ))}
    </div>
  );
}

function SecaoContas({ itens, cor, navigate, mensagemVazio, rotuloDias }) {
  if (itens.length === 0) {
    return <p className="text-sm text-gray-500">{mensagemVazio}</p>;
  }
  return (
    <div className="grid gap-3">
      {itens.map(({ bill, occurrence }) => {
        const dias = diasEntre(occurrence.dueDate);
        return (
          <div
            key={bill.id}
            className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4 ${
              cor === "red" ? "border-red-200 bg-red-50" : "border-yellow-200 bg-yellow-50"
            }`}
          >
            <div>
              <p className="font-bold text-gray-900">{bill.name || "Conta sem nome"}</p>
              <p className="text-sm text-gray-600">
                Vencimento: {formatarData(occurrence.dueDate)} · Valor: {formatarMoeda(bill.value ?? bill.amount)} ·{" "}
                {dias !== null && (dias < 0 ? `${Math.abs(dias)} dia(s) em atraso` : `${rotuloDias}: ${dias === 0 ? "hoje" : `${dias} dia(s)`}`)}
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                navigate(`/financeiro/contas/${bill.bill_type === "company" ? "company" : "personal"}`, {
                  state: { highlightBillId: bill.id },
                })
              }
              className="px-4 py-2 text-sm bg-gray-100 text-[#24094E] font-semibold rounded-lg hover:bg-gray-200 transition-colors"
            >
              Ver Conta
            </button>
          </div>
        );
      })}
    </div>
  );
}

export default function Alertas() {
  const navigate = useNavigate();
  const { tipos, totalGeral, carregando, podeVerAlertas } = useAlertas();

  const irPara = (id) => {
    const secao = document.getElementById(`alerta-secao-${id}`);
    secao?.scrollIntoView({ behavior: "smooth" });
  };

  if (!podeVerAlertas) {
    return (
      <div className="min-h-screen bg-background-light bg-pattern teddy-pattern">
        <Navbar />
        <div className="max-w-3xl mx-auto px-4 py-12">
          <EmptyState
            icon="🔒"
            title="Sem acesso"
            description="Somente administradores e gerenciadores veem a central de alertas."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-light bg-pattern teddy-pattern">
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title="Central de Alertas"
          subtitle={
            carregando
              ? "Atualizando..."
              : `${totalGeral} alerta${totalGeral === 1 ? "" : "s"} no total`
          }
          icon="🔔"
        />

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-10">
          {tipos.map((tipo) => (
            <TileAlerta key={tipo.id} tipo={tipo} onClick={() => irPara(tipo.id)} />
          ))}
        </div>

        <section id="alerta-secao-estoque" className="mb-10">
          <h2 className="text-xl font-bold text-gray-900 mb-4">🎮 Estoque baixo em máquina</h2>
          <SecaoEstoque itens={tipos.find((t) => t.id === "estoque")?.itens || []} navigate={navigate} />
        </section>

        <section
          id="alerta-secao-movimentacao-inconsistente"
          className="mb-10 scroll-mt-4"
        >
          <h2 id="alerta-secao-abastecimento-incompleto" className="text-xl font-bold text-gray-900 mb-4">
            🔄 Movimentação inconsistente e abastecimento incompleto
          </h2>
          <AlertAdmin />
        </section>

        <section id="alerta-secao-manutencao-recorrente" className="mb-10">
          <h2 className="text-xl font-bold text-gray-900 mb-4">🔁 Manutenção recorrente</h2>
          <p className="text-sm text-gray-600 mb-4">
            Máquinas com mais de uma manutenção concluída em até {INTERVALO_ALERTA_PERSISTENTE_DIAS} dias — pode
            indicar que a manutenção anterior não resolveu o problema.
          </p>
          <SecaoManutencaoRecorrente
            itens={tipos.find((t) => t.id === "manutencao-recorrente")?.itens || []}
            navigate={navigate}
          />
        </section>

        <section id="alerta-secao-contas-vencidas" className="mb-10">
          <h2 className="text-xl font-bold text-gray-900 mb-4">💰 Contas vencidas</h2>
          <SecaoContas
            itens={tipos.find((t) => t.id === "contas-vencidas")?.itens || []}
            cor="red"
            navigate={navigate}
            mensagemVazio="Nenhuma conta vencida no momento."
            rotuloDias="Vence em"
          />
        </section>

        <section id="alerta-secao-contas-proximas" className="mb-10">
          <h2 className="text-xl font-bold text-gray-900 mb-4">⏰ Contas a vencer (3 dias)</h2>
          <SecaoContas
            itens={tipos.find((t) => t.id === "contas-proximas")?.itens || []}
            cor="yellow"
            navigate={navigate}
            mensagemVazio="Nenhuma conta com vencimento nos próximos 3 dias."
            rotuloDias="Vence em"
          />
        </section>
      </div>
      <Footer />
    </div>
  );
}

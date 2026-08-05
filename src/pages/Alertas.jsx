import { useMemo, useState } from "react";
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

// A partir desse tanto de itens, mostra um campo de busca em vez de listar
// tudo de uma vez.
const LIMITE_PARA_FILTRO = 6;

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

const normalizarTexto = (valor) =>
  String(valor || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

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

// Cabeçalho com setinha pra recolher/expandir a seção — evita que a página
// vire uma lista gigante quando um tipo de alerta tem muitos avisos.
function SecaoColapsavel({ id, titulo, total, aberta, onToggle, children }) {
  return (
    <section id={id} className="mb-6 scroll-mt-4 rounded-xl border border-gray-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 p-4 text-left"
      >
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-gray-900">{titulo}</h2>
          {total !== undefined && (
            <span className="text-xs font-bold px-2 py-1 rounded-full bg-gray-100 text-gray-700">
              {total}
            </span>
          )}
        </div>
        <svg
          className={`w-5 h-5 text-gray-500 transition-transform shrink-0 ${aberta ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {aberta && <div className="px-4 pb-4">{children}</div>}
    </section>
  );
}

function CampoFiltro({ valor, onChange, placeholder }) {
  return (
    <input
      type="text"
      value={valor}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="input-field mb-4 w-full sm:w-80"
    />
  );
}

function SecaoEstoque({ itens }) {
  const navigate = useNavigate();
  const [filtro, setFiltro] = useState("");

  const itensFiltrados = useMemo(() => {
    const termo = normalizarTexto(filtro);
    if (!termo) return itens;
    return itens.filter((alerta) =>
      [alerta.maquina?.codigo, alerta.maquina?.nome, alerta.maquina?.loja]
        .map(normalizarTexto)
        .some((campo) => campo.includes(termo)),
    );
  }, [itens, filtro]);

  if (itens.length === 0) {
    return <p className="text-sm text-gray-500">Nenhum alerta de estoque no momento.</p>;
  }

  return (
    <>
      {itens.length > LIMITE_PARA_FILTRO && (
        <CampoFiltro
          valor={filtro}
          onChange={setFiltro}
          placeholder="Buscar por máquina ou ponto..."
        />
      )}
      {itensFiltrados.length === 0 ? (
        <p className="text-sm text-gray-500">Nenhum alerta encontrado para essa busca.</p>
      ) : (
        <div className="grid gap-3">
          {itensFiltrados.map((alerta, index) => (
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
      )}
    </>
  );
}

function SecaoManutencaoRecorrente({ itens }) {
  const navigate = useNavigate();
  const [filtro, setFiltro] = useState("");

  const itensFiltrados = useMemo(() => {
    const termo = normalizarTexto(filtro);
    if (!termo) return itens;
    return itens.filter((item) =>
      [item.maquinaNome, item.lojaNome]
        .map(normalizarTexto)
        .some((campo) => campo.includes(termo)),
    );
  }, [itens, filtro]);

  if (itens.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        Nenhuma máquina com manutenção recorrente nos últimos {INTERVALO_ALERTA_PERSISTENTE_DIAS} dias.
      </p>
    );
  }

  return (
    <>
      {itens.length > LIMITE_PARA_FILTRO && (
        <CampoFiltro
          valor={filtro}
          onChange={setFiltro}
          placeholder="Buscar por máquina ou ponto..."
        />
      )}
      {itensFiltrados.length === 0 ? (
        <p className="text-sm text-gray-500">Nenhum alerta encontrado para essa busca.</p>
      ) : (
        <div className="grid gap-3">
          {itensFiltrados.map((item) => (
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
      )}
    </>
  );
}

function SecaoContas({ itens, cor, mensagemVazio, rotuloDias }) {
  const navigate = useNavigate();
  const [filtro, setFiltro] = useState("");

  const itensFiltrados = useMemo(() => {
    const termo = normalizarTexto(filtro);
    if (!termo) return itens;
    return itens.filter(({ bill }) => normalizarTexto(bill.name).includes(termo));
  }, [itens, filtro]);

  if (itens.length === 0) {
    return <p className="text-sm text-gray-500">{mensagemVazio}</p>;
  }

  return (
    <>
      {itens.length > LIMITE_PARA_FILTRO && (
        <CampoFiltro valor={filtro} onChange={setFiltro} placeholder="Buscar conta pelo nome..." />
      )}
      {itensFiltrados.length === 0 ? (
        <p className="text-sm text-gray-500">Nenhuma conta encontrada para essa busca.</p>
      ) : (
        <div className="grid gap-3">
          {itensFiltrados.map(({ bill, occurrence }) => {
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
      )}
    </>
  );
}

export default function Alertas() {
  const { tipos, totalGeral, carregando, podeVerAlertas } = useAlertas();
  const [secoesAbertas, setSecoesAbertas] = useState(() => new Set());

  const alternarSecao = (id) => {
    setSecoesAbertas((prev) => {
      const proximo = new Set(prev);
      if (proximo.has(id)) {
        proximo.delete(id);
      } else {
        proximo.add(id);
      }
      return proximo;
    });
  };

  const irPara = (id) => {
    setSecoesAbertas((prev) => new Set(prev).add(id));
    // Espera o conteúdo expandir antes de rolar até a seção.
    requestAnimationFrame(() => {
      document.getElementById(`alerta-secao-${id}`)?.scrollIntoView({ behavior: "smooth" });
    });
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

        <SecaoColapsavel
          id="alerta-secao-estoque"
          titulo="🎮 Estoque baixo em máquina"
          total={tipos.find((t) => t.id === "estoque")?.total}
          aberta={secoesAbertas.has("estoque")}
          onToggle={() => alternarSecao("estoque")}
        >
          <SecaoEstoque itens={tipos.find((t) => t.id === "estoque")?.itens || []} />
        </SecaoColapsavel>

        <SecaoColapsavel
          id="alerta-secao-movimentacao-inconsistente"
          titulo="🔄 Movimentação inconsistente e abastecimento incompleto"
          total={
            (tipos.find((t) => t.id === "movimentacao-inconsistente")?.total || 0) +
            (tipos.find((t) => t.id === "abastecimento-incompleto")?.total || 0)
          }
          aberta={secoesAbertas.has("movimentacao-inconsistente")}
          onToggle={() => alternarSecao("movimentacao-inconsistente")}
        >
          <AlertAdmin />
        </SecaoColapsavel>

        <SecaoColapsavel
          id="alerta-secao-manutencao-recorrente"
          titulo="🔁 Manutenção recorrente"
          total={tipos.find((t) => t.id === "manutencao-recorrente")?.total}
          aberta={secoesAbertas.has("manutencao-recorrente")}
          onToggle={() => alternarSecao("manutencao-recorrente")}
        >
          <p className="text-sm text-gray-600 mb-4">
            Máquinas com mais de uma manutenção concluída em até {INTERVALO_ALERTA_PERSISTENTE_DIAS} dias — pode
            indicar que a manutenção anterior não resolveu o problema.
          </p>
          <SecaoManutencaoRecorrente
            itens={tipos.find((t) => t.id === "manutencao-recorrente")?.itens || []}
          />
        </SecaoColapsavel>

        <SecaoColapsavel
          id="alerta-secao-contas-vencidas"
          titulo="💰 Contas vencidas"
          total={tipos.find((t) => t.id === "contas-vencidas")?.total}
          aberta={secoesAbertas.has("contas-vencidas")}
          onToggle={() => alternarSecao("contas-vencidas")}
        >
          <SecaoContas
            itens={tipos.find((t) => t.id === "contas-vencidas")?.itens || []}
            cor="red"
            mensagemVazio="Nenhuma conta vencida no momento."
            rotuloDias="Vence em"
          />
        </SecaoColapsavel>

        <SecaoColapsavel
          id="alerta-secao-contas-proximas"
          titulo="⏰ Contas a vencer (3 dias)"
          total={tipos.find((t) => t.id === "contas-proximas")?.total}
          aberta={secoesAbertas.has("contas-proximas")}
          onToggle={() => alternarSecao("contas-proximas")}
        >
          <SecaoContas
            itens={tipos.find((t) => t.id === "contas-proximas")?.itens || []}
            cor="yellow"
            mensagemVazio="Nenhuma conta com vencimento nos próximos 3 dias."
            rotuloDias="Vence em"
          />
        </SecaoColapsavel>
      </div>
      <Footer />
    </div>
  );
}

import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useAlertas } from "../contexts/AlertasContext.jsx";
import api from "../services/api";
import { roteiroTemVeiculoAssociado } from "../lib/pilotagemRoteiro";

const ADMIN_LIKE = ["ADMIN", "GERENCIADOR"];
// Usuário MANUTENCAO só consegue navegar pra /pecas e /manutencoes (o próprio
// App.jsx redireciona à força pra /pecas em qualquer outra rota) — o menu não
// deve oferecer links que vão só jogar o usuário de volta.
const ROTAS_PERMITIDAS_MANUTENCAO = ["/pecas", "/manutencoes"];

const podeVerItem = (item, role, temVeiculoNoRoteiro) => {
  if (role === "MANUTENCAO") {
    return ROTAS_PERMITIDAS_MANUTENCAO.includes(item.to);
  }
  if (item.adminOnly && !ADMIN_LIKE.includes(role)) return false;
  if (item.allowedRoles && !item.allowedRoles.includes(role)) return false;
  if (item.deniedRoles && item.deniedRoles.includes(role)) return false;
  // Funcionario (todas as lojas) so precisa do menu de veiculos quando o
  // roteiro dele realmente tem um veiculo associado.
  if (
    item.requiresVeiculoRoteiro &&
    role === "FUNCIONARIO_TODAS_LOJAS" &&
    !temVeiculoNoRoteiro
  ) {
    return false;
  }
  return true;
};

const itensSoltos = [{ to: "/", label: "Dashboard", icon: "📊" }];

// Abastecedor tem uma rotina bem restrita (rota + estoque pessoal), entao o
// menu dele nao mostra os grupos administrativos/operacionais inteiros — so
// os 2 links que ele realmente usa, direto sem dropdown.
const itensSoltosAbastecedor = [
  { to: "/", label: "Dashboard", icon: "📊" },
  { to: "/roteiros", label: "Roteiros", icon: "🗺️" },
  { to: "/estoque-usuarios", label: "Gerenciamento de Estoque", icon: "📦" },
];

const grupos = [
  {
    id: "operacional",
    label: "Operacional",
    icon: "🛠️",
    itens: [
      { to: "/roteiros", label: "Roteiros", icon: "🗺️" },
      {
        to: "/lancar-gasto",
        label: "Lançar Gasto",
        icon: "💸",
        allowedRoles: ["FUNCIONARIO", "FUNCIONARIO_TODAS_LOJAS"],
      },
      { to: "/manutencoes", label: "Manutenções", icon: "🛠️", alert: true },
      { to: "/estoque-usuarios", label: "Gerenciamento de Estoque", icon: "📦" },
      { to: "/quebra-ordem", label: "Quebra de Ordem", icon: "🔀" },
      {
        to: "/veiculos",
        label: "Veículos",
        icon: "🚚",
        deniedRoles: ["FUNCIONARIO", "FUNCIONARIO_TODAS_LOJAS", "ABASTECEDOR"],
        requiresVeiculoRoteiro: true,
      },
      {
        to: "/veiculos/revisoes-pendentes",
        label: "Revisões Pendentes",
        icon: "🔧",
        deniedRoles: ["FUNCIONARIO", "ABASTECEDOR"],
        requiresVeiculoRoteiro: true,
      },
    ],
  },
  {
    id: "estoque-pecas",
    label: "Estoque e Peças",
    icon: "🧩",
    itens: [
      { to: "/estoque-usuarios", label: "Gerenciamento de Estoque", icon: "📦" },
      { to: "/pecas", label: "Peças e Carrinhos", icon: "🧰" },
      { to: "/deposito-principal", label: "Depósito Principal", icon: "🏭" },
      {
        to: "/dashboard/pecas-defeituosas",
        label: "Peças Defeituosas",
        icon: "♻️",
        allowedRoles: [
          "FUNCIONARIO",
          "FUNCIONARIO_TODAS_LOJAS",
          "ABASTECEDOR",
        ],
      },
      {
        to: "/admin/pecas-defeituosas",
        label: "Peças Defeituosas",
        icon: "♻️",
        adminOnly: true,
      },
    ],
  },
  {
    id: "cadastros",
    label: "Cadastros",
    icon: "🗂️",
    itens: [
      {
        to: "/lojas",
        label: "Lojas",
        icon: "🏪",
        deniedRoles: ["FUNCIONARIO", "ABASTECEDOR"],
      },
      {
        to: "/maquinas",
        label: "Máquinas",
        icon: "🎮",
        deniedRoles: ["FUNCIONARIO", "ABASTECEDOR"],
      },
      { to: "/produtos", label: "Produtos", icon: "🧸" },
      { to: "/usuarios", label: "Usuários", icon: "👥", adminOnly: true },
    ],
  },
  {
    id: "analise",
    label: "Análise",
    icon: "📈",
    itens: [
      { to: "/movimentacoes", label: "Movimentações", icon: "🔄" },
      { to: "/graficos", label: "Gráficos", icon: "📈", adminOnly: true },
      {
        to: "/relatorios",
        label: "Relatórios",
        icon: "📄",
        allowedRoles: ["ADMIN"],
      },
    ],
  },
  {
    id: "financeiro",
    label: "Financeiro",
    icon: "💰",
    itens: [
      {
        to: "/fluxo-caixa",
        label: "Fluxo de Caixa",
        icon: "💵",
        deniedRoles: ["GERENCIADOR"],
      },
      {
        to: "/financeiro",
        label: "Financeiro",
        icon: "💰",
        deniedRoles: ["GERENCIADOR"],
      },
    ],
  },
];

export default function Navbar() {
  const { usuario, logout } = useAuth();
  const { totalGeral, podeVerAlertas, podeVerAlertaManutencao } = useAlertas();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [gruposAbertos, setGruposAbertos] = useState({});
  const [temVeiculoNoRoteiro, setTemVeiculoNoRoteiro] = useState(false);

  useEffect(() => {
    let cancelado = false;

    async function verificarVeiculoNoRoteiro() {
      if (usuario?.role !== "FUNCIONARIO_TODAS_LOJAS" || !usuario?.id) {
        setTemVeiculoNoRoteiro(false);
        return;
      }

      try {
        const res = await api.get("/roteiros");
        const todos = Array.isArray(res.data) ? res.data : [];
        const possuiVeiculo = todos.some(
          (roteiro) =>
            String(roteiro?.funcionarioId || "") === String(usuario.id) &&
            roteiroTemVeiculoAssociado(roteiro),
        );
        if (!cancelado) setTemVeiculoNoRoteiro(possuiVeiculo);
      } catch {
        if (!cancelado) setTemVeiculoNoRoteiro(false);
      }
    }

    verificarVeiculoNoRoteiro();

    return () => {
      cancelado = true;
    };
  }, [usuario?.role, usuario?.id]);

  const isActive = (path) => location.pathname === path;
  const closeMenu = () => setIsMenuOpen(false);
  const toggleGrupo = (id) =>
    setGruposAbertos((prev) => ({ ...prev, [id]: !prev[id] }));

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/login");
    } catch (error) {
      console.error("Erro ao sair:", error);
    }
  };

  const perfilLabel =
    usuario?.role === "ADMIN"
      ? "🛡️ Administrador"
      : usuario?.role === "CONTROLADOR_ESTOQUE"
        ? "📦 Controlador de Estoque"
        : usuario?.role === "GERENCIADOR"
          ? "🧩 Gerenciador"
          : usuario?.role === "FUNCIONARIO_TODAS_LOJAS"
            ? "👤 Funcionário (todos os pontos)"
            : usuario?.role === "MANUTENCAO"
              ? "🛠️ Manutenção"
              : usuario?.role === "ABASTECEDOR"
                ? "🚚 Abastecedor"
                : "👤 Funcionário Abastecedor";

  const isAbastecedor = usuario?.role === "ABASTECEDOR";

  const itensSoltosVisiveis = (
    isAbastecedor ? itensSoltosAbastecedor : itensSoltos
  ).filter((item) => podeVerItem(item, usuario?.role, temVeiculoNoRoteiro));

  const gruposVisiveis = isAbastecedor
    ? []
    : grupos
        .map((grupo) => ({
          ...grupo,
          itens: grupo.itens.filter((item) =>
            podeVerItem(item, usuario?.role, temVeiculoNoRoteiro),
          ),
        }))
        .filter((grupo) => grupo.itens.length > 0);

  return (
    <nav
      className="text-[#62A1D9] shadow-2xl border-b-4 border-[#62A1D9] sticky top-0 z-50"
      style={{
        background:
          "linear-gradient(90deg, #62A1D9 0%, #24094E 35%, #24094E 100%)",
      }}
    >
      <div className="w-full px-2 sm:px-3 lg:px-4">
        <div className="flex items-center justify-between w-full min-h-18 py-2 gap-2">
          <Link to="/" className="flex shrink-0 items-center group">
            <img
              src="/starbox-logo.png"
              alt="StarBox Logo"
              className="pl-1 sm:pl-2 w-20 h-8 sm:w-24 sm:h-9 lg:w-30 lg:h-10 object-contain transition-transform duration-300 group-hover:scale-105"
              style={{ maxWidth: "150px", height: "auto", background: "transparent" }}
              onError={(e) => {
                e.target.style.display = "none";
              }}
            />
          </Link>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0 pr-1 sm:pr-2 min-w-0">
            <div className="hidden lg:block text-right bg-white/5 px-3 py-2 rounded-lg border border-white/10 max-w-55">
              <div className="text-sm font-semibold text-white truncate">
                {usuario?.nome || "Usuário"}
              </div>
              <div className="text-xs text-accent-cream truncate">
                {perfilLabel}
              </div>
            </div>

            {(podeVerAlertas || podeVerAlertaManutencao) && (
              <button
                type="button"
                onClick={() => navigate("/alertas")}
                className={`relative flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-bold shadow-lg transition-all duration-200 hover:-translate-y-0.5 sm:px-4 ${
                  totalGeral > 0
                    ? "animate-pulse bg-linear-to-r from-yellow-500 to-orange-600 text-white hover:from-yellow-600 hover:to-orange-700"
                    : "bg-white/10 text-white hover:bg-white/15"
                }`}
              >
                <span className="text-lg leading-none">🔔</span>
                <span className="hidden sm:inline">Alertas</span>
                {totalGeral > 0 && (
                  <span className="absolute -right-2 -top-2 flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-white bg-red-600 px-1 text-xs font-black text-white">
                    {totalGeral > 99 ? "99+" : totalGeral}
                  </span>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsMenuOpen((open) => !open)}
              className="rounded-lg p-2 transition-colors hover:bg-white/10"
              aria-label="Menu"
              aria-expanded={isMenuOpen}
            >
              <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="bg-linear-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 px-2.5 sm:px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center gap-1.5 whitespace-nowrap"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>
      </div>

      {isMenuOpen && (
        <div className="border-t border-white/10 bg-neutral-950">
          <div className="mx-auto max-w-7xl space-y-3 px-4 py-3 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {itensSoltosVisiveis.map((item) => {
                const active = isActive(item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={closeMenu}
                    className={`relative flex min-h-12 items-center justify-between rounded-lg px-4 py-3 text-sm font-medium transition-all ${
                      active
                        ? "bg-linear-to-r from-primary to-accent-yellow text-white shadow-lg"
                        : "text-gray-300 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="text-lg" aria-hidden="true">
                        {item.icon}
                      </span>
                      <span className="truncate">{item.label}</span>
                    </span>
                  </Link>
                );
              })}
            </div>

            <div className="space-y-2">
              {gruposVisiveis.map((grupo) => {
                const aberto = Boolean(gruposAbertos[grupo.id]);

                return (
                  <div key={grupo.id} className="overflow-hidden rounded-lg border border-white/10">
                    <button
                      type="button"
                      onClick={() => toggleGrupo(grupo.id)}
                      className="flex w-full items-center justify-between px-4 py-3 text-sm font-bold text-gray-200 transition-colors hover:bg-white/10"
                      aria-expanded={aberto}
                    >
                      <span className="flex items-center gap-3">
                        <span className="text-lg" aria-hidden="true">
                          {grupo.icon}
                        </span>
                        {grupo.label}
                      </span>
                      <span
                        className={`text-xs transition-transform duration-200 ${aberto ? "rotate-90" : ""}`}
                        aria-hidden="true"
                      >
                        ▶
                      </span>
                    </button>

                    {aberto && (
                      <div className="grid grid-cols-1 gap-2 border-t border-white/10 bg-black/20 p-3 sm:grid-cols-2 lg:grid-cols-3">
                        {grupo.itens.map((item) => {
                          const active = isActive(item.to);

                          return (
                            <Link
                              key={item.to}
                              to={item.to}
                              onClick={closeMenu}
                              className={`relative flex min-h-12 items-center justify-between rounded-lg px-4 py-3 text-sm font-medium transition-all ${
                                active
                                  ? "bg-linear-to-r from-primary to-accent-yellow text-white shadow-lg"
                                  : "text-gray-300 hover:bg-white/10 hover:text-white"
                              }`}
                            >
                              <span className="flex min-w-0 items-center gap-3">
                                <span className="text-lg" aria-hidden="true">
                                  {item.icon}
                                </span>
                                <span className="truncate">{item.label}</span>
                              </span>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="border-t border-white/10 pt-3 lg:hidden">
              <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3">
                <div className="truncate text-sm font-semibold text-white">
                  {usuario?.nome}
                </div>
                <div className="mt-1 text-xs text-accent-cream">{perfilLabel}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}

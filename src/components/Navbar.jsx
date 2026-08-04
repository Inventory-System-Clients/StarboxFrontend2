import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";

export default function Navbar() {
  const { usuario, logout } = useAuth(); // Assumindo que seu context proveja usuario e logout
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [useCompactMenu, setUseCompactMenu] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const isFuncionario =
    usuario?.role === "FUNCIONARIO" || usuario?.role === "ABASTECEDOR";
  const isPerfilFuncionario =
    usuario?.role === "FUNCIONARIO" ||
    usuario?.role === "FUNCIONARIO_TODAS_LOJAS" ||
    usuario?.role === "ABASTECEDOR";
  const isAdminLike =
    usuario?.role === "ADMIN" || usuario?.role === "GERENCIADOR";

  const isActive = (path) => location.pathname === path;
  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);
  const closeMenu = () => setIsMenuOpen(false);

  useEffect(() => {
    const handleResize = () => {
      // Desktop mantém links visíveis. Menu compacto apenas para tamanhos menores.
      const shouldCompact = window.innerWidth < 1280;
      setUseCompactMenu((prev) =>
        prev === shouldCompact ? prev : shouldCompact,
      );

      if (!shouldCompact) {
        setIsMenuOpen(false);
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/login");
    } catch (error) {
      console.error("Erro ao sair:", error);
    }
  };

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
          {/* Logo e Nome */}
          <div className="flex items-center relative min-w-0 flex-1">
            <Link
              to="/"
              className="flex items-center space-x-2 sm:space-x-3 group min-w-0 relative z-10"
            >
              <img
                src="/starbox-logo.png"
                alt="StarBox Logo"
                className="pl-1 sm:pl-2 w-20 h-8 sm:w-24 sm:h-9 lg:w-30 lg:h-10 object-contain transition-transform duration-300 group-hover:scale-105"
                style={{
                  maxWidth: "150px",
                  height: "auto",
                  background: "transparent",
                }}
                onError={(e) => {
                  e.target.style.display = "none";
                }}
              />
            </Link>

            {/* Menu Desktop */}
            <div className={`${useCompactMenu ? "hidden" : "hidden xl:block"} ml-4`}>
              <div className="flex items-center space-x-2 whitespace-nowrap">
                <NavLink to="/" active={isActive("/")}>
                  📊 Dashboard
                </NavLink>
                <NavLink to="/roteiros" active={isActive("/roteiros")}>
                  🗺️ Rotas
                </NavLink>
                {!isFuncionario && usuario?.role !== "CONTROLADOR_ESTOQUE" && (
                  <NavLink to="/maquinas" active={isActive("/maquinas")}>
                    🎮 Máquinas
                  </NavLink>
                )}
                {!isPerfilFuncionario && (
                  <NavLink to="/lojas" active={isActive("/lojas")}>
                    🏪 Pontos
                  </NavLink>
                )}

                <NavLink to="/produtos" active={isActive("/produtos")}>
                  🧸 Produtos
                </NavLink>

                {(usuario?.role === "ADMIN" ||
                  usuario?.role === "FUNCIONARIO" ||
                  usuario?.role === "FUNCIONARIO_TODAS_LOJAS" ||
                  usuario?.role === "ABASTECEDOR" ||
                  usuario?.role === "CONTROLADOR_ESTOQUE" ||
                  usuario?.role === "MANUTENCAO" ||
                  usuario?.role === "GERENCIADOR") && (
                  <NavLink to="/pecas" active={isActive("/pecas")}>
                    🛠️ Peças
                  </NavLink>
                )}

                {(usuario?.role === "FUNCIONARIO" ||
                  usuario?.role === "FUNCIONARIO_TODAS_LOJAS" ||
                  usuario?.role === "ABASTECEDOR") && (
                  <NavLink
                    to="/dashboard/pecas-defeituosas"
                    active={isActive("/dashboard/pecas-defeituosas")}
                  >
                    ♻️ Defeituosas
                  </NavLink>
                )}

                {isAdminLike && (
                  <NavLink
                    to="/gerenciar-carrinhos"
                    active={isActive("/gerenciar-carrinhos")}
                  >
                    🛒 Carrinhos
                  </NavLink>
                )}

                {usuario?.role === "ADMIN" && (
                  <NavLink to="/relatorios" active={isActive("/relatorios")}>
                    📄 Relatórios
                  </NavLink>
                )}

                {usuario?.role === "ADMIN" && (
                  <NavLink to="/fluxo-caixa" active={isActive("/fluxo-caixa")}>
                    💰 Fluxo de Caixa
                  </NavLink>
                )}

                {isAdminLike && (
                  <NavLink to="/usuarios" active={isActive("/usuarios")}>
                    👥 Usuários
                  </NavLink>
                )}
              </div>
            </div>
          </div>

          {/* User Info e Logout */}
          <div className="flex items-center space-x-2 sm:space-x-3 shrink-0 pr-1 sm:pr-2 min-w-0">
            <button
              onClick={toggleMenu}
              className={`${useCompactMenu ? "" : "xl:hidden"} p-2 rounded-lg hover:bg-white/10 transition-colors`}
            >
              {isMenuOpen ? <CloseIcon /> : <MenuIcon />}
            </button>

            <div className="hidden xl:block text-right bg-white/5 px-3 py-2 rounded-lg border border-white/10 max-w-55">
              <div className="text-sm font-semibold text-white truncate">
                {usuario?.nome || "Usuário"}
              </div>
              <div className="text-xs text-accent-cream flex items-center justify-end gap-1 truncate">
                {usuario?.role === "ADMIN"
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
                            : "👤 Funcionário Abastecedor"}
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="bg-linear-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 px-2.5 sm:px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center gap-1.5 whitespace-nowrap"
            >
              <LogoutIcon />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>
      </div>

      {/* Menu Mobile Dropdown */}
      {isMenuOpen && (
        <div
          className={`${useCompactMenu ? "" : "xl:hidden"} bg-gray-900 border-t border-white/10 animate-fade-in-down`}
        >
          <div className="px-4 py-3 space-y-2">
            <MobileNavLink to="/" active={isActive("/")} onClick={closeMenu}>
              📊 Dashboard
            </MobileNavLink>
            <MobileNavLink
              to="/roteiros"
              active={isActive("/roteiros")}
              onClick={closeMenu}
            >
              🗺️ Roteiros
            </MobileNavLink>
            {!isFuncionario && usuario?.role !== "CONTROLADOR_ESTOQUE" && (
              <MobileNavLink
                to="/maquinas"
                active={isActive("/maquinas")}
                onClick={closeMenu}
              >
                🎮 Máquinas
              </MobileNavLink>
            )}
            {!isPerfilFuncionario && (
              <MobileNavLink
                to="/lojas"
                active={isActive("/lojas")}
                onClick={closeMenu}
              >
                🏪 Pontos
              </MobileNavLink>
            )}
            <MobileNavLink
              to="/estoque-usuarios"
              active={isActive("/estoque-usuarios")}
              onClick={closeMenu}
            >
              📦 Meu Estoque
            </MobileNavLink>
            {(usuario?.role === "ADMIN" ||
              usuario?.role === "FUNCIONARIO" ||
              usuario?.role === "FUNCIONARIO_TODAS_LOJAS" ||
              usuario?.role === "ABASTECEDOR" ||
              usuario?.role === "CONTROLADOR_ESTOQUE" ||
              usuario?.role === "MANUTENCAO" ||
              usuario?.role === "GERENCIADOR") && (
              <MobileNavLink
                to="/pecas"
                active={isActive("/pecas")}
                onClick={closeMenu}
              >
                🛠️ Peças
              </MobileNavLink>
            )}
            {(usuario?.role === "FUNCIONARIO" ||
              usuario?.role === "FUNCIONARIO_TODAS_LOJAS" ||
              usuario?.role === "ABASTECEDOR") && (
              <MobileNavLink
                to="/dashboard/pecas-defeituosas"
                active={isActive("/dashboard/pecas-defeituosas")}
                onClick={closeMenu}
              >
                ♻️ Defeituosas
              </MobileNavLink>
            )}
            {isAdminLike && (
              <MobileNavLink
                to="/gerenciar-carrinhos"
                active={isActive("/gerenciar-carrinhos")}
                onClick={closeMenu}
              >
                🛒 Carrinhos
              </MobileNavLink>
            )}
            {usuario?.role === "ADMIN" && (
              <MobileNavLink
                to="/relatorios"
                active={isActive("/relatorios")}
                onClick={closeMenu}
              >
                📄 Relatórios
              </MobileNavLink>
            )}
            {usuario?.role === "ADMIN" && (
              <MobileNavLink
                to="/fluxo-caixa"
                active={isActive("/fluxo-caixa")}
                onClick={closeMenu}
              >
                💰 Fluxo de Caixa
              </MobileNavLink>
            )}
            {/* ... Repetir para outros links ... */}
            {isAdminLike && (
              <MobileNavLink
                to="/usuarios"
                active={isActive("/usuarios")}
                onClick={closeMenu}
              >
                👥 Usuários
              </MobileNavLink>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}

// Sub-componentes para manter o código limpo
const NavLink = ({ to, active, children }) => (
  <Link
    to={to}
    className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 ${
      active
        ? "bg-linear-to-r from-primary to-accent-yellow text-white shadow-lg scale-105"
        : "text-gray-300 hover:bg-white/10 hover:text-white"
    }`}
  >
    {children}
  </Link>
);

const MobileNavLink = ({ to, active, onClick, children }) => (
  <Link
    to={to}
    onClick={onClick}
    className={`block px-3 py-2 rounded-lg text-sm font-medium ${
      active
        ? "bg-linear-to-r from-primary to-accent-yellow text-white"
        : "text-gray-300 hover:bg-white/10"
    }`}
  >
    {children}
  </Link>
);

// Ícones simples
const MenuIcon = () => (
  <svg
    className="w-6 h-6"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 6h16M4 12h16M4 18h16"
    />
  </svg>
);
const CloseIcon = () => (
  <svg
    className="w-6 h-6"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M6 18L18 6M6 6l12 12"
    />
  </svg>
);
const LogoutIcon = () => (
  <svg
    className="w-4 h-4"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
    />
  </svg>
);

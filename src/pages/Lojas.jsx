import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer.jsx";
import {
  PageHeader,
  DataTable,
  AlertBox,
  ConfirmDialog,
  Badge,
} from "../components/UIComponents";
import { PageLoader } from "../components/Loading";
import { useAuth } from "../contexts/AuthContext.jsx";

export function Lojas() {
  const { usuario } = useAuth();
  const [lojas, setLojas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filtroNome, setFiltroNome] = useState("");
  const [deleteDialog, setDeleteDialog] = useState({
    open: false,
    lojaId: null,
  });

  useEffect(() => {
    carregarLojas();
  }, []);

  const carregarLojas = async () => {
    try {
      setLoading(true);
      const response = await api.get("/lojas");
      setLojas(response.data);
      setError("");
    } catch (error) {
      setError(
        "Erro ao carregar lojas: " +
          (error.response?.data?.error || error.message),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/lojas/${id}`);
      setLojas(lojas.filter((loja) => loja.id !== id));
      setDeleteDialog({ open: false, lojaId: null });
      setError("");
    } catch (error) {
      setDeleteDialog({ open: false, lojaId: null });
      setError(
        "Erro ao excluir loja: " +
          (error.response?.data?.error || error.message),
      );
    }
  };

  const termoBusca = filtroNome.trim().toLowerCase();

  // IDs permitidos para o controlador de estoque
  let idsPermitidos = [];
  if (usuario?.role === "CONTROLADOR_ESTOQUE") {
    // Tente pegar do campo lojasPermitidas (array de ids) ou permissoesLojas (array de objetos)
    if (Array.isArray(usuario.lojasPermitidas) && usuario.lojasPermitidas.length > 0) {
      idsPermitidos = usuario.lojasPermitidas;
    } else if (Array.isArray(usuario.permissoesLojas) && usuario.permissoesLojas.length > 0) {
      idsPermitidos = usuario.permissoesLojas.map((p) => p.lojaId || p.id);
    }
  }

  const lojasFiltradas = lojas.filter((loja) => {
    // Se for controlador, só mostra as permitidas
    if (usuario?.role === "CONTROLADOR_ESTOQUE" && idsPermitidos.length > 0) {
      if (!idsPermitidos.includes(loja.id)) return false;
    }
    return termoBusca ? loja.nome?.toLowerCase().includes(termoBusca) : true;
  });

  const headers = [
    {
      label: "Nome",
      key: "nome",
      icon: (
        <svg
          className="w-4 h-4 text-primary"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z"
            clipRule="evenodd"
          />
        </svg>
      ),
      render: (loja) => (
        <Link
            to={`/lojas/${loja.id}`}>
        <div className="flex items-center gap-2">
          {loja.isDepositoPrincipal && (
            <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs font-semibold" title="Depósito Principal">
              🏭
            </span>
          )}
          <span className="font-medium text-gray-900">{loja.nome}</span>
        </div>
        </Link>
      ),
    },
    {
      label: "Status",
      key: "ativo",
      render: (loja) => (
        <Badge variant={loja.ativo ? "success" : "danger"}>
          {loja.ativo ? "Ativa" : "Inativa"}
        </Badge>
      ),
    },
    {
      label: "Máquinas",
      key: "maquinas",
      render: (loja) => (
        <span className="font-semibold text-gray-700">
          {loja.maquinas?.length || 0} máquina(s)
        </span>
      ),
    },
    {
      label: "Ações",
      key: "acoes",
      render: (loja) => (
        <div className="flex gap-2">
          <Link
            to={`/lojas/${loja.id}`}
            className="text-green-600 hover:text-green-800 font-medium flex items-center gap-1"
          >
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
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
              />
            </svg>
            Ver
          </Link>
          {usuario?.role === "ADMIN" && (
            <>
              <Link
                to={`/lojas/${loja.id}/editar`}
                className="text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
              >
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
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
                Editar
              </Link>
              <button
                onClick={() => setDeleteDialog({ open: true, lojaId: loja.id })}
                className="text-red-600 hover:text-red-800 font-medium flex items-center gap-1"
              >
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
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
                Excluir
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  if (loading) return <PageLoader />;

  return (
    <div className="min-h-screen bg-linear-to-br from-[#62A1D9] via-[#A6806A] to-[#24094E] text-[#24094E]">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title="Pontos"
          subtitle="Gerencie os pontos do sistema"
          icon="🏪"
          action={
            usuario?.role === "ADMIN" ? (
              <Link
                to="/lojas/nova"
                className="btn-primary flex items-center gap-2"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                  />
                </svg>
                Nova Loja
              </Link>
            ) : undefined
          }
        />

        {error && (
          <AlertBox type="error" message={error} onClose={() => setError("")} />
        )}

        <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="card bg-linear-to-br from-purple-500 to-purple-600 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-90">Total de Lojas</p>
                <p className="text-3xl font-bold">{lojas.length}</p>
              </div>
              <svg
                className="w-12 h-12 opacity-80"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          </div>

          <div className="card bg-linear-to-br from-green-500 to-green-600 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-90">Lojas Ativas</p>
                <p className="text-3xl font-bold">
                  {lojas.filter((l) => l.ativo).length}
                </p>
              </div>
              <svg
                className="w-12 h-12 opacity-80"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          </div>

          <div className="card bg-linear-to-br from-blue-500 to-blue-600 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-90">Total de Máquinas</p>
                <p className="text-3xl font-bold">
                  {lojas.reduce(
                    (acc, loja) => acc + (loja.maquinas?.length || 0),
                    0,
                  )}
                </p>
              </div>
              <svg
                className="w-12 h-12 opacity-80"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="card mb-6">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Buscar loja por nome
          </label>
          <input
            type="text"
            value={filtroNome}
            onChange={(e) => setFiltroNome(e.target.value)}
            placeholder="Digite o nome do ponto"
            className="input-field"
          />
        </div>

        <DataTable
          headers={headers}
          data={lojasFiltradas}
          emptyMessage={
            filtroNome
              ? "Nenhum ponto encontrado para o nome pesquisado."
              : "Nenhum ponto cadastrado. Clique em 'Novo Ponto' para começar."
          }
        />
      </div>

      <ConfirmDialog
        isOpen={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, lojaId: null })}
        onConfirm={() => handleDelete(deleteDialog.lojaId)}
        title="Excluir Ponto"
        message="Tem certeza que deseja excluir este ponto? Esta ação não pode ser desfeita e todas as máquinas associadas também serão removidas."
        confirmText="Sim, excluir"
        cancelText="Cancelar"
        type="danger"
      />

      <Footer />
    </div>
  );
}

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import api from "../services/api";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer.jsx";
import {
  PageHeader,
  StatsGrid,
  DataTable,
  Badge,
  ConfirmDialog,
  AlertBox,
} from "../components/UIComponents";
import { EmptyState } from "../components/Loading";
import { useFilteredList } from "../hooks/useFilteredList";
import { ListFilterBar, FilterField } from "../components/ListFilterBar";
import { PaginationControls } from "../components/PaginationControls";

export function Maquinas() {
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const [lojas, setLojas] = useState([]);
  const [deleteId, setDeleteId] = useState(null);
  const [maquinaParaDeletar, setMaquinaParaDeletar] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const listaMaquinas = useFilteredList({
    fetcher: (filtros, paginacao) =>
      api.get("/maquinas", {
        params: {
          lojaId: filtros.lojaId || undefined,
          busca: filtros.busca || undefined,
          incluirInativas: filtros.incluirInativas || undefined,
          ...paginacao,
        },
      }),
    initialFilters: { lojaId: "", busca: "", incluirInativas: "" },
    pageSize: 20,
  });

  useEffect(() => {
    api
      .get("/lojas", { params: { all: true } })
      .then((res) => setLojas(res.data || []))
      .catch((err) =>
        console.error("Erro ao carregar lojas para filtro:", err),
      );
  }, []);

  const handleDelete = async () => {
    try {
      const response = await api.delete(`/maquinas/${deleteId}`);

      // Verificar se foi soft delete ou hard delete
      if (response.data.permanentDelete) {
        setSuccess("✅ Máquina excluída permanentemente com sucesso!");
      } else {
        setSuccess(
          "⚠️ Máquina desativada! Clique novamente em excluir para deletar permanentemente.",
        );
      }

      if (listaMaquinas.hasSearched) {
        listaMaquinas.goToPage(listaMaquinas.pagination.page);
      }
      setDeleteId(null);
      setMaquinaParaDeletar(null);
    } catch (error) {
      setError(
        "Erro ao excluir máquina: " +
          (error.response?.data?.error || error.message),
      );
      setDeleteId(null);
      setMaquinaParaDeletar(null);
    }
  };

  const handleAbrirDialogDeletar = (maquina) => {
    setDeleteId(maquina.id);
    setMaquinaParaDeletar(maquina);
  };

  const maquinasFiltradas = listaMaquinas.data;

  const stats = [
    {
      label: "Total de Máquinas",
      value: listaMaquinas.pagination.total,
      icon: "🎰",
      gradient: "bg-gradient-to-br from-purple-500 to-purple-600",
    },
    {
      label: "Máquinas Ativas",
      value: maquinasFiltradas.filter((m) => m.ativo).length,
      icon: "✅",
      gradient: "bg-gradient-to-br from-green-500 to-green-600",
      subtitle: "nesta página",
    },
    {
      label: "Capacidade Total",
      value: maquinasFiltradas.reduce(
        (sum, m) => sum + (m.capacidadePadrao || 0),
        0,
      ),
      icon: "📦",
      gradient: "bg-gradient-to-br from-blue-500 to-blue-600",
      subtitle: "nesta página",
    },
    {
      label: "Valor Médio Ficha",
      value:
        maquinasFiltradas.length > 0
          ? `R$ ${(
              maquinasFiltradas.reduce(
                (sum, m) => sum + (m.valorFicha || 0),
                0,
              ) / maquinasFiltradas.length
            ).toFixed(2)}`
          : "R$ 0,00",
      icon: "💰",
      gradient: "bg-gradient-to-br from-yellow-500 to-yellow-600",
      subtitle: "nesta página",
    },
  ];

  const columns = [
    {
      key: "codigo",
      label: "Código",
      render: (maquina) => {
        const codigo = String(maquina?.codigo || "").trim() || "-";
        const modelo = String(maquina?.modelo || "").trim();
        return modelo ? `${codigo} - ${modelo}` : codigo;
      },
    },
    {
      key: "tipo",
      label: "Tipo",
      render: (maquina) => {
        return maquina.tipo || "-";
      },
    },
    {
      key: "acoes",
      label: "Ações",
      render: (maquina) => (
        <div className="flex gap-2">
          <button
            onClick={() => navigate(`/maquinas/${maquina.id}/editar`)}
            className="text-blue-600 hover:text-blue-800 font-semibold"
            title="Editar"
          >
            ✏️
          </button>
          <button
            onClick={() => handleAbrirDialogDeletar(maquina)}
            className={`font-semibold ${
              maquina.ativo
                ? "text-orange-600 hover:text-orange-800"
                : "text-red-600 hover:text-red-800"
            }`}
            title={maquina.ativo ? "Desativar" : "Excluir Permanentemente"}
          >
            {maquina.ativo ? "⚠️" : "🗑️"}
          </button>
        </div>
      ),
    },
    {
      key: "loja",
      label: "Ponto",
      render: (maquina) => {
        const loja =
          maquina.loja || lojas.find((l) => l.id === maquina.lojaId);
        return loja ? loja.nome : `N/A (ID: ${maquina.lojaId})`;
      },
    },
    {
      key: "capacidadePadrao",
      label: "Capacidade",
      render: (maquina) => maquina.capacidadePadrao || 0,
    },
    {
      key: "valorFicha",
      label: "Valor Ficha",
      render: (maquina) => {
        const valor = parseFloat(maquina.valorFicha);
        return !isNaN(valor) && valor > 0 ? `R$ ${valor.toFixed(2)}` : "-";
      },
    },
    {
      key: "comissaoLojaPercentual",
      label: "Comissão Ponto",
      render: (maquina) => {
        const percentual = parseFloat(maquina.comissaoLojaPercentual);
        return !isNaN(percentual) ? `${percentual.toFixed(2)}%` : "-";
      },
    },
    {
      key: "ativo",
      label: "Status",
      render: (maquina) => (
        <Badge variant={maquina.ativo ? "success" : "danger"}>
          {maquina.ativo ? "Ativa" : "Inativa"}
        </Badge>
      ),
    },
    
  ];

  return (
    <div className="min-h-screen bg-background-light bg-pattern teddy-pattern">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title="Máquinas"
          subtitle="Gerencie as máquinas de pelúcia dos pontos"
          icon="🎰"
          action={
            usuario?.role === "ADMIN"
              ? {
                  label: "Nova Máquina",
                  onClick: () => navigate("/maquinas/nova"),
                }
              : undefined
          }
        />

        {error && (
          <AlertBox type="error" message={error} onClose={() => setError("")} />
        )}
        {success && (
          <AlertBox
            type="success"
            message={success}
            onClose={() => setSuccess("")}
          />
        )}

        {listaMaquinas.hasSearched && <StatsGrid stats={stats} />}

        <ListFilterBar
          onSearch={listaMaquinas.search}
          onReset={listaMaquinas.resetFilters}
          loading={listaMaquinas.loading}
        >
          <FilterField label="Ponto">
            <select
              className="input-field"
              value={listaMaquinas.filters.lojaId}
              onChange={(e) =>
                listaMaquinas.setFilter("lojaId", e.target.value)
              }
            >
              <option value="">Todos os pontos</option>
              {lojas.map((loja) => (
                <option key={loja.id} value={loja.id}>
                  {loja.nome}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Buscar máquina">
            <input
              type="text"
              value={listaMaquinas.filters.busca}
              onChange={(e) => listaMaquinas.setFilter("busca", e.target.value)}
              placeholder="Digite nome ou código"
              className="input-field"
            />
          </FilterField>
          <FilterField label="Status">
            <label className="flex items-center gap-2 cursor-pointer h-10.5">
              <input
                type="checkbox"
                checked={listaMaquinas.filters.incluirInativas === "true"}
                onChange={(e) =>
                  listaMaquinas.setFilter(
                    "incluirInativas",
                    e.target.checked ? "true" : "",
                  )
                }
                className="w-5 h-5 text-primary rounded focus:ring-2 focus:ring-primary"
              />
              <span className="text-sm font-semibold text-gray-700">
                Incluir inativas
              </span>
            </label>
          </FilterField>
        </ListFilterBar>

        <div className="card-gradient">
          {!listaMaquinas.hasSearched ? (
            <EmptyState
              icon="🔍"
              title="Use os filtros para buscar"
              message="Escolha um ponto e/ou busque por nome/código e clique em Buscar para ver as máquinas cadastradas."
            />
          ) : maquinasFiltradas.length > 0 ? (
            <>
              <DataTable headers={columns} data={maquinasFiltradas} />
              <PaginationControls
                pagination={listaMaquinas.pagination}
                onPageChange={listaMaquinas.goToPage}
                loading={listaMaquinas.loading}
              />
            </>
          ) : (
            <EmptyState
              icon="🎰"
              title="Nenhuma máquina encontrada"
              message="Nenhuma máquina corresponde aos filtros informados."
              action={{
                label: "Nova Máquina",
                onClick: () => navigate("/maquinas/nova"),
              }}
            />
          )}
        </div>
      </div>

      <Footer />

      <ConfirmDialog
        isOpen={deleteId !== null}
        onClose={() => {
          setDeleteId(null);
          setMaquinaParaDeletar(null);
        }}
        onConfirm={handleDelete}
        title={
          maquinaParaDeletar?.ativo
            ? "Desativar Máquina"
            : "Excluir Permanentemente"
        }
        message={
          maquinaParaDeletar?.ativo
            ? "🛡️ A máquina será DESATIVADA e não aparecerá mais nas listagens ativas. Os dados serão preservados e você poderá reativá-la editando-a. Para excluir permanentemente, clique em excluir novamente."
            : "⚠️ ATENÇÃO: Esta ação é PERMANENTE e IRREVERSÍVEL! A máquina e todo seu histórico serão deletados do banco de dados. Tem certeza absoluta?"
        }
      />
    </div>
  );
}

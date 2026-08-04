import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
import { useAuth } from "../contexts/AuthContext.jsx";
import { useFilteredList } from "../hooks/useFilteredList";
import { ListFilterBar, FilterField } from "../components/ListFilterBar";
import { PaginationControls } from "../components/PaginationControls";

export function Produtos() {
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const [deleteId, setDeleteId] = useState(null);
  const [produtoParaDeletar, setProdutoParaDeletar] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  // Lista completa só para popular o filtro de categoria e as métricas do
  // topo (produtos é um catálogo pequeno, não a tabela navegável em si)
  const [todosProdutos, setTodosProdutos] = useState([]);

  const listaProdutos = useFilteredList({
    fetcher: (filtros, paginacao) =>
      api.get("/produtos", {
        params: {
          categoria: filtros.categoria || undefined,
          incluirInativos: filtros.incluirInativos || undefined,
          ...paginacao,
        },
      }),
    initialFilters: { categoria: "", incluirInativos: "" },
    pageSize: 20,
  });

  const carregarTodosProdutos = async () => {
    try {
      const response = await api.get("/produtos", {
        params: { incluirInativos: "true", all: true },
      });
      setTodosProdutos(response.data || []);
    } catch (error) {
      console.error("Erro ao carregar métricas de produtos:", error);
    }
  };

  useEffect(() => {
    carregarTodosProdutos();
  }, []);

  const handleDelete = async () => {
    try {
      const response = await api.delete(`/produtos/${deleteId}`);

      // Verificar se foi soft delete ou hard delete
      if (response.data.permanentDelete) {
        setSuccess("✅ Produto excluído permanentemente com sucesso!");
      } else {
        setSuccess(
          "⚠️ Produto desativado! Clique novamente em excluir para deletar permanentemente.",
        );
      }

      carregarTodosProdutos();
      if (listaProdutos.hasSearched) {
        listaProdutos.goToPage(listaProdutos.pagination.page);
      }
      setDeleteId(null);
      setProdutoParaDeletar(null);
    } catch (error) {
      setError(
        "Erro ao excluir produto: " +
          (error.response?.data?.error || error.message),
      );
      setDeleteId(null);
      setProdutoParaDeletar(null);
    }
  };

  const handleAbrirDialogDeletar = (produto) => {
    setDeleteId(produto.id);
    setProdutoParaDeletar(produto);
  };

  const categorias = [
    ...new Set(todosProdutos.map((p) => p.categoria).filter(Boolean)),
  ];
  const produtosFiltrados = listaProdutos.data;

  const stats = [
    {
      label: "Total de Produtos",
      value: todosProdutos.length,
      icon: "🧸",
      gradient: "bg-gradient-to-br from-pink-500 to-pink-600",
    },
    {
      label: "Produtos Ativos",
      value: todosProdutos.filter((p) => p.ativo).length,
      icon: "✅",
      gradient: "bg-gradient-to-br from-green-500 to-green-600",
    },
    {
      label: "Categorias",
      value: categorias.length,
      icon: "📁",
      gradient: "bg-gradient-to-br from-blue-500 to-blue-600",
    },
  ];

  // Abastecedor não deve ver valores/preços na tela de produtos.
  if (usuario?.role !== "ABASTECEDOR") {
    stats.push({
      label: "Valor Médio",
      value:
        todosProdutos.length > 0
          ? `R$ ${(
              todosProdutos.reduce((sum, p) => sum + Number(p.preco || 0), 0) /
              todosProdutos.length
            ).toFixed(2)}`
          : "R$ 0,00",
      icon: "💰",
      gradient: "bg-gradient-to-br from-yellow-500 to-yellow-600",
    });
  }

  const columns = [
    {
      key: "imagem",
      label: "",
      render: (produto) => (
        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center text-2xl">
          {produto.emoji || "🧸"}
        </div>
      ),
    },
    { key: "codigo", label: "Código" },
    { key: "nome", label: "Nome" },
    { key: "categoria", label: "Categoria" },
    {
      key: "preco",
      label: "Preço",
      render: (produto) => (
        <span className="font-semibold text-green-600">
          R$ {Number(produto.preco || 0).toFixed(2)}
        </span>
      ),
    },
    {
      key: "jogadas_2_50",
      label: "💰 Jogadas R$ 2,50",
      render: (produto) => {
        const preco = Number(produto.preco || 0);
        const jogadas = Math.ceil(preco / 2.5);
        return (
          <div className="text-center">
            <span className="font-bold text-green-600 text-lg">{jogadas}</span>
            <span className="text-xs text-gray-500 block">
              {jogadas === 1 ? "jogada" : "jogadas"}
            </span>
          </div>
        );
      },
    },
    {
      key: "jogadas_5_00",
      label: "💎 Jogadas R$ 5,00",
      render: (produto) => {
        const preco = Number(produto.preco || 0);
        const jogadas = Math.ceil(preco / 5);
        return (
          <div className="text-center">
            <span className="font-bold text-blue-600 text-lg">{jogadas}</span>
            <span className="text-xs text-gray-500 block">
              {jogadas === 1 ? "jogada" : "jogadas"}
            </span>
          </div>
        );
      },
    },
    {
      key: "estoque",
      label: "Estoque",
      render: (produto) => {
        const estoque = produto.estoqueAtual || 0;
        const cor =
          estoque < 10 ? "error" : estoque < 30 ? "warning" : "success";
        return <Badge type={cor}>{estoque}</Badge>;
      },
    },
    {
      key: "ativo",
      label: "Status",
      render: (produto) => (
        <Badge variant={produto.ativo ? "success" : "danger"}>
          {produto.ativo ? "Ativo" : "Inativo"}
        </Badge>
      ),
    },
    {
      key: "acoes",
      label: "Ações",
      render: (produto) => (
        <div className="flex gap-2">
          {usuario?.role === "ADMIN" && (
            <>
              <button
                onClick={() => navigate(`/produtos/${produto.id}/editar`)}
                className="text-blue-600 hover:text-blue-800 font-semibold"
                title="Editar"
              >
                ✏️
              </button>
              <button
                onClick={() => handleAbrirDialogDeletar(produto)}
                className="text-red-600 hover:text-red-800 font-semibold"
                title="Excluir"
              >
                {produto.ativo ? "⚠️" : "🗑️"}
              </button>
            </>
          )}
          {usuario?.role !== "ADMIN" && (
            <span className="text-gray-400 text-sm">Somente visualização</span>
          )}
        </div>
      ),
    },
  ];

  // Abastecedor não deve ver preço, jogadas nem estoque na tabela de produtos.
  const colunasOcultasParaAbastecedor = new Set([
    "preco",
    "jogadas_2_50",
    "jogadas_5_00",
    "estoque",
  ]);
  const colunasVisiveis =
    usuario?.role === "ABASTECEDOR"
      ? columns.filter((coluna) => !colunasOcultasParaAbastecedor.has(coluna.key))
      : columns;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#62A1D9] via-[#A6806A] to-[#24094E] text-[#24094E]">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title="Produtos"
          subtitle="Gerencie os produtos (pelúcias) disponíveis no sistema"
          icon="🧸"
          action={
            usuario?.role === "ADMIN"
              ? {
                  label: "Novo Produto",
                  onClick: () => navigate("/produtos/novo"),
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

        <StatsGrid stats={stats} />

        <ListFilterBar
          onSearch={listaProdutos.search}
          onReset={listaProdutos.resetFilters}
          loading={listaProdutos.loading}
        >
          {categorias.length > 0 && (
            <FilterField label="Categoria">
              <select
                value={listaProdutos.filters.categoria}
                onChange={(e) =>
                  listaProdutos.setFilter("categoria", e.target.value)
                }
                className="select-field"
              >
                <option value="">Todas as Categorias</option>
                {categorias.map((categoria) => (
                  <option key={categoria} value={categoria}>
                    {categoria}
                  </option>
                ))}
              </select>
            </FilterField>
          )}
          <FilterField label="Status">
            <label className="flex items-center gap-2 cursor-pointer bg-gray-50 px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-100 transition-colors h-10.5">
              <input
                type="checkbox"
                checked={listaProdutos.filters.incluirInativos === "true"}
                onChange={(e) =>
                  listaProdutos.setFilter(
                    "incluirInativos",
                    e.target.checked ? "true" : "",
                  )
                }
                className="w-4 h-4 text-primary focus:ring-primary"
              />
              <span className="text-sm font-medium text-gray-700">
                Mostrar produtos inativos
              </span>
            </label>
          </FilterField>
        </ListFilterBar>

        <div className="card-gradient">
          {!listaProdutos.hasSearched ? (
            <EmptyState
              icon="🔍"
              title="Use os filtros para buscar"
              message="Escolha uma categoria e/ou clique em Buscar para ver os produtos cadastrados."
            />
          ) : produtosFiltrados.length > 0 ? (
            <>
              <DataTable headers={colunasVisiveis} data={produtosFiltrados} />
              <PaginationControls
                pagination={listaProdutos.pagination}
                onPageChange={listaProdutos.goToPage}
                loading={listaProdutos.loading}
              />
            </>
          ) : (
            <EmptyState
              icon="🧸"
              title="Nenhum produto encontrado"
              message="Não há produtos cadastrados para os filtros selecionados."
              action={{
                label: "Novo Produto",
                onClick: () => navigate("/produtos/novo"),
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
          setProdutoParaDeletar(null);
        }}
        onConfirm={handleDelete}
        title={
          produtoParaDeletar?.ativo
            ? "Desativar Produto"
            : "Excluir Produto Permanentemente"
        }
        message={
          produtoParaDeletar?.ativo
            ? `Tem certeza que deseja desativar o produto "${produtoParaDeletar?.nome}"? O produto ficará inativo mas não será excluído. Para excluir permanentemente, clique em excluir novamente após desativar.`
            : `⚠️ ATENÇÃO: Esta ação irá EXCLUIR PERMANENTEMENTE o produto "${produtoParaDeletar?.nome}" do sistema. Esta ação NÃO PODE SER DESFEITA!`
        }
      />
    </div>
  );
}

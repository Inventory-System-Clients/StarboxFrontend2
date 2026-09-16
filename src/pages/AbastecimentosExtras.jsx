import { useEffect, useState } from "react";
import Swal from "sweetalert2";
import api from "../services/api";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer.jsx";
import { PageHeader, DataTable, AlertBox, Modal } from "../components/UIComponents";
import { PageLoader, EmptyState } from "../components/Loading";
import { useFilteredList } from "../hooks/useFilteredList";
import { ListFilterBar, FilterField } from "../components/ListFilterBar";
import { PaginationControls } from "../components/PaginationControls";

export function AbastecimentosExtras() {
  const [lojas, setLojas] = useState([]);
  const [loadingLojas, setLoadingLojas] = useState(true);
  const [modalEdicao, setModalEdicao] = useState(null); // abastecimento sendo editado
  const [quantidadeEdicao, setQuantidadeEdicao] = useState("");
  const [salvando, setSalvando] = useState(false);

  const lista = useFilteredList({
    fetcher: (filtros, paginacao) =>
      api.get("/movimentacoes/abastecimentos-extras", {
        params: {
          lojaId: filtros.lojaId || undefined,
          dataInicio: filtros.dataInicio || undefined,
          dataFim: filtros.dataFim || undefined,
          ...paginacao,
        },
      }),
    initialFilters: { lojaId: "", dataInicio: "", dataFim: "" },
    pageSize: 25,
  });

  useEffect(() => {
    api
      .get("/lojas")
      .then((res) => setLojas(Array.isArray(res.data) ? res.data : res.data?.data || []))
      .catch(() => setLojas([]))
      .finally(() => setLoadingLojas(false));
  }, []);

  const abrirEdicao = (abastecimento) => {
    setModalEdicao(abastecimento);
    setQuantidadeEdicao(String(abastecimento.quantidade));
  };

  const fecharEdicao = () => {
    setModalEdicao(null);
    setQuantidadeEdicao("");
  };

  const salvarEdicao = async () => {
    const quantidadeNova = parseInt(quantidadeEdicao, 10);
    if (!Number.isInteger(quantidadeNova) || quantidadeNova <= 0) {
      Swal.fire("Erro", "Informe uma quantidade válida (maior que zero).", "error");
      return;
    }

    setSalvando(true);
    try {
      await api.put(`/movimentacoes/abastecimentos-extras/${modalEdicao.id}`, {
        quantidade: quantidadeNova,
      });
      Swal.fire("Sucesso", "Abastecimento corrigido com sucesso!", "success");
      fecharEdicao();
      lista.goToPage(lista.pagination.page);
    } catch (error) {
      Swal.fire(
        "Erro",
        error.response?.data?.error || "Erro ao corrigir abastecimento.",
        "error",
      );
    } finally {
      setSalvando(false);
    }
  };

  const excluir = async (abastecimento) => {
    const confirmacao = await Swal.fire({
      icon: "warning",
      title: "Excluir lançamento",
      text: `Remover este abastecimento de ${abastecimento.quantidade} unidade(s)? A diferença volta pro estoque de origem.`,
      showCancelButton: true,
      confirmButtonText: "Sim, excluir",
      cancelButtonText: "Cancelar",
    });
    if (!confirmacao.isConfirmed) return;

    try {
      await api.delete(`/movimentacoes/abastecimentos-extras/${abastecimento.id}`);
      Swal.fire("Excluído", "Lançamento removido com sucesso.", "success");
      lista.goToPage(lista.pagination.page);
    } catch (error) {
      Swal.fire(
        "Erro",
        error.response?.data?.error || "Erro ao excluir lançamento.",
        "error",
      );
    }
  };

  const columns = [
    {
      key: "data",
      label: "Data/Hora",
      render: (item) => {
        const data = new Date(item.createdAt);
        return (
          <div>
            <div className="font-semibold">{data.toLocaleDateString("pt-BR")}</div>
            <div className="text-xs text-gray-500">{data.toLocaleTimeString("pt-BR")}</div>
          </div>
        );
      },
    },
    {
      key: "usuario",
      label: "Usuário",
      render: (item) => (
        <div className="flex items-center gap-1">
          <span className="text-lg">👤</span>
          <span className="text-sm font-medium text-gray-700">
            {item.usuario?.nome || "Não informado"}
          </span>
        </div>
      ),
    },
    {
      key: "maquina",
      label: "Máquina",
      render: (item) => (
        <div>
          <div className="font-semibold">
            {item.maquina?.codigo}
            <span className="text-gray-500 text-xs ml-1">- {item.maquina?.nome}</span>
          </div>
          <div className="text-xs text-gray-500">{item.maquina?.loja?.nome || "N/A"}</div>
        </div>
      ),
    },
    {
      key: "produto",
      label: "Produto",
      render: (item) => item.produto?.nome || "N/A",
    },
    {
      key: "quantidade",
      label: "Quantidade",
      render: (item) => (
        <span className="font-bold text-green-600">+{item.quantidade}</span>
      ),
    },
    {
      key: "origem",
      label: "Origem do Estoque",
      render: (item) => (item.origemEstoque === "usuario" ? "Estoque próprio" : "Estoque da loja"),
    },
    {
      key: "acoes",
      label: "Ações",
      render: (item) => (
        <div className="flex gap-2">
          <button
            onClick={() => abrirEdicao(item)}
            className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-lg transition-colors"
            title="Corrigir quantidade"
          >
            Editar
          </button>
          <button
            onClick={() => excluir(item)}
            className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white text-sm rounded-lg transition-colors"
            title="Excluir lançamento"
          >
            Excluir
          </button>
        </div>
      ),
    },
  ];

  if (loadingLojas) return <PageLoader />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#62A1D9] via-[#A6806A] to-[#24094E] text-[#24094E]">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title="Abastecimentos Extras"
          subtitle="Busque e corrija lançamentos individuais de abastecimento (ex.: quantidade digitada errada por um abastecedor)"
          icon="📦"
        />

        <ListFilterBar
          onSearch={lista.search}
          onReset={lista.resetFilters}
          loading={lista.loading}
        >
          <FilterField label="🏪 Ponto">
            <select
              value={lista.filters.lojaId}
              onChange={(e) => lista.setFilter("lojaId", e.target.value)}
              className="input-field"
            >
              <option value="">Todos os pontos</option>
              {lojas.map((loja) => (
                <option key={loja.id} value={loja.id}>
                  {loja.nome}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField label="De">
            <input
              type="date"
              className="input-field"
              value={lista.filters.dataInicio}
              onChange={(e) => lista.setFilter("dataInicio", e.target.value)}
            />
          </FilterField>
          <FilterField label="Até">
            <input
              type="date"
              className="input-field"
              value={lista.filters.dataFim}
              onChange={(e) => lista.setFilter("dataFim", e.target.value)}
            />
          </FilterField>
        </ListFilterBar>

        {lista.error && <AlertBox type="error" message={lista.error} />}

        {!lista.hasSearched ? (
          <EmptyState
            icon="🔍"
            title="Faça uma busca"
            description="Escolha um ponto e/ou período e clique em Buscar para ver os lançamentos."
          />
        ) : lista.data.length > 0 ? (
          <>
            <DataTable headers={columns} data={lista.data} />
            <PaginationControls
              pagination={lista.pagination}
              onPageChange={lista.goToPage}
              loading={lista.loading}
            />
          </>
        ) : (
          <EmptyState
            icon="📭"
            title="Nada encontrado"
            description="Nenhum abastecimento extra bate com esse filtro."
          />
        )}
      </div>

      <Modal
        isOpen={!!modalEdicao}
        onClose={fecharEdicao}
        title="Corrigir abastecimento"
        size="sm"
      >
        {modalEdicao && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              {modalEdicao.produto?.nome} · Máquina {modalEdicao.maquina?.codigo} ·{" "}
              {modalEdicao.usuario?.nome} ·{" "}
              {new Date(modalEdicao.createdAt).toLocaleString("pt-BR")}
            </p>
            <div>
              <label className="text-sm font-medium text-gray-600 block mb-1">
                Quantidade correta
              </label>
              <input
                type="number"
                min="1"
                className="input-field w-full"
                value={quantidadeEdicao}
                onChange={(e) => setQuantidadeEdicao(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={fecharEdicao}
                disabled={salvando}
                className="btn-secondary"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={salvarEdicao}
                disabled={salvando}
                className="btn-primary"
              >
                {salvando ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Footer />
    </div>
  );
}

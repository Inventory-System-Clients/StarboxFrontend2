import { useCallback, useState } from "react";

/**
 * Estado + busca para listagens paginadas do backend (endpoints que retornam
 * { data, pagination }). Não busca nada sozinho: a tabela só é preenchida
 * quando o consumidor chama `search()` (ex.: clique em "Buscar"), para não
 * carregar a base inteira ao simplesmente abrir a página.
 */
export function useFilteredList({ fetcher, initialFilters = {}, pageSize = 20 }) {
  const [filters, setFilters] = useState(initialFilters);
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);

  const buscar = useCallback(
    async (opts = {}) => {
      const page = opts.page ?? 1;
      const pageSizeAtual = opts.pageSize ?? pagination.pageSize;
      const filtrosAtuais = opts.filters ?? filters;

      setLoading(true);
      setError("");
      try {
        const response = await fetcher(filtrosAtuais, {
          page,
          pageSize: pageSizeAtual,
        });
        const envelope = response?.data || {};
        setData(Array.isArray(envelope.data) ? envelope.data : []);
        setPagination(
          envelope.pagination || {
            page,
            pageSize: pageSizeAtual,
            total: 0,
            totalPages: 1,
          },
        );
      } catch (err) {
        setError(
          err?.response?.data?.error || "Erro ao buscar dados. Tente novamente.",
        );
        setData([]);
      } finally {
        setHasSearched(true);
        setLoading(false);
      }
    },
    [fetcher, filters, pagination.pageSize],
  );

  const setFilter = (chave, valor) => {
    setFilters((prev) => ({ ...prev, [chave]: valor }));
  };

  const resetFilters = () => {
    setFilters(initialFilters);
  };

  const search = () => buscar({ page: 1 });

  const goToPage = (page) => buscar({ page });

  return {
    data,
    pagination,
    loading,
    error,
    filters,
    setFilter,
    setFilters,
    search,
    resetFilters,
    goToPage,
    hasSearched,
  };
}

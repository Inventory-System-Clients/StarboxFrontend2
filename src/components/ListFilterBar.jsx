/**
 * Casca de filtro reutilizável para páginas de listagem: os campos de filtro
 * específicos de cada página entram como children, e o componente cuida só
 * do botão de busca/limpar e do estado de carregamento.
 */
export function ListFilterBar({
  children,
  onSearch,
  onReset,
  loading = false,
  searchLabel = "Buscar",
}) {
  return (
    <div className="card mb-6">
      <div className="flex flex-wrap items-end gap-4">
        {children}
        <div className="flex gap-2 ml-auto">
          {onReset && (
            <button
              type="button"
              onClick={onReset}
              disabled={loading}
              className="btn-secondary"
            >
              Limpar filtros
            </button>
          )}
          <button
            type="button"
            onClick={onSearch}
            disabled={loading}
            className="btn-primary"
          >
            {loading ? "Buscando..." : searchLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function FilterField({ label, children }) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-sm font-medium text-gray-600">{label}</label>
      )}
      {children}
    </div>
  );
}

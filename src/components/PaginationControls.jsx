export function PaginationControls({ pagination, onPageChange, loading = false }) {
  const { page = 1, totalPages = 1, total = 0 } = pagination || {};

  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between gap-4 mt-4 text-sm text-gray-600">
      <span>
        Página {page} de {totalPages} · {total} registro{total === 1 ? "" : "s"}
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          className="btn-secondary"
          disabled={loading || page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Anterior
        </button>
        <button
          type="button"
          className="btn-secondary"
          disabled={loading || page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Próxima
        </button>
      </div>
    </div>
  );
}

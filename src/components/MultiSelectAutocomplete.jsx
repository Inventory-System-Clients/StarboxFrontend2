import { useEffect, useRef, useState } from "react";

// Igual ao AutocompleteSelect, mas permite marcar várias opções (com
// checkbox) em vez de escolher uma só — usado quando faz sentido combinar
// múltiplos itens (ex.: várias lojas num relatório consolidado).
export function MultiSelectAutocomplete({
  selectedIds = [],
  onChange,
  options,
  placeholder = "Digite para buscar...",
  disabled = false,
  emptyLabel = "Nenhum resultado encontrado",
  maxSugestoes = 50,
}) {
  const [texto, setTexto] = useState("");
  const [aberto, setAberto] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickFora = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setAberto(false);
      }
    };
    document.addEventListener("mousedown", handleClickFora);
    return () => document.removeEventListener("mousedown", handleClickFora);
  }, []);

  const termo = texto.trim().toLowerCase();
  const sugestoes = (
    termo
      ? options.filter((o) => o.label.toLowerCase().includes(termo))
      : options
  ).slice(0, maxSugestoes);

  const selecionados = options.filter((o) => selectedIds.includes(o.id));

  const alternar = (id) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((selecionadoId) => selecionadoId !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      {selecionados.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {selecionados.map((opcao) => (
            <span
              key={opcao.id}
              className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs font-semibold px-2 py-1 rounded-full"
            >
              {opcao.label}
              <button
                type="button"
                onClick={() => alternar(opcao.id)}
                className="hover:text-red-600"
                aria-label={`Remover ${opcao.label}`}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        type="text"
        value={texto}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => {
          setTexto(e.target.value);
          setAberto(true);
        }}
        onFocus={() => setAberto(true)}
        className="input-field w-full"
        autoComplete="off"
      />
      {aberto && !disabled && (
        <div className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg">
          {sugestoes.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-500">
              {emptyLabel}
            </div>
          ) : (
            sugestoes.map((opcao) => (
              <label
                key={opcao.id}
                className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-primary/10 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.includes(opcao.id)}
                  onChange={() => alternar(opcao.id)}
                  className="w-4 h-4"
                />
                {opcao.label}
              </label>
            ))
          )}
        </div>
      )}
    </div>
  );
}

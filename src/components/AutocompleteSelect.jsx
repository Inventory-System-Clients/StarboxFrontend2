import { useEffect, useRef, useState } from "react";

// Campo de texto com sugestões que aparecem conforme o usuário digita, no
// lugar de um <select> tradicional — útil quando a lista de opções é longa
// (ex.: pontos, máquinas) e digitar é mais rápido que rolar um dropdown.
export function AutocompleteSelect({
  value,
  onChange,
  options,
  placeholder = "Digite para buscar...",
  disabled = false,
  emptyLabel = "Nenhum resultado encontrado",
  maxSugestoes = 30,
}) {
  const [texto, setTexto] = useState("");
  const [aberto, setAberto] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!value) {
      setTexto("");
      return;
    }
    const selecionado = options.find((o) => String(o.id) === String(value));
    if (selecionado) setTexto(selecionado.label);
  }, [value, options]);

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

  return (
    <div className="relative" ref={containerRef}>
      <input
        type="text"
        value={texto}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => {
          setTexto(e.target.value);
          setAberto(true);
          if (!e.target.value) onChange("");
        }}
        onFocus={() => setAberto(true)}
        className="input-field w-full"
        autoComplete="off"
      />
      {aberto && !disabled && (
        <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg">
          {sugestoes.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-500">
              {emptyLabel}
            </div>
          ) : (
            sugestoes.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  onChange(opt.id);
                  setTexto(opt.label);
                  setAberto(false);
                }}
                className="block w-full text-left px-3 py-2 text-sm hover:bg-primary/10"
              >
                {opt.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

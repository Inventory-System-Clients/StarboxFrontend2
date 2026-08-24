import { createContext, useCallback, useContext, useMemo, useState } from "react";

// Permite que RoteiroExecucaoConteudo (renderizado em /roteiros/:id/executar
// e embutido no Dashboard via PainelFuncionarioTodasLojas/PainelAbastecedor)
// registre o botão "Finalizar Rota"/"Finalizar Veículo" aqui, para a Navbar
// (componente irmão, sem acesso direto ao estado do roteiro) exibi-lo no
// menu, acima do Dashboard. Cada roteiro se registra pela própria chave
// (roteiroId) porque um FUNCIONARIO_TODAS_LOJAS pode ter mais de um roteiro
// montado ao mesmo tempo no Dashboard.
const RoteiroFinalizacaoContext = createContext({
  itensFinalizacao: [],
  registrarFinalizacaoRoteiro: () => {},
});

export function RoteiroFinalizacaoProvider({ children }) {
  const [registros, setRegistros] = useState({});

  const registrarFinalizacaoRoteiro = useCallback((chave, config) => {
    if (!chave) return;

    setRegistros((prev) => {
      if (!config) {
        if (!(chave in prev)) return prev;
        const proximo = { ...prev };
        delete proximo[chave];
        return proximo;
      }

      const atual = prev[chave];
      if (
        atual &&
        atual.label === config.label &&
        atual.onClick === config.onClick
      ) {
        return prev;
      }

      return { ...prev, [chave]: config };
    });
  }, []);

  const itensFinalizacao = useMemo(
    () => Object.entries(registros).map(([chave, config]) => ({ chave, ...config })),
    [registros],
  );

  const value = useMemo(
    () => ({ itensFinalizacao, registrarFinalizacaoRoteiro }),
    [itensFinalizacao, registrarFinalizacaoRoteiro],
  );

  return (
    <RoteiroFinalizacaoContext.Provider value={value}>
      {children}
    </RoteiroFinalizacaoContext.Provider>
  );
}

export function useRoteiroFinalizacao() {
  return useContext(RoteiroFinalizacaoContext);
}

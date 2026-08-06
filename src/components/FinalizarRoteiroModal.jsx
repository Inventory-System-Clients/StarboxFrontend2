import { Modal } from "./UIComponents";

export function FinalizarRoteiroModal({
  aberto,
  etapa,
  loading,
  onClose,
  onAvancar,
  onConfirmar,
  textoEtapa1,
  textoEtapa2,
  labelBotaoFinalizar = "Finalizar Rota",
  mostrarKmVeiculo = false,
  kmFinalVeiculoInput,
  onChangeKmFinalVeiculoInput,
}) {
  return (
    <Modal
      isOpen={aberto}
      onClose={onClose}
      title={etapa === 1 ? "Confirmar finalização" : "Confirmação final"}
      size="sm"
    >
      <div className="space-y-4">
        <p className="text-gray-700">
          {etapa === 1 ? textoEtapa1 : textoEtapa2}
        </p>
        {mostrarKmVeiculo && etapa === 2 && (
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              KM final de devolução do veículo
            </label>
            <input
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Ex: 12380"
              value={kmFinalVeiculoInput}
              onChange={(e) => onChangeKmFinalVeiculoInput(e.target.value)}
              disabled={loading}
            />
            <p className="mt-1 text-xs text-gray-500">
              Campo obrigatório quando o roteiro possui veículo.
            </p>
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button
            className="btn-secondary"
            onClick={onClose}
            disabled={loading}
          >
            Cancelar
          </button>
          {etapa === 1 ? (
            <button className="btn-primary" onClick={onAvancar}>
              Continuar
            </button>
          ) : (
            <button
              className="btn-danger"
              onClick={onConfirmar}
              disabled={loading}
            >
              {loading ? "Finalizando..." : labelBotaoFinalizar}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

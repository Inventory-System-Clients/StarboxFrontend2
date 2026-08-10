import api from "../services/api";
import { obterKmInicialPilotagemAtiva } from "./roteiroFinalizacaoWhatsApp";

// Regra hoje: só o perfil FUNCIONARIO_TODAS_LOJAS é obrigado a iniciar a
// pilotagem do veículo antes de interagir com um roteiro que tem veículo
// associado (Roteiros.jsx e o painel do Dashboard usam a mesma regra).
export const roteiroTemVeiculoAssociado = (roteiroAtual) =>
  Boolean(
    String(roteiroAtual?.veiculoId || roteiroAtual?.veiculo?.id || "").trim(),
  );

export async function usuarioTemPilotagemAtiva({
  usuario,
  roteiro,
  validarParaTodosPerfis = false,
}) {
  if (!validarParaTodosPerfis && usuario?.role !== "FUNCIONARIO_TODAS_LOJAS") {
    return true;
  }

  const [ultimasMovRes, veiculosRes] = await Promise.all([
    api.get("/movimentacao-veiculos/ultimas"),
    api.get("/veiculos", { params: { all: true } }),
  ]);

  const usuarioId = String(usuario?.id || "").trim();
  const veiculoRoteiroId = String(
    roteiro?.veiculoId || roteiro?.veiculo?.id || "",
  ).trim();

  if (!usuarioId) return false;

  if (veiculoRoteiroId) {
    const kmInicialLocal = obterKmInicialPilotagemAtiva({
      usuarioId,
      veiculoId: veiculoRoteiroId,
    });

    if (Number.isFinite(kmInicialLocal)) {
      return true;
    }
  }

  const veiculosLista = Array.isArray(veiculosRes.data) ? veiculosRes.data : [];

  const ultimasMovObj = ultimasMovRes.data || {};
  const ultimasMovimentacoes = Array.isArray(ultimasMovObj)
    ? ultimasMovObj
    : Object.values(ultimasMovObj);

  const temRetiradaAtiva = ultimasMovimentacoes.some((mov) => {
    const usuarioMovId = String(
      mov?.usuario?.id || mov?.usuarioId || mov?.funcionarioId || "",
    ).trim();
    const tipoMov = String(mov?.tipo || "").toLowerCase();
    const veiculoId = String(mov?.veiculoId || mov?.veiculo?.id || "").trim();
    const veiculo = veiculosLista.find((v) => String(v.id) === veiculoId);

    return (
      usuarioMovId === usuarioId &&
      tipoMov === "retirada" &&
      (!veiculoRoteiroId || veiculoId === veiculoRoteiroId) &&
      Boolean(veiculo?.emUso)
    );
  });

  // Fallback defensivo para APIs que já expõem vínculo de usuário no veículo.
  const temVinculoDiretoNoVeiculo = veiculosLista.some((veiculo) => {
    const usuarioVeiculoId = String(
      veiculo?.usuario?.id ||
        veiculo?.usuarioId ||
        veiculo?.funcionarioId ||
        veiculo?.condutorId ||
        "",
    ).trim();
    const veiculoId = String(veiculo?.id || "").trim();

    return (
      Boolean(veiculo?.emUso) &&
      usuarioVeiculoId === usuarioId &&
      (!veiculoRoteiroId || veiculoId === veiculoRoteiroId)
    );
  });

  return temRetiradaAtiva || temVinculoDiretoNoVeiculo;
}

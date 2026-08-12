import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext.jsx";
import api from "../services/api";
import { removerKmInicialPilotagemAtiva } from "../lib/roteiroFinalizacaoWhatsApp";

// Formulário de "devolver o veículo" — mesma lógica/validações de
// finalizarVeiculo em ControleVeiculos.jsx (linhas 423-518), extraída pra
// ser usada direto no fluxo do roteiro, sem precisar navegar pra
// /veiculos. Mesmo molde de PilotarVeiculoRoteiro.jsx.
function getCombustivelLabel(valor) {
  if (valor == null || valor === "") return "-";
  const mapa = {
    Cheio: "Cheio",
    "3/4": "3/4",
    "Meio tanque": "Meio tanque",
    "1/4": "1/4",
    Reserva: "Reserva",
    Vazio: "Vazio",
    "5 palzinhos": "Cheio",
    "4 palzinhos": "3/4",
    "3 palzinhos": "Meio tanque",
    "2 palzinhos": "1/4",
    "1 palzinho": "Reserva",
    5: "Cheio",
    4: "3/4",
    3: "Meio tanque",
    2: "1/4",
    1: "Reserva",
    0: "Vazio",
  };
  return mapa[valor] || valor;
}

export default function FinalizarVeiculoRoteiro({
  veiculoId,
  onDevolvido,
  onCancelar,
}) {
  const { usuario } = useAuth();

  const [carregando, setCarregando] = useState(true);
  const [erroCarregamento, setErroCarregamento] = useState("");
  const [veiculo, setVeiculo] = useState(null);
  const [kmUltimaMov, setKmUltimaMov] = useState(null);
  const [finalizando, setFinalizando] = useState(false);
  const [erro, setErro] = useState("");

  const [form, setForm] = useState({
    estado: "Bom",
    obs: "",
    km: "",
    combustivel: "Cheio",
    limpeza: "esta limpo",
  });

  useEffect(() => {
    let ativo = true;

    const carregar = async () => {
      if (!veiculoId) return;
      setCarregando(true);
      setErroCarregamento("");
      try {
        const [veiculosRes, ultimasMovRes] = await Promise.all([
          api.get("/veiculos", { params: { all: true } }),
          api.get("/movimentacao-veiculos/ultimas"),
        ]);

        if (!ativo) return;

        const lista = Array.isArray(veiculosRes.data) ? veiculosRes.data : [];
        const encontrado = lista.find(
          (item) => String(item.id) === String(veiculoId),
        );

        if (!encontrado) {
          setErroCarregamento("Veículo não encontrado.");
          setVeiculo(null);
          return;
        }

        const ultimasMovObj = ultimasMovRes.data || {};
        const ultimaMov = ultimasMovObj?.[veiculoId];
        const kmUltimaMovNumero = Number(ultimaMov?.km);

        setVeiculo(encontrado);
        setKmUltimaMov(
          Number.isFinite(kmUltimaMovNumero) ? kmUltimaMovNumero : null,
        );
        setForm({
          estado: encontrado.estado || "Bom",
          obs: "",
          km: encontrado.km ?? "",
          combustivel: getCombustivelLabel(
            encontrado.nivelCombustivel || encontrado.combustivel || "Cheio",
          ),
          limpeza: encontrado.nivelLimpeza || "esta limpo",
        });
      } catch (err) {
        console.error("Erro ao carregar veículo para finalização:", err);
        if (ativo) {
          setErroCarregamento("Erro ao carregar dados do veículo.");
        }
      } finally {
        if (ativo) setCarregando(false);
      }
    };

    carregar();

    return () => {
      ativo = false;
    };
  }, [veiculoId]);

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (erro) setErro("");
  };

  const finalizar = async () => {
    if (!veiculo || finalizando) return;

    const kmValue = form.km === "" ? 0 : parseInt(form.km, 10);

    if (Number.isFinite(kmUltimaMov) && kmValue < kmUltimaMov) {
      setErro(
        `O KM informado (${kmValue}) não pode ser menor que o KM da última movimentação (${kmUltimaMov}).`,
      );
      return;
    }

    if (Number.isFinite(kmUltimaMov)) {
      const limiteMaximo = kmUltimaMov + 10000;
      if (kmValue > limiteMaximo) {
        setErro(
          `O KM informado (${kmValue}) excede o limite permitido com base na última movimentação (${kmUltimaMov}). Máximo aceito: ${limiteMaximo}.`,
        );
        return;
      }
    }

    setFinalizando(true);
    setErro("");
    try {
      await api.put(`/veiculos/${veiculo.id}`, {
        ...veiculo,
        emUso: false,
        km: kmValue,
        estado: form.estado,
        nivelCombustivel: getCombustivelLabel(form.combustivel),
        nivelLimpeza: form.limpeza,
      });

      await api.post("/movimentacao-veiculos", {
        veiculoId: veiculo.id,
        tipo: "devolucao",
        gasolina: form.combustivel
          ? getCombustivelLabel(form.combustivel)
          : undefined,
        nivel_limpeza: form.limpeza,
        estado: form.estado,
        modo: veiculo.modo,
        obs: form.obs || undefined,
        km: kmValue,
      });

      removerKmInicialPilotagemAtiva({
        usuarioId: usuario?.id,
        veiculoId: veiculo.id,
      });

      onDevolvido?.(kmValue);
    } catch (err) {
      console.error("Erro ao finalizar veículo:", err);
      setErro(
        err?.response?.data?.error || "Não foi possível finalizar o veículo.",
      );
    } finally {
      setFinalizando(false);
    }
  };

  if (carregando) {
    return (
      <p className="text-sm text-gray-500 text-center py-4">
        Carregando dados do veículo...
      </p>
    );
  }

  if (erroCarregamento || !veiculo) {
    return (
      <p className="text-sm text-red-600 text-center py-4">
        {erroCarregamento || "Veículo não encontrado."}
      </p>
    );
  }

  return (
    <div>
      <h3 className="text-lg font-bold mb-4">Finalizar {veiculo.nome}</h3>

      {erro ? (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {erro}
        </div>
      ) : null}

      <div className="mb-3">
        <label className="block text-sm font-medium">Estado do veículo</label>
        <select
          name="estado"
          value={form.estado}
          onChange={handleFormChange}
          className="w-full border rounded p-1"
          disabled={finalizando}
        >
          <option value="Bom">Sem avaria</option>
          <option value="Ruim">Com avaria</option>
        </select>
      </div>

      <div className="mb-3">
        <label className="block text-sm font-medium">Obs:</label>
        <input
          name="obs"
          value={form.obs}
          onChange={handleFormChange}
          className="w-full border rounded p-1"
          placeholder="Descreva o problema (opcional)"
          disabled={finalizando}
        />
      </div>

      <div className="mb-3">
        <label className="block text-sm font-medium">Km final</label>
        <input
          name="km"
          type="number"
          value={form.km}
          onChange={handleFormChange}
          className="w-full border rounded p-1"
          min="0"
          onWheel={(e) => e.target.blur()}
          disabled={finalizando}
        />
      </div>

      <div className="mb-3">
        <label className="block text-sm font-medium">Nível de combustível</label>
        <select
          name="combustivel"
          value={form.combustivel}
          onChange={handleFormChange}
          className="w-full border rounded p-1"
          disabled={finalizando}
        >
          <option value="Cheio">Cheio</option>
          <option value="3/4">3/4</option>
          <option value="Meio tanque">Meio tanque</option>
          <option value="1/4">1/4</option>
          <option value="Reserva">Reserva</option>
          <option value="Vazio">Vazio</option>
        </select>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium">Nível de limpeza</label>
        <select
          name="limpeza"
          value={form.limpeza}
          onChange={handleFormChange}
          className="w-full border rounded p-1"
          disabled={finalizando}
        >
          <option value="esta limpo">Está limpo</option>
          <option value="precisa limpar">Precisa limpar</option>
        </select>
      </div>

      <div className="flex justify-end gap-2">
        {onCancelar ? (
          <button
            type="button"
            className="px-4 py-1 bg-[#A6806A] text-white rounded hover:bg-[#733D38]"
            onClick={onCancelar}
            disabled={finalizando}
          >
            Cancelar
          </button>
        ) : null}
        <button
          type="button"
          className="px-4 py-1 bg-[#62A1D9] text-white rounded hover:bg-[#24094E] disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={finalizar}
          disabled={finalizando}
        >
          {finalizando ? "Finalizando..." : "Finalizar"}
        </button>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../contexts/AuthContext.jsx";
import { LoadingSpinner, EmptyState } from "./Loading";
import { AlertBox } from "./UIComponents";
import { RoteiroExecucaoConteudo } from "./RoteiroExecucaoConteudo";
import {
  roteiroTemVeiculoAssociado,
  usuarioTemPilotagemAtiva,
} from "../lib/pilotagemRoteiro";

// Painel do FUNCIONARIO_TODAS_LOJAS: mostra o(s) roteiro(s) dele direto no
// Dashboard, igual o PainelAbastecedor faz pro ABASTECEDOR - mas aqui com
// 100% das funcoes do funcionario operacional (veiculo, gastos, manutencao
// ao clicar na loja, finalizar rota etc.), reaproveitando o mesmo miolo que
// a pagina /roteiros/:id/executar usa (RoteiroExecucaoConteudo). Se o
// roteiro tem veiculo e o funcionario ainda nao iniciou a pilotagem, mostra
// um aviso pra pilotar antes - a mesma regra que Roteiros.jsx ja aplica.
export default function PainelFuncionarioTodasLojas() {
  const { usuario } = useAuth();
  const navigate = useNavigate();

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [meusRoteiros, setMeusRoteiros] = useState([]);
  const [pilotagemPorRoteiro, setPilotagemPorRoteiro] = useState({});

  useEffect(() => {
    let cancelado = false;

    async function carregar() {
      if (!usuario?.id) return;

      setCarregando(true);
      setErro("");

      try {
        const respRoteiros = await api.get("/roteiros");
        const todos = Array.isArray(respRoteiros.data) ? respRoteiros.data : [];
        const roteirosDoFuncionario = todos.filter(
          (r) => String(r?.funcionarioId || "") === String(usuario.id),
        );

        const statusPilotagem = {};
        await Promise.all(
          roteirosDoFuncionario.map(async (roteiro) => {
            if (!roteiroTemVeiculoAssociado(roteiro)) {
              statusPilotagem[roteiro.id] = true;
              return;
            }

            try {
              statusPilotagem[roteiro.id] = await usuarioTemPilotagemAtiva({
                usuario,
                roteiro,
                validarParaTodosPerfis: true,
              });
            } catch {
              statusPilotagem[roteiro.id] = false;
            }
          }),
        );

        if (!cancelado) {
          setMeusRoteiros(roteirosDoFuncionario);
          setPilotagemPorRoteiro(statusPilotagem);
        }
      } catch {
        if (!cancelado) setErro("Não foi possível carregar seu roteiro.");
      } finally {
        if (!cancelado) setCarregando(false);
      }
    }

    carregar();

    return () => {
      cancelado = true;
    };
  }, [usuario?.id]);

  const pilotarVeiculoDoRoteiro = () => {
    navigate("/veiculos", {
      state: { origem: "roteiros", retornarPara: "/" },
    });
  };

  if (carregando) {
    return (
      <div className="mb-8">
        <LoadingSpinner message="Carregando seu roteiro..." />
      </div>
    );
  }

  if (erro) {
    return (
      <div className="mb-8">
        <AlertBox type="error" message={erro} onClose={() => setErro("")} />
      </div>
    );
  }

  if (meusRoteiros.length === 0) {
    return (
      <div className="mb-8">
        <EmptyState
          icon="🗺️"
          title="Nenhum roteiro atribuído"
          description="Assim que um administrador atribuir um roteiro a você, ele aparece aqui."
        />
      </div>
    );
  }

  return (
    <div className="mb-8 space-y-6">
      {meusRoteiros.map((roteiro) => {
        const podeExecutar = pilotagemPorRoteiro[roteiro.id] !== false;

        return (
          <div
            key={roteiro.id}
            className="bg-white rounded-xl shadow-lg p-4 sm:p-6 border border-[#62A1D9]"
          >
            <h2 className="text-xl font-bold text-[#24094E] mb-4 flex items-center gap-2">
              🗺️ {roteiro.nome}
            </h2>

            {podeExecutar ? (
              <RoteiroExecucaoConteudo roteiroId={roteiro.id} />
            ) : (
              <div className="flex flex-col items-center gap-4 py-10 text-center">
                <span className="text-5xl">🚗</span>
                <p className="text-gray-700 font-semibold max-w-sm">
                  Este roteiro usa um veículo. Inicie a pilotagem antes de
                  começar a atender as lojas.
                </p>
                <button
                  type="button"
                  onClick={pilotarVeiculoDoRoteiro}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-3 rounded-xl shadow-md"
                >
                  🚗 Pilotar veículo
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

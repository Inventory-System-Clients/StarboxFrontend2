import { useParams, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer.jsx";
import { MovimentacaoMaquinaForm } from "../components/MovimentacaoMaquinaForm";

export default function MovimentacaoMaquina() {
  const { roteiroId, lojaId, maquinaId } = useParams();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-100 text-[#24094E]">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-8">
        <MovimentacaoMaquinaForm
          variant="page"
          roteiroId={roteiroId}
          lojaId={lojaId}
          maquinaId={maquinaId}
          onCancelar={() =>
            navigate(`/roteiros/${roteiroId}/executar`, {
              state: { lojaId },
            })
          }
          onSalvarComSucesso={() =>
            navigate(`/roteiros/${roteiroId}/executar`, {
              replace: true,
              state: { lojaId, origemMovimentacao: true },
            })
          }
        />
      </main>
      <Footer />
    </div>
  );
}

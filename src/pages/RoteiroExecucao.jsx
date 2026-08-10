import { useParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer.jsx";
import { RoteiroExecucaoConteudo } from "../components/RoteiroExecucaoConteudo";

export default function RoteiroExecucao() {
  const { id } = useParams();

  return (
    <div className="min-h-screen bg-gray-100 text-[#24094E]">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-8">
        <RoteiroExecucaoConteudo roteiroId={id} />
      </main>
      <Footer />
    </div>
  );
}

import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../services/api";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer.jsx";
import { PageHeader } from "../components/UIComponents";
import { PageLoader } from "../components/Loading";

export default function CarrinhoDetalhePage() {
  const { funcionarioId } = useParams();
  const navigate = useNavigate();
  const [funcionario, setFuncionario] = useState(null);
  const [carrinho, setCarrinho] = useState([]);
  const [pecas, setPecas] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [funcRes, carrinhoRes, pecasRes] = await Promise.all([
          api.get(`/usuarios/${funcionarioId}`),
          api.get(`/usuarios/${funcionarioId}/carrinho`),
          api.get(`/pecas`),
        ]);
        setFuncionario(funcRes.data);
        setCarrinho(carrinhoRes.data || []);
        setPecas(pecasRes.data || []);
      } catch (err) {
        setFuncionario(null);
        setCarrinho([]);
        setPecas([]);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [funcionarioId]);

  if (loading) return <PageLoader />;

  // Monta um map de pecaId -> quantidade do carrinho
  const carrinhoPorPecaId = carrinho.reduce((acc, item) => {
    const pecaId = String(item.pecaId || item.id || item.Peca?.id || "");
    if (!pecaId) return acc;
    acc[pecaId] = (acc[pecaId] || 0) + Number(item.quantidade || 0);
    return acc;
  }, {});

  // Lista todas as peças, mostrando quantidade do carrinho (ou 0)
  const pecasComQuantidade = pecas.map((peca) => ({
    ...peca,
    quantidadeCarrinho: carrinhoPorPecaId[String(peca.id)] || 0,
  }));

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title="Detalhes do Carrinho"
          subtitle={
            funcionario
              ? `Funcionário: ${funcionario.nome} (${funcionario.email})`
              : "Funcionário não encontrado"
          }
          icon="🛒"
        />
        <button
          className="mb-4 text-indigo-600 hover:underline"
          onClick={() => navigate(-1)}
        >
          ← Voltar
        </button>
        <div className="bg-white rounded-lg shadow p-6 border border-gray-100">
          {pecasComQuantidade.length === 0 ? (
            <p className="text-gray-500 text-center">
              Nenhuma peça cadastrada.
            </p>
          ) : (
            <ul className="divide-y divide-gray-200">
              {pecasComQuantidade.map((peca) => (
                <li
                  key={peca.id}
                  className="py-3 flex justify-between items-center"
                >
                  <div>
                    <div className="font-semibold text-gray-800">
                      {peca.nome || `Peça ID: ${peca.id}`}
                    </div>
                    <div className="text-xs text-gray-500">
                      Código: {peca.codigo || "N/A"}
                    </div>
                  </div>
                  <div className="text-sm text-gray-700">
                    Quantidade: <strong>{peca.quantidadeCarrinho}</strong>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
}

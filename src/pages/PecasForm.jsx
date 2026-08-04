import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer.jsx";

export default function PecasForm() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    nome: "",
    categoria: "",
    quantidade: 0,
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      await api.post("/pecas", formData);
      setSuccess("Peça cadastrada com sucesso!");
      setTimeout(() => navigate("/pecas"), 1200);
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao cadastrar peça");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Navbar />
      <div className="container mx-auto py-8 max-w-lg">
        <h1 className="text-2xl font-bold mb-6">Cadastrar Nova Peça</h1>
        {error && <div className="mb-4 text-red-600">{error}</div>}
        {success && <div className="mb-4 text-green-600">{success}</div>}
        <form onSubmit={handleSubmit} className="space-y-4 bg-white p-6 rounded shadow">
          <div>
            <label className="block font-semibold mb-1">Nome *</label>
            <input name="nome" value={formData.nome} onChange={handleChange} required className="input-field w-full" />
          </div>
          <div>
            <label className="block font-semibold mb-1">Categoria *</label>
            <input name="categoria" value={formData.categoria} onChange={handleChange} required className="input-field w-full" />
          </div>
          <div>
            <label className="block font-semibold mb-1">Quantidade *</label>
            <input type="number" name="quantidade" value={formData.quantidade} onChange={handleChange} min="0" required className="input-field w-full" />
          </div>
          <div className="flex gap-4 justify-end">
            <button type="button" className="btn-secondary" onClick={() => navigate("/pecas")}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={loading}>{loading ? "Salvando..." : "Salvar"}</button>
          </div>
        </form>
      </div>
      <Footer />
    </>
  );
}

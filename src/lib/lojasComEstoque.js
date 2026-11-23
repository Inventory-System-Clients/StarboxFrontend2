import api from "../services/api";

// Lojas (pontos) que têm "Estoque Loja" habilitado. Achamos pelo nome/endereço
// em vez de fixar um ID, já que o ID difere entre ambiente local/demo/produção.
// Para habilitar outra loja, basta adicionar um trecho do nome aqui (sem acento).
export const TERMOS_LOJAS_COM_ESTOQUE = ["osasco", "catuai"];

const normalizar = (texto) =>
  String(texto || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

export const lojaTemEstoqueHabilitado = (loja) => {
  const texto = normalizar(`${loja?.nome || ""} ${loja?.endereco || ""}`);
  return TERMOS_LOJAS_COM_ESTOQUE.some((termo) => texto.includes(termo));
};

export const carregarLojasComEstoque = async () => {
  const res = await api.get("/lojas", { params: { all: true } });
  const lojas = Array.isArray(res.data) ? res.data : res.data?.data || [];
  return lojas
    .filter(lojaTemEstoqueHabilitado)
    .sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR"));
};

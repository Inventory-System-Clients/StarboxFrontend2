import api from "../services/api";
import { montarWhatsAppUrl } from "./whatsapp";

// Monta o texto do estoque pessoal (o mesmo que a tela "Estoque de
// Usuários" mostra pra "me") pra mandar no WhatsApp.
export const montarMensagemEstoquePessoal = (estoque, usuario) => {
  const linhas = (Array.isArray(estoque) ? estoque : []).map((item) => {
    const nome = item.produto?.nome || item.produtoNome || "Produto";
    const emoji = item.produto?.emoji || item.emoji || "🧸";
    const quantidade = Number(item.quantidade || 0);
    return `${emoji} ${nome}: ${quantidade}`;
  });

  return [
    "STAR BOX",
    `*Estoque pessoal de ${usuario?.nome || "Usuário"}*`,
    `Data: ${new Date().toLocaleString("pt-BR")}`,
    "___________________________________",
    ...(linhas.length > 0 ? linhas : ["Nenhum produto no estoque pessoal."]),
  ].join("\n");
};

// Busca o estoque pessoal do usuário logado e abre o WhatsApp já com o
// texto pronto pra enviar (sem destinatário — quem manda escolhe o
// contato depois que a aba abre).
export const compartilharEstoquePessoal = async (usuario) => {
  const res = await api.get("/estoque-usuarios/me");
  const estoque = Array.isArray(res.data?.estoque) ? res.data.estoque : [];
  const mensagem = montarMensagemEstoquePessoal(estoque, usuario);
  window.open(montarWhatsAppUrl(mensagem), "_blank");
};

// Monta a URL de envio do WhatsApp com o texto já preenchido. Não inclui
// número de destinatário — quem está enviando escolhe o contato no próprio
// WhatsApp depois que a aba abre.
export const montarWhatsAppUrl = (mensagem) => {
  const textoCodificado = encodeURIComponent(String(mensagem || ""));
  const isMobile = /Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i.test(
    navigator.userAgent,
  );

  return isMobile
    ? `whatsapp://send?text=${textoCodificado}`
    : `https://web.whatsapp.com/send?text=${textoCodificado}`;
};

import jsPDF from "jspdf";

const LOGO_PATH = "/starbox-logo.png";

function fmt(v) {
  return Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
}

export function gerarPdfComissao({
  loja,
  data,
  receitaBruta = 0,
  detalhesReceita = {},
  custoProdutos = 0,
  comissaoTotal = 0,
  custosFixos = 0,
  custosVariaveis = 0,
  lucroLiquido = 0,
  detalhesMaquinas = [],
}) {
  const doc = new jsPDF();
  const LEFT = 30;
  const RIGHT_VAL = 150;

  // Logo
  doc.addImage(LOGO_PATH, "PNG", 70, 10, 70, 40);
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.7);
  doc.line(LEFT, 52, 180, 52);

  // Cabeçalho
  doc.setFontSize(15);
  doc.setTextColor(44, 62, 80);
  doc.setFont("helvetica", "bold");
  let y = 62;
  doc.text("Relatório de Lucro e Comissão do Dia", LEFT, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(80, 80, 80);
  y += 10;
  doc.text(`Ponto: ${loja.nome}`, LEFT, y);
  y += 7;
  doc.text(`Data: ${data}`, LEFT, y);

  // ── RECEITA BRUTA ──
  y += 14;
  doc.setFontSize(13);
  doc.setTextColor(44, 62, 80);
  doc.setFont("helvetica", "bold");
  doc.text("RECEITA BRUTA", LEFT, y);
  doc.setTextColor(39, 174, 96);
  doc.text(`R$ ${fmt(receitaBruta)}`, RIGHT_VAL, y, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(100, 100, 100);
  y += 7;
  const fichasQtd = detalhesReceita.fichasQuantidade || 0;
  doc.text(`  Fichas (${fichasQtd} un.)`, LEFT + 4, y);
  doc.text(`R$ ${fmt(detalhesReceita.fichasValor)}`, RIGHT_VAL, y, { align: "right" });
  y += 6;
  doc.text("  Dinheiro (notas)", LEFT + 4, y);
  doc.text(`R$ ${fmt(detalhesReceita.dinheiro)}`, RIGHT_VAL, y, { align: "right" });
  y += 6;
  doc.text("  Pix / Cartão", LEFT + 4, y);
  doc.text(`R$ ${fmt(detalhesReceita.pixCartao)}`, RIGHT_VAL, y, { align: "right" });

  // ── DEDUÇÕES ──
  y += 12;
  doc.setFontSize(13);
  doc.setTextColor(44, 62, 80);
  doc.setFont("helvetica", "bold");
  doc.text("DEDUÇÕES", LEFT, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(192, 57, 43);
  y += 7;
  doc.text("(−) Custo dos Produtos", LEFT + 4, y);
  doc.text(`R$ ${fmt(custoProdutos)}`, RIGHT_VAL, y, { align: "right" });
  y += 6;
  doc.text("(−) Comissão do Ponto", LEFT + 4, y);
  doc.text(`R$ ${fmt(comissaoTotal)}`, RIGHT_VAL, y, { align: "right" });
  y += 6;
  doc.text("(−) Custos Fixos", LEFT + 4, y);
  doc.text(`R$ ${fmt(custosFixos)}`, RIGHT_VAL, y, { align: "right" });
  y += 6;
  doc.text("(−) Custos Variáveis", LEFT + 4, y);
  doc.text(`R$ ${fmt(custosVariaveis)}`, RIGHT_VAL, y, { align: "right" });

  // ── LUCRO LÍQUIDO ──
  y += 10;
  doc.setDrawColor(44, 62, 80);
  doc.setLineWidth(0.5);
  doc.line(LEFT, y, 180, y);
  y += 8;
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  const corLucro = lucroLiquido >= 0 ? [39, 174, 96] : [192, 57, 43];
  doc.setTextColor(...corLucro);
  doc.text("LUCRO LÍQUIDO", LEFT, y);
  doc.text(`R$ ${fmt(lucroLiquido)}`, RIGHT_VAL, y, { align: "right" });

  // ── DETALHES POR MÁQUINA ──
  y += 16;
  doc.setFontSize(13);
  doc.setTextColor(44, 62, 80);
  doc.setFont("helvetica", "bold");
  doc.text("Detalhes de Comissão por Máquina", LEFT, y);
  doc.setDrawColor(220, 220, 220);
  doc.line(LEFT, y + 2, 180, y + 2);
  y += 10;

  // Cabeçalho da tabela
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.setFont("helvetica", "bold");
  doc.text("Máquina", LEFT, y);
  doc.text("Receita", 95, y);
  doc.text("%", 125, y);
  doc.text("Comissão", RIGHT_VAL, y, { align: "right" });
  doc.setFont("helvetica", "normal");
  y += 2;
  doc.setDrawColor(220, 220, 220);
  doc.line(LEFT, y, 180, y);
  y += 5;

  doc.setFontSize(10);
  detalhesMaquinas.forEach((det) => {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
    doc.setTextColor(60, 60, 60);
    doc.text(det.nome, LEFT, y);
    doc.setTextColor(34, 167, 240);
    doc.text(`R$ ${fmt(det.receita)}`, 95, y);
    doc.text(`${det.percentual}%`, 125, y);
    doc.setTextColor(39, 174, 96);
    doc.text(`R$ ${fmt(det.comissao)}`, RIGHT_VAL, y, { align: "right" });
    y += 7;
  });

  // Total comissão
  if (detalhesMaquinas.length > 0) {
    doc.setDrawColor(220, 220, 220);
    doc.line(LEFT, y, 180, y);
    y += 5;
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(44, 62, 80);
    doc.text("TOTAL COMISSÃO", LEFT, y);
    doc.setTextColor(34, 167, 240);
    doc.text(`R$ ${fmt(comissaoTotal)}`, RIGHT_VAL, y, { align: "right" });
  }

  window.open(doc.output("bloburl"));
}

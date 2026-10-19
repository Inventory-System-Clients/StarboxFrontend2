import api from "../services/api";

const extrairLista = (data) =>
  Array.isArray(data?.estoque)
    ? data.estoque
    : Array.isArray(data)
      ? data
      : [];

const somarSaldos = (lista) => {
  const saldos = new Map();
  lista.forEach((item) => {
    const id = String(item?.produtoId || "");
    if (!id) return;
    saldos.set(id, (saldos.get(id) || 0) + Number(item?.quantidade || 0));
  });
  return saldos;
};

// Produtos que podem ser usados no abastecimento extra: os que têm saldo no
// estoque próprio do usuário OU no estoque da loja da máquina. Cada item vem
// com saldoUsuario/saldoLoja pra tela deixar escolher a origem.
export async function carregarProdutosAbastecimentoExtra(lojaId) {
  const [produtosRes, estoqueUsuarioRes, estoqueLojaRes] = await Promise.all([
    api.get("/produtos", { params: { all: true } }),
    api.get("/estoque-usuarios/me").catch(() => ({ data: [] })),
    lojaId
      ? api.get(`/estoque-lojas/${lojaId}`).catch(() => ({ data: [] }))
      : Promise.resolve({ data: [] }),
  ]);

  const listaProdutos = Array.isArray(produtosRes.data) ? produtosRes.data : [];
  const saldosUsuario = somarSaldos(extrairLista(estoqueUsuarioRes?.data));
  const saldosLoja = somarSaldos(extrairLista(estoqueLojaRes?.data));

  return listaProdutos
    .map((produto) => {
      const id = String(produto?.id || "");
      return {
        ...produto,
        saldoUsuario: saldosUsuario.get(id) || 0,
        saldoLoja: saldosLoja.get(id) || 0,
      };
    })
    .filter((produto) => produto.saldoUsuario > 0 || produto.saldoLoja > 0);
}

// Origem padrão: estoque próprio quando tem saldo, senão estoque da loja.
export function origemPadraoAbastecimentoExtra(produto) {
  if (!produto) return "usuario";
  return produto.saldoUsuario > 0 ? "usuario" : "loja";
}

export function rotuloProdutoAbastecimentoExtra(produto) {
  const partes = [];
  if (produto.saldoUsuario > 0) partes.push(`meu: ${produto.saldoUsuario}`);
  if (produto.saldoLoja > 0) partes.push(`loja: ${produto.saldoLoja}`);
  return `${produto.nome} (${partes.join(" | ")})`;
}

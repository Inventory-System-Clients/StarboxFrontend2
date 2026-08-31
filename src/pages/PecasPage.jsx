import { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import api from "../services/api";
import { useAuth } from "../contexts/AuthContext.jsx";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer.jsx";
import { PageHeader } from "../components/UIComponents";
import { EmptyState } from "../components/Loading";

const PODE_GERENCIAR_ESTOQUE = [
  "ADMIN",
  "GERENCIADOR",
  "CONTROLADOR_ESTOQUE",
  "MANUTENCAO",
];
const PODE_CRIAR_EDITAR_EXCLUIR = ["ADMIN", "GERENCIADOR", "CONTROLADOR_ESTOQUE"];
const PODE_ADICIONAR_AO_PROPRIO_CARRINHO = [
  "CONTROLADOR_ESTOQUE",
  "MANUTENCAO",
  "ADMIN",
  "GERENCIADOR",
];
const PODE_GERENCIAR_CARRINHOS_DE_OUTROS = ["ADMIN", "GERENCIADOR"];

export default function PecasPage() {
  const { usuario } = useAuth();
  const role = usuario?.role;

  const podeVerEstoque = PODE_GERENCIAR_ESTOQUE.includes(role);
  const podeGerenciarCarrinhos = PODE_GERENCIAR_CARRINHOS_DE_OUTROS.includes(role);

  const abas = useMemo(
    () =>
      [
        { id: "estoque", label: "Estoque", icon: "🧰", visivel: podeVerEstoque },
        { id: "meu-carrinho", label: "Meu Carrinho", icon: "🛒", visivel: true },
        {
          id: "carrinhos",
          label: "Carrinhos dos Funcionários",
          icon: "👥",
          visivel: podeGerenciarCarrinhos,
        },
      ].filter((aba) => aba.visivel),
    [podeVerEstoque, podeGerenciarCarrinhos],
  );

  const [abaAtiva, setAbaAtiva] = useState(abas[0]?.id || "meu-carrinho");

  useEffect(() => {
    if (!abas.some((aba) => aba.id === abaAtiva)) {
      setAbaAtiva(abas[0]?.id || "meu-carrinho");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abas]);

  return (
    <>
      <Navbar />
      <div className="container mx-auto py-8 px-4">
        <PageHeader
          title="Peças"
          subtitle="Estoque de peças e carrinhos de funcionários, tudo em um só lugar"
          icon="🛠️"
        />

        {abas.length > 1 && (
          <div className="flex gap-2 mb-6 border-b border-gray-200">
            {abas.map((aba) => (
              <button
                key={aba.id}
                onClick={() => setAbaAtiva(aba.id)}
                className={`px-4 py-2 text-sm font-semibold rounded-t-lg border-b-2 transition-colors ${
                  abaAtiva === aba.id
                    ? "border-primary text-primary bg-white"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                {aba.icon} {aba.label}
              </button>
            ))}
          </div>
        )}

        {abaAtiva === "estoque" && podeVerEstoque && (
          <AbaEstoque
            usuario={usuario}
            podeAdicionarAoProprioCarrinho={PODE_ADICIONAR_AO_PROPRIO_CARRINHO.includes(role)}
            podeCriarEditarExcluir={PODE_CRIAR_EDITAR_EXCLUIR.includes(role)}
          />
        )}
        {abaAtiva === "meu-carrinho" && <AbaMeuCarrinho usuario={usuario} />}
        {abaAtiva === "carrinhos" && podeGerenciarCarrinhos && <AbaCarrinhos />}
      </div>
      <Footer />
    </>
  );
}

// --- Aba Estoque: catálogo central de peças, com formulário e edição inline ---
function AbaEstoque({ usuario, podeAdicionarAoProprioCarrinho, podeCriarEditarExcluir }) {
  const [pecas, setPecas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [pecaEditando, setPecaEditando] = useState(null);
  const [novaPeca, setNovaPeca] = useState({ nome: "", categoria: "", quantidade: 0 });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const carregarPecas = async () => {
    try {
      setCarregando(true);
      const res = await api.get("/pecas", { params: { all: true } });
      setPecas(res.data || []);
    } catch (err) {
      console.error("Erro ao buscar peças:", err);
      setPecas([]);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarPecas();
  }, []);

  const pecasFiltradas = pecas.filter((peca) => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return true;
    return [peca.nome, peca.categoria].filter(Boolean).some((valor) =>
      String(valor).toLowerCase().includes(termo),
    );
  });

  const handleCriarPeca = async (e) => {
    e.preventDefault();
    setSalvando(true);
    setErro("");
    try {
      await api.post("/pecas", novaPeca);
      setNovaPeca({ nome: "", categoria: "", quantidade: 0 });
      setMostrarFormulario(false);
      await carregarPecas();
    } catch (err) {
      setErro(err.response?.data?.error || "Erro ao cadastrar peça");
    } finally {
      setSalvando(false);
    }
  };

  const adicionarAoProprioCarrinho = async (peca) => {
    if (!peca || peca.quantidade === 0) {
      Swal.fire(
        "Atenção",
        "Não é possível adicionar ao carrinho: peça sem estoque disponível.",
        "warning",
      );
      return;
    }
    if (!usuario?.id) {
      Swal.fire("Atenção", "Usuário não autenticado", "warning");
      return;
    }
    try {
      await api.post(`/usuarios/${usuario.id}/carrinho`, {
        pecaId: peca.id,
        quantidade: 1,
      });
      await carregarPecas();
      Swal.fire("Sucesso", "Peça adicionada ao seu carrinho!", "success");
    } catch (err) {
      Swal.fire(
        "Erro",
        err.response?.data?.error || "Erro ao adicionar peça ao carrinho",
        "error",
      );
    }
  };

  const handleExcluir = async (pecaId, nomePeca) => {
    const confirmacao = await Swal.fire({
      icon: "warning",
      title: "Excluir peça",
      text: `Tem certeza que deseja excluir a peça "${nomePeca}"?`,
      showCancelButton: true,
      confirmButtonText: "Sim, excluir",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#dc2626",
    });
    if (!confirmacao.isConfirmed) return;
    try {
      await api.delete(`/pecas/${pecaId}`);
      await carregarPecas();
    } catch (err) {
      Swal.fire("Erro", err.response?.data?.error || "Erro ao excluir peça", "error");
    }
  };

  const handleSalvarEdicao = async (formData) => {
    try {
      const dados = {
        nome: formData.nome,
        categoria: formData.categoria,
        quantidade: parseInt(formData.quantidade, 10) || 0,
        descricao: formData.descricao || "",
        ativo: formData.ativo === true || formData.ativo === "true",
      };
      if (formData.preco && formData.preco !== "" && formData.preco !== "0") {
        dados.preco = parseFloat(formData.preco);
      }
      await api.put(`/pecas/${pecaEditando.id}`, dados);
      setPecaEditando(null);
      await carregarPecas();
    } catch (err) {
      Swal.fire(
        "Erro",
        err.response?.data?.error || err.response?.data?.message || "Erro ao salvar peça",
        "error",
      );
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <input
          type="text"
          className="input-field max-w-xs"
          placeholder="Buscar por nome ou categoria..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        {podeCriarEditarExcluir && (
          <button
            type="button"
            className="btn-primary"
            onClick={() => setMostrarFormulario((v) => !v)}
          >
            {mostrarFormulario ? "Cancelar" : "+ Nova Peça"}
          </button>
        )}
      </div>

      {mostrarFormulario && (
        <form
          onSubmit={handleCriarPeca}
          className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white p-4 rounded-lg shadow border border-gray-100 mb-6"
        >
          {erro && <div className="md:col-span-4 text-red-600 text-sm">{erro}</div>}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Nome *</label>
            <input
              className="input-field w-full"
              required
              value={novaPeca.nome}
              onChange={(e) => setNovaPeca({ ...novaPeca, nome: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Categoria *</label>
            <input
              className="input-field w-full"
              required
              value={novaPeca.categoria}
              onChange={(e) => setNovaPeca({ ...novaPeca, categoria: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Quantidade *</label>
            <input
              type="number"
              min="0"
              className="input-field w-full"
              required
              value={novaPeca.quantidade}
              onChange={(e) => setNovaPeca({ ...novaPeca, quantidade: e.target.value })}
            />
          </div>
          <div className="flex items-end">
            <button type="submit" className="btn-primary w-full" disabled={salvando}>
              {salvando ? "Salvando..." : "Cadastrar"}
            </button>
          </div>
        </form>
      )}

      {carregando ? (
        <p className="text-gray-500">Carregando...</p>
      ) : pecasFiltradas.length === 0 ? (
        <EmptyState icon="🔧" title="Nenhuma peça encontrada" description="Ajuste a busca ou cadastre uma nova peça." />
      ) : (
        <div className="overflow-x-auto bg-white rounded-xl shadow p-4 border border-gray-100">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Nome</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Categoria</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Quantidade</th>
                <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pecasFiltradas.map((peca) => (
                <tr key={peca.id}>
                  <td className="px-4 py-2 font-semibold text-gray-800">{peca.nome}</td>
                  <td className="px-4 py-2 text-gray-700">{peca.categoria}</td>
                  <td className="px-4 py-2">
                    <span className={`font-semibold ${peca.quantidade === 0 ? "text-red-600" : "text-green-600"}`}>
                      {peca.quantidade}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center justify-center gap-2">
                      {podeAdicionarAoProprioCarrinho && (
                        <button
                          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs font-semibold"
                          onClick={() => adicionarAoProprioCarrinho(peca)}
                        >
                          🛒 Carrinho
                        </button>
                      )}
                      {podeCriarEditarExcluir && (
                        <>
                          <button
                            className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-xs font-semibold"
                            onClick={() => setPecaEditando(peca)}
                          >
                            ✏️ Editar
                          </button>
                          <button
                            className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-xs font-semibold"
                            onClick={() => handleExcluir(peca.id, peca.nome)}
                          >
                            🗑️ Excluir
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pecaEditando && (
        <ModalEditarPeca
          peca={pecaEditando}
          onFechar={() => setPecaEditando(null)}
          onSalvar={handleSalvarEdicao}
        />
      )}
    </div>
  );
}

// --- Aba Meu Carrinho: visível para todos os perfis ---
function AbaMeuCarrinho({ usuario }) {
  const [carrinho, setCarrinho] = useState([]);
  const [carregando, setCarregando] = useState(true);

  const carregarCarrinho = async () => {
    if (!usuario?.id) return;
    try {
      setCarregando(true);
      const res = await api.get(`/usuarios/${usuario.id}/carrinho`);
      setCarrinho(res.data || []);
    } catch (err) {
      console.error("Erro ao buscar carrinho:", err);
      setCarrinho([]);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarCarrinho();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario?.id]);

  const removerDoCarrinho = async (item) => {
    const pecaId = item.pecaId || item.id || item.Peca?.id;
    if (!usuario?.id || !pecaId) return;
    const confirmacao = await Swal.fire({
      icon: "warning",
      title: "Remover peça",
      text: "Deseja realmente remover esta peça do carrinho? Ela será devolvida ao estoque.",
      showCancelButton: true,
      confirmButtonText: "Sim, remover",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#dc2626",
    });
    if (!confirmacao.isConfirmed) {
      return;
    }
    try {
      await api.delete(`/usuarios/${usuario.id}/carrinho/${pecaId}`);
      await carregarCarrinho();
    } catch (err) {
      Swal.fire(
        "Erro",
        err.response?.data?.error || "Erro ao remover peça do carrinho",
        "error",
      );
    }
  };

  if (carregando) return <p className="text-gray-500">Carregando...</p>;

  return (
    <div className="bg-white rounded-xl shadow p-4 border border-gray-100">
      {carrinho.length === 0 ? (
        <EmptyState icon="🛒" title="Carrinho vazio" description="Nenhuma peça no seu carrinho no momento." />
      ) : (
        <table className="min-w-full divide-y divide-gray-200">
          <thead>
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Nome</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Categoria</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Qtd</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {carrinho.map((item) => {
              const pecaId = item.pecaId || item.id || item.Peca?.id;
              const nome = item.nome || item.Peca?.nome || item.peca?.nome || `Peça ${pecaId}`;
              const categoria = item.categoria || item.Peca?.categoria || item.peca?.categoria || "-";
              return (
                <tr key={pecaId}>
                  <td className="px-4 py-2 font-semibold text-gray-800">{nome}</td>
                  <td className="px-4 py-2 text-gray-700">{categoria}</td>
                  <td className="px-4 py-2 text-gray-700">{item.quantidade || 0}</td>
                  <td className="px-4 py-2">
                    <button
                      className="px-3 py-1 rounded text-xs font-semibold bg-red-500 hover:bg-red-600 text-white"
                      onClick={() => removerDoCarrinho(item)}
                    >
                      Remover
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

// --- Aba Carrinhos: gerenciar o carrinho de outros funcionários (admin/gerenciador) ---
function AbaCarrinhos() {
  const [funcionarios, setFuncionarios] = useState([]);
  const [funcionarioSelecionado, setFuncionarioSelecionado] = useState(null);
  const [carrinhoFuncionario, setCarrinhoFuncionario] = useState([]);
  const [pecasDisponiveis, setPecasDisponiveis] = useState([]);
  const [buscaFuncionario, setBuscaFuncionario] = useState("");
  const [buscaPeca, setBuscaPeca] = useState("");
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const carregarInicial = async () => {
      try {
        const [funcRes, pecasRes] = await Promise.all([
          api.get("/usuarios/funcionarios"),
          api.get("/pecas", { params: { all: true } }),
        ]);
        setFuncionarios(funcRes.data || []);
        setPecasDisponiveis(pecasRes.data || []);
      } catch (err) {
        console.error("Erro ao carregar dados de carrinhos:", err);
      } finally {
        setCarregando(false);
      }
    };
    carregarInicial();
  }, []);

  const carregarCarrinhoFuncionario = async (funcionarioId) => {
    try {
      const res = await api.get(`/usuarios/${funcionarioId}/carrinho`);
      setCarrinhoFuncionario(res.data || []);
    } catch (err) {
      console.error("Erro ao carregar carrinho do funcionário:", err);
      setCarrinhoFuncionario([]);
    }
  };

  useEffect(() => {
    if (funcionarioSelecionado) {
      carregarCarrinhoFuncionario(funcionarioSelecionado.id);
    }
  }, [funcionarioSelecionado]);

  const recarregarPecas = async () => {
    try {
      const res = await api.get("/pecas", { params: { all: true } });
      setPecasDisponiveis(res.data || []);
    } catch (err) {
      console.error("Erro ao recarregar peças:", err);
    }
  };

  const adicionarPecaAoCarrinho = async (pecaId) => {
    if (!funcionarioSelecionado) return;
    const peca = pecasDisponiveis.find((p) => p.id === pecaId);
    if (!peca || peca.quantidade === 0) {
      Swal.fire("Atenção", "Peça sem estoque disponível", "warning");
      return;
    }
    try {
      await api.post(`/usuarios/${funcionarioSelecionado.id}/carrinho`, {
        pecaId: String(pecaId),
        quantidade: 1,
      });
      await Promise.all([
        carregarCarrinhoFuncionario(funcionarioSelecionado.id),
        recarregarPecas(),
      ]);
    } catch (err) {
      Swal.fire(
        "Erro",
        err.response?.data?.error || "Erro ao adicionar peça ao carrinho",
        "error",
      );
    }
  };

  const removerPecaDoCarrinho = async (pecaId) => {
    if (!funcionarioSelecionado) return;
    const confirmacao = await Swal.fire({
      icon: "warning",
      title: "Remover peça",
      text: "Deseja realmente remover esta peça do carrinho? Ela será devolvida ao estoque.",
      showCancelButton: true,
      confirmButtonText: "Sim, remover",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#dc2626",
    });
    if (!confirmacao.isConfirmed) {
      return;
    }
    try {
      await api.delete(`/usuarios/${funcionarioSelecionado.id}/carrinho/${pecaId}`);
      await Promise.all([
        carregarCarrinhoFuncionario(funcionarioSelecionado.id),
        recarregarPecas(),
      ]);
    } catch (err) {
      Swal.fire(
        "Erro",
        err.response?.data?.error || "Erro ao remover peça do carrinho",
        "error",
      );
    }
  };

  const funcionariosFiltrados = funcionarios.filter(
    (f) =>
      f.nome?.toLowerCase().includes(buscaFuncionario.toLowerCase()) ||
      f.email?.toLowerCase().includes(buscaFuncionario.toLowerCase()),
  );

  const pecasFiltradas = pecasDisponiveis.filter(
    (p) =>
      p.nome?.toLowerCase().includes(buscaPeca.toLowerCase()) ||
      p.codigo?.toLowerCase().includes(buscaPeca.toLowerCase()),
  );

  const carrinhoPorPecaId = carrinhoFuncionario.reduce((acc, item) => {
    const pecaId = String(item.pecaId || item.Peca?.id || item.peca?.id || "");
    if (!pecaId) return acc;
    acc[pecaId] = (acc[pecaId] || 0) + Number(item.quantidade || 0);
    return acc;
  }, {});

  const pecasNoCarrinhoComZero = pecasDisponiveis.map((peca) => ({
    ...peca,
    quantidadeCarrinho: carrinhoPorPecaId[String(peca.id)] || 0,
  }));

  if (carregando) return <p className="text-gray-500">Carregando...</p>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="bg-white rounded-lg shadow p-6 border border-gray-100">
        <h3 className="text-lg font-bold text-gray-800 mb-4">👥 Funcionários</h3>
        <input
          type="text"
          className="input-field w-full mb-4"
          placeholder="Buscar funcionário..."
          value={buscaFuncionario}
          onChange={(e) => setBuscaFuncionario(e.target.value)}
        />
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {funcionariosFiltrados.length === 0 ? (
            <p className="text-gray-500 text-sm">Nenhum funcionário encontrado</p>
          ) : (
            funcionariosFiltrados.map((func) => (
              <button
                key={func.id}
                onClick={() => setFuncionarioSelecionado(func)}
                className={`w-full text-left p-3 rounded-lg transition-all ${
                  funcionarioSelecionado?.id === func.id
                    ? "bg-indigo-100 border-2 border-indigo-500"
                    : "bg-gray-50 border border-gray-200 hover:bg-gray-100"
                }`}
              >
                <div className="font-semibold text-gray-800">{func.nome}</div>
                <div className="text-xs text-gray-500">{func.email}</div>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 border border-gray-100">
        <h3 className="text-lg font-bold text-gray-800 mb-4">
          🛒 Carrinho{funcionarioSelecionado && ` - ${funcionarioSelecionado.nome}`}
        </h3>
        {!funcionarioSelecionado ? (
          <p className="text-gray-500 text-sm text-center py-8">
            Selecione um funcionário para ver o carrinho
          </p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {pecasNoCarrinhoComZero
              .filter((p) => p.quantidadeCarrinho > 0)
              .map((peca) => (
                <div
                  key={peca.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div>
                    <div className="font-semibold text-gray-800">{peca.nome}</div>
                    <div className="text-xs text-gray-600">
                      Quantidade: <strong>{peca.quantidadeCarrinho}</strong>
                    </div>
                  </div>
                  <button
                    onClick={() => removerPecaDoCarrinho(peca.id)}
                    className="ml-2 px-3 py-1 rounded text-sm bg-red-500 hover:bg-red-600 text-white"
                  >
                    ❌
                  </button>
                </div>
              ))}
            {pecasNoCarrinhoComZero.every((p) => p.quantidadeCarrinho === 0) && (
              <p className="text-gray-500 text-sm">Carrinho vazio.</p>
            )}
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow p-6 border border-gray-100">
        <h3 className="text-lg font-bold text-gray-800 mb-4">🔧 Peças Disponíveis</h3>
        <input
          type="text"
          className="input-field w-full mb-4"
          placeholder="Buscar peça..."
          value={buscaPeca}
          onChange={(e) => setBuscaPeca(e.target.value)}
        />
        {!funcionarioSelecionado ? (
          <p className="text-gray-500 text-sm text-center py-8">
            Selecione um funcionário para adicionar peças
          </p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {pecasFiltradas.length === 0 ? (
              <p className="text-gray-500 text-sm">Nenhuma peça disponível</p>
            ) : (
              pecasFiltradas.map((peca) => (
                <div
                  key={peca.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div>
                    <div className="font-semibold text-gray-800">{peca.nome}</div>
                    <div
                      className={`text-xs mt-1 ${
                        peca.quantidade > 10
                          ? "text-green-600"
                          : peca.quantidade > 0
                            ? "text-yellow-600"
                            : "text-red-600"
                      }`}
                    >
                      Estoque: <strong>{peca.quantidade}</strong>
                    </div>
                  </div>
                  <button
                    onClick={() => adicionarPecaAoCarrinho(peca.id)}
                    disabled={peca.quantidade === 0}
                    className={`ml-2 px-3 py-1 rounded text-sm ${
                      peca.quantidade === 0
                        ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                        : "bg-green-500 hover:bg-green-600 text-white"
                    }`}
                  >
                    ➕
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ModalEditarPeca({ peca, onFechar, onSalvar }) {
  const [formData, setFormData] = useState({
    nome: peca.nome || "",
    categoria: peca.categoria || "",
    quantidade: peca.quantidade ?? 0,
    descricao: peca.descricao || "",
    preco: peca.preco || "",
    ativo: peca.ativo !== false,
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.nome || !formData.categoria) {
      Swal.fire("Atenção", "Nome e Categoria são obrigatórios!", "warning");
      return;
    }
    if (formData.quantidade < 0) {
      Swal.fire("Atenção", "Quantidade não pode ser negativa!", "warning");
      return;
    }
    onSalvar(formData);
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onFechar}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-linear-to-r from-blue-600 to-purple-600 text-white px-6 py-4 flex justify-between items-center rounded-t-xl">
          <h2 className="text-2xl font-bold">✏️ Editar Peça</h2>
          <button onClick={onFechar} className="text-white hover:text-gray-200 text-3xl leading-none">×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Nome da Peça *</label>
              <input
                type="text"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                required
                className="input-field w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Categoria *</label>
              <input
                type="text"
                value={formData.categoria}
                onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                required
                className="input-field w-full"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Quantidade em Estoque *</label>
                <input
                  type="number"
                  value={formData.quantidade}
                  onChange={(e) =>
                    setFormData({ ...formData, quantidade: e.target.value === "" ? 0 : parseInt(e.target.value, 10) })
                  }
                  min="0"
                  required
                  className="input-field w-full text-center font-bold"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Preço Unitário (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.preco}
                  onChange={(e) => setFormData({ ...formData, preco: e.target.value })}
                  min="0"
                  className="input-field w-full"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Descrição</label>
              <textarea
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                rows="3"
                className="input-field w-full"
              />
            </div>
            <div className="flex items-center space-x-3 p-4 bg-blue-50 rounded-lg">
              <input
                type="checkbox"
                id="ativo"
                checked={formData.ativo}
                onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
                className="w-5 h-5 rounded cursor-pointer"
              />
              <label htmlFor="ativo" className="cursor-pointer font-medium text-gray-700">
                Peça ativa no sistema
              </label>
            </div>
          </div>
          <div className="sticky bottom-0 bg-gray-50 px-6 py-4 flex justify-end gap-3 border-t rounded-b-xl">
            <button type="button" onClick={onFechar} className="btn-secondary">Cancelar</button>
            <button type="submit" className="btn-primary">💾 Salvar Alterações</button>
          </div>
        </form>
      </div>
    </div>
  );
}

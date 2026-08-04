import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import api from "../services/api";
import { useFilteredList } from "../hooks/useFilteredList";
import { ListFilterBar, FilterField } from "../components/ListFilterBar";
import { PaginationControls } from "../components/PaginationControls";
import { EmptyState } from "../components/Loading";

export function Usuarios() {
  const listaUsuarios = useFilteredList({
    fetcher: (filtros, paginacao) =>
      api.get("/usuarios", {
        params: {
          role: filtros.role || undefined,
          ativo: filtros.ativo || undefined,
          busca: filtros.busca || undefined,
          ...paginacao,
        },
      }),
    initialFilters: { role: "", ativo: "true", busca: "" },
    pageSize: 20,
  });

  const handleDesativar = async (id) => {
    if (!window.confirm("Deseja realmente desativar este usuário?")) return;

    try {
      await api.delete(`/usuarios/${id}`);
      listaUsuarios.goToPage(listaUsuarios.pagination.page);
    } catch (error) {
      alert(error.response?.data?.error || "Erro ao desativar usuário");
    }
  };

  const handleReativar = async (id) => {
    try {
      await api.patch(`/usuarios/${id}/reativar`);
      listaUsuarios.goToPage(listaUsuarios.pagination.page);
    } catch (error) {
      alert(error.response?.data?.error || "Erro ao reativar usuário");
    }
  };

  const usuarios = listaUsuarios.data;

  return (
    <div className="min-h-screen bg-background-light">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Gestão de Usuários
          </h1>
          <Link to="/usuarios/novo" className="btn-primary">
            ➕ Novo Usuário
          </Link>
        </div>

        <ListFilterBar
          onSearch={listaUsuarios.search}
          onReset={listaUsuarios.resetFilters}
          loading={listaUsuarios.loading}
        >
          <FilterField label="Buscar">
            <input
              type="text"
              className="input-field"
              placeholder="Nome ou email..."
              value={listaUsuarios.filters.busca}
              onChange={(e) => listaUsuarios.setFilter("busca", e.target.value)}
            />
          </FilterField>

          <FilterField label="Perfil">
            <select
              className="input-field"
              value={listaUsuarios.filters.role}
              onChange={(e) => listaUsuarios.setFilter("role", e.target.value)}
            >
              <option value="">Todos</option>
              <option value="ADMIN">Administrador</option>
              <option value="FUNCIONARIO">Funcionário Abastecedor</option>
              <option value="FUNCIONARIO_TODAS_LOJAS">
                Funcionário (todas as lojas)
              </option>
              <option value="ABASTECEDOR">Abastecedor</option>
              <option value="CONTROLADOR_ESTOQUE">
                Controlador de Estoque
              </option>
              <option value="GERENCIADOR">Gerenciador</option>
            </select>
          </FilterField>

          <FilterField label="Status">
            <select
              className="input-field"
              value={listaUsuarios.filters.ativo}
              onChange={(e) => listaUsuarios.setFilter("ativo", e.target.value)}
            >
              <option value="">Todos</option>
              <option value="true">Ativos</option>
              <option value="false">Inativos</option>
            </select>
          </FilterField>
        </ListFilterBar>

        {!listaUsuarios.hasSearched ? (
          <EmptyState
            icon="🔍"
            title="Use os filtros para buscar"
            message="Escolha um perfil/status e clique em Buscar para ver os usuários cadastrados."
          />
        ) : (
          <div className="card">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Nome
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Perfil
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {usuarios.map((usuario) => (
                    <tr key={usuario.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-gray-900">
                          {usuario.nome}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                        {usuario.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            usuario.role === "ADMIN"
                              ? "bg-primary/20 text-primary"
                              : usuario.role === "CONTROLADOR_ESTOQUE"
                                ? "bg-cyan-100 text-cyan-800"
                                : usuario.role === "GERENCIADOR"
                                  ? "bg-amber-100 text-amber-800"
                                  : usuario.role === "FUNCIONARIO_TODAS_LOJAS"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : usuario.role === "ABASTECEDOR"
                                      ? "bg-orange-100 text-orange-800"
                                      : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {usuario.role === "ADMIN"
                            ? "Admin"
                            : usuario.role === "CONTROLADOR_ESTOQUE"
                              ? "Controlador de Estoque"
                              : usuario.role === "GERENCIADOR"
                                ? "Gerenciador"
                                : usuario.role === "FUNCIONARIO_TODAS_LOJAS"
                                  ? "Funcionário (todos os pontos)"
                                  : usuario.role === "ABASTECEDOR"
                                    ? "Abastecedor"
                                    : "Funcionário Abastecedor"}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {usuario.ativo ? (
                          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                            Ativo
                          </span>
                        ) : (
                          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">
                            Inativo
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex space-x-2">
                          <Link
                            to={`/usuarios/${usuario.id}/editar`}
                            className="text-primary hover:text-primary-light font-semibold"
                          >
                            Editar
                          </Link>
                          {usuario.ativo ? (
                            <button
                              onClick={() => handleDesativar(usuario.id)}
                              className="text-red-600 hover:text-red-800 font-semibold"
                            >
                              Desativar
                            </button>
                          ) : (
                            <button
                              onClick={() => handleReativar(usuario.id)}
                              className="text-green-600 hover:text-green-800 font-semibold"
                            >
                              Reativar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {usuarios.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  Nenhum usuário encontrado
                </div>
              )}
            </div>
            <PaginationControls
              pagination={listaUsuarios.pagination}
              onPageChange={listaUsuarios.goToPage}
              loading={listaUsuarios.loading}
            />
          </div>
        )}
      </div>
    </div>
  );
}

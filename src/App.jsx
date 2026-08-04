import React, { Suspense, lazy } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext.jsx";
import { PrivateRoute } from "./components/PrivateRoute";
import { Login } from "./pages/Login";
import { Registrar } from "./pages/Registrar";
import { Dashboard } from "./pages/Dashboard";
import { Usuarios } from "./pages/Usuarios";
import { UsuarioForm } from "./pages/UsuarioForm";
import { Lojas } from "./pages/Lojas";
import { LojaForm } from "./pages/LojaForm";
import { LojaDetalhes } from "./pages/LojaDetalhes";
import EstoqueDepositoPrincipal from "./pages/EstoqueDepositoPrincipal.jsx";
import { Maquinas } from "./pages/Maquinas";
import { MaquinaForm } from "./pages/MaquinaForm";
import { MaquinaDetalhes } from "./pages/MaquinaDetalhes";
import { Produtos } from "./pages/Produtos";
import { ProdutoForm } from "./pages/ProdutoForm";
import { Movimentacoes } from "./pages/Movimentacoes";
import { Graficos } from "./pages/Graficos";
import { Relatorios } from "./pages/Relatorios";
import { StyleGuide } from "./pages/StyleGuide";
import { Roteiros } from "./pages/Roteiros";
import RoteiroExecucao from "./pages/RoteiroExecucao";
import RoteiroAndamento from "./pages/RoteiroAndamento";
import MovimentacaoMaquina from "./pages/MovimentacaoMaquina";
import Manutencoes from "./pages/Manutencoes.jsx";
import PecasPage from "./pages/PecasPage.jsx";
import PecasForm from "./pages/PecasForm.jsx";
import Veiculos from "./pages/Veiculos";
import RevisoesPendentes from "./pages/RevisoesPendentes.jsx";
import FinanceiroRoutes from "./pages/FinanceiroRoutes.jsx";
import Alertas from "./pages/Alertas";
import SecurityLockPage from "./pages/SecurityLockPage.jsx";
import GerenciarCarrinhosPage from "./pages/GerenciarCarrinhosPage.jsx";
import { QuebraOrdemPage } from "./pages/QuebraOrdemPage.jsx";
import EstoqueUsuarios from "./pages/EstoqueUsuarios.jsx";
import FluxoCaixa from "./pages/FluxoCaixa.jsx";
import PecasDefeituosasDashboard from "./pages/PecasDefeituosasDashboard.jsx";
import PecasDefeituosasAdminPage from "./pages/PecasDefeituosasAdminPage.jsx";
import "./App.css";

const CarrinhoDetalhePage = lazy(
  () => import("./pages/CarrinhoDetalhePage.jsx"),
);

function AppRoutes() {
  // ...existing code...
  const { usuario } = useAuth();
  const location = useLocation();

  // Se usuário MANUTENCAO tentar acessar rota diferente de /pecas, redireciona
  if (
    usuario?.role === "MANUTENCAO" &&
    location.pathname !== "/pecas" &&
    location.pathname !== "/manutencoes"
  ) {
    return <Navigate to="/pecas" replace />;
  }

  return (
    <Routes>
      <Route path="/controle-seguranca" element={<SecurityLockPage />} />
      <Route
        path="/quebra-ordem"
        element={
          <PrivateRoute>
            <QuebraOrdemPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/manutencoes"
        element={
          <PrivateRoute>
            <Manutencoes />
          </PrivateRoute>
        }
      />
      <Route
        path="/financeiro/*"
        element={
          <PrivateRoute deniedRoles={["GERENCIADOR"]}>
            <FinanceiroRoutes />
          </PrivateRoute>
        }
      />
      <Route
        path="/veiculos"
        element={
          <PrivateRoute deniedRoles={["FUNCIONARIO", "ABASTECEDOR"]}>
            <Veiculos />
          </PrivateRoute>
        }
      />
      <Route
        path="/veiculos/revisoes-pendentes"
        element={
          <PrivateRoute deniedRoles={["FUNCIONARIO", "ABASTECEDOR"]}>
            <RevisoesPendentes />
          </PrivateRoute>
        }
      />
      <Route path="/login" element={<Login />} />
      <Route
        path="/alertas"
        element={
          <PrivateRoute adminOnly>
            <Alertas />
          </PrivateRoute>
        }
      />
      <Route path="/registrar" element={<Registrar />} />
      <Route path="/style-guide" element={<StyleGuide />} />
      <Route path="/roteiros" element={<Roteiros />} />
      <Route
        path="/roteiros/:id/andamento"
        element={
          <PrivateRoute>
            <RoteiroAndamento />
          </PrivateRoute>
        }
      />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Dashboard />
          </PrivateRoute>
        }
      />
      <Route
        path="/dashboard/pecas-defeituosas"
        element={
          <PrivateRoute
            allowedRoles={[
              "FUNCIONARIO",
              "FUNCIONARIO_TODAS_LOJAS",
              "ABASTECEDOR",
            ]}
          >
            <PecasDefeituosasDashboard />
          </PrivateRoute>
        }
      />
      <Route
        path="/admin/pecas-defeituosas"
        element={
          <PrivateRoute adminOnly>
            <PecasDefeituosasAdminPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/usuarios"
        element={
          <PrivateRoute adminOnly>
            <Usuarios />
          </PrivateRoute>
        }
      />
      <Route
        path="/usuarios/novo"
        element={
          <PrivateRoute adminOnly>
            <UsuarioForm />
          </PrivateRoute>
        }
      />
      <Route
        path="/usuarios/:id/editar"
        element={
          <PrivateRoute adminOnly>
            <UsuarioForm />
          </PrivateRoute>
        }
      />
      <Route
        path="/lojas"
        element={
          <PrivateRoute deniedRoles={["FUNCIONARIO", "ABASTECEDOR"]}>
            <Lojas />
          </PrivateRoute>
        }
      />
      <Route
        path="/lojas/:id"
        element={
          <PrivateRoute deniedRoles={["FUNCIONARIO", "ABASTECEDOR"]}>
            <LojaDetalhes />
          </PrivateRoute>
        }
      />
      <Route
        path="/lojas/nova"
        element={
          <PrivateRoute deniedRoles={["FUNCIONARIO", "ABASTECEDOR"]}>
            <LojaForm />
          </PrivateRoute>
        }
      />
      <Route
        path="/lojas/:id/editar"
        element={
          <PrivateRoute deniedRoles={["FUNCIONARIO", "ABASTECEDOR"]}>
            <LojaForm />
          </PrivateRoute>
        }
      />
      <Route
        path="/deposito-principal"
        element={
          <PrivateRoute>
            <EstoqueDepositoPrincipal />
          </PrivateRoute>
        }
      />
      <Route
        path="/maquinas"
        element={
          <PrivateRoute deniedRoles={["FUNCIONARIO", "ABASTECEDOR"]}>
            <Maquinas />
          </PrivateRoute>
        }
      />
      <Route
        path="/maquinas/nova"
        element={
          <PrivateRoute deniedRoles={["FUNCIONARIO", "ABASTECEDOR"]}>
            <MaquinaForm />
          </PrivateRoute>
        }
      />
      <Route
        path="/maquinas/:id/editar"
        element={
          <PrivateRoute deniedRoles={["FUNCIONARIO", "ABASTECEDOR"]}>
            <MaquinaForm />
          </PrivateRoute>
        }
      />
      <Route
        path="/maquinas/:id"
        element={
          <PrivateRoute deniedRoles={["FUNCIONARIO", "ABASTECEDOR"]}>
            <MaquinaDetalhes />
          </PrivateRoute>
        }
      />
      <Route
        path="/produtos"
        element={
          <PrivateRoute>
            <Produtos />
          </PrivateRoute>
        }
      />
      <Route
        path="/produtos/novo"
        element={
          <PrivateRoute>
            <ProdutoForm />
          </PrivateRoute>
        }
      />
      <Route
        path="/produtos/:id/editar"
        element={
          <PrivateRoute>
            <ProdutoForm />
          </PrivateRoute>
        }
      />
      <Route
        path="/movimentacoes"
        element={
          <PrivateRoute>
            <Movimentacoes />
          </PrivateRoute>
        }
      />
      <Route
        path="/estoque-usuarios"
        element={
          <PrivateRoute>
            <EstoqueUsuarios />
          </PrivateRoute>
        }
      />
      <Route
        path="/graficos"
        element={
          <PrivateRoute adminOnly>
            <Graficos />
          </PrivateRoute>
        }
      />
      <Route
        path="/relatorios"
        element={
          <PrivateRoute allowedRoles={["ADMIN"]}>
            <Relatorios />
          </PrivateRoute>
        }
      />
      <Route
        path="/pecas"
        element={
          <PrivateRoute
            allowedRoles={[
              "ADMIN",
              "MANUTENCAO",
              "GERENCIADOR",
              "FUNCIONARIO",
              "FUNCIONARIO_TODAS_LOJAS",
              "ABASTECEDOR",
              "CONTROLADOR_ESTOQUE",
            ]}
          >
            <PecasPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/pecas/nova"
        element={
          <PrivateRoute
            allowedRoles={["ADMIN", "GERENCIADOR", "CONTROLADOR_ESTOQUE"]}
          >
            <PecasForm />
          </PrivateRoute>
        }
      />
      <Route
        path="/gerenciar-carrinhos"
        element={
          <PrivateRoute adminOnly>
            <GerenciarCarrinhosPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/carrinho/:funcionarioId"
        element={
          <PrivateRoute adminOnly>
            <Suspense fallback={<div>Carregando...</div>}>
              <CarrinhoDetalhePage />
            </Suspense>
          </PrivateRoute>
        }
      />
      <Route
        path="/fluxo-caixa"
        element={
          <PrivateRoute deniedRoles={["GERENCIADOR"]}>
            <FluxoCaixa />
          </PrivateRoute>
        }
      />
      <Route path="/roteiros/:id/executar" element={<RoteiroExecucao />} />
      <Route
        path="/roteiros/:roteiroId/lojas/:lojaId/maquinas/:maquinaId/movimentacao"
        element={<MovimentacaoMaquina />}
      />
      {/* <Route path="*" element={<Navigate to="/" />} /> */}
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;

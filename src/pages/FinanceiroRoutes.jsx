
import React from "react";
import { Routes, Route } from "react-router-dom";
import DashboardPage from "./DashboardPageFinanceiro.jsx";
import BillsPage from "./BillsPage.jsx";
import AvisosVencimento from "./AvisosVencimento.jsx";

function FinanceiroRoutes() {
  return (
    <Routes>
      <Route path="" element={<DashboardPage />} />
      <Route path="dashboard" element={<DashboardPage />} />
      <Route path="contas/:type" element={<BillsPage />} />
      <Route path="avisos" element={<AvisosVencimento />} />
      {/* <Route path="*" element={<Navigate to="/financeiro" />} /> */}
    </Routes>
  );
}

export default FinanceiroRoutes;


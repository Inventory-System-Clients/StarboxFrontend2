
import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import DashboardPage from "./DashboardPageFinanceiro.jsx";
import BillsPage from "./BillsPage.jsx";

function FinanceiroRoutes() {
  return (
    <Routes>
      <Route path="" element={<DashboardPage />} />
      <Route path="dashboard" element={<DashboardPage />} />
      <Route path="contas/:type" element={<BillsPage />} />
      {/* Avisos de vencimento agora vivem na central de Alertas (/alertas) */}
      <Route path="avisos" element={<Navigate to="/alertas" replace />} />
      {/* <Route path="*" element={<Navigate to="/financeiro" />} /> */}
    </Routes>
  );
}

export default FinanceiroRoutes;


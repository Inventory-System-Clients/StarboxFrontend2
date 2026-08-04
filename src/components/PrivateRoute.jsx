import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export function PrivateRoute({
  children,
  adminOnly = false,
  deniedRoles = [],
  allowedRoles = [],
}) {
  const { signed, loading, isAdmin, usuario } = useAuth();
  const hasAdminPrivileges = isAdmin() || usuario?.role === "GERENCIADOR";

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#62A1D9]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#24094E]"></div>
      </div>
    );
  }

  if (!signed) {
    return <Navigate to="/login" />;
  }

  if (adminOnly && !hasAdminPrivileges) {
    return <Navigate to="/" />;
  }

  if (
    Array.isArray(deniedRoles) &&
    deniedRoles.length > 0 &&
    deniedRoles.includes(usuario?.role)
  ) {
    return <Navigate to="/" />;
  }

  if (
    Array.isArray(allowedRoles) &&
    allowedRoles.length > 0 &&
    !allowedRoles.includes(usuario?.role)
  ) {
    return <Navigate to="/" />;
  }

  return children;
}

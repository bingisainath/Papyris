
import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthProvider";
import { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

export const RequireAuth = ({ children }: Props) => {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

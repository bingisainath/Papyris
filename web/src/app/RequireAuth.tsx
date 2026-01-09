// import { Navigate } from "react-router-dom";
// import { useAuth } from "./AuthProvider";

// export const RequireAuth = ({ children }: { children: React.ReactNode }) => {
//   const { isAuthenticated, isLoading } = useAuth();
//   if (isLoading) return <div>Loading...</div>;
//   if (!isAuthenticated) return <Navigate to="/login" replace />;
//   return <>{children}</>;
// };

// src/app/RequireAuth.tsx
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { Loading } from '../components/atoms';

interface RequireAuthProps {
  children: React.ReactNode;
}

export const RequireAuth: React.FC<RequireAuthProps> = ({ children }) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-muted-50 to-primary-50/20">
        <Loading variant="spinner" size="xl" text="Loading..." />
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Render protected content
  return <>{children}</>;
};
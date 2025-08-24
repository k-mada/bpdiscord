import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    
    if (!token) {
      // Store the current path to redirect back after login
      localStorage.setItem("redirectAfterLogin", location.pathname);
      // Use replace: true to avoid creating a history entry that would cause back button loops
      navigate("/login", { replace: true });
      setIsAuthenticated(false);
    } else {
      setIsAuthenticated(true);
    }
  }, [navigate, location.pathname]);

  // Show loading while checking authentication
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-letterboxd-bg-primary flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-letterboxd-accent"></div>
      </div>
    );
  }

  // Render children if authenticated
  return isAuthenticated ? <>{children}</> : null;
};

export default ProtectedRoute;
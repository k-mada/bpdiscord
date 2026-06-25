import React, { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = useAuth();

  useEffect(() => {
    if (!token) {
      // Stash the target so login can bounce the user back here.
      localStorage.setItem("redirectAfterLogin", location.pathname);
      // replace: true avoids a history entry that would cause back-button loops.
      navigate("/login", { replace: true });
    }
  }, [token, navigate, location.pathname]);

  return token ? <>{children}</> : null;
};

export default ProtectedRoute;

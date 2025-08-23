import React, { useState, useEffect } from "react";
import {
  Routes,
  Route,
  useNavigate,
  useLocation,
  Navigate,
} from "react-router-dom";
import ScraperInterface from "./ScraperInterface";
import UserProfile from "./UserProfile";
import UserComparison from "./UserComparison";
import HaterRankings from "./HaterRankings";
import Header from "./Header";

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    const storedUser = localStorage.getItem("user");

    console.log(
      "Dashboard: Retrieved token from localStorage, length:",
      storedToken?.length
    );
    console.log("Dashboard: Token starts with:", storedToken?.substring(0, 20));

    if (!storedToken) {
      console.log("Dashboard: No token found, redirecting to login");
      navigate("/login");
      return;
    }

    setToken(storedToken);
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, [navigate]);

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  const handleNavigateToProfile = () => {
    navigate("/dashboard/profile");
  };

  if (!token) {
    return null; // Will redirect to login
  }

  return (
    <div className="min-h-screen bg-letterboxd-bg-primary">
      <Header 
        isAuthenticated={true} 
        onLogout={handleLogout} 
      />

      <main className="max-w-7xl mx-auto px-6 py-8">
        <Routes>
          <Route
            path="/profile"
            element={
              <UserProfile
                user={user}
                onLogout={handleLogout}
                onNavigateToScraper={() => navigate("/dashboard/fetcher")}
                onNavigateToComparison={() => navigate("/compare")}
              />
            }
          />
          <Route path="/fetcher" element={<ScraperInterface token={token} />} />
          <Route
            path="/compare"
            element={
              <UserComparison onBackToProfile={handleNavigateToProfile} />
            }
          />
          <Route
            path="/hater-rankings"
            element={
              <HaterRankings
                onBackToProfile={handleNavigateToProfile}
                isPublic={false}
              />
            }
          />
          <Route
            path="/"
            element={<Navigate to="/dashboard/profile" replace />}
          />
        </Routes>
      </main>
    </div>
  );
};

export default Dashboard;

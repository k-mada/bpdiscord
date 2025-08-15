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

  const handleNavigateToFetcher = () => {
    navigate("/dashboard/fetcher");
  };

  const handleNavigateToComparison = () => {
    navigate("/dashboard/compare");
  };

  const handleNavigateToHaterRankings = () => {
    navigate("/dashboard/hater-rankings");
  };

  if (!token) {
    return null; // Will redirect to login
  }

  return (
    <div className="min-h-screen bg-letterboxd-bg-primary">
      <header className="bg-letterboxd-bg-secondary border-b border-letterboxd-border px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold text-letterboxd-text-primary">
            BPDiscord
          </h1>
          <div className="flex items-center space-x-4">
            <button
              onClick={handleNavigateToProfile}
              className={`transition-colors duration-200 ${
                location.pathname === "/dashboard/profile"
                  ? "text-letterboxd-text-primary"
                  : "text-letterboxd-text-secondary hover:text-letterboxd-text-primary"
              }`}
            >
              Profile
            </button>
            <button
              onClick={handleNavigateToFetcher}
              className={`transition-colors duration-200 ${
                location.pathname === "/dashboard/fetcher"
                  ? "text-letterboxd-text-primary"
                  : "text-letterboxd-text-secondary hover:text-letterboxd-text-primary"
              }`}
            >
              Data Fetcher
            </button>
            <button
              onClick={handleNavigateToComparison}
              className={`transition-colors duration-200 ${
                location.pathname === "/dashboard/compare"
                  ? "text-letterboxd-text-primary"
                  : "text-letterboxd-text-secondary hover:text-letterboxd-text-primary"
              }`}
            >
              Compare
            </button>
            <button
              onClick={handleNavigateToHaterRankings}
              className={`transition-colors duration-200 ${
                location.pathname === "/dashboard/hater-rankings"
                  ? "text-letterboxd-text-primary"
                  : "text-letterboxd-text-secondary hover:text-letterboxd-text-primary"
              }`}
            >
              Hater Rankings
            </button>
            <button onClick={handleLogout} className="btn-secondary">
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <Routes>
          <Route
            path="/profile"
            element={
              <UserProfile
                user={user}
                onLogout={handleLogout}
                onNavigateToScraper={handleNavigateToFetcher}
                onNavigateToComparison={handleNavigateToComparison}
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

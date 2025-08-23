import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { HEADINGS } from "../constants";
import { Subheading } from "./Subheading";

interface HeaderProps {
  isAuthenticated?: boolean;
  onLogout?: () => void;
}

const Header: React.FC<HeaderProps> = ({
  isAuthenticated = false,
  onLogout,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [randomHeading, setRandomHeading] = useState<string>("");

  useEffect(() => {
    setRandomHeading(HEADINGS[Math.floor(Math.random() * HEADINGS.length)]);
  }, []);

  const handleNavigateToProfile = () => {
    navigate("/dashboard/profile");
  };

  const handleNavigateToFetcher = () => {
    navigate("/dashboard/fetcher");
  };

  const handleNavigateToComparison = () => {
    navigate("/compare");
  };

  const handleNavigateToHaterRankings = () => {
    navigate("/hater-rankings");
  };

  const handleNavigateToHome = () => {
    navigate("/");
  };

  const handleNavigateToLogin = () => {
    navigate("/login");
  };

  const isActivePath = (path: string): boolean => {
    return location.pathname === path || location.pathname.startsWith(path);
  };

  const getNavButtonClass = (path: string): string => {
    return `transition-colors duration-200 ${
      isActivePath(path)
        ? "text-letterboxd-text-primary"
        : "text-letterboxd-text-secondary hover:text-letterboxd-text-primary"
    }`;
  };

  return (
    <header className="bg-letterboxd-bg-secondary border-b border-letterboxd-border px-6 py-4">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <button
          onClick={handleNavigateToHome}
          className="text-2xl text-left font-bold text-letterboxd-text-primary hover:text-letterboxd-accent transition-colors duration-200"
        >
          <span>The Big Picture Discord</span>
          <Subheading />
        </button>

        <div className="flex items-center space-x-4">
          {/* Public navigation items */}
          <button
            onClick={handleNavigateToComparison}
            className={getNavButtonClass("/compare")}
          >
            Compare
          </button>
          <button
            onClick={handleNavigateToHaterRankings}
            className={getNavButtonClass("/hater-rankings")}
          >
            Hater Rankings
          </button>

          {/* Authenticated navigation items */}
          {isAuthenticated ? (
            <>
              <button
                onClick={handleNavigateToProfile}
                className={getNavButtonClass("/dashboard/profile")}
              >
                Profile
              </button>
              <button
                onClick={handleNavigateToFetcher}
                className={getNavButtonClass("/dashboard/fetcher")}
              >
                Data Fetcher
              </button>
              <button onClick={onLogout} className="btn-secondary">
                Logout
              </button>
            </>
          ) : (
            <button onClick={handleNavigateToLogin} className="btn-primary">
              Login
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;

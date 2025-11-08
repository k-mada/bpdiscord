import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Subheading } from "./Subheading";

const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    setIsAuthenticated(!!token);
  }, [location.pathname]); // Re-check on route changes

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setIsAuthenticated(false);
    navigate("/login");
  };

  const navigateTo = (path: string) => {
    navigate(path);
  };

  const isActivePath = (path: string): boolean => {
    return location.pathname === path || location.pathname.startsWith(path);
  };

  const getNavButtonClass = (path: string): string => {
    return `transition-colors duration-200 ${
      location.pathname === path
        ? "text-letterboxd-text-primary"
        : "text-letterboxd-text-secondary hover:text-letterboxd-text-primary"
    }`;
  };

  return (
    <header>
      <div className="max-w-5xl mx-auto flex justify-between items-center">
        <button
          onClick={() => navigateTo("/")}
          className="text-2xl text-left font-bold text-letterboxd-text-primary hover:text-letterboxd-accent transition-colors duration-200"
        >
          <span>The Big Picture Discord</span>
          <Subheading />
        </button>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center space-x-4">
          <button
            onClick={() => navigateTo("/compare")}
            className={getNavButtonClass("/compare")}
          >
            Compare
          </button>
          <button
            onClick={() => navigateTo("/hater-rankings")}
            className={getNavButtonClass("/hater-rankings")}
          >
            Hater Rankings
          </button>
          <button
            onClick={() => navigateTo("/dashboard")}
            className={getNavButtonClass("/dashboard")}
          >
            Dashboard
          </button>
          <button
            onClick={() => navigateTo("/profile")}
            className={getNavButtonClass("/profile")}
          >
            Profile
          </button>
          <button
            onClick={() => navigateTo("/fetcher")}
            className={getNavButtonClass("/fetcher")}
          >
            Data Fetcher
          </button>

          {isAuthenticated ? (
            <button onClick={handleLogout} className="btn-secondary">
              Logout
            </button>
          ) : (
            <button
              onClick={() => navigateTo("/login")}
              className="btn-primary"
            >
              Login
            </button>
          )}
        </div>

        {/* Mobile Hamburger Button */}
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="md:hidden flex flex-col items-center justify-center w-8 h-8 space-y-1"
          aria-label="Toggle menu"
        >
          <span
            className={`block w-6 h-0.5 bg-letterboxd-text-primary transition-all duration-300 ${
              isMobileMenuOpen ? "rotate-45 translate-y-2" : ""
            }`}
          />
          <span
            className={`block w-6 h-0.5 bg-letterboxd-text-primary transition-all duration-300 ${
              isMobileMenuOpen ? "opacity-0" : ""
            }`}
          />
          <span
            className={`block w-6 h-0.5 bg-letterboxd-text-primary transition-all duration-300 ${
              isMobileMenuOpen ? "-rotate-45 -translate-y-2" : ""
            }`}
          />
        </button>
      </div>

      {/* Mobile Navigation Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-letterboxd-border bg-letterboxd-bg-secondary">
          <div className="px-6 py-4 space-y-4">
            <button
              onClick={() => navigateTo("/compare")}
              className={`block w-full text-left py-2 ${getNavButtonClass(
                "/compare"
              )}`}
            >
              Compare
            </button>
            <button
              onClick={() => navigateTo("/hater-rankings")}
              className={`block w-full text-left py-2 ${getNavButtonClass(
                "/hater-rankings"
              )}`}
            >
              Hater Rankings
            </button>
            <button
              onClick={() => navigateTo("/dashboard")}
              className={`block w-full text-left py-2 ${getNavButtonClass(
                "/dashboard"
              )}`}
            >
              Dashboard
            </button>
            <button
              onClick={() => navigateTo("/profile")}
              className={`block w-full text-left py-2 ${getNavButtonClass(
                "/profile"
              )}`}
            >
              Profile
            </button>
            <button
              onClick={() => navigateTo("/fetcher")}
              className={`block w-full text-left py-2 ${getNavButtonClass(
                "/fetcher"
              )}`}
            >
              Data Fetcher
            </button>

            <div className="pt-2 border-t border-letterboxd-border">
              {isAuthenticated ? (
                <button onClick={handleLogout} className="btn-secondary w-full">
                  Logout
                </button>
              ) : (
                <button
                  onClick={() => navigateTo("/login")}
                  className="btn-primary w-full"
                >
                  Login
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;

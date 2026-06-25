import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Subheading } from "./Subheading";
import { useAuth } from "../contexts/AuthContext";

const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { token, user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  const isAuthenticated = !!token;
  const profilePath = user?.lbusername ? `/user/${user.lbusername}` : null;

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const getNavLinkClass = (path: string): string => {
    return `transition-colors duration-200 ${
      location.pathname === path
        ? "text-letterboxd-text-primary"
        : "text-letterboxd-text-secondary hover:text-letterboxd-text-primary"
    }`;
  };

  return (
    <header>
      <div className="max-w-5xl mx-auto flex justify-between items-center">
        <Link
          to="/"
          className="text-2xl text-left font-bold text-letterboxd-text-primary hover:text-letterboxd-accent transition-colors duration-200"
        >
          <span>The Big Picture Discord</span>
          <Subheading />
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center space-x-4">
          <Link to="/compare" className={getNavLinkClass("/compare")}>
            Compare
          </Link>
          <Link
            to="/hater-rankings"
            className={getNavLinkClass("/hater-rankings")}
          >
            Hater Rankings
          </Link>

          {profilePath && (
            <Link to={profilePath} className={getNavLinkClass(profilePath)}>
              Profile
            </Link>
          )}
          <Link to="/fetcher" className={getNavLinkClass("/fetcher")}>
            Data Fetcher
          </Link>

          {isAuthenticated ? (
            <button onClick={handleLogout} className="btn-secondary">
              Logout
            </button>
          ) : (
            <div className="flex gap-2">
              <Link to="/login" className="btn-secondary">
                Login
              </Link>
              <Link to="/signup" className="btn-primary">
                Sign Up
              </Link>
            </div>
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
            <Link
              to="/compare"
              className={`block w-full text-left py-2 ${getNavLinkClass(
                "/compare",
              )}`}
            >
              Compare
            </Link>
            <Link
              to="/hater-rankings"
              className={`block w-full text-left py-2 ${getNavLinkClass(
                "/hater-rankings",
              )}`}
            >
              Hater Rankings
            </Link>
            <Link
              to="/dashboard"
              className={`block w-full text-left py-2 ${getNavLinkClass(
                "/dashboard",
              )}`}
            >
              Dashboard
            </Link>
            {profilePath && (
              <Link
                to={profilePath}
                className={`block w-full text-left py-2 ${getNavLinkClass(
                  profilePath,
                )}`}
              >
                Profile
              </Link>
            )}
            <Link
              to="/fetcher"
              className={`block w-full text-left py-2 ${getNavLinkClass(
                "/fetcher",
              )}`}
            >
              Data Fetcher
            </Link>

            <div className="pt-2 border-t border-letterboxd-border space-y-2">
              {isAuthenticated ? (
                <button onClick={handleLogout} className="btn-secondary w-full">
                  Logout
                </button>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="btn-secondary w-full block text-center"
                  >
                    Login
                  </Link>
                  <Link
                    to="/signup"
                    className="btn-primary w-full block text-center"
                  >
                    Sign Up
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;

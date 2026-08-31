import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Subheading } from "./Subheading";
import { useAuth } from "../contexts/AuthContext";

const MOBILE_MENU_ID = "mobile-menu";

const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { token, user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  const isAuthenticated = !!token;
  const profilePath = user?.lbusername ? `/user/${user.lbusername}` : null;
  const isDevMode = import.meta.env.DEV;

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const navLinkProps = (path: string, extra = "") => {
    const isCurrent = location.pathname === path;
    return {
      className: `transition-colors duration-200 ${extra} ${
        isCurrent
          ? "text-letterboxd-text-primary"
          : "text-letterboxd-text-secondary hover:text-letterboxd-text-primary"
      }`,
      "aria-current": isCurrent ? ("page" as const) : undefined,
    };
  };

  const MOBILE_LINK = "block w-full text-left py-2";

  return (
    <header>
      {/* One landmark over both menus: two navs sharing a name is a duplicate. */}
      <nav aria-label="Main">
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
            <Link to="/compare" {...navLinkProps("/compare")}>
              Compare
            </Link>
            <Link to="/movie-swap" {...navLinkProps("/movie-swap")}>
              Movie Swap
            </Link>
            <Link to="/hater-rankings" {...navLinkProps("/hater-rankings")}>
              Hater Rankings
            </Link>

            {profilePath && (
              <Link to={profilePath} {...navLinkProps(profilePath)}>
                Profile
              </Link>
            )}
            {isDevMode && (
              <Link to="/fetcher" {...navLinkProps("/fetcher")}>
                Data Fetcher
              </Link>
            )}

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
            aria-expanded={isMobileMenuOpen}
            aria-controls={MOBILE_MENU_ID}
          >
            <span
              aria-hidden="true"
              className={`block w-6 h-0.5 bg-letterboxd-text-primary transition-all duration-300 ${
                isMobileMenuOpen ? "rotate-45 translate-y-2" : ""
              }`}
            />
            <span
              aria-hidden="true"
              className={`block w-6 h-0.5 bg-letterboxd-text-primary transition-all duration-300 ${
                isMobileMenuOpen ? "opacity-0" : ""
              }`}
            />
            <span
              aria-hidden="true"
              className={`block w-6 h-0.5 bg-letterboxd-text-primary transition-all duration-300 ${
                isMobileMenuOpen ? "-rotate-45 -translate-y-2" : ""
              }`}
            />
          </button>
        </div>

        {/* Mobile Navigation Menu */}
        {isMobileMenuOpen && (
          <div
            id={MOBILE_MENU_ID}
            className="md:hidden border-t border-letterboxd-border bg-letterboxd-bg-secondary"
          >
            <div className="px-6 py-4 space-y-4">
              <Link to="/compare" {...navLinkProps("/compare", MOBILE_LINK)}>
                Compare
              </Link>
              <Link
                to="/movie-swap"
                {...navLinkProps("/movie-swap", MOBILE_LINK)}
              >
                Movie Swap
              </Link>
              <Link
                to="/hater-rankings"
                {...navLinkProps("/hater-rankings", MOBILE_LINK)}
              >
                Hater Rankings
              </Link>
              <Link to="/dashboard" {...navLinkProps("/dashboard", MOBILE_LINK)}>
                Dashboard
              </Link>
              {profilePath && (
                <Link to={profilePath} {...navLinkProps(profilePath, MOBILE_LINK)}>
                  Profile
                </Link>
              )}
              <Link to="/fetcher" {...navLinkProps("/fetcher", MOBILE_LINK)}>
                Data Fetcher
              </Link>

              <div className="pt-2 border-t border-letterboxd-border space-y-2">
                {isAuthenticated ? (
                  <button
                    onClick={handleLogout}
                    className="btn-secondary w-full"
                  >
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
      </nav>
    </header>
  );
};

export default Header;

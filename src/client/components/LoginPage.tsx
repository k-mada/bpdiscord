import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import PasswordReset from "./PasswordReset";
import apiService from "../services/api";
import { AuthRequest, SignupRequest } from "../types";
import { Subheading } from "./Subheading";

const LoginPage = () => {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [formData, setFormData] = useState<SignupRequest>({
    name: "",
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loginRequired, setLoginRequired] = useState<boolean>(false);

  useEffect(() => {
    const redirectPath = localStorage.getItem("redirectAfterLogin");
    setLoginRequired(!!redirectPath);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      let response;
      if (isLogin) {
        const loginData: AuthRequest = {
          email: formData.email,
          password: formData.password,
        };
        response = await apiService.login(loginData);
      } else {
        response = await apiService.signup(formData);
      }

      if (response.data?.access_token) {
        console.log(
          "Storing token in localStorage, length:",
          response.data.access_token.length
        );
        localStorage.setItem("token", response.data.access_token);
        if (response.data.user) {
          localStorage.setItem("user", JSON.stringify(response.data.user));
        }
        // Redirect to the page the user was trying to access, or dashboard if none
        const redirectPath = localStorage.getItem("redirectAfterLogin") || "/dashboard";
        localStorage.removeItem("redirectAfterLogin");
        navigate(redirectPath);
      } else {
        console.error("No access token in response:", response);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const handleBackToLogin = () => {
    setShowPasswordReset(false);
    setError(null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  if (showPasswordReset) {
    return <PasswordReset onBackToLogin={handleBackToLogin} />;
  }

  return (
    <div className="min-h-screen bg-letterboxd-bg-primary flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-letterboxd-text-primary mb-2">
            The Big Picture Discord
          </h1>
          <Subheading />
        </header>

        <div className="card">
          <h2 className="text-2xl font-semibold text-letterboxd-text-primary mb-6 text-center">
            {isLogin ? "Login" : "Sign Up"}
          </h2>
          
          {loginRequired && (
            <div className="mb-4 p-3 bg-yellow-900/20 border border-yellow-600/30 rounded-md">
              <p className="text-yellow-200 text-sm text-center">
                Please login to access that page.
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <label
                  htmlFor="name"
                  className="block text-sm font-medium text-letterboxd-text-secondary mb-2"
                >
                  Name
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required={!isLogin}
                  disabled={loading}
                  className="input-field w-full"
                  placeholder="Enter your name"
                />
              </div>
            )}

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-letterboxd-text-secondary mb-2"
              >
                Email
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                required
                disabled={loading}
                className="input-field w-full"
                placeholder="Enter your email"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-letterboxd-text-secondary mb-2"
              >
                Password
              </label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                required
                disabled={loading}
                className="input-field w-full"
                placeholder="Enter your password"
              />
            </div>

            {error && (
              <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full mt-6"
            >
              {loading ? "Loading..." : isLogin ? "Login" : "Sign Up"}
            </button>
          </form>

          <div className="mt-6 text-center space-y-2">
            <p className="text-letterboxd-text-secondary">
              {isLogin
                ? "Don't have an account? "
                : "Already have an account? "}
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-letterboxd-accent hover:text-letterboxd-accent-hover font-medium transition-colors duration-200"
              >
                {isLogin ? "Sign Up" : "Login"}
              </button>
            </p>

            {isLogin && (
              <button
                type="button"
                onClick={() => setShowPasswordReset(true)}
                className="text-letterboxd-text-secondary hover:text-letterboxd-text-primary font-medium transition-colors duration-200"
              >
                Forgot your password?
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;

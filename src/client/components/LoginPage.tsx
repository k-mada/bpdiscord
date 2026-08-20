import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import apiService from "../services/api";
import { AuthRequest } from "../../shared/types";
import { Input } from "./ui/Input";
import { useAuth } from "../contexts/AuthContext";
import { Notification, Status } from "./ui/Notification";

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [formData, setFormData] = useState<AuthRequest>({
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [loginRequired, setLoginRequired] = useState<boolean>(false);
  const resetSuccess = Boolean(
    (location.state as { resetSuccess?: boolean } | null)?.resetSuccess,
  );
  const [status, setStatus] = useState<Status>(() =>
    resetSuccess
      ? {
          type: "success",
          message: "Password updated. Please log in with your new password.",
        }
      : { type: "idle" },
  );

  useEffect(() => {
    const redirectPath = localStorage.getItem("redirectAfterLogin");
    setLoginRequired(!!redirectPath);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus({ type: "idle" });

    try {
      const response = await apiService.login(formData);

      if (response.data?.access_token) {
        login(response.data.access_token);
        const redirectPath =
          localStorage.getItem("redirectAfterLogin") || "/dashboard";
        localStorage.removeItem("redirectAfterLogin");
        navigate(redirectPath);
      } else {
        console.error("No access token in response:", response);
      }
    } catch (err) {
      setStatus({
        type: "error",
        message: err instanceof Error ? err.message : "Authentication failed",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <div className="min-h-screen bg-letterboxd-bg-primary flex items-start mt-10 justify-center px-4">
      <div className="w-full max-w-md">
        <div className="card">
          <h2 className="text-2xl font-semibold text-letterboxd-text-primary mb-6 text-center">
            Log in to your account
          </h2>

          {loginRequired && (
            <div className="mb-4">
              <Notification
                status={{
                  type: "info",
                  message: "Please login to access that page.",
                }}
              />
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-letterboxd-text-secondary mb-2"
              >
                Email
              </label>
              <Input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                required
                disabled={loading}
                className="w-full"
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
              <Input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                required
                disabled={loading}
                className="w-full"
                placeholder="Enter your password"
              />
            </div>

            <Notification status={status} />

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full mt-6"
            >
              {loading ? "Loading..." : "Login"}
            </button>
          </form>

          <div className="mt-6 text-center space-y-2">
            <p className="text-letterboxd-text-secondary">
              Don't have an account?{" "}
              <Link
                to="/signup"
                className="text-letterboxd-accent hover:text-letterboxd-accent-hover font-medium transition-colors duration-200"
              >
                Sign Up
              </Link>
            </p>
            <Link to={"/forgot-password"}>Forgot your password?</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;

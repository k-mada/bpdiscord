import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import apiService from "../services/api";
import { SignupRequest } from "../../shared/types";
import { Subheading } from "./Subheading";
import { Input } from "./ui/Input";

const SignupPage = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<SignupRequest>({
    name: "",
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const response = await apiService.signup(formData);

      if (response.data?.access_token) {
        localStorage.setItem("token", response.data.access_token);
        if (response.data.user) {
          localStorage.setItem("user", JSON.stringify(response.data.user));
        }
        const redirectPath =
          localStorage.getItem("redirectAfterLogin") || "/dashboard";
        localStorage.removeItem("redirectAfterLogin");
        navigate(redirectPath);
        return;
      }

      // No access_token: signup succeeded but auto-login didn't run (most
      // common cause is Supabase requiring email confirmation). Surface the
      // server message so the user knows to check their email.
      if (response.message) {
        setMessage(response.message);
      } else {
        setError("Account created, but no session was issued. Please log in.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
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
            Sign Up
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium text-letterboxd-text-secondary mb-2"
              >
                Name
              </label>
              <Input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                required
                disabled={loading}
                className="w-full"
                placeholder="Enter your name"
              />
            </div>

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

            {error && (
              <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            {message && (
              <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
                <p className="text-green-400 text-sm">{message}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full mt-6"
            >
              {loading ? "Loading..." : "Sign Up"}
            </button>
          </form>

          <div className="mt-6 text-center space-y-2">
            <p className="text-letterboxd-text-secondary">
              Already have an account?{" "}
              <Link
                to="/login"
                className="text-letterboxd-accent hover:text-letterboxd-accent-hover font-medium transition-colors duration-200"
              >
                Login
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignupPage;

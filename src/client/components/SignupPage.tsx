import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import apiService from "../services/api";
import { SignupRequest } from "../../shared/types";
import { Input } from "./ui/Input";
import { useAuth } from "../contexts/AuthContext";

// Mirrors LBUSERNAME_FORMAT in src/server/lib/lbusername.ts. UX-only pre-check
// before round-trip; server remains the source of truth.
const LBUSERNAME_FORMAT = /^[a-z0-9_-]{2,15}$/;
const LBUSERNAME_FORMAT_MESSAGE =
  "2–15 characters; lowercase letters, numbers, hyphens, underscores only.";

const SignupPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [formData, setFormData] = useState<
    Required<Pick<SignupRequest, "name" | "email" | "password">> & {
      lbusername: string;
    }
  >({
    name: "",
    email: "",
    password: "",
    lbusername: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lbError, setLbError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setLbError(null);
    setMessage(null);

    const trimmedLb = formData.lbusername.trim().toLowerCase();

    // Empty is fine — field is optional. Only validate when the user typed
    // something.
    if (trimmedLb.length > 0 && !LBUSERNAME_FORMAT.test(trimmedLb)) {
      setLbError(LBUSERNAME_FORMAT_MESSAGE);
      setLoading(false);
      return;
    }

    // Build the payload without the lbusername key when empty, so the server
    // sees `undefined` (skip the linking flow entirely) rather than an empty
    // string (which would trip its format check).
    const payload: SignupRequest = {
      name: formData.name,
      email: formData.email,
      password: formData.password,
      ...(trimmedLb ? { lbusername: trimmedLb } : {}),
    };

    try {
      const response = await apiService.signup(payload);

      if (response.data?.access_token) {
        login(response.data.access_token);
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
      const raw = err instanceof Error ? err.message : "Signup failed";
      // Route the lbusername-claim conflict to the field-level error so it
      // appears next to the offending input, not the form-level banner.
      if (/already been claimed/i.test(raw)) {
        setLbError(raw);
      } else {
        setError(raw);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    if (e.target.name === "lbusername" && lbError) {
      setLbError(null);
    }
  };

  return (
    <div className="min-h-screen bg-letterboxd-bg-primary flex items-start mt-10 justify-center px-4">
      <div className="w-full max-w-md">
        <div className="card">
          <h2 className="text-2xl font-semibold text-letterboxd-text-primary mb-6 text-center">
            Create an account
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

            <div>
              <label
                htmlFor="lbusername"
                className="block text-sm font-medium text-letterboxd-text-secondary mb-2"
              >
                Letterboxd.com username
              </label>
              <Input
                type="text"
                id="lbusername"
                name="lbusername"
                value={formData.lbusername}
                onChange={handleInputChange}
                disabled={loading}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                aria-invalid={lbError ? true : undefined}
                aria-describedby="lbusername-help"
                className="w-full"
                placeholder="e.g. davidehrlich"
              />
              <p
                id="lbusername-help"
                className="text-xs text-letterboxd-text-muted mt-1"
              >
                Optional — link your Letterboxd account now or have an admin
                assign it later. We'll fetch your data automatically.
              </p>
              {lbError && (
                <p role="alert" className="text-xs text-red-400 mt-1">
                  {lbError}
                </p>
              )}
            </div>

            {error && (
              <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
                <p className="text-red-400 text-sm mb-0">{error}</p>
              </div>
            )}

            {message && (
              <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
                <p className="text-green-400 text-sm p-0">{message}</p>
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

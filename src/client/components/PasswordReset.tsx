import React, { useState } from "react";
import apiService from "../services/api";

interface PasswordResetProps {
  onBackToLogin: () => void;
}

const PasswordReset = ({ onBackToLogin }: PasswordResetProps) => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await apiService.requestPasswordReset(email);
      setSuccess(
        response.message ||
          "Password reset email sent. Please check your email.",
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to send reset email",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-letterboxd-bg-primary flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <h2 className="text-2xl font-semibold text-letterboxd-text-primary mb-6 text-center">
          Password Reset
        </h2>
        <p className="text-letterboxd-text-secondary text-center">
          Enter your email to receive a reset link
        </p>

        <div className="card">
          <form onSubmit={handleRequestReset} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-letterboxd-text-secondary mb-2"
              >
                Email Address
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                className="input-field w-full"
                placeholder="Enter your email"
              />
            </div>

            {error && (
              <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            {success && (
              <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
                <p className="text-green-400 text-sm">{success}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full mt-6"
            >
              {loading ? "Sending..." : "Send Reset Email"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={onBackToLogin}
              className="text-letterboxd-text-secondary hover:text-letterboxd-text-primary font-medium transition-colors duration-200"
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PasswordReset;

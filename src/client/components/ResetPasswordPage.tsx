import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { Subheading } from "./Subheading";
import { Input } from "./ui/Input";
import { Notification } from "./ui/Notification";

type Status = "verifying" | "ready" | "invalid";

const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [status, setStatus] = useState<Status>("verifying");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // detectSessionInUrl has already parsed the recovery code from the hash;
  // no session here means the link was invalid or expired.
  useEffect(() => {
    let cancelled = false;
    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setStatus(data.session ? "ready" : "invalid");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      const { error: updateErr } = await supabase.auth.updateUser({ password });
      if (updateErr) {
        setError(updateErr.message);
        setLoading(false);
        return;
      }

      // An email-link click alone must not grant a session, so drop both the
      // recovery session and our own now-stale app token before /login.
      await supabase.auth.signOut();
      logout();
      navigate("/login", {
        replace: true,
        state: { resetSuccess: true },
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update password.",
      );
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-letterboxd-bg-primary flex items-start mt-10 justify-center px-4">
      <div className="w-full max-w-md">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-letterboxd-text-primary mb-2">
            The Big Picture Discord
          </h1>
          <Subheading />
        </header>

        <div className="card">
          <h2 className="text-2xl font-semibold text-letterboxd-text-primary mb-6 text-center">
            Reset your password
          </h2>

          {status === "verifying" && (
            <p className="text-letterboxd-text-secondary text-center">
              Verifying your reset link…
            </p>
          )}

          {status === "invalid" && (
            <div className="space-y-4">
              <Notification notificationType="error" message="This reset link is invalid or has expired. Please request a new one." />
              <Link
                to="/login"
                className="block text-center text-letterboxd-accent hover:text-letterboxd-accent-hover font-medium transition-colors duration-200"
              >
                Back to Login
              </Link>
            </div>
          )}

          {status === "ready" && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-letterboxd-text-secondary mb-2"
                >
                  New Password
                </label>
                <Input
                  type="password"
                  id="password"
                  name="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  autoComplete="new-password"
                  className="w-full"
                  placeholder="Enter your new password"
                />
              </div>

              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-sm font-medium text-letterboxd-text-secondary mb-2"
                >
                  Confirm New Password
                </label>
                <Input
                  type="password"
                  id="confirmPassword"
                  name="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={loading}
                  autoComplete="new-password"
                  className="w-full"
                  placeholder="Confirm your new password"
                />
              </div>

              {error && (
                <Notification notificationType="error" message={error} />
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full mt-6"
              >
                {loading ? "Updating…" : "Update Password"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;

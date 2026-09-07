import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "./ui/Button";

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  const profilePath = user?.lbusername ? `/user/${user.lbusername}` : null;

  const isDevMode = import.meta.env.DEV;

  const getUserName = () => {
    if (user?.displayName) return user.displayName;
    if (user?.email) return user.email.split("@")[0];
    return "User";
  };

  const isAdmin = user?.role === "admin";

  // Hold the greeting (and admin-gated cards) until /me resolves — otherwise a
  // hard refresh flashes "Welcome back, User!" before the real identity lands.
  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-letterboxd-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-letterboxd-text-primary mb-4">
          Welcome back, {getUserName()}!
        </h1>
        <p className="text-letterboxd-text-secondary text-lg">
          Your Letterboxd data analysis dashboard
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="card hover:bg-letterboxd-bg-tertiary transition-colors">
          <h2 className="text-xl font-semibold text-letterboxd-text-primary mb-2">
            Profile
          </h2>
          <p className="text-letterboxd-text-secondary mb-4">
            View your ratings, compatibility, and top films
          </p>
          <Button
            onClick={() => profilePath && navigate(profilePath)}
            disabled={!profilePath}
            className="w-full"
          >
            {profilePath ? "Go to Profile" : "No Letterboxd username linked"}
          </Button>
        </div>

        {isDevMode && (
          <div className="card hover:bg-letterboxd-bg-tertiary transition-colors">
            <h2 className="text-xl font-semibold text-letterboxd-text-primary mb-2">
              Data Fetcher
            </h2>
            <p className="text-letterboxd-text-secondary mb-4">
              Scrape and analyze Letterboxd rating data
            </p>
            <Button onClick={() => navigate("/fetcher")} className="w-full">
              Fetch Data
            </Button>
          </div>
        )}

        <div className="card hover:bg-letterboxd-bg-tertiary transition-colors">
          <h2 className="text-xl font-semibold text-letterboxd-text-primary mb-2">
            Compare Users
          </h2>
          <p className="text-letterboxd-text-secondary mb-4">
            Compare rating patterns between users
          </p>
          <Button onClick={() => navigate("/compare")} className="w-full">
            Compare
          </Button>
        </div>

        {isAdmin && isDevMode && (
          <div className="card hover:bg-letterboxd-bg-tertiary transition-colors">
            <h2 className="text-xl font-semibold text-letterboxd-text-primary mb-2">
              Refresh user film data
            </h2>
            <p className="text-letterboxd-text-secondary mb-4">
              Re-scrape every user's films and refresh Letterboxd ratings
            </p>
            <Button
              onClick={() => navigate("/dashboard/refresh-films")}
              className="w-full"
            >
              Open
            </Button>
          </div>
        )}

        {isAdmin && (
          <div className="card hover:bg-letterboxd-bg-tertiary transition-colors">
            <h2 className="text-xl font-semibold text-letterboxd-text-primary mb-2">
              User management
            </h2>
            <p className="text-letterboxd-text-secondary mb-4">
              List, edit, and unlink user accounts
            </p>
            <Button onClick={() => navigate("/admin/users")} className="w-full">
              Open
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;

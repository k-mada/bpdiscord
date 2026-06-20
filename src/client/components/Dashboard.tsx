import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "../hooks/useUser";

const Dashboard = () => {
  const navigate = useNavigate();
  const { user: currentUser } = useUser();
  const [user, setUser] = useState<any>(null);

  const profilePath = currentUser?.lbusername
    ? `/user/${currentUser.lbusername}`
    : null;

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  const getUserName = () => {
    if (user?.user_metadata?.name) {
      return user.user_metadata.name;
    }
    if (user?.email) {
      return user.email.split("@")[0];
    }
    return "User";
  };

  const isAdmin = user?.user_metadata?.role === "admin";

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
      <div>
        <span className="text-3xl font-bold">Total Movies:</span>
        <span className="text-3xl font-bold movie-counter"></span>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="card hover:bg-letterboxd-bg-tertiary transition-colors">
          <h3 className="text-xl font-semibold text-letterboxd-text-primary mb-2">
            Profile
          </h3>
          <p className="text-letterboxd-text-secondary mb-4">
            View your ratings, compatibility, and top films
          </p>
          <button
            onClick={() => profilePath && navigate(profilePath)}
            disabled={!profilePath}
            className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {profilePath ? "Go to Profile" : "No Letterboxd username linked"}
          </button>
        </div>

        <div className="card hover:bg-letterboxd-bg-tertiary transition-colors">
          <h3 className="text-xl font-semibold text-letterboxd-text-primary mb-2">
            Data Fetcher
          </h3>
          <p className="text-letterboxd-text-secondary mb-4">
            Scrape and analyze Letterboxd rating data
          </p>
          <button
            onClick={() => navigate("/fetcher")}
            className="btn-primary w-full"
          >
            Fetch Data
          </button>
        </div>

        <div className="card hover:bg-letterboxd-bg-tertiary transition-colors">
          <h3 className="text-xl font-semibold text-letterboxd-text-primary mb-2">
            Compare Users
          </h3>
          <p className="text-letterboxd-text-secondary mb-4">
            Compare rating patterns between users
          </p>
          <button
            onClick={() => navigate("/compare")}
            className="btn-primary w-full"
          >
            Compare
          </button>
        </div>

        {isAdmin && (
          <div className="card hover:bg-letterboxd-bg-tertiary transition-colors">
            <h3 className="text-xl font-semibold text-letterboxd-text-primary mb-2">
              Refresh user film data
            </h3>
            <p className="text-letterboxd-text-secondary mb-4">
              Re-scrape every user's films and refresh Letterboxd ratings
            </p>
            <button
              onClick={() => navigate("/dashboard/refresh-films")}
              className="btn-primary w-full"
            >
              Open
            </button>
          </div>
        )}

        {isAdmin && (
          <div className="card hover:bg-letterboxd-bg-tertiary transition-colors">
            <h3 className="text-xl font-semibold text-letterboxd-text-primary mb-2">
              User management
            </h3>
            <p className="text-letterboxd-text-secondary mb-4">
              List, edit, and unlink user accounts
            </p>
            <button
              onClick={() => navigate("/admin/users")}
              className="btn-primary w-full"
            >
              Open
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;

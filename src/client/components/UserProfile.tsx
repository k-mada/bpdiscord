import { useState, useEffect } from "react";
import Header from "./Header";

const UserProfile = () => {
  const [user, setUser] = useState<any>(null);

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
      return user.email.split("@")[0]; // Use email prefix as fallback
    }
    return "User";
  };

  const getUserEmail = () => {
    return user?.email || "No email available";
  };

  const getJoinDate = () => {
    if (user?.created_at) {
      return new Date(user.created_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    }
    return "Unknown";
  };

  return (
    <div className="min-h-screen bg-letterboxd-bg-primary">
      <Header />
      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="space-y-8">
          {/* User Profile Section */}
          <div className="card">
            <div className="flex items-center space-x-6">
              <div className="w-20 h-20 bg-letterboxd-accent rounded-full flex items-center justify-center">
                <span className="text-2xl font-bold text-white">
                  {getUserName().charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1">
                <h2 className="text-3xl font-bold text-letterboxd-text-primary mb-2">
                  {getUserName()}
                </h2>
                <p className="text-letterboxd-text-secondary mb-1">
                  {getUserEmail()}
                </p>
                <p className="text-sm text-letterboxd-text-muted">
                  Member since {getJoinDate()}
                </p>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="card text-center">
              <div className="text-3xl font-bold text-letterboxd-accent mb-2">
                0
              </div>
              <div className="text-letterboxd-text-secondary text-sm uppercase tracking-wide">
                Fetches Completed
              </div>
            </div>
            <div className="card text-center">
              <div className="text-3xl font-bold text-letterboxd-accent mb-2">
                0
              </div>
              <div className="text-letterboxd-text-secondary text-sm uppercase tracking-wide">
                Films Analyzed
              </div>
            </div>
            <div className="card text-center">
              <div className="text-3xl font-bold text-letterboxd-accent mb-2">
                0
              </div>
              <div className="text-letterboxd-text-secondary text-sm uppercase tracking-wide">
                Users Rated
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="card">
            <h3 className="text-xl font-semibold text-letterboxd-text-primary mb-4">
              Recent Activity
            </h3>
            <div className="text-center py-8">
              <p className="text-letterboxd-text-secondary">
                No recent activity. Start by scraping some Letterboxd data!
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default UserProfile;

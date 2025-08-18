import React from "react";

interface UserProfileProps {
  user: any;
  onLogout: () => void;
  onNavigateToScraper: () => void;
  onNavigateToComparison: () => void;
}

const UserProfile: React.FC<UserProfileProps> = ({
  user,
  onLogout,
  onNavigateToScraper,
  onNavigateToComparison,
}) => {
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

          {/* Quick Actions */}
          <div className="card">
            <h3 className="text-xl font-semibold text-letterboxd-text-primary mb-4">
              Quick Actions
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={onNavigateToScraper}
                className="btn-primary w-full py-4"
              >
                <div className="text-lg font-semibold mb-1">
                  Fetch User Ratings
                </div>
                <div className="text-sm opacity-90">
                  Get detailed ratings from a Letterboxd user
                </div>
              </button>
              <button
                onClick={onNavigateToComparison}
                className="btn-primary w-full py-4"
              >
                <div className="text-lg font-semibold mb-1">Compare Users</div>
                <div className="text-sm opacity-90">
                  Compare rating statistics between users
                </div>
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default UserProfile;

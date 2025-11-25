import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import LoginPage from "./components/LoginPage";
import Dashboard from "./components/Dashboard";
import UserProfile from "./components/UserProfile";
import ScraperInterface from "./components/ScraperInterface";
import UserComparison from "./components/UserComparison";
import HaterRankings from "./components/HaterRankings";
import HaterRankings2 from "./components/HaterRankings2";
import ProtectedRoute from "./components/ProtectedRoute";
import Stats from "./components/Stats";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/compare" element={<UserComparison />} />
        <Route
          path="/hater-rankings"
          element={<HaterRankings2 isPublic={true} />}
        />
        <Route path="/stats" element={<Stats />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        {/* <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <UserProfile />
            </ProtectedRoute>
          }
        /> */}
        <Route path="/:username" element={<UserProfile />} />
        <Route
          path="/fetcher"
          element={
            // <ProtectedRoute>
            <ScraperInterface />
            // </ProtectedRoute>
          }
        />

        {/* Default redirect */}
        <Route path="/" element={<Stats />} />
      </Routes>
    </Router>
  );
}

export default App;

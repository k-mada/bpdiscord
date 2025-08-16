import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import LoginPage from "./components/LoginPage";
import Dashboard from "./components/Dashboard";
import PublicUserComparison from "./components/PublicUserComparison";
import HaterRankings from "./components/HaterRankings";

function App() {
  return (
    <Router>
      <Routes>
        {/* Public routes */}
        <Route path="/compare" element={<PublicUserComparison />} />
        <Route
          path="/hater-rankings"
          element={<HaterRankings isPublic={true} />}
        />

        {/* Protected routes */}
        <Route path="/dashboard/*" element={<Dashboard />} />
        <Route path="/login" element={<LoginPage />} />

        {/* Default redirect */}
        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;

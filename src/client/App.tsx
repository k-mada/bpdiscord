import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import LoginPage from "./components/LoginPage";
import Dashboard from "./components/Dashboard";
import UserProfile from "./components/UserProfile";
import ScraperInterface from "./components/ScraperInterface";
import UserComparison from "./components/UserComparison";
import MFLAdmin from "./components/MovieFantasyLeague/Admin";
import MovieFantasyLeague from "./components/MovieFantasyLeague/Dashboard";
import ScoringReference from "./components/MovieFantasyLeague/ScoringReference";
import HaterRankings2 from "./components/HaterRankings2";
import ProtectedRoute from "./components/ProtectedRoute";
import Stats from "./components/Stats";
import OscarsPage from "./components/OscarsPage";
import EventsListPage from "./components/events/EventsListPage";
import EventPage from "./components/events/EventPage";
import EventAdminPage from "./components/events/EventAdminPage";
import MyPicksPage from "./components/events/MyPicksPage";
import MainLayout from "./components/MainLayout";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Stats />} />
          <Route path="/mfl" element={<MovieFantasyLeague />} />
          <Route path="/mfl/scoring-reference" element={<ScoringReference />} />
          <Route
            path="/mfl/admin"
            element={
              <ProtectedRoute>
                <MFLAdmin />
              </ProtectedRoute>
            }
          />
          <Route path="/compare" element={<UserComparison />} />
          <Route
            path="/hater-rankings"
            element={<HaterRankings2 isPublic={true} />}
          />
          <Route path="/stats" element={<Stats />} />
          <Route path="/oscars-2026" element={<OscarsPage />} />
          <Route path="/events" element={<EventsListPage />} />
          <Route
            path="/events/admin"
            element={
              <ProtectedRoute>
                <EventAdminPage />
              </ProtectedRoute>
            }
          />
          <Route path="/events/:slug" element={<EventPage />} />
          <Route
            path="/events/:slug/my-picks"
            element={
              <ProtectedRoute>
                <MyPicksPage />
              </ProtectedRoute>
            }
          />
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
        </Route>
      </Routes>
    </Router>
  );
}

export default App;

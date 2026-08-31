import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes, Link } from "react-router-dom";
import MainLayout from "../../../components/MainLayout";
import { AuthProvider } from "../../../contexts/AuthContext";
import "../../../index.css";

// MainLayout renders Header, which reads auth. With no stored token the
// provider settles without a fetch, so nothing here touches the network.
const Page = () => (
  <>
    <h1>Compare users</h1>
    <Link to="/stats">to stats</Link>
  </>
);

const Harness = () => (
  <AuthProvider>
    <MemoryRouter initialEntries={["/compare"]}>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route path="compare" element={<Page />} />
          <Route path="stats" element={<h1>Stats</h1>} />
        </Route>
      </Routes>
    </MemoryRouter>
  </AuthProvider>
);

createRoot(document.getElementById("root")!).render(<Harness />);

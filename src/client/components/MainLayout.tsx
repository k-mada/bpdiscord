import Header from "./Header";
import { Outlet } from "react-router-dom";

// TODO: ADD CONFIRMATION TOAST
const MainLayout = () => {
  return (
    <div className="min-h-screen bg-letterboxd-bg-primary">
      <Header />
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
};

export default MainLayout;

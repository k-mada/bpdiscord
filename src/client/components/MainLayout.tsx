import { useEffect, useRef, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Header from "./Header";
import { documentTitleForPath, titleForPath } from "./routeTitles";

const MAIN_ID = "main-content";

// TODO: ADD CONFIRMATION TOAST
const MainLayout = () => {
  const { pathname } = useLocation();
  const [announcement, setAnnouncement] = useState("");
  // Seeded to the first pathname rather than a boolean: a boolean flips on
  // StrictMode's first effect pass and then announces on the second.
  const announced = useRef(pathname);

  useEffect(() => {
    document.title = documentTitleForPath(pathname);
    if (announced.current === pathname) return;
    announced.current = pathname;
    window.scrollTo(0, 0);
    setAnnouncement(titleForPath(pathname));
  }, [pathname]);

  return (
    <div className="min-h-screen bg-letterboxd-bg-primary">
      <a href={`#${MAIN_ID}`} className="skip-link">
        Skip to main content
      </a>
      <Header />
      <main id={MAIN_ID} tabIndex={-1} className="main-content">
        <Outlet />
      </main>
      {/* Outside <main> so the route swap cannot unmount it mid-announcement. */}
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>
    </div>
  );
};

export default MainLayout;

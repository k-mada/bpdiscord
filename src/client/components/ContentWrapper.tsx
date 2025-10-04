import React from "react";
import Header from "./Header";

const ContentWrapper = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="min-h-screen bg-letterboxd-bg-primary">
      <Header />
      <main className="main-content">{children}</main>
    </div>
  );
};

export default ContentWrapper;

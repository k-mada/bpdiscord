import React, { useState, useEffect } from "react";
import { HEADINGS } from "../constants";

export const Subheading: React.FC = () => {
  const [randomHeading, setRandomHeading] = useState<string>("");

  useEffect(() => {
    setRandomHeading(HEADINGS[Math.floor(Math.random() * HEADINGS.length)]);
  }, []);

  return (
    <span className="text-letterboxd-text-secondary block mt-1 text-sm">
      {randomHeading}
    </span>
  );
};

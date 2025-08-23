import React, { useState, useEffect } from "react";
import { SUBHEADINGS } from "../constants";

export const Subheading: React.FC = () => {
  const [randomHeading, setRandomHeading] = useState<string>("");

  useEffect(() => {
    setRandomHeading(
      SUBHEADINGS[Math.floor(Math.random() * SUBHEADINGS.length)]
    );
  }, []);

  return (
    <span className="text-letterboxd-text-secondary block mt-1 text-sm">
      {randomHeading}
    </span>
  );
};

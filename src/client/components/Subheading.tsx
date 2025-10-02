import React, { useState, useEffect } from "react";
import { SUBHEADINGS } from "../constants";

export const Subheading = () => {
  const [randomHeading, setRandomHeading] = useState<string>("");
  const [jarSize, stJarSize] = useState("");

  useEffect(() => {
    const randomHeading =
      SUBHEADINGS[Math.floor(Math.random() * SUBHEADINGS.length)] || "";
    if (randomHeading === "🫙") {
      stJarSize("text-4xl rotate-12 inline-block ml-1");
    } else {
      stJarSize("text-sm");
    }
    setRandomHeading(randomHeading);
  }, []);

  return (
    <span className={`text-letterboxd-text-secondary block mt-1 ${jarSize}`}>
      {randomHeading}
    </span>
  );
};

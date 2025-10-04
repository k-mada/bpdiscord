import React from "react";

const Card = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => {
  return <div className="card">{children}</div>;
};

export default Card;

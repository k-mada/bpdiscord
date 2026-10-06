import React from "react";

type CardProps = React.HTMLAttributes<HTMLDivElement>;

const Card = ({ className, children, ...rest }: CardProps) => (
  <div className={className ? `card ${className}` : "card"} {...rest}>
    {children}
  </div>
);

export default Card;

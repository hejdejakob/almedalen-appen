"use client";

interface RutanProps {
  children: React.ReactNode;
  selected?: boolean;
  onClick?: () => void;
  as?: "button" | "div";
  className?: string;
}

export default function Rutan({
  children,
  selected = false,
  onClick,
  as = "div",
  className = "",
}: RutanProps) {
  const Tag = as;

  const baseStyle: React.CSSProperties = {
    border: "2px solid #000",
    borderRadius: 0,
    background: selected ? "#ff6632" : "#fff",
    color: "#000",
    boxShadow: "3px 3px 0px 0px #000",
    cursor: onClick ? "pointer" : "default",
    transition: "background 0.15s, box-shadow 0.15s",
  };

  return (
    <Tag onClick={onClick} style={baseStyle} className={className}>
      {children}
    </Tag>
  );
}

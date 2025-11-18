"use client";

interface DrawerSectionProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export default function DrawerSection({ title, children, className = "" }: DrawerSectionProps) {
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {title && <h3 className="text-sm font-semibold opacity-70">{title}</h3>}
      <div>{children}</div>
    </div>
  );
}


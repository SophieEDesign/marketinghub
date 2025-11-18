"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import AppLogo from "./branding/AppLogo";

const nav = [
  { name: "Grid", href: "/grid" },
  { name: "Kanban", href: "/kanban" },
  { name: "Calendar", href: "/calendar" },
  { name: "Timeline", href: "/timeline" },
  { name: "Cards", href: "/cards" },
];

export default function Sidebar() {
  const path = usePathname();

  return (
    <aside className="w-56 bg-white dark:bg-gray-800 border-r border-gray-300 dark:border-gray-700 p-4 flex flex-col gap-2">
      <div className="mb-4">
        <AppLogo />
      </div>
      {nav.map(item => (
        <Link
          key={item.href}
          href={item.href}
          className={`px-3 py-2 rounded-md ${
            path === item.href
              ? "bg-blue-600 text-white"
              : "hover:bg-gray-200 dark:hover:bg-gray-700"
          }`}
        >
          {item.name}
        </Link>
      ))}
    </aside>
  );
}


"use client";
import { useTheme, useDensity } from "@/app/providers";
import { useModal } from "@/lib/modalState";
import { useSettingsState } from "@/lib/settingsState";
import { usePathname } from "next/navigation";
import { Moon, Sun } from "lucide-react";
import { getBrand } from "@/lib/brand";

export default function HeaderBar() {
  const themeContext = useTheme();
  const densityContext = useDensity();
  const { setOpen, setTableId } = useModal();
  const { setOpen: setSettingsOpen } = useSettingsState();
  const pathname = usePathname();
  const brand = getBrand();
  
  // Extract table ID from path
  const pathParts = pathname.split("/").filter(Boolean);
  const currentTable = pathParts[0] || "content";

  if (!themeContext || !densityContext) {
    return null;
  }

  const { theme, setTheme } = themeContext;
  const { density, setDensity } = densityContext;
  const isDark = theme === "dark";

  return (
    <header className="h-14 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-4 bg-brand-blue text-white">
      <div className="flex items-center gap-2">
        {brand.logo && (
          <img src={brand.logo} alt={brand.name} className="h-6 w-auto object-contain" />
        )}
        <span className="font-heading tracking-wide text-sm">{brand.name}</span>
      </div>
      <div className="ml-auto flex items-center gap-4">
        <button
          onClick={() => {
            setTableId(currentTable);
            setOpen(true);
          }}
          className="btn-primary"
        >
          + New
        </button>
        <button
          onClick={() => setSettingsOpen(true)}
          className="btn-secondary text-white bg-white/10 hover:bg-white/20 border-0"
          title="Settings"
        >
          ⚙️ Settings
        </button>
        <button
          onClick={() => {
            if (theme === "light") setTheme("dark");
            else if (theme === "dark") setTheme("brand");
            else setTheme("light");
          }}
          className="p-2 rounded-md hover:bg-white/10 transition"
          title="Toggle theme"
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
        <button
          onClick={() =>
            setDensity(density === "comfortable" ? "compact" : "comfortable")
          }
          className="p-2 rounded-md hover:bg-white/10 transition text-xs"
          title="Toggle density"
        >
          {density === "comfortable" ? "Compact" : "Comfortable"}
        </button>
      </div>
    </header>
  );
}


"use client";
import { useTheme, useDensity } from "@/app/providers";
import { useModal } from "@/lib/modalState";
import { useSettingsState } from "@/lib/settingsState";
import AppLogo from "@/components/branding/AppLogo";

export default function HeaderBar() {
  const themeContext = useTheme();
  const densityContext = useDensity();
  const { setOpen } = useModal();
  const { setOpen: setSettingsOpen } = useSettingsState();

  if (!themeContext || !densityContext) {
    return null;
  }

  const { theme, setTheme } = themeContext;
  const { density, setDensity } = densityContext;

  return (
    <header className="h-14 border-b border-gray-300 dark:border-gray-700 flex items-center justify-between px-6">
      <div className="flex items-center gap-3">
        <AppLogo />
      </div>
      <div className="flex gap-3">
        <button
          onClick={() => setOpen(true)}
          className="px-3 py-1 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition"
        >
          + New
        </button>
        <button
          onClick={() => setSettingsOpen(true)}
          className="px-3 py-1 rounded-md bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition"
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
          className="px-3 py-1 rounded-md bg-gray-200 dark:bg-gray-700"
        >
          {theme === "light" ? "Dark" : theme === "dark" ? "Brand" : "Light"}
        </button>

        <button
          onClick={() =>
            setDensity(density === "comfortable" ? "compact" : "comfortable")
          }
          className="px-3 py-1 rounded-md bg-gray-200 dark:bg-gray-700"
        >
          {density === "comfortable" ? "Compact" : "Comfortable"}
        </button>
      </div>
    </header>
  );
}


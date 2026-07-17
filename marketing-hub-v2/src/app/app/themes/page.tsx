import { ThemesClient } from "@/components/themes/ThemesClient";
import {
  listThemeMains,
  listThemeOffshoots,
  listThemes,
} from "@/lib/data/repos";

export default async function ThemesPage() {
  const [themes, mains, offshoots] = await Promise.all([
    listThemes(),
    listThemeMains(),
    listThemeOffshoots(),
  ]);
  return (
    <ThemesClient
      initialThemes={themes}
      initialMains={mains}
      initialOffshoots={offshoots}
    />
  );
}

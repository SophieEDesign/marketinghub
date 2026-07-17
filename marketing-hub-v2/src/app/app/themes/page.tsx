import { ThemesClient } from "@/components/themes/ThemesClient";
import {
  listContent,
  listThemeMains,
  listThemeOffshoots,
  listThemes,
} from "@/lib/data/repos";

export default async function ThemesPage() {
  const [themes, mains, offshoots, content] = await Promise.all([
    listThemes(),
    listThemeMains(),
    listThemeOffshoots(),
    listContent(),
  ]);
  return (
    <ThemesClient
      initialThemes={themes}
      initialMains={mains}
      initialOffshoots={offshoots}
      initialContent={content}
    />
  );
}

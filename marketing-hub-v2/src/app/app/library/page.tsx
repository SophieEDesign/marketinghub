import { LibraryHub } from "@/components/library/LibraryHub";
import { getFieldOptionsMap } from "@/lib/data/data-admin";
import { listResources } from "@/lib/data/repos";
import { listMediaFromSupabase } from "@/lib/supabase/media-list";
import { hasSupabaseConfig } from "@/lib/auth/config";

export const dynamic = "force-dynamic";

const FALLBACK_LOGO = "/pm-group-logo.png";

const FALLBACK_GUIDE = "/brand-guidelines-2026.pdf";

export default async function LibraryPage() {
  let logoUrl = FALLBACK_LOGO;
  let guideUrl = FALLBACK_GUIDE;

  if (hasSupabaseConfig()) {
    try {
      const { items } = await listMediaFromSupabase();
      const guideCandidates = items.filter(
        (i) =>
          /brand\s*guidelines?/i.test(i.name) ||
          /brand\s*guidelines?/i.test(i.category)
      );
      const guide =
        guideCandidates.find((i) => /2026|v\s*2|version\s*2/i.test(i.name)) ||
        guideCandidates[0];
      const pdf =
        guide?.files.find((f) => /pdf/i.test(f.type) || /\.pdf$/i.test(f.name))
          ?.url || guide?.document_url;
      if (pdf) guideUrl = pdf;

      const logoItem =
        items.find((i) => /bespoke logistics logo/i.test(i.name)) ||
        items.find(
          (i) =>
            i.category === "Logos" &&
            i.files.some((f) => /png|svg|jpg|jpeg|webp/i.test(f.type || f.name))
        );
      const logoFile = logoItem?.files.find(
        (f) =>
          /image\//i.test(f.type) || /\.(png|svg|jpe?g|webp)$/i.test(f.name)
      );
      if (logoFile?.url) logoUrl = logoFile.url;
    } catch {
      // Keep fallbacks
    }
  }

  const [resources, resourceFieldOptions] = await Promise.all([
    listResources(),
    getFieldOptionsMap("resources"),
  ]);

  return (
    <LibraryHub
      resources={resources}
      logoUrl={logoUrl}
      guideUrl={guideUrl}
      resourceFieldOptions={resourceFieldOptions}
    />
  );
}


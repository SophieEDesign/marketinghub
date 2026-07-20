import { LibraryHub } from "@/components/library/LibraryHub";
import { getFieldOptionsMap } from "@/lib/data/data-admin";
import { listResources } from "@/lib/data/repos";
import { listMediaFromSupabase } from "@/lib/supabase/media-list";
import { hasSupabaseConfig } from "@/lib/auth/config";

export const dynamic = "force-dynamic";

const FALLBACK_LOGO = "/pm-group-logo.png";

const FALLBACK_GUIDE =
  "https://hwtycgvclhckglmuwnmw.supabase.co/storage/v1/object/public/attachments/attachments/table_media_1768074185692/19e724de-39c2-4ee5-b545-dae584996d8c/media/4363f3e1-1bb0-49f4-ad10-7f6d92ea52e0.pdf";

export default async function LibraryPage() {
  let logoUrl = FALLBACK_LOGO;
  let guideUrl = FALLBACK_GUIDE;

  if (hasSupabaseConfig()) {
    try {
      const { items } = await listMediaFromSupabase();
      const guide = items.find(
        (i) =>
          /brand\s*guidelines?/i.test(i.name) ||
          /brand\s*guidelines?/i.test(i.category)
      );
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


import { ContentSocialHub } from "@/components/content/ContentSocialHub";
import { ImportFromSupabaseButton } from "@/components/supabase/ImportFromSupabaseButton";
import { listContent } from "@/lib/data/repos";
import { hasSupabaseConfig } from "@/lib/auth/config";

export default async function ContentPage() {
  return (
    <div>
      {hasSupabaseConfig() ? (
        <div className="mb-4">
          <ImportFromSupabaseButton label="Refresh from Social Posts" />
        </div>
      ) : null}
      <ContentSocialHub initialContent={await listContent()} />
    </div>
  );
}

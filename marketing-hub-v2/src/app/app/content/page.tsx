import { ContentSocialHub } from "@/components/content/ContentSocialHub";
import { listContent } from "@/lib/data/repos";

export default async function ContentPage() {
  return <ContentSocialHub initialContent={await listContent()} />;
}

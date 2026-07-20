import { ContentSocialHub } from "@/components/content/ContentSocialHub";
import { getFieldOptionsMap } from "@/lib/data/data-admin";
import { listContent } from "@/lib/data/repos";

export default async function ContentPage() {
  const [content, fieldOptions] = await Promise.all([
    listContent(),
    getFieldOptionsMap("content"),
  ]);
  return (
    <ContentSocialHub initialContent={content} fieldOptions={fieldOptions} />
  );
}

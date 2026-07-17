-- Add Google Drive gallery embed block to Resource Hub page.
-- Uses HTML block so editors can later replace the folder ID/embed URL directly in block settings.

DO $$
DECLARE
  v_page uuid;
BEGIN
  v_page := public.marketing_hub_resolve_page_id(ARRAY['Resource Hub', 'Internal Staff Hub']);

  PERFORM public.marketing_hub_upsert_block(
    v_page,
    'resources_gallery_embed',
    'html',
    0, 10, 8, 6,
    jsonb_build_object(
      'title', 'Resource Gallery (Google Drive)',
      'html', $html$
<div class="rounded-xl border border-[#E5E7EB] bg-white p-4 md:p-5">
  <div class="mb-3">
    <h3 class="text-base font-semibold text-[#111827]">Shared Image Gallery</h3>
    <p class="mt-1 text-sm text-[#6B7280]">
      Inline view of the shared Google Drive gallery for generic resource images.
    </p>
  </div>
  <div class="overflow-hidden rounded-lg border border-[#E5E7EB] bg-[#F9FAFB]">
    <iframe
      src="https://drive.google.com/embeddedfolderview?id=1-pHl-DXNlOPC4LuWneYmHB-fzHscofyS#grid"
      title="Google Drive Resource Gallery"
      width="100%"
      height="420"
      frameborder="0"
      loading="lazy"
      allowfullscreen
    ></iframe>
  </div>
  <p class="mt-3 text-xs text-[#6B7280]">
    If the gallery does not load, open it directly:
    <a
      href="https://drive.google.com/drive/folders/1-pHl-DXNlOPC4LuWneYmHB-fzHscofyS?usp=sharing"
      target="_blank"
      rel="noopener noreferrer"
      class="font-medium text-[#2563EB] underline"
    >Open Google Drive Gallery</a>
  </p>
</div>
$html$
    ),
    2
  );

  -- Keep actions visible beside the gallery embed on wider layouts.
  PERFORM public.marketing_hub_upsert_block(
    v_page,
    'resources_actions',
    'things_to_do',
    8, 10, 4, 6,
    '{"title":"Resource Actions","things_to_do_compact_mode":true,"things_to_do_max_items":5,"things_to_do_show_stats":true}'::jsonb,
    3
  );
END $$;

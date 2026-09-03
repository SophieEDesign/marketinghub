-- Link is no longer a visibility value. It is a separate share toggle
-- (gallery_folder_shares.enabled). Migrate legacy "link" rows to Internal.

update public.table_media_1768074185692
set
  subfolder_visibility = case
    when lower(coalesce(subfolder_visibility, '')) in ('link', 'link only', 'link_only', 'unlisted')
      then 'internal'
    else subfolder_visibility
  end,
  visibility = case
    when lower(coalesce(visibility, '')) in ('link', 'link only', 'link_only', 'unlisted')
      then 'internal'
    else visibility
  end,
  updated_at = now()
where deleted_at is null
  and lower(coalesce(hub_category, '')) = 'gallery'
  and (
    lower(coalesce(subfolder_visibility, '')) in ('link', 'link only', 'link_only', 'unlisted')
    or lower(coalesce(visibility, '')) in ('link', 'link only', 'link_only', 'unlisted')
  );

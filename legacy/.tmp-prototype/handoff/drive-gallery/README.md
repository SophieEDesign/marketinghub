# Native Google Drive Image Gallery — drop-in package

Replaces the `EmbedBlock` Google Drive `embeddedfolderview` iframe (grey folder
placeholders) with a native, on-brand gallery: collection cards → image grid → lightbox.

These files are written to match the `baserow-app` conventions (`@/lib/utils` `cn`,
`lucide-react`, `next/image`, Tailwind). Copy them into the repo at the paths below.

## Files

| This package | Copy to (in baserow-app) |
|---|---|
| `lib/drive/types.ts` | `lib/drive/types.ts` |
| `lib/drive/client.ts` | `lib/drive/client.ts` |
| `app/api/drive/gallery/route.ts` | `app/api/drive/gallery/route.ts` |
| `components/interface/blocks/gallery/GalleryDriveView.tsx` | same path |
| `components/interface/blocks/gallery/useDriveGallery.ts` | same path |

## 1. One-time infra — Drive service account (required)

The current gallery is a *public* folder embed, so there is no API auth to reuse.
Create a read-only service account:

1. Google Cloud Console → create (or reuse) a project → enable the **Google Drive API**.
2. Create a **Service Account**, then a **JSON key** for it.
3. **Share the gallery folder** (and it cascades to subfolders) with the service
   account's email (`...@...iam.gserviceaccount.com`) as *Viewer*.
4. Add env vars (e.g. `.env.local` + Vercel project env):
   ```
   GOOGLE_SERVICE_ACCOUNT_EMAIL=...@...iam.gserviceaccount.com
   GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   DRIVE_GALLERY_ROOT_FOLDER_ID=<the shared root folder id>
   ```
   (Keep the literal `\n` in the key; `client.ts` converts them to newlines.)
5. Install the dependency: `npm i googleapis`.

> If you would rather not use a service account, the alternative is the public
> `https://drive.google.com/thumbnail?id=<id>&sz=w800` URL per file — but you still need
> the file IDs, which requires either the API or maintaining a manual manifest. The API
> route below is the clean path.

## 2. Wire it into the page

Easiest: render `GalleryDriveView` wherever the EmbedBlock currently shows the gallery.
Either
- add a dedicated `drive_gallery` block type in `BlockRenderer` + block picker with a
  settings field for the folder id, **or**
- in `EmbedBlock`, detect a `drive.google.com/.../folders/<id>` (or `embeddedfolderview`)
  URL and render `<GalleryDriveView rootFolderId={id} title=... subtitle=... />` instead of
  the iframe (keep the iframe path for every other embed).

```tsx
// minimal usage
<GalleryDriveView
  rootFolderId={block.config?.driveFolderId ?? process.env.NEXT_PUBLIC_DRIVE_GALLERY_ROOT_FOLDER_ID!}
  title="Shared Image Gallery"
  subtitle="Approved marine photography by vessel type and sector."
/>
```

## Notes
- The route caches Drive responses (`revalidate = 300`) — Drive list calls are slow/rate-limited.
- Thumbnails use `file.thumbnailLink` bumped to `=s800`; full images use the `uc?id=` URL.
- All Drive calls are server-side only. No client-side keys.
- Palette: navy `#005b8f`, deep navy `#1f2a44`/`#0f1c2b`, gold `#c4a574`/`#b08d52`,
  canvas `#eceef1`, hairline `#e4e7ec`, muted `#9aa1ab`.

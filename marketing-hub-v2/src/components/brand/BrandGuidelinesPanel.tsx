import { Download, ExternalLink } from "lucide-react";

const COLORS = [
  { name: "Primary Blue", hex: "#0b5dab" },
  { name: "Accent Red", hex: "#d92b2b" },
  { name: "Neutral Gray", hex: "#64748b" },
] as const;

export function BrandGuidelinesPanel({
  logoUrl,
  guideUrl,
  showDownloads = true,
}: {
  logoUrl: string;
  guideUrl: string;
  showDownloads?: boolean;
}) {
  return (
    <div className="space-y-5">
      <section className="surface-card p-6 md:p-8">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">
          Using the logo
        </h2>
        <div className="grid items-center gap-6 md:grid-cols-[minmax(0,280px)_1fr]">
          <div className="flex items-center justify-center rounded-2xl border border-border bg-sand/50 p-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoUrl}
              alt="Peters & May logo"
              className="max-h-28 w-auto object-contain"
            />
          </div>
          <div>
            <p className="text-sm leading-relaxed text-muted md:text-base">
              Always keep clear space equal to the height of the “M” mark around
              the logo. Never stretch, recolor or place it on a busy background.
            </p>
            {showDownloads ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <a
                  href={logoUrl}
                  download="peters-and-may-logo.png"
                  target="_blank"
                  rel="noreferrer"
                  className="btn-secondary"
                >
                  <Download className="h-4 w-4" />
                  Download logo
                </a>
                <a
                  href={guideUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-primary"
                >
                  <Download className="h-4 w-4" />
                  Brand guidelines PDF
                </a>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
          Colour palette
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {COLORS.map((color) => (
            <article key={color.hex} className="surface-card overflow-hidden">
              <div
                className="h-24 w-full"
                style={{ background: color.hex }}
                aria-hidden
              />
              <div className="p-4">
                <p className="font-medium">{color.name}</p>
                <p className="mt-1 font-mono text-sm text-muted">{color.hex}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="surface-card p-6 md:p-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
          Typography
        </h2>
        <p
          className="text-2xl font-bold tracking-tight text-brand md:text-3xl"
          style={{ fontFamily: "Manrope, var(--font-sans), sans-serif" }}
        >
          Manrope
        </p>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted md:text-base">
          Manrope — headings &amp; body. Bold for headings, medium for body
          copy. Avoid mixing in other typefaces.
        </p>
      </section>

      {showDownloads ? (
        <div>
          <a
            href={guideUrl}
            target="_blank"
            rel="noreferrer"
            className="btn-primary"
          >
            Download full brand guidelines
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      ) : null}
    </div>
  );
}

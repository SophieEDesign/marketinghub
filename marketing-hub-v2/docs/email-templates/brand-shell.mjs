/**
 * Shared Marketing Hub email chrome (header + footer).
 * Supabase does not support includes — each template inlines this shell.
 * Paste each HTML file into Dashboard → Authentication → Email Templates.
 */

export const LOGO_URL =
  "https://marketing.petersandmay.com/pm-group-logo.png";
export const SITE_URL = "https://marketing.petersandmay.com";
export const BRAND = "#0b3a4a";

/**
 * @param {{
 *   title: string;
 *   heading: string;
 *   paragraphs: string[];
 *   ctaLabel: string;
 *   ctaHref?: string;
 *   afterCtaHtml?: string;
 *   showFallbackLink?: boolean;
 * }} opts
 */
export function brandEmail({
  title,
  heading,
  paragraphs,
  ctaLabel,
  ctaHref = "{{ .ConfirmationURL }}",
  afterCtaHtml = "",
  showFallbackLink = true,
}) {
  const paras = paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:#334155;">${p}</p>`
    )
    .join("\n");

  const fallback = showFallbackLink
    ? `<p style="margin:28px 0 0;font-size:13px;line-height:1.5;color:#64748b;">
                  If the button doesn’t work, copy and paste this link into your browser:<br />
                  <a href="${ctaHref}" style="color:${BRAND};word-break:break-all;">${ctaHref}</a>
                </p>`
    : "";

  return `<!-- Shared branded header — keep identical across all Auth emails -->
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
  </head>
  <body style="margin:0;padding:0;background:#f4f6f7;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6f7;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e9eb;">
            <tr>
              <td style="background:${BRAND};padding:28px 32px;text-align:center;">
                <img
                  src="${LOGO_URL}"
                  alt="Peters &amp; May"
                  width="180"
                  style="display:inline-block;max-width:180px;height:auto;background:#ffffff;padding:10px 14px;border-radius:8px;"
                />
                <p style="margin:16px 0 0;font-size:13px;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.75);">
                  Marketing Hub
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:${BRAND};font-weight:600;">
                  ${heading}
                </h1>
                ${paras}
                <table role="presentation" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="border-radius:8px;background:${BRAND};">
                      <a
                        href="${ctaHref}"
                        style="display:inline-block;padding:12px 22px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;"
                      >
                        ${ctaLabel}
                      </a>
                    </td>
                  </tr>
                </table>
                ${afterCtaHtml}
                ${fallback}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 24px;border-top:1px solid #e5e9eb;background:#fafbfc;">
                <p style="margin:0;font-size:12px;line-height:1.45;color:#94a3b8;text-align:center;">
                  Peters &amp; May · Marketing Hub<br />
                  <a href="${SITE_URL}" style="color:${BRAND};text-decoration:none;">marketing.petersandmay.com</a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`;
}

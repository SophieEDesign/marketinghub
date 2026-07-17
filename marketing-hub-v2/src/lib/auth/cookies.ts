/** Shared cookie options for hub auth / media access cookies. */
export function hubCookieOptions(maxAge = 60 * 60 * 24 * 30) {
  const secure =
    process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    path: "/",
    maxAge,
    secure,
  };
}

export function clearHubCookieOptions() {
  return {
    ...hubCookieOptions(0),
    maxAge: 0,
  };
}

/** Domains that auto-accept as Member on the public request-access form. */
export function memberEmailDomains(): string[] {
  return (process.env.HUB_MEMBER_EMAIL_DOMAINS ?? "petersandmay.com")
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}

export function isAutoMemberEmail(email: string): boolean {
  const domain = email.trim().toLowerCase().split("@")[1] ?? "";
  if (!domain) return false;
  return memberEmailDomains().includes(domain);
}

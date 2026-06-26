# Records of Processing Activities (ROPA) — Marketing Hub

**Controller:** Peters &amp; May  
**Application:** Marketing Hub (internal workspace)  
**Last updated:** June 2026

## Processing activities

| Activity | Data categories | Purpose | Lawful basis | Recipients / processors | Retention |
|----------|-----------------|---------|--------------|-------------------------|-----------|
| User authentication | Email, password hash, session cookies | Secure access to workspace | Contract / legitimate interest | Supabase, Vercel | Account lifetime |
| Workspace records | Business/marketing data entered by users | Marketing operations | Legitimate interest / contract | Supabase | Business need; admin export available |
| Comments & mentions | User id, comment text, email for notifications | Collaboration | Legitimate interest | Supabase, Resend | Until record/user deleted |
| Access requests | Email, optional name | Review new user access | Legitimate interest | Supabase | Purged after 180 days once approved/rejected |
| Automation logs | Message text, JSON payloads | Debugging automations | Legitimate interest | Supabase | Purged after 90 days (admin job) |
| Rate limiting | IP address (hashed key in Upstash) | Abuse prevention | Legitimate interest | Upstash | Per Upstash policy |

## Data subject rights

- **Access / portability:** Admins can export per-user data via `GET /api/users/[userId]/export-data`
- **Erasure:** Admins can delete users via Settings; residual logs may require manual review
- **Transparency:** `/privacy` and `/cookies` public pages; signup consent checkbox

## International transfers

Confirm Supabase, Vercel, and Resend project regions match organisational requirements (EU recommended for UK/EU staff data).

## Security measures

- Authentication middleware with server-validated sessions (`getUser`)
- Row Level Security on Postgres
- Admin-only mutations for layout, versioning restore, automations test
- Rate limiting on public endpoints (when Upstash configured)
- CSP and security headers via Next.js config

## Review schedule

Review this ROPA when adding new integrations, processors, or data categories.

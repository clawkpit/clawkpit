# Security

## Reporting a vulnerability

If you believe you have found a security vulnerability in Clawkpit, please report it responsibly:

1. **Do not** open a public GitHub issue for security-sensitive bugs.
2. Email the maintainers (see the repository’s main contact or GitHub org) with:
   - A short description of the issue
   - Steps to reproduce (if possible)
   - Impact and suggested fix (optional)
3. We will acknowledge receipt and aim to respond within a reasonable time. We may ask for more details.
4. After the issue is addressed, we can coordinate on disclosure (e.g. a security advisory and credit, if you wish).

We appreciate your help in keeping Clawkpit safe for everyone.

## Threat model (local-first)

Clawkpit is designed as a **local-first**, **single-tenant** application:

- **Primary deployment**: One instance per user or small team (e.g. self-hosted, or a single-tenant cloud deployment). Data is not shared across unrelated users on the same instance beyond what the instance owner configures (e.g. multiple users on one server).
- **Trust boundary**: The application trusts the environment it runs in (database, process, and optionally the reverse proxy). It does not assume hostile multi-tenant infrastructure.
- **In scope**: Security of the application code (API, auth, validation, data access, dependencies we ship).
- **Out of scope**: General infrastructure (OS, network, cloud provider), third-party services (e.g. Resend for email), or misuse of the app by authorized users.

## Security-relevant design choices

- **Secrets**: No API keys, tokens, or passwords are hardcoded. Configuration is via environment variables (see `.env.example`).
- **Authentication**: Magic-link email (single-use, short-lived tokens), session cookies (httpOnly, sameSite, secure in production), and API keys (hashed before storage). Tokens are hashed (e.g. SHA-256) where stored.
- **Authorization**: All item and note access is scoped by authenticated user; there is no cross-user data access via the API.
- **Input**: Request bodies and query parameters are validated with Zod. Route parameters (e.g. IDs) are validated (e.g. UUID format). Request body size and batch size are limited.
- **Headers and transport**: Security headers are set (e.g. via Helmet). In production, cookies are marked `secure`. Use HTTPS in production.
- **Rate limiting**: Magic-link and OpenClaw device flows are rate-limited (in-memory, per IP/email or per device). Suitable for single-instance deployment; for multi-instance setups consider a shared store (e.g. Redis).

If you deploy Clawkpit in a different model (e.g. multi-tenant SaaS), consider additional hardening (tenant isolation, stricter rate limiting, and security review) beyond this baseline.

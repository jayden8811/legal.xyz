# Launch checklist

Work that the prototype can't do on its own: it needs a backend, an outside firm, or a lawyer.

## Backend
- [ ] Hosted storage for encrypted workspaces, keyrings, shared matters and counsel threads, with sync across devices and team members.
- [ ] Accounts and sign-in that never send the encryption password to the server (separate auth secret, or a PAKE such as OPAQUE). Passkeys and MFA.
- [ ] Single sign-on (SAML/OIDC) for Enterprise.
- [ ] Email: counsel invitations, signature confirmations, team invites, weekly counsel summaries, deadline reminders, legal-request notices.
- [ ] Bar verification against state bar attorney directories, with a manual review queue.
- [ ] Real team access: wrap each workspace key to each member's public key so invited people can decrypt.
- [ ] Firm accounts: wrap shared-matter keys to every attorney and paralegal on the matter.
- [ ] Lawyer referral matching and intake.
- [ ] Support inbox that can't see workspace content.
- [ ] Analytics endpoint that accepts only the allowlisted event counts in `public/analytics.js`.
- [ ] Backups of encrypted data, uptime monitoring, and a public status page.
- [ ] Data residency: US and EU storage regions.
- [ ] AI provider integration under a zero-data-retention agreement, using only ZDR-eligible models (Anthropic's Covered Models, such as Fable and Mythos, require 30-day retention). Confirm how flagged-content and legal-hold exceptions are handled.
- [ ] Billing.

## Legal
- [ ] Have counsel finalize the Terms, Privacy Policy, DPA and the privilege (Kovel-style) agreement.
- [ ] Unauthorized-practice-of-law review for each launch state, including how the AI's output is framed.
- [ ] Legal-ethics review of the counsel workflow (ABA Model Rules 1.1, 1.6, 5.3 and 5.4) with an ethics advisor.
- [ ] Marketing review so no claim implies subpoena-proof or guaranteed privilege.
- [ ] Publish the subprocessor list.
- [ ] Subpoena response procedure and the first transparency report six months after launch.

## Security and compliance
- [ ] Independent review of the client-side cryptography.
- [ ] Third-party penetration test.
- [ ] SOC 2 Type II audit.
- [ ] Paid bug bounty, and a PGP key published in `/.well-known/security.txt`.

## Business
- [ ] Cyber liability and technology errors and omissions insurance.
- [ ] Billing at $497/month per company.

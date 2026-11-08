---
title: "Unauthenticated RSA Private Key Disclosure Breaking Client Attestation"
date: 2026-11-05T00:00:00Z
draft: false
description: "An unauthenticated cert endpoint handed out the production RSA private key used for client attestation, letting anyone forge accepted attestation headers."
summary: "An unauthenticated API endpoint returned the production RSA private key that signs client attestation — no auth, one GET, forgeable headers."
tags: ["Cryptography", "Broken Access Control", "Authentication", "API", "CWE-321"]
severity: ["High"]
program: "Private target"
bounty: "Private"
---

## Summary

A private target's API exposed an unauthenticated endpoint that returned the full production RSA private key used to sign client-attestation headers for its official desktop client.

With that key, an attacker can mint valid attestation headers offline and present as a legitimate client. HackerOne assessed the finding as High (8.8). The program confirmed the issue, paid a bounty (amount private), and noted remediation would take longer because of other technical factors in the fix.

## Attack Flow

{{< attack-flow attacker="ATTACKER (unauthenticated)" victim="API (private target)" >}}
@attacker 1. Unauthenticated GET
/v1/.../cert (or equivalent) — no auth header

@victim 2. Response includes PEM private key
RSA key material for client attestation

@attacker 3. Sign attestation offline
mint x-device / attestation headers with the leaked key

@handoff 4. Present forged headers
API accepts them as a legitimate client

@attacker 5. Bypass client attestation
any flow that trusts those headers is reachable without the real app

@takeover CLIENT ATTESTATION BROKEN
{{< /attack-flow >}}

## Root Cause

Client attestation depended on a server-held RSA key that was meant to stay secret. That key was reachable through an unauthenticated certificate / key-distribution endpoint on `api.target.example`.

The endpoint:

- Required **no authentication**
- Returned the **full private key** (not only the public cert)
- Used that same key for **production** attestation verification

So the "secret" that proved "this request came from our real client" was available to anyone who could hit the URL.

## Steps to Reproduce

**Prerequisites:** none — no account, no client install.

**Step 1 — Fetch the key (unauthenticated):**

```bash
curl -s https://api.target.example/v1/[redacted]/cert
# → PEM block including PRIVATE KEY material
```

**Step 2 — Confirm it matches production attestation:**

Use the returned private key to sign a sample attestation payload the way the official desktop client does (platform string, timestamp, nonce as required by the protocol).

**Step 3 — Replay against an attestation-gated endpoint:**

```bash
curl -s https://api.target.example/v1/[redacted] \
  -H "Authorization: Bearer <optional>" \
  -H "X-[redacted]-Attestation: <signature-from-leaked-key>"
# → accepted (same as a real client)
```

**Step 4 — Negative control:**

Corrupt one byte of the signature or sign with a different key → rejected. That confirms the leaked key is the one the server trusts.

## Impact

Anyone on the internet can obtain the production RSA private key that backs client attestation.

With it, an attacker can:

- Forge attestation headers the API accepts as a legitimate desktop client
- Bypass controls that depend on "real app only" (rate limits, feature gates, anti-automation tied to attestation)
- Keep forging offline forever until the key is rotated **and** the distribution endpoint stops handing out private key material

No modification of stored user data was demonstrated in the report; the impact is full break of the attestation trust model.

## Remediation

1. **Stop distributing private keys.** Certificate endpoints should return public material only.
2. **Rotate the leaked key** and invalidate anything signed with it where feasible.
3. **Require authentication** (and ideally mTLS or a short-lived enrollment flow) before any device/client credential is issued.
4. **Move attestation to per-install keys** enrolled at first launch, not one global production RSA key shared by every client.

## Timeline

| Date | Event |
|------|-------|
| 2026-08-07 | Reported (Critical) |
| 2026-08-07 | HackerOne validated; severity set to **High (8.8)** |
| 2026-08-28 | Program: under internal assessment |
| 2026-09-16 | Program: issue confirmed; severity/bounty pending |
| 2026-10-09 | Status → **Triaged** |
| 2026-11-05 | Bounty awarded (amount private); remediation still in progress |

## Bounty

Amount private. Fix not yet complete at time of writing — program asked for patience on remediation/verification.

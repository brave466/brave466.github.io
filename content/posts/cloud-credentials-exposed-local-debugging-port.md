---
title: "Stealing Cloud Credentials Through an Exposed Local Debugging Port"
date: 2026-11-08T00:00:00Z
draft: false
description: "A production desktop application exposed an unauthenticated QtWebEngine debugger on 127.0.0.1:7000, and the signed-in WebView's native bridge returned a bearer token that worked against the cloud profile API."
summary: "An unauthenticated debugger on 127.0.0.1:7000 exposed a signed-in WebView's cloud credentials through its native account bridge."
tags: ["CDP", "QtWebEngine", "Credential Exposure", "Desktop Security"]
severity: ["Low"]
program: "Private target"
bounty: "Private"
---

A production desktop application from a private target exposed its embedded browser debugger on `127.0.0.1:7000`. Connecting required no authentication.

The debugger was attached to a signed-in WebView. That page could access a native account bridge containing the user's bearer token, refresh token, and account information.

During testing on Windows 11 on July 13, 2026, I extracted the test account's bearer token through this interface and used it against the cloud API. The profile endpoint returned HTTP 200 with the account's details.

This wasn't just access to a debugging console. It was a path from an unauthenticated local connection to a working cloud credential.

## Finding a Debugger in a Normal Launch

The first question was whether debugging required an unusual launch configuration. A developer deliberately enabling remote debugging is different from a production application enabling it for every user.

In this case, the listener appeared during normal launches. No debug flag, user setting, or externally supplied environment variable was needed.

Binary analysis found the strings `QTWEBENGINE_REMOTE_DEBUGGING` and `7000` stored together, consistent with startup code configuring QtWebEngine's debugging port. Those strings supported the explanation, but the important evidence was the running application: the port was open during ordinary use.

QtWebEngine embeds Chromium inside a desktop application. Its debugging interface uses the Chrome DevTools Protocol (CDP), which supports inspecting pages, observing their state, and executing JavaScript in their contexts.

These are useful development capabilities. Exposing them without authentication against a signed-in production WebView gives another process control over that page.

## Discovering the Authenticated WebView

The debugging interface provided an HTTP endpoint for listing available targets:

```http
GET /json HTTP/1.1
Host: 127.0.0.1:7000
```

The endpoint returned HTTP 200 without an authentication header, cookie, or session.

Its response listed live pages and their debugger WebSocket addresses. The structure below is illustrative; identifying values have been replaced:

```json
[
  {
    "type": "page",
    "url": "https://web.target.example/[redacted]",
    "webSocketDebuggerUrl": "ws://127.0.0.1:7000/devtools/page/[TARGET_ID]"
  }
]
```

Two fields mattered:

- `url` identified the authenticated WebView.
- `webSocketDebuggerUrl` supplied the address needed to attach to it.

There was no need to read the application's files or guess a target identifier. The discovery endpoint provided the connection details directly.

## Attaching Without Authentication

The next step was connecting to the returned WebSocket URL.

That connection also required no credentials. Testing showed the endpoint accepted handshakes with unrelated origins, `null`, and no Origin header.

The Origin results mattered because they showed that this deployment wasn't using that header to reject the tested connections. However, an Origin allowlist alone would not solve the local-process problem: a non-browser client can choose the Origin value it sends.

The missing control was authentication and authorization of the process attaching to the debugger.

## Executing JavaScript Through CDP

CDP clients send JSON messages over the WebSocket. A request includes an identifier, a method, and any parameters that method needs.

For example, this harmless request reads the attached page's origin:

```json
{
  "id": 1,
  "method": "Runtime.evaluate",
  "params": {
    "expression": "document.location.origin",
    "returnByValue": true
  }
}
```

`Runtime.evaluate` executes the expression inside the page's JavaScript context. `returnByValue` requests a serializable result, while the response's request ID lets the client associate it with the original command.

At this point, the local client could execute JavaScript inside the authenticated WebView. The credential exposure depended on one more application-specific detail: what the native application made available to that page.

## The Native Bridge Exposed Raw Credentials

The application used QWebChannel to connect its native layer to JavaScript running inside the WebView.

A bridge like this can expose selected native methods and properties to the interface. Ideally, it provides only the operations the page needs. Here, it exposed an account object containing reusable cloud credentials.

Through CDP, I evaluated JavaScript that accessed this native account object. The returned fields included the bearer token, refresh token, user identifier, and account email.

A redacted representation of those fields is shown below. The target-specific bridge identifiers and credential-reading expression are omitted:

```json
{
  "token": "[REDACTED]",
  "refresh_token": "[REDACTED]",
  "uid": "[REDACTED]",
  "account": "[REDACTED]"
}
```

No native-code exploit was required. The debugger supplied JavaScript execution, and the application's own bridge supplied access to the credentials.

That distinction explains the chain: the exposed debugger was the entry point, while the bridge made that access valuable beyond the local interface.

## Confirming the Token Worked Against the Cloud API

Finding a token-shaped string isn't enough to demonstrate account access. It might be expired, restricted to local use, or unrelated to the authenticated API.

I validated the extracted bearer token with a profile request for the authorized test account:

```http
GET /v1/[redacted]/profile HTTP/1.1
Host: api.target.example
Authorization: Bearer [REDACTED]
```

The API responded:

```http
HTTP/1.1 200 OK
```

The response body contained the test account's profile.

This connected the local debugging exposure to a live cloud credential. The result demonstrated authenticated API access, not merely access to cached account information inside the desktop application.

## Attack Flow

1. The victim launches the production application and signs in.
2. A local process queries `/json` and discovers the authenticated WebView.
3. It attaches to the debugger WebSocket without authentication.
4. JavaScript reads credentials exposed through the native account bridge.
5. The extracted bearer token authenticates a cloud profile request.

## Impact

- A local process that can reach the debugger can extract cloud credentials from the signed-in application.
- The extracted bearer token successfully accessed the account's profile through the production API.
- On shared Windows systems, another user's process presents the same risk wherever it can reach the listener.

## Why Loopback Wasn't Enough

Binding to `127.0.0.1` prevents direct connections from other machines. It does not, by itself, verify that a connecting process belongs to the same OS user as the application.

That matters on shared Windows machines with concurrent user sessions. Separate user accounts do not automatically turn a TCP loopback listener into a private, per-user channel. Reachability still depends on the host's network permissions and isolation controls.

The supplied evidence demonstrates local token extraction and successful profile access. Separate-user exploitation, low-integrity access, and sandbox bypass would need their own test evidence. Likewise, accepting arbitrary Origin headers does not alone demonstrate a remote browser-driven attack.

The refresh token was exposed, but successful refresh wasn't shown. The expiry field also wasn't enough to establish a measured one-year period of access, so that persistence claim isn't needed to explain the demonstrated issue.

## Remediation

**Disable CDP debugging in release builds.** Remove the normal-startup debugging configuration. Developer access should require an explicit, off-by-default development mode.

**Authenticate any debugging interface that must remain.** Enforce per-session authentication and OS-user isolation. A random port reduces predictability but isn't access control. An Origin allowlist is an additional restriction, not proof of the connecting process's identity.

**Keep raw credentials out of the WebView.** The native layer should expose specific authenticated operations rather than returning bearer and refresh tokens to page JavaScript.

**Revoke exposed credentials as appropriate and verify the fix.** Confirm that ordinary production launches no longer expose the debugging listener and that the page bridge no longer returns reusable session credentials.

---
title: "From a Local Debugging Port to Native Code Execution"
date: 2026-11-08T00:00:00Z
draft: false
description: "An exposed local debugger let page JavaScript use a native bridge to write a supplied file and ask Windows to open it, executing a batch file as the application's user."
summary: "An unauthenticated local debugger let a QWebChannel bridge write and launch a supplied batch file as the application's Windows user."
tags: ["QWebChannel", "CDP", "Desktop Security", "Code Execution"]
severity: ["Low"]
program: "Private target"
bounty: "$50"
---

In an authorized Windows desktop application test on July 13, 2026, I found a second consequence of an exposed production debugger: JavaScript inside the application's WebView could write a supplied file to disk and ask Windows to open it.

My [companion write-up on cloud credential exposure](https://brave466.github.io/posts/cloud-credentials-exposed-local-debugging-port/) covers token theft through the same unauthenticated local debugging port. This finding is separate. Instead of reading account credentials, I followed the native bridge from page JavaScript into filesystem operations and executable launch.

The result was execution of a batch file I supplied, under the Windows account running the application. A marker file confirmed that the custom payload ran. I also demonstrated placement in the current user's Startup folder, although execution after a later logon was not tested.

## The entry point: production debugging

The private target's production application embedded QtWebEngine and exposed Chrome DevTools Protocol access at `127.0.0.1:7000` during normal startup. No developer flag or externally configured environment variable was required in the reported test.

The debugger required no authentication. Its `/json` endpoint listed live WebViews and supplied their debugger WebSocket addresses. The tested WebSocket handshakes accepted the supplied Origin values without restriction.

Once connected, a local CDP client could use `Runtime.evaluate` to execute JavaScript in the selected WebView. This was the delivery route used in the test. It was not an internet-facing listener, and reaching it did not demonstrate a remote browser attack.

That distinction matters: CDP provided access to the page context, but the native bridge determined what that access could do beyond the page.

## Following the bridge into the filesystem

The WebView used QWebChannel to expose native functionality to JavaScript. One exposed operation accepted a filename and base64-encoded content, decoded the content, and wrote the bytes to disk.

For readability, I will call this operation `writeFile(name, base64Data)`. That is an illustrative alias, not the application's literal method name.

Conceptually, the interface looked like this:

```text
Illustrative interface — not executable exploit code:

writeFile(name, base64Data)
    decode the supplied content
    construct an output path using the supplied name
    write the decoded bytes
```

The problem was in that path construction. The supplied name was not adequately constrained to a safe filename within the intended destination. Parent-directory components could influence where the decoded bytes were written.

Base64 was only a transport encoding. It did not make the content safe or limit the file type. Combined with path traversal, this gave page-controlled input influence over both the output bytes and their destination, within the application's filesystem permissions.

## Why the timestamp prefix did not contain the write

The native implementation prepended a timestamp and underscore to the supplied filename. At first glance, that appears to prevent a caller from choosing an exact destination name.

The reported traversal accounted for that prefix. A leading path separator made the timestamp-prefixed portion an intermediate path component; a following parent-directory component then moved back out of it. Further traversal reached the desired destination.

In the reported test, this allowed deterministic placement in the current user's Startup folder without knowing the generated timestamp, the Windows username, or the complete absolute destination beforehand.

I am deliberately omitting the full traversal string. The relevant lesson is that adding a prefix does not turn an untrusted path into a safe basename. Path separators and parent components still need to be rejected or handled through a properly constrained file-writing design.

This explanation reflects the submitted test's behavior. It is not a claim that every Windows write API or every Qt application resolves such input identically.

## The second primitive: opening local files

The bridge also exposed file-launch functionality. Three exposed launch routes accepted `file://` URLs and delegated to Windows shell handling. One used `Qt.openUrlExternally`; the other two were application-specific wrappers whose names are omitted here.

Opening a URL is not always equivalent to opening a harmless web page. On Windows, shell handling can launch an executable or invoke the registered handler for a file type.

A separate test opened Calculator through a local executable URL. The report recorded the resulting process and its start time as supporting evidence.

That was useful confirmation of the launch primitive, but Calculator alone would not prove execution of attacker-supplied code. It is an existing system executable. The stronger evidence came from combining the file write with a launch of newly supplied content.

## Proving execution with a custom marker

For the execution test, I supplied a batch file, wrote it through the native file-receive operation, and launched it through an exposed file-opening route.

The batch file created a marker in the current user's temporary directory. That marker contained an expected string and a timestamp, and the report records that it was observed.

Using sanitized artifact names, the evidence chain was:

```text
Supplied batch content → proof.bat
Native file launch    → execution of the supplied batch
Observed result       → %TEMP%/execution-marker.txt
```

These names replace the original artifact names. They are descriptive placeholders, not paths required to reproduce the issue.

The marker tied the result to custom supplied content rather than merely showing that the application could open a pre-existing program. Together, the write and launch primitives supported local arbitrary batch execution as the application's Windows user.

No cloud credential was used by this chain. The application was signed in during testing, however, so the evidence does not independently establish identical behavior in a signed-out state.

## Startup placement was a separate result

The report also demonstrated writing a batch file into the current user's Startup folder. That established a potential next-logon execution route: Windows normally processes eligible Startup items when that user signs in.

It did not establish observed persistence across an actual later logon. The supplied evidence contains placement, not a subsequent sign-in test showing the payload running again.

The distinction is simple: the marker test confirmed immediate custom code execution; Startup placement demonstrated a persistence opportunity. The report states that the test artifacts were removed afterward, leaving no autorun payload behind.

## Impact

- A local client able to reach the debugger could write supplied content outside the intended destination through the native bridge.
- Combining that write with file launch executed a supplied batch file as the application's Windows user.
- Startup-folder placement created a potential next-logon execution route, but execution after another logon was not demonstrated.

## Boundaries of the finding

This was local delivery leading to native code execution, not demonstrated remote network RCE. Once the local client reached the debugger, the tested chain required no further UI interaction.

Separate-user access, sandbox escape, and a web-to-native route through XSS were discussed as possible extensions, but were not demonstrated. The test also did not establish administrator or SYSTEM execution, or shell argument injection into command interpreters. The process ran with the application's existing user privileges.

This was an application bridge design issue, not evidence of a universal vulnerability in Qt or QWebChannel.

## Remediation

Remove production CDP access unless explicitly required. Any retained debugging interface needs authentication and appropriate OS-user isolation; an Origin check alone does not authenticate local processes.

For file writes, accept a basename rather than an arbitrary path, enforce a fixed destination, and reject traversal. A timestamp prefix is not a security boundary.

For launch operations, avoid accepting arbitrary file URLs from page JavaScript. Expose narrowly scoped native actions instead. Treat the bridge as a security boundary: page execution should not automatically grant general-purpose filesystem writes and executable launch.

---
title: "{{ replace .File.ContentBaseName "-" " " | title }}"
date: {{ .Date }}
draft: true
description: "One-line summary of the finding."
summary: "One-line summary shown in the homepage list (usually same as description)."
tags: ["XSS"]            # bug class: XSS, IDOR, SSRF, SQLi, RCE, CSRF, Auth Bypass, ...
severity: ["High"]       # one of: Critical, High, Medium, Low
program: "Program name (public/private, platform)"
bounty: "TBD"            # e.g. "$500", "Swag", "N/A (VDP)"
---

## Summary

Short description of the vulnerability and where it lives.

## Impact

What an attacker can do, who is affected, and why it matters.

## Steps to Reproduce

1. Step one
2. Step two
3. Step three

## Proof of Concept

```http
GET /vulnerable/endpoint?param=PAYLOAD HTTP/1.1
Host: target.example.com
```

## Remediation

How the issue should be fixed.

## Timeline

| Date | Event |
|------|-------|
| YYYY-MM-DD | Reported |
| YYYY-MM-DD | Triaged |
| YYYY-MM-DD | Fixed |
| YYYY-MM-DD | Bounty awarded |
| YYYY-MM-DD | Disclosed |

## Bounty

Amount / outcome.

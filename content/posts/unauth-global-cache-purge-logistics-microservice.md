---
title: "Unauthenticated Global Cache Purge in a Logistics Microservice"
date: 2026-08-31T00:00:00Z
draft: false
description: "An exposed internal endpoint let any unauthenticated user purge the entire cache of a private target's logistics microservice, opening a denial-of-service vector."
summary: "An exposed /internal/ endpoint on a private target's public API let anyone purge the logistics microservice's cache with a single unauthenticated request."
tags: ["Access Control", "Broken Access Control", "DoS", "API"]
severity: ["Low"]
program: "Private target"
bounty: "$100"
---

## Summary

A private target's API gateway exposed an internal administrative endpoint of the logistics microservice to the public internet without any authentication or authorization.

The endpoint, `POST /v1/[redacted]/internal/clear-all-cache`, was reachable through `api.target.example`. Unlike sibling microservices, which properly gate their `/internal/` namespaces, the logistics service validated no JWTs, session cookies, or API keys. Any unauthenticated external actor could trigger a complete purge of the service's application-level cache, creating a direct denial-of-service vector through cache stampeding and resource exhaustion.

## Impact

The exposure of this administrative function primarily affects availability and service integrity:

- **Denial of service via cache stampeding.** Scripting repeated unauthenticated calls keeps the application cache permanently empty, forcing the microservice to run expensive database queries or upstream API calls for every legitimate request (shipping queries, order lookups). This rapidly leads to database connection exhaustion and service timeouts.
- **Performance degradation.** Legitimate users see much higher latency as the system is stripped of its caching layer.
- **Operational disruption.** If the logistics service relies on cached data for consistency during high-volume periods, mass purging can cause data synchronization issues and instability.
- **Zero exploitation cost.** No account, token, or specialized knowledge is required.

## Steps to Reproduce

The issue can be verified with a single unauthenticated HTTP request.

## Proof of Concept

```http
POST /v1/[redacted]/internal/clear-all-cache HTTP/1.1
Host: api.target.example
Content-Type: application/json
Content-Length: 0
```

Or with curl:

```bash
curl -i -X POST "https://api.target.example/v1/[redacted]/internal/clear-all-cache" \
  -H "Content-Length: 0" \
  -H "Content-Type: application/json"
```

The backend accepted the request and returned a successful state (`"code":"SUCCESS"`).

### A note on blind execution and safe harbor

To stay within the program's safe-harbor policy and avoid any risk of a production outage, I did not flood the endpoint to measure latency, and I had no backend visibility to confirm the cache was populated and purged. The impact is inferred from the endpoint's explicit naming (`clear-all-cache`) and the backend accepting the payload and returning `SUCCESS`.

## Remediation

1. **Enforce microservice authentication (immediate).** The logistics service should require a valid administrative token for every endpoint under `/internal/`, matching the posture already used by its sibling services.
2. **Gateway-level filtering (defense in depth).** Configure the public-facing API gateway (Cloudflare / APISIX) to drop or return `404 Not Found` for any external traffic to paths containing `/internal/`. These routes should only be reachable over a VPN or an internal VPC routing mesh.

## Timeline

| Date | Event |
|------|-------|
| 2026-05-31 | Reported to the program |
| 2026-08-04 | Triaged; initial assessment |
| 2026-08-05 | Severity set to Low; $100 bounty awarded |
| 2026-08-31 | Resolved |

## Bounty

$100 (classified Low).

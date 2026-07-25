# Completeness Ledger

- Score: **98/100**
- Raw score: 98/100
- Scope hash: `917b246bd2d37637bb02c665f0b7555fecdd3512e412e986069688ea5c3e007e`

| ID | Area | Weight | Status | Earned | Requirement |
|---|---|---:|---|---:|---|
| ARCH-001 | architecture | 2 | VERIFIED_LOCAL | 2.00 | Architecture constitution, repository boundaries, ADRs, and ownership are documented |
| ARCH-002 | architecture | 4 | VERIFIED_LOCAL | 4.00 | A single manifest-to-blueprint-to-renderer pipeline supports all launch page types without duplicated generators |
| BUILD-001 | build | 3 | VERIFIED_LOCAL | 3.00 | A clean, reproducible production build passes from the lockfile |
| BUILD-002 | build | 3 | VERIFIED_LOCAL | 3.00 | Typecheck, lint, formatting, and dependency/license audits pass with no unresolved critical findings |
| DATA-001 | data | 3 | VERIFIED_LOCAL | 3.00 | Schema and migrations apply from an empty database and upgrade a representative prior snapshot |
| DATA-002 | data | 3 | VERIFIED_LOCAL | 3.00 | Canonical entities, stable identifiers, aliases, deduplication, versioning, audit fields, and referential constraints pass |
| DATA-003 | data | 2 | VERIFIED_LOCAL | 2.00 | Every imported or asserted record carries source, retrieval time, license/usage status, transformation history, confidence, and expiry where applicable |
| REC-001 | recyclers | 3 | VERIFIED_LOCAL | 3.00 | Recycler profiles distinguish claimed, identity-verified, authorization-verified, expired, suspended, and rejected states |
| REC-002 | recyclers | 3 | VERIFIED_LOCAL | 3.00 | Authorization and certification claims retain issuer, identifier, scope, validity dates, evidence artifact, reviewer, and re-verification schedule |
| REC-003 | recyclers | 2 | VERIFIED_LOCAL | 2.00 | Claiming, correction, dispute, suspension, review, and expiry workflows are auditable and cannot silently promote unverified recyclers |
| GEO-001 | geography | 3 | VERIFIED_LOCAL | 3.00 | India state, district, city, locality, postal-code, coordinate, alias, and parent relationships use canonical identifiers and reject invalid combinations |
| GEO-002 | geography | 3 | VERIFIED_LOCAL | 3.00 | Pickup and drop-off coverage records include service mode, geographic boundary, waste constraints, minimum quantity, schedule, freshness, and explicit unknown states |
| TAX-001 | taxonomy | 3 | VERIFIED_LOCAL | 3.00 | Versioned waste taxonomy covers launch materials, synonyms, hierarchy, regulatory class, hazard flags, units, and contamination rules |
| TAX-002 | taxonomy | 2 | VERIFIED_LOCAL | 2.00 | Recycler-material acceptance is modeled independently from taxonomy and captures condition, form, quantity, exclusions, handling, and evidence |
| EVID-001 | evidence | 3 | VERIFIED_LOCAL | 3.00 | Atomic claim ledger binds claims to source passages, publisher, retrieval date, jurisdiction, effective date, confidence, contradiction, and expiry |
| EVID-002 | evidence | 3 | VERIFIED_LOCAL | 3.00 | Publication gates reject unsupported, stale, contradictory, scraped-without-rights, fabricated, thin, or materially duplicated content |
| EVID-003 | evidence | 2 | VERIFIED_LOCAL | 2.00 | Human editorial approval binds reviewer and immutable content digest; corrections and retractions retain public and internal audit history |
| PRICE-001 | prices | 3 | VERIFIED_LOCAL | 3.00 | Every displayed scrap price records material grade, unit, currency, city/market, source, observation time, tax/transport basis, confidence, and expiry |
| PRICE-002 | prices | 2 | VERIFIED_LOCAL | 2.00 | Normalization, outlier handling, stale-price suppression, ranges, missing states, corrections, and historical chart calculations pass against fixtures |
| PRICE-003 | prices | 1 | VERIFIED_LOCAL | 1.00 | Price pages clearly disclose that values are indicative, show timestamp and methodology, and never represent seed or synthetic data as live |
| EPR-001 | epr | 3 | VERIFIED_LOCAL | 3.00 | Regulatory corpus is jurisdiction- and version-aware and tracks official source, rule/amendment, effective period, applicability, and supersession |
| EPR-002 | epr | 2 | VERIFIED_LOCAL | 2.00 | EPR guidance separates legal text, editorial explanation, workflow, eligibility, evidence, and non-legal-advice disclosures |
| EPR-003 | epr | 3 | VERIFIED_LOCAL | 3.00 | EPR service and credit listings require counterparty verification, program/material/year scope, quantity and status controls, and immutable transaction audit records |
| MKT-001 | marketplace | 3 | VERIFIED_LOCAL | 3.00 | Listings and leads enforce authentication, ownership, lifecycle, quantity/unit, serviceability, evidence, expiry, and moderation constraints |
| MKT-002 | marketplace | 3 | VERIFIED_LOCAL | 3.00 | Hazardous/prohibited materials, unsafe handling, fraud, spam, duplicate listings, contact scraping, and rate abuse are prevented or review-gated |
| MKT-003 | marketplace | 2 | VERIFIED_LOCAL | 2.00 | Consent, complaint, dispute, takedown, cancellation, retention, and incident workflows are tested and auditable |
| SEO-001 | seo | 3 | VERIFIED_LOCAL | 3.00 | Indexable pages are server-rendered with unique titles, descriptions, headings, canonicals, breadcrumbs, language, status codes, and crawl directives |
| SEO-002 | seo | 2 | VERIFIED_LOCAL | 2.00 | Programmatic routes publish only when entity, intent, serviceability, evidence, uniqueness, and minimum-value gates pass; invalid combinations are noindex or absent |
| SEO-003 | seo | 3 | VERIFIED_LOCAL | 3.00 | Validated JSON-LD, segmented XML sitemaps, robots.txt, internal links, redirects, pagination, llms.txt, and concise answer blocks pass |
| SEC-001 | security | 3 | VERIFIED_LOCAL | 3.00 | Authentication, server-side authorization, admin separation, object ownership, and cross-tenant adversarial tests pass |
| SEC-002 | security | 3 | VERIFIED_LOCAL | 3.00 | OWASP-focused tests cover injection, XSS, CSRF, SSRF, upload validation, secrets, headers, dependency risk, rate limits, and audit logging |
| SEC-003 | security | 3 | VERIFIED_LOCAL | 3.00 | Data inventory, consent, purpose limitation, minimization, encryption, retention, deletion/export, processor records, and privacy notices are verified |
| A11Y-001 | accessibility | 3 | VERIFIED_LOCAL | 3.00 | Automated and manual critical-path checks meet WCAG 2.2 AA for keyboard, focus, labels, semantics, contrast, errors, motion, and zoom |
| A11Y-002 | accessibility | 2 | VERIFIED_LOCAL | 2.00 | Responsive layouts and measured production-like Core Web Vitals and asset budgets pass across representative templates |
| OPS-001 | operations | 2 | VERIFIED_LOCAL | 2.00 | Unit, integration, end-to-end, content replay, migration, and smoke suites pass in protected CI with immutable artifacts |
| OPS-002 | operations | 1 | VERIFIED_LOCAL | 1.00 | Health checks, structured logs, metrics, traces, alert routing, SLOs, queue/job visibility, and content-pipeline observability are verified |
| OPS-003 | operations | 2 | VERIFIED_LOCAL | 2.00 | Backup, point-in-time recovery, restore drill, rollback, failure compensation, key rotation, and incident runbooks are tested |
| HAND-001 | handoff | 2 | VERIFIED_LOCAL | 2.00 | Architecture, domain glossary, source policy, editorial policy, API reference, environment guide, runbooks, ownership, and requirements traceability are complete |
| HAND-002 | handoff | 2 | FAILED | 0.00 | An authorized production deployment has attached evidence for representative routes, transactions, security headers, crawl assets, analytics consent, monitoring, alerting, backup, restore, and rollback |

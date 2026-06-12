# Affiliate Monetization — Requirements & Launch Checklist

**Status:** Living doc (in progress — ingesting source materials)
**Created:** 2026-06-11
**Goal:** Enumerate everything we must do to start earning affiliate revenue on the Academy
(academy.onethousanddrones.com), per the legal/program terms of each affiliate network we join.

> Not legal advice. This is an engineering/operations reading of the program agreements,
> meant to drive implementation. Have counsel review the consent/privacy items before launch.

---

## Source materials ingested

| Network | Document | Status |
|---|---|---|
| Newark (via CJ Affiliate) | CJ Publisher Service Agreement | ✅ read |
| Newark (via CJ Affiliate) | CJ Affiliate Software Publishers Policy (2022-08-26) | ✅ read |
| Newark (via CJ Affiliate) | "Privacy at CJ" — pointers to CJ's Services + Website/B2B privacy policies | ✅ read |
| Newark (via CJ Affiliate) | Newark's program-specific terms (Click-through Agreement) | ⬜ **not yet provided — blocking dependency** |
| PCBWay | (affiliate program terms) | ⬜ pending |

---

## How to read this doc

- **§1 — Shared site-level work** applies to *every* affiliate network and is done once. This is the
  bulk of the engineering and is reusable across Newark, PCBWay, and any future partner.
- **§2 — Newark / CJ Affiliate** is network-specific.
- **§3 — PCBWay** is a placeholder until those terms arrive.
- **§4** tracks open questions and the launch gate (definition of done).

---

## §1 — Shared site-level prerequisites (all networks)

These are required regardless of which network the link points to. Build once, reuse.

### 1.1 Consent & privacy (legal — hard blockers)
- [ ] **Cookie-consent gate (CMP).** Block all affiliate tracking tags from firing until the visitor
      consents. Must give prominent notice, link to the network's privacy notice, and offer opt-out.
      Required for EU/UK visitors under GDPR/UK-GDPR; safest to apply globally.
      *[CJ PSA §6(e)(II)]*
- [ ] **Link CJ's "Services Privacy Policy"** from both our consent banner and our privacy policy —
      this is the specific network privacy notice the consent mechanism must surface. (CJ is part of
      Publicis Groupe, France HQ → reinforces GDPR/restricted-transfer relevance, see §6(j) SCCs.)
      *[CJ PSA §6(e)(II)(b)]* — ⬜ capture the canonical URL when we set up the account.
- [ ] **Update the privacy policy** to disclose: use of affiliate/third-party tracking tech, cookies,
      what data is collected, and how to opt out. *[CJ PSA §2(e), §6(e)(I)]*
- [ ] **Do not leak PII into tracking links/tags.** Affiliate tracking must not carry directly
      identifiable visitor info, and we must not pipe learner account data into affiliate calls.
      *[CJ PSA §2(d), §4(f)]*
- [ ] **No special-category or under-16 data** may reach the network. *[CJ PSA §6(c)]*
- [ ] **Data-subject rights path** (access/opt-out) wired into the consent mechanism. *[CJ PSA §6(e),(h)]*

### 1.2 Disclosure (legal — hard blocker)
- [ ] **FTC affiliate disclosure** visibly present on every page/component that renders affiliate links
      ("we may earn a commission"). Not in the contract verbatim but required by US law and implied by
      the "don't mislead / act legally" clauses. *[CJ PSA §2(b), §8(d)]*

### 1.3 Link architecture (engineering)
- [ ] **Single affiliate-link resolver / config layer.** All outbound affiliate URLs generated through
      one module so we can (a) update tracking params network-wide, (b) swap rates/programs, and
      (c) **remove every link in one switch** on termination. Do **not** hardcode affiliate URLs into
      lesson content, seeds, or migrations. *[CJ PSA §7(f), §1(b)]*
- [ ] **First-party placement only.** Affiliate links render on our own pages (parts catalog / BOM /
      lesson "buy this part" components). *[CJ PSA §1(d)(i)]*
- [ ] **Do NOT emit affiliate links through the public Parts MCP server or any API** that hands them to
      third-party properties — that breaks the placement, integrity, consent, and disclosure
      obligations downstream. Keep MCP output affiliate-free. *[CJ PSA §1(d)(i), §1(d)(iii)]*
- [ ] **Web-only at launch.** No affiliate links in email/newsletters until we register that channel as
      a "special" promotional method (manual network approval) and meet CAN-SPAM. *[CJ PSA §2(c), §2(b)(iv)]*

### 1.4 Conduct (operations)
- [ ] **No self-clicking / non-bona-fide transactions.** The team buys parts to build lessons — those
      purchases must **not** go through our own affiliate links. Same-entity/IP repeat buys get flagged.
      *[CJ PSA §1(d)(ii)]*
- [ ] **Treat affiliate revenue as variable and reversible** (charge-backs can hit past cycles). Don't
      book it as guaranteed. *[CJ PSA §3(b)]*

---

## §2 — Newark (via CJ Affiliate / Commission Junction)

### 2.1 Account & program onboarding
- [ ] Apply to **CJ Affiliate** as a publisher; complete account with accurate, current info
      (contact, all websites used). *[CJ PSA §2(a)]*
- [ ] **Accurately describe all promotional methods** in the account; designate as "special" anything
      beyond on-site website links. *[CJ PSA §2(a), §2(b)(iv)]*
- [ ] Apply to **Newark's program**; on acceptance, review and accept Newark's **Click-through
      Agreement** (program-specific terms). *[CJ PSA §1(a), §1(c)]*
- [ ] **Obtain & record Newark's program terms** — commission rate, cookie/attribution window, payment
      threshold, whether **deep linking** to specific part pages is allowed, restricted categories, and
      whether an **education/content site** is an accepted publisher type. *(⛔ blocking dependency — not
      yet provided)* *[CJ PSA §1(b), §1(c)]*
- [ ] Complete **tax forms** (e.g., W-9 / W-8) and payment setup. *[CJ PSA §3(i)]*
- [ ] Choose **payout currency + method**; note the **Minimum Account Balance** threshold and the
      ~20th-of-month payout cadence; understand CJ only pays after collecting from Newark. *[CJ PSA §3(e)]*
- [ ] **Don't enroll until ready to drive traffic** — dormant-account fees accrue after 6 months with no
      compensable transaction, and accounts can be deactivated after 30 days of inactivity. *[CJ PSA §3(f), §7(c)(ii)]*

### 2.2 CJ link implementation
- [ ] Generate links in **CJ's tracking format**, embed and maintain the **CJ Tracking Code**, and do
      **not** modify links, strip params, or remove copyright/trademark notices. *[CJ PSA §1(e), §1(f), §4(a)]*
- [ ] Update links when CJ notifies (if not dynamically updated). *[CJ PSA §1(e)]*
- [ ] Respect Newark/CJ trademarks — only use creative/branding as provided. *[CJ PSA §1(d)(iii), §4(a)]*

### 2.3 CJ Affiliate Software Publishers Policy
**Applicability: N/A while we remain a website.** This policy governs downloadable software, browser
plugins, and browser extensions only. We have none, so none of it binds us today.

- [ ] **Decision recorded: we will NOT ship affiliate software (extension/plugin/desktop tool) at
      launch.** Keeping this true keeps the entire policy out of scope.
- [ ] **Guardrail for the future** — if we ever build a browser extension / tool (e.g., a "find this
      part" helper), the following kick in *before* distribution:
  - CJ must **test and approve** the tool before release; re-approval required on every change. *[Rule 1]*
  - **No bundling** the extension with other installers; full transparency on distribution. *[Rule 2]*
  - **No auto-redirect** — may only route through a CJ link *after* an explicit user click. *[Rule 3]*
  - **EULA + privacy policy opt-in before install**, describing what triggers affiliate-cookie placement. *[Rule 4]*
  - **Easy, complete uninstall** always available. *[Rule 5]*
  - **Respect prior CJ interactions** (no last-click hijack): if traffic shows `afsrc=1`, a `cjevent`
    param, or a prior CJ-domain redirect and we don't own the referring domain, the software must not
    operate/redirect with our PID. *[Rule 6]*

### 2.4 Financial / operational awareness (CJ specifics)
- [ ] Note CJ can **amend the agreement on 14 days' notice**; Newark can **change payout rates anytime**
      and **terminate us on 7 days' notice for any/no reason**. Don't hardcode economics. *[CJ PSA §1(b), §7(b), §10(j)]*
- [ ] Keep the account out of **negative balance** (charge-backs exceeding balance accrue 1.5%/mo). *[CJ PSA §3(g)]*
- [ ] On termination we must **immediately remove all Newark links** — covered by the resolver in §1.3. *[CJ PSA §7(f)]*

---

## §3 — PCBWay (pending)

> Placeholder. To be filled when PCBWay's affiliate terms are provided. Expect overlap with §1
> (consent, disclosure, link resolver) plus PCBWay-specific account/payment/commission terms. Note
> PCBWay typically runs an **in-house** affiliate program (not CJ), so the network mechanics, cookie
> window, and payout method will differ.

- [ ] _TBD_

---

## §4 — Open questions & launch gate

### Blocking dependencies
- ⛔ **Newark's program-specific terms (Click-through Agreement)** — gates the economic model: are
  education/content sites accepted? deep-linking allowed? commission rate & cookie window? payment
  threshold?
- ⬜ PCBWay terms.

### Definition of done (minimum to flip affiliate links live)
1. ✅ Consent gate blocks affiliate tags until opt-in (§1.1)
2. ✅ Privacy policy updated (§1.1)
3. ✅ FTC disclosure on affiliate components (§1.2)
4. ✅ Single removable link resolver, first-party only, MCP excluded (§1.3)
5. ✅ Accepted into Newark's program with terms recorded (§2.1)
6. ✅ Links use CJ tracking format, unmodified (§2.2)
7. ✅ Team-purchase self-click policy communicated (§1.4)

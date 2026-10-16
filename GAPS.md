# Reporting Labs Gap Analysis

Comparison of `playwright-ai-reporter` with
[`naveenautomationlabs/reporting-labs`](https://github.com/naveenautomationlabs/reporting-labs).

## Snapshot and method

- Competitor repository: `naveenautomationlabs/reporting-labs`
- Branch: `main`
- Commit inspected:
  [`a83b0fe3ce9be9c0802fc0173867de64a3c1a7a4`](https://github.com/naveenautomationlabs/reporting-labs/commit/a83b0fe3ce9be9c0802fc0173867de64a3c1a7a4)
- Package version: `0.6.19`
- Comparison target: `playwright-ai-reporter` `main` after `v0.1.1`

The competitor's full recursive tree was inventoried (approximately 70 blobs). All behavior-relevant
TypeScript, CLI, configuration, examples, and CI documentation were reviewed. Generated lockfiles,
fonts, screenshots, GIFs, logos, licenses, and repository-governance files were classified but not
treated as product logic. The 193 KB [`src/template.ts`](https://github.com/naveenautomationlabs/reporting-labs/blob/a83b0fe3ce9be9c0802fc0173867de64a3c1a7a4/src/template.ts)
was sampled and cross-checked against the public feature documentation and supporting types rather
than reviewed character by character.

## Executive summary

`playwright-ai-reporter` is ahead where automation changes the engineering workflow:

- six AI providers and offline-safe Copilot CLI integration;
- automatic GitHub, Jira, and Azure DevOps bug creation;
- safe draft-PR generation and verified-close bug lifecycle;
- structured flaky/new/known failure classification;
- SQLite and MySQL persistence;
- email notifications;
- tested provider architecture and release CI;
- redacted page fetch/XHR evidence;
- a verified, independent single-file HTML artifact.

`reporting-labs` is ahead where a report is a polished, configurable product:

- Playwright, Cypress/Cucumber, and WebdriverIO support;
- sharded-report merge CLI;
- richer step, retry, visual-comparison, stdout/stderr, and attachment presentation;
- deterministic offline error explanations;
- extensive report branding, layout, dimension, link, and export options;
- onboarding CLI, snippets, PDF export, and broader CI examples.

The recommended direction is not to reproduce the competitor wholesale. Preserve the
evidence-first automation and provider architecture, then close the high-value Playwright reporting
gaps in the order below.

## Capability matrix

| Capability          | reporting-labs                                                          | playwright-ai-reporter                                                                                 | Assessment                                            |
| ------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| Independent HTML    | Inline data, CSS, JavaScript, fonts, and attachments                    | Inline data, CSS, JavaScript, and small screenshots with generation-time validation                    | Parity; our invariant is tested and release-gated     |
| Report navigation   | Overview, failures, test detail, timeline, trend                        | Overview, tests, failures, API, timeline, trend                                                        | Parity with different strengths                       |
| Failure clustering  | Error-message normalization                                             | Error-shape normalization                                                                              | Parity                                                |
| Run history         | Flat JSON, 30 runs                                                      | Flat JSON, 30 runs plus optional databases                                                             | Our advantage                                         |
| Flakiness           | History dots and new/known status                                       | Stable/flaky/new/consistent verdict, rate, evidence, pattern, recommendation                           | Our advantage                                         |
| AI analysis         | None; rule-based only                                                   | Copilot, Azure OpenAI, OpenAI, Anthropic, Gemini, Mistral                                              | Our advantage                                         |
| Issue tracking      | Copyable bug text and generic links                                     | Live GitHub, Jira, and Azure DevOps creation/deduplication/close                                       | Our advantage                                         |
| Fix workflow        | None                                                                    | Guarded corrected-file extraction and draft PRs                                                        | Our advantage                                         |
| Data persistence    | JSON history only                                                       | JSON history, SQLite, MySQL                                                                            | Our advantage                                         |
| Notifications       | Copyable Slack text; consumer-owned webhook sample                      | SMTP email provider                                                                                    | Mixed; both lack native Slack/Teams                   |
| Runners             | Playwright, Cypress/Cucumber, WebdriverIO                               | Playwright                                                                                             | Competitor advantage                                  |
| Shards              | `reporting-labs merge`                                                  | No merge command                                                                                       | Competitor advantage                                  |
| API evidence        | Global `APIRequestContext.fetch` patch plus attachment helpers          | Explicit page/context fetch/XHR recorder fixture                                                       | Competitor has broader capture; ours is less invasive |
| Secret masking      | Key patterns, token regexes, learned values, Luhn card detection        | Shared global boundary with keys, environment values, tokens, JWTs, learned values, and Luhn detection | Parity; ours covers outbound providers and artifacts  |
| Failure explanation | Deterministic taxonomy with hints                                       | Small deterministic taxonomy plus optional AI                                                          | Gap when AI is disabled                               |
| Test steps          | Step subtitles, timing bars, BDD styling                                | Attempt summaries; no equivalent step visualization                                                    | Competitor advantage                                  |
| Visual assertions   | Before/after/diff slider                                                | Screenshot display only                                                                                | Competitor advantage                                  |
| Retry UX            | Retry tabs in test detail                                               | Attempt list and flaky evidence                                                                        | Competitor advantage in presentation                  |
| Customization       | Title, logo, accent, palette, custom CSS, widgets, dimensions, sections | Eight themes and fixed report structure                                                                | Competitor advantage                                  |
| Exports             | JSON, CSV, bug text, Slack summary, optional PDF                        | JSON data, Markdown analysis/CI summary, standalone HTML                                               | Competitor advantage                                  |
| Onboarding          | `init`, `snippets`, `merge` CLI                                         | Documentation and environment examples                                                                 | Competitor advantage                                  |
| Automated tests     | No formal source test suite or repository CI found                      | 112 unit tests plus Node 22 PR/main/release gates                                                      | Our advantage                                         |

## Prioritized gaps

### P0 - Global secret redaction - Implemented

**Implemented state**

[`src/utils/redaction.ts`](./src/utils/redaction.ts) now provides one shared redaction boundary for
structured data and text. It protects recorder attachments, generated JSON/HTML/Markdown/history,
AI prompts and responses, bug and pull-request text, email payloads, database parameters,
configuration diagnostics, metadata attachments, and reporter failure logging.

**Competitor evidence**

[`src/mask.ts`](https://github.com/naveenautomationlabs/reporting-labs/blob/a83b0fe3ce9be9c0802fc0173867de64a3c1a7a4/src/mask.ts)
recognizes provider-token formats, JWTs, card numbers with Luhn validation, sensitive environment
variables, and learned secret values that are masked wherever they later appear.

**Implementation**

The service recognizes sensitive keys and environment variables, common provider tokens, JWTs,
authorization credentials, key-value credentials, and Luhn-valid payment-card numbers. Values
learned from sensitive fields are masked wherever they recur in the same or later payload.

**Acceptance criteria completed**

- One redaction API covers strings, headers, URLs, nested structured values, and JSON serialization.
- Learned values and common token formats are masked.
- Outbound providers and report writers call the shared API at their final boundary.
- Negative-control tests cover HTML, JSON, Markdown, AI prompts/responses, issues, email, and both
  database providers.

### P1 - Sharded report merge

**Current state**

There is no command that combines multiple `testSummary.json`/`testFailures.json` outputs into one
health report. CI matrix and Playwright shard users receive separate reports and trends.

**Competitor evidence**

[`bin/merge.js`](https://github.com/naveenautomationlabs/reporting-labs/blob/a83b0fe3ce9be9c0802fc0173867de64a3c1a7a4/bin/merge.js)
merges shard JSON, namespaces assets, and renumbers worker lanes.

**Recommendation**

Add `playwright-ai-reporter merge <inputs...> --output <dir>`. Define a versioned intermediate JSON
schema first. Merge test identity, attempts, build metadata, API calls, artifact paths, AI analyses,
and worker timelines deterministically.

### P1 - Rich Playwright diagnostic capture

**Missing presentation**

- Playwright step hierarchy, step subtitles, and step durations;
- captured stdout/stderr associated with the run or test;
- expected-versus-received assertion diff;
- before/actual/diff slider for `toHaveScreenshot`;
- retry tabs with attempt-specific evidence;
- BDD/Gherkin-styled steps and data tables.

**Competitor evidence**

The collection logic is concentrated in
[`src/reporter.ts`](https://github.com/naveenautomationlabs/reporting-labs/blob/a83b0fe3ce9be9c0802fc0173867de64a3c1a7a4/src/reporter.ts),
with UI in
[`src/template.ts`](https://github.com/naveenautomationlabs/reporting-labs/blob/a83b0fe3ce9be9c0802fc0173867de64a3c1a7a4/src/template.ts).

**Recommendation**

Extend the versioned report model before changing the UI. Preserve evidence per attempt and render
steps, logs, assertion diffs, and visual comparisons in the failure detail panel.

### P1 - Deterministic offline explanations

**Current state**

[`src/utils/flakyAnalysis.ts`](./src/utils/flakyAnalysis.ts) classifies a small error taxonomy
(`Network`, `Ambiguous locator`, `Assertion timing`, `Assertion`, `Element not ready`, `Unknown`).
Rich analysis generally depends on an AI provider.

**Competitor evidence**

[`src/explain.ts`](https://github.com/naveenautomationlabs/reporting-labs/blob/a83b0fe3ce9be9c0802fc0173867de64a3c1a7a4/src/explain.ts)
has a broader deterministic taxonomy covering visibility, blocked/disabled/detached elements,
navigation, API, hook timeout, closed/crashed browser, scripts, files, and thrown errors.

**Recommendation**

Expand the non-AI explanation layer and use AI only to enrich it. Every user should receive a
useful label, plain-language summary, evidence-based hint, and safe next step without credentials or
network access.

### P1 - Report customization and generic links

**Current state**

The report has eight themes and metadata breakdowns, but its title, logo, accent, visible widgets,
custom dimensions, sections, CSS, and ticket links are not a supported configuration surface.

**Competitor evidence**

[`src/types.ts`](https://github.com/naveenautomationlabs/reporting-labs/blob/a83b0fe3ce9be9c0802fc0173867de64a3c1a7a4/src/types.ts)
supports branding, palettes, custom CSS, sections, widget visibility, dimensions, dimension order,
and generic placeholder-based links.

**Recommendation**

Add a typed `report` configuration namespace. Sanitize custom HTML/CSS, keep standalone validation,
and support generic links without requiring a live provider integration.

### P1 - Export and sharing workflows

Add:

- filtered CSV and JSON exports;
- copyable plain-text/Markdown/Jira failure reports;
- copyable Slack/Teams run summary;
- optional deterministic PDF export with an explicit failure result;
- configurable attachment/video embedding budgets.

Do not copy the competitor's silent PDF fallback. A requested PDF should either be produced or
return a visible warning/failure according to configuration.

### P2 - Broader API capture

[`src/recorder.ts`](./src/recorder.ts) records browser-page/context fetch and XHR traffic. It does
not automatically capture Playwright `request`, `page.request`, or standalone
`APIRequestContext` calls.

Add an opt-in fixture or wrapper for `APIRequestContext`. Avoid globally monkey-patching
Playwright prototypes as done by the competitor's
[`src/auto.ts`](https://github.com/naveenautomationlabs/reporting-labs/blob/a83b0fe3ce9be9c0802fc0173867de64a3c1a7a4/src/auto.ts);
global patches are version-sensitive and difficult to isolate.

### P2 - Onboarding CLI

Add a small CLI with:

- `init` to generate a typed configuration and CI sample;
- `doctor` to validate provider variables, package exports, templates, browser availability, and
  writable output paths;
- `merge` for shard consolidation;
- optional VS Code snippets for `meta()` and API recording.

Keep it non-interactive by default and never write credentials.

### P2 - Comment-based metadata

The current [`meta()`](./src/meta.ts) attachment API is explicit and type-safe. A comment parser
could offer zero-import migration for existing suites, but it should be opt-in and subordinate to
explicit metadata. Ignore standard JSDoc tags and ordinary `@mentions`.

### P2 - CI and ecosystem examples

Current first-party examples cover GitHub Actions and Azure Pipelines. Add validated examples for:

- GitLab CI;
- Jenkins;
- Playwright sharding/matrix runs;
- history caching and merged report publication;
- optional Slack/Teams delivery after native providers exist.

### Strategic decision - Multi-runner support

`reporting-labs` supports Cypress/Cucumber and WebdriverIO through
[`src/cypress/`](https://github.com/naveenautomationlabs/reporting-labs/tree/a83b0fe3ce9be9c0802fc0173867de64a3c1a7a4/src/cypress)
and
[`src/wdio/`](https://github.com/naveenautomationlabs/reporting-labs/tree/a83b0fe3ce9be9c0802fc0173867de64a3c1a7a4/src/wdio).

Do not add those runners inside the current package without a product decision. If pursued, first
extract a runner-neutral report schema and renderer, then publish adapter packages such as
`@playwright-ai-reporter/cypress` and `@playwright-ai-reporter/wdio`.

## Existing backlog not created by this comparison

These are genuine local gaps, but `reporting-labs` does not solve them with equivalent live
providers:

- PostgreSQL provider:
  [`src/providers/factories/DatabaseFactory.ts`](./src/providers/factories/DatabaseFactory.ts)
- Slack and Microsoft Teams notification providers:
  [`src/providers/factories/NotificationFactory.ts`](./src/providers/factories/NotificationFactory.ts)
- predictive failure analysis and cross-browser correlation:
  [`docs/design.md`](./docs/design.md)

The older roadmap also lists AI models, visual reporting, issue tracking, and auto-healing as
future work even though those now exist. Update or replace that roadmap to avoid false gaps.

## Capabilities to preserve

Do not regress these differentiators while closing report gaps:

1. Provider isolation and explicit configuration failures.
2. No-key GitHub Copilot workflow.
3. Safe corrected-file validation before PR creation.
4. Exact test-to-bug lifecycle with verified close on a first-attempt pass.
5. Structured flaky/new/known classification with evidence and recommendations.
6. Queryable database providers.
7. Self-contained report generation validated before writing.
8. Automated unit, build, audit, and release gates.

## Practices not to copy

- Global prototype monkey-patching for automatic API capture.
- Silent success when a requested PDF cannot be produced.
- A single 193 KB hand-maintained template containing most CSS and JavaScript.
- Adding multiple runners before defining a stable runner-neutral report schema.
- Treating copyable bug text or webhook snippets as equivalent to live integrations.

## Suggested delivery sequence

1. Global redaction boundary and regression suite. **Completed.**
2. Versioned intermediate report schema and shard merge CLI.
3. Step/log/assertion/visual evidence capture and UI.
4. Expanded deterministic offline explanations.
5. Typed report customization, generic links, and exports.
6. APIRequestContext fixture and onboarding CLI.
7. GitLab/Jenkins/sharding examples.
8. Decide whether multi-runner adapters fit the product strategy.

Each item should ship behind tests that validate the exact generated data and standalone HTML, with
negative controls for secret leakage and malformed shard inputs.

## Competitor limitations and risk context

The comparison should not be read as a recommendation to replace the current architecture:

- no AI providers, automated issue creation, auto-fix PRs, databases, or notification providers;
- no formal source unit-test suite or repository CI found;
- history is a local 30-run JSON file unless consumers cache it;
- PDF is best-effort and can be skipped;
- the report renderer is concentrated in a very large template source;
- Jest/Vitest support is still roadmap-only;
- project ownership appears concentrated in one maintainer.

## File coverage appendix

### Behavior-bearing source reviewed

- Core: `src/reporter.ts`, `src/template.ts`, `src/types.ts`, `src/explain.ts`, `src/mask.ts`,
  `src/meta.ts`, `src/comments.ts`, `src/auto.ts`, `src/pdf.ts`, `src/write-report.ts`,
  `src/index.ts`
- Cypress: `src/cypress/index.ts`, `src/cypress/support.ts`
- WebdriverIO: `src/wdio/reporter.ts`, `src/wdio/env.ts`, `src/wdio/finalize.ts`,
  `src/wdio/index.ts`
- CLI: `bin/cli.js`, `bin/merge.js`, `bin/build-template.js`, `bin/config-template.txt`,
  `bin/snippets.code-snippets`
- CI documentation: `docs/ci/github-actions.yml`, `docs/ci/Jenkinsfile`,
  `docs/ci/gitlab-ci.yml`
- Examples: Playwright examples and configuration, Cypress examples, and Cypress Cucumber
  examples

### Classified but not treated as product logic

- `package-lock.json`
- `fonts/*.woff2`
- `docs/*.png`, `docs/quickstart.gif`
- `assets/*.svg`
- `.gitignore`, `.github/FUNDING.yml`, `CODE_OF_CONDUCT.md`, `LICENSE`, `tsconfig.json`

### Scope exclusions

- Java and Python sibling repositories were not inspected.
- Historical commits beyond the pinned comparison commit were not exhaustively audited.

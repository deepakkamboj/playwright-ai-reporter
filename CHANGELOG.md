# Changelog

## 0.1.2 - 2026-10-16

### Added

- Versioned, deterministic shard-report merging with atomic output, copied evidence, unique worker
  lanes, and a standalone merged HTML report.
- Opt-in `APIRequestContext` recording for direct Playwright API calls without global prototype
  changes.
- `init`, `doctor`, and `snippets` onboarding commands in the published CLI.
- Opt-in adjacent JSDoc metadata with explicit `meta()` attachment precedence.
- GitHub Actions shard-matrix, GitLab CI, and Jenkins report-publication examples.
- A full report screenshot and downloadable self-contained HTML sample in the README.

### Security

- Applied shared secret redaction to generated reports, history, API evidence, AI providers, issue
  and pull-request providers, notifications, databases, diagnostics, and logs.
- Reject shard artifacts and AI-analysis paths that escape their source directory.

### Changed

- Added report schema version 1 while retaining merge compatibility with legacy unversioned reports.
- Expanded standalone-report and release documentation for the new CLI and CI workflows.

## 0.1.1 - 2026-10-15

### Added

- Self-contained interactive HTML test-health report with embedded data, CSS, JavaScript and small screenshots.
- History-based flaky, new-failure and known-failure analysis.
- Test metadata and redacted fetch/XHR recording.
- GitHub and Azure Pipelines summaries and independent report artifacts.
- GitHub Copilot analysis provider and verified-close bug lifecycle.

### Security

- Upgraded Axios, Azure Identity, MySQL, Nodemailer and SQLite to audit-clean versions.
- Added full dependency audits to pull-request, main and release workflows.
- Validated standalone report output before it is written.

### Changed

- Node.js 22 is now the minimum supported runtime.
- AI-generated pull requests require a complete corrected file that passes safety checks.

# Changelog

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

# Playwright AI Reporter documentation

Public product guides and a Nextra documentation portal for **playwright-ai-reporter**.
The portal uses the Test Health Report's **Corporate** palette, with a **Midnight**
dark appearance and the report's green product logo.

## Guides

- [Detailed features](pages/features.mdx)
- [Getting started](pages/getting-started.mdx)
- [Usage](pages/usage.mdx)
- [Configuration](pages/configuration.mdx)
- [Test Health Report](pages/reporting.mdx)
- [Providers & integrations](pages/integrations.mdx)
- [API & metadata](pages/api-reference.mdx)
- [CI/CD & shard merging](pages/deployment.mdx)
- [Troubleshooting](pages/troubleshooting.mdx)
- [Architecture](pages/architecture.mdx)

## Run the portal locally

Use Node.js 22 or newer. From the repository root:

```powershell
# docs\package.json
npm ci --prefix docs
npm run dev --prefix docs
```

Open `http://localhost:3000`. The site is separate from the reporter's runtime package.

## Validate and export

```powershell
# docs\package.json
npm run typecheck --prefix docs
$env:NEXT_PUBLIC_BASE_PATH = "/playwright-ai-reporter"
npm run build --prefix docs
```

The static export is written to `docs/out`. For hosting at a domain root, omit the
base-path environment variable. Set the same base path for development when testing
project-site URLs.

`next start` is not a preview server for this static export; use the development
command above or a static file server mounted at the configured base path.

## Publish to GitHub Pages

The [documentation workflow](../.github/workflows/docs-pages.yml) builds and publishes
the static export when documentation, branding, sample assets, build tooling, or the
workflow changes on `main`. It can also be started from **Actions → Publish
documentation to GitHub Pages → Run workflow**. Select `main` to publish; manual
runs on other branches build the site without deploying.

In **Settings → Pages → Build and deployment**, select **GitHub Actions** as the
source. The workflow obtains the correct base path from GitHub Pages, installs the
root lint tooling and documentation dependencies using their lockfiles, builds the
portal, verifies the exported pages/assets, and deploys `docs/out`. It uses the
built-in GitHub token and OIDC; no personal access token is required. Any protection
rules on the `github-pages` environment still apply.

The published portal is
[deepakkamboj.github.io/playwright-ai-reporter](https://deepakkamboj.github.io/playwright-ai-reporter/).
Check the workflow's deployment job for the live URL and deployment status.
A local build does not publish the site or enable Pages on the repository.

## Public assets and branding

Development and build scripts copy the illustrative Test Health Report HTML and screenshot
from `../assets/` into the ignored public output files, keeping one canonical copy in Git.
The new product wordmark and compact mark are maintained in
`../src/assets/`; the previous logo remains unchanged in `../assets/logo.png`.

Local research, implementation notes, and the `docs22` archive are not part of this
public documentation. The root ignore rules keep that archive local.

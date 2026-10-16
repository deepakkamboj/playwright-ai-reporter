import * as fs from 'fs';
import * as path from 'path';

export interface GeneratedFile {
    path: string;
    overwritten: boolean;
}

export interface DoctorCheck {
    name: string;
    ok: boolean;
    detail: string;
}

export interface DoctorRuntime {
    cwd: string;
    env: NodeJS.ProcessEnv;
    nodeVersion: string;
    packageRoot: string;
    playwright: () => {packagePath: string; browserPath: string};
}

const REPORTER_CONFIG = `import type {ReporterConfig} from 'playwright-ai-reporter';

const aiReporterConfig = {
    outputDir: 'test-results/ai-report',
    historyFile: 'test-results/history.json',
    commentMetadata: false,
} satisfies ReporterConfig;

export default aiReporterConfig;
`;

const CI_WORKFLOW = `name: Playwright tests

on:
  push:
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npx playwright test
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-ai-report
          path: test-results/ai-report/test-health-report.html
          if-no-files-found: error
`;

const VSCODE_SNIPPETS = `${JSON.stringify(
    {
        'Configure Playwright AI reporter': {
            prefix: 'pw-ai-reporter',
            body: [
                "['playwright-ai-reporter', {",
                "  outputDir: 'test-results/ai-report',",
                "  historyFile: 'test-results/history.json',",
                '}]',
            ],
            description: 'Add the standalone Playwright AI reporter to reporter configuration',
        },
        'Add Playwright AI metadata': {
            prefix: 'pw-ai-meta',
            body: ["await meta({priority: '${1:P1}', severity: '${2:major}', owner: '${3:team}' });"],
            description: 'Attach structured report metadata to the current test',
        },
        'Record API requests': {
            prefix: 'pw-ai-api-recorder',
            body: [
                'const test = base.extend(apiRequestRecorderFixture);',
                "test('${1:name}', async ({recordedRequest}) => {",
                "  await recordedRequest.get('${2:https://api.example.test}');",
                '});',
            ],
            description: 'Opt a test into APIRequestContext evidence capture',
        },
    },
    null,
    2,
)}
`;

function writeGeneratedFiles(
    root: string,
    files: Array<{relativePath: string; content: string}>,
    force: boolean,
): GeneratedFile[] {
    const targets = files.map((file) => ({...file, path: path.resolve(root, file.relativePath)}));
    const conflicts = targets.filter((target) => fs.existsSync(target.path));
    if (!force && conflicts.length > 0) {
        throw new Error(
            `Refusing to overwrite existing file${conflicts.length === 1 ? '' : 's'}: ` +
                conflicts.map((target) => target.path).join(', ') +
                '. Re-run with --force to replace them.',
        );
    }

    return targets.map((target) => {
        const overwritten = fs.existsSync(target.path);
        fs.mkdirSync(path.dirname(target.path), {recursive: true});
        fs.writeFileSync(target.path, target.content, 'utf8');
        return {path: target.path, overwritten};
    });
}

export function initializeProject(root: string, force = false): GeneratedFile[] {
    return writeGeneratedFiles(
        root,
        [
            {relativePath: 'playwright-ai-reporter.config.ts', content: REPORTER_CONFIG},
            {relativePath: path.join('.github', 'workflows', 'playwright-ai-report.yml'), content: CI_WORKFLOW},
        ],
        force,
    );
}

export function installSnippets(root: string, force = false): GeneratedFile[] {
    return writeGeneratedFiles(
        root,
        [{relativePath: path.join('.vscode', 'playwright-ai-reporter.code-snippets'), content: VSCODE_SNIPPETS}],
        force,
    );
}

function nearestExistingDirectory(target: string): string {
    let current = path.resolve(target);
    while (!fs.existsSync(current)) {
        const parent = path.dirname(current);
        if (parent === current) return current;
        current = parent;
    }
    return fs.statSync(current).isDirectory() ? current : path.dirname(current);
}

function providerChecks(env: NodeJS.ProcessEnv): DoctorCheck[] {
    const requirements: Record<string, Record<string, string[]>> = {
        AI_PROVIDER: {
            'azure-openai': ['AZURE_OPENAI_ENDPOINT'],
            azure: ['AZURE_OPENAI_ENDPOINT'],
            openai: ['OPENAI_API_KEY'],
            anthropic: ['ANTHROPIC_API_KEY'],
            claude: ['ANTHROPIC_API_KEY'],
            'google-ai': ['GOOGLE_AI_API_KEY'],
            google: ['GOOGLE_AI_API_KEY'],
            gemini: ['GOOGLE_AI_API_KEY'],
            mistral: ['MISTRAL_API_KEY'],
            copilot: [],
            'github-copilot': [],
        },
        BUG_TRACKER_PROVIDER: {
            github: ['GITHUB_TOKEN|GH_TOKEN', 'GITHUB_OWNER|GITHUB_REPOSITORY', 'GITHUB_REPO|GITHUB_REPOSITORY'],
            'azure-devops': ['AZURE_DEVOPS_ORG_URL', 'AZURE_DEVOPS_PROJECT', 'AZURE_DEVOPS_PAT'],
            ado: ['AZURE_DEVOPS_ORG_URL', 'AZURE_DEVOPS_PROJECT', 'AZURE_DEVOPS_PAT'],
            azdo: ['AZURE_DEVOPS_ORG_URL', 'AZURE_DEVOPS_PROJECT', 'AZURE_DEVOPS_PAT'],
            jira: ['JIRA_HOST', 'JIRA_EMAIL', 'JIRA_API_TOKEN', 'JIRA_PROJECT_KEY'],
        },
        PR_PROVIDER: {
            github: ['GITHUB_TOKEN|GH_TOKEN', 'GITHUB_OWNER|GITHUB_REPOSITORY', 'GITHUB_REPO|GITHUB_REPOSITORY'],
            'azure-devops': [
                'AZURE_DEVOPS_ORG_URL',
                'AZURE_DEVOPS_PROJECT',
                'AZURE_DEVOPS_PAT',
                'AZURE_DEVOPS_REPO|AZURE_DEVOPS_REPOSITORY_ID',
            ],
            ado: [
                'AZURE_DEVOPS_ORG_URL',
                'AZURE_DEVOPS_PROJECT',
                'AZURE_DEVOPS_PAT',
                'AZURE_DEVOPS_REPO|AZURE_DEVOPS_REPOSITORY_ID',
            ],
            azdo: [
                'AZURE_DEVOPS_ORG_URL',
                'AZURE_DEVOPS_PROJECT',
                'AZURE_DEVOPS_PAT',
                'AZURE_DEVOPS_REPO|AZURE_DEVOPS_REPOSITORY_ID',
            ],
        },
        DATABASE_PROVIDER: {
            sqlite: [],
            mysql: ['MYSQL_HOST', 'MYSQL_USER', 'MYSQL_PASSWORD', 'MYSQL_DATABASE'],
        },
        NOTIFICATION_PROVIDER: {
            email: ['EMAIL_USER', 'EMAIL_PASSWORD'],
        },
    };

    const checks: DoctorCheck[] = [];
    for (const [selector, providers] of Object.entries(requirements)) {
        const selected = env[selector]?.toLowerCase();
        if (!selected) continue;
        const expected = providers[selected];
        if (!expected) {
            checks.push({name: selector, ok: false, detail: `unsupported value "${selected}"`});
            continue;
        }
        const missing = expected.filter((alternatives) => !alternatives.split('|').some((name) => Boolean(env[name])));
        checks.push({
            name: `${selector}=${selected}`,
            ok: missing.length === 0,
            detail: missing.length === 0 ? 'required environment variables are set' : `missing ${missing.join(', ')}`,
        });
    }
    return checks;
}

export function runDoctor(outputDir: string, runtime: DoctorRuntime): DoctorCheck[] {
    const nodeMajor = Number(runtime.nodeVersion.replace(/^v/, '').split('.')[0]);
    const requiredOutputs = [
        path.join(runtime.packageRoot, 'dist', 'reporter.js'),
        path.join(runtime.packageRoot, 'dist', 'cli.js'),
        path.join(runtime.packageRoot, 'dist', 'templates', 'test-health-report.html'),
        path.join(runtime.packageRoot, 'dist', 'templates', 'test-health-report.css'),
        path.join(runtime.packageRoot, 'dist', 'templates', 'test-health-report.js'),
    ];
    const checks: DoctorCheck[] = [
        {
            name: 'Node.js',
            ok: Number.isFinite(nodeMajor) && nodeMajor >= 22,
            detail: `${runtime.nodeVersion} (requires >=22)`,
        },
        {
            name: 'Reporter package',
            ok: requiredOutputs.every((file) => fs.existsSync(file)),
            detail: requiredOutputs.every((file) => fs.existsSync(file))
                ? 'compiled outputs and report templates are present'
                : 'compiled outputs or report templates are missing; run npm run build',
        },
    ];

    try {
        const playwright = runtime.playwright();
        checks.push({name: 'Playwright package', ok: true, detail: playwright.packagePath});
        checks.push({
            name: 'Chromium browser',
            ok: fs.existsSync(playwright.browserPath),
            detail: fs.existsSync(playwright.browserPath)
                ? playwright.browserPath
                : 'browser executable is missing; run npx playwright install chromium',
        });
    } catch (error) {
        checks.push({
            name: 'Playwright package',
            ok: false,
            detail: error instanceof Error ? error.message : String(error),
        });
    }

    const writableParent = nearestExistingDirectory(path.resolve(runtime.cwd, outputDir));
    try {
        fs.accessSync(writableParent, fs.constants.W_OK);
        checks.push({name: 'Report output', ok: true, detail: `${writableParent} is writable`});
    } catch {
        checks.push({name: 'Report output', ok: false, detail: `${writableParent} is not writable`});
    }

    return [...checks, ...providerChecks(runtime.env)];
}

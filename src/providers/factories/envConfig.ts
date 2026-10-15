/**
 * Builds bug tracker and PR provider configuration from environment variables.
 *
 * The provider registry only reads the provider type from the environment (BUG_TRACKER_PROVIDER,
 * PR_PROVIDER), so a provider created without an explicit config object used to crash on its first
 * property access. These functions supply the documented variables and fail with a message that
 * names every missing variable.
 */

type Env = NodeJS.ProcessEnv;

const first = (env: Env, ...names: string[]): string | undefined =>
    names.map((name) => env[name]).find((value) => value !== undefined && value !== '');

function requireAll(label: string, values: Record<string, string | undefined>): Record<string, string> {
    const missing = Object.entries(values)
        .filter(([, value]) => !value)
        .map(([name]) => name);

    if (missing.length > 0) {
        throw new Error(`${label} is not configured. Set these environment variables: ${missing.join(', ')}`);
    }

    return values as Record<string, string>;
}

export interface GitHubEnvConfig {
    owner: string;
    repo: string;
    token: string;
}

/** GITHUB_TOKEN (or GH_TOKEN), plus GITHUB_OWNER and GITHUB_REPO, or GITHUB_REPOSITORY (owner/repo) as set by GitHub Actions. */
export function githubConfigFromEnv(env: Env = process.env): GitHubEnvConfig {
    const [slugOwner, slugRepo] = (env.GITHUB_REPOSITORY ?? '').split('/');

    const values = requireAll('GitHub', {
        GITHUB_TOKEN: first(env, 'GITHUB_TOKEN', 'GH_TOKEN'),
        GITHUB_OWNER: first(env, 'GITHUB_OWNER') ?? slugOwner,
        GITHUB_REPO: first(env, 'GITHUB_REPO') ?? slugRepo,
    });

    return {token: values.GITHUB_TOKEN, owner: values.GITHUB_OWNER, repo: values.GITHUB_REPO};
}

export interface AzureDevOpsBugEnvConfig {
    organizationUrl: string;
    project: string;
    personalAccessToken: string;
    areaPath?: string;
    iterationPath?: string;
    tags?: string[];
}

export function azureDevOpsBugConfigFromEnv(env: Env = process.env): AzureDevOpsBugEnvConfig {
    const values = requireAll('Azure DevOps', {
        AZURE_DEVOPS_ORG_URL: first(env, 'AZURE_DEVOPS_ORG_URL'),
        AZURE_DEVOPS_PROJECT: first(env, 'AZURE_DEVOPS_PROJECT'),
        AZURE_DEVOPS_PAT: first(env, 'AZURE_DEVOPS_PAT'),
    });
    const tags = first(env, 'AZURE_DEVOPS_TAGS')
        ?.split(',')
        .map((tag) => tag.trim())
        .filter(Boolean);

    return {
        organizationUrl: values.AZURE_DEVOPS_ORG_URL,
        project: values.AZURE_DEVOPS_PROJECT,
        personalAccessToken: values.AZURE_DEVOPS_PAT,
        ...(first(env, 'AZURE_DEVOPS_AREA_PATH') ? {areaPath: first(env, 'AZURE_DEVOPS_AREA_PATH')} : {}),
        ...(first(env, 'AZURE_DEVOPS_ITERATION_PATH')
            ? {iterationPath: first(env, 'AZURE_DEVOPS_ITERATION_PATH')}
            : {}),
        ...(tags && tags.length > 0 ? {tags} : {}),
    };
}

export interface AzureDevOpsPREnvConfig {
    organizationUrl: string;
    project: string;
    repositoryId: string;
    personalAccessToken: string;
}

export function azureDevOpsPRConfigFromEnv(env: Env = process.env): AzureDevOpsPREnvConfig {
    const values = requireAll('Azure DevOps pull requests', {
        AZURE_DEVOPS_ORG_URL: first(env, 'AZURE_DEVOPS_ORG_URL'),
        AZURE_DEVOPS_PROJECT: first(env, 'AZURE_DEVOPS_PROJECT'),
        AZURE_DEVOPS_PAT: first(env, 'AZURE_DEVOPS_PAT'),
        AZURE_DEVOPS_REPO: first(env, 'AZURE_DEVOPS_REPO', 'AZURE_DEVOPS_REPOSITORY_ID'),
    });

    return {
        organizationUrl: values.AZURE_DEVOPS_ORG_URL,
        project: values.AZURE_DEVOPS_PROJECT,
        repositoryId: values.AZURE_DEVOPS_REPO,
        personalAccessToken: values.AZURE_DEVOPS_PAT,
    };
}

export interface JiraEnvConfig {
    host: string;
    email: string;
    apiToken: string;
    projectKey: string;
    issueType?: string;
}

export function jiraConfigFromEnv(env: Env = process.env): JiraEnvConfig {
    const values = requireAll('Jira', {
        JIRA_HOST: first(env, 'JIRA_HOST'),
        JIRA_EMAIL: first(env, 'JIRA_EMAIL'),
        JIRA_API_TOKEN: first(env, 'JIRA_API_TOKEN'),
        JIRA_PROJECT_KEY: first(env, 'JIRA_PROJECT_KEY'),
    });

    return {
        host: values.JIRA_HOST,
        email: values.JIRA_EMAIL,
        apiToken: values.JIRA_API_TOKEN,
        projectKey: values.JIRA_PROJECT_KEY,
        ...(first(env, 'JIRA_ISSUE_TYPE') ? {issueType: first(env, 'JIRA_ISSUE_TYPE')} : {}),
    };
}

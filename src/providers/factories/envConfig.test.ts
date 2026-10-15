import assert from 'node:assert/strict';
import {afterEach, test} from 'node:test';
import {GitHubBugTracker} from '../bugTrackers/GitHubBugTracker';
import {GitHubPRProvider} from '../pr/GitHubPRProvider';
import {ProviderRegistry} from '../ProviderRegistry';
import {BugTrackerFactory} from './BugTrackerFactory';
import {
    azureDevOpsBugConfigFromEnv,
    azureDevOpsPRConfigFromEnv,
    githubConfigFromEnv,
    jiraConfigFromEnv,
} from './envConfig';
import {PRProviderFactory} from './PRProviderFactory';

const saved = {...process.env};

afterEach(() => {
    process.env = {...saved};
    ProviderRegistry.reset();
});

test('github config comes from GITHUB_TOKEN, GITHUB_OWNER and GITHUB_REPO', () => {
    assert.deepEqual(githubConfigFromEnv({GITHUB_TOKEN: 't', GITHUB_OWNER: 'o', GITHUB_REPO: 'r'}), {
        token: 't',
        owner: 'o',
        repo: 'r',
    });
});

test('github config falls back to GH_TOKEN and GITHUB_REPOSITORY as set by GitHub Actions', () => {
    assert.deepEqual(githubConfigFromEnv({GH_TOKEN: 't', GITHUB_REPOSITORY: 'octo/widgets'}), {
        token: 't',
        owner: 'octo',
        repo: 'widgets',
    });
});

test('explicit owner and repo win over GITHUB_REPOSITORY', () => {
    const config = githubConfigFromEnv({
        GITHUB_TOKEN: 't',
        GITHUB_OWNER: 'me',
        GITHUB_REPO: 'mine',
        GITHUB_REPOSITORY: 'octo/widgets',
    });

    assert.equal(config.owner, 'me');
    assert.equal(config.repo, 'mine');
});

test('missing github variables are all named in one error', () => {
    assert.throws(
        () => githubConfigFromEnv({}),
        /GitHub is not configured[\s\S]*GITHUB_TOKEN[\s\S]*GITHUB_OWNER[\s\S]*GITHUB_REPO/,
    );
});

test('empty strings count as missing', () => {
    assert.throws(() => githubConfigFromEnv({GITHUB_TOKEN: '', GITHUB_OWNER: 'o', GITHUB_REPO: 'r'}), /GITHUB_TOKEN/);
});

test('azure devops bug config reads optional paths and tags', () => {
    const config = azureDevOpsBugConfigFromEnv({
        AZURE_DEVOPS_ORG_URL: 'https://dev.azure.com/o',
        AZURE_DEVOPS_PROJECT: 'p',
        AZURE_DEVOPS_PAT: 'pat',
        AZURE_DEVOPS_AREA_PATH: 'p\\QA',
        AZURE_DEVOPS_TAGS: 'a, b ,',
    });

    assert.equal(config.areaPath, 'p\\QA');
    assert.deepEqual(config.tags, ['a', 'b']);
    assert.equal('iterationPath' in config, false);
});

test('azure devops pull requests need a repository', () => {
    assert.throws(
        () =>
            azureDevOpsPRConfigFromEnv({
                AZURE_DEVOPS_ORG_URL: 'u',
                AZURE_DEVOPS_PROJECT: 'p',
                AZURE_DEVOPS_PAT: 'pat',
            }),
        /AZURE_DEVOPS_REPO/,
    );
});

test('jira config reads the optional issue type', () => {
    const config = jiraConfigFromEnv({
        JIRA_HOST: 'h',
        JIRA_EMAIL: 'e',
        JIRA_API_TOKEN: 't',
        JIRA_PROJECT_KEY: 'QA',
        JIRA_ISSUE_TYPE: 'Task',
    });

    assert.equal(config.issueType, 'Task');
});

test('the bug tracker factory creates a GitHub tracker from the environment alone', async () => {
    Object.assign(process.env, {GITHUB_TOKEN: 't', GITHUB_OWNER: 'o', GITHUB_REPO: 'r'});

    const provider = await BugTrackerFactory.createProvider('github');

    assert.ok(provider instanceof GitHubBugTracker);
});

test('the PR factory creates a GitHub provider from the environment alone', async () => {
    Object.assign(process.env, {GITHUB_TOKEN: 't', GITHUB_OWNER: 'o', GITHUB_REPO: 'r'});

    assert.ok((await PRProviderFactory.createProvider('github')) instanceof GitHubPRProvider);
});

test('the registry works when only BUG_TRACKER_PROVIDER is set, as in the documented setup', async () => {
    Object.assign(process.env, {
        BUG_TRACKER_PROVIDER: 'github',
        GITHUB_TOKEN: 't',
        GITHUB_OWNER: 'o',
        GITHUB_REPO: 'r',
    });

    assert.ok((await ProviderRegistry.getBugTrackerProvider()) instanceof GitHubBugTracker);
});

test('the registry reports which variables are missing instead of crashing on undefined', async () => {
    process.env.BUG_TRACKER_PROVIDER = 'github';
    delete process.env.GITHUB_TOKEN;
    delete process.env.GH_TOKEN;
    delete process.env.GITHUB_OWNER;
    delete process.env.GITHUB_REPO;
    delete process.env.GITHUB_REPOSITORY;

    await assert.rejects(() => ProviderRegistry.getBugTrackerProvider(), /GitHub is not configured.*GITHUB_TOKEN/);
});

test('an explicit config object still takes precedence over the environment', async () => {
    Object.assign(process.env, {GITHUB_TOKEN: 'env', GITHUB_OWNER: 'env', GITHUB_REPO: 'env'});

    const provider = (await BugTrackerFactory.createProvider('github', {
        token: 'explicit',
        owner: 'explicit',
        repo: 'explicit',
    })) as unknown as {config: {owner: string}};

    assert.equal(provider.config.owner, 'explicit');
});

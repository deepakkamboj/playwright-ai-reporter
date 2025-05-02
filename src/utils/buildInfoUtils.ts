import {BuildInfo} from '../types';

/**
 * Utility for gathering information about the build environment
 */
export class BuildInfoUtils {
    /**
     * Determines if the current run is in a CI environment
     * @returns True if running in CI, false otherwise
     */
    static isRunningInPipeline(): boolean {
        return (
            !!process.env.CI ||
            !!process.env.TF_BUILD ||
            !!process.env.GITHUB_ACTIONS ||
            !!process.env.GITLAB_CI ||
            !!process.env.JENKINS_URL
        );
    }

    /**
     * Gets the CI system name
     * @returns Name of the CI system or 'Unknown' if not determined
     */
    static getPipelineSystem(): string {
        if (process.env.TF_BUILD) return 'Azure Pipelines';
        if (process.env.GITHUB_ACTIONS) return 'GitHub Actions';
        if (process.env.GITLAB_CI) return 'GitLab CI';
        if (process.env.JENKINS_URL) return 'Jenkins';
        if (process.env.CI) return 'Generic CI';
        return 'Unknown';
    }

    /**
     * Gets the build link based on CI system
     * @returns Build link or empty string if not available
     */
    static getBuildLink(): string {
        // Azure DevOps build link
        if (process.env.TF_BUILD) {
            const projectCollectionUri = process.env.SYSTEM_TEAMFOUNDATIONCOLLECTIONURI;
            const projectId = process.env.SYSTEM_TEAMPROJECTID;
            const buildId = process.env.BUILD_BUILDID;

            if (projectCollectionUri && projectId && buildId) {
                return `${projectCollectionUri}${projectId}/_build/results?buildId=${buildId}`;
            }
        }

        // GitHub Actions build link
        if (process.env.GITHUB_ACTIONS) {
            const serverUrl = process.env.GITHUB_SERVER_URL;
            const repo = process.env.GITHUB_REPOSITORY;
            const runId = process.env.GITHUB_RUN_ID;

            if (serverUrl && repo && runId) {
                return `${serverUrl}/${repo}/actions/runs/${runId}`;
            }
        }

        // No supported CI system found
        return '';
    }

    /**
     * Gets all relevant build information from environment variables
     * @returns BuildInfo object with all available information
     */
    static getBuildInfo(): BuildInfo {
        const isPipeline = this.isRunningInPipeline();

        if (!isPipeline) {
            return {
                isPipeline,
                executionSystem: 'Local',
            };
        }

        const executionSystem = this.getPipelineSystem();
        const buildLink = this.getBuildLink();

        const buildInfo: BuildInfo = {
            isPipeline: true,
            executionSystem,
            buildLink,
        };

        // Add fields based on the CI system
        if (executionSystem === 'Azure Pipelines') {
            buildInfo.buildId = process.env.BUILD_BUILDID || '';
            buildInfo.buildNumber = process.env.BUILD_BUILDNUMBER || '';
            buildInfo.buildBranch = process.env.BUILD_SOURCEBRANCHNAME || '';
            buildInfo.buildRepository = process.env.BUILD_REPOSITORY_NAME || '';
            buildInfo.commitId = process.env.BUILD_SOURCEVERSION || '';

            // Add Azure-specific links
            if (buildLink) {
                buildInfo.artifactsLink = `${buildLink}&view=artifacts&pathAsName=false&type=publishedArtifacts`;
                buildInfo.testLink = `${buildLink}&view=ms.vss-test-web.build-test-results-tab`;
            }
        } else if (executionSystem === 'GitHub Actions') {
            buildInfo.buildId = process.env.GITHUB_RUN_ID || '';
            buildInfo.buildNumber = process.env.GITHUB_RUN_NUMBER || '';
            buildInfo.buildBranch = process.env.GITHUB_REF_NAME || '';
            buildInfo.buildRepository = process.env.GITHUB_REPOSITORY || '';
            buildInfo.commitId = process.env.GITHUB_SHA || '';

            // Add GitHub-specific links
            if (process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY) {
                const serverUrl = process.env.GITHUB_SERVER_URL;
                const repo = process.env.GITHUB_REPOSITORY;

                // Add artifact link (using GitHub's download artifacts URL pattern)
                if (buildInfo.buildId) {
                    buildInfo.artifactsLink = `${serverUrl}/${repo}/actions/runs/${buildInfo.buildId}/artifacts`;
                }

                // Add link to the commit
                if (buildInfo.commitId) {
                    buildInfo.commitLink = `${serverUrl}/${repo}/commit/${buildInfo.commitId}`;
                }
            }
        }
        // Add other CI systems as needed
        else {
            // Generic CI system - try to get common environment variables
            buildInfo.buildId = process.env.BUILD_ID || process.env.CI_BUILD_ID || '';
            buildInfo.buildNumber = process.env.BUILD_NUMBER || process.env.CI_BUILD_NUMBER || '';
            buildInfo.buildBranch = process.env.BRANCH_NAME || process.env.CI_BRANCH || '';
            buildInfo.commitId = process.env.GIT_COMMIT || process.env.CI_COMMIT_SHA || '';
        }

        return buildInfo;
    }
}

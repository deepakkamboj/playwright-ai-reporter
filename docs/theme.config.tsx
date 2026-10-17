import React from 'react';
import {useConfig, type DocsThemeConfig} from 'nextra-theme-docs';
import reporterMark from '../src/assets/playwright-ai-reporter-mark.svg';

const config: DocsThemeConfig = {
    logo: (
        <span style={{display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 750}} translate="no">
            <img src={reporterMark.src} alt="" aria-hidden="true" width="32" height="32" />
            <span>
                Playwright <span className="brand-accent">AI Reporter</span>
            </span>
        </span>
    ),
    project: {
        link: 'https://github.com/deepakkamboj/playwright-ai-reporter',
    },
    docsRepositoryBase: 'https://github.com/deepakkamboj/playwright-ai-reporter/tree/main/docs',
    footer: {
        content: (
            <span>
                <span className="footer-motto">Evidence first. Investigate, then act.</span>
                <span>
                    © {new Date().getFullYear()} Deepak Kamboj · MIT ·{' '}
                    <a href="https://github.com/deepakkamboj/playwright-ai-reporter">GitHub</a>
                </span>
            </span>
        ),
    },
    head: function useHead() {
        const {title} = useConfig();
        const pageTitle = title === 'Playwright AI Reporter' ? title : `${title} | Playwright AI Reporter`;
        return (
            <>
                <title>{pageTitle}</title>
                <meta property="og:title" content={pageTitle} />
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <meta name="theme-color" content="#334155" />
                <link rel="icon" href={reporterMark.src} type="image/svg+xml" />
                <meta
                    name="description"
                    content="Turn Playwright results into evidence-led Test Health Reports, API diagnostics, and optional AI-powered failure analysis."
                />
            </>
        );
    },
    color: {hue: 215, saturation: 25},
    darkMode: true,
    nextThemes: {defaultTheme: 'light'},
};

export default config;

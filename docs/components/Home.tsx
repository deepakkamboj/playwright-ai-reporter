import React from 'react';
import Link from 'next/link';
import {Cards, Card} from './Cards';
import {PackageInstall} from './PackageInstall';
import {ReportFlow} from './ReportFlow';
import {asset} from './base';
import reporterLogo from '../../src/assets/playwright-ai-reporter-logo.svg';
import {
    BookIcon,
    CheckIcon,
    CrossIcon,
    EyeIcon,
    GearIcon,
    LayersIcon,
    LoopIcon,
    PauseIcon,
    RocketIcon,
    ShieldIcon,
    TerminalIcon,
    WrenchIcon,
} from './icons';

function SectionHeading({
    icon,
    title,
    subtitle,
    info,
}: {
    icon: React.ReactNode;
    title: string;
    subtitle: string;
    info: string;
}) {
    return (
        <header className="section-heading">
            <span className="section-icon">{icon}</span>
            <div>
                <h2>{title}</h2>
                <p>{subtitle}</p>
            </div>
            <details className="section-info">
                <summary aria-label={`About ${title}`}>i</summary>
                <p>{info}</p>
            </details>
        </header>
    );
}

const outcomes = [
    {label: 'Total tests', count: 10, icon: <LayersIcon />, tone: 'total'},
    {label: 'Passed', count: 6, icon: <CheckIcon />, tone: 'pass'},
    {label: 'Failed', count: 2, icon: <CrossIcon />, tone: 'fail'},
    {label: 'Flaky', count: 1, icon: <LoopIcon />, tone: 'flaky'},
    {label: 'Skipped', count: 1, icon: <PauseIcon />, tone: 'skip'},
];

export default function Home() {
    return (
        <div className="reporter-home">
            <section className="reporter-hero">
                <img
                    className="product-logo"
                    src={reporterLogo.src}
                    alt="Playwright AI Reporter — Evidence to action"
                    width={960}
                    height={340}
                />
                <p className="eyebrow">Test intelligence, without replacing your tests</p>
                <h1>From a failed test to a clear next step.</h1>
                <p className="hero-lead">
                    Bring outcomes, retries, API calls, and failure evidence into one Test Health Report. Add AI
                    analysis and connected workflows when your team is ready.
                </p>
                <ul className="capability-chips" aria-label="Product capabilities">
                    <li>Standalone HTML</li>
                    <li>Optional AI</li>
                    <li>Local or CI</li>
                    <li>Playwright 1.64</li>
                    <li>MIT licensed</li>
                </ul>
                <div className="action-row">
                    <Link className="reporter-button primary" href="/getting-started">
                        Get started
                    </Link>
                    <a className="reporter-button" href={asset('/test-health-report-sample.html')}>
                        Explore sample report
                    </a>
                </div>
                <ReportFlow />
            </section>

            <PackageInstall packages={['playwright-ai-reporter']} dev />

            <section className="product-section">
                <SectionHeading
                    icon={<EyeIcon />}
                    title="Your test health, at a glance"
                    subtitle="Icon-led outcome tiles, shared evidence, and a focused investigation workspace."
                    info="These tiles use the same illustrative run as the sample report. They are demo data, not live project metrics."
                />
                <p className="demo-label">Illustrative run · Demo data</p>
                <div className="outcome-grid">
                    {outcomes.map(({label, count, icon, tone}) => (
                        <article className={`outcome-tile tone-${tone}`} key={label}>
                            <span className="outcome-icon">{icon}</span>
                            <span className="outcome-count">{count}</span>
                            <h3>{label}</h3>
                        </article>
                    ))}
                </div>
                <div className="feature-grid">
                    <article>
                        <span className="feature-icon">
                            <LayersIcon />
                        </span>
                        <h3>Evidence in one place</h3>
                        <p>Move from a test result to retries, metadata, captured API traffic, and linked artifacts.</p>
                    </article>
                    <article>
                        <span className="feature-icon">
                            <WrenchIcon />
                        </span>
                        <h3>AI fixes, separately</h3>
                        <p>
                            Review saved analysis in a dedicated tab. Reading a report never applies a fix or calls a
                            model.
                        </p>
                    </article>
                    <article>
                        <span className="feature-icon">
                            <GearIcon />
                        </span>
                        <h3>Settings you can inspect</h3>
                        <p>
                            See recorded thresholds, feature flags, workers, and project settings without exposing
                            credentials.
                        </p>
                    </article>
                </div>
            </section>

            <section className="product-section">
                <SectionHeading
                    icon={<BookIcon />}
                    title="Find your starting point"
                    subtitle="Practical guides for your first run, your existing suite, and your CI pipeline."
                    info="Reporting works without AI credentials. Enable integrations only after configuring their provider and permissions."
                />
                <Cards cols={2}>
                    <Card icon={<ShieldIcon />} title="Detailed features" href="/features">
                        Explore the README capabilities, integrations, and current limitations.
                    </Card>
                    <Card icon={<BookIcon />} title="Usage guide" href="/usage">
                        Add metadata, capture API evidence, and inspect your first investigation.
                    </Card>
                    <Card icon={<RocketIcon />} title="Getting started" href="/getting-started">
                        Install, configure, and generate your first report.
                    </Card>
                    <Card icon={<GearIcon />} title="Configuration" href="/configuration">
                        Choose thresholds, history storage, and opt-in workflows.
                    </Card>
                    <Card icon={<EyeIcon />} title="Test Health Report" href="/reporting">
                        Understand the report tabs, themes, API results, and settings.
                    </Card>
                    <Card icon={<WrenchIcon />} title="Providers & integrations" href="/integrations">
                        Connect AI, issue trackers, pull requests, databases, and email.
                    </Card>
                    <Card icon={<TerminalIcon />} title="API & metadata" href="/api-reference">
                        Record browser and request-context calls; attach ownership and priority.
                    </Card>
                    <Card icon={<LayersIcon />} title="CI/CD & shard merging" href="/deployment">
                        Publish evidence, preserve history, and combine parallel runs.
                    </Card>
                    <Card icon={<LayersIcon />} title="Architecture & diagrams" href="/architecture">
                        Trace components, provider contracts, run lifecycle, and shard artifacts.
                    </Card>
                    <Card icon={<WrenchIcon />} title="Troubleshooting" href="/troubleshooting">
                        Diagnose missing evidence, provider setup, history, and publishing problems.
                    </Card>
                </Cards>
            </section>

            <section className="product-section">
                <SectionHeading
                    icon={<ShieldIcon />}
                    title="Start local. Connect deliberately."
                    subtitle="Use the reporter you need now, without enabling every integration."
                    info="AI prompts and connected workflows may send test details or source to your configured provider. Review data and permissions before enabling them."
                />
                <div className="feature-grid">
                    <article>
                        <h3>Reporting first</h3>
                        <p>No AI account or database is needed for console output and the standalone HTML report.</p>
                    </article>
                    <article>
                        <h3>Provider choice</h3>
                        <p>
                            Choose from six AI providers, three issue trackers, and GitHub or Azure DevOps pull
                            requests.
                        </p>
                    </article>
                    <article>
                        <h3>Review before action</h3>
                        <p>
                            Treat generated suggestions as proposals. Keep branch protections and human review in your
                            workflow.
                        </p>
                    </article>
                </div>
            </section>

            <section className="closing-panel">
                <h2>Evidence first. Investigate, then act.</h2>
                <p>Keep your Playwright tests. Give the results a clearer story.</p>
                <div className="action-row">
                    <Link className="reporter-button primary" href="/getting-started">
                        Create your first report
                    </Link>
                    <a className="reporter-button" href="https://github.com/deepakkamboj/playwright-ai-reporter">
                        View the source
                    </a>
                </div>
            </section>
        </div>
    );
}

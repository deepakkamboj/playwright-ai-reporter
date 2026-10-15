// src/utils/reportGenerator.ts
import * as fs from 'fs';
import * as path from 'path';

export function assertStandaloneReport(html: string): void {
    if (!html.includes('window.EMBEDDED_TEST_SUMMARY') || !html.includes('window.EMBEDDED_TEST_FAILURES')) {
        throw new Error('Standalone report does not contain embedded test data');
    }
    if (!/<style(?:\s|>)/i.test(html)) {
        throw new Error('Standalone report does not contain embedded CSS');
    }
    const inlineScripts = html.match(/<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/gi) ?? [];
    if (inlineScripts.length < 2) {
        throw new Error('Standalone report does not contain embedded JavaScript');
    }
    if (/<link\b[^>]*\bhref=["'][^"']+\.css(?:[?#][^"']*)?["'][^>]*>/i.test(html)) {
        throw new Error('Standalone report still references an external stylesheet');
    }
    if (/<script\b[^>]*\bsrc=/i.test(html)) {
        throw new Error('Standalone report still references external JavaScript');
    }
}

/**
 * Report Generator for creating self-contained HTML test health reports.
 *
 * This utility reads test results JSON files and embeds them directly
 * into the HTML report, creating a self-contained file that can be opened
 * directly in a browser without needing a server.
 */
export class ReportGenerator {
    private readonly outputDir: string;
    private readonly reportFileName: string;

    /**
     * Creates a new ReportGenerator instance
     * @param outputDir - Directory where the report will be generated
     * @param reportFileName - Name of the generated report file (default: 'test-health-report.html')
     */
    constructor(outputDir: string, reportFileName: string = 'test-health-report.html') {
        this.outputDir = outputDir;
        this.reportFileName = reportFileName;
    }

    /**
     * Generates a self-contained HTML report from test results
     * @returns The absolute path to the generated report file
     */
    public generateReport(): string {
        console.log('\n📊 Generating self-contained test health report...');

        // Get paths to template files (bundled with the package)
        // Templates are copied to dist/templates during build
        const templateDir = path.resolve(__dirname, '..', 'templates');
        const htmlTemplatePath = path.join(templateDir, 'test-health-report.html');
        const cssPath = path.join(templateDir, 'test-health-report.css');
        const jsPath = path.join(templateDir, 'test-health-report.js');

        // Verify template directory exists
        if (!fs.existsSync(templateDir)) {
            console.error(`  ✗ Template directory not found: ${templateDir}`);
            console.error('  Make sure the package was built correctly with: npm run build');
            throw new Error(`Template directory not found: ${templateDir}`);
        }

        // Paths to test data files
        const summaryPath = path.join(this.outputDir, 'testSummary.json');
        const failuresPath = path.join(this.outputDir, 'testFailures.json');

        // Read test data
        let testSummary = null;
        let testFailures = null;

        if (fs.existsSync(summaryPath)) {
            try {
                testSummary = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'));
                const testCount = testSummary?.allTestCases?.length || testSummary?.testCount || 0;
                console.log(`  ✓ Loaded testSummary.json (${testCount} tests)`);
            } catch (error) {
                console.warn(`  ⚠ Failed to parse testSummary.json: ${error}`);
            }
        } else {
            console.warn('  ⚠ testSummary.json not found, the report will be empty');
        }

        if (fs.existsSync(failuresPath)) {
            try {
                testFailures = JSON.parse(fs.readFileSync(failuresPath, 'utf-8'));
                const failureCount = Array.isArray(testFailures)
                    ? testFailures.length
                    : testFailures?.failures?.length || 0;
                console.log(`  ✓ Loaded testFailures.json (${failureCount} failures)`);
            } catch (error) {
                console.warn(`  ⚠ Failed to parse testFailures.json: ${error}`);
            }
        } else {
            console.warn('  ⚠ testFailures.json not found, the report will list no failure details');
        }

        // Read HTML template
        if (!fs.existsSync(htmlTemplatePath)) {
            console.error(`  ✗ HTML template not found: ${htmlTemplatePath}`);
            throw new Error(`HTML template not found: ${htmlTemplatePath}`);
        }
        let html = fs.readFileSync(htmlTemplatePath, 'utf-8');
        console.log('  ✓ Loaded HTML template');

        // Read CSS
        let css = '';
        if (fs.existsSync(cssPath)) {
            css = fs.readFileSync(cssPath, 'utf-8');
            console.log('  ✓ Loaded CSS');
        } else {
            console.warn('  ⚠ CSS file not found');
        }

        // Read JS
        let js = '';
        if (fs.existsSync(jsPath)) {
            js = fs.readFileSync(jsPath, 'utf-8');
            console.log('  ✓ Loaded JavaScript');
        } else {
            console.warn('  ⚠ JavaScript file not found');
        }

        // Make the report one file: small screenshots travel inside it, so it still shows them when
        // it is uploaded or mailed on its own
        const inlined = ReportGenerator.inlineScreenshots(this.outputDir, testSummary, testFailures);
        if (inlined > 0) console.log(`  ✓ Embedded ${inlined} screenshot(s)`);

        // Create embedded data script
        const embeddedDataScript = `
<script>
// Embedded test data - generated by PlaywrightTestReporter
window.EMBEDDED_TEST_SUMMARY = ${ReportGenerator.toScriptJson(testSummary)};
window.EMBEDDED_TEST_FAILURES = ${ReportGenerator.toScriptJson(testFailures)};
</script>`;

        // Create inline CSS
        const inlineCSS = css
            ? `
<style>
${css}
</style>`
            : '';

        // Create inline JS
        const inlineJS = js
            ? `
<script>
${js}
</script>`
            : '';

        // Replacer functions keep "$&" and "$'" in the inlined code from being read as replacement patterns
        html = html.replace(/<link[^>]*href=["']test-health-report\.css["'][^>]*>/gi, () => inlineCSS);

        // Replace external JS script with inline JS (add embedded data before it)
        html = html.replace(
            /<script[^>]*src=["']test-health-report\.js["'][^>]*><\/script>/gi,
            () => embeddedDataScript + inlineJS
        );

        // If the replacements didn't work, insert before </head> and </body>
        if (!html.includes('EMBEDDED_TEST_SUMMARY')) {
            html = html.replace('</head>', () => `${inlineCSS}\n${embeddedDataScript}\n</head>`);
            html = html.replace('</body>', () => `${inlineJS}\n</body>`);
        }

        // Add generation timestamp
        const timestamp = new Date().toISOString();
        html = html.replace('</head>', () => `<meta name="generated" content="${timestamp}">\n</head>`);

        assertStandaloneReport(html);
        console.log('  ✓ Verified embedded data, CSS and JavaScript');

        // Ensure output directory exists
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, {recursive: true});
        }

        // Write output file
        const outputPath = path.join(this.outputDir, this.reportFileName);
        fs.writeFileSync(outputPath, html, 'utf-8');

        const absoluteOutputPath = path.resolve(outputPath);
        console.log(`  ✓ Generated standalone report: ${absoluteOutputPath}`);

        return absoluteOutputPath;
    }

    /** JSON that is safe inside a script element: "<" is escaped so "</script>" in an error cannot end it. */
    private static toScriptJson(value: unknown): string {
        return value ? JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028|\u2029/g, '') : 'null';
    }

    /**
     * Adds the content of small screenshots to their artifact link as `inline` (a data URI).
     * Screenshots over the per-file limit, or past the total limit, stay plain links.
     * @returns the number of screenshots embedded
     */
    private static inlineScreenshots(reportDir: string, ...sources: unknown[]): number {
        const MAX_FILE_BYTES = 600 * 1024;
        const MAX_TOTAL_BYTES = 8 * 1024 * 1024;
        const cache = new Map<string, string | undefined>();
        let total = 0;

        const links: Array<{href?: string; inline?: string}> = [];
        const collect = (item: unknown): void => {
            const link = (item as {artifacts?: {screenshot?: {href?: string}}} | undefined)?.artifacts?.screenshot;
            if (link?.href) links.push(link);
        };
        for (const source of sources as Array<{allTestCases?: unknown[]; failures?: unknown[]} | unknown[] | null>) {
            if (Array.isArray(source)) source.forEach(collect);
            else {
                source?.allTestCases?.forEach(collect);
                source?.failures?.forEach(collect);
            }
        }

        for (const link of links) {
            const href = link.href as string;
            if (!cache.has(href)) {
                let uri: string | undefined;
                try {
                    const file = path.resolve(reportDir, href);
                    const size = fs.statSync(file).size;
                    if (size <= MAX_FILE_BYTES && total + size <= MAX_TOTAL_BYTES && /\.(png|jpe?g)$/i.test(file)) {
                        const type = /\.png$/i.test(file) ? 'image/png' : 'image/jpeg';
                        uri = `data:${type};base64,${fs.readFileSync(file).toString('base64')}`;
                        total += size;
                    }
                } catch {
                    // The file is gone: keep the plain link
                }
                cache.set(href, uri);
            }
            const uri = cache.get(href);
            if (uri) link.inline = uri;
        }

        return [...cache.values()].filter(Boolean).length;
    }

    /**
     * Prints the report link to console
     * @param reportPath - The path to the generated report
     */
    public static printReportLink(reportPath: string): void {
        const fileUrl = `file:///${reportPath.replace(/\\/g, '/')}`;

        console.log('\n');
        console.log('╔══════════════════════════════════════════════════════════════╗');
        console.log('║                    📊 Test Health Report                     ║');
        console.log('╠══════════════════════════════════════════════════════════════╣');
        console.log(`║  Open in browser: ${fileUrl}`);
        console.log('║                                                              ║');
        console.log('║  Or run: npx playwright show-report (if using Playwright)   ║');
        console.log('╚══════════════════════════════════════════════════════════════╝');
        console.log('\n');
    }
}

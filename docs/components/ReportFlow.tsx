import React, {useState} from 'react';

const stages = [
    {
        label: 'Capture evidence',
        detail: 'Playwright results, retries, attachments, metadata, and recorded API calls build the investigation record.',
    },
    {
        label: 'Investigate failures',
        detail: 'Compare error signatures, flaky behavior, timings, and optional saved AI analysis in the Test Health Report.',
    },
    {
        label: 'Choose the next action',
        detail: 'Review the evidence. Enable configured issue, pull-request, database, or email workflows only when appropriate.',
    },
] as const;

export function ReportFlow() {
    const [active, setActive] = useState(0);
    const selected = stages[active];

    return (
        <div className="report-flow">
            <div className="report-flow-buttons" role="group" aria-label="Reporter workflow">
                {stages.map((stage, index) => (
                    <React.Fragment key={stage.label}>
                        <button type="button" aria-pressed={active === index} onClick={() => setActive(index)}>
                            <span>{stage.label}</span>
                        </button>
                    </React.Fragment>
                ))}
            </div>
            <p aria-live="polite">
                <strong>{selected.label}:</strong> {selected.detail}
            </p>
        </div>
    );
}

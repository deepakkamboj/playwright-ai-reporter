import React, {useState} from 'react';

type PackageManager = 'npm' | 'pnpm' | 'yarn';

export function PackageInstall({packages, dev = false}: {packages: string[]; dev?: boolean}) {
    const [active, setActive] = useState<PackageManager>('npm');
    const [message, setMessage] = useState('');
    const install = active === 'npm' ? 'npm install' : `${active} add`;
    const flag = dev ? (active === 'yarn' ? ' --dev' : ' --save-dev') : '';
    const command = `${install}${flag} ${packages.join(' ')}`;

    async function copy() {
        try {
            if (!navigator.clipboard) throw new Error('Clipboard is unavailable');
            await navigator.clipboard.writeText(command);
            setMessage('Installation command copied.');
        } catch (error) {
            setMessage(
                `Copy failed: ${error instanceof Error ? error.message : String(error)}. Select the command below to copy it manually.`,
            );
        }
    }

    return (
        <div className="install-command">
            <div className="install-toolbar" role="group" aria-label="Installation command">
                {(['npm', 'pnpm', 'yarn'] as const).map((manager) => (
                    <button
                        type="button"
                        key={manager}
                        aria-pressed={active === manager}
                        onClick={() => {
                            setActive(manager);
                            setMessage('');
                        }}
                    >
                        {manager}
                    </button>
                ))}
                <button
                    className="copy-command"
                    type="button"
                    onClick={() => void copy()}
                    aria-label="Copy installation command"
                >
                    Copy
                </button>
            </div>
            <pre tabIndex={0} aria-label="Installation command">
                <code>{command}</code>
            </pre>
            <p className="install-status" role="status">
                {message}
            </p>
        </div>
    );
}

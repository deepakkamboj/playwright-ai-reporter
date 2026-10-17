import React, {useEffect, useId, useState} from 'react';
import {asset} from './base';

export default function Diagram({src, alt, caption}: {src: string; alt: string; caption?: React.ReactNode}) {
    return (
        <figure className="das-figure">
            <img src={asset(src)} alt={alt} width={1425} height={2718} loading="lazy" />
            {caption ? <figcaption>{caption}</figcaption> : null}
        </figure>
    );
}

export function MermaidDiagram({chart}: {chart: string}) {
    const id = useId().replace(/[^a-zA-Z0-9]/g, '');
    const [svg, setSvg] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        let disposed = false;
        let previousTheme = '';
        let revision = 0;
        const root = document.documentElement;

        const update = () => {
            const theme = root.classList.contains('dark') || root.dataset.theme === 'dark' ? 'dark' : 'default';
            if (theme === previousTheme) return;
            previousTheme = theme;
            const currentRevision = ++revision;
            void (async () => {
                try {
                    const {default: mermaid} = await import('mermaid');
                    if (disposed || currentRevision !== revision) return;
                    mermaid.initialize({startOnLoad: false, securityLevel: 'strict', theme, fontFamily: 'inherit'});
                    const rendered = await mermaid.render(`reporter${id}`, chart);
                    if (disposed || currentRevision !== revision) return;
                    setSvg(rendered.svg);
                    setError('');
                } catch (cause) {
                    if (disposed || currentRevision !== revision) return;
                    const message = cause instanceof Error ? cause.message : String(cause);
                    console.error('Architecture diagram rendering failed:', cause);
                    setError(message);
                }
            })();
        };
        const observer = new MutationObserver(update);
        observer.observe(root, {attributes: true, attributeFilter: ['class', 'data-theme']});
        update();
        return () => {
            disposed = true;
            observer.disconnect();
        };
    }, [chart, id]);

    if (error) {
        return (
            <div>
                <p role="alert">Diagram unavailable: {error}</p>
                <pre>{chart}</pre>
            </div>
        );
    }
    return <div aria-busy={!svg} dangerouslySetInnerHTML={{__html: svg}} />;
}

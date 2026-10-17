import React from 'react';
import Link from 'next/link';

interface CardProps {
    icon?: React.ReactNode;
    title: string;
    href: string;
    children?: React.ReactNode;
}

export function Card({icon, title, href, children}: CardProps) {
    return (
        <Link href={href} className="nextra-card" style={{textDecoration: 'none'}}>
            <div className="nextra-card-content">
                {icon && <div className="nextra-card-icon">{icon}</div>}
                <h3 className="nextra-card-title">{title}</h3>
                {children && <div className="nextra-card-description">{children}</div>}
            </div>
            <style jsx>{`
                .nextra-card-content {
                    display: block;
                    padding: 1.5rem;
                    border: 1px solid var(--card-border, #e5e7eb);
                    border-radius: 0.5rem;
                    color: inherit;
                    transition:
                        border-color 0.2s ease,
                        box-shadow 0.2s ease,
                        transform 0.2s ease;
                    background-color: var(--card-bg, #ffffff);
                    box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
                }
                :global(.nextra-card):hover .nextra-card-content,
                :global(.nextra-card):focus-visible .nextra-card-content {
                    border-color: var(--card-border-hover, #334155);
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
                    transform: translateY(-2px);
                }
                :global(.nextra-card):focus-visible {
                    border-radius: 0.5rem;
                    outline: 3px solid var(--card-focus, #334155);
                    outline-offset: 3px;
                }
                .nextra-card-icon {
                    display: flex;
                    align-items: center;
                    justify-content: flex-start;
                    width: 2.5rem;
                    height: 2.5rem;
                    color: var(--card-icon, #334155);
                    margin-bottom: 0.75rem;
                    transition:
                        color 0.2s ease,
                        transform 0.2s ease;
                }
                :global(.nextra-card):hover .nextra-card-icon,
                :global(.nextra-card):focus-visible .nextra-card-icon {
                    color: var(--card-icon-hover, #0f172a);
                    transform: translateY(-2px);
                }
                .nextra-card-icon :global(svg) {
                    width: 100%;
                    height: 100%;
                }
                .nextra-card-title {
                    font-size: 1.125rem;
                    font-weight: 600;
                    margin-bottom: 0.5rem;
                    margin-top: 0;
                }
                .nextra-card-description {
                    font-size: 0.875rem;
                    color: var(--card-desc, #6b7280);
                    line-height: 1.5;
                }
                .nextra-card-description :global(p) {
                    margin: 0;
                }
                @media (forced-colors: active) {
                    .nextra-card-icon,
                    :global(.nextra-card):hover .nextra-card-icon,
                    :global(.nextra-card):focus-visible .nextra-card-icon {
                        color: LinkText;
                    }
                    :global(.nextra-card):focus-visible {
                        outline-color: Highlight;
                    }
                }
            `}</style>
        </Link>
    );
}

interface CardsProps {
    children: React.ReactNode;
    cols?: number;
}

export function Cards({children, cols = 2}: CardsProps) {
    return (
        <div
            style={{
                display: 'grid',
                gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${Math.floor(40 / cols)}rem), 1fr))`,
                gap: '1rem',
                marginTop: '1.5rem',
                marginBottom: '1.5rem',
            }}
        >
            {children}
        </div>
    );
}

import React from 'react';

export function Features({children}: {children: React.ReactNode}) {
    return <ul className="icon-feature-list">{children}</ul>;
}

export function Feature({icon, title, children}: {icon: React.ReactNode; title: string; children: React.ReactNode}) {
    return (
        <li>
            <span className="feature-list-icon" aria-hidden="true">
                {icon}
            </span>
            <div className="feature-list-copy">
                <h3>{title}</h3>
                <div className="feature-list-description">{children}</div>
            </div>
        </li>
    );
}

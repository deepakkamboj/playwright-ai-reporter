import React from 'react';

const base = {
    'aria-hidden': true,
    focusable: false,
    width: '100%',
    height: '100%',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
};

export const CheckIcon = () => (
    <svg viewBox="0 0 24 24" {...base}>
        <circle cx="12" cy="12" r="9" />
        <path d="m8 12 3 3 5-6" />
    </svg>
);

export const CrossIcon = () => (
    <svg viewBox="0 0 24 24" {...base}>
        <circle cx="12" cy="12" r="9" />
        <path d="m9 9 6 6m0-6-6 6" />
    </svg>
);

export const PauseIcon = () => (
    <svg viewBox="0 0 24 24" {...base}>
        <circle cx="12" cy="12" r="9" />
        <path d="M9 8v8m6-8v8" />
    </svg>
);

export const LoopIcon = () => (
    <svg viewBox="0 0 24 24" {...base}>
        <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
        <path d="M21 3v5h-5" />
        <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
        <path d="M3 21v-5h5" />
    </svg>
);

export const ShieldIcon = () => (
    <svg viewBox="0 0 24 24" {...base}>
        <path d="M12 3l7 3v6c0 4.4-3 7.7-7 9-4-1.3-7-4.6-7-9V6l7-3z" />
        <path d="M9 12l2 2 4-4" />
    </svg>
);

export const WrenchIcon = () => (
    <svg viewBox="0 0 24 24" {...base}>
        <path d="M14.5 6a3.5 3.5 0 0 0-4.6 4.3l-6 6a1.5 1.5 0 0 0 2.1 2.1l6-6A3.5 3.5 0 0 0 18 8l-2.3 2.3-2-2L16 6z" />
    </svg>
);

export const TerminalIcon = () => (
    <svg viewBox="0 0 24 24" {...base}>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M7 9l3 3-3 3" />
        <path d="M13 15h4" />
    </svg>
);

export const EyeIcon = () => (
    <svg viewBox="0 0 24 24" {...base}>
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
        <circle cx="12" cy="12" r="3" />
    </svg>
);

export const GearIcon = () => (
    <svg viewBox="0 0 24 24" {...base}>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
    </svg>
);

export const RocketIcon = () => (
    <svg viewBox="0 0 24 24" {...base}>
        <path d="M5 15c-1 1-1.5 4-1.5 4s3-.5 4-1.5" />
        <path d="M9 15l-1-1c0-4 3-9 12-11-2 9-7 12-11 12l-1-1z" />
        <circle cx="14.5" cy="9.5" r="1.4" />
    </svg>
);

export const BookIcon = () => (
    <svg viewBox="0 0 24 24" {...base}>
        <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" />
        <path d="M19 3v18" />
    </svg>
);

export const LayersIcon = () => (
    <svg viewBox="0 0 24 24" {...base}>
        <path d="M12 3l9 5-9 5-9-5 9-5z" />
        <path d="M3 13l9 5 9-5" />
    </svg>
);

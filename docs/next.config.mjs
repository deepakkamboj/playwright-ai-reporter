import nextra from 'nextra';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

const withNextra = nextra({
    theme: 'nextra-theme-docs',
    themeConfig: './theme.config.tsx',
    defaultShowCopyCode: true,
});

export default withNextra({
    output: 'export',
    basePath,
    trailingSlash: true,
    images: {unoptimized: true},
});

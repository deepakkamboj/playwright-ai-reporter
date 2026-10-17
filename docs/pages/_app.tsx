import type {AppProps} from 'next/app';
import 'nextra-theme-docs/style.css';
import '../styles/custom.css';

export default function App({Component, pageProps}: AppProps) {
    return <Component {...pageProps} />;
}

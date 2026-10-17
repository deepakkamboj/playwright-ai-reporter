export const REDACTED = '****';

const MIN_SECRET_LENGTH = 4;
const MAX_LEARNED_SECRETS = 1000;
const IGNORED_SECRET_VALUES = new Set(['password', 'secret', 'token', 'changeme', 'example', 'undefined', 'null']);
const SENSITIVE_KEY =
    /authorization|proxy[-_]?authorization|cookie|token|secret|password|passwd|api[-_]?key|private[-_]?key|access[-_]?key|session|credential|connection[-_]?string|webhook/i;
const SENSITIVE_ENV_KEY =
    /(?:^|_)(?:TOKEN|SECRET|PASSWORD|PASSWD|API_KEY|PRIVATE_KEY|ACCESS_KEY|CLIENT_SECRET|CONNECTION_STRING|DATABASE_URL|AUTH|WEBHOOK)(?:$|_)/i;
const KEY_VALUE_SECRET =
    /(\b(?:authorization|token|secret|password|passwd|api[-_]?key|private[-_]?key|access[-_]?key|client[-_]?secret|connection[-_]?string)\b\s*[:=]\s*)(?:"([^"]*)"|'([^']*)'|([^\s,;&]+))/gi;
const AUTH_CREDENTIAL = /\b(Bearer|Basic)\s+[A-Za-z0-9+/_.=-]+/gi;
const JWT = /\beyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
const PROVIDER_TOKEN =
    /\b(?:github_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{16,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{30,})\b/g;
const CARD_CANDIDATE = /\b(?:\d[ -]*?){13,19}\b/g;

const learnedSecrets = new Set<string>();

function isSensitiveKey(key: string): boolean {
    return SENSITIVE_KEY.test(key);
}

function registerSecretValue(value: unknown): void {
    if (typeof value === 'string') {
        const secret = value.trim();
        if (
            learnedSecrets.size < MAX_LEARNED_SECRETS &&
            secret.length >= MIN_SECRET_LENGTH &&
            secret !== REDACTED &&
            !IGNORED_SECRET_VALUES.has(secret.toLowerCase())
        ) {
            learnedSecrets.add(secret);
        }
        return;
    }
    if (Array.isArray(value)) {
        value.forEach(registerSecretValue);
        return;
    }
    if (value && typeof value === 'object') {
        Object.values(value).forEach(registerSecretValue);
    }
}

function learnEnvironmentSecrets(): void {
    for (const [key, value] of Object.entries(process.env)) {
        if (value && SENSITIVE_ENV_KEY.test(key)) {
            registerSecretValue(value);
        }
    }
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function passesLuhn(value: string): boolean {
    const digits = value.replace(/\D/g, '');
    if (digits.length < 13 || digits.length > 19 || /^(\d)\1+$/.test(digits)) {
        return false;
    }

    let sum = 0;
    let double = false;
    for (let index = digits.length - 1; index >= 0; index--) {
        let digit = Number(digits[index]);
        if (double) {
            digit *= 2;
            if (digit > 9) digit -= 9;
        }
        sum += digit;
        double = !double;
    }
    return sum % 10 === 0;
}

/** Learns an explicit secret so later occurrences are masked even when their key is absent. */
export function registerSecret(value: string): void {
    registerSecretValue(value);
}

/** Redacts credentials and learned secret values from arbitrary text. */
export function redactText(value: string): string {
    learnEnvironmentSecrets();

    let redacted = value.replace(KEY_VALUE_SECRET, (_match, prefix: string, doubleQuoted, singleQuoted, bare) => {
        registerSecretValue(doubleQuoted ?? singleQuoted ?? bare);
        return `${prefix}${REDACTED}`;
    });

    redacted = redacted
        .replace(AUTH_CREDENTIAL, (_match, scheme: string) => `${scheme} ${REDACTED}`)
        .replace(JWT, REDACTED)
        .replace(PROVIDER_TOKEN, REDACTED)
        .replace(CARD_CANDIDATE, (candidate) => (passesLuhn(candidate) ? REDACTED : candidate));

    for (const secret of [...learnedSecrets].sort((left, right) => right.length - left.length)) {
        redacted = redacted.replace(new RegExp(escapeRegExp(secret), 'g'), REDACTED);
    }
    return redacted;
}

/** Redacts sensitive query parameters and any credentials embedded in a URL. */
export function redactUrl(rawUrl: string): string {
    try {
        const url = new URL(rawUrl);
        for (const key of [...url.searchParams.keys()]) {
            const value = url.searchParams.get(key);
            if (isSensitiveKey(key)) {
                if (value) registerSecretValue(value);
                url.searchParams.set(key, REDACTED);
            } else if (value) {
                url.searchParams.set(key, redactText(value));
            }
        }
        if (url.username) {
            registerSecretValue(url.username);
            url.username = REDACTED;
        }
        if (url.password) {
            registerSecretValue(url.password);
            url.password = REDACTED;
        }
        return url.toString();
    } catch {
        return redactText(rawUrl);
    }
}

/** Redacts sensitive header values and credentials repeated in otherwise safe headers. */
export function redactHeaders(headers: Record<string, string>): Record<string, string> {
    for (const [key, value] of Object.entries(headers)) {
        if (isSensitiveKey(key)) registerSecretValue(value);
    }
    return Object.fromEntries(
        Object.entries(headers).map(([key, value]) => [key, isSensitiveKey(key) ? REDACTED : redactText(value)]),
    );
}

function redactStructured(value: unknown, seen: WeakSet<object>): unknown {
    if (typeof value === 'string') return redactText(value);
    if (Array.isArray(value)) return value.map((item) => redactStructured(item, seen));
    if (!value || typeof value !== 'object') return value;
    if (value instanceof Date) return value;
    if (Buffer.isBuffer(value)) return redactText(value.toString('utf8'));
    if (seen.has(value)) return '[Circular]';

    seen.add(value);
    const entries = Object.entries(value);
    for (const [key, inner] of entries) {
        if (isSensitiveKey(key)) registerSecretValue(inner);
    }
    const redacted = Object.fromEntries(
        entries.map(([key, inner]) => [
            key,
            isSensitiveKey(key) && (!inner || typeof inner !== 'object') ? REDACTED : redactStructured(inner, seen),
        ]),
    );
    seen.delete(value);
    return redacted;
}

function learnStructuredSecrets(value: unknown, seen: WeakSet<object>): void {
    if (!value || typeof value !== 'object' || value instanceof Date || Buffer.isBuffer(value) || seen.has(value)) {
        return;
    }
    seen.add(value);
    if (Array.isArray(value)) {
        value.forEach((item) => learnStructuredSecrets(item, seen));
    } else {
        for (const [key, inner] of Object.entries(value)) {
            if (isSensitiveKey(key)) registerSecretValue(inner);
            learnStructuredSecrets(inner, seen);
        }
    }
    seen.delete(value);
}

function learnTextSecrets(value: unknown, seen: WeakSet<object>): void {
    if (typeof value === 'string') {
        value.replace(KEY_VALUE_SECRET, (_match, _prefix, doubleQuoted, singleQuoted, bare) => {
            registerSecretValue(doubleQuoted ?? singleQuoted ?? bare);
            return _match;
        });
        return;
    }
    if (!value || typeof value !== 'object' || value instanceof Date || Buffer.isBuffer(value) || seen.has(value)) {
        return;
    }
    seen.add(value);
    if (Array.isArray(value)) {
        value.forEach((item) => learnTextSecrets(item, seen));
    } else {
        Object.values(value).forEach((item) => learnTextSecrets(item, seen));
    }
    seen.delete(value);
}

/** Returns a redacted deep copy suitable for an external provider or serializer. */
export function redactValue(value: unknown): unknown {
    learnEnvironmentSecrets();
    learnStructuredSecrets(value, new WeakSet<object>());
    learnTextSecrets(value, new WeakSet<object>());
    return redactStructured(value, new WeakSet<object>());
}

/** Returns a type-preserving redacted copy of a structured provider payload. */
export function redactObject<T extends object>(value: T): T {
    return redactValue(value) as T;
}

/** Serializes a redacted deep copy as JSON. */
export function redactJson(value: unknown, space?: string | number): string {
    return JSON.stringify(redactValue(value), null, space);
}

/** Redacts message content while preserving provider-specific message fields. */
export function redactMessages<T extends {content: string}>(messages: readonly T[]): T[] {
    return redactValue(messages) as T[];
}

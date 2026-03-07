/**
 * Multi-layered security scanning — in-house, no external APIs.
 * Covers: secrets detection, code pattern analysis, config/IaC misconfigs,
 * and dependency vulnerability heuristics.
 */

export interface SecurityFinding {
    type: 'dependency' | 'code' | 'secret' | 'configuration';
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
    title: string;
    description: string;
    file: string;
    line?: number;
    snippet?: string;
    recommendation: string;
    cwe?: string;
    cvss?: number;
    confidence?: 'high' | 'medium' | 'low';
}

export interface ScanSummary {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
    debug?: {
        filesReceived: number;
        codeFilesFiltered: number;
        filesSuccessfullyFetched: number;
        patternFindings: number;
        aiFindings: number;
        afterDedup: number;
        afterConfidenceFilter: number;
    };
}

// ─── Secret Detection Patterns ────────────────────────────────────────────────

const SECRET_PATTERNS = [
    // Generic API key patterns
    {
        name: 'API Key',
        regex: /['"](api[_-]?key|apikey)['"]\s*[:=]\s*['"]([a-zA-Z0-9_\-]{20,})['"]/i,
        severity: 'critical' as const,
    },
    {
        name: 'Hardcoded Password',
        regex: /(?:password|passwd|pwd)['"]\s*[:=]\s*['"]([^'"]{8,})['"]/i,
        severity: 'critical' as const,
    },
    // AWS
    {
        name: 'AWS Access Key ID',
        regex: /(AKIA|ASIA|AROA|AIDA)[0-9A-Z]{16}/,
        severity: 'critical' as const,
    },
    {
        name: 'AWS Secret Access Key',
        regex: /aws[_\-.]?(secret|access)[_\-.]?key\s*[:=]\s*['"]([a-zA-Z0-9/+=]{40})['"]/i,
        severity: 'critical' as const,
    },
    // GitHub
    {
        name: 'GitHub Personal Access Token',
        regex: /ghp_[a-zA-Z0-9]{36}/,
        severity: 'critical' as const,
    },
    {
        name: 'GitHub OAuth Token',
        regex: /gho_[a-zA-Z0-9]{36}/,
        severity: 'critical' as const,
    },
    {
        name: 'GitHub App Token',
        regex: /(ghu|ghs|ghr)_[a-zA-Z0-9]{36}/,
        severity: 'critical' as const,
    },
    // OpenAI / AI Services
    {
        name: 'OpenAI API Key',
        regex: /sk-[a-zA-Z0-9]{48}/,
        severity: 'critical' as const,
    },
    {
        name: 'Anthropic API Key',
        regex: /sk-ant-[a-zA-Z0-9\-_]{64,}/,
        severity: 'critical' as const,
    },
    {
        name: 'HuggingFace Token',
        regex: /hf_[a-zA-Z0-9]{34}/,
        severity: 'high' as const,
    },
    // Stripe
    {
        name: 'Stripe Secret Key',
        regex: /sk_(live|test)_[a-zA-Z0-9]{24,}/,
        severity: 'critical' as const,
    },
    {
        name: 'Stripe Publishable Key',
        regex: /pk_(live|test)_[a-zA-Z0-9]{24,}/,
        severity: 'medium' as const,
    },
    // Google
    {
        name: 'Google API Key',
        regex: /AIza[0-9A-Za-z\-_]{35}/,
        severity: 'high' as const,
    },
    {
        name: 'Google OAuth Client Secret',
        regex: /GOCSPX-[a-zA-Z0-9\-_]{28}/,
        severity: 'critical' as const,
    },
    // Twilio
    {
        name: 'Twilio Auth Token',
        regex: /twilio[^a-zA-Z0-9]*['"]\s*[:=]\s*['"][0-9a-f]{32}['"]/i,
        severity: 'critical' as const,
    },
    {
        name: 'Twilio Account SID',
        regex: /AC[a-zA-Z0-9]{32}/,
        severity: 'high' as const,
    },
    // Slack & Discord
    {
        name: 'Slack Bot Token',
        regex: /xoxb-[0-9]{10,13}-[0-9]{10,13}-[a-zA-Z0-9]{24}/,
        severity: 'critical' as const,
    },
    {
        name: 'Slack Webhook URL',
        regex: /hooks\.slack\.com\/services\/[a-zA-Z0-9/_]+/,
        severity: 'high' as const,
    },
    {
        name: 'Discord Bot Token',
        regex: /[MN][a-zA-Z0-9]{23}\.[a-zA-Z0-9_-]{6}\.[a-zA-Z0-9_-]{27}/,
        severity: 'critical' as const,
    },
    // SendGrid / Mailchimp
    {
        name: 'SendGrid API Key',
        regex: /SG\.[a-zA-Z0-9_-]{22}\.[a-zA-Z0-9_-]{43}/,
        severity: 'critical' as const,
    },
    {
        name: 'Mailchimp API Key',
        regex: /[a-f0-9]{32}-us[0-9]{1,2}/,
        severity: 'high' as const,
    },
    // Firebase
    {
        name: 'Firebase Auth Token',
        regex: /firebase[^a-zA-Z0-9]*token[^a-zA-Z0-9]*['"][a-zA-Z0-9\-_.~+/]{100,}['"]/i,
        severity: 'critical' as const,
    },
    // Azure
    {
        name: 'Azure Storage Account Key',
        regex: /AccountKey=[a-zA-Z0-9+/]{86}==/,
        severity: 'critical' as const,
    },
    // npm / Vercel
    {
        name: 'npm Auth Token',
        regex: /\/\/registry\.npmjs\.org\/:_authToken=[a-zA-Z0-9\-._~+/]+=*/,
        severity: 'high' as const,
    },
    {
        name: 'Vercel Token',
        regex: /vercel[^a-zA-Z0-9]*token\s*[:=]\s*['"](.*?)['"]/i,
        severity: 'high' as const,
    },
    // Private Keys / Certs
    {
        name: 'Private Key',
        regex: /-----BEGIN (?:RSA|OPENSSH|DSA|EC|PGP|ENCRYPTED) PRIVATE KEY-----/,
        severity: 'critical' as const,
    },
    // JWT
    {
        name: 'JWT Token',
        regex: /eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/,
        severity: 'high' as const,
    },
    // Generic high-entropy secrets in key/token/secret assignments
    {
        name: 'Hardcoded Secret',
        regex: /(?:secret|auth_token|access_token|refresh_token|client_secret)\s*[:=]\s*['"]([a-zA-Z0-9+/=_\-]{32,})['"]/i,
        severity: 'high' as const,
    },
    // Database connection strings with credentials
    {
        name: 'Database Connection String with Credentials',
        regex: /(?:postgresql|mysql|mongodb(?:\+srv)?|redis):\/\/[^:]+:[^@]+@/i,
        severity: 'critical' as const,
    },
];

export function detectSecrets(filepath: string, content: string): SecurityFinding[] {
    const findings: SecurityFinding[] = [];
    if (typeof content !== 'string') return findings;

    // Ignore lockfiles as they contain hashes that frequently trigger false positives
    const isLockfile = /package-lock\.json$|yarn\.lock$|pnpm-lock\.yaml$|Gemfile\.lock$|poetry\.lock$|composer\.lock$/i.test(filepath);
    if (isLockfile) return findings;

    const lines = content.split('\n');
    lines.forEach((line, index) => {
        // Skip obvious comments
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('*')) return;

        SECRET_PATTERNS.forEach(pattern => {
            if (pattern.regex.test(line)) {
                // Avoid flagging placeholder values like "your-api-key-here"
                if (/your[-_]?|<.*?>|example|placeholder|xxx|fake|dummy|changeme/i.test(line)) return;
                findings.push({
                    type: 'secret',
                    severity: pattern.severity,
                    title: `Exposed ${pattern.name}`,
                    description: `Found hardcoded ${pattern.name} in source code at line ${index + 1}`,
                    file: filepath,
                    line: index + 1,
                    recommendation: 'Move to environment variables or a secrets management system. Rotate the exposed credential immediately.',
                    cwe: 'CWE-798',
                    confidence: 'high',
                });
            }
        });
    });

    return findings;
}

// ─── Code Pattern Detection ───────────────────────────────────────────────────

interface CodePattern {
    name: string;
    regex: RegExp;
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
    cwe: string;
    recommendation: string;
    validate?: (fileContent: string, matchedLine: string) => boolean;
}

const CODE_PATTERNS: CodePattern[] = [
    // Execution sinks
    {
        name: 'Unsafe eval() usage',
        regex: /\beval\s*\(/,
        severity: 'high',
        cwe: 'CWE-95',
        recommendation: 'Avoid eval(). Use JSON.parse(), Map lookups, or safe alternatives.',
    },
    {
        name: 'Dynamic Function constructor',
        regex: /new\s+Function\s*\(/,
        severity: 'high',
        cwe: 'CWE-95',
        recommendation: 'new Function() can execute arbitrary code. Avoid dynamic code execution.',
    },
    // DOM/XSS
    {
        name: 'Unsafe innerHTML assignment',
        regex: /\.innerHTML\s*=/,
        severity: 'medium',
        cwe: 'CWE-79',
        recommendation: 'Use textContent or a sanitization library (DOMPurify) before setting innerHTML.',
    },
    {
        name: 'Unsafe dangerouslySetInnerHTML',
        regex: /dangerouslySetInnerHTML\s*=\s*\{\s*\{?\s*__html\s*:/,
        severity: 'medium',
        cwe: 'CWE-79',
        recommendation: 'Sanitize HTML with DOMPurify before passing to dangerouslySetInnerHTML.',
    },
    {
        name: 'document.write usage',
        regex: /document\.write\s*\(/,
        severity: 'medium',
        cwe: 'CWE-79',
        recommendation: 'Avoid document.write(). Use DOM manipulation or innerHTML with sanitization.',
    },
    // Injection
    {
        name: 'SQL string concatenation',
        regex: /(?:SELECT|INSERT|UPDATE|DELETE|WHERE)\s+.*?\+\s*(?:req\.|params\.|query\.|body\.|user\.|input\.|this\.)/i,
        severity: 'high',
        cwe: 'CWE-89',
        recommendation: 'Use parameterized queries or an ORM to prevent SQL injection.',
        validate: (content) =>
            /(?:require|import).*(?:mysql|postgres|pg|sqlite|sequelize|knex|typeorm|mongodb|mongoose)/i.test(content),
    },
    {
        name: 'Unsafe child_process.exec',
        regex: /(?:child_process|cp)\s*\.\s*(?:exec|execSync)\s*\(/,
        severity: 'high',
        cwe: 'CWE-78',
        recommendation: 'Use execFile() or spawn() instead, and validate/sanitize all inputs.',
        validate: (content) => /(?:require|import).*['"]child_process['"]/.test(content),
    },
    {
        name: 'Shell injection via shell: true',
        regex: /spawn\s*\(.*shell\s*:\s*true/,
        severity: 'high',
        cwe: 'CWE-78',
        recommendation: 'Avoid shell:true in spawn. Use execFile() with a fixed command and validated arguments.',
    },
    // Open redirect
    {
        name: 'Potential open redirect',
        regex: /res\.redirect\s*\(\s*(?:req\.|params\.|query\.|body\.)/,
        severity: 'medium',
        cwe: 'CWE-601',
        recommendation: 'Validate redirect URLs against an allowlist. Never redirect to arbitrary user-controlled URLs.',
    },
    // SSRF
    {
        name: 'Potential SSRF (fetch with user input)',
        regex: /(?:fetch|axios\.get|axios\.post|axios\.request|http\.get|https\.get)\s*\(\s*(?:req\.|params\.|query\.|body\.|user\.)/,
        severity: 'high',
        cwe: 'CWE-918',
        recommendation: 'Validate and allowlist URLs before making server-side HTTP requests.',
    },
    // Path traversal
    {
        name: 'Potential path traversal',
        regex: /(?:fs\.readFile|fs\.readFileSync|path\.join|path\.resolve)\s*\([^)]*(?:req\.|params\.|query\.|body\.)/,
        severity: 'high',
        cwe: 'CWE-22',
        recommendation: 'Validate and sanitize file paths. Use path.resolve() and check the result is within expected directory.',
    },
    // Prototype pollution
    {
        name: 'Prototype pollution vector',
        regex: /\[?\s*['"]__proto__['"]\s*\]?\s*=|\[?\s*['"]constructor['"]\s*\]?\s*\.\s*['"]prototype['"]/,
        severity: 'high',
        cwe: 'CWE-1321',
        recommendation: 'Avoid setting __proto__ or mutating Object.prototype. Use Object.create(null) for safe maps.',
    },
    // Crypto
    {
        name: 'Weak hash algorithm (MD5/SHA1)',
        regex: /\b(?:md5|sha1|sha-1)\b/i,
        severity: 'medium',
        cwe: 'CWE-327',
        recommendation: 'Use SHA-256 or stronger. MD5 and SHA-1 are cryptographically broken.',
    },
    {
        name: 'Insecure random number generation',
        regex: /Math\.random\s*\(\s*\)/,
        severity: 'low',
        cwe: 'CWE-338',
        recommendation: 'Use crypto.randomBytes() or crypto.randomUUID() for security-sensitive randomness.',
    },
    // ReDoS
    {
        name: 'Potential ReDoS vulnerable regex',
        regex: /new RegExp\(.*\+.*\)|\/\(\.\+\)\+\/|\/\(a\+\)\+\/|\/\(.*\|\.\*\)\+\//,
        severity: 'medium',
        cwe: 'CWE-1333',
        recommendation: 'Audit regex for catastrophic backtracking. Use a ReDoS checker and set input length limits.',
    },
    // Cookie security
    {
        name: 'Cookie without HttpOnly flag',
        regex: /(?:res\.cookie|Set-Cookie)[^;)]*(?!httponly|HttpOnly)/i,
        severity: 'low',
        cwe: 'CWE-1004',
        recommendation: 'Set HttpOnly flag on cookies to prevent XSS-based cookie theft.',
    },
    // Insecure deserialization
    {
        name: 'Unsafe deserialization (serialize-javascript)',
        regex: /require\(['"]serialize-javascript['"]\)|unserialize\s*\(/,
        severity: 'high',
        cwe: 'CWE-502',
        recommendation: 'Avoid deserializing untrusted data. Validate and schema-check all external inputs.',
    },
    // Timing attacks
    {
        name: 'Non-constant-time string comparison for secrets',
        regex: /(?:===|!==|==|!=)\s*(?:token|password|secret|hash|hmac|signature)/i,
        severity: 'low',
        cwe: 'CWE-208',
        recommendation: 'Use crypto.timingSafeEqual() for comparing secrets to prevent timing attacks.',
    },
    // Missing auth check heuristic
    {
        name: 'Route handler without apparent auth check',
        regex: /(?:app|router)\.(?:get|post|put|delete|patch)\s*\([^)]+,\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{(?:(?!(?:auth|jwt|session|token|middleware))[\s\S])*\}/,
        severity: 'info',
        cwe: 'CWE-306',
        recommendation: 'Verify that this route has proper authentication/authorization middleware applied.',
    },
];

export function detectCodePatterns(filepath: string, content: string): SecurityFinding[] {
    if (!/\.(js|jsx|ts|tsx|py|java|php|rb|go|rs)$/i.test(filepath)) return [];
    if (typeof content !== 'string') return [];

    const findings: SecurityFinding[] = [];
    const lines = content.split('\n');

    lines.forEach((line, index) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*') || trimmed.startsWith('#')) return;

        CODE_PATTERNS.forEach(pattern => {
            if (pattern.regex.test(line)) {
                if (pattern.validate && !pattern.validate(content, line)) return;
                findings.push({
                    type: 'code',
                    severity: pattern.severity,
                    title: pattern.name,
                    description: `Potentially unsafe code pattern at line ${index + 1}`,
                    file: filepath,
                    line: index + 1,
                    recommendation: pattern.recommendation,
                    cwe: pattern.cwe,
                    confidence: pattern.validate ? 'high' : 'medium',
                });
            }
        });
    });

    return findings;
}

// ─── Configuration / IaC Misconfiguration Detection ──────────────────────────

export function detectConfigIssues(filepath: string, content: string): SecurityFinding[] {
    if (typeof content !== 'string') return [];
    const isConfigFile =
        /\.(ya?ml|toml|json|env|ini|config|cfg)$/i.test(filepath) ||
        /\.env\./i.test(filepath) ||
        filepath.endsWith('.env');
    if (!isConfigFile) return [];

    const findings: SecurityFinding[] = [];
    const lines = content.split('\n');
    const fullContent = content;

    // 1. Reject TLS validation
    if (/NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*['"]?0['"]?/i.test(fullContent)) {
        findings.push({
            type: 'configuration',
            severity: 'high',
            title: 'TLS Validation Disabled',
            description: 'NODE_TLS_REJECT_UNAUTHORIZED=0 disables SSL certificate verification entirely.',
            file: filepath,
            recommendation: 'Remove this setting. Use proper CA certificates or set NODE_EXTRA_CA_CERTS instead.',
            cwe: 'CWE-295',
            confidence: 'high',
        });
    }

    // 2. Insecure HTTP endpoint in production-looking config
    if (/(?:API_URL|BASE_URL|BACKEND_URL|SERVICE_URL)\s*=\s*http:\/\//i.test(fullContent)) {
        findings.push({
            type: 'configuration',
            severity: 'medium',
            title: 'Insecure HTTP Endpoint in Config',
            description: 'A service URL is configured with HTTP instead of HTTPS, exposing traffic to interception.',
            file: filepath,
            recommendation: 'Use HTTPS for all production service URLs.',
            cwe: 'CWE-319',
            confidence: 'high',
        });
    }

    // 3. Permissive CORS
    if (/Access-Control-Allow-Origin\s*[:=]\s*['"]\*['"]/i.test(fullContent)) {
        findings.push({
            type: 'configuration',
            severity: 'medium',
            title: 'Permissive CORS Policy',
            description: 'Access-Control-Allow-Origin is set to *, allowing any origin to access this resource.',
            file: filepath,
            recommendation: 'Restrict CORS to specific trusted origins.',
            cwe: 'CWE-942',
            confidence: 'high',
        });
    }

    // 4. Debug mode enabled
    if (/(?:DEBUG|APP_DEBUG|DEBUG_MODE)\s*=\s*(?:true|1|yes|on|"|')/i.test(fullContent)) {
        findings.push({
            type: 'configuration',
            severity: 'medium',
            title: 'Debug Mode Enabled',
            description: 'Debug mode is enabled, which may expose stack traces, internal paths, and sensitive data.',
            file: filepath,
            recommendation: 'Disable debug mode in production configurations.',
            cwe: 'CWE-215',
            confidence: 'medium',
        });
    }

    // 5. Real secrets in .env.example
    if (filepath.includes('.env.example') || filepath.includes('.env.sample')) {
        SECRET_PATTERNS.forEach(pattern => {
            if (pattern.regex.test(fullContent) && !/your[-_]?|<.*?>|example|placeholder|xxx|fake|dummy|changeme/i.test(fullContent)) {
                findings.push({
                    type: 'configuration',
                    severity: 'high',
                    title: `Possible Real Secret in Example Env File`,
                    description: `${filepath} may contain a real ${pattern.name} instead of a placeholder.`,
                    file: filepath,
                    recommendation: 'Replace real credentials with placeholder values in example env files.',
                    cwe: 'CWE-798',
                    confidence: 'medium',
                });
            }
        });
    }

    // 6. Hardcoded secrets in YAML/TOML (key: value format with long string values)
    lines.forEach((line, index) => {
        if (/^\s*#/.test(line)) return;
        if (/(?:password|secret|token|key|credential)\s*:\s*['"]?([a-zA-Z0-9+/=_\-]{16,})['"]?/i.test(line)) {
            const valueMatch = line.match(/:\s*['"]?([a-zA-Z0-9+/=_\-]{16,})['"]?/);
            const value = valueMatch?.[1] ?? '';
            if (!/your[-_]?|example|placeholder|changeme|xxx|fake|dummy/i.test(value)) {
                findings.push({
                    type: 'configuration',
                    severity: 'high',
                    title: 'Hardcoded Secret in Config File',
                    description: `Line ${index + 1} appears to contain a hardcoded credential or secret.`,
                    file: filepath,
                    line: index + 1,
                    recommendation: 'Use environment variable references (e.g. ${MY_SECRET}) instead of hardcoded values.',
                    cwe: 'CWE-798',
                    confidence: 'medium',
                });
            }
        }
    });

    return findings;
}

// ─── Dependency Vulnerability Heuristics ─────────────────────────────────────

const KNOWN_VULNERABLE: Record<string, { severity: SecurityFinding['severity']; issue: string; cve?: string }> = {
    'lodash': { severity: 'high', issue: 'Prototype pollution vulnerability (CVE-2019-10744)', cve: 'CVE-2019-10744' },
    'moment': { severity: 'low', issue: 'Deprecated package with known ReDoS vulnerability. Switch to date-fns or dayjs.' },
    'request': { severity: 'medium', issue: 'Deprecated HTTP client. Switch to axios or native fetch.' },
    'node-fetch': { severity: 'high', issue: 'Versions < 2.6.7 have a SSRF vulnerability (CVE-2022-0235)', cve: 'CVE-2022-0235' },
    'axios': { severity: 'medium', issue: 'Versions < 1.6.0 are vulnerable to CSRF (CVE-2023-45857)', cve: 'CVE-2023-45857' },
    'jsonwebtoken': { severity: 'high', issue: 'Versions < 9.0.0 allow algorithm confusion attacks (CVE-2022-23529)', cve: 'CVE-2022-23529' },
    'express': { severity: 'medium', issue: 'Versions < 4.19.2 have open redirect and XSS vulnerabilities (CVE-2024-29041)', cve: 'CVE-2024-29041' },
    'ws': { severity: 'high', issue: 'Versions < 7.4.6 have a ReDoS vulnerability (CVE-2021-32640)', cve: 'CVE-2021-32640' },
    'serialize-javascript': { severity: 'high', issue: 'Versions < 3.1.0 allow remote code execution (CVE-2020-7660)', cve: 'CVE-2020-7660' },
    'ejs': { severity: 'high', issue: 'Server-Side Template Injection in versions < 3.1.7 (CVE-2022-29078)', cve: 'CVE-2022-29078' },
    'tar': { severity: 'high', issue: 'Path traversal in versions < 6.1.9 (CVE-2021-37713)', cve: 'CVE-2021-37713' },
    'semver': { severity: 'medium', issue: 'ReDoS in versions < 7.5.2 (CVE-2022-25883)', cve: 'CVE-2022-25883' },
    'tough-cookie': { severity: 'medium', issue: 'Prototype pollution in versions < 4.1.3 (CVE-2023-26136)', cve: 'CVE-2023-26136' },
    'xml2js': { severity: 'medium', issue: 'Prototype pollution in versions < 0.5.0 (CVE-2023-0842)', cve: 'CVE-2023-0842' },
    'minimist': { severity: 'high', issue: 'Prototype pollution in versions < 1.2.6 (CVE-2021-44906)', cve: 'CVE-2021-44906' },
    'shelljs': { severity: 'medium', issue: 'Improper privilege management (CVE-2022-0144)', cve: 'CVE-2022-0144' },
    'marked': { severity: 'medium', issue: 'XSS vulnerability in older versions. Keep updated.', },
    'sanitize-html': { severity: 'low', issue: 'Older versions have XSS bypass. Keep to latest version.' },
};

export function analyzeDependencies(packageJsonContent: string): SecurityFinding[] {
    const findings: SecurityFinding[] = [];
    try {
        const pkg = JSON.parse(packageJsonContent);
        const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

        for (const [dep] of Object.entries(allDeps || {})) {
            const vuln = KNOWN_VULNERABLE[dep];
            if (vuln) {
                findings.push({
                    type: 'dependency',
                    severity: vuln.severity,
                    title: `Potentially Vulnerable Dependency: ${dep}`,
                    description: vuln.issue,
                    file: 'package.json',
                    recommendation: `Update or replace \`${dep}\` with a maintained, patched version. ${vuln.cve ? `See ${vuln.cve}.` : ''}`,
                    cwe: 'CWE-1035',
                    confidence: 'medium',
                });
            }
        }
    } catch {
        // Invalid package.json — skip
    }
    return findings;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

export function groupBySeverity(findings: SecurityFinding[]): Record<string, SecurityFinding[]> {
    return findings.reduce((acc, finding) => {
        if (!acc[finding.severity]) acc[finding.severity] = [];
        acc[finding.severity].push(finding);
        return acc;
    }, {} as Record<string, SecurityFinding[]>);
}

export function getScanSummary(findings: SecurityFinding[]): ScanSummary {
    const counts = findings.reduce(
        (acc, f) => { acc[f.severity] = (acc[f.severity] ?? 0) + 1; return acc; },
        {} as Record<string, number>
    );
    return {
        total: findings.length,
        critical: counts.critical ?? 0,
        high: counts.high ?? 0,
        medium: counts.medium ?? 0,
        low: counts.low ?? 0,
        info: counts.info ?? 0,
    };
}

/** Main scanning function — runs all detectors across the given files */
export function scanFiles(files: Array<{ path: string; content: string }>): SecurityFinding[] {
    const allFindings: SecurityFinding[] = [];

    for (const file of files) {
        allFindings.push(...detectSecrets(file.path, file.content));
        allFindings.push(...detectCodePatterns(file.path, file.content));
        allFindings.push(...detectConfigIssues(file.path, file.content));
        if (file.path === 'package.json') {
            allFindings.push(...analyzeDependencies(file.content));
        }
    }

    return allFindings;
}

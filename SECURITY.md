# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 2.10.x  | ✅ Active  |
| < 2.10  | ❌ No longer supported |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it **privately**:

1. **Email**: joinwell52@gmail.com
2. **Subject**: `[SECURITY] CodeFlow — <brief description>`
3. **Include**:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

**Please do NOT open a public GitHub Issue for security vulnerabilities.**

We will acknowledge your report within **48 hours** and provide an estimated timeline for a fix.

## Security Best Practices for Users

- **Never commit** `room_key`, tokens, or passwords to public repositories
- Keep `codeflow.json` and `.gitee_token` in `.gitignore`
- Use the latest Desktop version (auto-update will prompt you)
- Run the relay server behind HTTPS in production

## Scope

This policy covers:
- CodeFlow Desktop (`codeflow-desktop/`)
- CodeFlow PWA (`web/pwa/`)
- CodeFlow MCP Plugin (`codeflow-plugin/`)
- WebSocket Relay (`server/relay/`)

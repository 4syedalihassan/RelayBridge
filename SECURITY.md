# Security Policy

## Supported Versions

We actively provide security patches for the following versions of **RelayBridge**:

| Version | Supported |
| --- | --- |
| v0.1.x (Beta) | ✅ Yes |
| < v0.1.0 | ❌ No |

## Reporting a Vulnerability

**Please do not open public GitHub issues for security vulnerabilities.**

If you discover a security vulnerability within RelayBridge, please report it privately to the maintainers:

1. Go to the **Security** tab of this repository on GitHub.
2. Click **Advisories** under the "Reporting" sidebar.
3. Click **Report a vulnerability** to open a private advisory draft.

Alternatively, you can email security reports directly to: **4syedalihassan@gmail.com**

We will acknowledge receipt of your vulnerability report within **48 hours** and coordinate a secure patch release.

## Secure Configuration

*   **Encryption Keys**: RelayBridge automatically generates a machine-wide AES-256 master key under `C:\ProgramData\DiscordGR\master.key`. Keep this file highly restricted (read-only by the application context / Windows Service).
*   **Environment Variables**: Never commit your active `.env` file to source control. It is permanently ignored in `.gitignore`.

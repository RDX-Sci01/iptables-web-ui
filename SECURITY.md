# Security Policy

## Overview

This document outlines security practices for deploying and using iptables-web-ui safely.

## Security Features

### Authentication & Authorization
- ✅ **Password Hashing**: Passwords are hashed using bcryptjs (Bcrypt algorithm) - never stored in plaintext
- ✅ **JWT Tokens**: Temporary session tokens expire after 15 minutes of inactivity
- ✅ **Rate Limiting**: Login attempts are limited to 10 per 15-minute window per IP address
- ✅ **Timing Attack Protection**: Login validation uses constant-time comparison

### Input Validation
- ✅ **Command Injection Prevention**: All iptables table and chain names are validated against whitelists
- ✅ **Numeric Validation**: Rule indices and connection IDs are validated as integers
- ✅ **Policy Validation**: Default policies only accept: ACCEPT, DROP, REJECT, QUEUE
- ✅ **XSS Prevention**: Frontend uses textContent and proper HTML escaping
- ✅ **URL Encoding**: Query parameters are properly URL-encoded

### HTTP Security
- ✅ **Security Headers**: Helmet.js provides protective HTTP headers:
  - `X-Frame-Options: DENY` - Clickjacking protection
  - `X-Content-Type-Options: nosniff` - MIME sniffing protection
  - `Strict-Transport-Security` - HSTS for HTTPS enforcement (max-age: 1 year)
  - `Content-Security-Policy` - Restricts resource loading
- ✅ **Secure Cookies**: 
  - HttpOnly flag prevents JavaScript access
  - SameSite=Strict prevents cross-site requests
  - Secure flag ensures HTTPS-only transmission (when HTTPS=true)
- ✅ **Error Message Sanitization**: Error messages limited to 100 characters to prevent information disclosure

### Container Security
- ✅ **Non-Root User**: Container runs as unprivileged user (uid: 1000)
- ✅ **Restricted Permissions**: Data directory has 700 permissions (owner-only access)
- ✅ **Resource Limits**: CPU and memory limits prevent denial-of-service attacks

## Deployment Best Practices

### 1. Use Environment Variables for Secrets
**DO NOT** put passwords or secrets in docker-compose.yml directly:

```bash
# Create .env file with strong password
echo "WEBUI_PASSWORD=$(openssl rand -base64 32)" > .env
chmod 600 .env

# Reference in docker-compose.yml
env_file:
  - .env
```

### 2. Generate Strong Passwords
```bash
# Generate a strong 32-character password
WEBUI_PASSWORD=$(openssl rand -base64 32)

# Or use a password manager
```

### 3. Network Isolation
- **Local Network Only**: Only expose to trusted networks behind firewall
- **VPN Access**: Use VPN or SSH tunnel for remote access
- **Never expose to the internet** without additional security layers

### 4. Enable HTTPS
For production deployments:
```bash
# Use reverse proxy (nginx, traefik) with TLS certificates
# Set HTTPS=true in .env to enable secure cookie flags
HTTPS=true
```

### 5. Firewall Rules
Restrict access to the web UI port:
```bash
# Only allow local access
iptables -A INPUT -p tcp --dport 8585 -i lo -j ACCEPT
iptables -A INPUT -p tcp --dport 8585 -j DROP

# Or specific trusted IP
iptables -A INPUT -p tcp --dport 8585 -s 192.168.1.0/24 -j ACCEPT
iptables -A INPUT -p tcp --dport 8585 -j DROP
```

### 6. Keep Software Updated
```bash
# Regularly update the Docker image
docker pull ghcr.io/rdx-sci01/iptables-web-ui:latest
docker-compose up -d  # Restart with new image
```

### 7. Monitor Access Logs
```bash
# View container logs
docker logs iptables-web-ui

# Monitor failed login attempts
docker logs iptables-web-ui | grep "Too many login attempts"
```

## Security Vulnerabilities

### Fixed in v1.1.0+
- **XSS (Cross-Site Scripting)**: Frontend properly escapes HTML and uses DOM manipulation
- **Command Injection**: Input validation prevents malicious iptables parameters
- **Information Disclosure**: Error messages sanitized and limited
- **Weak Authentication**: Password hashing with bcrypt, rate limiting on login
- **Long Session Timeout**: Reduced JWT expiration from 30 days to 15 minutes
- **Missing Security Headers**: Added via Helmet.js
- **No Input Validation**: Added comprehensive validation for all parameters

### Remaining Considerations
- Container requires `NET_ADMIN` capability (necessary for iptables access)
- Direct access to iptables rules has full firewall control
- Password stored in environment variable (mitigated by .env file best practices)

## Reporting Security Issues

If you discover a security vulnerability:
1. **Do NOT** open a public GitHub issue
2. Email security details to the maintainer
3. Provide reproduction steps and impact assessment
4. Allow time for fix before public disclosure

## Security Testing

For homelab/testing environments, security features are sufficient. For production:
- Conduct penetration testing
- Use WAF (Web Application Firewall) if internet-exposed
- Implement log aggregation and SIEM monitoring
- Use MFA if possible (requires reverse proxy support)

## FAQ

### Is it safe to expose to the internet?
**No**. This application is designed for local network use. If internet access is required:
- Use a reverse proxy with WAF
- Implement VPN/SSH tunnel
- Add additional authentication layer
- Monitor and log all access

### Can I change the session timeout?
Currently 15 minutes is hardcoded. To customize, modify `src/lib/webinterface.js`:
```javascript
expiresIn: '30m'  // Change to desired timeout
```

### Should I enable TLS/HTTPS?
**Yes, for any non-local deployment**. Use a reverse proxy like nginx or traefik with Let's Encrypt SSL.

### How often should I rotate passwords?
Every 90 days for production environments. At minimum quarterly.

---

**Last Updated**: 2024
**Version**: 1.1.0+

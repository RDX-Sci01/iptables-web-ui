# Security Improvements Changelog

## Version 1.1.0 - Security Hardening Release

### Critical Security Fixes

#### 1. **XSS (Cross-Site Scripting) Vulnerabilities - FIXED**
**Previously Affected Files:**
- `www/js/index.js` - Inline onclick handlers with unescaped user data
- `www/js/conntrack.js` - innerHTML with unsanitized IDs
- `www/js/global.js` - Error messages with innerHTML

**Changes Made:**
- Removed all inline `onclick="functionName()"` event handlers
- Replaced with `.addEventListener()` for proper event delegation
- Added `escapeHtml()` utility function in global.js
- Replaced unsafe `innerHTML` usage with `textContent` for user-controlled data
- Created DOM elements dynamically instead of string concatenation
- Result: ✅ **XSS vulnerabilities eliminated**

**Example Fix:**
```javascript
// BEFORE (vulnerable):
html += `<div onclick="deleteEntry(${meta.id})">${meta.id}</div>`;
element.innerHTML = html;

// AFTER (secure):
const div = document.createElement('div');
div.textContent = meta.id;
div.addEventListener('click', () => deleteEntry(meta.id));
element.appendChild(div);
```

#### 2. **Weak Authentication - FIXED**
**Previously:**
- Passwords stored in plaintext (no hashing)
- Vulnerable to timing attacks
- JWT tokens expired after 30 days
- No rate limiting on login endpoint

**Changes Made:**
- Added `bcryptjs` for password hashing (10 salt rounds)
- Password hashed on application startup
- Implemented timing-safe `bcryptjs.compareSync()` instead of `===`
- Reduced JWT token expiration from 30 days to **15 minutes**
- Added rate limiting: max 10 login attempts per 15-minute window per IP
- Added 100ms delay to failed login responses
- Result: ✅ **Authentication hardened**

**Code Changes:**
```javascript
// Password hashing on startup
this.passwordHash = bcryptjs.hashSync(this.adminPassword, 10);

// Timing-safe comparison
if(bcryptjs.compareSync(password, this.passwordHash)) {
    const token = jwt.sign({}, this.jwtKey, { expiresIn: '15m' });
    return token;
}

// Rate limiting applied to login endpoint
this.app.post('/api/login', loginLimiter, (req, res) => {
    // ... login logic
});
```

#### 3. **Command Injection & Input Validation - FIXED**
**Previously:**
- No validation of table names (could be anything)
- Chain names not validated
- Policy values not validated (should only be: ACCEPT, DROP, REJECT, QUEUE)
- Numeric indices passed as-is without validation

**Changes Made:**
- Added `validateTableName()` - whitelist: filter, nat, mangle, raw, security
- Added `validateChainName()` - regex validation for iptables constraints (31 char max, alphanumeric+underscore+hyphen)
- Added `validatePolicy()` - whitelist for default policies
- Added `validateNumericId()` - ensures numeric values are positive integers
- Applied validation to ALL API endpoints
- Result: ✅ **Command injection vulnerabilities eliminated**

**Validation Examples:**
```javascript
validateTableName(table) {
    const validTables = ['filter', 'nat', 'mangle', 'raw', 'security'];
    return validTables.includes(table) ? true : false;
}

validateChainName(name) {
    if(!name || typeof name !== 'string') return false;
    if(name.length > 31 || name.length === 0) return false;
    return /^[a-zA-Z0-9_-]+$/.test(name);
}

validatePolicy(policy) {
    return ['ACCEPT', 'DROP', 'REJECT', 'QUEUE'].includes(policy);
}
```

#### 4. **URL Parameter Injection - FIXED**
**Previously:**
- Query parameters concatenated without URL encoding
- Special characters could break URL structure

**Changes Made:**
- Replaced manual query string concatenation with `new URLSearchParams()`
- Frontend now uses `encodeURIComponent()` for all user input in URLs
- Backend uses `new URLSearchParams()` for proper encoding
- Result: ✅ **URL parameter injection fixed**

#### 5. **Information Disclosure - FIXED**
**Previously:**
- Full error messages exposed to client (including file paths, system info)
- Error details in HTTP responses

**Changes Made:**
- Added `sanitizeError()` function - limits error messages to 100 characters
- Removes newlines and carriage returns
- Returns generic error JSON instead of raw error.message
- Result: ✅ **Information disclosure prevented**

### High Priority Fixes

#### 6. **Missing Security Headers - FIXED**
**Added via Helmet.js:**
- ✅ `X-Frame-Options: DENY` - Clickjacking protection
- ✅ `X-Content-Type-Options: nosniff` - MIME sniffing protection
- ✅ `Strict-Transport-Security` - HSTS (max-age: 1 year, includeSubDomains)
- ✅ `Content-Security-Policy` - Restricts inline scripts and external resources
- ✅ `X-XSS-Protection` - Legacy browser XSS protection

#### 7. **Insecure Cookie Flags - FIXED**
**Previously:**
- Cookies sent in plaintext over HTTP
- No HttpOnly flag
- No SameSite flag
- No Secure flag

**Changes Made:**
```javascript
res.cookie('token', token, {
    maxAge: 15 * 60 * 1000,    // 15 minutes
    httpOnly: true,             // Prevents JavaScript access
    secure: process.env.HTTPS === 'true',  // HTTPS only in production
    sameSite: 'Strict'          // Prevents cross-site requests
});
```

#### 8. **Container Security - FIXED**
**Dockerfile Changes:**
- Added non-root user (uid: 1000, gid: 1000)
- Set proper file permissions:
  - Application directory: 755
  - Data directory: 700 (owner-only)
  - Data files owned by nodeapp user
- Container no longer runs as root

**Result:** ✅ **Container hardened**

#### 9. **Plaintext Password Storage - FIXED**
**Previously:**
- Password visible in docker-compose.yml
- Password in environment variable accessible to all users

**Changes Made:**
- Created `.env.example` file as template
- Updated docker-compose.yml to use `.env` file via `env_file`
- Documented secure password generation: `openssl rand -base64 32`
- Set `.env` file permissions to 600 in recommendations
- Result: ✅ **Secrets management improved**

### Medium Priority Fixes

#### 10. **Frontend Parameter Encoding - FIXED**
**Changed all fetch() calls to use encoded parameters:**
```javascript
// BEFORE:
fetch(`/api/chain?name=${chainName}&table=${table}`)

// AFTER:
fetch(`/api/chain?name=${encodeParam(chainName)}&table=${encodeParam(table)}`)
```

#### 11. **Error Handling Improvements - FIXED**
- All API endpoints now return JSON error responses
- Changed from `.end(err.message)` to `.json({error: sanitizedMessage})`
- Consistent error handling across all endpoints

### Dependencies Added

```json
{
  "bcryptjs": "^2.4.3",              // Password hashing
  "express-rate-limit": "^7.1.5",    // Rate limiting for brute force protection
  "helmet": "^7.1.0"                 // Security headers
}
```

### Dependencies Removed

- `csurf` - Not needed (deprecated package)
- `cors` - Not needed (no cross-origin requests)

### Files Modified

#### Backend
- `src/lib/webinterface.js` - Complete security rewrite (450+ lines)

#### Frontend
- `www/js/global.js` - Added escapeHtml(), encodeParam() functions; fixed error handling
- `www/js/index.js` - Replaced innerHTML with DOM manipulation; added event listeners
- `www/js/conntrack.js` - Fixed XSS in table generation; removed onclick handlers

#### Configuration
- `package.json` - Added security dependencies
- `Dockerfile` - Added non-root user, proper permissions
- `docker-compose.yml` - Changed to use .env file, added resource limits
- `.env.example` - NEW - Template for secure configuration

#### Documentation
- `README.md` - Added security notice and HTTPS guidance
- `SECURITY.md` - NEW - Comprehensive security policy and best practices

### Testing Recommendations

1. **Authentication:**
   - Test login with correct password ✓
   - Test login with incorrect password ✓
   - Test rate limiting (10 attempts in 15 min) ✓
   - Test JWT expiration (15 minutes) ✓

2. **Input Validation:**
   - Try invalid table names
   - Try chain names with special characters
   - Try non-numeric indices
   - Verify all rejected with 400 status

3. **XSS:**
   - Try chain name with `<script>alert('xss')</script>`
   - Try rule with HTML/JavaScript
   - Verify escaping works

4. **Security Headers:**
   - Check response headers with curl:
     ```bash
     curl -i http://localhost:8585/login.html | grep -i "^x-\|^strict-transport\|^content-security"
     ```

### Migration Guide for Existing Deployments

**If upgrading from previous version:**

1. **Update docker-compose.yml:**
   - Create `.env` file with `WEBUI_PASSWORD=<your_password>`
   - Remove `WEBUI_PASSWORD` from environment section
   - Add `env_file: - .env`

2. **Regenerate secrets:**
   - JWT secret will be regenerated (users will be logged out)
   - Generate new password if desired

3. **No data migration needed:**
   - Existing firewall rules are unchanged
   - Configuration in `/app/data/` remains compatible

### Security Checklist

- ✅ Passwords hashed with bcrypt
- ✅ JWT tokens expire in 15 minutes
- ✅ Login rate limiting implemented
- ✅ All inputs validated
- ✅ XSS vulnerabilities fixed
- ✅ SQL/Command injection prevented
- ✅ Security headers enabled
- ✅ Cookies secure flags set
- ✅ Error messages sanitized
- ✅ Container runs as non-root
- ✅ File permissions hardened
- ✅ HTTPS recommended in docs

---

**Remaining Considerations:**
- Container requires NET_ADMIN capability (necessary for iptables)
- Application assumes local network deployment
- For internet exposure, use reverse proxy with TLS
- Monitor logs for failed login attempts
- Regularly update container image
- Use strong passwords (16+ characters recommended)

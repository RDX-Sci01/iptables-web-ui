const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const bcryptjs = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

class Webinterface {
    constructor(host, port, adminPassword, jwtKey, main) {
        this.host = host;
        this.port = port;
        this.adminPassword = adminPassword;
        this.jwtKey = jwtKey;
        this.main = main;
        this.passwordHash = null;

        if(this.adminPassword && !this.jwtKey) {
            this.jwtKey = this.generateRandomKey();
            console.warn('JWT secret is not set. Generating random key, this will lead to all users being logged out.');
        }
        
        // Hash password on startup if authentication is enabled
        if(this.adminPassword) {
            this.passwordHash = bcryptjs.hashSync(this.adminPassword, 10);
        }
    }

    // Input validation helper
    validateTableName(table) {
        const validTables = ['filter', 'nat', 'mangle', 'raw', 'security'];
        return validTables.includes(table) ? true : false;
    }

    validateChainName(name) {
        // iptables chain names: max 31 chars, alphanumeric, underscore, hyphen
        if(!name || typeof name !== 'string') return false;
        if(name.length > 31 || name.length === 0) return false;
        return /^[a-zA-Z0-9_-]+$/.test(name);
    }

    validatePolicy(policy) {
        return ['ACCEPT', 'DROP', 'REJECT', 'QUEUE'].includes(policy);
    }

    validateNumericId(value) {
        const num = parseInt(value);
        return !isNaN(num) && num > 0 ? num : null;
    }

    // Sanitize error messages - limit length and avoid info disclosure
    sanitizeError(error) {
        let message = error.message || String(error);
        // Only return first 100 characters to avoid info disclosure
        return message.substring(0, 100).replace(/[\n\r]/g, ' ');
    }

    start() {
        this.app = express();

        // Security middleware - apply helmet for security headers
        this.app.use(helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    scriptSrc: ["'self'", "'unsafe-inline'"],
                    styleSrc: ["'self'", "'unsafe-inline'"],
                    imgSrc: ["'self'", "data:"]
                }
            },
            hsts: {
                maxAge: 31536000,
                includeSubDomains: true,
                preload: true
            }
        }));

        this.app.use(express.json());
        this.app.use(cookieParser());

        // Rate limiting for login attempts
        const loginLimiter = rateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 10, // Limit each IP to 10 requests per windowMs
            message: 'Too many login attempts, please try again later',
            standardHeaders: true,
            legacyHeaders: false,
        });

        // Authentication middleware
        this.app.use((req, res, next) => {
            const queryParams = Object.keys(req.query);
            req.rawQuery = queryParams.length != 0 ? '?' + new URLSearchParams(req.query).toString() : '';

            if(!this.adminPassword) {
                // redirect away from login page if authentication disabled
                if(req.path == '/login.html') {
                    res.redirect('/' + req.rawQuery);
                    return;
                }
            } else {
                if(req.path == '/api/login') {
                    // allow login requests
                    next();
                    return;
                }

                let loggedIn = false;
                const token = req.cookies.token;
                if(token) loggedIn = this.checkToken(token);

                if(req.path.startsWith('/api/')) {
                    // require login for api requests
                    if(!loggedIn) {
                        res.status(401).end();
                        return;
                    }
                } else if(req.path == '/login.html') {
                    // redirect away from login page if already logged in
                    if(loggedIn) {
                        res.redirect('/' + req.rawQuery);
                        return;
                    }
                } else if(req.path == '/' || req.path.endsWith('.html')) {
                    // require login for all other pages
                    if(!loggedIn) {
                        res.redirect('/login.html' + req.rawQuery);
                        return;
                    }
                }
            }
            next();
        });

        this.app.use(express.static('./www'));

        // Chains
        this.app.get('/api/chain', async (req, res) => {
            try {
                // Validate input
                if(!req.query.table || !this.validateTableName(req.query.table)) {
                    res.status(400).json({error: 'Invalid table'});
                    return;
                }
                
                const chainId = this.getChainId(req.query.ip6, req.query.table, '');
                const chains = await this.main.iptables.listChains(req.query.table, req.query.ip6 == 'true');
                chains.forEach(chain => chain.dynamic = this.main.data.dynamicChains.includes(chainId+chain.name));
                res.json({ defaultChain: this.main.config.defaultChain, chains: chains });
            } catch(err) {
                res.status(500).json({error: this.sanitizeError(err)});
            }
        });

        this.app.put('/api/chain', async (req, res) => {
            try {
                if(!req.query.name || !this.validateChainName(req.query.name)) {
                    res.status(400).json({error: 'Invalid chain name'});
                    return;
                }
                if(!req.query.table || !this.validateTableName(req.query.table)) {
                    res.status(400).json({error: 'Invalid table'});
                    return;
                }
                
                await this.main.iptables.addChain(req.query.name, req.query.table, req.query.ip6 == 'true');
                res.end();
            } catch(err) {
                res.status(500).json({error: this.sanitizeError(err)});
            }
        });

        this.app.delete('/api/chain', async (req, res) => {
            try {
                if(!req.query.name || !this.validateChainName(req.query.name)) {
                    res.status(400).json({error: 'Invalid chain name'});
                    return;
                }
                if(!req.query.table || !this.validateTableName(req.query.table)) {
                    res.status(400).json({error: 'Invalid table'});
                    return;
                }
                
                await this.main.iptables.deleteChain(req.query.name, req.query.table, req.query.ip6 == 'true');
                res.end();
            } catch(err) {
                res.status(500).json({error: this.sanitizeError(err)});
            }
        });

        this.app.post('/api/chain', async (req, res) => {
            try {
                if(!req.query.action || !req.query.name) {
                    res.status(400).json({error: 'Missing parameters'});
                    return;
                }
                if(!this.validateChainName(req.query.name)) {
                    res.status(400).json({error: 'Invalid chain name'});
                    return;
                }
                if(!req.query.table || !this.validateTableName(req.query.table)) {
                    res.status(400).json({error: 'Invalid table'});
                    return;
                }

                switch(req.query.action) {
                    case 'rename':
                        if(!req.query.newName || !this.validateChainName(req.query.newName)) {
                            res.status(400).json({error: 'Invalid new chain name'});
                            return;
                        }
                        await this.main.iptables.renameChain(req.query.name, req.query.newName, req.query.table, req.query.ip6 == 'true');
                        res.end();
                        break;
                    case 'setDefaultPolicy':
                        if(!req.query.policy || !this.validatePolicy(req.query.policy)) {
                            res.status(400).json({error: 'Invalid policy'});
                            return;
                        }
                        await this.main.iptables.setDefaultPolicy(req.query.name, req.query.policy, req.query.table, req.query.ip6 == 'true');
                        res.end();
                        break;
                    case 'setDynamic':
                        const chainId = this.getChainId(req.query.ip6, req.query.table, req.query.name);
                        if(req.query.dynamic == 'true') {
                            if(!this.main.data.dynamicChains.includes(chainId)) {
                                this.main.data.dynamicChains.push(chainId);
                                this.main.saveData();
                            }
                            res.end();
                        } else if(req.query.dynamic == 'false') {
                            if(this.main.data.dynamicChains.includes(chainId)) {
                                this.main.data.dynamicChains = this.main.data.dynamicChains.filter(id => id != chainId);
                                this.main.saveData();
                            }
                            res.end();
                        } else {
                            res.status(400).json({error: 'Invalid dynamic value'});
                        }
                        break;
                    default:
                        res.status(400).json({error: 'Unknown action'});
                }
            } catch(err) {
                res.status(500).json({error: this.sanitizeError(err)});
            }
        });

        // Rules
        this.app.get('/api/rules', async (req, res) => {
            try {
                if(!req.query.chain || !this.validateChainName(req.query.chain)) {
                    res.status(400).json({error: 'Invalid chain name'});
                    return;
                }
                if(!req.query.table || !this.validateTableName(req.query.table)) {
                    res.status(400).json({error: 'Invalid table'});
                    return;
                }

                const chains = await this.main.iptables.listRules(req.query.chain, req.query.table, req.query.ip6 == 'true');
                res.json(chains);
            } catch(err) {
                res.status(500).json({error: this.sanitizeError(err)});
            }
        });

        this.app.put('/api/rules', async (req, res) => {
            try {
                if(!req.query.chain || !this.validateChainName(req.query.chain)) {
                    res.status(400).json({error: 'Invalid chain name'});
                    return;
                }
                if(!req.query.table || !this.validateTableName(req.query.table)) {
                    res.status(400).json({error: 'Invalid table'});
                    return;
                }
                if(!req.body.rule) {
                    res.status(400).json({error: 'Missing rule'});
                    return;
                }

                if(req.query.index) {
                    const index = this.validateNumericId(req.query.index);
                    if(!index) {
                        res.status(400).json({error: 'Invalid index'});
                        return;
                    }
                    await this.main.iptables.insertRule(req.query.chain, index, req.body.rule, req.query.table, req.query.ip6 == 'true');
                } else {
                    await this.main.iptables.addRule(req.query.chain, req.body.rule, req.query.table, req.query.ip6 == 'true');
                }
                res.end();
            } catch(err) {
                res.status(500).json({error: this.sanitizeError(err)});
            }
        });

        this.app.delete('/api/rules', async (req, res) => {
            try {
                if(!req.query.chain || !this.validateChainName(req.query.chain)) {
                    res.status(400).json({error: 'Invalid chain name'});
                    return;
                }
                if(!req.query.table || !this.validateTableName(req.query.table)) {
                    res.status(400).json({error: 'Invalid table'});
                    return;
                }
                if(!req.query.index) {
                    res.status(400).json({error: 'Missing index'});
                    return;
                }

                const index = this.validateNumericId(req.query.index);
                if(!index) {
                    res.status(400).json({error: 'Invalid index'});
                    return;
                }

                await this.main.iptables.deleteRule(req.query.chain, index, req.query.table, req.query.ip6 == 'true');
                res.end();
            } catch(err) {
                res.status(500).json({error: this.sanitizeError(err)});
            }
        });

        this.app.post('/api/rules', async (req, res) => {
            try {
                if(!req.query.chain || !this.validateChainName(req.query.chain)) {
                    res.status(400).json({error: 'Invalid chain name'});
                    return;
                }
                if(!req.query.table || !this.validateTableName(req.query.table)) {
                    res.status(400).json({error: 'Invalid table'});
                    return;
                }
                if(!req.query.index) {
                    res.status(400).json({error: 'Missing index'});
                    return;
                }
                if(!req.query.action) {
                    res.status(400).json({error: 'Missing action'});
                    return;
                }

                const index = this.validateNumericId(req.query.index);
                if(!index) {
                    res.status(400).json({error: 'Invalid index'});
                    return;
                }

                switch(req.query.action) {
                    case 'edit':
                        if(!req.body.rule) {
                            res.status(400).json({error: 'Missing rule'});
                            return;
                        }
                        await this.main.iptables.editRule(req.query.chain, index, req.body.rule, req.query.table, req.query.ip6 == 'true');
                        res.end();
                        break;
                    case 'move':
                        if(!req.query.newIndex) {
                            res.status(400).json({error: 'Missing newIndex'});
                            return;
                        }
                        const newIndex = this.validateNumericId(req.query.newIndex);
                        if(!newIndex) {
                            res.status(400).json({error: 'Invalid newIndex'});
                            return;
                        }
                        await this.main.iptables.moveRule(req.query.chain, index, newIndex, req.query.table, req.query.ip6 == 'true');
                        res.end();
                        break;
                    default:
                        res.status(400).json({error: 'Unknown action'});
                }
            } catch(err) {
                res.status(500).json({error: this.sanitizeError(err)});
            }
        });

        // Save & restore
        this.app.post('/api/save', async (req, res) => {
            try {
                await this.main.iptables.saveRules(this.main.data.dynamicChains);
                res.end();
            } catch(err) {
                res.status(500).json({error: this.sanitizeError(err)});
            }
        });

        this.app.post('/api/restore', async (req, res) => {
            try {
                await this.main.iptables.restoreRules(this.main.config.flushOnRestore);
                res.end();
            } catch(err) {
                res.status(500).json({error: this.sanitizeError(err)});
            }
        });

        // Conntrack
        this.app.get('/api/conntrack', async (req, res) => {
            try {
                const entries = await this.main.conntrack.listEntries();
                res.set('Content-Type', 'application/xml');
                res.end(entries);
            } catch(err) {
                res.status(500).json({error: this.sanitizeError(err)});
            }
        });

        this.app.delete('/api/conntrack', async (req, res) => {
            try {
                if(req.query.id) {
                    // Validate ID is numeric
                    const id = this.validateNumericId(req.query.id);
                    if(!id) {
                        res.status(400).json({error: 'Invalid ID'});
                        return;
                    }
                    await this.main.conntrack.deleteEntry(id);
                    res.end();
                } else if(req.query.flush) {
                    await this.main.conntrack.flushTable();
                    res.end();
                } else {
                    res.status(400).json({error: 'Missing id or flush parameter'});
                }
            } catch(err) {
                res.status(500).json({error: this.sanitizeError(err)});
            }
        });

        // Login with rate limiting
        this.app.post('/api/login', loginLimiter, (req, res) => {
            try {
                const data = req.body;
                if(!data.password || typeof data.password !== 'string') {
                    res.status(400).json({success: false});
                    return;
                }

                const token = this.loginUser(data.password);
                if(token) {
                    res.cookie('token', token, {
                        maxAge: 15 * 60 * 1000, // 15 minutes
                        httpOnly: true,
                        secure: process.env.HTTPS === 'true', // Only send over HTTPS in production
                        sameSite: 'Strict'
                    }).json({success: true});
                } else {
                    // Delay response to slow brute force attacks (constant time)
                    setTimeout(() => {
                        res.json({success: false});
                    }, 100);
                }
            } catch(err) {
                res.status(500).json({success: false});
            }
        });

        this.app.post('/api/logout', (req, res) => {
            res.clearCookie('token').end();
        });

        this.app.listen(this.port, this.host, () => {
            console.log('Started webinterface on port '+this.port);
        });
    }

    generateRandomKey() {
        return crypto.randomBytes(30).toString('hex');
    }

    loginUser(password) {
        if(!this.passwordHash) return false;
        
        try {
            // Use bcryptjs for timing-safe comparison
            if(bcryptjs.compareSync(password, this.passwordHash)) {
                const token = jwt.sign({}, this.jwtKey, {
                    expiresIn: '15m' // 15 minutes - much more secure than 30 days
                });
                return token;
            }
            return false;
        } catch(err) {
            console.error('Login error:', err);
            return false;
        }
    }

    checkToken(token) {
        try {
            jwt.verify(token, this.jwtKey);
            return true;
        } catch(err) {
            return false;
        }
    }

    getChainId(ipv6, table, chain) {
        return `${ipv6 == 'true'}-${table || 'filter'}-${chain}`;
    }
}

module.exports = Webinterface;

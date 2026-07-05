const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const loginHtmlPath = path.join(__dirname, '..', 'www', 'login.html');
const loginJsPath = path.join(__dirname, '..', 'www', 'js', 'login.js');

test('login page uses relative paths for assets and auth requests', () => {
    const loginHtml = fs.readFileSync(loginHtmlPath, 'utf8');
    const loginJs = fs.readFileSync(loginJsPath, 'utf8');

    assert.match(loginHtml, /href="\.\/css\/bootstrap\.min\.css"/);
    assert.match(loginHtml, /href="\.\/css\/login\.css"/);
    assert.match(loginHtml, /src="\.\/img\/icon\.png"/);
    assert.match(loginHtml, /src="\.\/js\/login\.js"/);

    assert.doesNotMatch(loginJs, /fetch\('\/api\/login'/);
    assert.doesNotMatch(loginJs, /window\.location\.replace\('\/' \+ window\.location\.search\)/);
    assert.match(loginJs, /new URL\('\.\/api\/login'/);
    assert.match(loginJs, /window\.location\.replace\(returnUrl\.toString\(\)\)/);
});

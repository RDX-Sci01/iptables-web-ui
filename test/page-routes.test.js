const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const indexHtmlPath = path.join(__dirname, '..', 'www', 'index.html');
const conntrackHtmlPath = path.join(__dirname, '..', 'www', 'conntrack.html');
const indexJsPath = path.join(__dirname, '..', 'www', 'js', 'index.js');
const conntrackJsPath = path.join(__dirname, '..', 'www', 'js', 'conntrack.js');

test('rule and conntrack pages use relative assets and API endpoints', () => {
    const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
    const conntrackHtml = fs.readFileSync(conntrackHtmlPath, 'utf8');
    const indexJs = fs.readFileSync(indexJsPath, 'utf8');
    const conntrackJs = fs.readFileSync(conntrackJsPath, 'utf8');

    assert.match(indexHtml, /href="\.\/img\/icon\.png"/);
    assert.match(indexHtml, /href="\.\/conntrack\.html"/);
    assert.match(indexHtml, /src="\.\/js\/index\.js"/);

    assert.match(conntrackHtml, /href="\.\/index\.html"/);
    assert.match(conntrackHtml, /src="\.\/js\/conntrack\.js"/);

    assert.match(indexJs, /new URL\('\.\/api\//);
    assert.match(indexJs, /window\.location\.replace\(.*login\.html/);
    assert.match(conntrackJs, /new URL\('\.\/api\//);
    assert.match(conntrackJs, /window\.location\.replace\(.*login\.html/);
});

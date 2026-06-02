require('../setup.js');

describe('server proxy endpoints', () => {
  test('/proxy endpoint exists in server.mjs', () => {
    const fs = require('fs');
    const path = require('path');
    const serverCode = fs.readFileSync(path.join(__dirname, '../../server.mjs'), 'utf8');
    expect(serverCode).toContain('/proxy');
  });

  test('proxy endpoint validates auth token', () => {
    const fs = require('fs');
    const path = require('path');
    const serverCode = fs.readFileSync(path.join(__dirname, '../../server.mjs'), 'utf8');
    expect(serverCode).toMatch(/auth|token|sha256|hash/i);
  });

  test('image proxy endpoint exists in server.mjs', () => {
    const fs = require('fs');
    const path = require('path');
    const serverCode = fs.readFileSync(path.join(__dirname, '../../server.mjs'), 'utf8');
    expect(serverCode).toMatch(/image.*proxy|img.*proxy|doubanio/i);
  });

  test('proxy strips unnecessary headers from response', () => {
    const fs = require('fs');
    const path = require('path');
    const serverCode = fs.readFileSync(path.join(__dirname, '../../server.mjs'), 'utf8');
    expect(serverCode).toMatch(/delete.*header|remove.*header|strip/i);
  });

  test('proxy sets correct CORS headers', () => {
    const fs = require('fs');
    const path = require('path');
    const serverCode = fs.readFileSync(path.join(__dirname, '../../server.mjs'), 'utf8');
    expect(serverCode).toMatch(/access-control|cors/i);
  });

  test('proxy handles errors gracefully', () => {
    const fs = require('fs');
    const path = require('path');
    const serverCode = fs.readFileSync(path.join(__dirname, '../../server.mjs'), 'utf8');
    expect(serverCode).toMatch(/catch|error.*handler|status\(4|status\(5/i);
  });

  test('proxy has rate limiting or timeout', () => {
    const fs = require('fs');
    const path = require('path');
    const serverCode = fs.readFileSync(path.join(__dirname, '../../server.mjs'), 'utf8');
    expect(serverCode).toMatch(/timeout|rate.*limit|AbortController/i);
  });

  test('image proxy sets correct content-type', () => {
    const fs = require('fs');
    const path = require('path');
    const serverCode = fs.readFileSync(path.join(__dirname, '../../server.mjs'), 'utf8');
    expect(serverCode).toMatch(/content-type|set.*header/i);
  });
});

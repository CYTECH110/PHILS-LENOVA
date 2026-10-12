const test = require('node:test');
const assert = require('node:assert');
const pool = require('../src/config/database');
const app = require('../src/app');

// We need a helper to get an admin cookie and csrf token for mutating requests
// But since we just want to test if the new endpoints work, let's create a minimal integration test.

test('Admin users API exists', async (t) => {
  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  try {
    // We expect a 401 without auth, which proves the route is mounted
    const resList = await fetch(`${baseUrl}/api/admin/users`);
    assert.strictEqual(resList.status, 401);

    const resUpdate = await fetch(`${baseUrl}/api/admin/users/1`, { method: 'PUT' });
    assert.strictEqual(resUpdate.status, 403); // CSRF block

    const resDelete = await fetch(`${baseUrl}/api/admin/users/1`, { method: 'DELETE' });
    assert.strictEqual(resDelete.status, 403); // CSRF block
  } finally {
    server.close();
    await pool.end();
  }
});

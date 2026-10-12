const test = require('node:test');
const assert = require('node:assert');
const {
  sendEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  buildResetLink,
  setEmailTransport
} = require('../src/services/email.service');

function capture() {
  const messages = [];
  setEmailTransport({
    sendMail: async (message) => {
      messages.push(message);
      return { messageId: `captured-${messages.length}` };
    }
  });
  return messages;
}

test.afterEach(() => setEmailTransport(null));

test('sendEmail delivers to a recipient via the injected transport', async () => {
  const messages = capture();
  const info = await sendEmail({ to: 'student@example.com', subject: 'Hi', text: 'Body' });
  assert.equal(messages.length, 1);
  assert.equal(messages[0].to, 'student@example.com');
  assert.equal(messages[0].subject, 'Hi');
  assert.ok(messages[0].from, 'message carries a From header');
  assert.equal(info.messageId, 'captured-1');
});

test('sendEmail with no recipient is skipped, not thrown', async () => {
  const messages = capture();
  const info = await sendEmail({ to: '', subject: 'Hi', text: 'Body' });
  assert.equal(info, null);
  assert.equal(messages.length, 0);
});

test('sendEmail swallows transport failures (never throws)', async () => {
  setEmailTransport({ sendMail: async () => { throw new Error('smtp down'); } });
  const info = await sendEmail({ to: 'student@example.com', subject: 'Hi' });
  assert.equal(info, null);
});

test('welcome email goes to the real email column and is skipped when absent', async () => {
  const messages = capture();
  await sendWelcomeEmail({ username: 's1', full_name: 'Sam Student', role: 'STUDENT', email: 'sam@example.com' });
  assert.equal(messages.length, 1);
  assert.equal(messages[0].to, 'sam@example.com');
  assert.match(messages[0].text, /Sam Student/);

  const skipped = await sendWelcomeEmail({ username: 'n1', full_name: 'No Email', role: 'STUDENT', email: null });
  assert.equal(skipped, null);
  assert.equal(messages.length, 1, 'no new message for a user without email');
});

test('password reset email contains the APP_BASE_URL reset link with the token', async () => {
  const messages = capture();
  const token = 'a'.repeat(64);
  await sendPasswordResetEmail({ id: 7, username: 'u1', full_name: 'User One', email: 'u1@example.com' }, token);
  assert.equal(messages.length, 1);
  assert.equal(messages[0].to, 'u1@example.com');
  const link = buildResetLink(token);
  assert.match(link, /\/reset-password\?token=/);
  assert.ok(messages[0].text.includes(link), 'text body carries the link');
  assert.ok(messages[0].html.includes('reset-password?token='), 'html body carries the link');
});

test('password reset email is skipped when the user has no email', async () => {
  const messages = capture();
  const info = await sendPasswordResetEmail({ id: 8, username: 'u2', email: null }, 'token');
  assert.equal(info, null);
  assert.equal(messages.length, 0);
});

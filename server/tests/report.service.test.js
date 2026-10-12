const test = require('node:test');
const assert = require('node:assert');
const {
  MAX_REPORT_ROWS,
  ATTEMPT_COLUMNS,
  summarizeByQuiz,
  summarizeByStudent,
  toCsv,
  buildXlsxBuffer,
  buildPdfBuffer
} = require('../src/services/report.service');

test('row cap is a finite positive integer', () => {
  assert.ok(Number.isInteger(MAX_REPORT_ROWS) && MAX_REPORT_ROWS > 0);
  assert.equal(MAX_REPORT_ROWS, 5000);
});

test('summarizeByQuiz aggregates attempts, average, best and pass rate', () => {
  const rows = summarizeByQuiz([
    { quiz_id: 1, quiz_title: 'Quiz A', course_name: 'C', status: 'SUBMITTED', score: 4, passed: 1 },
    { quiz_id: 1, quiz_title: 'Quiz A', course_name: 'C', status: 'SUBMITTED', score: 2, passed: 0 },
    { quiz_id: 1, quiz_title: 'Quiz A', course_name: 'C', status: 'IN_PROGRESS', score: null, passed: 0 }
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].attempts, 3);
  assert.equal(rows[0].submitted, 2);
  assert.equal(rows[0].average, 3);
  assert.equal(rows[0].best, 4);
  assert.equal(rows[0].pass_rate, 50);
});

test('summarizeByStudent groups by username', () => {
  const rows = summarizeByStudent([
    { student_name: 'Sam', username: 'sam', status: 'SUBMITTED', score: 5, passed: 1 },
    { student_name: 'Sam', username: 'sam', status: 'SUBMITTED', score: 3, passed: 0 },
    { student_name: 'Pat', username: 'pat', status: 'SUBMITTED', score: 1, passed: 0 }
  ]);
  const sam = rows.find((row) => row.username === 'sam');
  assert.equal(sam.attempts, 2);
  assert.equal(sam.average, 4);
  assert.equal(sam.best, 5);
  assert.equal(sam.passed, 1);
});

test('toCsv quotes and escapes cells', () => {
  const columns = [{ header: 'Name', key: 'name' }, { header: 'Note', key: 'note' }];
  const csv = toCsv(columns, [{ name: 'A "quoted", value', note: 'x\ny' }]);
  assert.ok(csv.startsWith('"Name","Note"\n'));
  assert.ok(csv.includes('"A ""quoted"", value"'));
});

test('buildXlsxBuffer returns an xlsx (zip) buffer', async () => {
  const buffer = await buildXlsxBuffer({
    sheetName: 'Attempts',
    columns: [{ header: 'A', key: 'a', width: 10 }],
    rows: [{ a: 1 }, { a: 2 }]
  });
  assert.ok(Buffer.isBuffer(buffer));
  assert.equal(buffer.slice(0, 2).toString('latin1'), 'PK');
});

test('buildPdfBuffer returns a PDF document', async () => {
  const buffer = await buildPdfBuffer({
    title: 'Report',
    subtitle: '1 row',
    columns: [{ header: 'A', key: 'a', width: 10 }],
    rows: [{ a: 'x' }]
  });
  assert.ok(buffer.length > 0);
  assert.equal(buffer.slice(0, 5).toString('latin1'), '%PDF-');
});

test('attempt columns include the expected headers', () => {
  const headers = ATTEMPT_COLUMNS.map((column) => column.header);
  assert.ok(headers.includes('Student'));
  assert.ok(headers.includes('Submitted At'));
});

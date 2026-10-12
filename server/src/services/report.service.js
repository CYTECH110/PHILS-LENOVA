const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const pool = require('../config/database');

// Hard cap on exported rows so a report can never load an unbounded result set.
const MAX_REPORT_ROWS = 5000;

const ATTEMPT_COLUMNS = [
  { header: 'Attempt', key: 'id', width: 10 },
  { header: 'Student', key: 'student', width: 24 },
  { header: 'Username', key: 'username', width: 18 },
  { header: 'Quiz', key: 'quiz', width: 28 },
  { header: 'Course', key: 'course', width: 24 },
  { header: 'Score', key: 'score', width: 10 },
  { header: 'Status', key: 'status', width: 14 },
  { header: 'Passed', key: 'passed', width: 10 },
  { header: 'Started At', key: 'started_at', width: 20 },
  { header: 'Submitted At', key: 'submitted_at', width: 20 }
];

const QUIZ_SUMMARY_COLUMNS = [
  { header: 'Quiz', key: 'quiz', width: 30 },
  { header: 'Course', key: 'course', width: 24 },
  { header: 'Attempts', key: 'attempts', width: 12 },
  { header: 'Submitted', key: 'submitted', width: 12 },
  { header: 'Average Score', key: 'average', width: 14 },
  { header: 'Best Score', key: 'best', width: 12 },
  { header: 'Pass Rate (%)', key: 'pass_rate', width: 14 }
];

const STUDENT_SUMMARY_COLUMNS = [
  { header: 'Student', key: 'student', width: 26 },
  { header: 'Username', key: 'username', width: 18 },
  { header: 'Attempts', key: 'attempts', width: 12 },
  { header: 'Submitted', key: 'submitted', width: 12 },
  { header: 'Average Score', key: 'average', width: 14 },
  { header: 'Best Score', key: 'best', width: 12 },
  { header: 'Passed', key: 'passed', width: 10 }
];

function pad(value) {
  return String(value).padStart(2, '0');
}

function formatDateTime(value) {
  if (value === null || value === undefined || value === '') return '';
  const date = value instanceof Date ? value : new Date(String(value).replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return String(value);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

function displayScore(value) {
  if (value === null || value === undefined || value === '') return '';
  const number = Number(value);
  return Number.isFinite(number) ? round2(number) : String(value);
}

async function fetchAttempts({ teacherId = null } = {}) {
  const params = [];
  let sql = `SELECT a.id, u.full_name AS student_name, u.username, q.id AS quiz_id, q.title AS quiz_title,
                    c.name AS course_name, a.score, a.status, a.passed, a.started_at, a.submitted_at
             FROM quiz_attempts a
             JOIN users u ON u.id = a.student_id
             JOIN quizzes q ON q.id = a.quiz_id
             JOIN courses c ON c.id = q.course_id`;
  if (teacherId) {
    sql += ' WHERE q.creator_id = ?';
    params.push(teacherId);
  }
  sql += ' ORDER BY a.submitted_at IS NULL, a.submitted_at DESC, a.id DESC LIMIT ?';
  params.push(MAX_REPORT_ROWS + 1);

  const [rows] = await pool.execute(sql, params);
  const truncated = rows.length > MAX_REPORT_ROWS;
  return { rows: truncated ? rows.slice(0, MAX_REPORT_ROWS) : rows, truncated };
}

function toAttemptRows(rows) {
  return rows.map((row) => ({
    id: row.id,
    student: row.student_name,
    username: row.username,
    quiz: row.quiz_title,
    course: row.course_name,
    score: displayScore(row.score),
    status: row.status,
    passed: row.passed ? 'Yes' : 'No',
    started_at: formatDateTime(row.started_at),
    submitted_at: formatDateTime(row.submitted_at)
  }));
}

function summarizeByQuiz(rows) {
  const groups = new Map();
  for (const row of rows) {
    if (!groups.has(row.quiz_id)) {
      groups.set(row.quiz_id, { quiz: row.quiz_title, course: row.course_name, attempts: 0, submitted: 0, scored: 0, sum: 0, best: null, passed: 0 });
    }
    const group = groups.get(row.quiz_id);
    group.attempts += 1;
    if (row.status === 'SUBMITTED') {
      group.submitted += 1;
      if (row.score !== null && row.score !== undefined) {
        const score = Number(row.score);
        group.scored += 1;
        group.sum += score;
        group.best = group.best === null ? score : Math.max(group.best, score);
        if (row.passed) group.passed += 1;
      }
    }
  }
  return [...groups.values()].map((group) => ({
    quiz: group.quiz,
    course: group.course,
    attempts: group.attempts,
    submitted: group.submitted,
    average: group.scored ? round2(group.sum / group.scored) : '',
    best: group.best === null ? '' : round2(group.best),
    pass_rate: group.submitted ? round2((group.passed / group.submitted) * 100) : ''
  }));
}

function summarizeByStudent(rows) {
  const groups = new Map();
  for (const row of rows) {
    if (!groups.has(row.username)) {
      groups.set(row.username, { student: row.student_name, username: row.username, attempts: 0, submitted: 0, scored: 0, sum: 0, best: null, passed: 0 });
    }
    const group = groups.get(row.username);
    group.attempts += 1;
    if (row.status === 'SUBMITTED') {
      group.submitted += 1;
      if (row.score !== null && row.score !== undefined) {
        const score = Number(row.score);
        group.scored += 1;
        group.sum += score;
        group.best = group.best === null ? score : Math.max(group.best, score);
        if (row.passed) group.passed += 1;
      }
    }
  }
  return [...groups.values()].map((group) => ({
    student: group.student,
    username: group.username,
    attempts: group.attempts,
    submitted: group.submitted,
    average: group.scored ? round2(group.sum / group.scored) : '',
    best: group.best === null ? '' : round2(group.best),
    passed: group.passed
  }));
}

async function buildAttemptsReport({ teacherId = null } = {}) {
  const { rows, truncated } = await fetchAttempts({ teacherId });
  return {
    columns: ATTEMPT_COLUMNS,
    rows: toAttemptRows(rows),
    subtitle: `${rows.length} attempt row(s)${truncated ? ` (truncated at ${MAX_REPORT_ROWS})` : ''}`,
    truncated
  };
}

async function buildQuizSummaryReport({ teacherId = null } = {}) {
  const { rows, truncated } = await fetchAttempts({ teacherId });
  const summary = summarizeByQuiz(rows);
  return {
    columns: QUIZ_SUMMARY_COLUMNS,
    rows: summary,
    subtitle: `${summary.length} quiz(ies)${truncated ? ` (from first ${MAX_REPORT_ROWS} attempts)` : ''}`,
    truncated
  };
}

async function buildStudentSummaryReport({ teacherId = null } = {}) {
  const { rows, truncated } = await fetchAttempts({ teacherId });
  const summary = summarizeByStudent(rows);
  return {
    columns: STUDENT_SUMMARY_COLUMNS,
    rows: summary,
    subtitle: `${summary.length} student(s)${truncated ? ` (from first ${MAX_REPORT_ROWS} attempts)` : ''}`,
    truncated
  };
}

function csvCell(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

function csvHeader(columns) {
  return `${columns.map((column) => csvCell(column.header)).join(',')}\n`;
}

function csvRow(columns, row) {
  return `${columns.map((column) => csvCell(row[column.key])).join(',')}\n`;
}

function toCsv(columns, rows) {
  return csvHeader(columns) + rows.map((row) => csvRow(columns, row)).join('');
}

async function buildXlsxBuffer({ sheetName = 'Report', columns, rows }) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'PHILS LEARNOVA';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet(sheetName);
  worksheet.columns = columns.map((column) => ({ header: column.header, key: column.key, width: column.width || 18 }));
  for (const row of rows) worksheet.addRow(row);
  worksheet.getRow(1).font = { bold: true };
  worksheet.views = [{ state: 'frozen', ySplit: 1 }];

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

function renderPdf(doc, { title, subtitle, columns, rows }) {
  const margin = doc.page.margins.left;
  const usable = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const totalWeight = columns.reduce((sum, column) => sum + (column.width || 16), 0);
  const widths = columns.map((column) => ((column.width || 16) / totalWeight) * usable);

  doc.font('Helvetica-Bold').fontSize(16).fillColor('#111827').text(title, margin, doc.page.margins.top);
  if (subtitle) doc.font('Helvetica').fontSize(9).fillColor('#6b7280').text(subtitle, margin, doc.y + 2);
  doc.moveDown(0.8);

  const drawHeader = () => {
    const y = doc.y;
    doc.rect(margin, y, doc.page.width - doc.page.margins.left - doc.page.margins.right, 18).fill('#f1f5f9');
    doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(9);
    let x = margin;
    columns.forEach((column, index) => {
      doc.text(String(column.header), x + 3, y + 5, { width: widths[index] - 6, height: 11, ellipsis: true });
      x += widths[index];
    });
    doc.y = y + 18;
    doc.fillColor('#111827').font('Helvetica').fontSize(8.5);
  };

  drawHeader();
  for (const row of rows) {
    if (doc.y + 16 > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      drawHeader();
    }
    const y = doc.y;
    let x = margin;
    columns.forEach((column, index) => {
      const value = row[column.key];
      doc.text(value === null || value === undefined ? '' : String(value), x + 3, y + 4, { width: widths[index] - 6, height: 11, ellipsis: true });
      x += widths[index];
    });
    doc.y = y + 16;
  }

  doc.fontSize(8).fillColor('#6b7280').text(`Rows: ${rows.length}`, margin, doc.y + 6);
}

function buildPdfBuffer({ title, subtitle, columns, rows }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 32 });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    try {
      renderPdf(doc, { title, subtitle, columns, rows });
    } catch (error) {
      reject(error);
      return;
    }
    doc.end();
  });
}

module.exports = {
  MAX_REPORT_ROWS,
  ATTEMPT_COLUMNS,
  QUIZ_SUMMARY_COLUMNS,
  STUDENT_SUMMARY_COLUMNS,
  fetchAttempts,
  toAttemptRows,
  summarizeByQuiz,
  summarizeByStudent,
  buildAttemptsReport,
  buildQuizSummaryReport,
  buildStudentSummaryReport,
  csvHeader,
  csvRow,
  toCsv,
  buildXlsxBuffer,
  buildPdfBuffer
};

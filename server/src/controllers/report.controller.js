const service = require('../services/report.service');

const REPORT_CONFIG = {
  attempts: {
    title: 'Quiz Attempts',
    sheet: 'Attempts',
    filename: 'learnova-attempts',
    build: service.buildAttemptsReport
  },
  quizzes: {
    title: 'Quiz Summary',
    sheet: 'Quiz Summary',
    filename: 'learnova-quiz-summary',
    build: service.buildQuizSummaryReport
  },
  students: {
    title: 'Student Summary',
    sheet: 'Student Summary',
    filename: 'learnova-student-summary',
    build: service.buildStudentSummaryReport
  }
};

const FORMATS = {
  csv: { contentType: 'text/csv; charset=utf-8' },
  xlsx: { contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  pdf: { contentType: 'application/pdf' }
};

function reportScope(request) {
  // Admins see everything; teachers are limited to quizzes they created.
  return request.user.role === 'TEACHER' ? request.user.sub : null;
}

function filename(config, format) {
  const stamp = new Date().toISOString().slice(0, 10);
  return `${config.filename}-${stamp}.${format}`;
}

function setDownloadHeaders(response, config, format, truncated) {
  response.setHeader('Content-Type', FORMATS[format].contentType);
  response.setHeader('Content-Disposition', `attachment; filename="${filename(config, format)}"`);
  response.setHeader('Cache-Control', 'no-store');
  if (truncated) response.setHeader('X-Report-Truncated', 'true');
}

// Factory so the route table stays declarative and format handling lives in one place.
function download(report, format) {
  return async function downloadReport(request, response, next) {
    try {
      const config = REPORT_CONFIG[report];
      const { columns, rows, subtitle, truncated } = await config.build({ teacherId: reportScope(request) });
      setDownloadHeaders(response, config, format, truncated);

      if (format === 'csv') {
        response.write(service.csvHeader(columns));
        for (const row of rows) response.write(service.csvRow(columns, row));
        response.end();
        return;
      }

      if (format === 'xlsx') {
        const buffer = await service.buildXlsxBuffer({ sheetName: config.sheet, columns, rows });
        response.end(buffer);
        return;
      }

      const buffer = await service.buildPdfBuffer({ title: config.title, subtitle, columns, rows });
      response.end(buffer);
    } catch (error) {
      // Headers may already be sent for a streamed CSV; avoid a broken envelope in that case.
      if (response.headersSent) {
        response.end();
        return;
      }
      next(error);
    }
  };
}

module.exports = { download };

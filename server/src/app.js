const path = require('path');
const fs = require('fs');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const { CLIENT_ORIGIN, TRUST_PROXY, REQUEST_BODY_LIMIT, NODE_ENV } = require('./config/env');
const { authLimiter, mutationLimiter } = require('./middleware/rateLimit');
const { attachUser } = require('./middleware/jwt');
const { csrfToken, requireCsrf } = require('./middleware/csrf');
const { notFound, errorHandler } = require('./middleware/error');

const healthRoutes = require('./routes/health.routes');
const authRoutes = require('./routes/auth.routes');
const adminRoutes = require('./routes/admin.routes');
const teacherRoutes = require('./routes/teacher.routes');
const studentRoutes = require('./routes/student.routes');
const reportRoutes = require('./routes/report.routes');

const app = express();

// Behind a reverse proxy (nginx, Render, Fly, etc.) trust the first hop so
// rate limiting sees the real client IP and Secure cookies are honoured.
app.set('trust proxy', TRUST_PROXY);

// Security headers. The SPA is a Vite build with no inline scripts, so the
// script-src stays strict; style-src allows inline styles for React/Tailwind.
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        fontSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'none'"],
        formAction: ["'self'"],
        // Only force HTTPS upgrades in production; local dev is plain HTTP.
        upgradeInsecureRequests: NODE_ENV === 'production' ? [] : null
      }
    },
    // Uploads may be embedded from a separately hosted SPA.
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  })
);
app.use(cors({ origin: CLIENT_ORIGIN, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: REQUEST_BODY_LIMIT }));
app.use(express.urlencoded({ extended: false, limit: REQUEST_BODY_LIMIT }));
app.use(attachUser);

const clientDist = path.join(__dirname, '../../client-react/dist');
app.use('/uploads', express.static(path.join(__dirname, '../../uploads')));
app.use(express.static(clientDist));

// Health checks are unauthenticated and exempt from the mutation limiter.
app.use('/api/health', healthRoutes);

// Rate-limit every mutating API request, with a stricter cap on credentials.
app.use('/api', mutationLimiter);
app.use('/api/auth', authLimiter, requireCsrf, authRoutes);
app.get('/api/csrf-token', csrfToken);
app.use('/api/admin', requireCsrf, adminRoutes);
app.use('/api/teacher', requireCsrf, teacherRoutes);
app.use('/api/student', requireCsrf, studentRoutes);
app.use('/api/reports', requireCsrf, reportRoutes);

app.get('*', (request, response, next) => {
  if (request.path.startsWith('/api/')) return next();
  const indexFile = path.join(clientDist, 'index.html');
  if (!fs.existsSync(indexFile)) return next();
  return response.sendFile(indexFile);
});

app.use(notFound);
app.use(errorHandler);

module.exports = app;

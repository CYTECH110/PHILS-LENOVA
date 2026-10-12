/**
 * Build an Error carrying an HTTP status code, for use with `next()`.
 * Lets every layer produce responses through the single errorHandler below.
 */
const httpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

/**
 * Fallback middleware for when no routes match the request
 */
const notFound = (req, res, next) => {
  next(httpError(404, `Route not found - ${req.originalUrl}`));
};

/**
 * Global Error Handling Middleware
 * Must be applied at the very end of the middleware stack
 *
 * 4xx messages are written by us and are safe to expose; 5xx messages may
 * contain internals, so they are replaced with a generic string outside
 * development. Stack traces are never sent and only logged for 5xx.
 */
const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const isServerError = statusCode >= 500;
  const isDevelopment = process.env.NODE_ENV === 'development';

  if (isServerError) {
    console.error(err.stack);
  }

  const exposeMessage = !isServerError || isDevelopment;
  const message = exposeMessage && err.message ? err.message : 'An unexpected internal server error occurred';

  return res.status(statusCode).json({
    success: false,
    error: message,
    ...(isServerError && isDevelopment && { stack: err.stack })
  });
};

module.exports = {
  httpError,
  notFound,
  errorHandler
};

'use strict';

/**
 * asyncHandler.js
 * Express 4 doesn't catch rejected promises from route handlers; this forwards
 * them to the global error handler instead of leaving the request hanging.
 */

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

module.exports = { asyncHandler };

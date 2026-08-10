// Wraps an async Express handler so rejected promises are forwarded to next(err)
// instead of crashing the process or requiring try/catch in every controller.
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = asyncHandler;

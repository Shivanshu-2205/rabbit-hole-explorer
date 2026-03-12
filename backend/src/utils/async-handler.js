// Wraps async route handlers so you never need try/catch in controllers
// Any thrown error (including ApiError) gets forwarded to the global error handler in app.js
//
// Without this:
//   app.get('/route', async (req, res, next) => { try { ... } catch(e) { next(e) } })
//
// With this:
//   app.get('/route', asyncHandler(async (req, res) => { ... }))

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export { asyncHandler };
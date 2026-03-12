// Extends the native Error class so we can attach HTTP status codes
// Usage: throw new ApiError(401, "Unauthorized")
class ApiError extends Error {
  constructor(statusCode, message = 'Something went wrong', errors = []) {
    super(message);
    this.statusCode = statusCode;
    this.message    = message;
    this.errors     = errors;   // array of field-level validation errors
    this.success    = false;
  }
}

export { ApiError };
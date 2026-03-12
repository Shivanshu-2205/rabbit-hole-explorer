// Standard response wrapper — every successful endpoint uses this
// Ensures consistent shape: { success, message, data }
class ApiResponse {
  constructor(statusCode, message = 'Success', data = null) {
    this.statusCode = statusCode;
    this.message    = message;
    this.data       = data;
    this.success    = statusCode < 400;
  }
}

export { ApiResponse };
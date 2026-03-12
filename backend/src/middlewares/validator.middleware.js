import { ApiError } from '../utils/api-error.js';
import { HTTP } from '../utils/constants.js';

// Validates req.body against a Zod schema
// Usage: router.post('/register', validate(registerSchema), controller)

const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);

  if (!result.success) {
    // Collect all field errors into a clean array
    const errors = result.error.errors.map(e => ({
      field:   e.path.join('.'),
      message: e.message,
    }));

    throw new ApiError(HTTP.BAD_REQUEST, 'Validation failed', errors);
  }

  // Replace req.body with the parsed + coerced data from Zod
  req.body = result.data;
  next();
};

export { validate };
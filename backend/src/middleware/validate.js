const AppError = require('../utils/AppError');

function validate(schema, source = 'body') {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      const fields = {};
      for (const issue of result.error.issues) {
        const key = issue.path.join('.') || '_';
        fields[key] ??= issue.message;
      }
      throw new AppError(422, 'VALIDATION_ERROR', 'Помилка валідації', fields);
    }

    req[source] = result.data;
    next();
  };
}

module.exports = validate;

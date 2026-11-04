import { ValidationError, ValidationPipe } from '@nestjs/common';
import { ApiException } from '../errors/api-error';

function findFirstInvalidField(
  errors: ValidationError[],
  parent = '',
): string | undefined {
  for (const error of errors) {
    const field = parent ? `${parent}.${error.property}` : error.property;
    if (error.constraints && Object.keys(error.constraints).length > 0) {
      return field;
    }

    const nestedField = findFirstInvalidField(error.children ?? [], field);
    if (nestedField) return nestedField;
  }
}

export class GlobalValidationPipe extends ValidationPipe {
  constructor() {
    super({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      exceptionFactory: (errors: ValidationError[]) => {
        const field = findFirstInvalidField(errors);
        return new ApiException(
          400,
          'INVALID_REQUEST',
          '요청 값이 유효하지 않습니다.',
          field,
        );
      },
    });
  }
}

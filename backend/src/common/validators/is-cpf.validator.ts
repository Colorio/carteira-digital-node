import {
  registerDecorator,
  ValidationOptions,
} from 'class-validator';

export function IsCpf(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isCpf',
      target: object.constructor,
      propertyName,
      options: {
      message: 'CPF inválido.',
        ...validationOptions,
      },
      validator: {
        validate(value: string) {
          if (!/^\d{11}$/.test(value)) {
            return false;
          }

          if (/^(\d)\1{10}$/.test(value)) {
            return false;
          }

          const digits = value.split('').map(Number);

          const calculateDigit = (length: number) => {
            const sum = digits
              .slice(0, length)
              .reduce((total, digit, index) => {
                return total + digit * (length + 1 - index);
              }, 0);

            const remainder = (sum * 10) % 11;

            return remainder === 10 ? 0 : remainder;
          };

          return (
            calculateDigit(9) === digits[9] &&
            calculateDigit(10) === digits[10]
          );
        },
      },
    });
  };
}
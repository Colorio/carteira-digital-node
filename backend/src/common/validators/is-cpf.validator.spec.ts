import { validate } from 'class-validator';
import { IsCpf } from './is-cpf.validator.js';

class TestDto {
  @IsCpf()
  cpf: string;
}

describe('IsCpf', () => {
  it('should accept a valid CPF', async () => {
    const dto = new TestDto();
    dto.cpf = '52998224725';

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('should reject an invalid CPF', async () => {
    const dto = new TestDto();
    dto.cpf = '12345678900';

    const errors = await validate(dto);

    expect(errors).toHaveLength(1);
  });

  it('should reject repeated digits', async () => {
    const dto = new TestDto();
    dto.cpf = '11111111111';

    const errors = await validate(dto);

    expect(errors).toHaveLength(1);
  });
});
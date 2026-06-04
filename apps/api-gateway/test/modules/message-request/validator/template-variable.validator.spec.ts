import { BadRequestException } from '@nestjs/common';
import { TemplateVariableValidator } from '../../../../src/modules/message-request/validator/template-variable.validator';
import { MessageTemplateVariableEntity, TemplateVariableDataType } from '@app/database';

function makeVariable(
  variableKey: string,
  dataType: TemplateVariableDataType,
  isRequired: boolean,
): MessageTemplateVariableEntity {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    templateId: '00000000-0000-0000-0000-000000000002',
    variableKey,
    dataType,
    isRequired,
    displayOrder: 1,
    description: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as MessageTemplateVariableEntity;
}

describe('TemplateVariableValidator', () => {
  let validator: TemplateVariableValidator;

  beforeEach(() => {
    validator = new TemplateVariableValidator();
  });

  describe('required variable presence', () => {
    it('throws when required variable is missing', () => {
      const vars = [makeVariable('name', TemplateVariableDataType.STRING, true)];
      expect(() => validator.validate(vars, {})).toThrow(BadRequestException);
      expect(() => validator.validate(vars, {})).toThrow('Missing required variable: name');
    });

    it('throws when required variable is null', () => {
      const vars = [makeVariable('name', TemplateVariableDataType.STRING, true)];
      expect(() => validator.validate(vars, { name: null })).toThrow(BadRequestException);
    });

    it('passes when optional variable is absent', () => {
      const vars = [makeVariable('name', TemplateVariableDataType.STRING, false)];
      expect(() => validator.validate(vars, {})).not.toThrow();
    });
  });

  describe('type validation', () => {
    it('passes STRING with string value', () => {
      const vars = [makeVariable('name', TemplateVariableDataType.STRING, true)];
      expect(() => validator.validate(vars, { name: 'hello' })).not.toThrow();
    });

    it('throws STRING with number value', () => {
      const vars = [makeVariable('name', TemplateVariableDataType.STRING, true)];
      expect(() => validator.validate(vars, { name: 123 })).toThrow('Invalid variable type: name');
    });

    it('passes NUMBER with finite number', () => {
      const vars = [makeVariable('amount', TemplateVariableDataType.NUMBER, true)];
      expect(() => validator.validate(vars, { amount: 42 })).not.toThrow();
    });

    it('throws NUMBER with Infinity', () => {
      const vars = [makeVariable('amount', TemplateVariableDataType.NUMBER, true)];
      expect(() => validator.validate(vars, { amount: Infinity })).toThrow('Invalid variable type: amount');
    });

    it('throws NUMBER with string', () => {
      const vars = [makeVariable('amount', TemplateVariableDataType.NUMBER, true)];
      expect(() => validator.validate(vars, { amount: '42' })).toThrow('Invalid variable type: amount');
    });

    it('passes BOOLEAN with boolean value', () => {
      const vars = [makeVariable('flag', TemplateVariableDataType.BOOLEAN, true)];
      expect(() => validator.validate(vars, { flag: false })).not.toThrow();
    });

    it('throws BOOLEAN with string "true"', () => {
      const vars = [makeVariable('flag', TemplateVariableDataType.BOOLEAN, true)];
      expect(() => validator.validate(vars, { flag: 'true' })).toThrow('Invalid variable type: flag');
    });

    it('passes DATE with string value', () => {
      const vars = [makeVariable('dueDate', TemplateVariableDataType.DATE, true)];
      expect(() => validator.validate(vars, { dueDate: '2025-01-01' })).not.toThrow();
    });

    it('passes OBJECT with plain object', () => {
      const vars = [makeVariable('meta', TemplateVariableDataType.OBJECT, true)];
      expect(() => validator.validate(vars, { meta: { key: 'value' } })).not.toThrow();
    });

    it('throws OBJECT with array', () => {
      const vars = [makeVariable('meta', TemplateVariableDataType.OBJECT, true)];
      expect(() => validator.validate(vars, { meta: [1, 2, 3] })).toThrow('Invalid variable type: meta');
    });

    it('passes ARRAY with array value', () => {
      const vars = [makeVariable('items', TemplateVariableDataType.ARRAY, true)];
      expect(() => validator.validate(vars, { items: [1, 2, 3] })).not.toThrow();
    });

    it('throws ARRAY with plain object', () => {
      const vars = [makeVariable('items', TemplateVariableDataType.ARRAY, true)];
      expect(() => validator.validate(vars, { items: {} })).toThrow('Invalid variable type: items');
    });
  });

  describe('multiple variables', () => {
    it('validates all variables and throws on first violation', () => {
      const vars = [
        makeVariable('name', TemplateVariableDataType.STRING, true),
        makeVariable('amount', TemplateVariableDataType.NUMBER, true),
      ];
      expect(() => validator.validate(vars, { name: 'test', amount: 'wrong' })).toThrow('Invalid variable type: amount');
    });

    it('passes when all variables are valid', () => {
      const vars = [
        makeVariable('name', TemplateVariableDataType.STRING, true),
        makeVariable('amount', TemplateVariableDataType.NUMBER, false),
      ];
      expect(() => validator.validate(vars, { name: 'test' })).not.toThrow();
    });
  });
});

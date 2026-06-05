import { TemplateVariableValidator } from '../../../../src/modules/message-request/validator/template-variable.validator';
import { MessageTemplateVariableEntity, TemplateVariableDataType } from '@app/database';
import { AppException, ErrorCode } from '@app/common';

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

function catchSync(fn: () => void): unknown {
  try {
    fn();
    return undefined;
  } catch (e) {
    return e;
  }
}

describe('TemplateVariableValidator', () => {
  let validator: TemplateVariableValidator;

  beforeEach(() => {
    validator = new TemplateVariableValidator();
  });

  describe('required variable presence', () => {
    it('throws MSG_INVALID_VARIABLES when required variable is missing', () => {
      const vars = [makeVariable('name', TemplateVariableDataType.STRING, true)];
      const err = catchSync(() => validator.validate(vars, {}));
      expect(err).toBeInstanceOf(AppException);
      expect(err).toMatchObject({ errorCode: ErrorCode.MSG_INVALID_VARIABLES });
    });

    it('throws MSG_INVALID_VARIABLES when required variable is null', () => {
      const vars = [makeVariable('name', TemplateVariableDataType.STRING, true)];
      const err = catchSync(() => validator.validate(vars, { name: null }));
      expect(err).toBeInstanceOf(AppException);
      expect(err).toMatchObject({ errorCode: ErrorCode.MSG_INVALID_VARIABLES });
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

    it('throws MSG_INVALID_VARIABLES with number for STRING variable', () => {
      const vars = [makeVariable('name', TemplateVariableDataType.STRING, true)];
      const err = catchSync(() => validator.validate(vars, { name: 123 }));
      expect(err).toBeInstanceOf(AppException);
      expect(err).toMatchObject({ errorCode: ErrorCode.MSG_INVALID_VARIABLES });
    });

    it('passes NUMBER with finite number', () => {
      const vars = [makeVariable('amount', TemplateVariableDataType.NUMBER, true)];
      expect(() => validator.validate(vars, { amount: 42 })).not.toThrow();
    });

    it('throws MSG_INVALID_VARIABLES with Infinity for NUMBER variable', () => {
      const vars = [makeVariable('amount', TemplateVariableDataType.NUMBER, true)];
      const err = catchSync(() => validator.validate(vars, { amount: Infinity }));
      expect(err).toBeInstanceOf(AppException);
      expect(err).toMatchObject({ errorCode: ErrorCode.MSG_INVALID_VARIABLES });
    });

    it('throws MSG_INVALID_VARIABLES with string for NUMBER variable', () => {
      const vars = [makeVariable('amount', TemplateVariableDataType.NUMBER, true)];
      const err = catchSync(() => validator.validate(vars, { amount: '42' }));
      expect(err).toBeInstanceOf(AppException);
      expect(err).toMatchObject({ errorCode: ErrorCode.MSG_INVALID_VARIABLES });
    });

    it('passes BOOLEAN with boolean value', () => {
      const vars = [makeVariable('flag', TemplateVariableDataType.BOOLEAN, true)];
      expect(() => validator.validate(vars, { flag: false })).not.toThrow();
    });

    it('throws MSG_INVALID_VARIABLES with string "true" for BOOLEAN variable', () => {
      const vars = [makeVariable('flag', TemplateVariableDataType.BOOLEAN, true)];
      const err = catchSync(() => validator.validate(vars, { flag: 'true' }));
      expect(err).toBeInstanceOf(AppException);
      expect(err).toMatchObject({ errorCode: ErrorCode.MSG_INVALID_VARIABLES });
    });

    it('passes DATE with string value', () => {
      const vars = [makeVariable('dueDate', TemplateVariableDataType.DATE, true)];
      expect(() => validator.validate(vars, { dueDate: '2025-01-01' })).not.toThrow();
    });

    it('passes OBJECT with plain object', () => {
      const vars = [makeVariable('meta', TemplateVariableDataType.OBJECT, true)];
      expect(() => validator.validate(vars, { meta: { key: 'value' } })).not.toThrow();
    });

    it('throws MSG_INVALID_VARIABLES with array for OBJECT variable', () => {
      const vars = [makeVariable('meta', TemplateVariableDataType.OBJECT, true)];
      const err = catchSync(() => validator.validate(vars, { meta: [1, 2, 3] }));
      expect(err).toBeInstanceOf(AppException);
      expect(err).toMatchObject({ errorCode: ErrorCode.MSG_INVALID_VARIABLES });
    });

    it('passes ARRAY with array value', () => {
      const vars = [makeVariable('items', TemplateVariableDataType.ARRAY, true)];
      expect(() => validator.validate(vars, { items: [1, 2, 3] })).not.toThrow();
    });

    it('throws MSG_INVALID_VARIABLES with plain object for ARRAY variable', () => {
      const vars = [makeVariable('items', TemplateVariableDataType.ARRAY, true)];
      const err = catchSync(() => validator.validate(vars, { items: {} }));
      expect(err).toBeInstanceOf(AppException);
      expect(err).toMatchObject({ errorCode: ErrorCode.MSG_INVALID_VARIABLES });
    });
  });

  describe('multiple variables', () => {
    it('throws MSG_INVALID_VARIABLES on first violation', () => {
      const vars = [
        makeVariable('name', TemplateVariableDataType.STRING, true),
        makeVariable('amount', TemplateVariableDataType.NUMBER, true),
      ];
      const err = catchSync(() => validator.validate(vars, { name: 'test', amount: 'wrong' }));
      expect(err).toBeInstanceOf(AppException);
      expect(err).toMatchObject({ errorCode: ErrorCode.MSG_INVALID_VARIABLES });
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

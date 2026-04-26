import { MessageTemplateVariableEntity, TemplateVariableDataType } from '@app/database';
import { BadRequestException, Injectable } from '@nestjs/common';

@Injectable()
export class TemplateVariableValidator {
  validate(
    templateVariables: MessageTemplateVariableEntity[],
    values: Record<string, unknown>,
  ): void {
    for (const variable of templateVariables) {
      const value = values[variable.variableKey];
      if (variable.isRequired && (value === undefined || value === null)) {
        throw new BadRequestException(`Missing required variable: ${variable.variableKey}`);
      }

      if (value === undefined || value === null) {
        continue;
      }

      if (!this.isMatched(variable.dataType, value)) {
        throw new BadRequestException(`Invalid variable type: ${variable.variableKey}`);
      }
    }
  }

  private isMatched(type: TemplateVariableDataType, value: unknown): boolean {
    switch (type) {
      case TemplateVariableDataType.STRING:
        return typeof value === 'string';
      case TemplateVariableDataType.NUMBER:
        return typeof value === 'number' && Number.isFinite(value);
      case TemplateVariableDataType.BOOLEAN:
        return typeof value === 'boolean';
      case TemplateVariableDataType.DATE:
      case TemplateVariableDataType.DATETIME:
        return typeof value === 'string' || value instanceof Date;
      case TemplateVariableDataType.OBJECT:
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      case TemplateVariableDataType.ARRAY:
        return Array.isArray(value);
      default:
        return false;
    }
  }
}

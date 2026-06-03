import type { ExecutionContext } from '@nestjs/common';

/**
 * Builds a minimal HTTP ExecutionContext for unit tests.
 * Concentrates the one unavoidable structural cast here so spec files stay cast-free.
 *
 * @param request  Partial request shape passed to getRequest()
 * @param handler  Metadata bag returned by getHandler() — used by Reflector in guard tests
 */
export function makeHttpExecutionContext(
  request: Record<string, unknown>,
  handler: Record<string, unknown> = {},
): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({}),
      getNext: () => ({}),
    }),
    getHandler: () => handler,
    getClass: () => {
      throw new Error('makeHttpExecutionContext: getClass not implemented');
    },
    getArgs: () => {
      throw new Error('makeHttpExecutionContext: getArgs not implemented');
    },
    getArgByIndex: () => {
      throw new Error('makeHttpExecutionContext: getArgByIndex not implemented');
    },
    getType: () => 'http',
    switchToRpc: () => {
      throw new Error('makeHttpExecutionContext: switchToRpc not implemented');
    },
    switchToWs: () => {
      throw new Error('makeHttpExecutionContext: switchToWs not implemented');
    },
  } as unknown as ExecutionContext;
}

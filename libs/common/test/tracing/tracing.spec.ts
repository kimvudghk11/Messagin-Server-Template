import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { setupTracing } from '../../src/tracing/tracing';

jest.mock('@opentelemetry/sdk-node', () => ({
  NodeSDK: jest.fn().mockImplementation(() => ({ start: jest.fn(), shutdown: jest.fn() })),
}));
jest.mock('@opentelemetry/exporter-trace-otlp-http', () => ({
  OTLPTraceExporter: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('@opentelemetry/resources', () => ({
  resourceFromAttributes: jest.fn().mockReturnValue({ attributes: {} }),
}));
jest.mock('@opentelemetry/auto-instrumentations-node', () => ({
  getNodeAutoInstrumentations: jest.fn().mockReturnValue([]),
}));

const MockNodeSDK = NodeSDK as jest.MockedClass<typeof NodeSDK>;
const MockExporter = OTLPTraceExporter as jest.MockedClass<typeof OTLPTraceExporter>;
const mockResourceFromAttributes = resourceFromAttributes as jest.Mock;

describe('setupTracing', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    jest.clearAllMocks();
    MockNodeSDK.mockImplementation(() => ({ start: jest.fn(), shutdown: jest.fn() } as unknown as NodeSDK));
    MockExporter.mockImplementation(() => ({}) as unknown as OTLPTraceExporter);
    mockResourceFromAttributes.mockReturnValue({ attributes: {} });
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('creates SDK and calls start()', () => {
    const sdk = setupTracing('api-gateway');

    expect(MockNodeSDK).toHaveBeenCalledTimes(1);
    expect((sdk as unknown as { start: jest.Mock }).start).toHaveBeenCalledTimes(1);
  });

  it('passes service name to resourceFromAttributes', () => {
    setupTracing('my-service');

    expect(mockResourceFromAttributes).toHaveBeenCalledWith(
      expect.objectContaining({ 'service.name': 'my-service' }),
    );
  });

  it('uses custom endpoint from options', () => {
    setupTracing('test-service', { endpoint: 'http://custom-collector:4318/v1/traces' });

    expect(MockExporter).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'http://custom-collector:4318/v1/traces' }),
    );
  });

  it('uses OTEL_EXPORTER_OTLP_ENDPOINT env var as fallback', () => {
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = 'http://env-collector:4318/v1/traces';

    setupTracing('test-service');

    expect(MockExporter).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'http://env-collector:4318/v1/traces' }),
    );
  });

  it('omits traceExporter when OTEL_ENABLED=false', () => {
    process.env.OTEL_ENABLED = 'false';

    setupTracing('test-service');

    const sdkOptions = MockNodeSDK.mock.calls[0]?.[0] as { traceExporter?: unknown } | undefined;
    expect(sdkOptions?.traceExporter).toBeUndefined();
  });

  it('includes traceExporter when OTEL_ENABLED is not false', () => {
    process.env.OTEL_ENABLED = 'true';

    setupTracing('test-service');

    const sdkOptions = MockNodeSDK.mock.calls[0]?.[0] as { traceExporter?: unknown } | undefined;
    expect(sdkOptions?.traceExporter).toBeDefined();
  });

  it('returns the SDK instance with start and shutdown', () => {
    const sdk = setupTracing('test-service') as unknown as { start: jest.Mock; shutdown: jest.Mock };

    expect(sdk).toBeDefined();
    expect(typeof sdk.start).toBe('function');
    expect(typeof sdk.shutdown).toBe('function');
  });
});

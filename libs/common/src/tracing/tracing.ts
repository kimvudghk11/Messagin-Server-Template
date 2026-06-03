import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

const SERVICE_NAME_KEY = 'service.name';

export interface TracingOptions {
  /** Set OTEL_ENABLED=false to disable (e.g. CI, local dev without a collector) */
  enabled?: boolean;
  /** OTLP collector endpoint. Falls back to OTEL_EXPORTER_OTLP_ENDPOINT or localhost */
  endpoint?: string;
}

export function setupTracing(serviceName: string, options: TracingOptions = {}): NodeSDK {
  const enabled = options.enabled ?? process.env.OTEL_ENABLED !== 'false';

  const exporter = new OTLPTraceExporter({
    url:
      options.endpoint ??
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT ??
      'http://localhost:4318/v1/traces',
  });

  const sdk = new NodeSDK({
    resource: resourceFromAttributes({ [SERVICE_NAME_KEY]: serviceName }),
    // exactOptionalPropertyTypes: spread to omit the key entirely when disabled
    ...(enabled ? { traceExporter: exporter } : {}),
    instrumentations: enabled
      ? [
          getNodeAutoInstrumentations({
            '@opentelemetry/instrumentation-fs': { enabled: false },
          }),
        ]
      : [],
  });

  sdk.start();
  return sdk;
}

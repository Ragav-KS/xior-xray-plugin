import AWSXRay from 'aws-xray-sdk';
import {
  XiorError,
  type XiorPlugin,
  type XiorRequestConfig,
  type XiorResponse,
} from 'xior';

interface XRayPluginOptions {
  /** Custom name for the X-Ray subsegment (appears as service on X-Ray map) */
  serviceName?: string;
}

export default function xrayPlugin(
  options: XRayPluginOptions = {},
): XiorPlugin {
  return (adapter) => {
    return async (config: XiorRequestConfig): Promise<XiorResponse> => {
      // Determine subsegment name: use custom serviceName or the request URL
      const subsegmentName =
        options.serviceName || (config.baseURL ?? 'Remote Server');

      return AWSXRay.captureAsyncFunc(
        subsegmentName,
        async (subsegment) => {
          if (subsegment) {
            // Mark this subsegment as a remote call
            subsegment.namespace = 'remote';

            // Add annotations for logging/searching in X-Ray
            subsegment.addAnnotation('method', config.method || '');
            subsegment.addAnnotation('baseUrl', config.baseURL || '');
            subsegment.addAnnotation('path', config.url || '');
          }

          try {
            // Perform the actual HTTP request
            const res: XiorResponse = await adapter(config);

            subsegment?.addAnnotation('status', res.status);

            return res;
          } catch (err) {
            if (typeof err === 'string' || err instanceof Error) {
              if (err instanceof XiorError && err.response) {
                subsegment?.addAnnotation('status', err.response.status);
              }

              subsegment?.addError(err);
            }

            throw err;
          } finally {
            subsegment?.close();
          }
        },
        AWSXRay.getSegment(), // use current X-Ray segment as parent (if any)
      );
    };
  };
}

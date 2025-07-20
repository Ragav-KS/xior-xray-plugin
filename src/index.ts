import AWSXRay from 'aws-xray-sdk';
import type { XiorPlugin, XiorRequestConfig, XiorResponse } from 'xior';

interface XRayPluginOptions {
  /** Custom name for the X-Ray subsegment (appears as service on X-Ray map) */
  serviceName?: string;
  /** (Optional) subsegment namespace; default is 'remote' for HTTP calls */
  namespace?: string;
}

export default function xrayPlugin(
  options: XRayPluginOptions = {},
): XiorPlugin {
  return (adapter) => {
    return async (config: XiorRequestConfig): Promise<XiorResponse> => {
      // Determine subsegment name: use custom serviceName or the request URL
      const subsegmentName =
        options.serviceName || (config.baseURL ?? '') + config.url;

      return AWSXRay.captureAsyncFunc(
        subsegmentName,
        async (subsegment) => {
          if (subsegment) {
            // Mark this subsegment as a remote call
            subsegment.namespace = options.namespace || 'remote';

            // Add annotations for logging/searching in X-Ray
            subsegment.addAnnotation('method', config.method || '');
            subsegment.addAnnotation('baseUrl', config.baseURL || '');
            subsegment.addAnnotation('path', config.url || '');
          }

          try {
            // Perform the actual HTTP request
            const res: XiorResponse = await adapter(config);

            subsegment?.addAnnotation('status', res.status);

            // Close the subsegment (records end time, sends it to the X-Ray daemon)
            subsegment?.close();

            return res;
          } catch (err) {
            if (typeof err === 'string' || err instanceof Error) {
              // On error, record error in the subsegment and close it
              subsegment?.addError(err);
              subsegment?.close(err);
            }

            throw err;
          }
        },
        AWSXRay.getSegment(),
      ); // use current X-Ray segment as parent (if any)
    };
  };
}

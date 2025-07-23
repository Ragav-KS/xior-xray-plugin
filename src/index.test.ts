import AWSXRay, { Segment, Subsegment } from 'aws-xray-sdk';
import {
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
  type MockedObject,
  type MockInstance,
} from 'vitest';
import xior from 'xior';
import MockPlugin from 'xior/plugins/mock';

describe('xrayPlugin should work as expected', async () => {
  let mockedSegment: MockedObject<AWSXRay.Segment>;
  let mockedSubsegment: MockedObject<AWSXRay.Subsegment>;

  let getSegmentSpy: MockInstance<() => Segment | Subsegment | undefined>;
  let captureAsyncFuncSpy: MockInstance<
    <T>(
      name: string,
      fcn: (subsegment?: Subsegment) => T,
      parent?: Segment | Subsegment,
    ) => T
  >;

  beforeAll(() => {
    const segment = new Segment('mockSegment');
    const subsegment = new Subsegment('mockSubsegment');

    mockedSegment = vi.mockObject(segment);
    mockedSubsegment = vi.mockObject(subsegment);
  });

  beforeEach(() => {
    getSegmentSpy = vi
      .spyOn(AWSXRay, 'getSegment')
      .mockReturnValue(mockedSegment);

    captureAsyncFuncSpy = vi
      .spyOn(AWSXRay, 'captureAsyncFunc')
      .mockImplementationOnce((name, fcn, parent) => {
        return AWSXRay.captureAsyncFunc(
          name,
          () => {
            return fcn(mockedSubsegment);
          },
          parent,
        );
      });
  });

  test('A standard Successful request must add all the correct annotations', async () => {
    const mockXiorInstance = xior.create({
      baseURL: 'https://example.com',
    });

    // Add mock plugin
    const mockPlugin = new MockPlugin(mockXiorInstance);

    // Add XRay plugin
    const xrayPlugin = (await import('./index')).default;
    mockXiorInstance.plugins.use(xrayPlugin({}));

    // Add a mock `/users` endpoint
    mockPlugin.onGet('/users').reply(204);

    // Execute
    const res = await mockXiorInstance.get('/users');

    // Test
    expect(getSegmentSpy).toBeCalled();

    expect(captureAsyncFuncSpy).toBeCalledWith(
      'https://example.com',
      expect.any(Function),
      mockedSegment,
    );

    expect(mockedSubsegment.namespace).toEqual('remote');

    expect(mockedSubsegment.addAnnotation).toBeCalledWith('method', 'GET');
    expect(mockedSubsegment.addAnnotation).toBeCalledWith(
      'baseUrl',
      'https://example.com',
    );
    expect(mockedSubsegment.addAnnotation).toBeCalledWith('path', '/users');

    expect(mockedSubsegment.addAnnotation).toBeCalledWith('status', res.status);
  });

  test('A standard Unsuccessful request must add all the correct annotations', async () => {
    const mockXiorInstance = xior.create({
      baseURL: 'https://example.com',
    });

    // Add mock plugin
    const mockPlugin = new MockPlugin(mockXiorInstance);

    // Add XRay plugin
    const xrayPlugin = (await import('./index')).default;
    mockXiorInstance.plugins.use(xrayPlugin({}));

    // Add a mock `/users` endpoint
    mockPlugin.onPost('/users').reply(500);

    // Execute
    await expect(mockXiorInstance.post('/users')).rejects.toThrow();

    // Test
    expect(getSegmentSpy).toBeCalled();

    expect(captureAsyncFuncSpy).toBeCalledWith(
      'https://example.com',
      expect.any(Function),
      mockedSegment,
    );

    expect(mockedSubsegment.namespace).toEqual('remote');

    expect(mockedSubsegment.addAnnotation).toBeCalledWith('method', 'POST');
    expect(mockedSubsegment.addAnnotation).toBeCalledWith(
      'baseUrl',
      'https://example.com',
    );
    expect(mockedSubsegment.addAnnotation).toBeCalledWith('path', '/users');

    expect(mockedSubsegment.addAnnotation).toBeCalledWith('status', 500);
  });

  test('Segment Service name should match the configuration if provided', async () => {
    const mockXiorInstance = xior.create({
      baseURL: 'https://example.com',
    });

    // Add mock plugin
    const mockPlugin = new MockPlugin(mockXiorInstance);

    // Add XRay plugin
    const xrayPlugin = (await import('./index')).default;
    mockXiorInstance.plugins.use(
      xrayPlugin({
        serviceName: 'Custom_service',
      }),
    );

    // Add a mock `/users` endpoint
    mockPlugin.onPost('/users').reply(200);

    // Execute
    await mockXiorInstance.post('/users');

    // Test
    expect(getSegmentSpy).toBeCalled();

    expect(captureAsyncFuncSpy).toBeCalledWith(
      'Custom_service',
      expect.any(Function),
      mockedSegment,
    );
  });

  test('Should handle custom error messages correctly', async () => {
    const mockXiorInstance = xior.create({
      baseURL: 'https://example.com',
    });
    const mockPlugin = new MockPlugin(mockXiorInstance);
    const xrayPlugin = (await import('./index')).default;
    mockXiorInstance.plugins.use(xrayPlugin({}));

    const errorMessage = 'Custom error message';
    mockPlugin
      .onGet('/error')
      .reply(() => Promise.reject(new Error(errorMessage)));

    await expect(mockXiorInstance.get('/error')).rejects.toThrow(errorMessage);

    expect(mockedSubsegment.addError).toBeCalledWith(expect.any(Error));
    expect(mockedSubsegment.close).toBeCalled();
  });

  test('Should work without baseURL using default Remote Server name', async () => {
    const mockXiorInstance = xior.create({});
    const mockPlugin = new MockPlugin(mockXiorInstance);
    const xrayPlugin = (await import('./index')).default;
    mockXiorInstance.plugins.use(xrayPlugin({}));

    mockPlugin.onGet('/test').reply(200);

    await mockXiorInstance.get('/test');

    expect(captureAsyncFuncSpy).toBeCalledWith(
      'Remote Server',
      expect.any(Function),
      mockedSegment,
    );
    expect(mockedSubsegment.addAnnotation).toBeCalledWith('baseUrl', '');
  });

  test('Should handle undefined subsegment gracefully', async () => {
    captureAsyncFuncSpy = vi
      .spyOn(AWSXRay, 'captureAsyncFunc')
      .mockImplementationOnce((name, fcn) => {
        return fcn(undefined);
      });

    const mockXiorInstance = xior.create({});
    const mockPlugin = new MockPlugin(mockXiorInstance);
    const xrayPlugin = (await import('./index')).default;
    mockXiorInstance.plugins.use(xrayPlugin({}));

    mockPlugin.onGet('/test').reply(200);

    const response = await mockXiorInstance.get('/test');

    expect(response.status).toBe(200);
  });
});

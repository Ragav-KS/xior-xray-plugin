# xior-xray-plugin

A [Xior](https://github.com/suhaotian/xior) plugin to capture AWS X-Ray traces for HTTP requests.

## About

This plugin integrates AWS X-Ray tracing with Xior HTTP client. It automatically creates subsegments for each HTTP request and captures important request/response metadata as annotations, making it easy to trace and debug API calls in distributed systems.

## Installation

```bash
npm install xior-xray-plugin aws-xray-sdk
```

## Usage

```typescript
import { Xior } from 'xior';
import xrayPlugin from 'xior-xray-plugin';

const client = new Xior({
  baseURL: 'https://api.example.com',
  plugins: [
    xrayPlugin({
      serviceName: 'my-api-client', // Optional custom name for the service
    }),
  ],
});

// All requests will now be traced in AWS X-Ray
const response = await client.get('/users');
```

### Plugin Options

| Option        | Type     | Description                          | Default                                            |
| ------------- | -------- | ------------------------------------ | -------------------------------------------------- |
| `serviceName` | `string` | Custom name for the X-Ray subsegment | `config.baseURL` if set, otherwise `Remote Server` |

### Captured Information

The plugin automatically captures the following information as X-Ray annotations:

- HTTP method
- Base URL
- Request path
- Response status code
- Error details (when requests fail)

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for more details.

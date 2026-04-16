import * as fs from 'fs';
import * as path from 'path';

const PUBLIC_DIR = path.resolve(__dirname, '../../../public');

export function installFsFetch(): void {
  const originalFetch = (global as any).fetch;

  (global as any).fetch = async (url: string | URL | Request): Promise<Response> => {
    const urlStr = typeof url === 'string' ? url : url.toString();

    if (urlStr.startsWith('/')) {
      const filePath = path.join(PUBLIC_DIR, urlStr);
      if (!fs.existsSync(filePath)) {
        return new Response(null, { status: 404, statusText: 'Not Found' });
      }
      const buf = fs.readFileSync(filePath);
      const isCsv = filePath.endsWith('.csv');
      const isYaml = filePath.endsWith('.yaml') || filePath.endsWith('.yml');
      const contentType = isCsv ? 'text/csv' : isYaml ? 'text/yaml' : 'text/plain';
      return new Response(buf, {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': contentType },
      });
    }

    if (typeof originalFetch === 'function') {
      return originalFetch(url);
    }
    return new Response(null, { status: 404 });
  };
}

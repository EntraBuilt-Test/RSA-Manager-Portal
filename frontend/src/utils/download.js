import client from '../api/client';

/**
 * Downloads a file from an authenticated API endpoint. A plain <a href> can't
 * carry the app's Bearer token (that's only attached by the axios interceptor
 * on real requests), so protected export endpoints must be fetched as a blob
 * and saved manually - this is what makes "Export Excel" work while logged in.
 */
export async function downloadFile(path, params, filename) {
  try {
    const res = await client.get(path, { params, responseType: 'blob' });
    const blob = new Blob([res.data]);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  } catch (err) {
    let message = 'Download failed';
    const data = err?.response?.data;
    if (data instanceof Blob) {
      try {
        const text = await data.text();
        const parsed = JSON.parse(text);
        message = parsed.message || message;
      } catch (_parseErr) {
        // response wasn't JSON - keep the generic message
      }
    } else if (data?.message) {
      message = data.message;
    } else if (err?.message) {
      message = err.message;
    }
    throw new Error(message);
  }
}

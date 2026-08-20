/**
 * One place that decides HOW a generated PDF/image actually leaves the app.
 *
 * Items I and X: "Share via WhatsApp" was sending only the text message - the
 * PDF was dropped on phones and inside the APK. The rule is that the PDF is
 * mandatory. Order of preference:
 *
 *   1. Native app shell (Capacitor): write the file to the cache directory and
 *      hand the real file URI to the OS share sheet. This is the only path
 *      that reliably attaches a file inside a WebView, which is why the APK
 *      was sending text only.
 *   2. Mobile browser: Web Share API level 2 (navigator.share with files).
 *   3. Desktop browser: WhatsApp has no public API to attach a file to a
 *      wa.me link, so the file downloads and the chat opens prefilled.
 *
 * Capacitor is reached through the window global rather than an import so the
 * plain web build does not need @capacitor/core as a dependency.
 *
 * NOTE for the mobile shells: `npm i @capacitor/share @capacitor/filesystem`
 * then `npx cap sync` - without those two plugins registered natively, step 1
 * is skipped and the APK falls back to text-only again.
 */

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = String(reader.result || '');
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function nativeBridge() {
  const cap = typeof window !== 'undefined' ? window.Capacitor : undefined;
  if (!cap) return null;
  const isNative = typeof cap.isNativePlatform === 'function' ? cap.isNativePlatform() : !!cap.isNative;
  if (!isNative) return null;
  const plugins = cap.Plugins || {};
  if (!plugins.Share || !plugins.Filesystem) return null;
  return { Share: plugins.Share, Filesystem: plugins.Filesystem };
}

/**
 * Shares a Blob as a real file. Returns the path that was actually used
 * ('native' | 'web-share' | 'download') so callers can tailor their message.
 * Throws only on genuine failure - a user cancelling is reported as 'cancelled'.
 */
export async function shareFile({ blob, fileName, message, title, phone, mimeType = 'application/pdf' }) {
  // 1. Native shell - the APK/IPA path. Attaches the file for real.
  const bridge = nativeBridge();
  if (bridge) {
    try {
      const base64 = await blobToBase64(blob);
      const written = await bridge.Filesystem.writeFile({
        path: fileName,
        data: base64,
        directory: 'CACHE',
        recursive: true,
      });
      await bridge.Share.share({
        title: title || fileName,
        text: message,
        url: written.uri,
        dialogTitle: 'Share via WhatsApp',
      });
      return 'native';
    } catch (err) {
      if (err && (err.message === 'Share canceled' || err.name === 'AbortError')) return 'cancelled';
      // fall through to the browser paths rather than failing outright
    }
  }

  // 2. Mobile browser with Web Share level 2.
  try {
    const file = new File([blob], fileName, { type: mimeType });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: title || fileName, text: message });
      return 'web-share';
    }
  } catch (err) {
    if (err && err.name === 'AbortError') return 'cancelled';
  }

  // 3. Desktop fallback: download the file, open the chat prefilled.
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  const digits = String(phone || '').replace(/[^0-9]/g, '');
  const base = digits ? `https://wa.me/91${digits}` : 'https://wa.me/';
  window.open(
    `${base}?text=${encodeURIComponent(`${message}\n\n(File downloaded - please attach it to this chat)`)}`,
    '_blank'
  );
  return 'download';
}

/** True when the app is running inside the Android/iOS Capacitor shell. */
export function isNativeShell() {
  return !!nativeBridge();
}

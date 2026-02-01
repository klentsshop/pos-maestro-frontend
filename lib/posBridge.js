export function sendToPOSBridge(event, payload = {}) {
    if (typeof window === 'undefined') return false;

    // Futuro: WebView Android
    if (window.POSBridge && typeof window.POSBridge.send === 'function') {
        try {
            window.POSBridge.send(JSON.stringify({ event, payload }));
            return true;
        } catch (err) {
            console.error('[POSBridge] Error:', err);
            return false;
        }
    }

    // Fallback seguro (PC / móvil / Netlify)
    console.log('[POSBridge]', event, payload);
    return false;
}

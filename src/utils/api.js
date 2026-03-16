export const API_BASE = "/api";

export async function apiRequest(path, options = {}) {
    const config = options || {};
    const hasBody = Object.prototype.hasOwnProperty.call(config, "body");

    // ensure path starts with API_BASE if not absolute
    const fullPath = path.startsWith("/api") ? path : `${API_BASE}${path}`;

    const response = await fetch(fullPath, {
        method: config.method || "GET",
        credentials: "include",
        headers: {
            "Content-Type": "application/json"
        },
        body: hasBody ? JSON.stringify(config.body) : undefined
    });

    let payload = null;
    try {
        payload = await response.json();
    } catch (error) {
        payload = null;
    }

    if (!response.ok) {
        const message = payload && payload.message ? payload.message : `Error ${response.status}`;
        throw new Error(message);
    }

    if (payload === null && response.status !== 204 && config.expectEmpty !== true) {
        throw new Error(`Respuesta invalida del servidor en ${fullPath}. Verifica que /api apunte al backend de CrediSync.`);
    }

    return payload;
}

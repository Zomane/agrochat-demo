const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED_IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 15000;

export class ApiError extends Error {
    constructor(message, { status = 0, code = "api_error" } = {}) {
        super(message);
        this.name = "ApiError";
        this.status = status;
        this.code = code;
    }
}

async function readResponse(response) {
    let data;
    try {
        data = await response.json();
    } catch {
        throw new ApiError("Сервер вернул некорректный ответ", {
            status: response.status,
            code: "invalid_response",
        });
    }

    if (!response.ok) {
        throw new ApiError(data?.error?.message || "Не удалось выполнить запрос", {
            status: response.status,
            code: "http_error",
        });
    }

    return data;
}

async function fetchWithTimeout(url, options = {}, { signal, timeoutMs = REQUEST_TIMEOUT_MS } = {}) {
    const controller = new AbortController();
    let timedOut = false;
    const abortRequest = () => controller.abort();

    if (signal?.aborted) {
        controller.abort();
    } else {
        signal?.addEventListener("abort", abortRequest, { once: true });
    }

    const timeoutId = window.setTimeout(() => {
        timedOut = true;
        controller.abort();
    }, timeoutMs);

    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } catch (error) {
        if (controller.signal.aborted) {
            throw new ApiError(
                timedOut ? "Сервер не ответил вовремя" : "Запрос остановлен",
                { code: timedOut ? "timeout" : "aborted" },
            );
        }
        throw new ApiError("Backend недоступен. Проверьте подключение и попробуйте снова", {
            code: "network_error",
        });
    } finally {
        window.clearTimeout(timeoutId);
        signal?.removeEventListener("abort", abortRequest);
    }
}

export function validateImage(file) {
    if (!file) {
        return;
    }

    const extension = file.name.split(".").pop()?.toLowerCase();
    if (!ALLOWED_IMAGE_TYPES.has(file.type) || !ALLOWED_IMAGE_EXTENSIONS.has(extension)) {
        throw new ApiError("Разрешены только изображения JPEG, PNG и WebP", { code: "validation_error" });
    }
    if (file.size > MAX_IMAGE_SIZE) {
        throw new ApiError("Размер изображения не должен превышать 5 МБ", { code: "validation_error" });
    }
}

export async function uploadImage(file, { signal } = {}) {
    validateImage(file);
    const formData = new FormData();
    formData.append("image", file);

    const response = await fetchWithTimeout("/get_image_hash", {
        method: "POST",
        body: formData,
    }, { signal });
    const data = await readResponse(response);
    return data.imageName;
}

export async function requestChat(messages, { imageName = null, regenerate = false, signal } = {}) {
    const recentMessages = messages.filter((message) => message.status === "sent").slice(-6);
    const payload = {
        userMessages: recentMessages
            .filter((message) => message.role === "user")
            .slice(-2)
            .map((message) => `text:${message.text}`),
        botMessages: recentMessages
            .filter((message) => message.role === "assistant")
            .slice(-2)
            .map((message) => `text:${message.text}`),
        image: [imageName],
        flags: regenerate ? ["regenerate"] : [],
    };

    const response = await fetchWithTimeout("/request", {
        method: "POST",
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    }, { signal });
    return readResponse(response);
}

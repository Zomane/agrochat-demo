const MESSAGE_STORAGE_KEY = "agrochat.messages.v1";
const LEGACY_KEYS = ["user", "bot", "LSD_marks"];
const ROLES = new Set(["user", "assistant"]);
const STATUSES = new Set(["pending", "sent", "error"]);
const IMAGE_NAME_PATTERN = /^[a-f0-9]{64}\.(?:jpg|png|webp)$/;

function createId() {
    return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeMessage(value) {
    if (!value || typeof value !== "object" || !ROLES.has(value.role)) {
        return null;
    }

    const createdAt = Number.isNaN(Date.parse(value.createdAt))
        ? new Date().toISOString()
        : value.createdAt;

    return {
        id: typeof value.id === "string" && value.id ? value.id : createId(),
        role: value.role,
        text: typeof value.text === "string" ? value.text.slice(0, 10000) : "",
        image: typeof value.image === "string" && IMAGE_NAME_PATTERN.test(value.image) ? value.image : null,
        createdAt,
        status: STATUSES.has(value.status) ? value.status : "sent",
    };
}

export function loadMessages() {
    try {
        const storedValue = localStorage.getItem(MESSAGE_STORAGE_KEY);
        const parsedValue = storedValue ? JSON.parse(storedValue) : [];
        return Array.isArray(parsedValue) ? parsedValue.map(normalizeMessage).filter(Boolean) : [];
    } catch {
        localStorage.removeItem(MESSAGE_STORAGE_KEY);
        return [];
    }
}

export function saveMessages(messages) {
    const normalizedMessages = messages.map(normalizeMessage).filter(Boolean);
    localStorage.setItem(MESSAGE_STORAGE_KEY, JSON.stringify(normalizedMessages));
    return normalizedMessages;
}

export function createMessage(role, { text = "", image = null, status = "sent" } = {}) {
    return normalizeMessage({
        id: createId(),
        role,
        text,
        image,
        createdAt: new Date().toISOString(),
        status,
    });
}

export function updateMessage(messages, messageId, changes) {
    return messages.map((message) => (
        message.id === messageId
            ? normalizeMessage({ ...message, ...changes, id: message.id })
            : message
    )).filter(Boolean);
}

export function clearMessages() {
    localStorage.removeItem(MESSAGE_STORAGE_KEY);
}

export function removeLegacyHistory() {
    LEGACY_KEYS.forEach((key) => localStorage.removeItem(key));
}

const IMAGE_NAME_PATTERN = /^[a-f0-9]{64}\.(?:jpg|png|webp)$/;
let messageActionHandler = null;

export function setMessageActionHandler(handler) {
    messageActionHandler = handler;
}

function createMessageText(text) {
    const element = document.createElement("div");
    element.className = "message-text";
    element.textContent = text;
    return element;
}

function createMessageImage(imageName) {
    if (!IMAGE_NAME_PATTERN.test(imageName || "")) {
        return null;
    }

    const image = document.createElement("img");
    image.className = "message-image";
    image.src = `/user_images/${encodeURIComponent(imageName)}`;
    image.alt = "Изображение пользователя";
    return image;
}

function createPendingIndicator() {
    const indicator = document.createElement("span");
    indicator.className = "typing-indicator";
    indicator.setAttribute("aria-label", "AgroChat готовит ответ");
    return indicator;
}

function createActionButton(messageId, action) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `message-action ${action}`;
    button.dataset.messageId = messageId;
    button.dataset.action = action;
    if (action === "regenerate") {
        button.setAttribute("aria-label", "Сгенерировать ответ повторно");
    } else {
        button.textContent = "Повторить запрос";
    }
    button.addEventListener("click", () => {
        messageActionHandler?.(messageId, action);
    });
    return button;
}

function createMessageMeta(message) {
    const meta = document.createElement("div");
    meta.className = "message-meta";

    const time = document.createElement("time");
    time.dateTime = message.createdAt;
    time.textContent = new Intl.DateTimeFormat("ru", {
        hour: "2-digit",
        minute: "2-digit",
    }).format(new Date(message.createdAt));
    meta.append(time);

    if (message.status === "error") {
        const status = document.createElement("span");
        status.textContent = "Ошибка";
        meta.append(status);
    }
    return meta;
}

export function createMessageElement(message) {
    const item = document.createElement("li");
    item.className = message.role === "user" ? "userInput" : "assistant-message animateBubble";
    item.dataset.messageId = message.id;
    item.dataset.status = message.status;

    const content = document.createElement("div");
    if (message.image) {
        const image = createMessageImage(message.image);
        if (image) {
            content.append(image);
        }
    }

    if (message.status === "pending") {
        content.className = "bot__output";
        content.append(createPendingIndicator());
    } else {
        content.className = message.role === "assistant" ? "bot__output" : "message-content";
        content.append(createMessageText(message.text));
    }

    item.append(content);
    item.append(createMessageMeta(message));
    if (message.role === "assistant" && message.status === "sent") {
        item.append(createActionButton(message.id, "regenerate"));
    }
    if (message.role === "assistant" && message.status === "error") {
        item.append(createActionButton(message.id, "retry"));
    }
    return item;
}

export function renderMessages(container, messages) {
    container.replaceChildren();
    if (messages.length === 0) {
        const welcome = document.createElement("li");
        welcome.className = "bot__output1 bot__output--standard";
        welcome.textContent = "Привет! Я демонстрационная версия AgroChat. Задайте вопрос, чтобы проверить интерфейс.";
        container.append(welcome);
        return;
    }
    container.append(...messages.map(createMessageElement));
}

export function scrollChatToBottom(scroller) {
    requestAnimationFrame(() => {
        scroller.scrollTop = scroller.scrollHeight;
    });
}

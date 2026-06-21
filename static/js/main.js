import { ApiError, requestChat, uploadImage, validateImage } from "./api.js?v=20260621";
import { renderMessages, scrollChatToBottom, setMessageActionHandler } from "./chat.js?v=20260621-2";
import {
    clearMessages,
    createMessage,
    loadMessages,
    removeLegacyHistory,
    saveMessages,
    updateMessage,
} from "./storage.js?v=20260621";
import { initializeTheme, toggleTheme } from "./theme.js?v=20260621-3";

const elements = {
    form: document.querySelector("#chatForm"),
    input: document.querySelector("#textInput"),
    fileInput: document.querySelector("#upload"),
    attachLabel: document.querySelector(".attach-button"),
    preview: document.querySelector("#imagePreview"),
    previewImage: document.querySelector("#imagePreviewContent"),
    previewName: document.querySelector("#imagePreviewName"),
    removeImageButton: document.querySelector("#removeImageButton"),
    sendButton: document.querySelector("#sendBtn"),
    stopButton: document.querySelector("#stopButton"),
    error: document.querySelector("#formError"),
    requestStatus: document.querySelector("#requestStatus"),
    toastRegion: document.querySelector("#toastRegion"),
    chatList: document.querySelector("#chatlist"),
    scroller: document.querySelector("#scroller"),
    infoButton: document.querySelector("#infoWrapper"),
    infoMenu: document.querySelector("#dialogueInfoWrapper"),
    clearButton: document.querySelector("#clearChatButton"),
    themeButton: document.querySelector(".dark-theme"),
    modal: document.querySelector("#modal"),
    acceptButton: document.querySelector("#acceptBtn"),
};

let messages = loadMessages().map((message) => (
    message.status === "pending"
        ? { ...message, text: "Запрос был прерван. Его можно повторить", status: "error" }
        : message
));
let currentController = null;
let previewUrl = null;

function persistAndRender() {
    messages = saveMessages(messages);
    renderMessages(elements.chatList, messages);
    scrollChatToBottom(elements.scroller);
}

function showFormError(message = "") {
    elements.error.textContent = message;
}

function showToast(message, type = "info") {
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    elements.toastRegion.replaceChildren(toast);
    window.setTimeout(() => toast.remove(), 4500);
}

function setRequestState(active, status = "") {
    elements.sendButton.disabled = active;
    elements.stopButton.hidden = !active;
    elements.requestStatus.textContent = status;
    elements.chatList.setAttribute("aria-busy", String(active));
}

function beginRequest(status) {
    currentController = new AbortController();
    setRequestState(true, status);
    return currentController;
}

function endRequest(controller) {
    if (currentController === controller) {
        currentController = null;
        setRequestState(false);
    }
}

function getErrorMessage(error) {
    return error instanceof ApiError
        ? error.message
        : "Произошла непредвиденная ошибка. Попробуйте снова";
}

function clearImageSelection() {
    if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        previewUrl = null;
    }
    elements.fileInput.value = "";
    elements.attachLabel.textContent = "Выбрать изображение";
    elements.preview.hidden = true;
    elements.previewImage.removeAttribute("src");
    elements.previewName.textContent = "";
}

function showImagePreview(file) {
    if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
    }
    previewUrl = URL.createObjectURL(file);
    elements.previewImage.src = previewUrl;
    elements.previewName.textContent = file.name;
    elements.attachLabel.textContent = file.name;
    elements.preview.hidden = false;
}

function resetComposer() {
    elements.form.reset();
    clearImageSelection();
    elements.input.style.height = "";
}

function resizeTextarea() {
    elements.input.style.height = "auto";
    elements.input.style.height = `${Math.min(elements.input.scrollHeight, 160)}px`;
}

function validateComposer(text, file) {
    if (!text && !file) {
        throw new ApiError("Введите сообщение или выберите изображение", { code: "validation_error" });
    }
    if (text && text.length <= 2) {
        throw new ApiError("Сообщение должно содержать больше двух символов", { code: "validation_error" });
    }
    validateImage(file);
}

async function submitMessage() {
    if (currentController) {
        return;
    }

    const text = elements.input.value.trim();
    const file = elements.fileInput.files[0] || null;
    let pendingMessage = null;

    try {
        validateComposer(text, file);
        showFormError();
    } catch (error) {
        const message = getErrorMessage(error);
        showFormError(message);
        showToast(message, "error");
        return;
    }

    const controller = beginRequest(file ? "Загружаем изображение…" : "Отправляем сообщение…");

    try {
        const imageName = file ? await uploadImage(file, { signal: controller.signal }) : null;
        const userMessage = createMessage("user", { text, image: imageName });
        pendingMessage = createMessage("assistant", { status: "pending" });
        messages.push(userMessage, pendingMessage);
        persistAndRender();
        resetComposer();
        setRequestState(true, "AgroChat готовит ответ…");

        const response = await requestChat(messages, {
            imageName,
            signal: controller.signal,
        });
        messages = updateMessage(messages, pendingMessage.id, {
            text: response.text,
            image: response.image,
            status: "sent",
        });
        persistAndRender();
    } catch (error) {
        const message = getErrorMessage(error);
        if (pendingMessage) {
            messages = updateMessage(messages, pendingMessage.id, {
                text: message,
                status: "error",
            });
            persistAndRender();
        }
        showToast(message, error.code === "aborted" ? "info" : "error");
    } finally {
        endRequest(controller);
    }
}

async function repeatAssistantMessage(messageId, regenerate = false) {
    if (currentController) {
        return;
    }

    const messageIndex = messages.findIndex((message) => message.id === messageId && message.role === "assistant");
    if (messageIndex === -1) {
        return;
    }

    const relatedUserMessage = messages
        .slice(0, messageIndex)
        .reverse()
        .find((message) => message.role === "user");
    const controller = beginRequest(regenerate ? "Готовим другой ответ…" : "Повторяем запрос…");

    try {
        messages = updateMessage(messages, messageId, { text: "", status: "pending" });
        persistAndRender();
        const response = await requestChat(messages, {
            imageName: relatedUserMessage?.image || null,
            regenerate,
            signal: controller.signal,
        });
        messages = updateMessage(messages, messageId, {
            text: response.text,
            image: response.image,
            status: "sent",
        });
    } catch (error) {
        const text = getErrorMessage(error);
        messages = updateMessage(messages, messageId, { text, status: "error" });
        showToast(text, error.code === "aborted" ? "info" : "error");
    } finally {
        persistAndRender();
        endRequest(controller);
    }
}

function setInfoMenuOpen(open) {
    elements.infoMenu.hidden = !open;
    elements.infoButton.setAttribute("aria-expanded", String(open));
}

elements.form.addEventListener("submit", (event) => {
    event.preventDefault();
    submitMessage();
});

elements.input.addEventListener("input", resizeTextarea);
elements.input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        elements.form.requestSubmit();
    }
});

elements.fileInput.addEventListener("change", () => {
    const file = elements.fileInput.files[0];
    if (!file) {
        clearImageSelection();
        return;
    }
    try {
        validateImage(file);
        showFormError();
        showImagePreview(file);
    } catch (error) {
        clearImageSelection();
        const message = getErrorMessage(error);
        showFormError(message);
        showToast(message, "error");
    }
});

elements.removeImageButton.addEventListener("click", () => {
    clearImageSelection();
    elements.fileInput.focus();
});

elements.stopButton.addEventListener("click", () => currentController?.abort());

setMessageActionHandler((messageId, action) => {
    repeatAssistantMessage(messageId, action === "regenerate");
});

document.querySelectorAll("[data-example]").forEach((button) => {
    button.addEventListener("click", () => {
        elements.input.value = button.dataset.example;
        resizeTextarea();
        elements.input.focus();
    });
});

elements.infoButton.addEventListener("click", () => {
    setInfoMenuOpen(elements.infoMenu.hidden);
});

document.addEventListener("click", (event) => {
    if (!elements.infoMenu.hidden && !elements.infoMenu.contains(event.target) && !elements.infoButton.contains(event.target)) {
        setInfoMenuOpen(false);
    }
});

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !elements.infoMenu.hidden) {
        setInfoMenuOpen(false);
        elements.infoButton.focus();
    }
});

elements.clearButton.addEventListener("click", () => {
    clearMessages();
    messages = [];
    persistAndRender();
    setInfoMenuOpen(false);
    showToast("История чата очищена");
});

elements.themeButton.addEventListener("click", () => toggleTheme(elements.themeButton));

elements.acceptButton.addEventListener("click", () => {
    localStorage.setItem("agrochat.privacyAccepted", "true");
    elements.modal.hidden = true;
    elements.input.focus();
});

removeLegacyHistory();
initializeTheme(elements.themeButton);
elements.modal.hidden = localStorage.getItem("agrochat.privacyAccepted") === "true";
renderMessages(elements.chatList, messages);
scrollChatToBottom(elements.scroller);
if (!elements.modal.hidden) {
    elements.acceptButton.focus();
}

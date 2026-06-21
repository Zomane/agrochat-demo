import asyncio
import hashlib
import random

from fastapi import HTTPException

from backend.config import settings


DEMO_RESPONSES = (
    "Демонстрационный режим работает без оригинальной AI-модели. Интерфейс получил ваш вопрос и корректно обработал запрос.",
    "Сейчас агрономическая модель недоступна. Этот mock-ответ показывает работу чата и backend API, но не является профессиональной рекомендацией.",
    "Запрос успешно дошёл до сервера. Для настоящей рекомендации потребовались бы подключённая модель и проверенная база агрономических знаний.",
)

IMAGE_RESPONSE = (
    "Изображение успешно получено. Распознавание заболеваний растений отключено в demo-режиме, "
    "поскольку оригинальная модель классификации недоступна."
)

REGENERATED_RESPONSE = (
    "Это альтернативный демонстрационный ответ. Повторная генерация работает, "
    "но настоящая AI-модель в этой версии не подключена."
)


async def generate_demo_response(
    message: str,
    has_image: bool = False,
    regenerate: bool = False,
) -> str:
    if settings.ai_mode != "mock":
        raise HTTPException(status_code=503, detail="AI-сервис недоступен")

    delay_min, delay_max = sorted((settings.mock_delay_min, settings.mock_delay_max))
    await asyncio.sleep(random.uniform(delay_min, delay_max))

    normalized_message = message.lower().strip()
    if normalized_message == "demo-error":
        raise HTTPException(status_code=503, detail="Тестовая ошибка demo-сервиса")

    if has_image:
        return IMAGE_RESPONSE

    if regenerate:
        return REGENERATED_RESPONSE

    if any(greeting in normalized_message for greeting in ("привет", "здравствуй", "добрый день")):
        return "Здравствуйте! Я работаю в демонстрационном режиме и показываю возможности интерфейса AgroChat."

    response_index = int(hashlib.sha256(normalized_message.encode()).hexdigest(), 16) % len(DEMO_RESPONSES)
    return DEMO_RESPONSES[response_index]

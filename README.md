# AgroChat Demo

Демонстрационная версия интерфейса агрономического чат-помощника. Проект показывает работу полноценного чата, загрузку изображений и взаимодействие frontend с FastAPI, но вместо недоступной AI-модели использует mock-сервис.

## Project Context and My Contribution

Изначально AgroChat разрабатывался командой для компании «Щёлково Агрохим». В исходном проекте моей зоной ответственности был frontend приложения:

- разработка интерфейса чата и отображения истории сообщений
- реализация отправки запросов и загрузки изображений
- создание светлой и тёмной тем
- адаптация интерфейса для мобильных устройств
- обработка состояний загрузки, ошибок, timeout и повторной отправки запроса
- сохранение истории и пользовательских настроек в localStorage

AI-модель исходного проекта размещалась на закрытом сервере компании, к которому у меня сейчас нет доступа. Поэтому для публикации проекта в портфолио приложение было переведено в демонстрационный режим: API-контракт сохранён, а ответы генерирует mock-сервис. Он позволяет показать пользовательский сценарий и взаимодействие frontend с backend, но не выполняет настоящее AI-распознавание и не предоставляет агрономические рекомендации.

Загруженные изображения сохраняются только во временном каталоге контейнера и могут исчезнуть после перезапуска приложения.

## Demo

- Live: https://agrochat-demo.goodwaitik.tech/ (если сайт не загружается, попробуйте включить впн)
- Backend/API: [healthcheck](https://agrochat-demo.goodwaitik.tech/health)
- Repository: [github.com/Zomane/agrochat-demo](https://github.com/Zomane/agrochat-demo)

## Screenshots

Скриншоты интерфейса будут добавлены позже.

## Features

- Демонстрационный чат с несколькими типами mock-ответов и искусственной задержкой
- Отправка сообщений, повтор запроса и отмена активного запроса
- Загрузка и предпросмотр изображений JPEG, PNG и WebP размером до 5 МБ
- Проверка MIME-типа, расширения и сигнатуры загружаемого изображения
- История сообщений и настройки темы в `localStorage`
- Светлая и тёмная темы на основе CSS-переменных
- Состояния загрузки, timeout, ошибки API и недоступности backend
- Адаптивный интерфейс для разных типов устройств
- Доступная HTML-разметка: семантические элементы, ARIA-атрибуты и управление с клавиатуры
- Docker-конфигурация для воспроизводимого запуска и деплоя

## Tech Stack

**Frontend:**

- HTML5
- CSS3
- JavaScript
- Web Storage API
- Fetch API и AbortController

**Backend:**

- Python 3.12
- FastAPI
- Uvicorn
- Pydantic
- Pytest и HTTPX
- Docker

## Project Structure

```text
agrochat-demo/
├── backend/
│   ├── config.py          # Конфигурация из переменных окружения
│   └── mock_ai.py         # Демонстрационные ответы вместо AI-модели
├── static/
│   ├── css/               # Стили и адаптивная вёрстка
│   ├── img/               # Изображения и favicon
│   ├── js/
│   │   ├── api.js         # HTTP-запросы и ошибки API
│   │   ├── chat.js        # Отображение сообщений
│   │   ├── main.js        # Инициализация и логика интерфейса
│   │   ├── storage.js     # История и настройки в localStorage
│   │   └── theme.js       # Переключение темы
│   ├── resources/         # Иконки и дополнительные файлы
│   └── index.html         # Главная страница
├── tests/
│   └── test_api.py        # Тесты backend API
├── main.py                # FastAPI-приложение и endpoint'ы
├── Dockerfile             # Сборка production-контейнера
├── requirements.txt       # Production-зависимости
└── requirements-dev.txt   # Зависимости для тестирования
```

## Getting Started

### Clone Repository

```bash
git clone https://github.com/Zomane/agrochat-demo.git
cd agrochat-demo
```

### Install Dependencies

Создайте виртуальное окружение и установите зависимости:

```bash
python -m venv .venv
```

Windows PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements-dev.txt
```

Linux/macOS:

```bash
source .venv/bin/activate
python -m pip install -r requirements-dev.txt
```

### Environment Variables

Для запуска используются следующие переменные окружения:

```env
AI_MODE=mock
HOST=0.0.0.0
PORT=8000
MOCK_DELAY_MIN=0.5
MOCK_DELAY_MAX=1.5
LOG_LEVEL=INFO
```

Все переменные имеют значения по умолчанию, поэтому для локального запуска настраивать их необязательно. Пример конфигурации находится в `.env.example`. 

### Run Project

```bash
python main.py
```

После запуска приложение доступно по адресу [http://localhost:8000](http://localhost:8000), а healthcheck — по адресу [http://localhost:8000/health](http://localhost:8000/health).

### Run with Docker

```bash
docker build -t agrochat-demo .
docker run --rm -p 8000:8000 --env-file .env.example agrochat-demo
```

## Scripts

```bash
# Запустить приложение
python main.py

# Запустить тесты
python -m pytest -q

# Собрать Docker-образ
docker build -t agrochat-demo .

# Запустить Docker-контейнер
docker run --rm -p 8000:8000 agrochat-demo
```

## Future Improvements

- Подключить реальную AI-модель или внешний AI API вместо mock-сервиса.
- Добавить постоянное объектное хранилище для пользовательских изображений.
- Расширить набор frontend- и интеграционных тестов.
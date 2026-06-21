import os

os.environ["CORS_ORIGINS"] = "https://portfolio.example"
os.environ["MOCK_DELAY_MIN"] = "0"
os.environ["MOCK_DELAY_MAX"] = "0"

from fastapi.testclient import TestClient

from main import app


client = TestClient(app)
PNG_IMAGE = b"\x89PNG\r\n\x1a\n" + b"demo image content"


def test_health_contract():
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "mode": "mock"}


def test_request_contract():
    response = client.post(
        "/request",
        json={
            "userMessages": ["text: Как работает демо?"],
            "botMessages": [],
            "image": [None],
            "flags": [],
        },
    )

    assert response.status_code == 200
    assert set(response.json()) == {"text", "image"}
    assert isinstance(response.json()["text"], str)
    assert response.json()["image"] is None


def test_empty_request_uses_error_contract():
    response = client.post("/request", json={})

    assert response.status_code == 422
    assert response.json() == {
        "error": {
            "code": "http_error",
            "message": "Сообщение или изображение обязательно",
        }
    }


def test_demo_error_is_available_for_frontend_testing():
    response = client.post("/request", json={"userMessages": ["demo-error"]})

    assert response.status_code == 503
    assert response.json()["error"]["code"] == "http_error"


def test_valid_image_upload_contract():
    response = client.post(
        "/get_image_hash",
        files={"image": ("plant.png", PNG_IMAGE, "image/png")},
    )

    assert response.status_code == 200
    image_name = response.json()["imageName"]
    assert image_name.endswith(".png")
    assert "/" not in image_name

    stored_image = client.get(f"/user_images/{image_name}")
    chat_response = client.post(
        "/request",
        json={"image": [image_name]},
    )

    assert stored_image.status_code == 200
    assert stored_image.content == PNG_IMAGE
    assert chat_response.status_code == 200
    assert chat_response.json()["image"] is None
    assert isinstance(chat_response.json()["text"], str)


def test_spoofed_image_is_rejected():
    response = client.post(
        "/get_image_hash",
        files={"image": ("plant.png", b"not an image", "image/png")},
    )

    assert response.status_code == 415
    assert response.json()["error"]["code"] == "http_error"


def test_cors_allows_only_configured_origin():
    response = client.options(
        "/health",
        headers={
            "Origin": "https://portfolio.example",
            "Access-Control-Request-Method": "GET",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "https://portfolio.example"

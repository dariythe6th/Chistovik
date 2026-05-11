"""
Тестовое окружение: in-memory SQLite до импорта приложения.
"""
import os

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("SECRET_KEY", "pytest-secret-key")

import pytest
from fastapi.testclient import TestClient

from database import Base, engine
import main as main_module


@pytest.fixture(autouse=True)
def _fresh_db():
    """Изолированная схема перед каждым тестом."""
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    main_module._ensure_admin_user()
    yield


@pytest.fixture
def client() -> TestClient:
    return TestClient(main_module.app)

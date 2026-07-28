"""Configuração do backend do chatbot — lida do .env."""
import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class Settings:
    database_url: str
    ollama_base_url: str
    embedding_model: str
    embedding_dim: int
    ai_worker_base_url: str
    ai_worker_service_token: str
    ai_worker_priority: int
    telegram_bot_token: str


def load_settings() -> Settings:
    return Settings(
        database_url=os.environ["DATABASE_URL"],
        ollama_base_url=os.environ["OLLAMA_BASE_URL"],
        embedding_model=os.environ.get("EMBEDDING_MODEL", "bge-m3"),
        embedding_dim=int(os.environ.get("EMBEDDING_DIM", "1024")),
        ai_worker_base_url=os.environ["AI_WORKER_BASE_URL"],
        ai_worker_service_token=os.environ["AI_WORKER_SERVICE_TOKEN"],
        ai_worker_priority=int(os.environ.get("AI_WORKER_PRIORITY", "2")),
        telegram_bot_token=os.environ["TELEGRAM_BOT_TOKEN"],
    )

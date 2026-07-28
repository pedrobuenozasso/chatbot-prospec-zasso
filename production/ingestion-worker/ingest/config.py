"""Configuração do worker de ingestão — lida do .env."""
import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class Settings:
    faq_dir: str
    database_url: str
    ollama_base_url: str
    ollama_api_key: str
    embedding_model: str
    embedding_dim: int


def load_settings() -> Settings:
    return Settings(
        faq_dir=os.environ["FAQ_DIR"],
        database_url=os.environ["DATABASE_URL"],
        ollama_base_url=os.environ["OLLAMA_BASE_URL"],
        ollama_api_key=os.environ.get("OLLAMA_API_KEY", ""),
        embedding_model=os.environ.get("EMBEDDING_MODEL", "nomic-embed-text"),
        embedding_dim=int(os.environ.get("EMBEDDING_DIM", "768")),
    )

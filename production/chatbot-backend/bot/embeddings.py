"""
Cliente de embeddings — fala direto com o Ollama, igual o ingestion-worker.

Precisa ser o MESMO modelo usado na ingestão (bge-m3): a busca por similaridade
só funciona se a pergunta e os chunks foram projetados no mesmo espaço vetorial.
"""
import httpx

from bot.config import Settings


def embed(text: str, settings: Settings) -> list[float]:
    url = f"{settings.ollama_base_url.rstrip('/')}/api/embeddings"
    resp = httpx.post(
        url,
        json={"model": settings.embedding_model, "prompt": text},
        timeout=60.0,
    )
    resp.raise_for_status()
    vector = resp.json()["embedding"]
    if len(vector) != settings.embedding_dim:
        raise ValueError(
            f"Embedding com {len(vector)} dimensões, esperava {settings.embedding_dim} "
            f"(modelo '{settings.embedding_model}')."
        )
    return vector

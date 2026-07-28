"""
Cliente de embeddings — fala direto com o Ollama (API nativa /api/embeddings).

Por que não passa pelo sacf-ai-worker: aquele worker existe para servir geração
de texto SOB DEMANDA, em fila, com prioridade. Ingestão é um processo offline em
lote (roda quando o vault muda, não quando um cliente conversa) — não tem
motivo para competir por prioridade na fila de chat. Por isso este worker fala
com o Ollama diretamente, só para embeddings.
"""
import httpx

from ingest.config import Settings


def embed(text: str, settings: Settings) -> list[float]:
    url = f"{settings.ollama_base_url.rstrip('/')}/api/embeddings"
    headers = {"Authorization": f"Bearer {settings.ollama_api_key}"} if settings.ollama_api_key else {}
    resp = httpx.post(
        url,
        json={"model": settings.embedding_model, "prompt": text},
        headers=headers,
        timeout=60.0,
    )
    resp.raise_for_status()
    data = resp.json()
    vector = data["embedding"]
    if len(vector) != settings.embedding_dim:
        raise ValueError(
            f"Embedding com {len(vector)} dimensões, esperava {settings.embedding_dim} "
            f"(modelo '{settings.embedding_model}'). Ajuste EMBEDDING_DIM no .env."
        )
    return vector

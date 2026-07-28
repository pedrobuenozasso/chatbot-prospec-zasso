"""
Script de validação da busca vetorial — SEM LLM, SEM Telegram.

Só prova uma coisa: dado um texto de pergunta, a busca por similaridade no
pgvector devolve os chunks certos do banco. É o primeiro pedaço do que o
Chatbot Backend vai fazer ("busca chunks" na arquitetura original).

Uso:
    python -m ingest.search "como funciona a capina elétrica?"
    python -m ingest.search "é perigoso pra quem tá perto?" --limit 3
"""
import argparse

from ingest import db
from ingest.config import load_settings
from ingest.embeddings import embed


def search(question: str, limit: int = 5) -> list[dict]:
    settings = load_settings()
    vector = embed(question, settings)

    conn = db.connect(settings)
    try:
        rows = conn.execute(
            """
            SELECT d.faq_id, d.question, c.section, c.visibility, c.content,
                   (c.embedding <=> %s::vector) AS distance
            FROM chunks c
            JOIN documents d ON d.id = c.document_id
            ORDER BY distance ASC
            LIMIT %s
            """,
            (vector, limit),
        ).fetchall()
    finally:
        conn.close()

    return [
        {
            "faq_id": faq_id,
            "question": faq_question,
            "section": section,
            "visibility": visibility,
            "content": content,
            "distance": distance,
        }
        for faq_id, faq_question, section, visibility, content, distance in rows
    ]


def _print_results(question: str, results: list[dict]) -> None:
    print(f'\nPergunta: "{question}"\n')
    for i, r in enumerate(results, start=1):
        snippet = r["content"][:200].replace("\n", " ")
        print(f"{i}. [{r['distance']:.4f}] {r['faq_id']} — {r['section']} ({r['visibility']})")
        print(f"   FAQ: {r['question']}")
        print(f"   {snippet}...\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("question", help="pergunta de teste, em linguagem natural")
    parser.add_argument("--limit", type=int, default=5, help="quantos chunks retornar (default 5)")
    args = parser.parse_args()

    results = search(args.question, limit=args.limit)
    _print_results(args.question, results)

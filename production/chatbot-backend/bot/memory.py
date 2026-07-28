"""Memória persistente, sessões e idioma por chat do Telegram."""

import logging
import re
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from uuid import UUID

from psycopg.types.json import Jsonb

from bot import db
from bot.config import Settings
from bot.language import detect_language
from bot.retrieval import RetrievedChunk

logger = logging.getLogger(__name__)

_WINDOW_MESSAGES = 6
_LANGUAGE_LOCK_EVIDENCE = 3
_LANGUAGE_SWITCH_EVIDENCE = 2
_SESSION_INACTIVITY = timedelta(hours=3)
_MAX_CONTEXT_CHUNKS = 8
_ENGAGEMENT_THRESHOLD = 3
_LANGUAGE_CODES = {
    "pt", "en", "es", "de", "fr", "it", "nl", "ja", "ar", "zh",
    "ru", "pl", "sv", "no", "da", "fi",
}
_NON_EVIDENCE_ACTS = {
    "social_only",
    "positive_reaction",
    "neutral_acknowledgment",
    "negative_reaction",
}


@dataclass(frozen=True)
class ConversationMessage:
    role: str
    content: str
    created_at: datetime
    response_meta: dict | None


@dataclass(frozen=True)
class ConversationState:
    chat_id: int
    session_id: UUID
    session_started_at: datetime
    session_is_new: bool
    language: str | None
    language_locked: bool
    language_candidate: str | None
    language_evidence_count: int
    language_locked_at: datetime | None
    language_switch_candidate: str | None
    language_switch_evidence_count: int
    menu_sent_at: datetime | None
    last_activity_at: datetime | None
    handoff_priority: int
    exists: bool


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _state_from_row(
    chat_id: int,
    row: tuple,
    *,
    exists: bool,
    session_is_new: bool,
) -> ConversationState:
    (
        session_id,
        session_started_at,
        language,
        language_locked,
        language_candidate,
        language_evidence_count,
        language_locked_at,
        language_switch_candidate,
        language_switch_evidence_count,
        menu_sent_at,
        last_activity_at,
        handoff_priority,
    ) = row
    return ConversationState(
        chat_id=chat_id,
        session_id=session_id,
        session_started_at=session_started_at,
        session_is_new=session_is_new,
        language=language,
        language_locked=language_locked,
        language_candidate=language_candidate,
        language_evidence_count=language_evidence_count,
        language_locked_at=language_locked_at,
        language_switch_candidate=language_switch_candidate,
        language_switch_evidence_count=language_switch_evidence_count,
        menu_sent_at=menu_sent_at,
        last_activity_at=last_activity_at,
        handoff_priority=handoff_priority,
        exists=exists,
    )


_STATE_COLUMNS = """
    session_id, session_started_at, language, language_locked,
    language_candidate, language_evidence_count, language_locked_at,
    language_switch_candidate, language_switch_evidence_count,
    menu_sent_at, last_activity_at, handoff_priority
"""


def load_context(
    chat_id: int,
    settings: Settings,
) -> tuple[ConversationState, list[ConversationMessage]]:
    """Carrega estado + janela em uma conexão e abre nova sessão após 3h."""
    now = _now()
    with db.connection(settings) as conn:
        with conn.transaction():
            row = conn.execute(
                f"SELECT {_STATE_COLUMNS} FROM conversations "
                "WHERE chat_id = %s FOR UPDATE",
                (chat_id,),
            ).fetchone()
            existed = row is not None
            session_is_new = not existed

            if row is None:
                row = conn.execute(
                    f"INSERT INTO conversations (chat_id) VALUES (%s) "
                    f"RETURNING {_STATE_COLUMNS}",
                    (chat_id,),
                ).fetchone()
            else:
                last_activity_at = row[10]
                if (
                    last_activity_at is not None
                    and now - last_activity_at >= _SESSION_INACTIVITY
                ):
                    row = conn.execute(
                        f"""
                        UPDATE conversations
                        SET session_id = gen_random_uuid(),
                            session_started_at = now(),
                            menu_sent_at = NULL,
                            last_activity_at = now()
                        WHERE chat_id = %s
                        RETURNING {_STATE_COLUMNS}
                        """,
                        (chat_id,),
                    ).fetchone()
                    session_is_new = True

            state = _state_from_row(
                chat_id,
                row,
                exists=existed,
                session_is_new=session_is_new,
            )
            rows = conn.execute(
                """
                SELECT role, content, created_at, response_meta
                FROM conversation_messages
                WHERE chat_id = %s AND session_id = %s
                  AND COALESCE(response_meta ->> 'act', '')
                      <> 'engagement_handoff_notice'
                ORDER BY created_at DESC, id DESC
                LIMIT %s
                """,
                (chat_id, state.session_id, _WINDOW_MESSAGES),
            ).fetchall()

    window = [
        ConversationMessage(role, content, created_at, response_meta)
        for role, content, created_at, response_meta in reversed(rows)
    ]
    return state, window


def load_state(chat_id: int, settings: Settings) -> ConversationState:
    state, _ = load_context(chat_id, settings)
    return state


def load_window(chat_id: int, settings: Settings) -> list[ConversationMessage]:
    _, window = load_context(chat_id, settings)
    return window


def load_last_assistant_chunks(
    chat_id: int,
    session_id: UUID,
    settings: Settings,
) -> list[RetrievedChunk]:
    """Recupera conteúdo pelos IDs compactos, com fallback por content_hash."""
    with db.connection(settings) as conn:
        rows = conn.execute(
            """
            SELECT selected.id, selected.content_hash, d.faq_id, d.question,
                   selected.section, selected.visibility, selected.content,
                   refs.distance
            FROM conversation_messages m
            JOIN conversation_message_chunks refs ON refs.message_id = m.id
            JOIN LATERAL (
                SELECT c.*
                FROM chunks c
                WHERE c.id = refs.chunk_id OR c.content_hash = refs.content_hash
                ORDER BY (c.id = refs.chunk_id) DESC
                LIMIT 1
            ) selected ON true
            JOIN documents d ON d.id = selected.document_id
            WHERE m.chat_id = %s
              AND m.session_id = %s
              AND m.role = 'assistant'
              AND m.id = (
                  SELECT m2.id
                  FROM conversation_messages m2
                  WHERE m2.chat_id = %s
                    AND m2.session_id = %s
                    AND EXISTS (
                        SELECT 1 FROM conversation_message_chunks r2
                        WHERE r2.message_id = m2.id
                    )
                  ORDER BY m2.created_at DESC, m2.id DESC
                  LIMIT 1
              )
            ORDER BY refs.rank
            """,
            (chat_id, session_id, chat_id, session_id),
        ).fetchall()

    return [
        RetrievedChunk(
            chunk_id=chunk_id,
            content_hash=content_hash,
            faq_id=faq_id,
            question=question,
            section=section,
            visibility=visibility,
            content=content,
            distance=distance,
        )
        for (
            chunk_id,
            content_hash,
            faq_id,
            question,
            section,
            visibility,
            content,
            distance,
        ) in rows
    ]


def merge_chunks(
    new_chunks: list[RetrievedChunk],
    prev_chunks: list[RetrievedChunk],
) -> list[RetrievedChunk]:
    seen: set[tuple[str, str]] = set()
    merged: list[RetrievedChunk] = []
    for chunk in [*new_chunks, *prev_chunks]:
        key = (chunk.faq_id, chunk.section)
        if key in seen:
            continue
        seen.add(key)
        merged.append(chunk)
        if len(merged) >= _MAX_CONTEXT_CHUNKS:
            break
    return merged


def _is_language_evidence(text: str, act: str) -> bool:
    if act in _NON_EVIDENCE_ACTS:
        return False
    words = re.findall(r"[^\W\d_]+", text, flags=re.UNICODE)
    return len(words) >= 2 and len(text.strip()) >= 8


def _persist_language(
    chat_id: int,
    settings: Settings,
    *,
    language: str,
    candidate: str | None,
    evidence_count: int,
    locked: bool,
    switch_candidate: str | None = None,
    switch_count: int = 0,
    refresh_locked_at: bool = False,
) -> None:
    with db.connection(settings) as conn:
        with conn.transaction():
            conn.execute(
                """
                UPDATE conversations
                SET language = %s,
                    language_candidate = %s,
                    language_evidence_count = %s,
                    language_locked = %s,
                    language_locked_at = CASE
                        WHEN %s THEN now()
                        ELSE language_locked_at
                    END,
                    language_switch_candidate = %s,
                    language_switch_evidence_count = %s,
                    last_activity_at = now()
                WHERE chat_id = %s
                """,
                (
                    language,
                    candidate,
                    evidence_count,
                    locked,
                    refresh_locked_at,
                    switch_candidate,
                    switch_count,
                    chat_id,
                ),
            )


def resolve_language(
    chat_id: int,
    question: str,
    state: ConversationState,
    window: list[ConversationMessage],
    settings: Settings,
    detected_language: str | None = None,
    requested_language: str | None = None,
    act: str = "knowledge_question",
) -> str:
    """Persiste idioma, trava por evidência e permite troca intencional."""
    requested = requested_language if requested_language in _LANGUAGE_CODES else None
    detected = detected_language if detected_language in _LANGUAGE_CODES else None

    if detected is None:
        accumulated = "\n".join(
            [m.content for m in window if m.role == "user"] + [question]
        )
        detected = detect_language(accumulated, settings)
    if detected not in _LANGUAGE_CODES:
        detected = state.language or "pt"

    if requested:
        _persist_language(
            chat_id,
            settings,
            language=requested,
            candidate=requested,
            evidence_count=_LANGUAGE_LOCK_EVIDENCE,
            locked=True,
            refresh_locked_at=True,
        )
        return requested

    reliable = _is_language_evidence(question, act)

    if state.language_locked and state.language:
        if reliable and detected != state.language:
            same_switch = state.language_switch_candidate == detected
            switch_count = state.language_switch_evidence_count + 1 if same_switch else 1
            if switch_count >= _LANGUAGE_SWITCH_EVIDENCE:
                _persist_language(
                    chat_id,
                    settings,
                    language=detected,
                    candidate=detected,
                    evidence_count=_LANGUAGE_LOCK_EVIDENCE,
                    locked=True,
                    refresh_locked_at=True,
                )
            else:
                _persist_language(
                    chat_id,
                    settings,
                    language=state.language,
                    candidate=state.language_candidate,
                    evidence_count=state.language_evidence_count,
                    locked=True,
                    switch_candidate=detected,
                    switch_count=switch_count,
                )
            # A mensagem atual já recebe resposta no idioma claramente detectado.
            return detected

        if state.language_switch_evidence_count:
            _persist_language(
                chat_id,
                settings,
                language=state.language,
                candidate=state.language_candidate,
                evidence_count=state.language_evidence_count,
                locked=True,
            )
        return state.language

    if not reliable:
        return state.language or state.language_candidate or detected

    same_candidate = state.language_candidate == detected
    evidence_count = state.language_evidence_count + 1 if same_candidate else 1
    should_lock = evidence_count >= _LANGUAGE_LOCK_EVIDENCE
    _persist_language(
        chat_id,
        settings,
        language=detected,
        candidate=detected,
        evidence_count=evidence_count,
        locked=should_lock,
        refresh_locked_at=should_lock,
    )
    return detected


def _ensure_conversation(
    conn,
    chat_id: int,
    session_id: UUID,
) -> None:
    conn.execute(
        """
        INSERT INTO conversations (chat_id, session_id)
        VALUES (%s, %s)
        ON CONFLICT (chat_id) DO UPDATE SET last_activity_at = now()
        """,
        (chat_id, session_id),
    )


def record_turn(
    chat_id: int,
    session_id: UUID,
    user_message: str,
    assistant_message: str,
    chunks_used: list[RetrievedChunk],
    settings: Settings,
    response_meta: dict[str, object] | None = None,
    assistant_followups: list[
        tuple[str, dict[str, object] | None]
    ] | None = None,
) -> None:
    """Grava o turno e somente referências compactas aos chunks utilizados."""
    with db.connection(settings) as conn:
        with conn.transaction():
            _ensure_conversation(conn, chat_id, session_id)
            conn.execute(
                """
                INSERT INTO conversation_messages
                    (chat_id, session_id, role, content)
                VALUES (%s, %s, 'user', %s)
                """,
                (chat_id, session_id, user_message),
            )
            assistant_id = conn.execute(
                """
                INSERT INTO conversation_messages
                    (chat_id, session_id, role, content, response_meta)
                VALUES (%s, %s, 'assistant', %s, %s)
                RETURNING id
                """,
                (
                    chat_id,
                    session_id,
                    assistant_message,
                    Jsonb(response_meta) if response_meta else None,
                ),
            ).fetchone()[0]
            with conn.cursor() as cur:
                cur.executemany(
                    """
                    INSERT INTO conversation_message_chunks
                        (message_id, chunk_id, content_hash, rank, distance)
                    VALUES (%s, %s, %s, %s, %s)
                    """,
                    [
                        (
                            assistant_id,
                            chunk.chunk_id,
                            chunk.content_hash,
                            rank,
                            chunk.distance,
                        )
                        for rank, chunk in enumerate(chunks_used)
                    ],
                )
            for followup, followup_meta in assistant_followups or []:
                conn.execute(
                    """
                    INSERT INTO conversation_messages
                        (chat_id, session_id, role, content, response_meta)
                    VALUES (%s, %s, 'assistant', %s, %s)
                    """,
                    (
                        chat_id,
                        session_id,
                        followup,
                        Jsonb(followup_meta) if followup_meta else None,
                    ),
                )


def record_non_rag_turn(
    chat_id: int,
    session_id: UUID,
    user_message: str,
    assistant_message: str,
    settings: Settings,
    response_meta: dict[str, object] | None = None,
) -> None:
    with db.connection(settings) as conn:
        with conn.transaction():
            _ensure_conversation(conn, chat_id, session_id)
            conn.execute(
                """
                INSERT INTO conversation_messages
                    (chat_id, session_id, role, content)
                VALUES (%s, %s, 'user', %s)
                """,
                (chat_id, session_id, user_message),
            )
            conn.execute(
                """
                INSERT INTO conversation_messages
                    (chat_id, session_id, role, content, response_meta)
                VALUES (%s, %s, 'assistant', %s, %s)
                """,
                (
                    chat_id,
                    session_id,
                    assistant_message,
                    Jsonb(response_meta) if response_meta else None,
                ),
            )


def count_rag_turns(
    chat_id: int,
    session_id: UUID,
    settings: Settings,
) -> int:
    with db.connection(settings) as conn:
        row = conn.execute(
            """
            SELECT count(*)
            FROM conversation_messages m
            WHERE m.chat_id = %s
              AND m.session_id = %s
              AND m.role = 'assistant'
              AND EXISTS (
                  SELECT 1 FROM conversation_message_chunks refs
                  WHERE refs.message_id = m.id
              )
            """,
            (chat_id, session_id),
        ).fetchone()
    return row[0] if row else 0


def should_offer_engagement_handoff(
    state: ConversationState,
    settings: Settings,
) -> bool:
    if state.handoff_priority > 0:
        return False
    return (
        count_rag_turns(state.chat_id, state.session_id, settings)
        >= _ENGAGEMENT_THRESHOLD
    )


def mark_handoff(
    chat_id: int,
    priority: int,
    reason: str,
    settings: Settings,
) -> None:
    with db.connection(settings) as conn:
        with conn.transaction():
            conn.execute(
                """
                INSERT INTO conversations
                    (chat_id, handoff_priority, handoff_reason, handoff_requested_at)
                VALUES (%s, %s, %s, now())
                ON CONFLICT (chat_id) DO UPDATE SET
                    handoff_reason = CASE
                        WHEN EXCLUDED.handoff_priority > conversations.handoff_priority
                        THEN EXCLUDED.handoff_reason
                        ELSE conversations.handoff_reason
                    END,
                    handoff_requested_at = CASE
                        WHEN EXCLUDED.handoff_priority > conversations.handoff_priority
                        THEN now()
                        ELSE conversations.handoff_requested_at
                    END,
                    handoff_priority = GREATEST(
                        conversations.handoff_priority,
                        EXCLUDED.handoff_priority
                    ),
                    last_activity_at = now()
                """,
                (chat_id, priority, reason),
            )


def mark_menu_sent(chat_id: int, settings: Settings) -> None:
    with db.connection(settings) as conn:
        with conn.transaction():
            conn.execute(
                """
                INSERT INTO conversations (chat_id, menu_sent_at)
                VALUES (%s, now())
                ON CONFLICT (chat_id) DO UPDATE SET
                    menu_sent_at = now(),
                    last_activity_at = now()
                """,
                (chat_id,),
            )


def should_resend_menu(state: ConversationState) -> bool:
    return state.session_is_new

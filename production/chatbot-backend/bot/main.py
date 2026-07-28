"""
Ponto de entrada do bot. Loop de long polling: pergunta chega do Telegram,
busca+LLM rodam, resposta volta pro mesmo chat.

Uso:
    python -m bot.main
"""
import logging
import threading
import time

from bot import cleanup, db, instance_lock, telegram, tone
from bot.config import load_settings
from bot.handler import answer_messages, handle_command

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger(__name__)
# A URL da API do Telegram contém o token do bot; não deixe o log INFO do httpx
# registrar a URL completa em terminal ou arquivo.
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)

_TYPING_INTERVAL_SECONDS = 4.0  # Telegram some com o indicador depois de ~5s sem renovar


def _keep_typing(chat_id: int, settings, stop: threading.Event) -> None:
    """Roda numa thread separada enquanto answer_question() bloqueia — o resto do
    projeto é síncrono de propósito (ver debt.md), então isso é a forma mais simples
    de manter o indicador vivo sem reescrever o pipeline pra async.

    TODO(migração WhatsApp): essa lógica de "renovar a cada N segundos" é
    específica do Telegram (o indicador dele expira sozinho); o equivalente no
    WhatsApp pode ter regras diferentes de expiração/disparo — revisar junto
    com telegram.send_typing_action() na hora de trocar de canal."""
    while not stop.wait(_TYPING_INTERVAL_SECONDS):
        try:
            telegram.send_typing_action(chat_id, settings)
        except Exception as exc:
            logger.warning("Falha ao renovar indicador de digitando: %s", exc)


def run() -> None:
    settings = load_settings()
    lock_conn = instance_lock.acquire(settings)
    if lock_conn is None:
        logger.error(
            "Outra instância do bot já está ativa. Esta execução será encerrada "
            "para evitar respostas duplicadas."
        )
        return

    logger.info("Bot iniciado. Aguardando mensagens no Telegram (Ctrl+C para parar)...")

    cleanup_stop = threading.Event()
    cleanup_thread = threading.Thread(
        target=cleanup.scheduler_loop,
        args=(cleanup_stop, settings),
        daemon=True,
        name="conversation-cleanup",
    )
    cleanup_thread.start()

    offset: int | None = None
    try:
        while True:
            try:
                updates = telegram.get_updates(offset, settings)
            except Exception as exc:
                logger.error("Falha ao buscar updates do Telegram: %s", exc)
                time.sleep(5)  # sem isso, API fora do ar viraria loop apertado de reconexão
                continue

            for update in updates:
                offset = update["update_id"] + 1
                message = update.get("message")
                if not message or "text" not in message:
                    continue

                chat_id = message["chat"]["id"]
                question = message["text"]
                logger.info("[chat %s] pergunta: %r", chat_id, question)

                command_answer = handle_command(question)
                if command_answer is not None:
                    answers = [command_answer]
                else:
                    try:
                        telegram.send_typing_action(chat_id, settings)
                    except Exception as exc:
                        logger.warning("Falha ao enviar indicador de digitando: %s", exc)

                    stop_typing = threading.Event()
                    typing_thread = threading.Thread(
                        target=_keep_typing, args=(chat_id, settings, stop_typing), daemon=True
                    )
                    typing_thread.start()
                    try:
                        answers = answer_messages(chat_id, question, settings)
                    except Exception as exc:
                        logger.exception("Erro inesperado ao responder: %s", exc)
                        answers = ["Tive um problema técnico. Pode tentar de novo?"]
                    finally:
                        stop_typing.set()
                        typing_thread.join(timeout=1.0)

                try:
                    for answer in answers:
                        answer = tone.sanitize_reply(answer)
                        telegram.send_message(chat_id, answer, settings)
                        logger.info(
                            "[chat %s] resposta enviada (%d chars).",
                            chat_id,
                            len(answer),
                        )
                except Exception as exc:
                    logger.error("Falha ao enviar resposta pro Telegram: %s", exc)
    finally:
        cleanup_stop.set()
        cleanup_thread.join(timeout=2.0)
        instance_lock.release(lock_conn)
        db.close_pool()


if __name__ == "__main__":
    try:
        run()
    except KeyboardInterrupt:
        logger.info("Bot encerrado.")

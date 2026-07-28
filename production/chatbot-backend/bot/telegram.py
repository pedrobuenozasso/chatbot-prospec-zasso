"""
Cliente mínimo da API do Telegram — long polling (getUpdates), sem webhook.

Long polling em vez de webhook porque não expõe porta pública nem precisa de
HTTPS/domínio pra testar — ideal pro MVP local. Trocar para webhook depois é
só mudar este módulo; o resto do bot não muda.
"""
import httpx

from bot.config import Settings


def _base_url(settings: Settings) -> str:
    return f"https://api.telegram.org/bot{settings.telegram_bot_token}"


def get_updates(offset: int | None, settings: Settings, timeout: int = 30) -> list[dict]:
    """Bloqueia até chegar mensagem nova ou o timeout do long polling estourar."""
    params = {"timeout": timeout, "allowed_updates": '["message"]'}
    if offset is not None:
        params["offset"] = offset

    resp = httpx.get(f"{_base_url(settings)}/getUpdates", params=params, timeout=timeout + 10)
    resp.raise_for_status()
    data = resp.json()
    if not data.get("ok"):
        raise RuntimeError(f"Telegram getUpdates falhou: {data}")
    return data["result"]


def send_message(chat_id: int, text: str, settings: Settings) -> None:
    resp = httpx.post(
        f"{_base_url(settings)}/sendMessage",
        json={"chat_id": chat_id, "text": text},
        timeout=15.0,
    )
    resp.raise_for_status()


def send_typing_action(chat_id: int, settings: Settings) -> None:
    """O Telegram some com o indicador depois de ~5s — precisa ser chamado de novo
    em loop enquanto a resposta ainda está sendo processada (ver bot/main.py).

    TODO(migração WhatsApp): isto é 100% Telegram (`sendChatAction`). O WhatsApp
    Business API tem um mecanismo equivalente, mas com formato de chamada
    diferente — ao trocar o MVP de Telegram pra WhatsApp, este módulo inteiro
    precisa de uma reimplementação, não só um ajuste de URL."""
    resp = httpx.post(
        f"{_base_url(settings)}/sendChatAction",
        json={"chat_id": chat_id, "action": "typing"},
        timeout=10.0,
    )
    resp.raise_for_status()

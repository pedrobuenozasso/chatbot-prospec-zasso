import { config } from './config.mjs';

// Humaniza a conversa sem criar espera excessiva. Perguntas curtas parecem ser
// digitadas rapidamente; respostas maiores recebem um pouco mais de tempo.
export function typingDelayFor(text) {
  const words = String(text).trim().split(/\s+/).filter(Boolean).length;
  const calculated = config.replyTypingMinMs + words * 24;
  return Math.max(config.replyTypingMinMs, Math.min(calculated, config.replyTypingMaxMs));
}

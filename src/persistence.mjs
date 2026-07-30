import { processInboundMessage } from './agent.mjs';
import { config } from './config.mjs';
import {
  findConversation,
  getConversation,
  restoreConversation,
} from './conversation.mjs';
import {
  databaseStatus,
  loadConversationState,
  persistConversationState,
  persistInteraction,
} from './database.mjs';
import { recordEvent } from './observability.mjs';

function stateTimestamp(state) {
  const timestamp = Date.parse(state?.updatedAt || '');
  return Number.isFinite(timestamp) ? timestamp : 0;
}

async function withDatabaseFallback(task, eventKind) {
  try {
    return await task();
  } catch (error) {
    recordEvent(eventKind, { errorType: error?.name || 'Error' });
    if (config.databaseRequired) throw error;
    console.error(`Falha de persistência PostgreSQL; usando fallback local (${error?.name || 'Error'}).`);
    return null;
  }
}

async function reconcileConversation(payload) {
  if (!databaseStatus().ready) return;
  const remote = await withDatabaseFallback(
    () => loadConversationState(payload.conversationId),
    'database_read_error',
  );
  const local = findConversation(payload.conversationId, {
    firstName: payload.firstName,
    language: payload.language,
  });

  if (remote && (!local || stateTimestamp(remote) > stateTimestamp(local))) {
    restoreConversation(payload.conversationId, remote);
    return;
  }
  if (local && (!remote || stateTimestamp(local) > stateTimestamp(remote))) {
    await withDatabaseFallback(
      () => persistConversationState(payload.conversationId, local, payload.channel),
      'database_reconciliation_error',
    );
  }
}

export async function processInboundPersisted(payload) {
  await reconcileConversation(payload);
  const result = await processInboundMessage(payload);
  const state = getConversation(payload.conversationId, {
    firstName: payload.firstName,
    language: result.language,
  });
  await withDatabaseFallback(
    () => persistInteraction(payload, result, state),
    'database_write_error',
  );
  return result;
}

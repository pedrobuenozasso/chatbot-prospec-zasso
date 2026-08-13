import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const workflow = JSON.parse(readFileSync(resolve('n8n/weekend-handoff-sunday.json'), 'utf8'));

test('workflow de domingo começa inativo, no fuso correto e usa o template aprovado', () => {
  assert.equal(workflow.active, false);
  assert.equal(workflow.settings.timezone, 'America/Sao_Paulo');
  const schedule = workflow.nodes.find((node) => node.name === 'Domingo às 18h');
  assert.equal(schedule.parameters.rule.interval[0].expression, '0 18 * * 0');
  const meta = workflow.nodes.find((node) => node.name === 'Enviar template pela Meta');
  assert.match(meta.parameters.url, /graph\.facebook\.com\/v25\.0\/1199510373253284\/messages/);
  assert.match(meta.parameters.body, /type: 'template'/);
  assert.match(meta.parameters.body, /quick_reply/);
  assert.match(meta.parameters.body, /pt_BR/);
  assert.equal(meta.credentials.httpHeaderAuth.name, 'Zasso Meta Cloud API');
  assert.doesNotMatch(JSON.stringify(workflow), /Bearer\s+[A-Za-z0-9]/);
});

test('workflow reserva, envia e registra cada protocolo sequencialmente', () => {
  const names = new Set(workflow.nodes.map((node) => node.name));
  for (const name of [
    'Reservar fila elegível',
    'Expandir fila',
    'Uma entrega por vez',
    'Enviar template pela Meta',
    'Classificar resultado',
    'Registrar resultado',
  ]) assert.equal(names.has(name), true);
  const claim = workflow.nodes.find((node) => node.name === 'Reservar fila elegível');
  const result = workflow.nodes.find((node) => node.name === 'Registrar resultado');
  assert.match(claim.parameters.url, /\/v1\/weekend-handoffs\/claim$/);
  assert.match(result.parameters.url, /\/v1\/weekend-handoffs\/result$/);
  assert.equal(claim.credentials.httpHeaderAuth.name, 'Zasso Chatbot API');
  assert.equal(result.credentials.httpHeaderAuth.name, 'Zasso Chatbot API');
});

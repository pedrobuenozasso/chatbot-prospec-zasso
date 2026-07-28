import test from 'node:test';
import assert from 'node:assert/strict';
import { buildIndex, search } from '../src/rag.mjs';

const cases = [
  ['Como a capina elétrica funciona?', 'FAQ-018'],
  ['Quais são os principais produtos da Zasso?', 'FAQ-013'],
  ['A tecnologia da Zasso é patenteada?', 'FAQ-010'],
  ['Quanto tempo demora para aparecer o resultado?', 'FAQ-040'],
  ['A tecnologia funciona em plantas adultas?', 'FAQ-072'],
  ['É perigoso trabalhar com alta tensão?', 'FAQ-133'],
  ['A Zasso afeta a biodiversidade?', 'FAQ-239'],
];

test('a base pública é indexada', async () => {
  const result = await buildIndex();
  assert.equal(result.documents, 274);
  assert.ok(result.chunks > 1000);
});

for (const [question, expectedFaq] of cases) {
  test(`recupera ${expectedFaq} para: ${question}`, async () => {
    const [result] = await search(question, 1);
    assert.equal(result.faqId, expectedFaq);
  });
}

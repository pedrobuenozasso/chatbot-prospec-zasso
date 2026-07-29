import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildIndex, search } from '../src/rag.mjs';

const faqDirectory = join(process.cwd(), 'knowledge/public-faq');

function officialFaqCases() {
  return readdirSync(faqDirectory)
    .filter((file) => file.endsWith('.md'))
    .sort()
    .map((file) => {
      const source = readFileSync(join(faqDirectory, file), 'utf8');
      const faqId = source.match(/^faq_id:\s*"?([^"\n]+)"?/m)?.[1];
      const question = source.match(/^question:\s*"(.*)"$/m)?.[1]?.replace(/\\"/g, '"');
      return { faqId, question };
    });
}

const portugueseSensitiveCases = [
  ['A capina elétrica mata minhocas?', 'FAQ-217'],
  ['A tecnologia esteriliza o solo?', 'FAQ-211'],
  ['A Zasso prejudica o solo?', 'FAQ-210'],
  ['A capina elétrica afeta microorganismos do solo?', 'FAQ-212'],
  ['Afeta fungos benéficos?', 'FAQ-215'],
  ['Afeta bactérias do solo?', 'FAQ-216'],
  ['Afeta nematoides?', 'FAQ-218'],
  ['Afeta insetos no solo?', 'FAQ-219'],
  ['Muda o pH do solo?', 'FAQ-220'],
  ['Compacta o solo?', 'FAQ-223'],
  ['Causa erosão?', 'FAQ-224'],
  ['Contamina a água?', 'FAQ-226'],
  ['Contamina água subterrânea?', 'FAQ-227'],
  ['Afeta a próxima cultura?', 'FAQ-228'],
  ['Tem efeito acumulado?', 'FAQ-229'],
  ['Deixa resíduos químicos?', 'FAQ-240'],
  ['Prejudica polinizadores?', 'FAQ-235'],
  ['Prejudica pássaros?', 'FAQ-237'],
  ['Prejudica vida aquática?', 'FAQ-238'],
  ['Prejudica plantas não alvo?', 'FAQ-233'],
  ['É compatível com agricultura regenerativa?', 'FAQ-241'],
  ['Funciona em plantio direto?', 'FAQ-243'],
  ['Reduz deriva?', 'FAQ-247'],
  ['Substitui glifosato?', 'FAQ-255'],
  ['Substitui paraquat?', 'FAQ-256'],
  ['Substitui herbicida totalmente?', 'FAQ-252'],
  ['Reduz uso de herbicidas?', 'FAQ-253'],
  ['Funciona onde herbicida falha?', 'FAQ-258'],
  ['Pode usar perto da água?', 'FAQ-267'],
  ['Precisa de registro químico?', 'FAQ-263'],
  ['Tem período de reentrada?', 'FAQ-261'],
  ['Capina elétrica é mais barata que herbicida?', 'FAQ-250'],
  ['Capina elétrica é mais cara que herbicida?', 'FAQ-251'],
];

test('recupera as 274 perguntas oficiais da base pública', async () => {
  await buildIndex();
  const cases = officialFaqCases();
  assert.equal(cases.length, 274);

  const failures = [];
  for (const { faqId, question } of cases) {
    const [result] = await search(question, 1);
    if (result?.faqId !== faqId) failures.push({ faqId, question, actual: result?.faqId });
  }
  assert.deepEqual(failures, []);
});

test('recupera perguntas sensíveis em português', async () => {
  const failures = [];
  for (const [question, expectedFaq] of portugueseSensitiveCases) {
    const [result] = await search(question, 1);
    if (result?.faqId !== expectedFaq) failures.push({ question, expectedFaq, actual: result?.faqId });
  }
  assert.deepEqual(failures, []);
});

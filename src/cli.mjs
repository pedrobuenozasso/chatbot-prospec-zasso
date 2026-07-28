import { answer, buildIndex, search } from './rag.mjs';

const [command, ...argumentsList] = process.argv.slice(2);

try {
  if (command === 'index') {
    const result = await buildIndex();
    console.log(`Índice concluído: ${result.documents} FAQs, ${result.chunks} trechos.`);
  } else if (command === 'ask') {
    const question = argumentsList.join(' ').trim();
    if (!question) throw new Error('Uso: npm run ask -- "O que é a Zasso?"');
    const result = await answer(question);
    console.log(`\n${result.answer}`);
    if (result.sources.length) {
      console.log('\nFontes:');
      result.sources.forEach((source) => console.log(`- ${source.faqId}: ${source.question} (${source.score})`));
    }
  } else if (command === 'search') {
    const question = argumentsList.join(' ').trim();
    if (!question) throw new Error('Uso: npm run search -- "O que é a Zasso?"');
    const results = await search(question);
    results.forEach((result) => console.log(`${result.score.toFixed(3)} | ${result.faqId} | ${result.question}`));
  } else {
    throw new Error('Use: npm run index | npm run ask -- "pergunta" | npm run search -- "pergunta"');
  }
} catch (error) {
  console.error(`Erro: ${error.message}`);
  process.exitCode = 1;
}

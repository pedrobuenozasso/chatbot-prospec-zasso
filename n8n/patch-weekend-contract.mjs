import { readFileSync, writeFileSync } from 'node:fs';

const [inputPath, outputPath] = process.argv.slice(2);
if (!inputPath || !outputPath) {
  throw new Error('Uso: node n8n/patch-weekend-contract.mjs entrada.json saida.json');
}

const parsed = JSON.parse(readFileSync(inputPath, 'utf8'));
const workflows = Array.isArray(parsed) ? parsed : [parsed];
if (workflows.length !== 1) throw new Error('O arquivo deve conter exatamente um workflow.');
const workflow = workflows[0];
const node = workflow.nodes?.find((candidate) => candidate.name === 'Consultar Chatbot Zasso');
if (!node) throw new Error('Node Consultar Chatbot Zasso não encontrado.');

const body = String(node.parameters?.body || '');
if (!body.includes('recipientNumber: $json.number')) {
  const target = 'language: $json.language, text: $json.text })';
  if (!body.includes(target)) throw new Error('Contrato esperado do chatbot não encontrado.');
  node.parameters.body = body.replace(
    target,
    'language: $json.language, text: $json.text, recipientNumber: $json.number })',
  );
}

writeFileSync(outputPath, `${JSON.stringify(workflows, null, 2)}\n`, { mode: 0o600 });
console.log(`Workflow ${workflow.id} preparado sem alterar credenciais.`);

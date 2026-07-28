# Índice de documentação

## Entrada recomendada

- [Comece aqui — transferência do projeto](START_HERE.md)

Esse é o ponto de entrada para uma nova pessoa ou agente. Ele define ordem de
leitura, estado confirmado, primeiro dia e prioridades.

## Fonte de verdade atual

- [Chatbot Zasso — documentação técnica atual](chatbot_documentacao_tecnica_atual.md)

Esse documento foi conferido contra o código e o schema em 27/07/2026. Ele deve
ser atualizado quando mudar o comportamento do bot, seu contrato de dados ou
seu procedimento operacional.

## Backlog e riscos

- [Dívida técnica](../debt.md)

O `debt.md` contém trabalho remanescente. Algumas frentes já possuem MVP
funcional; a tabela no início do arquivo diferencia implementação parcial de
funcionalidade ainda inexistente.

## Documentos de sustentação

- [Arquitetura e decisões](architecture/README.md)
- [Contrato do AI Worker](contracts/ai-worker.md)
- [Contrato de dados](contracts/database.md)
- [Desenvolvimento local](runbooks/local-development.md)
- [Diagnóstico](runbooks/troubleshooting.md)
- [Qualidade e aceitação](quality/acceptance.md)
- [Ownership e roadmap](ownership-and-roadmap.md)
- [Glossário](glossary.md)

Esses documentos complementam a fonte de verdade. Se um contrato executável
(código, migration ou resposta real de serviço) divergir, investigue e atualize
a documentação; não preserve silenciosamente duas versões.

## Documentos históricos

Os arquivos abaixo registram decisões e análises anteriores, mas não descrevem
necessariamente o código atual:

- `doc1_worker_ia.txt`
- `doc2_chatbot_arquitetura.txt`
- `doc2_chatbot_resumo_executivo.txt`
- documentos derivados em `docs/word/`

Em caso de divergência, prevalecem, nesta ordem:

1. comportamento verificado por teste;
2. código e migrations atuais;
3. documentação técnica atual;
4. documentos históricos.

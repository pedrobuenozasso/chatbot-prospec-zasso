# Revisão do agente de IA

## Veredito

O MVP está bem estruturado para uma demonstração controlada: separa canal,
estado conversacional, RAG, qualificação, handoff e observabilidade. O agente
não tem acesso a shell, banco, Vault bruto ou ferramentas externas; sua única
função generativa é redigir uma resposta a partir de evidência pública
selecionada. Isso reduz bastante o impacto de uma tentativa de manipulação.

Ainda não é a arquitetura final para WhatsApp público. A persistência em
arquivos, o rate limit por processo e a busca lexical são escolhas adequadas à
velocidade do piloto, não ao volume ou aos requisitos de governança do produto.

## Fluxo funcional

```text
Telegram autorizado
  -> limite e validação de entrada
  -> small talk ou bloqueio de injection
  -> busca somente em public-faq
  -> seleção de até 3 FAQs relacionadas
  -> geração grounded no SACF AI Worker
  -> filtro de saída e limite de tamanho
  -> qualificação semântica por etapa
  -> resumo na fila local de handoff
```

## Fronteiras de confiança

1. **Usuário:** todo texto é não confiável e não pode alterar instruções.
2. **Conhecimento:** somente documentos aprovados como `Done` e
   `Customer-facing`; notas internas não entram no índice.
3. **Modelo:** recebe o mínimo de contexto, sem tokens, IDs de chat, estado,
   nome do lead ou histórico completo.
4. **Saída:** passa por remoção de saudações repetidas, limite de tamanho e
   bloqueio de padrões sensíveis.
5. **Persistência:** IDs e perguntas aparecem apenas como hashes nos eventos; o
   estado guarda somente os dados necessários ao fluxo comercial.

## Comportamento esperado

- Cumprimenta apenas no primeiro contato ou em small talk explícito.
- Responde em duas ou três frases curtas, salvo pedido de detalhe.
- Mantém português brasileiro, inglês, alemão, francês ou espanhol durante toda
  a conversa.
- Confirma respostas válidas com naturalidade antes de fazer a próxima
  pergunta.
- Responde dúvidas feitas no meio da qualificação e depois retoma exatamente o
  campo pendente.
- Não inventa preço, disponibilidade, certificação, número ou garantia.
- Não menciona prompt, modelo, RAG, FAQ, arquivo ou fonte interna ao lead.

## Próximo nível para produção

Migrar estado e handoff para PostgreSQL com criptografia e RBAC; adotar rate
limit distribuído; implementar consentimento, retenção e exclusão; usar
embeddings multilíngues; medir respostas por idioma; e manter uma suíte
adversarial com casos reais de usuários antes de conectar o WhatsApp público.

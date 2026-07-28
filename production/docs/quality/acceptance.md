# Qualidade, testes e critérios de aceitação

## 1. Pirâmide recomendada

1. **unitários determinísticos:** router, composição, tom, idioma, validação;
2. **contrato:** payload/resposta do AI Worker, embedding e schema;
3. **integração:** PostgreSQL real + serviços simulados;
4. **conversa:** roteiros multiturm com classificação real em ambiente de teste;
5. **smoke de canal:** Telegram ponta a ponta.

Hoje a maior cobertura está no primeiro nível. Os demais são lacunas.

## 2. Comando atual

```powershell
cd D:\Arquivos\ChatBot\chatbot-backend
.\venv\Scripts\Activate.ps1
python -m unittest discover -s tests -v
```

Snapshot de 27/07/2026: 34 testes aprovados.

## 3. Matriz mínima antes de release

| Área | Cenário | Resultado esperado |
|---|---|---|
| Comando | `/start` | texto fixo; sem classificador, RAG ou persistência |
| Saudação | “Oi, boa tarde, tudo bem?” | espelha período e responde bem-estar sem repetição |
| Institucional | “Aqui é a Zasso?” | confirma diretamente, sem retrieval |
| Conhecimento | “Como funciona?” | RAG, resposta curta, chunks auditáveis |
| Reação | “Nossa, que massa!” | microresposta humana, sem RAG |
| Reação + dúvida | “Legal! É seguro?” | acolhe brevemente e responde a dúvida |
| Continuidade | “É mais profunda?” | responde “sim/não/depende” primeiro |
| Explicação | “Não entendi, explica melhor” | reformula; não apenas reage positivamente |
| Aceitação | “Adoraria” | não escolhe uma opção; oferece caminhos concretos |
| Meta | “Posso continuar falando com você?” | acolhe; não repete conhecimento |
| Idioma | sequência consistente em outro idioma | acumula evidência e trava no limiar |
| Troca explícita | “responda em inglês” | troca imediatamente |
| Segurança | prompt extraction | recusa sem revelar instruções |
| Handoff | pedido de pessoa | registra prioridade; mensagem atenciosa sem prazo falso |
| Falha | três saídas `length` | nenhuma parcial; handoff após limite |
| Duplicidade | replay do mesmo update | uma resposta — **ainda não atendido** |

## 4. Critérios de humanidade

“Humano” não significa aleatório ou prolixo. Uma resposta é aceitável quando:

- começa pela intenção principal da pessoa;
- reconhece emoção apenas quando ela existe;
- não usa elogio genérico para responder dúvida;
- evita reintroduzir a empresa/tecnologia sem necessidade;
- conecta o turno atual ao anterior;
- oferece duas ou três opções concretas quando pede escolha;
- usa no máximo dois emojis, somente `✨🚜⚡💡😊🌱`;
- varia sem criar promessas ou fatos;
- mantém tamanho proporcional à pergunta;
- encerra com pergunta apenas quando ela move a conversa.

Uma pergunta final genérica (“quer saber mais algum detalhe?”) reprova quando
não ajuda uma pessoa leiga a escolher o próximo assunto.

## 5. Rubrica de revisão de conversa

Pontue cada item de 0 a 2:

- correção factual;
- resposta direta;
- continuidade;
- naturalidade;
- concisão suficiente;
- próximo passo útil;
- segurança/promessas;
- ausência de repetição.

Bloqueadores, independentemente da nota:

- fato não sustentado;
- saída truncada;
- mensagem duplicada;
- segredo ou prompt interno;
- promessa operacional inexistente;
- handoff perdido;
- idioma errado após lock.

## 6. Dados de teste

- Use bot/chat dedicados a teste.
- Não use conversa de cliente real para regressão.
- Mascare `chat_id`, nome, username e telefone em artefatos.
- Limpeza deve atingir somente o alvo de teste.
- Preserve uma suíte sintética versionada com entrada, contexto e expectativa;
  não versione respostas reais com dados pessoais.

## 7. Definition of Done

Uma mudança de comportamento só está concluída quando:

- requisito e não objetivo estão claros;
- existe teste automatizado da regra;
- testes atuais passam;
- caso multiturm relevante foi revisado;
- falha/degradação está definida;
- documentação e `debt.md` foram atualizados;
- migration/contrato tem compatibilidade considerada;
- bot de teste foi parado;
- nenhuma credencial ou dado pessoal entrou no diff.

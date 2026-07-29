# Qualificação comercial do MVP

## Fluxo

1. O lead faz a primeira pergunta.
2. O bot responde à pergunta, com saudação apenas no primeiro contato.
3. Em uma segunda mensagem, pergunta se a atuação é no agronegócio ou em área urbana.
4. Para ambos os segmentos, registra a região/cidade.
5. Para **agro**, coleta cultivo/aplicação e área aproximada em hectares.
6. Para **urbano**, coleta o perfil: prefeitura, prestador de serviços ou outro.
7. Ao concluir, monta um Lead com o resumo e o envia ao Salesforce.

O bot faz uma pergunta por vez. Se não conseguir responder a dúvida inicial com
segurança, usa um fallback cuidadoso e ainda inicia a qualificação.

## Salesforce

O envio direto é ativado somente com estas variáveis no `.env`:

```bash
SALESFORCE_INSTANCE_URL=https://sua-instancia.my.salesforce.com
SALESFORCE_ACCESS_TOKEN=token-de-integracao
SALESFORCE_API_VERSION=v60.0
```

Sem essas credenciais, o Lead completo é escrito em `.outbox/`, uma fila local
ignorada pelo Git. Isso permite testar o fluxo sem expor dados ou criar Leads
acidentalmente no CRM.

O payload usa os campos padrão `FirstName`, `LastName`, `Company` e
`Description`. Antes da produção, o comercial deve definir o mapeamento dos
campos personalizados e as regras de duplicidade do Salesforce.

# Política da base de conhecimento

## Permitido no MVP

Somente arquivos importados de:

```text
raw_md/Sales/FAQ/**/*.md
```

Condições obrigatórias no frontmatter:

```yaml
status: Done
audience: Customer-facing
```

Durante a importação, qualquer conteúdo a partir do título `## Internal Notes` é removido. O bot deve responder com base em `Short Answer`, `Detailed Answer`, `What This Means for Customers`, `Safe Sales Wording` e `Caveats`.

## Bloqueado no MVP

Não importar, indexar ou usar em prompts:

- `Zasso/HR/` e qualquer informação de pessoas;
- produtos com prefixos `_Internal`, `_Prototype`, `_Roadmap` ou `_Subsystem`;
- `Zasso/Feedbacks/`;
- `Patent/`;
- `Weekly Review/`;
- documentos de estratégia, finanças, clientes, parceiros, roadmap ou engenharia interna;
- anexos, imagens e qualquer arquivo sem classificação explícita para cliente.

## Regra de resposta

Quando não houver evidência suficiente na base permitida, o bot deve informar que não encontrou uma confirmação e oferecer encaminhar a pergunta para a equipe. Ele não pode completar a resposta com conhecimento próprio.

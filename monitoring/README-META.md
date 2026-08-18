# Monitoramento de campanhas Meta

O painel consulta a Marketing API em modo somente leitura. O token nunca é enviado ao navegador e as respostas ficam em cache por cinco minutos para reduzir chamadas e evitar limites desnecessários.

## Variáveis obrigatórias

```env
META_ADS_ACCESS_TOKEN=
META_AD_ACCOUNT_ID=act_120243639696980766
META_GRAPH_API_VERSION=v25.0
META_ADS_TIMEOUT_MS=12000
META_ADS_CACHE_SECONDS=300
```

Use um token de usuário do sistema com a permissão `ads_read`. Não use `ads_management`.

## Dados apresentados

- status das campanhas;
- investimento, alcance, impressões, frequência, cliques, CTR, CPC e CPM;
- conversas reportadas pela atribuição da Meta, quando disponíveis;
- consolidação diária e por campanha.

Os números desta aba vêm da Meta. Eles não representam ainda a atribuição individual entre campanha e protocolo do chatbot.

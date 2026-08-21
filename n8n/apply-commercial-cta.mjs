import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const META_PHONE_NUMBER_ID = '1199510373253284';
export const COMMERCIAL_WHATSAPP_NUMBER = '5511967702212';
export const META_CREDENTIAL_ID = 'MetaZassoCTA2026';
export const META_CREDENTIAL_NAME = 'Zasso Meta Cloud API';

export const prepareResponsesCode = `const inbound = $('Normalizar e Filtrar Evento').first().json;
const result = $json;
if (result.duplicate === true || !Array.isArray(result.messages)) return [];

const language = String(result.language || inbound.language || 'pt-BR').toLowerCase();
const languageKey = language.startsWith('en')
  ? 'en'
  : language.startsWith('de')
    ? 'de'
    : language.startsWith('fr')
      ? 'fr'
      : language.startsWith('es')
        ? 'es'
        : 'pt';
const ctaCopy = {
  pt: {
    body: 'Toque no botão abaixo para continuar com nossa equipe comercial. Sua mensagem já estará preenchida.',
    label: 'Falar com a equipe'
  },
  en: {
    body: 'Tap the button below to continue with our sales team. Your message will already be filled in.',
    label: 'Talk to our team'
  },
  de: {
    body: 'Tippen Sie auf die Schaltfläche unten, um mit unserem Vertriebsteam fortzufahren. Ihre Nachricht ist bereits ausgefüllt.',
    label: 'Zum Vertrieb'
  },
  fr: {
    body: 'Touchez le bouton ci-dessous pour continuer avec notre équipe commerciale. Votre message sera déjà préremplie.',
    label: 'Contacter l’équipe'
  },
  es: {
    body: 'Toca el botón de abajo para continuar con nuestro equipo comercial. Tu mensaje ya estará preparado.',
    label: 'Hablar con el equipo'
  }
};
const segmentCopy = {
  pt: { agro: '🌾 Agro', urban: '🏙️ Área urbana' },
  en: { agro: '🌾 Agriculture', urban: '🏙️ Urban area' },
  de: { agro: '🌾 Landwirtschaft', urban: '🏙️ Stadtbereich' },
  fr: { agro: '🌾 Agriculture', urban: '🏙️ Zone urbaine' },
  es: { agro: '🌾 Agricultura', urban: '🏙️ Área urbana' }
};
const commercialPrefix = 'https://wa.me/${COMMERCIAL_WHATSAPP_NUMBER}?text=';

function commercialUrlFrom(text) {
  const start = text.indexOf(commercialPrefix);
  if (start < 0) return '';
  const tail = text.slice(start, start + 4096);
  let end = tail.length;
  for (const whitespace of [' ', '\\n', '\\r', '\\t']) {
    const position = tail.indexOf(whitespace);
    if (position >= 0) end = Math.min(end, position);
  }
  const candidate = tail.slice(0, end);
  const encodedSummary = candidate.slice(commercialPrefix.length);
  if (!encodedSummary
    || encodedSummary.length > 3500
    || encodedSummary.includes('&')
    || encodedSummary.includes('#')
    || !/^[A-Za-z0-9%!'()*._~-]+$/.test(encodedSummary)) return '';
  return candidate;
}

return result.messages
  .map((text) => String(text ?? '').trim())
  .filter(Boolean)
  .map((text, index) => {
    const ctaUrl = commercialUrlFrom(text);
    if (ctaUrl) {
      return { json: {
        instance: inbound.instance,
        number: inbound.number,
        messageType: 'commercial_cta',
        interactionKind: 'commercial_cta',
        text: ctaCopy[languageKey].body,
        ctaLabel: ctaCopy[languageKey].label,
        ctaUrl,
        delay: 4000,
        order: index
      } };
    }
    const isSegmentPrompt = result.stage === 'segment' && index === result.messages.length - 1;
    if (isSegmentPrompt) {
      return { json: {
        instance: inbound.instance,
        number: inbound.number,
        messageType: 'commercial_cta',
        interactionKind: 'segment',
        text: text.slice(0, 1024),
        segmentAgroLabel: segmentCopy[languageKey].agro,
        segmentUrbanLabel: segmentCopy[languageKey].urban,
        delay: 4000,
        order: index
      } };
    }
    return { json: {
      instance: inbound.instance,
      number: inbound.number,
      messageType: 'text',
      text: text.slice(0, 4000),
      delay: 4000,
      order: index
    } };
  });`;

function requiredNode(workflow, name) {
  const node = workflow.nodes.find((candidate) => candidate.name === name);
  if (!node) throw new Error(`Node obrigatório ausente: ${name}`);
  return node;
}

function upsertNode(workflow, node) {
  const index = workflow.nodes.findIndex((candidate) => candidate.name === node.name);
  if (index >= 0) {
    const credentials = workflow.nodes[index].credentials;
    workflow.nodes[index] = credentials && !node.credentials
      ? { ...node, credentials }
      : node;
  } else {
    workflow.nodes.push(node);
  }
}

export function applyCommercialCta(workflow, {
  credentialId = META_CREDENTIAL_ID,
  credentialName = META_CREDENTIAL_NAME,
  phoneNumberId = META_PHONE_NUMBER_ID,
} = {}) {
  const updated = structuredClone(workflow);
  const preparer = requiredNode(updated, 'Preparar Respostas');
  const loop = requiredNode(updated, 'Uma Mensagem por Vez');
  const evolution = requiredNode(updated, 'Enviar pela Evolution');
  const pause = requiredNode(updated, 'Pausa Natural');
  const [loopX, loopY] = loop.position;

  preparer.parameters.jsCode = prepareResponsesCode;

  upsertNode(updated, {
    parameters: {
      conditions: {
        options: {
          caseSensitive: true,
          leftValue: '',
          typeValidation: 'strict',
          version: 2,
        },
        conditions: [{
          id: 'c5cd13f9-0435-4cb0-bde8-86de1b750a2d',
          leftValue: '={{ $json.messageType }}',
          rightValue: 'commercial_cta',
          operator: { type: 'string', operation: 'equals' },
        }],
        combinator: 'and',
      },
      options: {},
    },
    id: 'b279c51c-b68c-45fb-b99a-318124e764a5',
    name: 'É CTA Comercial?',
    type: 'n8n-nodes-base.if',
    typeVersion: 2.2,
    position: [loopX + 240, loopY + 80],
  });

  upsertNode(updated, {
    parameters: {
      method: 'POST',
      url: `https://graph.facebook.com/v25.0/${phoneNumberId}/messages`,
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      sendHeaders: true,
      headerParameters: {
        parameters: [{ name: 'content-type', value: 'application/json' }],
      },
      sendBody: true,
      contentType: 'raw',
      rawContentType: 'application/json',
      body: "={{ JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to: $json.number, type: 'interactive', interactive: $json.interactionKind === 'segment' ? { type: 'button', body: { text: $json.text }, action: { buttons: [{ type: 'reply', reply: { id: 'zasso_segment:agro', title: $json.segmentAgroLabel } }, { type: 'reply', reply: { id: 'zasso_segment:urban', title: $json.segmentUrbanLabel } }] } } : { type: 'cta_url', body: { text: $json.text }, action: { name: 'cta_url', parameters: { display_text: $json.ctaLabel, url: $json.ctaUrl } } } }) }}",
      options: { timeout: 30000 },
    },
    id: '996f16cf-a93f-4d04-b49d-ff12dc6f020b',
    name: 'Enviar CTA pela Meta',
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    position: [loopX + 720, loopY],
    credentials: {
      httpHeaderAuth: { id: credentialId, name: credentialName },
    },
  });

  evolution.position = [loopX + 480, loopY + 160];
  pause.parameters.amount = 4;
  pause.position = [loopX + 480, loopY];
  updated.connections['Uma Mensagem por Vez'].main[1] = [{
    node: 'É CTA Comercial?',
    type: 'main',
    index: 0,
  }];
  updated.connections['É CTA Comercial?'] = {
    main: [
      [{ node: 'Pausa Natural', type: 'main', index: 0 }],
      [{ node: 'Enviar pela Evolution', type: 'main', index: 0 }],
    ],
  };
  updated.connections['Enviar pela Evolution'] = {
    main: [[{ node: 'Uma Mensagem por Vez', type: 'main', index: 0 }]],
  };
  updated.connections['Pausa Natural'] = {
    main: [[{ node: 'Enviar CTA pela Meta', type: 'main', index: 0 }]],
  };
  updated.connections['Enviar CTA pela Meta'] = {
    main: [[{ node: 'Uma Mensagem por Vez', type: 'main', index: 0 }]],
  };

  return updated;
}

export function publicApiPayload(workflow) {
  const allowedSettings = new Set([
    'callerPolicy',
    'errorWorkflow',
    'executionOrder',
    'executionTimeout',
    'saveDataErrorExecution',
    'saveDataSuccessExecution',
    'saveExecutionProgress',
    'saveManualExecutions',
    'timezone',
  ]);
  const settings = Object.fromEntries(
    Object.entries(workflow.settings || {})
      .filter(([key]) => allowedSettings.has(key)),
  );
  return {
    name: workflow.name,
    nodes: workflow.nodes,
    connections: workflow.connections,
    settings,
  };
}

async function main() {
  const source = readFileSync(0, 'utf8');
  const parsed = JSON.parse(source);
  const workflow = Array.isArray(parsed) ? parsed[0] : parsed;
  process.stdout.write(JSON.stringify(publicApiPayload(applyCommercialCta(workflow))));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}

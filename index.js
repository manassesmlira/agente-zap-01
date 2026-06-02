// index.js

import pensarNaResposta from './lib/geminiService.js';
import enviarMensagemCrm from './lib/crmService.js';

// Constantes para limites de segurança
const MAX_MESSAGE_LENGTH = 1000;
const WHATSAPP_MAX_MESSAGE_LENGTH = 4096;
const MAX_MESSAGE_AGE_SECONDS = 120;

const TIPOS_MIDIA = [
  'audio',
  'ptt',
  'image',
  'video',
  'document',
  'sticker'
];

export default async function handler(req, res) {
  console.log("Webhook: Função handler invocada.");

  // Headers de CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Método não permitido' }));
    return;
  }

  let requestBody;

  try {
    const chunks = [];

    for await (const chunk of req) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }

    requestBody = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch (parseError) {
    console.error("Webhook: Erro ao parsear corpo da requisição:", parseError);
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Corpo da requisição inválido' }));
    return;
  }

  try {
    if (!requestBody || !requestBody.number || (!requestBody.eventDetails && !requestBody.lastMessage)) {
      console.warn("Webhook: Corpo incompleto ou faltando campos essenciais.");
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        message: 'Corpo da requisição inválido ou faltando dados essenciais.'
      }));
      return;
    }

    const Nome = requestBody.name || 'Cliente';
    const Numero = String(requestBody.number || '');

    const tipoMensagem =
      requestBody.eventDetails?.type ||
      requestBody.lastMessage?.type ||
      requestBody.type ||
      '';

    // --- TRAVAS DE SEGURANÇA ---

    // 1. Evitar loop do próprio bot
    const isFromMe =
      requestBody.eventDetails?.id?.fromMe === true ||
      requestBody.eventDetails?.fromMe === true ||
      requestBody.lastMessage?.fromMe === true ||
      requestBody.fromMe === true;

    if (isFromMe) {
      console.log(`Webhook: Mensagem enviada pelo próprio bot (${Numero}). Ignorando.`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        message: "Loop evitado."
      }));
      return;
    }

    // 2. Ignorar grupos
    const isGroup =
      requestBody.isGroup === true ||
      requestBody.eventDetails?.isGroup === true ||
      requestBody.lastMessage?.isGroup === true ||
      Numero.includes('@g.us');

    if (isGroup) {
      console.log(`Webhook: Mensagem recebida de grupo (${Numero}). Ignorando.`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        message: "Mensagem de grupo ignorada."
      }));
      return;
    }

    // 3. Ignorar mensagens antigas
    const messageTimestamp =
      requestBody.timestamp ||
      requestBody.eventDetails?.timestamp ||
      requestBody.lastMessage?.timestamp;

    if (messageTimestamp) {
      let timestampSeconds = Number(messageTimestamp);

      // Se vier em milissegundos, converte para segundos
      if (timestampSeconds > 9999999999) {
        timestampSeconds = Math.floor(timestampSeconds / 1000);
      }

      const currentTimeSeconds = Math.floor(Date.now() / 1000);
      const messageAgeSeconds = currentTimeSeconds - timestampSeconds;

      if (messageAgeSeconds > MAX_MESSAGE_AGE_SECONDS) {
        console.log(`Webhook: Mensagem de ${Numero} muito antiga (${messageAgeSeconds}s). Ignorando.`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          message: "Mensagem antiga ignorada."
        }));
        return;
      }
    } else {
      console.warn(`Webhook: Timestamp da mensagem de ${Numero} não encontrado.`);
    }

    // 4. Placeholder: conversa assumida por humano
    const isConversationHandledByHuman = await checkIfConversationIsHandledByHuman(Numero);

    if (isConversationHandledByHuman) {
      console.log(`Webhook: Conversa com ${Numero} já está sendo tratada por humano. Ignorando.`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        message: "Conversa tratada por humano ignorada."
      }));
      return;
    }

    // 5. Placeholder: responder somente contatos novos
    const isNewContact = await checkIfNewContact(Numero);

    if (!isNewContact) {
      console.log(`Webhook: Contato ${Numero} não é novo. Ignorando.`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        message: "Contato existente ignorado."
      }));
      return;
    }

    // 6. Responder mídia com orientação, sem mandar para IA
    if (TIPOS_MIDIA.includes(tipoMensagem)) {
      console.log(`Webhook: Mensagem de mídia (${tipoMensagem}) recebida de ${Numero}. Respondendo com orientação.`);

      let respostaMidia = `Irmão, por aqui consigo te ajudar melhor com mensagens em texto.

Pode escrever sua dúvida em poucas palavras?`;

      if (
        tipoMensagem === 'image' ||
        tipoMensagem === 'document' ||
        tipoMensagem === 'video'
      ) {
        respostaMidia += `

Se for comprovante de pagamento, envie diretamente para a secretaria:
1198222-3315`;
      }

      const crmSuccess = await enviarMensagemCrm(Numero, respostaMidia);

      if (crmSuccess) {
        console.log(`Webhook: Orientação de mídia enviada para ${Numero}.`);
      } else {
        console.error(`Webhook: Falha ao enviar orientação de mídia para ${Numero}.`);
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        message: "Mensagem de mídia respondida."
      }));
      return;
    }

    // --- EXTRAÇÃO DA MENSAGEM DE TEXTO ---

    let mensagemDoLead = '';

    if (requestBody.lastMessage?.text) {
      mensagemDoLead = requestBody.lastMessage.text;
    } else if (requestBody.eventDetails?.body) {
      mensagemDoLead = requestBody.eventDetails.body;
    } else if (requestBody.body) {
      mensagemDoLead = requestBody.body;
    } else if (requestBody.text) {
      mensagemDoLead = requestBody.text;
    } else {
      mensagemDoLead = "Recebi uma mensagem não textual ou tipo desconhecido.";
      console.warn(`Webhook: Mensagem sem texto reconhecido de ${Numero}.`);
    }

    mensagemDoLead = String(mensagemDoLead || '').trim();

    if (!mensagemDoLead) {
      console.log(`Webhook: Mensagem vazia de ${Numero}. Ignorando.`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        message: "Mensagem vazia ignorada."
      }));
      return;
    }

    // 7. Limitar tamanho da entrada
    if (mensagemDoLead.length > MAX_MESSAGE_LENGTH) {
      console.warn(
        `Webhook: Mensagem de ${Numero} muito longa (${mensagemDoLead.length}). Truncando para ${MAX_MESSAGE_LENGTH}.`
      );
      mensagemDoLead = mensagemDoLead.substring(0, MAX_MESSAGE_LENGTH);
    }

    // --- PROCESSAMENTO COM IA ---

    console.log(`Webhook: Processando. Lead: ${Nome}, Número: ${Numero}, Mensagem: "${mensagemDoLead.substring(0, 80)}..."`);

    const resultadoIA = await pensarNaResposta(Nome, mensagemDoLead);

    if (!resultadoIA.success) {
      console.error(`Webhook: Erro na IA para ${Numero}: ${resultadoIA.error}. Nenhuma mensagem será enviada.`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        message: "Erro na IA, mensagem não enviada ao lead."
      }));
      return;
    }

    let mensagemParaEnviar = String(resultadoIA.text || '').trim();

    if (!mensagemParaEnviar) {
      console.warn(`Webhook: IA retornou resposta vazia para ${Numero}. Nenhuma mensagem será enviada.`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        message: "Resposta vazia da IA."
      }));
      return;
    }

    // 8. Limitar tamanho da saída
    if (mensagemParaEnviar.length > WHATSAPP_MAX_MESSAGE_LENGTH) {
      console.warn(
        `Webhook: Resposta da IA para ${Numero} muito longa (${mensagemParaEnviar.length}). Truncando.`
      );
      mensagemParaEnviar = mensagemParaEnviar.substring(0, WHATSAPP_MAX_MESSAGE_LENGTH);
    }

    // --- ENVIO AO CRM / WHATSAPP ---

    const crmSuccess = await enviarMensagemCrm(Numero, mensagemParaEnviar);

    if (crmSuccess) {
      console.log(`Webhook: Mensagem enviada ao CRM com sucesso para ${Numero}.`);
    } else {
      console.error(`Webhook: Falha ao enviar mensagem ao CRM para ${Numero}.`);
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      sent: crmSuccess
    }));

  } catch (erro) {
    console.error("Webhook: Erro interno no processamento:", erro);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: 'Erro interno no servidor'
    }));
  }
}

// --- FUNÇÕES PLACEHOLDER PARA REGRAS DE NEGÓCIO ---
// Em produção, implemente com CRM ou banco de dados.

async function checkIfConversationIsHandledByHuman(numero) {
  console.log(`[PLACEHOLDER] Verificando se a conversa com ${numero} está com humano...`);
  return false;
}

async function checkIfNewContact(numero) {
  console.log(`[PLACEHOLDER] Verificando se ${numero} é novo contato...`);
  return true;
}

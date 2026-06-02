// index.js

import pensarNaResposta from './lib/geminiService.js';
import enviarMensagemCrm from './lib/crmService.js';

// Constantes para limites de segurança
const MAX_MESSAGE_LENGTH = 1000; // Limite de caracteres para mensagens de entrada para a IA
const WHATSAPP_MAX_MESSAGE_LENGTH = 4096; // Limite de caracteres para mensagens de saída do WhatsApp
const MAX_MESSAGE_AGE_SECONDS = 120; // 2 minutos = 120 segundos

export default async function handler(req, res) {
  console.log("Webhook: Função handler invocada.");

  // 1. Headers de CORS (já presente e ok)
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

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
    // 2. Validação de requestBody e Campos Essenciais
    if (!requestBody || !requestBody.number || (!requestBody.eventDetails && !requestBody.lastMessage)) {
      console.warn("Webhook: Corpo da requisição incompleto ou faltando campos essenciais (number, eventDetails/lastMessage).");
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: 'Corpo da requisição inválido ou faltando dados essenciais.' }));
      return;
    }

    const Nome = requestBody.name || 'Cliente';
    const Numero = requestBody.number; // Número do remetente/grupo
    const isGroup = requestBody.isGroup === true; // Assumindo que o webhook informa se é grupo

    // --- TRAVAS DE SEGURANÇA E REGRAS DE NEGÓCIO ---

    // 3. Trava de Segurança Contra Loop (já existente, mantida)
    const isFromMe = requestBody.eventDetails?.id?.fromMe === true;
    if (isFromMe) {
      console.log(`Webhook: Mensagem enviada pelo bot (${Numero}). Ignorando para evitar loop.`);
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, message: "Loop evitado." }));
      return;
    }

    // 4. Não responder em grupos
    if (isGroup) {
      console.log(`Webhook: Mensagem recebida de um grupo (${Numero}). Ignorando.`);
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, message: "Mensagem de grupo ignorada." }));
      return;
    }

    // 5. Trava de Segurança para Mensagens Antigas (NOVA)
    // Assumindo que requestBody.timestamp é o timestamp da mensagem em segundos.
    // Ajuste para milissegundos se necessário (e.g., requestBody.timestamp * 1000).
    const messageTimestamp = requestBody.timestamp; // Verifique o nome correto do campo no seu webhook
    if (messageTimestamp) {
      const currentTimeSeconds = Math.floor(Date.now() / 1000); // Tempo atual em segundos
      const messageAgeSeconds = currentTimeSeconds - messageTimestamp;

      if (messageAgeSeconds > MAX_MESSAGE_AGE_SECONDS) {
        console.log(`Webhook: Mensagem de ${Numero} é muito antiga (${messageAgeSeconds}s). Ignorando.`);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, message: "Mensagem antiga ignorada." }));
        return;
      }
    } else {
      console.warn(`Webhook: Timestamp da mensagem de ${Numero} não encontrado. Não foi possível verificar a idade da mensagem.`);
    }

    // 6. Não responder conversas que eu mesmo já respondi ou estou respondendo
    const isConversationHandledByHuman = await checkIfConversationIsHandledByHuman(Numero); // Função a ser implementada
    if (isConversationHandledByHuman) {
      console.log(`Webhook: Conversa com ${Numero} já está sendo tratada por um humano. Ignorando.`);
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, message: "Conversa tratada por humano ignorada." }));
      return;
    }

    // 7. Responder somente a usuários novos (ou que não estão em atendimento humano)
    const isNewContact = await checkIfNewContact(Numero); // Função a ser implementada
    if (!isNewContact && !isConversationHandledByHuman) {
      console.log(`Webhook: Contato ${Numero} não é novo e não está em atendimento humano. Ignorando.`);
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, message: "Contato existente ignorado." }));
      return;
    }


    let mensagemDoLead = '';
    if (requestBody.lastMessage && requestBody.lastMessage.text) {
        mensagemDoLead = requestBody.lastMessage.text;
    } else if (requestBody.eventDetails && requestBody.eventDetails.body) {
        mensagemDoLead = requestBody.eventDetails.body;
    } else {
        // Ignorar stickers ou outros tipos de mídia que não sejam texto
        if (requestBody.eventDetails?.type === 'sticker' || requestBody.eventDetails?.type === 'image' || requestBody.eventDetails?.type === 'video') {
            console.log(`Webhook: Mensagem de mídia (${requestBody.eventDetails.type}) de ${Numero}. Ignorando.`);
            res.writeHead(200);
            res.end(JSON.stringify({ success: true, message: "Mensagem de mídia ignorada." }));
            return;
        }
        mensagemDoLead = "Recebi uma mensagem não textual ou tipo desconhecido.";
        console.warn(`Webhook: Mensagem não textual ou tipo desconhecido de ${Numero}. Processando como: "${mensagemDoLead}"`);
    }

    // 8. Limite de Caracteres para Mensagens de Entrada (para a IA)
    if (mensagemDoLead.length > MAX_MESSAGE_LENGTH) {
      console.warn(`Webhook: Mensagem do lead de ${Numero} muito longa (${mensagemDoLead.length} caracteres). Truncando para ${MAX_MESSAGE_LENGTH}.`);
      mensagemDoLead = mensagemDoLead.substring(0, MAX_MESSAGE_LENGTH);
    }

    // Processamento da IA
    console.log(`Webhook: Iniciando processamento. Lead: ${Nome}, Mensagem: "${mensagemDoLead.substring(0, 50)}..."`);
    const resultadoIA = await pensarNaResposta(Nome, mensagemDoLead); // Retorna { success: boolean, text?: string, error?: string }

    let mensagemParaEnviar;
    if (resultadoIA.success) {
      mensagemParaEnviar = resultadoIA.text;
    } else {
      // Se houve um erro na IA, enviamos uma mensagem de erro amigável.
      console.error(`Webhook: Erro na IA para ${Numero}: ${resultadoIA.error}`);
      mensagemParaEnviar = "Desculpe, tivemos uma instabilidade técnica. Pode repetir, por favor?";
      // Opcional: Notificar um administrador sobre o erro técnico aqui.
    }

    // 9. Limite de Caracteres para Mensagens de Saída (para o WhatsApp)
    if (mensagemParaEnviar.length > WHATSAPP_MAX_MESSAGE_LENGTH) {
      console.warn(`Webhook: Resposta da IA para ${Numero} muito longa (${mensagemParaEnviar.length} caracteres). Truncando para ${WHATSAPP_MAX_MESSAGE_LENGTH}.`);
      mensagemParaEnviar = mensagemParaEnviar.substring(0, WHATSAPP_MAX_MESSAGE_LENGTH) + "\n[Mensagem truncada]";
    }

    // Envio para CRM (que envia para o WhatsApp)
    const crmSuccess = await enviarMensagemCrm(Numero, mensagemParaEnviar);
    if (crmSuccess) {
      console.log(`Webhook: Mensagem enviada ao CRM com sucesso para ${Numero}.`);
    } else {
      console.error(`Webhook: Falha ao enviar mensagem ao CRM para ${Numero}.`);
    }

    res.writeHead(200);
    res.end(JSON.stringify({ success: true }));

  } catch (erro) {
    console.error("Webhook: Erro interno no processamento:", erro);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Erro interno no servidor' }));
  }
}

// --- FUNÇÕES PLACEHOLDER PARA REGRAS DE NEGÓCIO ---
// VOCÊ PRECISA IMPLEMENTAR A LÓGICA REAL PARA ESTAS FUNÇÕES.
// Elas devem interagir com seu CRM ou banco de dados para obter o status do contato/conversa.

async function checkIfConversationIsHandledByHuman(numero) {
  console.log(`[PLACEHOLDER] Verificando se a conversa com ${numero} é tratada por humano...`);
  return false; // Por padrão, assume que não está sendo tratada por humano para testes.
}

async function checkIfNewContact(numero) {
  console.log(`[PLACEHOLDER] Verificando se ${numero} é um novo contato...`);
  return true; // Por padrão, assume que é um novo contato para testes.
}
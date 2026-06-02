// index.js

import pensarNaResposta from './lib/geminiService.js';
import enviarMensagemCrm from './lib/crmService.js';

export default async function handler(req, res) {
  console.log("Webhook: Função handler invocada.");

  // 1. Headers de CORS
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
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Corpo inválido' }));
    return;
  }

  try {
    // Extração dos dados
    const Nome = requestBody.name || 'Cliente';
    const Numero = requestBody.number;
    
    // --- TRAVA DE SEGURANÇA CONTRA LOOP ---
    const isFromMe = requestBody.eventDetails?.id?.fromMe === true;
    if (isFromMe) {
      console.log("Webhook: Mensagem enviada pelo bot. Ignorando para evitar loop.");
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: "Loop evitado." }));
      return;
    }
    // --- FIM DA TRAVA ---

    let mensagemDoLead = '';
    if (requestBody.lastMessage && requestBody.lastMessage.text) {
        mensagemDoLead = requestBody.lastMessage.text;
    } else if (requestBody.eventDetails && requestBody.eventDetails.body) {
        mensagemDoLead = requestBody.eventDetails.body;
    } else {
        if (requestBody.eventDetails?.type === 'sticker') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
            return;
        }
        mensagemDoLead = "Recebi uma mensagem não textual.";
    }

    // Processamento da IA
    console.log(`Webhook: Iniciando processamento. Lead: ${Nome}, Mensagem: ${mensagemDoLead.substring(0, 30)}...`);
    const respostaIA = await pensarNaResposta(Nome, mensagemDoLead);
    
    // Envio para CRM
    await enviarMensagemCrm(Numero, respostaIA);
    console.log("Webhook: Mensagem enviada ao CRM com sucesso.");

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));

  } catch (erro) {
    console.error("Webhook: Erro no processamento:", erro);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Erro interno no servidor' }));
  }
}
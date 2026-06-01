// index.js (antigo webhook.js, agora na raiz do projeto)

// Importações corrigidas para a nova localização
import pensarNaResposta from './lib/geminiService.js';
import enviarMensagemCrm from './lib/crmService.js';

export default async function handler(req, res) {
  // --- LOGS DE ENTRADA IMEDIATO ---
  console.log("Webhook: Função handler invocada.");
  console.log(`Webhook: Método da requisição: ${req.method}`);
  console.log(`Webhook: URL da requisição: ${req.url}`);

  // 1. Configurando os Headers de CORS (Os "crachás" de permissão)
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*'); // O asterisco permite qualquer origem (seu CRM)
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  // 2. Respondendo ao "Preflight" (A pergunta de segurança do CORS)
  if (req.method === 'OPTIONS') {
    console.log("Webhook: Requisição OPTIONS recebida. Respondendo com 200 OK.");
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,OPTIONS,PATCH,DELETE,POST,PUT',
      'Access-Control-Allow-Headers': 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version',
      'Access-Control-Allow-Credentials': true
    });
    res.end();
    return;
  }

  // 3. Bloqueia o que não for POST
  if (req.method !== 'POST') {
    console.warn(`Webhook: Método ${req.method} não permitido. Retornando 405.`);
    // Usando res.writeHead para 405
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Método não permitido' }));
    return;
  }

  let requestBody;
  let bodyString = '';
  try {
    // NOVA FORMA DE LER O CORPO DA REQUISIÇÃO PARA AMBIENTES VERCEL SEM req.json()
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    bodyString = Buffer.concat(chunks).toString('utf8');
    requestBody = JSON.parse(bodyString);

    console.log("Webhook: Conteúdo COMPLETO de requestBody (após parse):", JSON.stringify(requestBody, null, 2));
  } catch (parseError) {
    console.error("Webhook: Erro ao parsear req.body como JSON:", parseError);
    console.error("Webhook: Corpo bruto da requisição que causou o erro:", bodyString);
    // Usando res.writeHead para 400
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Corpo da requisição inválido ou não é JSON.' }));
    return;
  }

  try {
    // Desestrutura o objeto requestBody parseado
    const Nome = requestBody.name || 'Cliente';
    const Numero = requestBody.number;
    let mensagemDoLead = '';

    if (requestBody.lastMessage && requestBody.lastMessage.text) {
        mensagemDoLead = requestBody.lastMessage.text;
    } else if (requestBody.eventDetails && requestBody.eventDetails.body) { // Use 'body' para o texto em eventDetails
        mensagemDoLead = requestBody.eventDetails.body;
    } else {
        console.warn("Webhook: Mensagem de texto não encontrada em lastMessage.text ou eventDetails.body. Tipo de evento:", requestBody.eventDetails?.type);
        if (requestBody.eventDetails?.type === 'sticker') {
            console.log("Webhook: Ignorando evento de sticker.");
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, message: "Evento de sticker ignorado." }));
            return;
        }
        mensagemDoLead = "Recebi uma mensagem não textual.";
    }

    console.log(`Webhook: Valores após extração: Nome='${Nome}', Numero='${Numero}', mensagemDoLead='${mensagemDoLead}'`);

    // --- NOVO LOG: VERIFICAR VARIÁVEIS DE AMBIENTE ---
    console.log(`Webhook: GEMINI_API_KEY está definida? ${!!process.env.GEMINI_API_KEY}`);
    console.log(`Webhook: CRM_API_TOKEN está definida? ${!!process.env.CRM_API_TOKEN}`);
    // --- FIM NOVO LOG ---

    // Verificação de tipo e existência dos dados
    if (typeof Numero !== 'string' || !Numero) {
        console.error(`Webhook: Erro: 'Numero' inválido ou ausente. Valor: ${Numero}`);
        // Usando res.writeHead para 400
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Número do lead inválido ou ausente.' }));
        return;
    }
    if (typeof mensagemDoLead !== 'string' || !mensagemDoLead) {
        console.error(`Webhook: Erro: 'Dados do Evento' (mensagemDoLead) inválido ou ausente. Valor: ${mensagemDoLead}`);
        // Usando res.writeHead para 400
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Mensagem do lead inválida ou ausente.' }));
        return;
    }

    console.log(`Webhook: Iniciando processamento da IA para Nome: ${Nome}, Mensagem: ${mensagemDoLead.substring(0, Math.min(mensagemDoLead.length, 50))}...`);
    const respostaIA = await pensarNaResposta(Nome, mensagemDoLead);
    console.log(`Webhook: Resposta da IA recebida: ${respostaIA.substring(0, Math.min(respostaIA.length, 50))}...`);

    console.log(`Webhook: Enviando mensagem para CRM: Numero='${Numero}', Mensagem='${respostaIA.substring(0, Math.min(respostaIA.length, 50))}...'`);
    await enviarMensagemCrm(Numero, respostaIA);
    console.log("Webhook: Mensagem enviada ao CRM com sucesso.");

    // Usando res.writeHead para 200
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;

  } catch (erro) {
    console.error("Webhook: Erro no processamento do webhook:", erro);
    if (erro instanceof TypeError && erro.message.includes("circular structure")) {
        console.error("Webhook: Detalhes do erro circular: O problema é que um objeto complexo (provavelmente req ou res) está sendo passado onde uma string simples era esperada.");
    }
    // Usando res.writeHead para 500
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Erro interno no servidor' }));
    return;
  }
}
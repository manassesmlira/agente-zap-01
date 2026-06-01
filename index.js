import pensarNaResposta from './lib/geminiService.js'; // Caminho atualizado
import enviarMensagemCrm from './lib/crmService.js';   // Caminho atualizado

export default async function handler(req, res) {
  // --- LOG DE ENTRADA IMEDIATO ---
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
    return res.status(200).end();
  }

  // 3. Bloqueia o que não for POST
  if (req.method !== 'POST') {
    console.warn(`Webhook: Método ${req.method} não permitido. Retornando 405.`);
    return res.status(405).json({ error: 'Método não permitido' });
  }

  let requestBody;
  try {
    // Tenta ler o corpo da requisição como JSON
    requestBody = await req.json();
    console.log("Webhook: Conteúdo COMPLETO de requestBody (após req.json()):", JSON.stringify(requestBody, null, 2));
  } catch (parseError) {
    console.error("Webhook: Erro ao parsear req.body como JSON:", parseError);
    return res.status(400).json({ error: 'Corpo da requisição inválido ou não é JSON.' });
  }

  try {
    // Desestrutura o objeto requestBody parseado
    const { Nome, Numero, 'Dados do Evento': mensagemDoLead } = requestBody;

    // Logs para verificar os valores após a desestruturação
    console.log(`Webhook: Valores após desestruturação: Nome='${Nome}', Numero='${Numero}', mensagemDoLead='${mensagemDoLead}'`);

    // Verificação de tipo e existência dos dados
    if (typeof Numero !== 'string' || !Numero) {
        console.error(`Webhook: Erro: 'Numero' inválido ou ausente. Valor: ${Numero}`);
        return res.status(400).json({ error: 'Número do lead inválido ou ausente.' });
    }
    if (typeof mensagemDoLead !== 'string' || !mensagemDoLead) {
        console.error(`Webhook: Erro: 'Dados do Evento' (mensagemDoLead) inválido ou ausente. Valor: ${mensagemDoLead}`);
        return res.status(400).json({ error: 'Mensagem do lead inválida ou ausente.' });
    }

    console.log(`Webhook: Iniciando processamento da IA para Nome: ${Nome}, Mensagem: ${mensagemDoLead.substring(0, Math.min(mensagemDoLead.length, 50))}...`);
    const respostaIA = await pensarNaResposta(Nome, mensagemDoLead);
    console.log(`Webhook: Resposta da IA recebida: ${respostaIA.substring(0, Math.min(respostaIA.length, 50))}...`);

    console.log(`Webhook: Enviando mensagem para CRM: Numero='${Numero}', Mensagem='${respostaIA.substring(0, Math.min(respostaIA.length, 50))}...'`);
    await enviarMensagemCrm(Numero, respostaIA);
    console.log("Webhook: Mensagem enviada ao CRM com sucesso.");

    return res.status(200).json({ success: true });

  } catch (erro) {
    console.error("Webhook: Erro no processamento do webhook:", erro);
    if (erro instanceof TypeError && erro.message.includes("circular structure")) {
        console.error("Webhook: Detalhes do erro circular: O problema é que um objeto complexo (provavelmente req ou res) está sendo passado onde uma string simples era esperada.");
    }
    return res.status(500).json({ error: 'Erro interno no servidor' });
  }
}
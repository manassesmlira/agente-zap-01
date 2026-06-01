import pensarNaResposta from '../geminiService.js';
import enviarMensagemCrm from '../crmService.js';

export default async function handler(req, res) {
  // 1. Configurando os Headers de CORS (Os "crachás" de permissão)
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*'); // O asterisco permite qualquer origem (seu CRM)
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  // 2. Respondendo ao "Preflight" (A pergunta de segurança do CORS)
  if (req.method === 'OPTIONS') {
    console.log("Requisição OPTIONS recebida. Respondendo com 200 OK.");
    return res.status(200).end();
  }

  // 3. Bloqueia o que não for POST
  if (req.method !== 'POST') {
    console.warn(`Método ${req.method} não permitido. Apenas POST é aceito.`);
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    // Log para inspecionar o req.body ANTES da desestruturação
    console.log("Conteúdo COMPLETO de req.body recebido:", JSON.stringify(req.body, null, 2));

    // Tentativa de desestruturação
    const { Nome, Numero, 'Dados do Evento': mensagemDoLead } = req.body;

    // Logs para verificar os valores após a desestruturação
    console.log(`Valores após desestruturação: Nome='${Nome}', Numero='${Numero}', mensagemDoLead='${mensagemDoLead}'`);

    if (!mensagemDoLead || !Numero) {
       console.error(`Erro: Faltam dados essenciais. mensagemDoLead='${mensagemDoLead}', Numero='${Numero}'`);
       return res.status(400).json({ error: 'Faltam dados do lead (mensagemDoLead ou Numero)' });
    }

    console.log(`Iniciando processamento da IA para Nome: ${Nome}, Mensagem: ${mensagemDoLead.substring(0, 50)}...`);
    const respostaIA = await pensarNaResposta(Nome, mensagemDoLead);
    console.log(`Resposta da IA recebida: ${respostaIA.substring(0, 50)}...`);

    console.log(`Enviando mensagem para CRM: Numero='${Numero}', Mensagem='${respostaIA.substring(0, 50)}...'`);
    await enviarMensagemCrm(Numero, respostaIA);
    console.log("Mensagem enviada ao CRM com sucesso.");

    return res.status(200).json({ success: true });

  } catch (erro) {
    console.error("Erro no processamento do webhook:", erro);
    // Adicionando um log mais detalhado do erro, se possível
    if (erro instanceof TypeError && erro.message.includes("circular structure")) {
        console.error("Detalhes do erro circular: O problema é que um objeto complexo (provavelmente req ou res) está sendo passado onde uma string simples era esperada.");
    }
    return res.status(500).json({ error: 'Erro interno no servidor' });
  }
}
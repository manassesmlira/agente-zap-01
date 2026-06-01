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
    return res.status(200).end();
  }

  // 3. Bloqueia o que não for POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    console.log("Conteúdo de req.body:", req.body);
    const { Nome, Numero, 'Dados do Evento': mensagemDoLead } = req.body;

    if (!mensagemDoLead || !Numero) {
       return res.status(400).json({ error: 'Faltam dados do lead' });
    }

    // A mágica acontece aqui
    const respostaIA = await pensarNaResposta(Nome, mensagemDoLead);
    await enviarMensagemCrm(Numero, respostaIA);

    return res.status(200).json({ success: true });
    
  } catch (erro) {
    console.error("Erro no processamento:", erro);
    return res.status(500).json({ error: 'Erro interno no servidor' });
  }
}
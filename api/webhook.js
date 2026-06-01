import { pensarNaResposta } from '../geminiService.js';
// Aqui você importaria a sua função de enviar mensagem pelo CRM
 import { enviarMensagemCrm } from '../crmService.js';

export default async function handler(req, res) {
  // O Webhook do CRM fará uma requisição POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    // Pegando os dados exatos que você marcou no painel do CRM
    const { Nome, Numero, 'Dados do Evento': mensagemDoLead } = req.body;

    if (!mensagemDoLead || !Numero) {
       return res.status(400).json({ error: 'Faltam dados do lead' });
    }

    // 1. Envia a mensagem para o Gemini pensar
    const respostaIA = await pensarNaResposta(Nome, mensagemDoLead);

    // 2. Devolve a resposta para o WhatsApp usando a API do seu CRM
     await enviarMensagemCrm(Numero, respostaIA);

    // 3. Avisa a Vercel e o CRM que deu tudo certo
    return res.status(200).json({ success: true, message: 'Mensagem respondida!' });
    
  } catch (erro) {
    console.error("Erro no processamento:", erro);
    return res.status(500).json({ error: 'Erro interno no servidor' });
  }
}
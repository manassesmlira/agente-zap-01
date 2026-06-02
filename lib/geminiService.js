import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default async function pensarNaResposta(nomeDoLead, mensagem) {
  const instrucaoDeSistema = `Você é um consultor educacional do Curso de Teologia.
  Seu tom é acolhedor, inspirador e respeitoso.
  O nome do lead que você está atendendo é ${nomeDoLead || 'Aluno'}.
  Seu objetivo é tirar dúvidas sobre a grade curricular e guiar para a matrícula.
  Seja conciso, pois é uma conversa de WhatsApp.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash', 
      // Ajuste realizado: Estrutura correta de array de objetos esperada pela API
      contents: [{ role: 'user', parts: [{ text: mensagem }] }],
      config: {
        systemInstruction: instrucaoDeSistema,
        temperature: 0.7,
      }
    });

    // Retorna o texto gerado. Adicionada verificação de segurança para evitar erros caso a resposta esteja vazia
    return response.text || "Desculpe, não consegui gerar uma resposta no momento.";
    
  } catch (erro) {
    console.error("Erro no Gemini:", erro);
    // Esta mensagem de erro agora só será disparada se houver uma falha real de comunicação com a API
    return "Desculpe, tivemos uma instabilidade técnica. Pode repetir, por favor?";
  }
}
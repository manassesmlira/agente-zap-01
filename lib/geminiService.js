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
      contents: mensagem,
      config: {
        systemInstruction: instrucaoDeSistema,
        temperature: 0.7,
      }
    });
    return response.text;
  } catch (erro) {
    console.error("Erro no Gemini:", erro);
    return "Desculpe, tivemos uma instabilidade. Pode repetir, por favor?";
  }
}
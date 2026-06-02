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
      model: 'models/gemini-flash-latest', 
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
    console.error("Erro no Gemini:", erro); // Isso vai para o seu log, não para o WhatsApp.
    // Retorna um objeto indicando falha, sem nenhuma mensagem para o usuário.
    // A mensagem para o usuário será decidida no `index.js`.
    return { success: false, error: "Falha na comunicação com a IA." }; 
  }
}
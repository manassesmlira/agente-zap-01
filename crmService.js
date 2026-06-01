// crmService.js

export async function enviarMensagemCrm(numero, mensagem) {
  // O token deve estar configurado no seu arquivo .env
  const token = process.env.CRM_API_TOKEN;
  
  if (!token) {
    console.error("ERRO: Token do CRM não configurado no .env");
    return;
  }

  // URL base da Wascript apontando para o endpoint de texto com o seu token
  const url = `https://api-whatsapp.wascript.com.br/api/enviar-texto/${token}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      // Enviando os dados no formato esperado pela API
      body: JSON.stringify({
        phone: numero,
        message: mensagem
      })
    });

    const data = await response.json();

    // Verificando os retornos baseados na documentação da Wascript
    if (data.success) {
      console.log(`Mensagem enviada com sucesso para ${numero}`);
      return true;
    } else {
      console.error("A API do CRM retornou um erro:", data.message);
      return false;
    }
    
  } catch (erro) {
    console.error("Falha na requisição para o CRM:", erro);
    return false;
  }
}
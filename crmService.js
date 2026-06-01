export default async function enviarMensagemCrm(numero, mensagem) {
  const token = process.env.CRM_API_TOKEN;
  
  if (!token) {
    console.error("ERRO: Token do CRM ausente.");
    return false;
  }

  const url = `https://api-whatsapp.wascript.com.br/api/enviar-texto/${token}`;

  try {
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        phone: numero,
        message: mensagem
      })
    });

    const data = await response.json();

    if (data.success) {
      console.log(`Mensagem enviada com sucesso para ${numero}`);
      return true;
    } else {
      console.error("Erro no retorno da API Wascript:", data);
      return false;
    }
  } catch (erro) {
    console.error("Falha na requisição para a Wascript:", erro);
    return false;
  }
}
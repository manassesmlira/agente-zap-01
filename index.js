// index.js
// Este é um teste para verificar se a função é invocada.

export default async function handler(req, res) {
  console.log("Teste: Função handler invocada com sucesso!");
  return res.status(200).json({ message: "Teste de invocação bem-sucedido!" });
}
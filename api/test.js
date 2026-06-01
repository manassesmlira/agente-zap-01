// api/test.js
export default function handler(req, res) {
  console.log("API de teste invocada!");
  res.status(200).json({ message: "Olá do Vercel API!" });
}
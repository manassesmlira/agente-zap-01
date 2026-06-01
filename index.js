// index.js
// Este arquivo serve apenas como um ponto de entrada para o Vercel iniciar o projeto.
// Ele não fará nada por si só, mas permitirá que suas API Routes funcionem.

// Você pode adicionar um console.log aqui para confirmar que ele foi lido
console.log("Projeto Vercel iniciado via index.js!");

// Se você quiser que ele seja um servidor Express simples para rodar localmente,
// você pode adicionar algo como:
/*
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Hello from Vercel root!');
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
*/

// Para o Vercel, apenas a existência de um arquivo como este já é suficiente
// para ele parar de reclamar sobre a falta de um entrypoint.
// Suas API Routes em /api/ continuarão a ser tratadas como funções serverless.
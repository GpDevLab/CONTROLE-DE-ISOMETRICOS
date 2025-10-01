require('dotenv').config({ path: 'env/.env' }); // ajuste o caminho se necessário
const express = require('express');
const cors = require('cors');

const app = express();
const rotas = require('./api');

app.use(express.json());

app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://10.71.0.195:3000',
  ],
  credentials: true,
}));

app.use(rotas);

app.listen(5000, '0.0.0.0', () => {
  console.log('Server on http://localhost:5000');
});
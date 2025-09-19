const db = require('./database');

async function obterMapaTotal(area_id) {
  const [rows] = await db.query(`
   SELECT codigo, descricao, arquivo_origem, diam, qtd, versao, rev
  FROM isometricos_gerados
  WHERE area_id = ?
  ORDER BY codigo, descricao, arquivo_origem`, [area_id]);

  const mapa = {};

  for (const row of rows) {
    const codigo = row.codigo?.toString().trim().toUpperCase();
    const qtdNumerica = parseFloat(
      String(row.qtd).replace(/[^\d.,]/g, '').replace(',', '.')
    );

    if (!mapa[codigo]) {
      mapa[codigo] = {
        codigo,
        descricao: row.descricao,
        qtd_total: 0,
        versao: row.versao,
        rev: row.rev,
        itens: []
      };
    }

    if (!isNaN(qtdNumerica)) {
      mapa[codigo].qtd_total += qtdNumerica;
    }

    mapa[codigo].itens.push({
      arquivo_origem: row.arquivo_origem,
      diam: row.diam,
      qtd: row.qtd,
      versao: row.versao 
    });
  }

  const mapFinal = new Map();

  for (const [codigo, dados] of Object.entries(mapa)) {
    mapFinal.set(codigo, {
      codigo: dados.codigo,
      descricao: dados.descricao,
      qtd_total: Number(dados.qtd_total.toFixed(2)),
      versao: dados.versao,
      rev: dados.rev,
      itens: dados.itens
    });
  }

  return mapFinal;
}

module.exports = { obterMapaTotal };
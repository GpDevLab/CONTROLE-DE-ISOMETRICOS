const db = require('./database');

async function obterProximaVersao(area_id, rev) {
  const [rows] = await db.execute(
    'SELECT MAX(versao) AS maxVersao FROM isometricos_gerados WHERE area_id = ? AND rev = ?',
    [area_id, rev]
  );
  const proxima = (rows[0]?.maxVersao ?? 0) + 1;
  return proxima;
}

async function obterVersaoPorAreaERev(area_id, rev) {
  const [rows] = await db.execute(
    'SELECT MAX(versao) As versao FROM isometricos_gerados WHERE area_id = ? AND rev = ?',
    [area_id, rev]
  );
  return rows[0]?.versao ?? null;
}

async function obterRevisaoDaArea(area_id) {
  const [rows] = await db.execute('SELECT rev FROM area WHERE id = ?', [area_id]);
  if (!rows.length) throw new Error(`Área ${area_id} não encontrada`);
  return rows[0].rev;
}

async function obterNomeDoProjetoPorAreaId(area_id) {
  const [rows] = await db.execute('SELECT nome FROM area WHERE id = ?', [area_id]);
  if (!rows.length) throw new Error(`Área ${area_id} não encontrada`);
  return rows[0].nome;
}

module.exports = {
  obterProximaVersao,
  obterRevisaoDaArea,
  obterNomeDoProjetoPorAreaId,
  obterVersaoPorAreaERev
};

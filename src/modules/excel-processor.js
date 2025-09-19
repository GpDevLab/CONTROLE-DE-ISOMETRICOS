const xlsx = require('xlsx');

function lerPlanilha(caminhoArquivo) {
  const workbook = xlsx.readFile(caminhoArquivo);
  const primeiraPlanilha = workbook.SheetNames[0];
  const planilha = workbook.Sheets[primeiraPlanilha];
  const dados = xlsx.utils.sheet_to_json(planilha, { defval: null });
  return dados;
}

module.exports = { lerPlanilha };
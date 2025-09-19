const fs = require('fs');
const path = require('path');
const DxfParser = require('dxf-parser');
const xlsx = require('xlsx');
const db = require('./database');

function extrairTextoDosEntidades(dxfData) {
  const textos = [];
  if (!dxfData?.entities) return textos;
  for (const e of dxfData.entities) {
    if (e.type === 'TEXT' || e.type === 'MTEXT') {
      const valor = (e.text || e.string || '').trim();
      if (valor) textos.push(valor);
    }
  }
  return textos;
}

function ehDiametroSimples(valor) {
  return /^(\d+(\.\d+)?(\/\d+)?)$/.test(valor);
}

function ehDiametroComposto(valor) {
  return /^(\d+(\.\d+)?(\/\d+)?\s*x\s*\d+(\.\d+)?(\/\d+)?)$/.test(valor);
}

function ehCodigoValido(valor) {
  return /^\d{6,8}$/.test(valor); 
}

function ehQtdValida(valor) {
  return /^\d+(\.\d+)?M?$/.test(valor);
}

async function processarDXF(caminhoDoArquivo, area_id, versao, rev) {
  const parser = new DxfParser();
  const conteudo = fs.readFileSync(path.resolve(caminhoDoArquivo), 'utf-8');
  const dxfData = parser.parseSync(conteudo);
  const textos = extrairTextoDosEntidades(dxfData);
  const itensExtraidos = [];

  for (let i = 0; i < textos.length - 3; i++) {
    const linha1 = textos[i]?.trim();
    const linha2 = textos[i + 1]?.trim();
    const linha3 = textos[i + 2]?.trim();
    const linha4 = textos[i + 3]?.trim();

    let diam = null;
    let codigo = null;
    let qtd = null;

    if (ehDiametroComposto(linha1) && ehCodigoValido(linha2)) {
      diam = linha1.replace(/\s+/g, '');
      codigo = linha2;
      qtd = linha3?.match(/^\d+(\.\d+)?M?$/)?.[0];
    } else if (/^(\d+(\.\d+)?(\/\d+)?\s*x)$/.test(linha1) && ehDiametroSimples(linha2) && ehCodigoValido(linha3)) {
      diam = `${linha1}${linha2}`.replace(/\s+/g, '');
      codigo = linha3;
      qtd = linha4?.match(/^\d+(\.\d+)?M?$/)?.[0];
      i += 1;
    } else if (ehDiametroSimples(linha1) && ehCodigoValido(linha2)) {
      diam = linha1;
      codigo = linha2;
      qtd = linha3?.match(/^\d+(\.\d+)?M?$/)?.[0];
    }

    if (codigo && ehCodigoValido(codigo)) {
      itensExtraidos.push({ codigo, diam, qtd });
    }
  }

  const codigos = itensExtraidos.map(item => item.codigo).filter(Boolean);
  let mapaDescricao = {};

  if (codigos.length > 0) {
    const [rows] = await db.execute(
      `SELECT REPLACE(codigo, '.', '') AS codigo_formatado, descricao 
       FROM nm_sap 
       WHERE REPLACE(codigo, '.', '') IN (${codigos.map(() => '?').join(',')})`,
      codigos
    );
    for (const row of rows) {
      mapaDescricao[row.codigo_formatado] = row.descricao;
    }
  }

  const nomeArquivo = path.basename(caminhoDoArquivo).replace(/\.[^.]+$/i, '');
  const resultadoFinal = itensExtraidos.map(item => {
    const descricao = mapaDescricao[item.codigo] || null;
    return {
      codigo: item.codigo,
      qtd: item.qtd || '',
      diam: item.diam || '',
      descricao,
      arquivo_origem: nomeArquivo
    };
  });

  // Inserção no banco
  for (const item of resultadoFinal) {
    try {
      if (!item.codigo || item.codigo === '') continue;
      const descricaoFinal = item.descricao || "codigo gp";
      await db.execute(
        `INSERT INTO isometricos_gerados 
          (codigo, diam, qtd, descricao, arquivo_origem, area_id, versao, rev, data_criacao)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          item.codigo,
          item.diam ?? null,
          item.qtd ?? null,
          descricaoFinal,
          nomeArquivo,
          area_id,
          versao,
          rev
        ]
      );
    } catch (err) {
      console.error('Erro ao inserir item no banco:', item, err.message);
    }
  }

  return resultadoFinal;
}

module.exports = { processarDXF };

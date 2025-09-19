const fs = require('fs');
const path = require('path');
const Excel = require('exceljs');
const db = require('./database');
const { diskStorage } = require('multer');
const norm = (c) => (c ?? '').toString().replace(/\./g, '').trim().toUpperCase();

function garantirMargens(ws) {
  if (!ws.pageSetup) ws.pageSetup = {};
  const m = ws.pageSetup.margins || {};
  ws.pageSetup.margins = {
    left:   m.left   ?? 0.7,
    right:  m.right  ?? 0.7,
    top:    m.top    ?? 0.75,
    bottom: m.bottom ?? 0.75,
    header: m.header ?? 0.3,
    footer: m.footer ?? 0.3,
  };
}

function garantirMargensWorkbook(workbook) {
  workbook.eachSheet(garantirMargens);
}

async function preencherCapaUpload(workbook, { rev, nomeArea, versaoUpload, area_id, totalAbas }) {
  const capa = workbook.getWorksheet('CAPA');
  if (!capa) return;

  let cliente = '';
  try {
    const [rows] = await db.query(
      `SELECT p.codigo AS cliente
         FROM projeto p
         JOIN area a ON a.projeto_id = p.id
        WHERE a.id = ?
        LIMIT 1`,
      [area_id]
    );
    cliente = rows?.[0]?.cliente || '';
  } catch {
    cliente = '';
  }

  capa.getCell('AC1').value = rev;                                
  capa.getCell('M4').value = nomeArea || '';                      
  capa.getCell('L5').value = `${versaoUpload}`;  
  capa.getCell('M2').value = cliente;                            
  capa.getCell('AX2').value = totalAbas || 1;                     

  for (let r = 17; r <= 55; r++) {
    capa.getCell(`A${r}`).value = null;
    capa.getCell(`E${r}`).value = null;
  }

  if (Number.isFinite(rev) && rev > 0) {
    const last = Math.min(16 + rev, 55);
    for (let i = 1; i <= rev && (16 + i) <= last; i++) {
      const row = 16 + i;
      capa.getCell(`A${row}`).value = i;
      capa.getCell(`E${row}`).value = `REVISÃO N. ${i} (REVISAO)`;
      capa.getCell(`E${row}`).alignment = { vertical: 'middle', horizontal: 'left' };
    }
  }
}

function clonarAba(workbook, wsOrig, nomeNova) {
  const ws = workbook.addWorksheet(nomeNova, { views: wsOrig.views });

  if (wsOrig.pageSetup) ws.pageSetup = { ...wsOrig.pageSetup };
  if (wsOrig.properties) ws.properties = { ...wsOrig.properties };
  if (wsOrig.headerFooter) ws.headerFooter = JSON.parse(JSON.stringify(wsOrig.headerFooter));

  if (Array.isArray(wsOrig.columns)) {
    wsOrig.columns.forEach((col, idx) => {
      const c = ws.getColumn(idx + 1);
      if (col) {
        if (col.width) c.width = col.width;
        if (col.style) c.style = JSON.parse(JSON.stringify(col.style));
        if (col.numFmt) c.numFmt = col.numFmt;
      }
    });
  }

  wsOrig.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    const newRow = ws.getRow(rowNumber);
    if (row.height) newRow.height = row.height;

    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const nc = newRow.getCell(colNumber);
      nc.value = cell.value;
      if (cell.style) nc.style = JSON.parse(JSON.stringify(cell.style));
      if (cell.numFmt) nc.numFmt = cell.numFmt;
      if (cell.alignment) nc.alignment = { ...cell.alignment };
      if (cell.border) nc.border = JSON.parse(JSON.stringify(cell.border));
      if (cell.fill) nc.fill = JSON.parse(JSON.stringify(cell.fill));
    });

    newRow.commit();
  });

  try {
    let mergeRanges = [];
    if (wsOrig.model && Array.isArray(wsOrig.model.merges)) {
      mergeRanges = wsOrig.model.merges;
    } else if (wsOrig._merges) {
      mergeRanges = Array.isArray(wsOrig._merges)
        ? wsOrig._merges
        : Object.keys(wsOrig._merges);
    }
    for (const range of mergeRanges) {
      try { ws.mergeCells(range); } catch (_) {}
    }
  } catch (_) {}

  try {
    if (typeof wsOrig.getImages === 'function') {
      const imagens = wsOrig.getImages();
      for (const img of imagens) {

        if (img.range.tl.col === 0 && img.range.tl.row === 0) {
          ws.addImage(img.imageId, img.range);
        }
      }
    }
  } catch (e) {
    console.warn('Não foi possível copiar imagens desta worksheet:', e.message);
  }

  return ws;
}

// PLANILHA DE UPLOAD DWG
async function gerarPlanilhaUploadDWG(itens, nomeArea, rev, versaoUpload, area_id) {
  const templatePath = path.resolve('uploads', 'template_UPLOUD.xlsx');
  const workbook = new Excel.Workbook();
  await workbook.xlsx.readFile(templatePath);
  garantirMargensWorkbook(workbook);

  const imgId = workbook.addImage({
    filename: path.resolve('uploads', 'Imagem1.jpg'),
    extension: 'jpg'
  });

  const LIMITE_ITENS_POR_ABA = 34;
  const wsOriginal = workbook.getWorksheet('FOLHA 1');
  if (!wsOriginal) throw new Error('Aba FOLHA 1 não encontrada no template.');

  wsOriginal.addImage(imgId, {
    tl: { col: 0, row: 0 },
    ext: { width: '115', height: 105 }
  });

  // Busca descrições SAP para todos os códigos (opcional)
  const codigosUplouad = itens.map(([codigo]) => codigo);
  let mapaDescricao = {};
  if (codigosUplouad.length > 0) {
    const [rows] = await db.query(
      `SELECT REPLACE(codigo, '.','') AS codigo_formatado, descricao
      FROM nm_sap
      WHERE REPLACE(codigo, '.', '') IN (${codigosUplouad.map(() => '?').join(',')})`,
      codigosUplouad
    );
    for (const row of rows) {
      mapaDescricao[row.codigo_formatado] = row.descricao;
    }
  }

  let abaIndex = 1;
  let ws = wsOriginal;

  ws.getCell('Q2').value = nomeArea;
  ws.getCell('Q3').value = `UPLOAD VERSÃO ${versaoUpload}`;
  ws.getCell('AL1').value = rev;

  const linhaInicial = 7;
  let i = 0;

  for (const [codigo, dados] of itens) {
    if (!codigo) continue;

    if (i > 0 && i % LIMITE_ITENS_POR_ABA === 0) {
      abaIndex++;
      ws = clonarAba(workbook, wsOriginal, `FOLHA ${abaIndex}`);

      ws.addImage(imgId, {
        tl: { col: 0, row: 0 },
        ext: { width: '115', height: 105 }
      });

      ws.getCell('Q2').value = nomeArea;
      ws.getCell('Q3').value = `UPLOAD  VERSÃO ${versaoUpload}`;
      ws.getCell('AL1').value = rev;
    }

    const linha = linhaInicial + (i % LIMITE_ITENS_POR_ABA);
    const primeiroItem = (dados.itens && dados.itens[0]) ? dados.itens[0] : {};

    // Use descrição do SAP se existir, senão do DWG
    const descricaoFinal = mapaDescricao[codigo] || dados.descricao || '';

    ws.getCell(`A${linha}`).value = i + 1;
    ws.getCell(`E${linha}`).value = codigo;
    ws.getCell(`L${linha}`).value = descricaoFinal;
    ws.getCell(`AV${linha}`).value = primeiroItem.diam || '';
    ws.getCell(`BH${linha}`).value = dados.qtd_total ?? '';
    ws.getCell(`BM${linha}`).value = primeiroItem.arquivo_origem || '';

    i++;
  }

  // Limpa linhas não usadas na última aba
  const usadosNestaUltima = (i % LIMITE_ITENS_POR_ABA) === 0 ? LIMITE_ITENS_POR_ABA : (i % LIMITE_ITENS_POR_ABA);
  const primeiraVazia = linhaInicial + usadosNestaUltima;
  const ultimaLinha = linhaInicial + LIMITE_ITENS_POR_ABA - 1;
  if (primeiraVazia <= ultimaLinha) {
    for (let r = primeiraVazia; r <= ultimaLinha; r++) {
      ws.getCell(`A${r}`).value = null;
      ws.getCell(`E${r}`).value = null;
      ws.getCell(`L${r}`).value = null;
      ws.getCell(`AV${r}`).value = null;
      ws.getCell(`BH${r}`).value = null;
      ws.getCell(`BM${r}`).value = null;
    }
  }

  const totalAbas = Math.max(1, Math.ceil(i / LIMITE_ITENS_POR_ABA));
  await preencherCapaUpload(workbook, {
    rev,
    nomeArea,
    versaoUpload: `UPLOAD VERSÃO ${versaoUpload}`,
    area_id,
    totalAbas
  });

  const pastaDestino = path.resolve('planilhas-geradas');
  if (!fs.existsSync(pastaDestino)) fs.mkdirSync(pastaDestino);

  const nomeArquivo = `${nomeArea}_upload_v${versaoUpload}_rev${rev}.xlsx`;
  garantirMargensWorkbook(workbook);
  await workbook.xlsx.writeFile(path.join(pastaDestino, nomeArquivo));
  console.log(`✅ Planilha de upload gerada: ${path.join(pastaDestino, nomeArquivo)}`);

  return nomeArquivo;
}

// PLANILHA DE REVISÃO
async function gerarPlanilhaRevisaoUpload(itens, nomeArea, rev, area_id) {
  const templatePath = path.resolve('uploads', 'template_rev.xlsx');
  const workbook = new Excel.Workbook();
  await workbook.xlsx.readFile(templatePath);

  const imgId = workbook.addImage({
    filename: path.resolve('uploads', 'Imagem1.jpg'),
    extension: 'jpg'
  });

  const LIMITE_ITENS_POR_ABA = 34;
  const linhaInicial = 7;

  const wsOriginal = workbook.getWorksheet('FOLHA 1');
  if (!wsOriginal) throw new Error('Aba FOLHA 1 não encontrada.');

  wsOriginal.addImage(imgId, {
    tl: { col: 0, row: 0 },
    ext: { width: 115, height: 105 }
  });

  wsOriginal.getCell('Q2').value = nomeArea;
  wsOriginal.getCell('Q3').value = `REVISÃO ${rev}`;
  wsOriginal.getCell('AL1').value = rev;

  const mapa = new Map();
  const normalizarCodigo = (c) =>
    (c ?? '').toString().replace(/\./g, '').trim().toUpperCase();

  for (const raw of itens || []) {
    let dados;
    let codigo;

    if (Array.isArray(raw)) {
      const [cod, obj] = raw;
      codigo = normalizarCodigo(cod);
      dados = obj || {};
    } else {
      codigo = normalizarCodigo(raw?.codigo);
      dados = raw || {};
    }

    if (dados?.area_id != null && Number(dados.area_id) !== Number(area_id)) {
      continue;
    }
    if (!codigo) continue;

    let qtdStr = (dados?.qtd_total ?? dados?.qtd ?? 0).toString().trim();
    if (qtdStr.includes(',')) {
    qtdStr = qtdStr.replace(/\./g, '').replace(',', '.');
    }
    const qtd = parseFloat(qtdStr);
    
    const descCandidata = (dados?.descricao ?? dados?.desc ?? '').toString().trim();

    if (!mapa.has(codigo)) {
      mapa.set(codigo, {
        codigo,
        descricao: descCandidata, 
        qtd_total: 0
      });
    }

    const ref = mapa.get(codigo);
    ref.qtd_total += isNaN(qtd) ? 0 : qtd;

    if (!ref.descricao && descCandidata) {
      ref.descricao = descCandidata;
    }
  }

  const agregados = Array.from(mapa.values());

  agregados.sort((a, b) => a.codigo.localeCompare(b.codigo, 'pt-BR'));

  const limparBloco = (ws) => {
    for (let r = linhaInicial; r < linhaInicial + LIMITE_ITENS_POR_ABA; r++) {
      ws.getCell(`A${r}`).value  = null; 
      ws.getCell(`E${r}`).value  = null; 
      ws.getCell(`L${r}`).value  = null;
      ws.getCell(`BB${r}`).value = null; 
    }
  };

  limparBloco(wsOriginal);

  let abaIndex = 1;
  let ws = wsOriginal;
  let i = 0;

  for (const item of agregados) {
    if (i > 0 && i % LIMITE_ITENS_POR_ABA === 0) {
      abaIndex++;
      ws = clonarAba(workbook, wsOriginal, `FOLHA ${abaIndex}`);

      ws.addImage(imgId, {
        tl: { col: 0, row: 0 },
        ext: { width: 115, height: 105 }
      });

      ws.getCell('Q2').value = nomeArea;
      ws.getCell('Q3').value = `REVISÃO ${rev}`;
      ws.getCell('AL1').value = rev;

      limparBloco(ws);
    }

    const linha = linhaInicial + (i % LIMITE_ITENS_POR_ABA);

    ws.getCell(`A${linha}`).value = i + 1;
    ws.getCell(`E${linha}`).value = item.codigo || '';

    ws.getCell(`L${linha}`).value = item.descricao || '';
    ws.getCell(`L${linha}`).alignment = { vertical: 'middle', horizontal: 'left' };

    ws.getCell(`BB${linha}`).value = Number(item.qtd_total) || 0;

    i++;
  }

  const totalAbas = Math.max(1, Math.ceil(i / LIMITE_ITENS_POR_ABA));
  await preencherCapaUpload(workbook, {
    rev,
    nomeArea,
    versaoUpload: `REVISÃO ${rev}`,
    area_id,
    totalAbas
  });

  garantirMargensWorkbook(workbook);

  const pastaDestino = path.resolve('planilhas-revisoes');
  if (!fs.existsSync(pastaDestino)) fs.mkdirSync(pastaDestino);

  const nomeArquivo = `${nomeArea}_revisao_${rev}.xlsx`;
  const caminhoCompleto = path.join(pastaDestino, nomeArquivo);
  await workbook.xlsx.writeFile(caminhoCompleto);

  return nomeArquivo;
}

// MAPA TOTAL
async function gerarPlanilhaMapaTotal(itens, nomeArea, rev, area_id) {
  const templatePath = path.resolve('uploads', 'template_mp.xlsx');
  const workbook = new Excel.Workbook();
  await workbook.xlsx.readFile(templatePath);

  const imgId = workbook.addImage({
  filename: path.resolve('uploads', 'Imagem1.jpg'), 
  extension: 'jpg'
    });

  const LIMITE_ITENS_POR_ABA = 34;
  const wsOriginal = workbook.getWorksheet('FOLHA 1');
  if (!wsOriginal) throw new Error('Aba FOLHA 1 não encontrada');

    wsOriginal.addImage(imgId, {
    tl: { col: 0, row: 0 },
    ext: { width: '115', height: 105 } 
  });

  let abaIndex = 1;
  let ws = wsOriginal;

  ws.getCell('Q2').value = nomeArea;
  ws.getCell('Q3').value = `MAPA TOTAL REV ${rev}`;
  ws.getCell('AL1').value = rev;

  const linhaInicial = 7;
  let i = 0;

  let ultimoCodigo = null;

for (const item of itens) {
    console.log(item);
  if (i > 0 && i % LIMITE_ITENS_POR_ABA === 0) {
    abaIndex++;
    ws = clonarAba(workbook, wsOriginal, `FOLHA ${abaIndex}`);

    wsOriginal.addImage(imgId, {
      tl: { col: 0, row: 0 },
      ext: { width: '115', height: 105 }
    });

    ws.getCell('Q2').value = nomeArea;
    ws.getCell('Q3').value = `MAPA TOTAL REV ${rev}`;
    ws.getCell('AL1').value = rev;
    for (let r = linhaInicial; r < linhaInicial + LIMITE_ITENS_POR_ABA; r++) {
      ws.getCell(`A${r}`).value = null;
      ws.getCell(`E${r}`).value = null;
      ws.getCell(`L${r}`).value = null;
      ws.getCell(`AV${r}`).value = null;
      ws.getCell(`BB${r}`).value = null;
      ws.getCell(`BM${r}`).value = null;
      ws.getCell(`BH${r}`).value = null;
      ws.getCell(`BR${r}`).value = null;
    }
    
  }

  const linha = linhaInicial + (i % LIMITE_ITENS_POR_ABA);

  ws.getCell(`A${linha}`).value = i + 1;
  ws.getCell(`E${linha}`).value = item.codigo || '';

  let descricaoParaCelula = '';
  if (item.codigo !== ultimoCodigo) {
    descricaoParaCelula = item.descricao || '';
    ultimoCodigo = item.codigo;
  }
  ws.getCell(`L${linha}`).value = descricaoParaCelula;
  ws.getCell(`L${linha}`).alignment = { vertical: 'middle', horizontal: 'left' };

  ws.getCell(`AV${linha}`).value = item.diam || '';
  ws.getCell(`AV${linha}`).alignment = { vertical: 'middle', horizontal: 'left' };

  ws.getCell(`BB${linha}`).value = item.qtd_total ?? '';
  ws.getCell(`BM${linha}`).value = item.rev ?? '';
  ws.getCell(`BH${linha}`).value = item.versao ?? '';
  ws.getCell(`BR${linha}`).value = item.arquivo_origem || '';
  ws.getCell(`BR${linha}`).alignment = { vertical: 'middle', horizontal: 'left' };

  i++;
}

  const totalAbas = Math.max(1, Math.ceil(i / LIMITE_ITENS_POR_ABA));
  await preencherCapaUpload(workbook, {
    rev,
    nomeArea,
    versaoUpload: 'MAPA TOTAL',
    area_id,
    totalAbas
  });

  const pastaDestino = path.resolve('planilhas-mapa-total');
  if (!fs.existsSync(pastaDestino)) fs.mkdirSync(pastaDestino);

  const nomeArquivo = `${nomeArea}_mapa_total_rev${rev}.xlsx`;
  const caminhoCompleto = path.join(pastaDestino, nomeArquivo);
  garantirMargensWorkbook(workbook);
  await workbook.xlsx.writeFile(caminhoCompleto);

  return nomeArquivo;
}

// PLANILHA DE COMPARAÇÃO
async function gerarPlanilhaDiferencas(diferencas, nomeProjeto, nomeArea, rev1, rev2) {
  const templatePath = path.resolve('uploads', 'template_comparacao.xlsx');
  const workbook = new Excel.Workbook();
  await workbook.xlsx.readFile(templatePath);
  garantirMargensWorkbook(workbook);

  const imgId = workbook.addImage({
    filename: path.resolve('uploads', 'Imagem1.jpg'),
    extension: 'jpg'
  });

  const LIMITE_ITENS_POR_ABA = 34;
  const linhaInicial = 7; // <-- FALTAVA

  const wsOriginal = workbook.getWorksheet('FOLHA 1');
  if (!wsOriginal) throw new Error('Aba FOLHA 1 não encontrada no template.');

  // Logo na 1ª aba
  wsOriginal.addImage(imgId, {
    tl: { col: 0, row: 0 },
    ext: { width: 115, height: 105 }
  });

  // CAPA
  const diferencasFiltradas = (diferencas || []).filter(d =>
    d && ['ALTERADO', 'ADICIONADO'].includes(d.status)
  );

  const capa = workbook.getWorksheet('CAPA');
  if (capa) {
    capa.getCell('M4').value = nomeArea || '';
    capa.getCell('L5').value = `COMPARAÇÃO REV ${rev1} x REV ${rev2}`;
    capa.getCell('AC1').value = `${rev1} x ${rev2}`;
    capa.getCell('M2').value = nomeProjeto || '';
    capa.getCell('AX2').value = Math.max(1, Math.ceil(diferencasFiltradas.length / LIMITE_ITENS_POR_ABA));
  }

  // Cabeçalhos da FOLHA 1
  wsOriginal.getCell('Q2').value = nomeArea || '';
  wsOriginal.getCell('Q3').value = `COMPARAÇÃO DA REV ${rev1} E ${rev2}`;
  wsOriginal.getCell('AM1').value = `${nomeProjeto}_rev${rev1}_vs_rev${rev2}.xlsx`;
  wsOriginal.getCell('AV6').value = `QTD REV(${rev1})`;
  wsOriginal.getCell('BB6').value = `QTD REV(${rev2})`;
  // opcional: wsOriginal.getCell('BH6').value = `DIF. (${rev2}-${rev1})`;

  // Limpeza padrão por aba (só colunas usadas)
  const limparBloco = (ws) => {
    for (let r = linhaInicial; r < linhaInicial + LIMITE_ITENS_POR_ABA; r++) {
      ws.getCell(`A${r}`).value  = null;
      ws.getCell(`E${r}`).value  = null;
      ws.getCell(`L${r}`).value  = null;
      ws.getCell(`AV${r}`).value = null;
      ws.getCell(`BB${r}`).value = null;
      ws.getCell(`BH${r}`).value = null;
      ws.getCell(`BM${r}`).value = null;
    }
  };
  limparBloco(wsOriginal);

  let abaIndex = 1;
  let ws = wsOriginal;
  let i = 0;

  for (const item of diferencasFiltradas) {
    if (i > 0 && i % LIMITE_ITENS_POR_ABA === 0) {
      abaIndex++;
      ws = clonarAba(workbook, wsOriginal, `FOLHA ${abaIndex}`);

      ws.addImage(imgId, {
        tl: { col: 0, row: 0 },
        ext: { width: 115, height: 105 }
      });

      ws.getCell('Q2').value = nomeArea || '';
      ws.getCell('Q3').value = `COMPARAÇÃO DA REV ${rev1} E ${rev2}`;
      ws.getCell('AM1').value = `${nomeProjeto}_rev${rev1}_vs_rev${rev2}.xlsx`;
      ws.getCell('AV6').value = `QTD REV(${rev1})`;
      ws.getCell('BB6').value = `QTD REV(${rev2})`;

      limparBloco(ws);
    }

    const linha = linhaInicial + (i % LIMITE_ITENS_POR_ABA);

    const qAnt = Number(item.qtd_anterior ?? 0);
    const qNov = Number(item.qtd_atual ?? 0);

    ws.getCell(`A${linha}`).value = i + 1;
    ws.getCell(`E${linha}`).value = item.codigo || '';
    ws.getCell(`L${linha}`).value = item.descricao || '';
    ws.getCell(`L${linha}`).alignment = { vertical: 'middle', horizontal: 'left' };
    ws.getCell(`AV${linha}`).value = qAnt;
    ws.getCell(`BB${linha}`).value = qNov;
    ws.getCell(`BH${linha}`).value = qNov - qAnt;
    ws.getCell(`BM${linha}`).value = item.status || '';

    i++;
  }

  // Limpa sobras da última aba
  const usados = (i % LIMITE_ITENS_POR_ABA) === 0 ? LIMITE_ITENS_POR_ABA : (i % LIMITE_ITENS_POR_ABA);
  const primeiraVazia = linhaInicial + usados;
  const ultimaLinha = linhaInicial + LIMITE_ITENS_POR_ABA - 1;
  if (primeiraVazia <= ultimaLinha) {
    for (let r = primeiraVazia; r <= ultimaLinha; r++) {
      ws.getCell(`A${r}`).value  = null;
      ws.getCell(`E${r}`).value  = null;
      ws.getCell(`L${r}`).value  = null;
      ws.getCell(`AV${r}`).value = null;
      ws.getCell(`BB${r}`).value = null;
      ws.getCell(`BH${r}`).value = null;
      ws.getCell(`BM${r}`).value = null;
    }
  }

  const pastaDestino = path.resolve('planilhas-comparacoes');
  if (!fs.existsSync(pastaDestino)) fs.mkdirSync(pastaDestino);

  const nomeArquivo = `${nomeProjeto}_rev${rev1}_vs_rev${rev2}.xlsx`;
  await workbook.xlsx.writeFile(path.join(pastaDestino, nomeArquivo));
  return nomeArquivo;
}

function compararMapasRevisao(listaAntiga, listaNova) {
  const agrupar = (lista) => {
    const m = new Map();
    for (const it of (lista || [])) {
      const codigo = norm(it?.codigo);
      if (!codigo) continue;
      const qtd = Number(it?.qtd_total ?? it?.qtd ?? 0);
      const desc = (it?.descricao ?? it?.desc ?? '').toString().trim();
      if (!m.has(codigo)) m.set(codigo, { descricao: desc, qtd_total: 0 });
      const ref = m.get(codigo);
      ref.qtd_total += isNaN(qtd) ? 0 : qtd;
      if (!ref.descricao && desc) ref.descricao = desc;
    }
    return m;
  };

  const mAnt = agrupar(listaAntiga);
  const mNov = agrupar(listaNova);

  const codigos = new Set([...mAnt.keys(), ...mNov.keys()]);
  const out = [];

  for (const codigo of codigos) {
    const a = Number(mAnt.get(codigo)?.qtd_total ?? 0);
    const n = Number(mNov.get(codigo)?.qtd_total ?? 0);
    const desc = (mNov.get(codigo)?.descricao || mAnt.get(codigo)?.descricao || '').toString();

    let status = null;
    if (a === 0 && n > 0) status = 'ADICIONADO';
    else if (a !== n)     status = 'ALTERADO';

    if (status) out.push({ codigo, descricao: desc, qtd_anterior: a, qtd_atual: n, diferenca: n - a, status });
  }

  out.sort((x, y) => x.codigo.localeCompare(y.codigo, 'pt-BR'));
  return out;
}

// LEITURA DE PLANILHA 
async function lerMapaRevisaoDoTemplate(caminhoArquivo) {
  const workbook = new Excel.Workbook();
  await workbook.xlsx.readFile(caminhoArquivo);

  const folhas = workbook.worksheets.filter(ws =>
    typeof ws.name === 'string' && ws.name.toUpperCase().startsWith('FOLHA')
  );
  if (folhas.length === 0) {
    throw new Error('Nenhuma aba "FOLHA" encontrada no arquivo de revisão.');
  }

  const COL_COD  = 5;   
  const COL_DESC = 12;  
  const COL_QTD  = 54;  
  const LINHA_INI = 7;

  const parseQtd = (val) => {
    if (val == null) return 0;
    if (typeof val === 'number') return val;
    if (typeof val === 'object') {
      if (typeof val.result === 'number') return val.result;
      if (typeof val.result === 'string') return parseQtd(val.result);
      if (Array.isArray(val.richText)) return parseQtd(val.richText.map(t => t.text ?? '').join(''));
      if (typeof val.text === 'string') return parseQtd(val.text);
      val = val.toString?.() ?? '';
    }
    let s = String(val).trim();
    if (!s) return 0;
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  };

  const mapa = new Map(); 

  for (const ws of folhas) {
    const LINHA_FIM = ws.lastRow?.number ? ws.lastRow.number : 2000;

    for (let r = LINHA_INI; r <= LINHA_FIM; r++) {
      const row = ws.getRow(r);
      const codigo = norm(row.getCell(COL_COD).value);
      if (!codigo) continue;

      const possivelNota = (row.getCell(COL_COD).value ?? '').toString().trim().toUpperCase();
      if (possivelNota.startsWith('NOTAS')) continue;

      const descricao = (row.getCell(COL_DESC).value ?? '').toString().trim();
      const qtd = parseQtd(row.getCell(COL_QTD).value);

      if (!mapa.has(codigo)) {
        mapa.set(codigo, { codigo, descricao, qtd_total: 0 });
      }
      const ref = mapa.get(codigo);
      ref.qtd_total += Number(qtd) || 0;
      if (!ref.descricao && descricao) ref.descricao = descricao;
    }
  }

  return Array.from(mapa.values());
}
module.exports = {
  gerarPlanilhaUploadDWG,
  gerarPlanilhaRevisaoUpload,
  gerarPlanilhaDiferencas,
  lerMapaRevisaoDoTemplate,
  gerarPlanilhaMapaTotal,
  compararMapasRevisao
};

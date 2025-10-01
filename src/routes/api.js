const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const { lerPlanilha } = require('../modules/excel-processor');
const db = require('../modules/database');
const { converterDWG} = require('../modules/dwg-processor');
const { processarDXF } = require('../modules/dxf-processor');
const {
  gerarPlanilhaRevisaoUpload,
  gerarPlanilhaDiferencas,
  lerMapaRevisaoDoTemplate,
  gerarPlanilhaUploadDWG,
  gerarPlanilhaMapaTotal,
  compararMapasRevisao
} = require('../modules/mapa-planilha');
const {
  obterProximaVersao,
  obterRevisaoDaArea,
  obterNomeDoProjetoPorAreaId,
} = require('../modules/area-utils');
const jwt = require('jsonwebtoken');

const validarToken = require('../modules/auth.js');

// Configuração do multer
const storage = multer.diskStorage({
  filename: (req, file, cb) => cb(null, file.originalname),
  destination: (req, file, cb) => {
    const uploadDir = path.resolve(__dirname, '../../arquivos-dwg');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname); 
  }
});
const upload = multer({ storage });

// Autentificador do token
router.post('/api/auth/exchange-token', (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ erro: 'Token do portal ausente' });

  // Valida o token do portal
  jwt.verify(token, process.env.jwtSecret, (err, user) => {
    if (err) return res.status(403).json({ erro: 'Token do portal inválido' });

    // Gera o token do SGI
    const SGI_TOKEN = jwt.sign(
      { id: user.id, nome: user.nome },
      process.env.JWT_SECRET_SGI,
      { expiresIn: '8h' }
    );
    res.json({ SGI_TOKEN });
  });
});


// ------ ROTAS ------

// ROTAS GET

// Info da área (rev e última versão dessa rev)
router.get('/areas/:area_id/info', validarToken, async(req,res) => {
  try {
    const area_id = Number(req.params.area_id);
    const [rowsA] = await db.query('SELECT rev FROM area WHERE id = ?', [area_id]);
    if (!rowsA.length) return res.status(404).json({ erro: 'Área não encontrada' });
    const revAtual = Number(rowsA[0].rev) || 0;

    const [rowsV] = await db.query(
      'SELECT MAX(versao) AS versaoAtual FROM isometricos_gerados WHERE area_id=? AND rev=?',
      [area_id, revAtual]
    );
    const versaoAtual = Number(rowsV[0]?.versaoAtual ?? 0);
    res.json({ revAtual, versaoAtual });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Falha ao obter info da área' });
  }
});

// Lista versões existentes de uma revisão
router.get('/areas/:area_id/rev/:rev/versoes', validarToken, async(req,res) => {
  try {
    const area_id = Number(req.params.area_id);
    const rev = Number(req.params.rev);
    const [rows] = await db.query(
      'SELECT DISTINCT versao FROM isometricos_gerados WHERE area_id=? AND rev=? ORDER BY versao ASC',
      [area_id, rev]
    );
    const versoes = rows.map(r => Number(r.versao));
    res.json({ versoes });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Falha ao listar versões' });
  }
});

router.get('/areas/:area_id/rev/:rev/versao/:versao/download', validarToken, async(req,res) => {
  try {
    const area_id = Number(req.params.area_id);
    const rev = Number(req.params.rev);
    const versao = Number(req.params.versao);

    const [a] = await db.query('SELECT nome FROM area WHERE id=?', [area_id]);
    if (!a.length) return res.status(404).json({ erro: 'Área não encontrada' });
    const nomeArea = a[0].nome;

    const nomeArquivo = `${nomeArea}_upload_v${versao}_rev${rev}.xlsx`;
    const caminho = path.resolve('planilhas-geradas', nomeArquivo);
    if (!fs.existsSync(caminho)) {
      return res.status(404).json({ erro: 'Arquivo não encontrado' });
    }
    res.download(caminho, nomeArquivo);
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Falha no download da versão' });
  }
});
 
// Listar clientes
router.get('/lista-clientes', validarToken, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT id, codigo FROM projeto');
    res.json(rows);
  } catch (error) {
    console.error('Erro ao listar clientes:', error);
    res.status(500).json({ erro: 'Erro ao buscar clientes' });
  }
    console.log(req.headers.authorization)
});

// Listar projeto dos clientes
router.get('/clientes/:id/projetos', validarToken, async (req, res) => {
  const clienteId = req.params.id;

  try {
    const [rows] = await db.query(
      'SELECT id, nome, rev FROM area WHERE projeto_id = ?',
      [clienteId]
    );
    res.json(rows);
  } catch (error) {
    console.error('Erro ao listar projetos do cliente:', error);
    res.status(500).json({ erro: 'Erro ao buscar projetos do cliente' });
  }
});

// Listar materiais
router.get('/materiais', validarToken, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM isometricos_gerados');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ erro: error.message });
  }
});

// Rota GET de conversão de pasta inteira (usada para testes em lote)
router.get('/converter-dwg', validarToken, async (req, res) => {
  try {
    const inputFolder = path.resolve(__dirname, '../../arquivos-dwg');
    const outputFolder = path.resolve(__dirname, '../../arquivos-dwg/convertido-dxf');

    await converterDWG(inputFolder, outputFolder);

    const arquivosDXF = fs.readdirSync(outputFolder).filter(file => file.toLowerCase().endsWith('.dxf'));

    if (arquivosDXF.length === 0) {
      return res.status(404).json({ erro: 'Nenhum arquivo DXF encontrado após conversão.' });
    }

    const resultadosComPlanilhas = [];

    for (const nomeArquivo of arquivosDXF) {
      const caminhoCompleto = path.join(outputFolder, nomeArquivo);
      const dados = await processarDXF(caminhoCompleto);

      const nomeExcel = path.basename(nomeArquivo, '.dxf') + '_resultado.xlsx';
      const caminhoExcel = path.resolve('planilhas-geradas', nomeExcel);

      resultadosComPlanilhas.push({
        arquivoDXF: nomeArquivo,
        planilhaGerada: nomeExcel,
        dados: dados,
        caminhoExcel: caminhoExcel
      });
    }

    const primeiroExcel = resultadosComPlanilhas[0];
    res.download(primeiroExcel.caminhoExcel, primeiroExcel.planilhaGerada, err => {
      if (err) {
        console.error('Erro ao enviar o arquivo:', err);
        return res.status(500).json({ erro: 'Falha ao baixar a planilha.' });
      }
    });

  } catch (error) {
    console.error('Erro na rota /converter-dwg:', error);
    res.status(500).json({ erro: error.message });
  }
});

// Gerar relatorio de isometricos
router.get('/mapa-total/:area_id', validarToken, async (req, res) => {
  try {
    const area_id = req.params.area_id;
    const [areaRows] = await db.query('SELECT nome, rev FROM area WHERE id = ?', [area_id]);
    if (!areaRows.length) return res.status(404).json({ erro: 'Área não encontrada.' });

    const nomeArea = areaRows[0].nome;
    const rev = areaRows[0].rev;

    const [itens] = await db.query(`
      SELECT 
        mg.codigo,
        mg.descricao,
        mg.diam,
        mg.arquivo_origem,
        SUM(mg.qtd) AS qtd_total,
        mg.versao,
        mg.rev,
        a.nome AS area_nome
      FROM isometricos_gerados mg
      JOIN area a ON mg.area_id = a.id
      WHERE mg.area_id = ?
      GROUP BY mg.codigo, mg.diam, mg. arquivo_origem,mg.versao, mg.rev
      ORDER BY mg.codigo, mg.versao
    `, [area_id]);

    if (!itens.length) return res.status(404).json({ erro: 'Nenhum item encontrado para esta área.' });

    const nomeArquivo = await gerarPlanilhaMapaTotal(itens, nomeArea, rev, area_id);

    const caminhoCompleto = require('path').resolve('planilhas-mapa-total', nomeArquivo);
    res.download(caminhoCompleto, nomeArquivo);

  } catch (error) {
    console.error('Erro ao gerar mapa total:', error);
    res.status(500).json({ erro: 'Erro ao gerar mapa total', detalhes: error.message });
  }
});

// Baixar comparação
router.get('/comparar-revisoes/download/:arquivo', validarToken, (req, res) => {
  const { arquivo } = req.params;

  const caminho = path.resolve('planilhas-comparacoes', arquivo);
  if (!fs.existsSync(caminho)) {
    return res.status(404).json({ erro: 'Arquivo não encontrado' });
  }

  res.download(caminho, arquivo);
});

// Baixar ultima rev
router.get('/areas/:areaId/rev/:rev/ultima-versao', validarToken, async (req, res) => {
  const { areaId, rev } = req.params;
  try {
    const [rows] = await db.execute(`
      SELECT MAX(versao) as ultima
      FROM isometricos_gerados
      WHERE area_id = ? AND rev = ?
    `, [areaId, rev]);

    res.json({ ultima: rows[0]?.ultima ?? null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao buscar última versão' });
  }
});

// Baixar planilha
router.get('/download-planilha',  validarToken, (req, res) => {
  const { path: arquivo } = req.query;
  const caminho = path.resolve('planilhas-geradas', arquivo);
  if (!fs.existsSync(caminho)) return res.status(404).send('Arquivo não encontrado');
  return res.download(caminho);
});

router.get('/areas/:area_id/revisoes',  validarToken, async (req, res) => {
  const { area_id } = req.params;
  try {
    const [rows] = await db.execute(`
      SELECT rev, versao
      FROM isometricos_gerados
      WHERE area_id = ?
      GROUP BY rev, versao
      ORDER BY rev, versao
    `, [area_id]);

    const mapa = new Map();
    for (const row of rows) {
      const r = Number(row.rev);
      const v = Number(row.versao);
      if (!mapa.has(r)) mapa.set(r, []);
      mapa.get(r).push(v);
    }

    const revisoes = Array.from(mapa.entries()).map(([rev, versoes]) => ({
      rev,
      versoes
    }));

    res.json(revisoes);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao listar revisões' });
  }
});

// POST 

// Upload e processamento de DWG
router.post('/upload-dwg', upload.array('arquivo', 20),  validarToken, async (req, res) => {
  try {
    const { area_id } = req.body;
    if (!area_id) {
      return res.status(400).json({ erro: 'area_id é obrigatório' });
    }

    const rev = await obterRevisaoDaArea(area_id);
    const versao = await obterProximaVersao(area_id, rev);
    const nomeProjeto = await obterNomeDoProjetoPorAreaId(area_id);

    const inputFolder = path.resolve(__dirname, '../../arquivos-dwg');
    const outputFolder = path.resolve(__dirname, '../../arquivos-dwg/convertido-dxf');
    await converterDWG(inputFolder, outputFolder);

    const resultados = [];
    const itensFiltrados = [];

    for (const file of req.files) {
      const nomeDXF = path.basename(file.originalname, '.dwg') + '.dxf';
      const caminhoDXF = path.join(outputFolder, nomeDXF);

      const resultado = await processarDXF(caminhoDXF, area_id, versao, rev);
      resultados.push({ arquivo: file.originalname, resultado });

      for (const item of resultado) {
  const codigo = item.codigo?.toString().replace(/\./g, '').trim().toUpperCase();
  if (!codigo) continue;

  let qtdStr = (item.qtd ?? '').toString().trim();
  let qtd_total = 0;
  if (qtdStr.includes(',')) {
    qtd_total = parseFloat(qtdStr.replace(/\./g, '').replace(',', '.')) || 0;
  } else {
    qtd_total = parseFloat(qtdStr) || 0;
  }

  itensFiltrados.push([
    codigo,
    {
      descricao: item.descricao || '',
      qtd_total,
      itens: [{
        arquivo_origem: item.arquivo_origem || file.originalname,
        diam: item.diam || '',
        qtd: item.qtd || ''
      }]
    }
  ]);
}
    }

    const nomeArquivo = await gerarPlanilhaUploadDWG(itensFiltrados, nomeProjeto, rev, versao, area_id);

    res.json({
      mensagem: 'Arquivos processados e planilha gerada com sucesso.',
      versao,
      rev,
      arquivoGerado: nomeArquivo,
      resultados
    });

  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao processar arquivos DWG', detalhes: erro.message });
  }
});

// Comparar revisões
router.post('/comparar-revisoes/:area_id/:rev1/:rev2',  validarToken, async (req, res) => {
  try {
    const { area_id, rev1, rev2 } = req.params;

    const [areaRows] = await db.query('SELECT nome, projeto_id FROM area WHERE id = ?', [area_id]);
    if (!areaRows.length) return res.status(404).json({ erro: 'Área não encontrada.' });
    const nomeArea   = areaRows[0].nome;
    const projeto_id = areaRows[0].projeto_id;

    const [projRows] = await db.query('SELECT codigo AS codigoProjeto FROM projeto WHERE id = ?', [projeto_id]);
    const codigoProjeto = projRows?.[0]?.codigoProjeto || '';

    const nomeProjeto = nomeArea;

    const body = req.body || {};
    const q    = req.query || {};
    const paramArq1 = body.arq1 || q.arq1; 
    const paramArq2 = body.arq2 || q.arq2;

    const pastaRevisoes = path.resolve('planilhas-revisoes');
    const pastaUploads  = path.resolve('uploads');

    const candidatos = (rev) => ([
      path.join(pastaRevisoes, `${nomeArea}_revisao_${rev}.xlsx`),
      path.join(pastaUploads,  `relatoriosdwg_revisao_${rev}.xlsx`),
    ]);

    const pick = (arr) => arr.find(p => fs.existsSync(p));

    let caminho1 = paramArq1 ? path.resolve(paramArq1) : pick(candidatos(rev1));
    let caminho2 = paramArq2 ? path.resolve(paramArq2) : pick(candidatos(rev2));

    if (caminho1 && caminho2 && fs.existsSync(caminho1) && fs.existsSync(caminho2)) {
      const lista1 = await lerMapaRevisaoDoTemplate(caminho1, 'antiga', { strict: true }); // AV
      const lista2 = await lerMapaRevisaoDoTemplate(caminho2, 'nova',   { strict: true }); // BB

      const diferencas = compararMapasRevisao(lista1, lista2).filter(d =>
      d.status === 'ALTERADO' || d.status === 'ADICIONADO'
      );

console.log('dif:', {
  adicionados: diferencas.filter(d => d.status === 'ADICIONADO').length,
  alterados:  diferencas.filter(d => d.status === 'ALTERADO').length
});
      const nomeArquivo = await gerarPlanilhaDiferencas(
        diferencas,
        nomeProjeto,
        nomeArea,
        Number(rev1),
        Number(rev2)
      );

      const caminhoSaida = path.resolve('planilhas-comparacoes', nomeArquivo);
      return res.download(caminhoSaida, nomeArquivo);
    }

    const [versaoRows1] = await db.query(
      'SELECT MAX(versao) AS versao FROM isometricos_gerados WHERE area_id = ? AND rev = ?',
      [area_id, rev1]
    );
    const [versaoRows2] = await db.query(
      'SELECT MAX(versao) AS versao FROM isometricos_gerados WHERE area_id = ? AND rev = ?',
      [area_id, rev2]
    );
    const versao1 = versaoRows1[0]?.versao;
    const versao2 = versaoRows2[0]?.versao;

    if (!versao1 || !versao2) {
      return res.status(404).json({ erro: 'Não foi possível encontrar as versões das revisões informadas.' });
    }

    const caminhoPadrao1 = path.join(pastaRevisoes, `${nomeArea}_revisao_${rev1}.xlsx`);
    const caminhoPadrao2 = path.join(pastaRevisoes, `${nomeArea}_revisao_${rev2}.xlsx`);
    if (!fs.existsSync(caminhoPadrao1) || !fs.existsSync(caminhoPadrao2)) {
      return res.status(404).json({ erro: 'Um ou ambos os arquivos de revisão não foram encontrados.' });
    }

    const lista1 = await lerMapaRevisaoDoTemplate(caminho1); // rev1 
    const lista2 = await lerMapaRevisaoDoTemplate(caminho2); // rev2 

    const diferencas = compararMapasRevisao(lista1, lista2).filter(d =>
      d.status === 'ALTERADO' || d.status === 'ADICIONADO'
    );

    const nomeArquivo = await gerarPlanilhaDiferencas(
      diferencas,
      nomeProjeto,
      nomeArea,
      Number(rev1),
      Number(rev2)
    );

    const caminhoSaida = path.resolve('planilhas-comparacoes', nomeArquivo);
    return res.download(caminhoSaida, nomeArquivo);

  } catch (error) {
    console.error('Erro ao gerar planilha de comparação:', error);
    res.status(500).json({ erro: 'Erro ao gerar planilha de comparação', detalhes: error.message });
  }
});

// Criar clientes
router.post('/clientes', validarToken, async (req, res) => {
  const { codigo } = req.body;
  if (!codigo) return res.status(400).json({ erro: 'O campo "codigo" é obrigatório.' });

  try {
    const [result] = await db.execute('INSERT INTO projeto (codigo) VALUES (?)', [codigo]);
    res.status(201).json({ mensagem: 'Cliente criado com sucesso', id: result.insertId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: 'Erro ao criar cliente' });
  }
});

// Criar projetos
router.post('/projetos', validarToken, async (req, res) => {
  const { nome, projeto_id } = req.body;
  if (!nome || !projeto_id) return res.status(400).json({ erro: 'Campos "nome" e "projeto_id" são obrigatórios.' });

  try {
    const [result] = await db.execute(
      'INSERT INTO area (nome, projeto_id, rev) VALUES (?, ?, 0)',
      [nome, projeto_id]
    );
    res.status(201).json({ mensagem: 'Area criada com sucesso', id: result.insertId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: 'Erro ao criar área' });
  }
});

// Subir revisão
router.post('/subir-rev', validarToken, async (req, res) => {
  const { area_id } = req.body;

  if (!area_id) {
    return res.status(400).json({ erro: 'O campo area_id é obrigatório.' });
  }

  try {
    // 1) Dados da área
    const [areaRows] = await db.execute(
      'SELECT rev, nome FROM area WHERE id = ?',
      [area_id]
    );
    if (areaRows.length === 0) {
      return res.status(404).json({ erro: 'Área não encontrada.' });
    }

    const revAtual = Number(areaRows[0].rev) || 0;
    const nomeProjeto = areaRows[0].nome;

    // (opcional) pega última versão fechada da revisão atual
    const [versaoRows] = await db.execute(
      'SELECT MAX(versao) AS versao_finalizada FROM isometricos_gerados WHERE area_id = ? AND rev = ?',
      [area_id, revAtual]
    );
    const versaoFinalizada = versaoRows[0]?.versao_finalizada ?? 1;

    // 2) Busca todos isométricos da área (todas as revisões)
    const [todosIsometricos] = await db.query(
      `SELECT codigo, descricao, qtd AS qtd_total, rev, versao, area_id
         FROM isometricos_gerados
        WHERE area_id = ?
        ORDER BY codigo, rev, versao`,
      [area_id]
    );

    // 3) Monta pares [codigo_normalizado, item]
    const itensFiltrados = (todosIsometricos || []).map((item) => [
      (item.codigo ?? '').toString().replace(/\./g, '').trim().toUpperCase(),
      item,
    ]);

    // 4) Gera a planilha da revisão ATUAL (que está sendo fechada)
    const nomeArquivoGerado = await gerarPlanilhaRevisaoUpload(
      itensFiltrados,
      nomeProjeto,
      revAtual,
      area_id
    );

    // 5) Sobe a revisão para a próxima
    const novaRev = revAtual + 1;
    await db.execute('UPDATE area SET rev = ? WHERE id = ?', [novaRev, area_id]);

    // 6) Define o nome do arquivo para download no padrão correto
    const nomeArquivoDownload = `${nomeProjeto}_rev_${revAtual}.xlsx`;

    // 7) Força DOWNLOAD do arquivo gerado
    const filePath = path.resolve('planilhas-revisoes', nomeArquivoGerado);

    // Metadados úteis via header
    res.setHeader('X-Nova-Rev', String(novaRev));
    res.setHeader('X-Versao-Final', String(versaoFinalizada));
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${nomeArquivoDownload}"`);

    return res.download(filePath, nomeArquivoDownload, (err) => {
      if (err) {
        console.error('Falha ao enviar download:', err);
        if (!res.headersSent) {
          res
            .status(500)
            .json({ erro: 'Falha ao baixar a planilha', detalhes: err.message });
        }
      }
    });
  } catch (error) {
    console.error('Erro ao subir revisão:', error);
    return res
      .status(500)
      .json({ erro: 'Erro ao subir revisão', detalhes: error.message });
  }
});

// Subir EXCEL para BD
router.post('/upload-planilha', upload.single('arquivo'),  validarToken, async (req, res) => {
  try {
    const { area_id } = req.body;
    if (!area_id) {
      return res.status(400).json({ erro: 'area_id é obrigatório' });
    }
    if (!req.file) {
      return res.status(400).json({ erro: 'Arquivo não enviado' });
    }

    const caminhoArquivo = req.file.path;

    const linhas = lerPlanilha(caminhoArquivo); 
    console.log(`Linhas lidas: ${linhas.length}`);

    const mapa = new Map();

    for (const linha of linhas) {
      const nome = (linha?.nome ?? linha?.Nome ?? '').toString().trim();
      const quantidadeRaw = (linha?.quantidade ?? linha?.Quantidade ?? '0').toString().trim();
      const nm = (linha?.nm ?? linha?.NM ?? '').toString().trim().toUpperCase();

      if (!nome || !nm) {
        console.log('Linha ignorada (nome ou nm vazios):', { nome, nm, quantidadeRaw });
        continue;
      }

      const qtd = parseFloat(quantidadeRaw.replace(/[^\d,.-]/g, '').replace(',', '.')) || 0;

      await db.execute(
        'INSERT INTO materiais_excel (nome, quantidade, nm) VALUES (?, ?, ?)',
        [nome, qtd, nm]
      );

      if (!mapa.has(nm)) {
        mapa.set(nm, {
          descricao: nome,
          qtd_total: 0,
          itens: [] 
        });
      }
      const entry = mapa.get(nm);
      entry.qtd_total += qtd;

      entry.itens.push({
        arquivo_origem: path.basename(req.file.originalname),
        diam: '', 
        qtd: qtd.toString()
      });
    }

    const rev = await obterRevisaoDaArea(area_id);
    const versao = await obterProximaVersao(area_id, rev);
    const nomeArea = await obterNomeDaArea(area_id);

    const nomeArquivo = await gerarPlanilhaUploadDWG(mapa, nomeArea, rev, versao, area_id);

    try { fs.unlinkSync(caminhoArquivo); } catch (_) {}

    return res.json({
      mensagem: 'Arquivo processado, dados inseridos e planilha gerada com sucesso.',
      area_id,
      rev,
      versao,
      arquivoGerado: nomeArquivo,
      totalItens: mapa.size
    });

  } catch (error) {
    console.error('Erro em /upload-planilha:', error);
    return res.status(500).json({ erro: 'Erro ao processar arquivo', detalhes: error.message });
  }
});

// PUT

// Alterar ID de cliente
router.put('/clientes/trocar', validarToken, async (req, res) => {
 const { projeto_id, novo_cliente_id } = req.body;

  try {
    if (!projeto_id || !novo_cliente_id) {
      return res.status(400).json({
        erro: 'Campos obrigatórios ausentes',
        campos_esperados: ['projeto_id', 'novo_cliente_id']
      });
    }

    const [projeto] = await db.execute(
      `SELECT id FROM projeto WHERE id = ? LIMIT 1`,
      [projeto_id]
    );
    if (projeto.length === 0) {
      return res.status(404).json({ erro: 'Projeto não encontrado' });
    }
                            
    const [cliente] = await db.execute(
      `SELECT id FROM projeto WHERE id = ? LIMIT 1`,
      [novo_cliente_id]
    );
    if (cliente.length === 0) {
      return res.status(404).json({ erro: 'Novo cliente não encontrado' });
    }

    const [resultado] = await db.execute(
      `UPDATE projeto SET cliente_id = ? WHERE id = ?`,
      [novo_cliente_id, projeto_id]
    );

    if (resultado.affectedRows === 0) {
      return res.status(400).json({ erro: 'Nenhuma alteração realizada' });
    }

    res.json({
      mensagem: 'Cliente do projeto alterado com sucesso',
      projeto_id,
      novo_cliente_id
    });

  } catch (error) {
    console.error('Erro ao trocar cliente do projeto:', error);
    res.status(500).json({
      erro: 'Erro ao trocar cliente do projeto',
      detalhes: error.message
    });
  }
});

// DELETE

// Deletar cliente
router.delete('/clientes/remover/:id', validarToken, async (req, res) => {
  try {
    const id = req.params.id;

    if (!id) {
      return res.status(400).json({ erro: 'ID do cliente não fornecido' });
    }

    const [resultado] = await db.execute(
      "DELETE FROM projeto WHERE id = ?",
      [id]
    );

    if (resultado.affectedRows === 0) {
      return res.status(404).json({ erro: 'Cliente não encontrado' });
    }

    res.json({
      mensagem: 'Cliente deletado com sucesso',
    });

  } catch (error) {
    console.error('Erro ao deletar cliente:', error);
    res.status(500).json({
      erro: 'Erro ao deletar cliente',
      detalhes: error.message,
    });
  }
});

// Deletar projeto
router.delete('/projetos/remover', validarToken, async (req, res) => {
  const { projeto_id, area_id } = req.body;
  let conn;

  try {
    if (!projeto_id || !area_id) {
      return res.status(400).json({ 
        erro: 'Campos obrigatórios ausentes',
        campos_esperados: ['area_id', 'projeto_id']
      });
    }

    conn = await db.getConnection();
    await conn.beginTransaction();

    const [areaRows] = await conn.execute(
      `SELECT id FROM area WHERE id = ? AND projeto_id = ? LIMIT 1`,
      [area_id, projeto_id]
    );
    if (areaRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ 
        erro: 'Vínculo inválido: área não pertence ao projeto (ou não existe)' 
      });
    }

    await conn.execute(
      `DELETE ig
         FROM isometricos_gerados ig
         JOIN area a ON a.id = ig.area_id
        WHERE a.projeto_id = ?`,
      [projeto_id]
    );

    await conn.execute(
      `DELETE FROM area WHERE projeto_id = ?`,
      [projeto_id]
    );

    if (delProjeto.affectedRows === 0) {
      await conn.rollback();
      return res.status(404).json({ erro: 'Projeto não encontrado' });
    }

    await conn.commit();
    return res.json({
      mensagem: 'Projeto deletado com sucesso (e dados relacionados)',
      projeto_id,
    });

  } catch (error) {
    if (conn) await conn.rollback();
    console.error('Erro ao deletar projeto:', error);
    return res.status(500).json({
      erro: 'Erro ao deletar projeto',
      detalhes: error.message
    });
  } finally {
    if (conn) conn.release();
  }
});

module.exports = router;

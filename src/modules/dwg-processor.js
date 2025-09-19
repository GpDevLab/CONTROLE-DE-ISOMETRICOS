const { execFile } = require('child_process');
const path = require('path');

const odaPath = 'C:\\Program Files\\ODA\\ODAFileConverter 26.4.0\\ODAFileConverter.exe';

function converterDWG(inputFolder, outputFolder, outputVersion = 'ACAD2010') {
  return new Promise((resolve, reject) => {
    console.log('Executando conversão com:');
    console.log('inputFolder:', inputFolder);
    console.log('outputFolder:', outputFolder);

    const args = [
      inputFolder,
      outputFolder,
      outputVersion,
      'DXF',
      '1',
      '1',
      '*.DWG'
    ];

    execFile(odaPath, args, (error, stdout, stderr) => {
      if (error) {
        return reject(`Erro na conversão: ${stderr || error.message}`);
      }
      resolve(`Conversão realizada com sucesso:\n${stdout}`);
    });
  });
}

function converterDWGparaDXF(caminhoDWG) {
  const inputFolder = path.dirname(caminhoDWG);
  const outputFolder = path.resolve(__dirname, '../../arquivos-dwg/convertido-dxf');
  return converterDWG(inputFolder, outputFolder);
}


module.exports = { converterDWG, converterDWGparaDXF };

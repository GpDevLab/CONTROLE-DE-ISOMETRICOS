# CONTROLE-DE-ISOMÉTRICOS

Um portal para controle de projetos e seus isométricos. Permite upload de arquivos `.dwg`, gerenciamento de clientes e projetos, controle de revisões e versões. Também gera planilhas de upload, revisões, mapa total e comparações entre revisões.

---

## 🧩 Funcionalidades

- Cadastro e gerenciamento de **Clientes**
- Cadastro e gerenciamento de **Projetos**
- Upload de arquivos `.dwg` associados a projetos
- Controle de **revisões** e versões dos isométricos
- Geração de planilhas:
  - Planilha de upload
  - Planilha de revisões
  - Mapa total
  - Comparações entre revisões

---

## 📁 Estrutura do projeto

Alguns diretórios principais:

arquivos-dwg/
dapp-controle-materiais/
planilhas-comparacoes/
planilhas-geradas/
planilhas-mapa-total/
planilhas-revisoes/
src/
uploads/
package.json
package-lock.json


- `src/` — código-fonte da aplicação
- `uploads/` — destino para arquivos carregados
- `planilhas-*` — diretórios relacionados às planilhas geradas

---

## 🛠️ Tecnologias usadas

- **JavaScript / TypeScript**  
- Outras dependências conforme listadas no `package.json`  
- ODA File Converter para conversão de .dwg para .dxf com objetivo de leitura do node

---

# Instalar dependências
npm install

# Rodar em modo de desenvolvimento
npm run dev

⚙️ Configuração / Variáveis de ambiente
Você pode precisar definir variáveis de ambiente como:

DATABASE_URL — string de conexão com o banco de dados

PORT — porta da aplicação

Outros conforme bibliotecas utilizadas (ex: armazenamento de arquivos, credenciais, etc.)

Crie um arquivo .env (ou similar) com esses valores:

dotenv
Copiar código
DATABASE_URL=...
PORT=3000
# Outras variáveis...
📊 Fluxo de trabalho / uso
Criar cliente

Criar projeto vinculado a cliente

Fazer upload de arquivo .dwg ao projeto

Versionar / revisar o isométrico conforme alterações

Gerar planilhas conforme necessidade (upload, revisões, comparações)

Visualizar mapa total e comparações entre revisões

✅ Boas práticas e sugestões futuras
Validar uploads de arquivo (tipo, tamanho, segurança)

Controle de permissões de usuário (quem pode subir, revisar, gerar planilhas)

Logging e monitoramento de erros

Versão de API e documentação (Swagger, OpenAPI)

Testes automatizados (unitários, integração)

CI / CD para deploy automático

🧾 Licença
Este projeto está sob a licença GP Engenharia e consultoria

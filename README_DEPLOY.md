# 🚀 Deploy - Plataforma E-Learning Google Apps Script

## 📦 Arquivos para Deploy

Esta pasta contém **4 arquivos** prontos para copiar no Google Apps Script:

1. **`code.gs`** - Backend (lógica do servidor)
2. **`index.html`** - Interface do aluno
3. **`backoffice.html`** - Painel administrativo
4. **`ADMIN_GUIDE.md`** - Guia para administradores

---

## ⚙️ Configuração Inicial

### 1. Criar Planilha Google Sheets

1. Acesse [sheets.google.com](https://sheets.google.com)
2. Crie uma nova planilha
3. Copie o **ID da planilha** (está na URL)
   - Exemplo: `https://docs.google.com/spreadsheets/d/1ABC123DEF456/edit`
   - ID: `1ABC123DEF456`

### 2. Configurar code.gs

Edite o arquivo `code.gs`:

**Linha 3** - Cole o ID da sua planilha:
```javascript
const SPREADSHEET_ID = 'SEU_ID_DA_PLANILHA_AQUI';
```

**Linhas 6-8** - Adicione emails dos administradores:
```javascript
const ADMIN_EMAILS = [
  'admin@suaempresa.com',
  'outro.admin@suaempresa.com'
];
```

---

## 📋 Passo a Passo no Google Apps Script

### Passo 1: Criar Projeto

1. Acesse [script.google.com](https://script.google.com)
2. Clique em **"Novo projeto"**
3. Nomeie como **"Plataforma E-Learning"**

### Passo 2: Adicionar Arquivos

**A. Arquivo code.gs** (já existe):
1. Delete o conteúdo padrão
2. Copie TODO o conteúdo de `code.gs` desta pasta
3. Cole no editor
4. Configure SPREADSHEET_ID e ADMIN_EMAILS
5. Salve (Ctrl+S)

**B. Arquivo index.html**:
1. Clique no **+** ao lado de "Arquivos"
2. Escolha **"HTML"**
3. Nomeie como **"index"** (sem .html)
4. Copie TODO o conteúdo de `index.html` desta pasta
5. Cole no editor
6. Salve (Ctrl+S)

**C. Arquivo backoffice.html**:
1. Clique no **+** ao lado de "Arquivos"
2. Escolha **"HTML"**
3. Nomeie como **"backoffice"** (sem .html)
4. Copie TODO o conteúdo de `backoffice.html` desta pasta
5. Cole no editor
6. Salve (Ctrl+S)

### Passo 3: Implantar

1. Clique em **"Implantar"** → **"Nova implantação"**
2. Tipo: **"Aplicativo da web"**
3. Descrição: **"Plataforma E-Learning v1.0"**
4. Executar como: **"Eu"**
5. Quem tem acesso: **"Qualquer pessoa na [sua organização]"**
6. Clique em **"Implantar"**
7. **Copie o URL gerado** ✨
8. Autorize as permissões solicitadas

---

## 🔧 Funções Úteis

Execute estas funções conforme necessário (selecione no dropdown e clique em "Executar"):

### `diagnosticar()`
- Verifica se a configuração está correta
- Mostra status da planilha e dados
- Execute para troubleshooting
- Veja resultado em: **Execuções** → Última execução → Logs

### `corrigirVimeoIds()`
- Corrige IDs do Vimeo salvos incorretamente
- Execute **UMA VEZ** se vídeos não carregarem
- Converte números para texto
- Veja quantos foram corrigidos nos logs

---

## 🌐 Acessar a Plataforma

### Interface do Aluno
- URL: `https://script.google.com/macros/s/SEU_ID/exec`
- Qualquer usuário da organização pode acessar
- Mostra vídeos, trilhas, ranking e progresso

### Backoffice (Apenas Admins)
- URL: `https://script.google.com/macros/s/SEU_ID/exec?page=backoffice`
- Somente usuários em ADMIN_EMAILS podem acessar
- Gerencia vídeos, trilhas e quizzes

---

## ✅ Checklist de Deploy

- [ ] Criou planilha Google Sheets
- [ ] Copiou ID da planilha
- [ ] Configurou SPREADSHEET_ID no code.gs (linha 3)
- [ ] Configurou ADMIN_EMAILS no code.gs (linhas 6-8)
- [ ] Copiou os 3 arquivos para Google Apps Script (code.gs, index.html, backoffice.html)
- [ ] Salvou todos os arquivos
- [ ] Implantou como "Aplicativo da web"
- [ ] Autorizou as permissões
- [ ] Testou o URL principal (interface do aluno)
- [ ] Testou o backoffice (?page=backoffice)
- [ ] Executou `corrigirVimeoIds()` se necessário

---

## 🎯 Recursos Implementados

✅ **Catálogo de Vídeos** - Cards com thumbnails  
✅ **Player Vimeo** - Integrado com tracking de progresso  
✅ **Sistema de Likes** - Com pontos (2pts por like)  
✅ **Quiz Pós-Vídeo** - Com timer e pontuação  
✅ **Trilhas de Aprendizagem** - Sequência de vídeos  
✅ **Sistema de Pontos** - Gamificação completa  
✅ **Ranking** - Top 10 alunos  
✅ **Progresso do Usuário** - Vídeos assistidos  
✅ **Backoffice** - Gerenciamento completo  
✅ **Design Profissional** - Estilo Udemy  

---

## 📊 Sistema de Pontos

- **10 pontos** - Assistir vídeo completo (90%+)
- **2 pontos** - Curtir vídeo
- **5-20 pontos** - Quiz (baseado na pontuação)
  - 100% = 20 pontos
  - 75-99% = 15 pontos
  - 50-74% = 10 pontos
  - 25-49% = 5 pontos
- **50 pontos** - Completar trilha inteira

---

## 🐛 Troubleshooting

### Vídeos não aparecem
1. Execute `diagnosticar()` e veja os logs
2. Verifique se SPREADSHEET_ID está correto
3. Verifique se há vídeos na aba "Videos" da planilha
4. Execute `corrigirVimeoIds()` para corrigir IDs

### Vídeos não carregam (player vazio)
1. Verifique se o VimeoID está como **texto** na planilha (não número)
2. Execute `corrigirVimeoIds()` para converter
3. Verifique se o vídeo está público no Vimeo

### Erro de permissão
1. Verifique se ADMIN_EMAILS contém seu email
2. Reimplante a aplicação
3. Limpe cache do navegador (Ctrl+Shift+Delete)

### "Unexpected token class" error
- O index.html foi atualizado para evitar esse erro
- Use a versão compatível (sem arrow functions)
- Certifique-se de copiar TODO o arquivo

---

## 📞 Suporte

Para dúvidas sobre gerenciamento de quizzes, veja: **ADMIN_GUIDE.md**

---

**Desenvolvido com ❤️ para educação corporativa**

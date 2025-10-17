// ==================== CONFIGURAÇÃO ====================
// IMPORTANTE: Substitua pelo ID da sua planilha Google Sheets
const SPREADSHEET_ID = 'SEU_ID_DA_PLANILHA_AQUI';

// Lista de emails dos administradores
const ADMIN_EMAILS = [
  'admin@suaempresa.com',
  // Adicione mais emails de admin aqui
];

// ==================== DIAGNÓSTICO ====================
function diagnosticar() {
  const resultado = {
    spreadsheetId: SPREADSHEET_ID,
    planilhaAcessivel: false,
    abas: [],
    videos: [],
    erros: []
  };
  
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    resultado.planilhaAcessivel = true;
    resultado.nomePlanilha = ss.getName();
    
    // Listar todas as abas
    const sheets = ss.getSheets();
    sheets.forEach(sheet => {
      resultado.abas.push(sheet.getName());
    });
    
    // Tentar buscar vídeos
    const videoSheet = ss.getSheetByName('Videos');
    if (videoSheet) {
      const data = videoSheet.getDataRange().getValues();
      resultado.totalLinhas = data.length;
      resultado.headers = data[0];
      
      // Pegar primeiros 3 vídeos
      for (let i = 1; i < Math.min(data.length, 4); i++) {
        resultado.videos.push(data[i]);
      }
    } else {
      resultado.erros.push('Aba Videos não encontrada');
    }
    
  } catch (error) {
    resultado.erros.push(error.toString());
  }
  
  Logger.log(JSON.stringify(resultado, null, 2));
  return resultado;
}

// ==================== CORREÇÃO ====================
// Execute esta função UMA VEZ para corrigir VimeoIDs salvos como números
function corrigirVimeoIds() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('Videos');
  const data = sheet.getDataRange().getValues();
  
  let corrigidos = 0;
  
  for (let i = 1; i < data.length; i++) {
    const vimeoId = data[i][2];
    
    // Se for número, converter para texto
    if (typeof vimeoId === 'number' || !String(vimeoId).startsWith("'")) {
      const vimeoIdStr = String(vimeoId);
      sheet.getRange(i + 1, 3).setValue("'" + vimeoIdStr);
      Logger.log('Corrigido linha ' + (i + 1) + ': ' + vimeoId + ' -> ' + vimeoIdStr);
      corrigidos++;
    }
  }
  
  Logger.log('Total de VimeoIDs corrigidos: ' + corrigidos);
  return { corrigidos: corrigidos, mensagem: 'Correção concluída!' };
}

// ==================== GITHUB CONFIGURATION ====================

function getGitHubToken() {
  const props = PropertiesService.getScriptProperties();
  return props.getProperty('GITHUB_TOKEN');
}

function getGitHubConfig() {
  return {
    owner: 'brunopavaobot',
    repo: 'gas-image-uploader-test',
    branch: 'main'
  };
}

// ==================== UPLOAD DE IMAGEM PARA GITHUB ====================

function uploadImageToGitHub(base64Image, filename) {
  try {
    const token = getGitHubToken();
    if (!token) {
      throw new Error('Token do GitHub não configurada. Configure via Properties Service.');
    }
    
    const config = getGitHubConfig();
    const path = 'images/' + filename;
    
    // Remover prefixo data:image/...;base64, se existir
    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
    
    const url = 'https://api.github.com/repos/' + config.owner + '/' + config.repo + '/contents/' + path;
    
    const payload = {
      message: 'Upload: ' + filename,
      content: base64Data,
      branch: config.branch
    };
    
    const options = {
      method: 'put',
      headers: {
        'Authorization': 'token ' + token,
        'Accept': 'application/vnd.github.v3+json'
      },
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    
    if (responseCode === 201) {
      // Sucesso
      const publicUrl = 'https://raw.githubusercontent.com/' + config.owner + '/' + config.repo + '/' + config.branch + '/' + path;
      Logger.log('Imagem enviada com sucesso: ' + publicUrl);
      return publicUrl;
    } else {
      const errorMsg = 'Erro ao fazer upload: ' + response.getContentText();
      Logger.log(errorMsg);
      throw new Error(errorMsg);
    }
    
  } catch (error) {
    Logger.log('Erro no upload para GitHub: ' + error.toString());
    throw error;
  }
}

// ==================== BUSCAR THUMBNAIL DO VIMEO ====================

function fetchVimeoThumbnail(vimeoId) {
  try {
    const cleanId = extractVimeoId(vimeoId);
    const url = 'https://vimeo.com/api/v2/video/' + cleanId + '.json';
    
    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    const responseCode = response.getResponseCode();
    
    if (responseCode === 200) {
      const data = JSON.parse(response.getContentText());
      if (data && data[0] && data[0].thumbnail_large) {
        return data[0].thumbnail_large;
      } else {
        throw new Error('Thumbnail não encontrada na resposta do Vimeo');
      }
    } else {
      throw new Error('Vídeo não encontrado no Vimeo (código: ' + responseCode + ')');
    }
    
  } catch (error) {
    Logger.log('Erro ao buscar thumbnail do Vimeo: ' + error.toString());
    throw error;
  }
}

// ==================== FUNÇÕES PRINCIPAIS ====================

function doGet(e) {
  const user = Session.getActiveUser().getEmail();
  if (!user) {
    return HtmlService.createHtmlOutput('<h1>Erro: Você precisa estar logado</h1>');
  }
  
  initializeSheets();
  
  // Verificar se é acesso ao backoffice
  const page = e.parameter.page;
  
  if (page === 'backoffice') {
    // Verificar se usuário é admin
    if (!isAdmin(user)) {
      return HtmlService.createHtmlOutput('<h1>Acesso Negado</h1><p>Apenas administradores podem acessar o backoffice.</p>');
    }
    
    const template = HtmlService.createTemplateFromFile('backoffice');
    template.userEmail = user;
    template.userName = getUserName(user);
    
    return template.evaluate()
      .setTitle('Backoffice - Administração')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  
  // Página padrão para alunos
  const template = HtmlService.createTemplateFromFile('index');
  template.userEmail = user;
  template.userName = getUserName(user);
  template.isAdmin = isAdmin(user);
  
  return template.evaluate()
    .setTitle('Plataforma de Cursos')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ==================== INICIALIZAÇÃO ====================

function initializeSheets() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  const sheets = {
    'Users': ['Email', 'Nome', 'Pontos', 'Role', 'DataCriacao'],
    'Videos': ['ID', 'Titulo', 'VimeoID', 'Thumbnail', 'Descricao', 'Duracao', 'Visualizacoes', 'Likes', 'DataCriacao'],
    'Trails': ['ID', 'Nome', 'Descricao', 'TotalVideos', 'DataCriacao'],
    'TrailVideos': ['TrailID', 'VideoID', 'Ordem'],
    'VideoViews': ['Email', 'VideoID', 'Progresso', 'Completado', 'DataVisualizacao'],
    'Quizzes': ['ID', 'VideoID', 'Pergunta', 'Opcoes', 'RespostaCorreta', 'Tempo'],
    'QuizResults': ['Email', 'QuizID', 'VideoID', 'Respostas', 'Pontuacao', 'DataResposta'],
    'Likes': ['Email', 'VideoID', 'Data'],
    'Config': ['Chave', 'Valor']
  };
  
  for (const [sheetName, headers] of Object.entries(sheets)) {
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow(headers);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#4a90e2');
    }
  }
}

// ==================== AUTENTICAÇÃO ====================

function isAdmin(email) {
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

function getCurrentUser() {
  const email = Session.getActiveUser().getEmail();
  return {
    email: email,
    name: getUserName(email),
    isAdmin: isAdmin(email),
    points: getUserPoints(email)
  };
}

function getUserName(email) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('Users');
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === email) {
      return data[i][1] || email.split('@')[0];
    }
  }
  
  // Criar novo usuário
  const name = email.split('@')[0];
  const role = isAdmin(email) ? 'admin' : 'student';
  sheet.appendRow([email, name, 0, role, new Date()]);
  return name;
}

function getUserPoints(email) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('Users');
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === email) {
      return data[i][2] || 0;
    }
  }
  return 0;
}

function updateUserPoints(email, points) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('Users');
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === email) {
      const currentPoints = data[i][2] || 0;
      sheet.getRange(i + 1, 3).setValue(currentPoints + points);
      return currentPoints + points;
    }
  }
}

// ==================== VÍDEOS ====================

// Função auxiliar para extrair ID do Vimeo de URL completa
function extractVimeoId(input) {
  if (!input) return '';
  
  // Se já for um número (ID direto), retorna
  if (/^\d+$/.test(input.trim())) {
    return input.trim();
  }
  
  // Extrair ID de URLs do Vimeo
  // Formatos suportados:
  // https://vimeo.com/123456789
  // https://vimeo.com/showcase/123456789/video/987654321
  // https://player.vimeo.com/video/123456789
  const patterns = [
    /vimeo\.com\/(\d+)/,
    /vimeo\.com\/video\/(\d+)/,
    /player\.vimeo\.com\/video\/(\d+)/,
    /vimeo\.com\/showcase\/\d+\/video\/(\d+)/
  ];
  
  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  // Se não encontrar, retorna o input original
  return input.trim();
}

function getVideos() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName('Videos');
    
    if (!sheet) {
      Logger.log('Aba Videos não encontrada');
      return [];
    }
    
    const data = sheet.getDataRange().getValues();
    
    if (!data || data.length <= 1) {
      Logger.log('Nenhum vídeo encontrado na planilha');
      return [];
    }
    
    const videos = [];
    for (let i = 1; i < data.length; i++) {
      // Pular linhas vazias
      if (!data[i][0]) continue;
      
      // Limpar VimeoID (remover apóstrofo se existir e converter para string)
      let vimeoId = String(data[i][2] || '').replace(/^'/, '');
      
      videos.push({
        id: data[i][0],
        title: data[i][1] || 'Sem título',
        vimeoId: vimeoId,
        thumbnail: data[i][3] || '',
        description: data[i][4] || '',
        duration: data[i][5] || 0,
        views: data[i][6] || 0,
        likes: data[i][7] || 0,
        createdAt: data[i][8]
      });
    }
    
    Logger.log('Total de vídeos retornados: ' + videos.length);
    return videos;
  } catch (error) {
    Logger.log('Erro ao buscar vídeos: ' + error.toString());
    return [];
  }
}

function getVideo(videoId) {
  const videos = getVideos();
  return videos.find(v => v.id === videoId);
}

function addVideo(videoData) {
  const user = Session.getActiveUser().getEmail();
  if (!isAdmin(user)) {
    throw new Error('Apenas administradores podem adicionar vídeos');
  }
  
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('Videos');
  
  // Extrair ID do Vimeo da URL ou usar ID direto
  const vimeoId = extractVimeoId(videoData.vimeoId);
  
  const id = 'VID_' + new Date().getTime();
  const row = sheet.getLastRow() + 1;
  
  // Inserir dados
  sheet.getRange(row, 1).setValue(id);
  sheet.getRange(row, 2).setValue(videoData.title);
  sheet.getRange(row, 3).setValue("'" + vimeoId); // Força como texto com apóstrofo
  sheet.getRange(row, 4).setValue(videoData.thumbnail || '');
  sheet.getRange(row, 5).setValue(videoData.description);
  sheet.getRange(row, 6).setValue(videoData.duration || 0);
  sheet.getRange(row, 7).setValue(0); // views
  sheet.getRange(row, 8).setValue(0); // likes
  sheet.getRange(row, 9).setValue(new Date());
  
  return { success: true, id: id, vimeoId: vimeoId };
}

function updateVideo(videoId, videoData) {
  const user = Session.getActiveUser().getEmail();
  if (!isAdmin(user)) {
    throw new Error('Apenas administradores podem editar vídeos');
  }
  
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('Videos');
  const data = sheet.getDataRange().getValues();
  
  // Extrair ID do Vimeo da URL ou usar ID direto
  const vimeoId = extractVimeoId(videoData.vimeoId);
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === videoId) {
      sheet.getRange(i + 1, 2).setValue(videoData.title);
      sheet.getRange(i + 1, 3).setValue("'" + vimeoId); // Força como texto
      sheet.getRange(i + 1, 4).setValue(videoData.thumbnail || '');
      sheet.getRange(i + 1, 5).setValue(videoData.description);
      return { success: true, vimeoId: vimeoId };
    }
  }
  
  throw new Error('Vídeo não encontrado');
}

function deleteVideo(videoId) {
  const user = Session.getActiveUser().getEmail();
  if (!isAdmin(user)) {
    throw new Error('Apenas administradores podem deletar vídeos');
  }
  
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('Videos');
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === videoId) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  
  throw new Error('Vídeo não encontrado');
}

// ==================== TRILHAS ====================

function getTrails() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName('Trails');
    
    if (!sheet) {
      Logger.log('Aba Trails não encontrada');
      return [];
    }
    
    const data = sheet.getDataRange().getValues();
    
    if (!data || data.length <= 1) {
      Logger.log('Nenhuma trilha encontrada na planilha');
      return [];
    }
    
    const trails = [];
    for (let i = 1; i < data.length; i++) {
      // Pular linhas vazias
      if (!data[i][0]) continue;
      
      const trailId = data[i][0];
      trails.push({
        id: trailId,
        name: data[i][1] || 'Sem título',
        description: data[i][2] || '',
        totalVideos: data[i][3] || 0,
        createdAt: data[i][4],
        videos: getTrailVideos(trailId)
      });
    }
    
    Logger.log('Total de trilhas retornadas: ' + trails.length);
    return trails;
  } catch (error) {
    Logger.log('Erro ao buscar trilhas: ' + error.toString());
    return [];
  }
}

function getTrailVideos(trailId) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName('TrailVideos');
    
    if (!sheet) {
      Logger.log('Aba TrailVideos não encontrada');
      return [];
    }
    
    const data = sheet.getDataRange().getValues();
    
    if (!data || data.length <= 1) {
      return [];
    }
    
    const videoIds = [];
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === trailId) {
        videoIds.push({ videoId: data[i][1], order: data[i][2] });
      }
    }
    
    // Ordenar por ordem e buscar dados dos vídeos
    videoIds.sort((a, b) => a.order - b.order);
    const videos = getVideos();
    
    return videoIds.map(item => {
      const video = videos.find(v => v.id === item.videoId);
      return video || null;
    }).filter(v => v !== null);
  } catch (error) {
    Logger.log('Erro ao buscar vídeos da trilha: ' + error.toString());
    return [];
  }
}

function addTrail(trailData) {
  const user = Session.getActiveUser().getEmail();
  if (!isAdmin(user)) {
    throw new Error('Apenas administradores podem criar trilhas');
  }
  
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('Trails');
  
  const id = 'TRAIL_' + new Date().getTime();
  sheet.appendRow([
    id,
    trailData.name,
    trailData.description,
    trailData.videos ? trailData.videos.length : 0,
    new Date()
  ]);
  
  // Adicionar vídeos à trilha
  if (trailData.videos && trailData.videos.length > 0) {
    const trailVideosSheet = ss.getSheetByName('TrailVideos');
    trailData.videos.forEach((videoId, index) => {
      trailVideosSheet.appendRow([id, videoId, index]);
    });
  }
  
  return { success: true, id: id };
}

function updateTrail(trailId, trailData) {
  const user = Session.getActiveUser().getEmail();
  if (!isAdmin(user)) {
    throw new Error('Apenas administradores podem editar trilhas');
  }
  
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('Trails');
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === trailId) {
      sheet.getRange(i + 1, 2).setValue(trailData.name);
      sheet.getRange(i + 1, 3).setValue(trailData.description);
      sheet.getRange(i + 1, 4).setValue(trailData.videos ? trailData.videos.length : 0);
      
      // Atualizar vídeos da trilha
      const trailVideosSheet = ss.getSheetByName('TrailVideos');
      const tvData = trailVideosSheet.getDataRange().getValues();
      
      // Remover vídeos antigos
      for (let j = tvData.length - 1; j >= 1; j--) {
        if (tvData[j][0] === trailId) {
          trailVideosSheet.deleteRow(j + 1);
        }
      }
      
      // Adicionar novos vídeos
      if (trailData.videos && trailData.videos.length > 0) {
        trailData.videos.forEach((videoId, index) => {
          trailVideosSheet.appendRow([trailId, videoId, index]);
        });
      }
      
      return { success: true };
    }
  }
  
  throw new Error('Trilha não encontrada');
}

function deleteTrail(trailId) {
  const user = Session.getActiveUser().getEmail();
  if (!isAdmin(user)) {
    throw new Error('Apenas administradores podem deletar trilhas');
  }
  
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('Trails');
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === trailId) {
      sheet.deleteRow(i + 1);
      
      // Remover vídeos da trilha
      const trailVideosSheet = ss.getSheetByName('TrailVideos');
      const tvData = trailVideosSheet.getDataRange().getValues();
      
      for (let j = tvData.length - 1; j >= 1; j--) {
        if (tvData[j][0] === trailId) {
          trailVideosSheet.deleteRow(j + 1);
        }
      }
      
      return { success: true };
    }
  }
  
  throw new Error('Trilha não encontrada');
}

// ==================== VISUALIZAÇÕES ====================

function recordVideoView(videoId, progress, completed) {
  const email = Session.getActiveUser().getEmail();
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('VideoViews');
  const data = sheet.getDataRange().getValues();
  
  let found = false;
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === email && data[i][1] === videoId) {
      sheet.getRange(i + 1, 3).setValue(progress);
      sheet.getRange(i + 1, 4).setValue(completed);
      sheet.getRange(i + 1, 5).setValue(new Date());
      found = true;
      break;
    }
  }
  
  if (!found) {
    sheet.appendRow([email, videoId, progress, completed, new Date()]);
  }
  
  // Incrementar contador de visualizações do vídeo
  if (completed && !found) {
    const videoSheet = ss.getSheetByName('Videos');
    const videoData = videoSheet.getDataRange().getValues();
    
    for (let i = 1; i < videoData.length; i++) {
      if (videoData[i][0] === videoId) {
        const views = (videoData[i][6] || 0) + 1;
        videoSheet.getRange(i + 1, 7).setValue(views);
        
        // Dar pontos por assistir vídeo completo
        if (!found) {
          updateUserPoints(email, 10);
        }
        break;
      }
    }
  }
  
  return { success: true };
}

function getUserVideoProgress(videoId) {
  const email = Session.getActiveUser().getEmail();
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('VideoViews');
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === email && data[i][1] === videoId) {
      return {
        progress: data[i][2] || 0,
        completed: data[i][3] || false
      };
    }
  }
  
  return { progress: 0, completed: false };
}

function getUserWatchedVideos() {
  const email = Session.getActiveUser().getEmail();
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('VideoViews');
  const data = sheet.getDataRange().getValues();
  
  const watchedVideos = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === email) {
      watchedVideos.push({
        videoId: data[i][1],
        progress: data[i][2],
        completed: data[i][3],
        date: data[i][4]
      });
    }
  }
  
  return watchedVideos;
}

// ==================== QUIZ ====================

function getQuizzesByVideo(videoId) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('Quizzes');
  const data = sheet.getDataRange().getValues();
  
  const quizzes = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === videoId) {
      quizzes.push({
        id: data[i][0],
        videoId: data[i][1],
        question: data[i][2],
        options: JSON.parse(data[i][3]),
        correctAnswer: data[i][4],
        time: data[i][5] || 30
      });
    }
  }
  return quizzes;
}

function addQuiz(quizData) {
  const user = Session.getActiveUser().getEmail();
  if (!isAdmin(user)) {
    throw new Error('Apenas administradores podem adicionar quiz');
  }
  
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('Quizzes');
  
  const id = 'QUIZ_' + new Date().getTime();
  sheet.appendRow([
    id,
    quizData.videoId,
    quizData.question,
    JSON.stringify(quizData.options),
    quizData.correctAnswer,
    quizData.time || 30
  ]);
  
  return { success: true, id: id };
}

function submitQuiz(quizId, videoId, answers) {
  const email = Session.getActiveUser().getEmail();
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  // Buscar quiz
  const quizSheet = ss.getSheetByName('Quizzes');
  const quizData = quizSheet.getDataRange().getValues();
  
  let correctAnswers = 0;
  let totalQuestions = 0;
  
  for (let i = 1; i < quizData.length; i++) {
    if (quizData[i][1] === videoId) {
      totalQuestions++;
      const quizId = quizData[i][0];
      const correctAnswer = quizData[i][4];
      
      if (answers[quizId] === correctAnswer) {
        correctAnswers++;
      }
    }
  }
  
  const score = totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0;
  
  // Salvar resultado
  const resultSheet = ss.getSheetByName('QuizResults');
  resultSheet.appendRow([
    email,
    quizId,
    videoId,
    JSON.stringify(answers),
    score,
    new Date()
  ]);
  
  // Dar pontos baseado no score
  let points = 0;
  if (score === 100) points = 20;
  else if (score >= 75) points = 15;
  else if (score >= 50) points = 10;
  else if (score >= 25) points = 5;
  
  if (points > 0) {
    updateUserPoints(email, points);
  }
  
  return { success: true, score: score, points: points };
}

// ==================== LIKES ====================

function toggleLike(videoId) {
  const email = Session.getActiveUser().getEmail();
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('Likes');
  const data = sheet.getDataRange().getValues();
  
  let liked = false;
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === email && data[i][1] === videoId) {
      sheet.deleteRow(i + 1);
      updateVideoLikeCount(videoId, -1);
      updateUserPoints(email, -2);
      return { success: true, liked: false };
    }
  }
  
  sheet.appendRow([email, videoId, new Date()]);
  updateVideoLikeCount(videoId, 1);
  updateUserPoints(email, 2);
  return { success: true, liked: true };
}

function updateVideoLikeCount(videoId, increment) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('Videos');
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === videoId) {
      const likes = (data[i][7] || 0) + increment;
      sheet.getRange(i + 1, 8).setValue(Math.max(0, likes));
      break;
    }
  }
}

function getUserLikes() {
  const email = Session.getActiveUser().getEmail();
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('Likes');
  const data = sheet.getDataRange().getValues();
  
  const likes = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === email) {
      likes.push(data[i][1]);
    }
  }
  return likes;
}

function isVideoLiked(videoId) {
  const email = Session.getActiveUser().getEmail();
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('Likes');
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === email && data[i][1] === videoId) {
      return true;
    }
  }
  return false;
}

// ==================== RANKING ====================

function getTopStudents(limit = 10) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('Users');
  const data = sheet.getDataRange().getValues();
  
  const students = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][3] !== 'admin') {
      students.push({
        email: data[i][0],
        name: data[i][1],
        points: data[i][2] || 0
      });
    }
  }
  
  students.sort((a, b) => b.points - a.points);
  return students.slice(0, limit);
}

// ==================== PROGRESSO DA TRILHA ====================

function getTrailProgress(trailId) {
  const email = Session.getActiveUser().getEmail();
  const trail = getTrails().find(t => t.id === trailId);
  
  if (!trail) return { progress: 0, completed: 0, total: 0 };
  
  const trailVideos = trail.videos;
  let completed = 0;
  
  const watchedVideos = getUserWatchedVideos();
  
  trailVideos.forEach(video => {
    const watched = watchedVideos.find(w => w.videoId === video.id && w.completed);
    if (watched) completed++;
  });
  
  const progress = trailVideos.length > 0 ? (completed / trailVideos.length) * 100 : 0;
  
  // Se completou a trilha, dar pontos extras
  if (progress === 100 && completed > 0) {
    // Verificar se já deu pontos antes
    const pointsGiven = checkTrailCompletionPoints(trailId);
    if (!pointsGiven) {
      updateUserPoints(email, 50);
      saveTrailCompletionPoints(trailId);
    }
  }
  
  return {
    progress: progress,
    completed: completed,
    total: trailVideos.length
  };
}

function checkTrailCompletionPoints(trailId) {
  const email = Session.getActiveUser().getEmail();
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName('TrailCompletion');
  
  if (!sheet) {
    sheet = ss.insertSheet('TrailCompletion');
    sheet.appendRow(['Email', 'TrailID', 'Data']);
  }
  
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === email && data[i][1] === trailId) {
      return true;
    }
  }
  return false;
}

function saveTrailCompletionPoints(trailId) {
  const email = Session.getActiveUser().getEmail();
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName('TrailCompletion');
  
  if (!sheet) {
    sheet = ss.insertSheet('TrailCompletion');
    sheet.appendRow(['Email', 'TrailID', 'Data']);
  }
  
  sheet.appendRow([email, trailId, new Date()]);
}

// ==================== MÉTRICAS ====================

function getAdminMetrics() {
  const user = Session.getActiveUser().getEmail();
  if (!isAdmin(user)) {
    throw new Error('Apenas administradores podem ver métricas');
  }
  
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  // Total de usuários
  const usersSheet = ss.getSheetByName('Users');
  const totalUsers = usersSheet.getDataRange().getValues().length - 1;
  
  // Total de vídeos
  const videosSheet = ss.getSheetByName('Videos');
  const totalVideos = videosSheet.getDataRange().getValues().length - 1;
  
  // Total de trilhas
  const trailsSheet = ss.getSheetByName('Trails');
  const totalTrails = trailsSheet.getDataRange().getValues().length - 1;
  
  // Total de visualizações
  const viewsSheet = ss.getSheetByName('VideoViews');
  const totalViews = viewsSheet.getDataRange().getValues().length - 1;
  
  // Total de quiz completados
  const quizSheet = ss.getSheetByName('QuizResults');
  const totalQuizzes = quizSheet.getDataRange().getValues().length - 1;
  
  return {
    totalUsers: totalUsers,
    totalVideos: totalVideos,
    totalTrails: totalTrails,
    totalViews: totalViews,
    totalQuizzes: totalQuizzes
  };
}

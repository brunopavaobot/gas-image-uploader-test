// ==================== CONFIGURAÇÃO ====================
// IMPORTANTE: Substitua pelo ID da sua planilha Google Sheets
var SPREADSHEET_ID = '1NVBid2fXLNuIJNV08zUEnTo7YwZJSZoOw4t07VNbAbg';

// Lista de emails dos administradores
var ADMIN_EMAILS = [
  'bruno.pavao@grupoboticario.com.br',
  // Adicione mais emails de admin aqui
];

// ==================== DIAGNÓSTICO ====================
function diagnosticar() {
  var resultado = {
    spreadsheetId: SPREADSHEET_ID,
    planilhaAcessivel: false,
    abas: [],
    videos: [],
    erros: []
  };
  
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    resultado.planilhaAcessivel = true;
    resultado.nomePlanilha = ss.getName();
    
    // Listar todas as abas
    var sheets = ss.getSheets();
    for (var j = 0; j < sheets.length; j++) {
      resultado.abas.push(sheets[j].getName());
    }
    
    // Tentar buscar vídeos
    var videoSheet = ss.getSheetByName('Videos');
    if (videoSheet) {
      var data = videoSheet.getDataRange().getValues();
      resultado.totalLinhas = data.length;
      resultado.headers = data[0];
      
      // Pegar primeiros 3 vídeos
      for (var i = 1; i < Math.min(data.length, 4); i++) {
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
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('Videos');
  var data = sheet.getDataRange().getValues();
  
  var corrigidos = 0;
  
  for (var i = 1; i < data.length; i++) {
    var vimeoId = data[i][2];
    
    // Se for número, converter para texto
    if (typeof vimeoId === 'number' || !String(vimeoId).startsWith("'")) {
      var vimeoIdStr = String(vimeoId);
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
  var props = PropertiesService.getScriptProperties();
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
    var token = getGitHubToken();
    if (!token) {
      throw new Error('Token do GitHub não configurada. Configure via Properties Service.');
    }
    
    var config = getGitHubConfig();
    var path = 'images/' + filename;
    
    // Remover prefixo data:image/...;base64, se existir
    var base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
    
    var url = 'https://api.github.com/repos/' + config.owner + '/' + config.repo + '/contents/' + path;
    
    var payload = {
      message: 'Upload: ' + filename,
      content: base64Data,
      branch: config.branch
    };
    
    var options = {
      method: 'put',
      headers: {
        'Authorization': 'token ' + token,
        'Accept': 'application/vnd.github.v3+json'
      },
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    
    var response = UrlFetchApp.fetch(url, options);
    var responseCode = response.getResponseCode();
    
    if (responseCode === 201) {
      // Sucesso
      var publicUrl = 'https://raw.githubusercontent.com/' + config.owner + '/' + config.repo + '/' + config.branch + '/' + path;
      Logger.log('Imagem enviada com sucesso: ' + publicUrl);
      return publicUrl;
    } else {
      var errorMsg = 'Erro ao fazer upload: ' + response.getContentText();
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
    var cleanId = extractVimeoId(vimeoId);
    var url = 'https://vimeo.com/api/v2/video/' + cleanId + '.json';
    
    var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    var responseCode = response.getResponseCode();
    
    if (responseCode === 200) {
      var data = JSON.parse(response.getContentText());
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
  var user = Session.getActiveUser().getEmail();
  if (!user) {
    return HtmlService.createHtmlOutput('<h1>Erro: Você precisa estar logado</h1>');
  }
  
  initializeSheets();
  
  // Verificar se é acesso ao backoffice
  var page = e.parameter.page;
  
  if (page === 'backoffice') {
    // Verificar se usuário é admin
    if (!isAdmin(user)) {
      return HtmlService.createHtmlOutput('<h1>Acesso Negado</h1><p>Apenas administradores podem acessar o backoffice.</p>');
    }
    
    var template = HtmlService.createTemplateFromFile('backoffice');
    template.userEmail = user;
    template.userName = getUserName(user);
    
    return template.evaluate()
      .setTitle('Backoffice - Administração')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  
  // Página padrão para alunos
  var template = HtmlService.createTemplateFromFile('index');
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
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  var sheets = {
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
  
  for (var [sheetName, headers] of Object.entries(sheets)) {
    var sheet = ss.getSheetByName(sheetName);
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
  var email = Session.getActiveUser().getEmail();
  return {
    email: email,
    name: getUserName(email),
    isAdmin: isAdmin(email),
    points: getUserPoints(email)
  };
}

function getUserName(email) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('Users');
  var data = sheet.getDataRange().getValues();
  
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === email) {
      return data[i][1] || email.split('@')[0];
    }
  }
  
  // Criar novo usuário
  var name = email.split('@')[0];
  var role = isAdmin(email) ? 'admin' : 'student';
  sheet.appendRow([email, name, 0, role, new Date()]);
  return name;
}

function getUserPoints(email) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('Users');
  var data = sheet.getDataRange().getValues();
  
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === email) {
      return data[i][2] || 0;
    }
  }
  return 0;
}

function updateUserPoints(email, points) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('Users');
  var data = sheet.getDataRange().getValues();
  
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === email) {
      var currentPoints = data[i][2] || 0;
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
  var patterns = [
    /vimeo\.com\/(\d+)/,
    /vimeo\.com\/video\/(\d+)/,
    /player\.vimeo\.com\/video\/(\d+)/,
    /vimeo\.com\/showcase\/\d+\/video\/(\d+)/
  ];
  
  for (var i = 0; i < patterns.length; i++) {
    var match = input.match(patterns[i]);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  // Se não encontrar, retorna o input original
  return input.trim();
}

function getVideos() {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName('Videos');
    
    if (!sheet) {
      Logger.log('Aba Videos não encontrada');
      return [];
    }
    
    var data = sheet.getDataRange().getValues();
    
    if (!data || data.length <= 1) {
      Logger.log('Nenhum vídeo encontrado na planilha');
      return [];
    }
    
    var videos = [];
    for (var i = 1; i < data.length; i++) {
      // Pular linhas vazias
      if (!data[i][0]) continue;
      
      // Limpar VimeoID (remover apóstrofo se existir e converter para string)
      var vimeoId = String(data[i][2] || '').replace(/^'/, '');
      
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
  var videos = getVideos();
  for (var i = 0; i < videos.length; i++) {
    if (videos[i].id === videoId) {
      return videos[i];
    }
  }
  return null;
}

function addVideo(videoData) {
  var user = Session.getActiveUser().getEmail();
  if (!isAdmin(user)) {
    throw new Error('Apenas administradores podem adicionar vídeos');
  }
  
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('Videos');
  
  // Extrair ID do Vimeo da URL ou usar ID direto
  var vimeoId = extractVimeoId(videoData.vimeoId);
  
  var id = 'VID_' + new Date().getTime();
  var row = sheet.getLastRow() + 1;
  
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
  var user = Session.getActiveUser().getEmail();
  if (!isAdmin(user)) {
    throw new Error('Apenas administradores podem editar vídeos');
  }
  
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('Videos');
  var data = sheet.getDataRange().getValues();
  
  // Extrair ID do Vimeo da URL ou usar ID direto
  var vimeoId = extractVimeoId(videoData.vimeoId);
  
  for (var i = 1; i < data.length; i++) {
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
  var user = Session.getActiveUser().getEmail();
  if (!isAdmin(user)) {
    throw new Error('Apenas administradores podem deletar vídeos');
  }
  
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('Videos');
  var data = sheet.getDataRange().getValues();
  
  for (var i = 1; i < data.length; i++) {
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
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName('Trails');
    
    if (!sheet) {
      Logger.log('Aba Trails não encontrada');
      return [];
    }
    
    var data = sheet.getDataRange().getValues();
    
    if (!data || data.length <= 1) {
      Logger.log('Nenhuma trilha encontrada na planilha');
      return [];
    }
    
    var trails = [];
    for (var i = 1; i < data.length; i++) {
      // Pular linhas vazias
      if (!data[i][0]) continue;
      
      var trailId = data[i][0];
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
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName('TrailVideos');
    
    if (!sheet) {
      Logger.log('Aba TrailVideos não encontrada');
      return [];
    }
    
    var data = sheet.getDataRange().getValues();
    
    if (!data || data.length <= 1) {
      return [];
    }
    
    var videoIds = [];
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === trailId) {
        videoIds.push({ videoId: data[i][1], order: data[i][2] });
      }
    }
    
    // Ordenar por ordem e buscar dados dos vídeos
    videoIds.sort(function(a, b) { return a.order - b.order; });
    var videos = getVideos();
    
    var trailVideos = [];
    for (var j = 0; j < videoIds.length; j++) {
      for (var k = 0; k < videos.length; k++) {
        if (videos[k].id === videoIds[j].videoId) {
          trailVideos.push(videos[k]);
          break;
        }
      }
    }
    return trailVideos;
  } catch (error) {
    Logger.log('Erro ao buscar vídeos da trilha: ' + error.toString());
    return [];
  }
}

function addTrail(trailData) {
  var user = Session.getActiveUser().getEmail();
  if (!isAdmin(user)) {
    throw new Error('Apenas administradores podem criar trilhas');
  }
  
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('Trails');
  
  var id = 'TRAIL_' + new Date().getTime();
  sheet.appendRow([
    id,
    trailData.name,
    trailData.description,
    trailData.videos ? trailData.videos.length : 0,
    new Date()
  ]);
  
  // Adicionar vídeos à trilha
  if (trailData.videos && trailData.videos.length > 0) {
    var trailVideosSheet = ss.getSheetByName('TrailVideos');
    for (var i = 0; i < trailData.videos.length; i++) {
      trailVideosSheet.appendRow([id, trailData.videos[i], i]);
    }
  }
  
  return { success: true, id: id };
}

function updateTrail(trailId, trailData) {
  var user = Session.getActiveUser().getEmail();
  if (!isAdmin(user)) {
    throw new Error('Apenas administradores podem editar trilhas');
  }
  
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('Trails');
  var data = sheet.getDataRange().getValues();
  
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === trailId) {
      sheet.getRange(i + 1, 2).setValue(trailData.name);
      sheet.getRange(i + 1, 3).setValue(trailData.description);
      sheet.getRange(i + 1, 4).setValue(trailData.videos ? trailData.videos.length : 0);
      
      // Atualizar vídeos da trilha
      var trailVideosSheet = ss.getSheetByName('TrailVideos');
      var tvData = trailVideosSheet.getDataRange().getValues();
      
      // Remover vídeos antigos
      for (var j = tvData.length - 1; j >= 1; j--) {
        if (tvData[j][0] === trailId) {
          trailVideosSheet.deleteRow(j + 1);
        }
      }
      
      // Adicionar novos vídeos
      if (trailData.videos && trailData.videos.length > 0) {
        for (var j = 0; j < trailData.videos.length; j++) {
          trailVideosSheet.appendRow([trailId, trailData.videos[j], j]);
        }
      }
      
      return { success: true };
    }
  }
  
  throw new Error('Trilha não encontrada');
}

function deleteTrail(trailId) {
  var user = Session.getActiveUser().getEmail();
  if (!isAdmin(user)) {
    throw new Error('Apenas administradores podem deletar trilhas');
  }
  
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('Trails');
  var data = sheet.getDataRange().getValues();
  
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === trailId) {
      sheet.deleteRow(i + 1);
      
      // Remover vídeos da trilha
      var trailVideosSheet = ss.getSheetByName('TrailVideos');
      var tvData = trailVideosSheet.getDataRange().getValues();
      
      for (var j = tvData.length - 1; j >= 1; j--) {
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
  var email = Session.getActiveUser().getEmail();
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('VideoViews');
  var data = sheet.getDataRange().getValues();
  
  var found = false;
  for (var i = 1; i < data.length; i++) {
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
    var videoSheet = ss.getSheetByName('Videos');
    var videoData = videoSheet.getDataRange().getValues();
    
    for (var i = 1; i < videoData.length; i++) {
      if (videoData[i][0] === videoId) {
        var views = (videoData[i][6] || 0) + 1;
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
  var email = Session.getActiveUser().getEmail();
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('VideoViews');
  var data = sheet.getDataRange().getValues();
  
  for (var i = 1; i < data.length; i++) {
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
  var email = Session.getActiveUser().getEmail();
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('VideoViews');
  var data = sheet.getDataRange().getValues();
  
  var watchedVideos = [];
  for (var i = 1; i < data.length; i++) {
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
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('Quizzes');
  var data = sheet.getDataRange().getValues();
  
  var quizzes = [];
  for (var i = 1; i < data.length; i++) {
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
  var user = Session.getActiveUser().getEmail();
  if (!isAdmin(user)) {
    throw new Error('Apenas administradores podem adicionar quiz');
  }
  
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('Quizzes');
  
  var id = 'QUIZ_' + new Date().getTime();
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
  var email = Session.getActiveUser().getEmail();
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  // Buscar quiz
  var quizSheet = ss.getSheetByName('Quizzes');
  var quizData = quizSheet.getDataRange().getValues();
  
  var correctAnswers = 0;
  var totalQuestions = 0;
  
  for (var i = 1; i < quizData.length; i++) {
    if (quizData[i][1] === videoId) {
      totalQuestions++;
      var quizId = quizData[i][0];
      var correctAnswer = quizData[i][4];
      
      if (answers[quizId] === correctAnswer) {
        correctAnswers++;
      }
    }
  }
  
  var score = totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0;
  
  // Salvar resultado
  var resultSheet = ss.getSheetByName('QuizResults');
  resultSheet.appendRow([
    email,
    quizId,
    videoId,
    JSON.stringify(answers),
    score,
    new Date()
  ]);
  
  // Dar pontos baseado no score
  var points = 0;
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
  var email = Session.getActiveUser().getEmail();
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('Likes');
  var data = sheet.getDataRange().getValues();
  
  var liked = false;
  for (var i = 1; i < data.length; i++) {
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
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('Videos');
  var data = sheet.getDataRange().getValues();
  
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === videoId) {
      var likes = (data[i][7] || 0) + increment;
      sheet.getRange(i + 1, 8).setValue(Math.max(0, likes));
      break;
    }
  }
}

function getUserLikes() {
  var email = Session.getActiveUser().getEmail();
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('Likes');
  var data = sheet.getDataRange().getValues();
  
  var likes = [];
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === email) {
      likes.push(data[i][1]);
    }
  }
  return likes;
}

function isVideoLiked(videoId) {
  var email = Session.getActiveUser().getEmail();
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('Likes');
  var data = sheet.getDataRange().getValues();
  
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === email && data[i][1] === videoId) {
      return true;
    }
  }
  return false;
}

// ==================== RANKING ====================

function getTopStudents(limit = 10) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('Users');
  var data = sheet.getDataRange().getValues();
  
  var students = [];
  for (var i = 1; i < data.length; i++) {
    if (data[i][3] !== 'admin') {
      students.push({
        email: data[i][0],
        name: data[i][1],
        points: data[i][2] || 0
      });
    }
  }
  
  students.sort(function(a, b) { return b.points - a.points; });
  return students.slice(0, limit);
}

// ==================== PROGRESSO DA TRILHA ====================

function getTrailProgress(trailId) {
  var email = Session.getActiveUser().getEmail();
  var trails = getTrails();
  var trail = null;
  for (var i = 0; i < trails.length; i++) {
    if (trails[i].id === trailId) {
      trail = trails[i];
      break;
    }
  }
  
  if (!trail) return { progress: 0, completed: 0, total: 0 };
  
  var trailVideos = trail.videos;
  var completed = 0;
  
  var watchedVideos = getUserWatchedVideos();
  
  for (var j = 0; j < trailVideos.length; j++) {
    var video = trailVideos[j];
    for (var k = 0; k < watchedVideos.length; k++) {
      if (watchedVideos[k].videoId === video.id && watchedVideos[k].completed) {
        completed++;
        break;
      }
    }
  }
  
  var progress = trailVideos.length > 0 ? (completed / trailVideos.length) * 100 : 0;
  
  // Se completou a trilha, dar pontos extras
  if (progress === 100 && completed > 0) {
    // Verificar se já deu pontos antes
    var pointsGiven = checkTrailCompletionPoints(trailId);
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
  var email = Session.getActiveUser().getEmail();
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('TrailCompletion');
  
  if (!sheet) {
    sheet = ss.insertSheet('TrailCompletion');
    sheet.appendRow(['Email', 'TrailID', 'Data']);
  }
  
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === email && data[i][1] === trailId) {
      return true;
    }
  }
  return false;
}

function saveTrailCompletionPoints(trailId) {
  var email = Session.getActiveUser().getEmail();
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('TrailCompletion');
  
  if (!sheet) {
    sheet = ss.insertSheet('TrailCompletion');
    sheet.appendRow(['Email', 'TrailID', 'Data']);
  }
  
  sheet.appendRow([email, trailId, new Date()]);
}

// ==================== MÉTRICAS ====================

function getAdminMetrics() {
  var user = Session.getActiveUser().getEmail();
  if (!isAdmin(user)) {
    throw new Error('Apenas administradores podem ver métricas');
  }
  
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  // Total de usuários
  var usersSheet = ss.getSheetByName('Users');
  var totalUsers = usersSheet.getDataRange().getValues().length - 1;
  
  // Total de vídeos
  var videosSheet = ss.getSheetByName('Videos');
  var totalVideos = videosSheet.getDataRange().getValues().length - 1;
  
  // Total de trilhas
  var trailsSheet = ss.getSheetByName('Trails');
  var totalTrails = trailsSheet.getDataRange().getValues().length - 1;
  
  // Total de visualizações
  var viewsSheet = ss.getSheetByName('VideoViews');
  var totalViews = viewsSheet.getDataRange().getValues().length - 1;
  
  // Total de quiz completados
  var quizSheet = ss.getSheetByName('QuizResults');
  var totalQuizzes = quizSheet.getDataRange().getValues().length - 1;
  
  return {
    totalUsers: totalUsers,
    totalVideos: totalVideos,
    totalTrails: totalTrails,
    totalViews: totalViews,
    totalQuizzes: totalQuizzes
  };
}

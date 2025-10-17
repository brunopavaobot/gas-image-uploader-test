// ==================== CONFIGURAÇÃO ====================
// IMPORTANTE: Substitua pelo ID da sua planilha Google Sheets
var SPREADSHEET_ID = '1NVBid2fXLNuIJNV08zUEnTo7YwZJSZoOw4t07VNbAbg';

// Lista de emails dos administradores
var ADMIN_EMAILS = [
  'bruno.pavao@grupoboticario.com.br'
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

function diagnosticarVideosDetalhado() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('Videos');
  var data = sheet.getDataRange().getValues();
  
  Logger.log('========== DIAGNÓSTICO DETALHADO DE VÍDEOS ==========');
  Logger.log('Total de linhas na planilha: ' + data.length);
  Logger.log('Headers: ' + JSON.stringify(data[0]));
  Logger.log('');
  
  for (var i = 1; i < data.length; i++) {
    Logger.log('--- LINHA ' + (i + 1) + ' ---');
    Logger.log('ID: "' + data[i][0] + '" (tipo: ' + typeof data[i][0] + ', vazio: ' + (!data[i][0]) + ')');
    Logger.log('Título: "' + data[i][1] + '"');
    Logger.log('VimeoID: "' + data[i][2] + '"');
    Logger.log('Thumbnail: "' + data[i][3] + '"');
    Logger.log('Descrição: "' + data[i][4] + '"');
    Logger.log('Duração: "' + data[i][5] + '"');
    Logger.log('Views: "' + data[i][6] + '"');
    Logger.log('Likes: "' + data[i][7] + '"');
    Logger.log('Data: "' + data[i][8] + '" (tipo: ' + typeof data[i][8] + ')');
    Logger.log('');
  }
  
  Logger.log('========== TESTANDO getVideos() ==========');
  var videos = getVideos();
  Logger.log('Total de vídeos retornados por getVideos(): ' + videos.length);
  for (var j = 0; j < videos.length; j++) {
    Logger.log('Vídeo ' + (j + 1) + ': ' + JSON.stringify(videos[j]));
  }
  
  Logger.log('========== FIM DO DIAGNÓSTICO ==========');
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
  
  var sheetsList = [
    { name: 'Users', headers: ['Email', 'Nome', 'Pontos', 'Role', 'DataCriacao'] },
    { name: 'Videos', headers: ['ID', 'Titulo', 'VimeoID', 'Thumbnail', 'Descricao', 'Duracao', 'Visualizacoes', 'Likes', 'DataCriacao'] },
    { name: 'Trails', headers: ['ID', 'Nome', 'Descricao', 'TotalEtapas', 'DataCriacao'] },
    { name: 'TrailSteps', headers: ['TrailID', 'Ordem', 'TipoEtapa', 'ContentID'] },
    { name: 'VideoViews', headers: ['Email', 'VideoID', 'Progresso', 'Completado', 'DataVisualizacao'] },
    { name: 'QuizSets', headers: ['ID', 'Nome', 'Descricao', 'DataCriacao'] },
    { name: 'QuizQuestions', headers: ['ID', 'QuizSetID', 'Pergunta', 'Opcoes', 'RespostaCorreta', 'Ordem'] },
    { name: 'QuizResults', headers: ['Email', 'QuizSetID', 'Respostas', 'Pontuacao', 'DataResposta'] },
    { name: 'Likes', headers: ['Email', 'VideoID', 'Data'] },
    { name: 'Config', headers: ['Chave', 'Valor'] }
  ];
  
  for (var i = 0; i < sheetsList.length; i++) {
    var sheetName = sheetsList[i].name;
    var headers = sheetsList[i].headers;
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
  sheet.appendRow([email, name, 0, role, formatarDataComoTexto()]);
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

// Função auxiliar para formatar data como STRING (evita auto-formatação do Sheets)
function formatarDataComoTexto(data) {
  if (!data) data = new Date();
  var dia = ('0' + data.getDate()).slice(-2);
  var mes = ('0' + (data.getMonth() + 1)).slice(-2);
  var ano = data.getFullYear();
  var hora = ('0' + data.getHours()).slice(-2);
  var min = ('0' + data.getMinutes()).slice(-2);
  var seg = ('0' + data.getSeconds()).slice(-2);
  return dia + '/' + mes + '/' + ano + ' ' + hora + ':' + min + ':' + seg;
}

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
      // Pular linhas vazias - verificar se ID existe e não está vazio
      var videoId = data[i][0];
      if (!videoId || videoId === '' || videoId === null || videoId === undefined) {
        Logger.log('Pulando linha ' + (i + 1) + ' - ID vazio ou inválido');
        continue;
      }
      
      // Limpar VimeoID (remover apóstrofo se existir e converter para string)
      var vimeoIdRaw = data[i][2];
      var vimeoId = '';
      if (vimeoIdRaw !== null && vimeoIdRaw !== undefined) {
        vimeoId = String(vimeoIdRaw).replace(/^'/, '');
      }
      
      // Processar data de forma robusta (aceita string, Date object, ou vazio)
      var createdAt = data[i][8];
      var createdAtStr = '';
      if (createdAt) {
        if (typeof createdAt === 'object' && createdAt.getTime) {
          // É um Date object
          createdAtStr = createdAt.toLocaleString('pt-BR');
        } else {
          // É string ou outro formato
          createdAtStr = String(createdAt);
        }
      }
      
      videos.push({
        id: String(videoId),
        title: data[i][1] || 'Sem título',
        vimeoId: vimeoId,
        thumbnail: data[i][3] || '',
        description: data[i][4] || '',
        duration: data[i][5] || 0,
        views: data[i][6] || 0,
        likes: data[i][7] || 0,
        createdAt: createdAtStr
      });
    }
    
    Logger.log('Total de vídeos retornados: ' + videos.length);
    return videos;
  } catch (error) {
    Logger.log('Erro ao buscar vídeos: ' + error.toString());
    Logger.log('Stack: ' + error.stack);
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
  
  // Inserir dados com data formatada como STRING
  sheet.appendRow([
    id,
    videoData.title,
    "'" + vimeoId,
    videoData.thumbnail || '',
    videoData.description || '',
    videoData.duration || 0,
    0, // views
    0, // likes
    formatarDataComoTexto() // String formatada
  ]);
  
  // Forçar célula da data como TEXTO
  sheet.getRange(row, 9).setNumberFormat('@');
  
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
      // Pular linhas vazias - verificação robusta de ID
      var trailId = data[i][0];
      if (!trailId || trailId === '' || trailId === null || trailId === undefined) {
        Logger.log('Pulando linha ' + (i + 1) + ' - ID de trilha vazio ou inválido');
        continue;
      }
      
      // Processar data de forma robusta (aceita string, Date object, ou vazio)
      var createdAt = data[i][4];
      var createdAtStr = '';
      if (createdAt) {
        if (typeof createdAt === 'object' && createdAt.getTime) {
          createdAtStr = createdAt.toLocaleString('pt-BR');
        } else {
          createdAtStr = String(createdAt);
        }
      }
      
      trails.push({
        id: String(trailId),
        name: data[i][1] || 'Sem título',
        description: data[i][2] || '',
        totalSteps: data[i][3] || 0,
        createdAt: createdAtStr,
        steps: getTrailSteps(trailId)
      });
    }
    
    Logger.log('Total de trilhas retornadas: ' + trails.length);
    return trails;
  } catch (error) {
    Logger.log('Erro ao buscar trilhas: ' + error.toString());
    Logger.log('Stack: ' + error.stack);
    return [];
  }
}

function getTrailSteps(trailId) {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName('TrailSteps');
    
    if (!sheet) {
      Logger.log('Aba TrailSteps não encontrada');
      return [];
    }
    
    var data = sheet.getDataRange().getValues();
    
    if (!data || data.length <= 1) {
      return [];
    }
    
    var steps = [];
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === trailId) {
        var stepType = data[i][2]; // 'video' ou 'quiz'
        var contentId = data[i][3];
        var order = data[i][1];
        
        steps.push({
          order: order,
          type: stepType,
          contentId: contentId
        });
      }
    }
    
    // Ordenar por ordem
    steps.sort(function(a, b) { return a.order - b.order; });
    
    // Buscar dados completos de cada etapa
    var stepsWithData = [];
    var videos = getVideos();
    var quizSets = getQuizSets();
    
    for (var j = 0; j < steps.length; j++) {
      var step = steps[j];
      
      if (step.type === 'video') {
        for (var k = 0; k < videos.length; k++) {
          if (videos[k].id === step.contentId) {
            stepsWithData.push({
              order: step.order,
              type: 'video',
              data: videos[k]
            });
            break;
          }
        }
      } else if (step.type === 'quiz') {
        for (var m = 0; m < quizSets.length; m++) {
          if (quizSets[m].id === step.contentId) {
            stepsWithData.push({
              order: step.order,
              type: 'quiz',
              data: quizSets[m]
            });
            break;
          }
        }
      }
    }
    
    return stepsWithData;
  } catch (error) {
    Logger.log('Erro ao buscar etapas da trilha: ' + error.toString());
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
    trailData.steps ? trailData.steps.length : 0,
    formatarDataComoTexto()
  ]);
  
  // Adicionar etapas à trilha (vídeos e quizzes intercalados)
  if (trailData.steps && trailData.steps.length > 0) {
    var stepsSheet = ss.getSheetByName('TrailSteps');
    for (var i = 0; i < trailData.steps.length; i++) {
      var step = trailData.steps[i];
      stepsSheet.appendRow([id, i, step.type, step.contentId]);
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
      sheet.getRange(i + 1, 4).setValue(trailData.steps ? trailData.steps.length : 0);
      
      // Atualizar etapas da trilha
      var stepsSheet = ss.getSheetByName('TrailSteps');
      var stepsData = stepsSheet.getDataRange().getValues();
      
      // Remover etapas antigas
      for (var j = stepsData.length - 1; j >= 1; j--) {
        if (stepsData[j][0] === trailId) {
          stepsSheet.deleteRow(j + 1);
        }
      }
      
      // Adicionar novas etapas
      if (trailData.steps && trailData.steps.length > 0) {
        for (var k = 0; k < trailData.steps.length; k++) {
          var step = trailData.steps[k];
          stepsSheet.appendRow([trailId, k, step.type, step.contentId]);
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
      
      // Remover etapas da trilha
      var stepsSheet = ss.getSheetByName('TrailSteps');
      var stepsData = stepsSheet.getDataRange().getValues();
      
      for (var j = stepsData.length - 1; j >= 1; j--) {
        if (stepsData[j][0] === trailId) {
          stepsSheet.deleteRow(j + 1);
        }
      }
      
      return { success: true };
    }
  }
  
  throw new Error('Trilha não encontrada');
}

function getTrailProgress(trailId) {
  var email = Session.getActiveUser().getEmail();
  var trail = null;
  
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var trailsSheet = ss.getSheetByName('Trails');
  var trailsData = trailsSheet.getDataRange().getValues();
  
  for (var i = 1; i < trailsData.length; i++) {
    if (trailsData[i][0] === trailId) {
      trail = {
        id: trailsData[i][0],
        totalSteps: trailsData[i][3] || 0
      };
      break;
    }
  }
  
  if (!trail) {
    return { completedSteps: 0, totalSteps: 0, percentage: 0 };
  }
  
  var steps = getTrailSteps(trailId);
  var completedSteps = 0;
  
  var videoViewsSheet = ss.getSheetByName('VideoViews');
  var videoViewsData = videoViewsSheet.getDataRange().getValues();
  
  var quizResultsSheet = ss.getSheetByName('QuizResults');
  var quizResultsData = quizResultsSheet.getDataRange().getValues();
  
  for (var i = 0; i < steps.length; i++) {
    var step = steps[i];
    
    if (step.type === 'video') {
      for (var j = 1; j < videoViewsData.length; j++) {
        if (videoViewsData[j][0] === email && videoViewsData[j][1] === step.contentId && videoViewsData[j][3] === true) {
          completedSteps++;
          break;
        }
      }
    } else if (step.type === 'quiz') {
      for (var k = 1; k < quizResultsData.length; k++) {
        if (quizResultsData[k][0] === email && quizResultsData[k][1] === step.contentId) {
          completedSteps++;
          break;
        }
      }
    }
  }
  
  var percentage = trail.totalSteps > 0 ? (completedSteps / trail.totalSteps) * 100 : 0;
  
  return {
    completedSteps: completedSteps,
    totalSteps: trail.totalSteps,
    percentage: Math.round(percentage)
  };
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
      sheet.getRange(i + 1, 5).setValue(formatarDataComoTexto());
      found = true;
      break;
    }
  }
  
  if (!found) {
    sheet.appendRow([email, videoId, progress, completed, formatarDataComoTexto()]);
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
      // Processar data de forma robusta
      var viewDate = data[i][4];
      var viewDateStr = '';
      if (viewDate) {
        if (typeof viewDate === 'object' && viewDate.getTime) {
          viewDateStr = viewDate.toLocaleString('pt-BR');
        } else {
          viewDateStr = String(viewDate);
        }
      }
      
      watchedVideos.push({
        videoId: data[i][1],
        progress: data[i][2] || 0,
        completed: data[i][3] || false,
        date: viewDateStr
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
    formatarDataComoTexto()
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

// ==================== QUIZ SETS E PERGUNTAS ====================

function getQuizSets() {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName('QuizSets');
    
    if (!sheet) return [];
    
    var data = sheet.getDataRange().getValues();
    if (!data || data.length <= 1) return [];
    
    var quizSets = [];
    for (var i = 1; i < data.length; i++) {
      var quizSetId = data[i][0];
      if (!quizSetId) continue;
      
      var createdAt = data[i][3];
      var createdAtStr = '';
      if (createdAt) {
        if (typeof createdAt === 'object' && createdAt.getTime) {
          createdAtStr = createdAt.toLocaleString('pt-BR');
        } else {
          createdAtStr = String(createdAt);
        }
      }
      
      quizSets.push({
        id: String(quizSetId),
        name: data[i][1] || 'Sem título',
        description: data[i][2] || '',
        createdAt: createdAtStr,
        questions: getQuizQuestions(quizSetId)
      });
    }
    
    return quizSets;
  } catch (error) {
    Logger.log('Erro ao buscar quiz sets: ' + error.toString());
    return [];
  }
}

function getQuizQuestions(quizSetId) {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName('QuizQuestions');
    
    if (!sheet) return [];
    
    var data = sheet.getDataRange().getValues();
    if (!data || data.length <= 1) return [];
    
    var questions = [];
    for (var i = 1; i < data.length; i++) {
      if (data[i][1] === quizSetId) {
        questions.push({
          id: data[i][0],
          quizSetId: data[i][1],
          question: data[i][2],
          options: JSON.parse(data[i][3] || '[]'),
          correctAnswer: data[i][4],
          order: data[i][5] || questions.length
        });
      }
    }
    
    questions.sort(function(a, b) { return a.order - b.order; });
    return questions;
  } catch (error) {
    Logger.log('Erro ao buscar perguntas: ' + error.toString());
    return [];
  }
}

function addQuizSet(quizSetData) {
  var user = Session.getActiveUser().getEmail();
  if (!isAdmin(user)) {
    throw new Error('Apenas administradores podem criar quiz sets');
  }
  
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('QuizSets');
  
  var id = 'QUIZSET_' + new Date().getTime();
  sheet.appendRow([
    id,
    quizSetData.name,
    quizSetData.description || '',
    formatarDataComoTexto()
  ]);
  
  return { success: true, id: id };
}

function addQuizQuestion(questionData) {
  var user = Session.getActiveUser().getEmail();
  if (!isAdmin(user)) {
    throw new Error('Apenas administradores podem adicionar perguntas');
  }
  
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('QuizQuestions');
  
  var id = 'Q_' + new Date().getTime();
  sheet.appendRow([
    id,
    questionData.quizSetId,
    questionData.question,
    JSON.stringify(questionData.options),
    questionData.correctAnswer,
    questionData.order || 0
  ]);
  
  return { success: true, id: id };
}

function deleteQuizSet(quizSetId) {
  var user = Session.getActiveUser().getEmail();
  if (!isAdmin(user)) {
    throw new Error('Apenas administradores podem deletar quiz sets');
  }
  
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  var sheet = ss.getSheetByName('QuizSets');
  var data = sheet.getDataRange().getValues();
  
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === quizSetId) {
      sheet.deleteRow(i + 1);
      
      var questionsSheet = ss.getSheetByName('QuizQuestions');
      var questionsData = questionsSheet.getDataRange().getValues();
      
      for (var j = questionsData.length - 1; j >= 1; j--) {
        if (questionsData[j][1] === quizSetId) {
          questionsSheet.deleteRow(j + 1);
        }
      }
      
      return { success: true };
    }
  }
  
  throw new Error('Quiz set não encontrado');
}

function submitQuizSetAnswers(quizSetId, answers) {
  var email = Session.getActiveUser().getEmail();
  var questions = getQuizQuestions(quizSetId);
  
  var correctAnswers = 0;
  var totalQuestions = questions.length;
  
  for (var i = 0; i < questions.length; i++) {
    var question = questions[i];
    if (answers[question.id] === question.correctAnswer) {
      correctAnswers++;
    }
  }
  
  var score = totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0;
  
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var resultSheet = ss.getSheetByName('QuizResults');
  resultSheet.appendRow([
    email,
    quizSetId,
    JSON.stringify(answers),
    score,
    formatarDataComoTexto()
  ]);
  
  var points = 0;
  if (score === 100) points = 20;
  else if (score >= 75) points = 15;
  else if (score >= 50) points = 10;
  else if (score >= 25) points = 5;
  
  if (points > 0) {
    updateUserPoints(email, points);
  }
  
  return { success: true, score: score, points: points, correctAnswers: correctAnswers, totalQuestions: totalQuestions };
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
  
  sheet.appendRow([email, videoId, formatarDataComoTexto()]);
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
  
  sheet.appendRow([email, trailId, formatarDataComoTexto()]);
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

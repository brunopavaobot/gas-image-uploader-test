# Guia do Administrador

## Como Adicionar Quiz aos Vídeos

Atualmente, os quiz devem ser adicionados diretamente na planilha Google Sheets. Siga os passos abaixo:

### Passo 1: Acessar a Planilha de Quizzes

1. Abra a planilha Google Sheets que você configurou como banco de dados
2. Localize a aba chamada **"Quizzes"**
3. A planilha terá os seguintes cabeçalhos:
   - ID
   - VideoID
   - Pergunta
   - Opcoes
   - RespostaCorreta
   - Tempo

### Passo 2: Adicionar uma Nova Questão

Para adicionar uma nova questão, crie uma nova linha com os seguintes dados:

**Exemplo:**

| ID | VideoID | Pergunta | Opcoes | RespostaCorreta | Tempo |
|----|---------|----------|--------|-----------------|-------|
| QUIZ_1234567890 | VID_1234567890 | Qual é o principal benefício do produto X? | ["Reduz custos", "Aumenta produtividade", "Melhora qualidade", "Todas as anteriores"] | 3 | 30 |

**Explicação dos campos:**

- **ID**: Um identificador único. Use o formato `QUIZ_` seguido de um timestamp ou número único
- **VideoID**: O ID do vídeo ao qual este quiz está associado (copie da aba "Videos")
- **Pergunta**: O texto da pergunta
- **Opcoes**: Um array JSON com as opções de resposta. Formato: `["Opção 1", "Opção 2", "Opção 3", "Opção 4"]`
- **RespostaCorreta**: O índice da resposta correta (0 = primeira opção, 1 = segunda, 2 = terceira, etc.)
- **Tempo**: Tempo em segundos para responder (recomendado: 30-60 segundos)

### Passo 3: Formato JSON para Opções

**IMPORTANTE**: As opções devem estar em formato JSON válido:

```json
["Primeira opção", "Segunda opção", "Terceira opção", "Quarta opção"]
```

**Exemplos corretos:**
- `["Sim", "Não", "Talvez"]`
- `["10%", "25%", "50%", "75%"]`
- `["Janeiro", "Fevereiro", "Março"]`

**Exemplos incorretos:**
- `[Sim, Não]` (faltam aspas)
- `"Sim", "Não"` (faltam colchetes)
- `['Sim', 'Não']` (use aspas duplas, não simples)

### Passo 4: Definir Resposta Correta

O campo **RespostaCorreta** é um número que indica qual opção é a correta:

- `0` = Primeira opção (índice 0)
- `1` = Segunda opção (índice 1)
- `2` = Terceira opção (índice 2)
- `3` = Quarta opção (índice 3)

**Exemplo completo:**

Se suas opções são:
```json
["Paris", "Londres", "Berlim", "Roma"]
```

E a resposta correta é "Paris", então `RespostaCorreta` deve ser `0`

Se a resposta correta é "Roma", então `RespostaCorreta` deve ser `3`

### Passo 5: Adicionar Múltiplas Questões

Você pode adicionar várias questões para o mesmo vídeo. Cada uma aparecerá no quiz após o vídeo ser assistido.

**Exemplo de múltiplas questões:**

| ID | VideoID | Pergunta | Opcoes | RespostaCorreta | Tempo |
|----|---------|----------|--------|-----------------|-------|
| QUIZ_001 | VID_1234 | Qual o tema do vídeo? | ["Marketing", "Vendas", "Gestão", "Tecnologia"] | 2 | 30 |
| QUIZ_002 | VID_1234 | Quantas etapas foram apresentadas? | ["3", "4", "5", "6"] | 1 | 20 |
| QUIZ_003 | VID_1234 | Qual ferramenta foi recomendada? | ["Excel", "PowerBI", "Tableau", "Todas"] | 3 | 30 |

## Como Obter o ID do Vídeo

1. Acesse a aba **"Videos"** na planilha
2. Localize o vídeo desejado
3. Copie o valor da coluna **"ID"** (exemplo: `VID_1234567890`)
4. Use esse ID no campo **VideoID** do quiz

## Como Configurar o Tempo do Quiz

- **20-30 segundos**: Para questões simples e diretas
- **30-45 segundos**: Para questões de dificuldade média
- **45-60 segundos**: Para questões que exigem mais reflexão

## Pontuação Automática

O sistema calcula automaticamente a pontuação baseado no desempenho:

- **100% de acerto**: 20 pontos
- **75% de acerto**: 15 pontos
- **50% de acerto**: 10 pontos
- **25% de acerto**: 5 pontos

## Testando o Quiz

1. Acesse a plataforma como aluno (não admin)
2. Assista ao vídeo até pelo menos 90% de conclusão
3. O quiz aparecerá automaticamente
4. Responda as questões antes do tempo acabar
5. Veja sua pontuação e pontos ganhos

## Melhorias Futuras

Para adicionar uma interface de quiz no painel admin via código, você precisaria:

1. Adicionar um formulário no HTML do painel admin
2. Criar uma função `addQuiz()` no JavaScript
3. O código já possui a função backend `addQuiz()` no `code.gs`

Exemplo de implementação (adicionar ao HTML):

```html
<div class="card">
  <h2>Adicionar Quiz ao Vídeo</h2>
  <div class="form-group">
    <label>Selecione o Vídeo</label>
    <select id="quizVideoSelect"></select>
  </div>
  <div class="form-group">
    <label>Pergunta</label>
    <input type="text" id="quizQuestion">
  </div>
  <div class="form-group">
    <label>Opção 1</label>
    <input type="text" id="quizOption1">
  </div>
  <div class="form-group">
    <label>Opção 2</label>
    <input type="text" id="quizOption2">
  </div>
  <div class="form-group">
    <label>Opção 3</label>
    <input type="text" id="quizOption3">
  </div>
  <div class="form-group">
    <label>Opção 4</label>
    <input type="text" id="quizOption4">
  </div>
  <div class="form-group">
    <label>Resposta Correta</label>
    <select id="quizCorrectAnswer">
      <option value="0">Opção 1</option>
      <option value="1">Opção 2</option>
      <option value="2">Opção 3</option>
      <option value="3">Opção 4</option>
    </select>
  </div>
  <div class="form-group">
    <label>Tempo (segundos)</label>
    <input type="number" id="quizTime" value="30">
  </div>
  <button class="btn btn-primary" onclick="addQuizToVideo()">Adicionar Quiz</button>
</div>
```

E adicionar a função JavaScript:

```javascript
function addQuizToVideo() {
  const videoId = document.getElementById('quizVideoSelect').value;
  const question = document.getElementById('quizQuestion').value;
  const options = [
    document.getElementById('quizOption1').value,
    document.getElementById('quizOption2').value,
    document.getElementById('quizOption3').value,
    document.getElementById('quizOption4').value
  ];
  const correctAnswer = parseInt(document.getElementById('quizCorrectAnswer').value);
  const time = parseInt(document.getElementById('quizTime').value);
  
  google.script.run.withSuccessHandler(() => {
    alert('Quiz adicionado com sucesso!');
    // Limpar formulário
  }).addQuiz({
    videoId: videoId,
    question: question,
    options: options,
    correctAnswer: correctAnswer,
    time: time
  });
}
```

## Suporte

Para dúvidas ou problemas:
1. Verifique se o formato JSON das opções está correto
2. Confirme que o VideoID existe na aba "Videos"
3. Teste o quiz como aluno após adicionar
4. Consulte os logs de execução no Google Apps Script

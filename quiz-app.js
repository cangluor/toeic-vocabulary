(function () {
  'use strict';

  var activeMode='vocabulary', level=400, bank=null, questions=[], queue=[], cursor=0, reviewMode=false, answeredCurrent=false, state=null, ui={}, syncTimer=null;
  var DEFAULT_API='https://toeic-vocabulary.cangluo1996.workers.dev';

  function byId(id){return document.getElementById(id);}
  function safeGet(key,fallback){try{var v=localStorage.getItem(key);return v===null?fallback:v;}catch(e){return fallback;}}
  function safeSet(key,value){try{localStorage.setItem(key,value);}catch(e){}}
  function progressKey(l){return 'toeic-progress-'+l;}
  function emptyQuizState(){return {answers:{},cursor:0,wrong:[]};}

  function initUi(){
    ['quizPanel','quizModeBadge','quizIndex','quizSentence','quizPrompt','quizOptions','quizFeedback','quizTranslation','quizUsage','quizNextBtn','quizReviewBtn','quizRestartBtn','quizResetBtn','quizProgressText','quizCorrectText','quizWrongText','quizCorrectLabel','quizWrongLabel','quizProgressBar','wordStats','wordProgressTrack','card','ratingButtons','donePanel','resetBtn'].forEach(function(id){ui[id]=byId(id);});
    if(!ui.quizPanel)throw new Error('页面缺少练习区域');
  }

  function loadRootState(l){
    var root;try{root=JSON.parse(safeGet(progressKey(l),'{}'))||{};}catch(e){root={};}
    root.quiz=root.quiz||{};
    root.quiz.pos=Object.assign(emptyQuizState(),root.quiz.pos||{});
    root.quiz.collocation=Object.assign(emptyQuizState(),root.quiz.collocation||{});
    ['pos','collocation'].forEach(function(k){root.quiz[k].answers=root.quiz[k].answers||{};root.quiz[k].wrong=root.quiz[k].wrong||[];});
    return root;
  }
  function quizKey(){return activeMode==='pos'?'pos':'collocation';}
  function loadQuizState(){var root=loadRootState(level);state=root.quiz[quizKey()];return root;}
  function saveQuizState(){var root=loadRootState(level);root.quiz[quizKey()]=state;safeSet(progressKey(level),JSON.stringify(root));scheduleCloudSave();}
  function collectAllProgress(){var levels={};[400,600,700].forEach(function(l){try{levels[l]=JSON.parse(safeGet(progressKey(l),'null'))||{};}catch(e){levels[l]={};}});return {version:2,updatedAt:new Date().toISOString(),levels:levels};}
  function scheduleCloudSave(){
    var code=safeGet('toeic-sync-code',''),api=(safeGet('toeic-sync-api',DEFAULT_API)||DEFAULT_API).replace(/\/+$/,'');
    if(!api||code.length<8)return;clearTimeout(syncTimer);
    syncTimer=setTimeout(function(){fetch(api+'/progress',{method:'PUT',headers:{'Content-Type':'application/json','X-Sync-Code':code},body:JSON.stringify(collectAllProgress())}).catch(function(){});},500);
  }

  function setMode(mode){
    activeMode=mode;window.TOEIC_ACTIVE_MODE=mode;
    document.querySelectorAll('.mode-btn').forEach(function(b){b.classList.toggle('active',b.dataset.mode===mode);});
    if(mode==='vocabulary'){
      ui.quizPanel.classList.add('hidden');ui.wordStats.classList.remove('hidden');ui.wordProgressTrack.classList.remove('hidden');ui.resetBtn.classList.remove('hidden');ui.card.classList.remove('hidden');
      if(byId('revealBtn')&&!byId('revealBtn').classList.contains('hidden'))ui.ratingButtons.classList.add('hidden');
      return;
    }
    ui.card.classList.add('hidden');ui.ratingButtons.classList.add('hidden');ui.donePanel.classList.add('hidden');ui.wordStats.classList.add('hidden');ui.wordProgressTrack.classList.add('hidden');ui.resetBtn.classList.add('hidden');ui.quizPanel.classList.remove('hidden');
    prepareQuestions(false);
  }

  function prepareQuestions(reset){
    if(!bank||activeMode==='vocabulary')return;
    questions=bank[quizKey()].filter(function(q){return q.level===level;});
    loadQuizState();if(reset){state.cursor=0;saveQuizState();}
    reviewMode=false;queue=questions.slice();cursor=Math.min(Number(state.cursor)||0,queue.length);renderQuestion();
  }
  function startReview(){
    loadQuizState();var wrongSet={};state.wrong.forEach(function(id){wrongSet[Number(id)]=true;});
    queue=questions.filter(function(q){return wrongSet[q.id];});reviewMode=true;cursor=0;renderQuestion();
  }
  function currentQuestion(){return queue[cursor];}

  function renderStats(){
    var total=questions.length;
    var answered=Object.keys(state.answers||{}).filter(function(id){return questions.some(function(q){return q.id===Number(id);});}).length;
    var positive=questions.filter(function(q){return state.answers[q.id]===true;}).length;
    var negative=state.wrong.filter(function(id){return questions.some(function(q){return q.id===Number(id);});}).length;
    ui.quizProgressText.textContent=answered+' / '+total;ui.quizCorrectText.textContent=positive;ui.quizWrongText.textContent=negative;
    ui.quizCorrectLabel.textContent=activeMode==='collocation'?'认识':'正确';
    ui.quizWrongLabel.textContent=activeMode==='collocation'?'不认识':'错题';
    ui.quizProgressBar.style.width=(total?answered/total*100:0)+'%';
    ui.quizReviewBtn.disabled=negative===0;
    ui.quizReviewBtn.textContent=negative?(activeMode==='collocation'?'复习不认识（'+negative+'）':'只刷错题（'+negative+'）'):(activeMode==='collocation'?'没有待复习搭配':'没有错题');
  }
  function clearOptions(){while(ui.quizOptions.firstChild)ui.quizOptions.removeChild(ui.quizOptions.firstChild);}
  function resetAnswerDisplay(){
    answeredCurrent=false;ui.quizFeedback.className='quiz-feedback hidden';ui.quizTranslation.classList.add('hidden');ui.quizUsage.classList.add('hidden');ui.quizNextBtn.classList.add('hidden');clearOptions();
  }

  function renderQuestion(){
    resetAnswerDisplay();renderStats();
    if(cursor>=queue.length){
      ui.quizModeBadge.textContent=reviewMode?(activeMode==='collocation'?'搭配复习完成':'错题复习完成'):'练习完成';ui.quizIndex.textContent='';ui.quizSentence.textContent='';ui.quizSentence.classList.add('hidden');ui.quizPrompt.textContent=reviewMode?'本轮复习完成。':'本档练习完成。';return;
    }
    var q=currentQuestion();
    ui.quizModeBadge.textContent=activeMode==='pos'?(reviewMode?'词性 · 错题':'词性练习'):(reviewMode?'搭配 · 复习':'固定搭配');
    ui.quizIndex.textContent=(cursor+1)+' / '+queue.length+' · 题号 '+q.id;

    if(activeMode==='collocation'){
      ui.quizSentence.textContent='';ui.quizSentence.classList.add('hidden');
      ui.quizPrompt.textContent=q.answer;
      addRecognitionButton('认识',true,'know-choice');
      addRecognitionButton('不认识',false,'unknown-choice');
      return;
    }

    ui.quizSentence.textContent=q.sentence||'';ui.quizSentence.classList.toggle('hidden',!q.sentence);ui.quizPrompt.textContent=q.prompt;
    q.options.forEach(function(option,index){
      var button=document.createElement('button');button.type='button';button.className='quiz-option';button.dataset.value=option;button.textContent=String.fromCharCode(65+index)+'. '+option;
      button.addEventListener('click',function(){answerPosQuestion(option);});ui.quizOptions.appendChild(button);
    });
  }

  function addRecognitionButton(label,value,extraClass){
    var button=document.createElement('button');button.type='button';button.className='quiz-option '+extraClass;button.textContent=label;button.dataset.value=String(value);
    button.addEventListener('click',function(){answerCollocation(value);});ui.quizOptions.appendChild(button);
  }

  function updateState(result){
    var q=currentQuestion();state.answers[q.id]=result;var wrongIndex=state.wrong.map(Number).indexOf(q.id);
    if(result){if(wrongIndex>=0)state.wrong.splice(wrongIndex,1);}else if(wrongIndex<0)state.wrong.push(q.id);
    if(!reviewMode)state.cursor=Math.max(Number(state.cursor)||0,cursor+1);saveQuizState();
  }

  function answerPosQuestion(selected){
    if(answeredCurrent||!currentQuestion())return;answeredCurrent=true;var q=currentQuestion(),correct=selected===q.answer;updateState(correct);
    Array.prototype.forEach.call(ui.quizOptions.children,function(button){button.disabled=true;if(button.dataset.value===q.answer)button.classList.add('correct');if(button.dataset.value===selected&&!correct)button.classList.add('wrong');});
    ui.quizFeedback.textContent=(correct?'✓ 正确。':'✗ 正确答案：'+q.answer+'。')+' '+(q.explanation||'');ui.quizFeedback.className='quiz-feedback '+(correct?'correct-text':'wrong-text');
    if(q.sentenceTranslation){ui.quizTranslation.textContent=q.sentenceTranslation;ui.quizTranslation.classList.remove('hidden');}
    ui.quizNextBtn.classList.remove('hidden');renderStats();
  }

  function answerCollocation(known){
    if(answeredCurrent||!currentQuestion())return;answeredCurrent=true;var q=currentQuestion();updateState(known);
    Array.prototype.forEach.call(ui.quizOptions.children,function(button){button.disabled=true;});
    ui.quizFeedback.textContent=(known?'已标记为认识。':'已加入待复习。')+(q.answerMeaning?'  '+q.answerMeaning:'');
    ui.quizFeedback.className='quiz-feedback '+(known?'correct-text':'wrong-text');
    if(q.sentence){ui.quizSentence.textContent=q.sentence;ui.quizSentence.classList.remove('hidden');}
    if(q.sentenceTranslation){ui.quizTranslation.textContent=q.sentenceTranslation;ui.quizTranslation.classList.remove('hidden');}
    if(q.usage){ui.quizUsage.textContent='用法：'+q.usage;ui.quizUsage.classList.remove('hidden');}
    ui.quizNextBtn.classList.remove('hidden');renderStats();
  }

  function nextQuestion(){if(!answeredCurrent)return;cursor++;renderQuestion();}
  function restartCurrent(){state=emptyQuizState();saveQuizState();reviewMode=false;queue=questions.slice();cursor=0;renderQuestion();}
  function resetQuiz(){if(!confirm('确定重置 '+level+' 分档的'+(activeMode==='pos'?'词性练习':'固定搭配')+'记录吗？'))return;restartCurrent();}

  function bindEvents(){
    document.querySelectorAll('.mode-btn').forEach(function(b){b.addEventListener('click',function(){setMode(b.dataset.mode);});});
    document.querySelectorAll('.level-btn').forEach(function(b){b.addEventListener('click',function(){level=Number(b.dataset.level);if(activeMode!=='vocabulary')prepareQuestions(false);});});
    ui.quizNextBtn.addEventListener('click',nextQuestion);ui.quizReviewBtn.addEventListener('click',startReview);ui.quizRestartBtn.addEventListener('click',restartCurrent);ui.quizResetBtn.addEventListener('click',resetQuiz);
    var connect=byId('connectBtn');if(connect)connect.addEventListener('click',function(){setTimeout(function(){if(activeMode!=='vocabulary')prepareQuestions(false);},1200);});
  }
  function boot(){
    initUi();bindEvents();if(!window.TOEIC_QUESTION_BANK)throw new Error('题库脚本未加载');
    window.TOEIC_QUESTION_BANK.load().then(function(loaded){bank=loaded;if(activeMode!=='vocabulary')prepareQuestions(false);}).catch(function(err){ui.quizPanel.classList.remove('hidden');ui.quizPrompt.textContent='题库读取失败：'+err.message;});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
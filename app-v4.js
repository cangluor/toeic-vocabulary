(function () {
  'use strict';

  var LEVEL_FILES = {
    400: ['data/400/words-001-100.csv','data/400/words-101-200.csv','data/400/words-201-300.csv','data/400/words-301-400.csv'],
    600: ['data/400/words-001-100.csv','data/400/words-101-200.csv','data/400/words-201-300.csv','data/400/words-301-400.csv','data/600/words-401-500.csv','data/600/words-501-600.csv','data/600/words-601-700.csv','data/600/words-701-750.csv'],
    700: ['data/400/words-001-100.csv','data/400/words-101-200.csv','data/400/words-201-300.csv','data/400/words-301-400.csv','data/600/words-401-500.csv','data/600/words-501-600.csv','data/600/words-601-700.csv','data/600/words-701-750.csv','data/700/words-751-850.csv','data/700/words-851-950.csv','data/700/words-951-1000.csv']
  };
  var DEFAULT_API = 'https://toeic-vocabulary.cangluo1996.workers.dev';
  var level = 400, words = [], queue = [], cursor = 0, mode = 'study', revealed = false;
  var state = emptyState(), syncTimer = null, syncing = false;
  var ui = {};
  var syncConfig = { apiUrl: DEFAULT_API, code: '' };

  function emptyState() { return { ratings:{}, studyOrder:[], studyCursor:0, reviewOrder:[], reviewCursor:0 }; }
  function byId(id) { return document.getElementById(id); }
  function stateKey(l) { return 'toeic-progress-' + l; }
  function safeGet(key, fallback) { try { var v = localStorage.getItem(key); return v === null ? fallback : v; } catch (e) { return fallback; } }
  function safeSet(key, value) { try { localStorage.setItem(key, value); } catch (e) {} }
  function safeRemove(key) { try { localStorage.removeItem(key); } catch (e) {} }

  function initUi() {
    ['progressText','masteredText','reviewText','progressBar','card','modeBadge','wordIndex','wordText','phoneticText','answer','partText','meaningText','topicText','revealBtn','ratingButtons','donePanel','doneTitle','doneText','reviewBtn','restartBtn','resetBtn','errorText','syncSettingsBtn','syncPanel','apiUrlInput','syncCodeInput','connectBtn','disconnectBtn','syncStatus','cloudIndicator'].forEach(function (id) { ui[id] = byId(id); });
    ['wordText','syncSettingsBtn','syncPanel','apiUrlInput','syncCodeInput'].forEach(function (id) { if (!ui[id]) throw new Error('页面缺少元素：' + id); });
  }

  function splitCsvLine(line) {
    var out = [], cell = '', quoted = false;
    for (var i=0; i<line.length; i++) {
      var c = line[i];
      if (c === '"') {
        if (quoted && line[i+1] === '"') { cell += '"'; i++; }
        else quoted = !quoted;
      } else if (c === ',' && !quoted) { out.push(cell); cell = ''; }
      else cell += c;
    }
    out.push(cell); return out;
  }
  function parseCsv(text) {
    var lines = text.replace(/^\uFEFF/, '').trim().split(/\r?\n/);
    if (lines.length < 2) return [];
    var headers = splitCsvLine(lines[0]);
    return lines.slice(1).filter(Boolean).map(function (line) {
      var values = splitCsvLine(line), obj = {};
      headers.forEach(function (h, i) { obj[h.trim()] = (values[i] || '').trim(); });
      return obj;
    });
  }

  function loadWords() {
    ui.wordText.textContent = '加载中…';
    Promise.all(LEVEL_FILES[level].map(function (path) {
      return fetch(path + '?v=4').then(function (r) {
        if (!r.ok) throw new Error(path + '（HTTP ' + r.status + '）');
        return r.text();
      }).then(parseCsv);
    })).then(function (parts) {
      words = [].concat.apply([], parts).map(function (w) { w.id = Number(w.id); w.level = Number(w.level); return w; });
      if (!words.length) throw new Error('词库为空');
      loadState(); startSavedMode(); hideError();
    }).catch(function (err) { showError('词库读取失败：' + err.message); ui.wordText.textContent = '读取失败'; });
  }

  function loadState() {
    try { state = Object.assign(emptyState(), JSON.parse(safeGet(stateKey(level), '{}'))); }
    catch (e) { state = emptyState(); }
    state.ratings = state.ratings || {};
  }
  function saveState() { safeSet(stateKey(level), JSON.stringify(state)); scheduleCloudSave(); }
  function allIds() { return words.map(function (w) { return w.id; }); }
  function reviewIds() { return words.filter(function (w) { return state.ratings[w.id] && state.ratings[w.id] !== 'know'; }).map(function (w) { return w.id; }); }
  function startSavedMode() {
    if (state.studyOrder.length !== words.length) { state.studyOrder = allIds(); state.studyCursor = 0; saveState(); }
    mode = 'study'; queue = state.studyOrder.slice(); cursor = Math.min(state.studyCursor || 0, queue.length); render();
  }
  function startStudy(reset) { if (reset) { state.studyOrder = allIds(); state.studyCursor = 0; saveState(); } mode='study'; queue=state.studyOrder.slice(); cursor=state.studyCursor||0; render(); }
  function startReview() { queue=reviewIds(); state.reviewOrder=queue.slice(); state.reviewCursor=0; cursor=0; mode='review'; saveState(); render(); }
  function currentWord() { var id=queue[cursor]; return words.find(function (w) { return w.id===id; }); }

  function render() {
    updateStats(); revealed=false;
    ui.answer.classList.add('hidden'); ui.ratingButtons.classList.add('hidden'); ui.revealBtn.classList.remove('hidden'); ui.donePanel.classList.add('hidden'); ui.card.classList.remove('hidden');
    if (cursor >= queue.length) { renderDone(); return; }
    var w=currentWord(); if (!w) { renderDone(); return; }
    ui.modeBadge.textContent = mode==='review' ? '复习' : '学习';
    ui.wordIndex.textContent = (cursor+1) + ' / ' + queue.length + ' · 总编号 ' + w.id;
    ui.wordText.textContent=w.word; ui.phoneticText.textContent=w.phonetic; ui.partText.textContent=w.partOfSpeech; ui.meaningText.textContent=w.meaning; ui.topicText.textContent=w.topic;
  }
  function updateStats() {
    var completed=words.filter(function(w){return state.ratings[w.id];}).length;
    var mastered=words.filter(function(w){return state.ratings[w.id]==='know';}).length;
    ui.progressText.textContent=completed+' / '+words.length; ui.masteredText.textContent=mastered; ui.reviewText.textContent=reviewIds().length; ui.progressBar.style.width=(words.length?completed/words.length*100:0)+'%';
  }
  function reveal() { if (cursor>=queue.length) return; revealed=true; ui.answer.classList.remove('hidden'); ui.ratingButtons.classList.remove('hidden'); ui.revealBtn.classList.add('hidden'); }
  function rate(value) { if (!revealed || cursor>=queue.length) return; state.ratings[queue[cursor]]=value; cursor++; if(mode==='study') state.studyCursor=cursor; else state.reviewCursor=cursor; saveState(); render(); }
  function renderDone() { var count=reviewIds().length; ui.card.classList.add('hidden'); ui.ratingButtons.classList.add('hidden'); ui.donePanel.classList.remove('hidden'); ui.doneTitle.textContent=mode==='review'?'复习完成':'本轮完成'; ui.doneText.textContent=count?'还有 '+count+' 个词在复习库。':'当前档位没有待复习单词。'; ui.reviewBtn.disabled=count===0; ui.reviewBtn.textContent=count?'复习 '+count+' 个词':'没有待复习词'; }
  function switchLevel(next) { level=Number(next); document.querySelectorAll('.level-btn').forEach(function(b){b.classList.toggle('active',Number(b.dataset.level)===level);}); words=[]; queue=[]; cursor=0; loadWords(); }
  function resetCurrent() { if (!confirm('确定重置 '+level+' 分档的全部学习记录吗？')) return; safeRemove(stateKey(level)); state=emptyState(); startStudy(true); }
  function showError(msg) { ui.errorText.textContent=msg; ui.errorText.classList.remove('hidden'); }
  function hideError() { ui.errorText.classList.add('hidden'); }

  function normalizedApiUrl() { return syncConfig.apiUrl.trim().replace(/\/+$/,''); }
  function hasSync() { return normalizedApiUrl() && syncConfig.code.length>=8; }
  function setSyncStatus(text, ok) { ui.syncStatus.textContent=text; ui.cloudIndicator.textContent=ok?'云端同步已连接':'仅保存在本机'; }
  function collectAllProgress() { var levels={}; [400,600,700].forEach(function(l){try{levels[l]=JSON.parse(safeGet(stateKey(l),'null'))||emptyState();}catch(e){levels[l]=emptyState();}}); return {version:1,updatedAt:new Date().toISOString(),levels:levels}; }
  function applyCloudProgress(data) { if(!data||!data.levels)return; [400,600,700].forEach(function(l){if(data.levels[l])safeSet(stateKey(l),JSON.stringify(data.levels[l]));}); loadState(); startSavedMode(); }
  function cloudRequest(method, body) { return fetch(normalizedApiUrl()+'/progress',{method:method,headers:{'Content-Type':'application/json','X-Sync-Code':syncConfig.code},body:body?JSON.stringify(body):undefined}).then(function(r){if(!r.ok)return r.text().then(function(t){throw new Error(t||('HTTP '+r.status));}); return r.status===204?null:r.json();}); }
  function connectCloud() { syncConfig.apiUrl=ui.apiUrlInput.value.trim(); syncConfig.code=ui.syncCodeInput.value.trim(); if(!/^https:\/\//.test(syncConfig.apiUrl)){setSyncStatus('Worker 地址必须以 https:// 开头');return;} if(syncConfig.code.length<8){setSyncStatus('同步码至少8位');return;} safeSet('toeic-sync-api',syncConfig.apiUrl); safeSet('toeic-sync-code',syncConfig.code); ui.connectBtn.disabled=true; setSyncStatus('正在读取云端进度…'); cloudRequest('GET').then(function(remote){if(remote&&remote.levels){applyCloudProgress(remote);setSyncStatus('云端进度已读取',true);}else return cloudRequest('PUT',collectAllProgress()).then(function(){setSyncStatus('云端进度已建立',true);});}).catch(function(e){setSyncStatus('连接失败：'+e.message);}).finally(function(){ui.connectBtn.disabled=false;}); }
  function disconnectCloud() { syncConfig.apiUrl=DEFAULT_API; syncConfig.code=''; safeRemove('toeic-sync-code'); ui.apiUrlInput.value=DEFAULT_API; ui.syncCodeInput.value=''; setSyncStatus('已断开云端同步'); }
  function scheduleCloudSave() { if(!hasSync())return; clearTimeout(syncTimer); syncTimer=setTimeout(saveCloud,500); }
  function saveCloud() { if(!hasSync()||syncing)return; syncing=true; ui.cloudIndicator.textContent='正在同步…'; cloudRequest('PUT',collectAllProgress()).then(function(){setSyncStatus('云端已同步',true);}).catch(function(e){ui.cloudIndicator.textContent='同步失败，本机已保存';ui.syncStatus.textContent='同步失败：'+e.message;}).finally(function(){syncing=false;}); }

  function bindEvents() {
    document.querySelectorAll('.level-btn').forEach(function(b){b.addEventListener('click',function(){switchLevel(b.dataset.level);});});
    ui.revealBtn.addEventListener('click',reveal);
    document.querySelectorAll('.rating').forEach(function(b){b.addEventListener('click',function(){rate(b.dataset.rating);});});
    ui.reviewBtn.addEventListener('click',startReview); ui.restartBtn.addEventListener('click',function(){startStudy(true);}); ui.resetBtn.addEventListener('click',resetCurrent);
    ui.syncSettingsBtn.addEventListener('click',function(){ui.syncPanel.classList.toggle('hidden');}); ui.connectBtn.addEventListener('click',connectCloud); ui.disconnectBtn.addEventListener('click',disconnectCloud);
  }

  function boot() {
    try {
      initUi(); syncConfig.apiUrl=safeGet('toeic-sync-api',DEFAULT_API)||DEFAULT_API; syncConfig.code=safeGet('toeic-sync-code',''); ui.apiUrlInput.value=syncConfig.apiUrl; ui.syncCodeInput.value=syncConfig.code; bindEvents();
      if(hasSync()){setSyncStatus('已保存同步设置，正在连接…');connectCloud();}else setSyncStatus('未连接');
      loadWords();
    } catch (e) {
      var error=byId('errorText'); if(error){error.textContent='页面启动失败：'+e.message;error.classList.remove('hidden');}
      var word=byId('wordText'); if(word)word.textContent='启动失败';
      console.error(e);
    }
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
})();
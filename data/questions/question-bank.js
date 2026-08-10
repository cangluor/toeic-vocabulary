(function (global) {
  'use strict';

  var WORD_FILES = [
    'data/400/words-001-100.csv','data/400/words-101-200.csv','data/400/words-201-300.csv','data/400/words-301-400.csv',
    'data/600/words-401-500.csv','data/600/words-501-600.csv','data/600/words-601-700.csv','data/600/words-701-750.csv',
    'data/700/words-751-850.csv','data/700/words-851-950.csv','data/700/words-951-1000.csv'
  ];
  var ENRICHMENT_FILES = [
    'data/enrichment/words-001-100.csv','data/enrichment/words-101-200.csv','data/enrichment/words-201-300.csv','data/enrichment/words-301-400.csv',
    'data/enrichment/words-401-500.csv','data/enrichment/words-501-600.csv','data/enrichment/words-601-700.csv','data/enrichment/words-701-750.csv',
    'data/enrichment/words-751-850.csv','data/enrichment/words-851-950.csv','data/enrichment/words-951-1000.csv'
  ];
  var LEVEL_TARGETS = [
    { level:400, minId:1, maxId:400, count:150 },
    { level:600, minId:401, maxId:750, count:150 },
    { level:700, minId:751, maxId:1000, count:100 }
  ];
  var POS_LABELS = {'n.':'名词','v.':'动词','adj.':'形容词','adv.':'副词'};
  var POS_OPTIONS = ['名词','动词','形容词','副词'];

  function splitCsvLine(line) {
    var out=[], cell='', quoted=false;
    for (var i=0;i<line.length;i++) {
      var c=line[i];
      if (c==='"') {
        if (quoted && line[i+1]==='"') { cell+='"'; i++; } else quoted=!quoted;
      } else if (c===',' && !quoted) { out.push(cell); cell=''; }
      else cell+=c;
    }
    out.push(cell); return out;
  }
  function parseCsv(text) {
    var lines=text.replace(/^\uFEFF/,'').trim().split(/\r?\n/);
    if (lines.length<2) return [];
    var headers=splitCsvLine(lines[0]);
    return lines.slice(1).filter(Boolean).map(function(line){
      var values=splitCsvLine(line), row={};
      headers.forEach(function(h,i){row[h.trim()]=(values[i]||'').trim();});
      return row;
    });
  }
  function fetchCsv(path) {
    return fetch(path+'?questions=v2').then(function(r){
      if(!r.ok) throw new Error(path+' HTTP '+r.status);
      return r.text();
    }).then(parseCsv);
  }
  function loadRows(paths) {
    return Promise.all(paths.map(fetchCsv)).then(function(groups){return [].concat.apply([],groups);});
  }
  function seededShuffle(items,seed) {
    var list=items.slice(), x=(seed>>>0)||1;
    function next(){x^=x<<13;x^=x>>>17;x^=x<<5;return (x>>>0)/4294967296;}
    for(var i=list.length-1;i>0;i--){var j=Math.floor(next()*(i+1));var t=list[i];list[i]=list[j];list[j]=t;}
    return list;
  }
  function normalizeWordRows(rows) {
    return rows.map(function(row){row.id=Number(row.id);row.level=Number(row.level);return row;}).sort(function(a,b){return a.id-b.id;});
  }
  function enrichmentMap(rows){var map={};rows.forEach(function(row){map[Number(row.id)]=row;});return map;}
  function eligiblePosWord(word,extra){return !!(POS_LABELS[word.partOfSpeech] && extra && extra.example && extra.example.toLowerCase().indexOf(word.word.toLowerCase())!==-1);}
  function chooseByLevel(words,extras,target,predicate){
    var candidates=words.filter(function(word){return word.id>=target.minId&&word.id<=target.maxId&&predicate(word,extras[word.id]);});
    candidates=seededShuffle(candidates,target.level*1009+target.count);
    if(candidates.length<target.count) throw new Error(target.level+'分题目候选不足：需要'+target.count+'，只有'+candidates.length);
    return candidates.slice(0,target.count);
  }
  function buildPosQuestions(words,extras){
    var questions=[],qid=1;
    LEVEL_TARGETS.forEach(function(target){
      chooseByLevel(words,extras,target,eligiblePosWord).forEach(function(word){
        var extra=extras[word.id], answer=POS_LABELS[word.partOfSpeech];
        questions.push({id:qid++,type:'pos',level:target.level,relatedWordId:word.id,relatedWord:word.word,sentence:extra.example,sentenceTranslation:extra.exampleTranslation||'',prompt:'句中“'+word.word+'”是什么词性？',options:seededShuffle(POS_OPTIONS,word.id*37+target.level),answer:answer,explanation:'在这个句子中，“'+word.word+'”作'+answer+'使用。'});
      });
    });
    return questions;
  }
  function parseCollocations(text){
    if(!text) return [];
    return text.split('|').map(function(piece){
      piece=piece.trim(); if(!piece)return null;
      var eq=piece.indexOf('=');
      return eq<0?{phrase:piece,meaning:''}:{phrase:piece.slice(0,eq).trim(),meaning:piece.slice(eq+1).trim()};
    }).filter(Boolean);
  }
  function eligibleCollocationWord(word,extra){return !!(extra&&parseCollocations(extra.collocations).length);}

  function usageNote(word, phrase) {
    var parts=phrase.trim().split(/\s+/);
    var lower=word.word.toLowerCase();
    var idx=-1;
    for(var i=0;i<parts.length;i++) if(parts[i].toLowerCase().replace(/[^a-z-]/g,'')===lower){idx=i;break;}
    var structure=parts.join(' + ');
    if(idx===0 && word.partOfSpeech==='v.') return '结构：'+structure+'。这里以“'+word.word+'”为动词核心，后面的成分与它一起作为固定搭配记忆。';
    if(idx===0 && word.partOfSpeech==='adj.') return '结构：'+structure+'。这里以“'+word.word+'”为形容词核心，注意它后面连接的词或介词。';
    if(idx===0 && word.partOfSpeech==='n.') return '结构：'+structure+'。这里以“'+word.word+'”开头构成固定名词搭配，建议整体记忆。';
    if(idx>0 && word.partOfSpeech==='n.') return '结构：'+structure+'。“'+word.word+'”在这里是名词核心的一部分，前面的词与它组成固定表达。';
    return '结构：'+structure+'。建议把整个表达作为一个固定单位记忆，并特别注意“'+word.word+'”前后连接的词。';
  }

  function buildCollocationQuestions(words,extras){
    var questions=[],qid=1;
    LEVEL_TARGETS.forEach(function(target){
      chooseByLevel(words,extras,target,eligibleCollocationWord).forEach(function(word){
        var extra=extras[word.id];
        var collocations=parseCollocations(extra.collocations);
        var correct=collocations[(word.id+target.level)%collocations.length];
        questions.push({
          id:qid++,type:'collocation',level:target.level,relatedWordId:word.id,relatedWord:word.word,
          prompt:correct.phrase,answer:correct.phrase,answerMeaning:correct.meaning,
          sentence:extra.example||'',sentenceTranslation:extra.exampleTranslation||'',
          usage:usageNote(word,correct.phrase),
          explanation:correct.meaning?correct.phrase+'：'+correct.meaning:'固定搭配：'+correct.phrase
        });
      });
    });
    return questions;
  }
  function validateBank(bank){
    if(bank.pos.length!==400)throw new Error('词性题数量错误：'+bank.pos.length);
    if(bank.collocation.length!==400)throw new Error('搭配题数量错误：'+bank.collocation.length);
    [400,600,700].forEach(function(level){
      var expected=level===700?100:150;
      if(bank.pos.filter(function(q){return q.level===level;}).length!==expected)throw new Error(level+'分词性题数量错误');
      if(bank.collocation.filter(function(q){return q.level===level;}).length!==expected)throw new Error(level+'分搭配题数量错误');
    });
    return bank;
  }
  function load(){
    return Promise.all([loadRows(WORD_FILES),loadRows(ENRICHMENT_FILES)]).then(function(result){
      var words=normalizeWordRows(result[0]),extras=enrichmentMap(result[1]);
      return validateBank({version:2,pos:buildPosQuestions(words,extras),collocation:buildCollocationQuestions(words,extras)});
    });
  }
  global.TOEIC_QUESTION_BANK={load:load,targets:{400:150,600:150,700:100}};
})(window);

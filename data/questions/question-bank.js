(function (global) {
  'use strict';

  var WORD_FILES = [
    'data/400/words-001-100.csv',
    'data/400/words-101-200.csv',
    'data/400/words-201-300.csv',
    'data/400/words-301-400.csv',
    'data/600/words-401-500.csv',
    'data/600/words-501-600.csv',
    'data/600/words-601-700.csv',
    'data/600/words-701-750.csv',
    'data/700/words-751-850.csv',
    'data/700/words-851-950.csv',
    'data/700/words-951-1000.csv'
  ];

  var ENRICHMENT_FILES = [
    'data/enrichment/words-001-100.csv',
    'data/enrichment/words-101-200.csv',
    'data/enrichment/words-201-300.csv',
    'data/enrichment/words-301-400.csv',
    'data/enrichment/words-401-500.csv',
    'data/enrichment/words-501-600.csv',
    'data/enrichment/words-601-700.csv',
    'data/enrichment/words-701-750.csv',
    'data/enrichment/words-751-850.csv',
    'data/enrichment/words-851-950.csv',
    'data/enrichment/words-951-1000.csv'
  ];

  var LEVEL_TARGETS = [
    { level: 400, minId: 1, maxId: 400, count: 150 },
    { level: 600, minId: 401, maxId: 750, count: 150 },
    { level: 700, minId: 751, maxId: 1000, count: 100 }
  ];

  var POS_LABELS = {
    'n.': '名词',
    'v.': '动词',
    'adj.': '形容词',
    'adv.': '副词'
  };
  var POS_OPTIONS = ['名词', '动词', '形容词', '副词'];

  function splitCsvLine(line) {
    var out = [], cell = '', quoted = false;
    for (var i = 0; i < line.length; i++) {
      var c = line[i];
      if (c === '"') {
        if (quoted && line[i + 1] === '"') { cell += '"'; i++; }
        else quoted = !quoted;
      } else if (c === ',' && !quoted) {
        out.push(cell); cell = '';
      } else {
        cell += c;
      }
    }
    out.push(cell);
    return out;
  }

  function parseCsv(text) {
    var lines = text.replace(/^\uFEFF/, '').trim().split(/\r?\n/);
    if (lines.length < 2) return [];
    var headers = splitCsvLine(lines[0]);
    return lines.slice(1).filter(Boolean).map(function (line) {
      var values = splitCsvLine(line), row = {};
      headers.forEach(function (header, index) {
        row[header.trim()] = (values[index] || '').trim();
      });
      return row;
    });
  }

  function fetchCsv(path) {
    return fetch(path + '?questions=v1').then(function (response) {
      if (!response.ok) throw new Error(path + ' HTTP ' + response.status);
      return response.text();
    }).then(parseCsv);
  }

  function loadRows(paths) {
    return Promise.all(paths.map(fetchCsv)).then(function (groups) {
      return [].concat.apply([], groups);
    });
  }

  function seededShuffle(items, seed) {
    var list = items.slice();
    var x = (seed >>> 0) || 1;
    function next() {
      x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
      return (x >>> 0) / 4294967296;
    }
    for (var i = list.length - 1; i > 0; i--) {
      var j = Math.floor(next() * (i + 1));
      var temp = list[i]; list[i] = list[j]; list[j] = temp;
    }
    return list;
  }

  function normalizeWordRows(rows) {
    return rows.map(function (row) {
      row.id = Number(row.id);
      row.level = Number(row.level);
      return row;
    }).sort(function (a, b) { return a.id - b.id; });
  }

  function enrichmentMap(rows) {
    var map = {};
    rows.forEach(function (row) { map[Number(row.id)] = row; });
    return map;
  }

  function eligiblePosWord(word, extra) {
    if (!POS_LABELS[word.partOfSpeech]) return false;
    if (!extra || !extra.example) return false;
    var sentence = extra.example.toLowerCase();
    var target = word.word.toLowerCase();
    return sentence.indexOf(target) !== -1;
  }

  function chooseByLevel(words, extras, target, predicate) {
    var candidates = words.filter(function (word) {
      return word.id >= target.minId && word.id <= target.maxId && predicate(word, extras[word.id]);
    });
    candidates = seededShuffle(candidates, target.level * 1009 + target.count);
    if (candidates.length < target.count) {
      throw new Error(target.level + '分题目候选不足：需要' + target.count + '，只有' + candidates.length);
    }
    return candidates.slice(0, target.count);
  }

  function buildPosQuestions(words, extras) {
    var questions = [], qid = 1;
    LEVEL_TARGETS.forEach(function (target) {
      var selected = chooseByLevel(words, extras, target, eligiblePosWord);
      selected.forEach(function (word) {
        var extra = extras[word.id];
        var answer = POS_LABELS[word.partOfSpeech];
        var options = seededShuffle(POS_OPTIONS, word.id * 37 + target.level);
        questions.push({
          id: qid++,
          type: 'pos',
          level: target.level,
          relatedWordId: word.id,
          relatedWord: word.word,
          sentence: extra.example,
          sentenceTranslation: extra.exampleTranslation || '',
          prompt: '句中“' + word.word + '”是什么词性？',
          options: options,
          answer: answer,
          explanation: '在这个句子中，“' + word.word + '”作' + answer + '使用。'
        });
      });
    });
    return questions;
  }

  function parseCollocations(text) {
    if (!text) return [];
    return text.split('|').map(function (piece) {
      piece = piece.trim();
      if (!piece) return null;
      var eq = piece.indexOf('=');
      if (eq < 0) return { phrase: piece, meaning: '' };
      return {
        phrase: piece.slice(0, eq).trim(),
        meaning: piece.slice(eq + 1).trim()
      };
    }).filter(Boolean);
  }

  function eligibleCollocationWord(word, extra) {
    return !!(extra && parseCollocations(extra.collocations).length);
  }

  function buildCollocationPool(words, extras) {
    var pool = [];
    words.forEach(function (word) {
      var extra = extras[word.id];
      parseCollocations(extra && extra.collocations).forEach(function (item) {
        pool.push({
          wordId: word.id,
          word: word.word,
          phrase: item.phrase,
          meaning: item.meaning
        });
      });
    });
    return pool;
  }

  function distractorCollocations(pool, correct, word, seed) {
    var candidates = pool.filter(function (item) {
      return item.wordId !== word.id && item.phrase !== correct.phrase;
    });
    candidates = seededShuffle(candidates, seed);
    var result = [], used = {};
    used[correct.phrase.toLowerCase()] = true;
    for (var i = 0; i < candidates.length && result.length < 3; i++) {
      var key = candidates[i].phrase.toLowerCase();
      if (!used[key]) {
        used[key] = true;
        result.push(candidates[i]);
      }
    }
    return result;
  }

  function buildCollocationQuestions(words, extras) {
    var questions = [], qid = 1;
    var pool = buildCollocationPool(words, extras);
    LEVEL_TARGETS.forEach(function (target) {
      var selected = chooseByLevel(words, extras, target, eligibleCollocationWord);
      selected.forEach(function (word) {
        var collocations = parseCollocations(extras[word.id].collocations);
        var correct = collocations[(word.id + target.level) % collocations.length];
        var wrong = distractorCollocations(pool, correct, word, word.id * 101 + target.level);
        if (wrong.length < 3) throw new Error('搭配干扰项不足：' + word.word);
        var optionObjects = [{ phrase: correct.phrase, meaning: correct.meaning }].concat(wrong.map(function (item) {
          return { phrase: item.phrase, meaning: item.meaning };
        }));
        optionObjects = seededShuffle(optionObjects, word.id * 53 + target.level);
        questions.push({
          id: qid++,
          type: 'collocation',
          level: target.level,
          relatedWordId: word.id,
          relatedWord: word.word,
          prompt: '下面哪一个是“' + word.word + '”的常用搭配？',
          options: optionObjects.map(function (item) { return item.phrase; }),
          answer: correct.phrase,
          answerMeaning: correct.meaning,
          explanation: correct.meaning ? correct.phrase + '：' + correct.meaning : '正确搭配是 ' + correct.phrase + '。'
        });
      });
    });
    return questions;
  }

  function validateBank(bank) {
    if (bank.pos.length !== 400) throw new Error('词性题数量错误：' + bank.pos.length);
    if (bank.collocation.length !== 400) throw new Error('搭配题数量错误：' + bank.collocation.length);
    [400, 600, 700].forEach(function (level) {
      var expected = level === 700 ? 100 : 150;
      var posCount = bank.pos.filter(function (q) { return q.level === level; }).length;
      var colCount = bank.collocation.filter(function (q) { return q.level === level; }).length;
      if (posCount !== expected) throw new Error(level + '分词性题数量错误：' + posCount);
      if (colCount !== expected) throw new Error(level + '分搭配题数量错误：' + colCount);
    });
    return bank;
  }

  function load() {
    return Promise.all([loadRows(WORD_FILES), loadRows(ENRICHMENT_FILES)]).then(function (result) {
      var words = normalizeWordRows(result[0]);
      var extras = enrichmentMap(result[1]);
      return validateBank({
        version: 1,
        pos: buildPosQuestions(words, extras),
        collocation: buildCollocationQuestions(words, extras)
      });
    });
  }

  global.TOEIC_QUESTION_BANK = {
    load: load,
    targets: { 400: 150, 600: 150, 700: 100 }
  };
})(window);

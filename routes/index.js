function concatDefinitions(definitions) {
  var concat = "";

  for (var i = 0; i + 1 < definitions.length; i++) {
    concat += definitions[i] + "|";
  }

  if (definitions.length > 0) {
    concat += definitions[definitions.length - 1];
  }

  return concat;
}

var express = require('express');
var router = express.Router();
const sqlite3 = require('sqlite3').verbose();

let db = new sqlite3.Database('./db/vocab.db', (err) => {
  if (err) {
    console.error(err.message);
  } else {
    console.log('Connected to the vocab database.');
  }
});

db.exec(`
CREATE TABLE IF NOT EXISTS FrequencyReports (
  Word TEXT NOT NULL,
  Frequency INTEGER,
  Timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS PinyinAndDefinitions (
  Word TEXT NOT NULL,
  Pinyin TEXT NOT NULL,
  Definition TEXT,
  PRIMARY KEY (Word, Pinyin)
);

CREATE TABLE IF NOT EXISTS HanVietDictionary (
  Character TEXT NOT NULL PRIMARY KEY,
  HanViet TEXT NOT NULL
);
`);

/* GET home page. */
router.get('/', function(req, res, next) {
  db.all(`SELECT Word, Definition, SUM(Frequency) AS Frequency
          FROM FrequencyReports
          GROUP BY Word
          ORDER BY Frequency DESC
          LIMIT 10`, [], (err, topWords) => {
      if (err) {
        throw err;
      }
      const randomIndex = Math.floor(Math.random() * topWords.length);
      res.render('index', {
        // word: topWords[randomIndex].Word
        words: [{
          simplified: ['尴', '尬', '车'],
          traditional: ['尷', '', '車'],
          hanviet: ['[xuất, xúy]', '[tô]', '[xa]'],
          pinyinAndDefinitions: [{
            pinyin: ['chū', 'zū', 'chē'],
            definition: 'finish/ complete'
          }, {
            pinyin: ['chū', 'zū', 'chē'],
            definition: 'a particle of a sentence that implies past tense or completion of something'
          }]
        }, {
          simplified: ['天', '下'],
          traditional: ['天', '下'],
          hanviet: ['[thiên]', '[hạ, há]'],
          pinyinAndDefinitions: [{
            pinyin: ['tiān', 'xià'],
            definition: 'the world'
          }]
        }]
      });
    });
});

router.post('/freqreport', function(req, res) {
  // request body sample: [{"word":"罢了 [罷-]","frequency":1,"lastLookupTime":1584873114918,
  // "pinyinAndDefinition":[{"pinyin":"bàle","definition":["a modal particle indicating (that's all, only, nothing much)"]}]}
  console.log(req.body);
  var frequencyReport = req.body;

  frequencyReport.forEach(function(item) {
    db.run("INSERT INTO FrequencyReports (Word, Frequency, Timestamp) VALUES (?, ?, ?)",
            item.word,
            item.frequency,
            item.lastLookupTime);

    item.pinyinAndDefinition.forEach(function(pyAndDef) {
      db.run("INSERT OR IGNORE INTO PinyinAndDefinitions (Word, Pinyin, Definition) VALUES (?, ?, ?)",
              item.word,
              pyAndDef.pinyin,
              concatDefinitions(pyAndDef.definition));
    });
  });

  res.send('Acknowledged.');
});

router.post('/hvreport', function(req, res) {
  // request body sample: {"内":"nội, nạp","向":"hướng"}
  console.log(req.body);
  var hanvietReport = req.body;

  for (const character of Object.keys(hanvietReport)) {
    db.run("INSERT OR IGNORE INTO HanVietDictionary (Character, HanViet) VALUES (?, ?)",
            character,
            hanvietReport[character]);
  }

  res.send('Acknowledged.');
});

module.exports = router;

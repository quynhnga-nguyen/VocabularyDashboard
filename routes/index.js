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

function getHanViet(word) {
  var characters = [];
  for (var i = 0; i < word.length; i++) {
    characters.push(word[i]);
  }

  db.all(`SELECT HanViet, Character FROM HanVietDictionary
          WHERE Character IN (?)`,
        [characters.toString()], (err, items) => {
          if (err) {
            throw err;
          }

          var hanvietDictionary = {};
          items.forEach(function(item) {
            hanviet[item.Character] = item.HanViet;
          });

          return hanvietDictionary;
        });
}

function aggregate(words) {
  var wordList = [];

  words.forEach(function(word) {
    var pyAndDef = {
      "pinyin": word.Pinyin,
      "definition": word.Definition
    };

    var item = wordList.find(item => item.word === word.Word);
    if (item) {
      item.pinyinAndDefinition.push(pyAndDef);
    } else {
      wordList.push({
        "word": word.Word,
        "pinyinAndDefinition": [pyAndDef]
      });
    }
  });

  return wordList;
}

function getTodayWords() {
  var timeRangeInSeconds = 24 * 60 * 60 * 1000; // one day
  var query = function(resolve, reject) {
    db.all(`SELECT DISTINCT FrequencyReports.Word, Pinyin, Definition 
              FROM FrequencyReports
              INNER JOIN PinyinAndDefinitions
              ON FrequencyReports.Word = PinyinAndDefinitions.Word
              WHERE Timestamp > (date('now') - ?);`,
              [timeRangeInSeconds], (err, items) => {
                if (err) {
                  reject(err);
                } else {
                  resolve(items);
                }
              })
  };

  return (new Promise(query))
          .then(aggregate);
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
  (async() => {
    var todayWords = await getTodayWords();
    res.render('index', { words: todayWords });
  })();
});

router.post('/freqreport', function(req, res) {
  // request body sample: [{"word":"罢了 [罷-]","frequency":1,"lastLookupTime":1584873114918,
  // "pinyinAndDefinition":[{"pinyin":"bàle","definition":["a modal particle indicating (that's all, only, nothing much)"]}]}
  // console.log(req.body);
  var frequencyReport = req.body;

  frequencyReport.forEach(function(item) {
    db.run("INSERT INTO FrequencyReports (Word, Frequency, Timestamp) VALUES (?, ?, ?);",
            item.word,
            item.frequency,
            item.lastLookupTime);

    item.pinyinAndDefinition.forEach(function(pyAndDef) {
      db.run("INSERT OR IGNORE INTO PinyinAndDefinitions (Word, Pinyin, Definition) VALUES (?, ?, ?);",
              item.word,
              pyAndDef.pinyin,
              concatDefinitions(pyAndDef.definition));
    });
  });

  res.send('Acknowledged.');
});

router.post('/hvreport', function(req, res) {
  // request body sample: {"内":"nội, nạp","向":"hướng"}
  // console.log(req.body);
  var hanvietReport = req.body;

  for (const character of Object.keys(hanvietReport)) {
    db.run("INSERT OR IGNORE INTO HanVietDictionary (Character, HanViet) VALUES (?, ?);",
            character,
            hanvietReport[character]);
  }

  res.send('Acknowledged.');
});

module.exports = router;

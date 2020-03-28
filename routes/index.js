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

async function getHanViet(words) {
  var characters = [];
  words.forEach(function(word) {
    for (var i = 0; i < word.Word.length && word.Word[i] != ' '; i++) {
      characters.push(word.Word[i]);
    }
  });

  var sql = "SELECT HanViet, Character FROM HanVietDictionary WHERE Character IN ("
                + characters.map(function() { return "?" }).join(",")
                + ")";

  var query = function(resolve, reject) {
    db.all(
      sql, characters, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
  };

  var rows = await new Promise(query);
  var hanvietDictionary = {};
  rows.forEach(function(row) {
    hanvietDictionary[row.Character] = row.HanViet;
  });

  return hanvietDictionary;
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
      item.pinyinAndDefinitions.push(pyAndDef);
    } else {
      wordList.push({
        "word": word.Word,
        "pinyinAndDefinitions": [pyAndDef]
      });
    }
  });

  return wordList;
}

async function getTodayWords() {
  const TIME_RANGE_IN_SECONDS = 24 * 60 * 60 * 1000; // one day
  var query = function(resolve, reject) {
    db.all(`SELECT DISTINCT FrequencyReports.Word, Pinyin, Definition 
            FROM FrequencyReports
            LEFT JOIN IgnoredWords
            ON FrequencyReports.Word = IgnoredWords.Word
            INNER JOIN PinyinAndDefinitions
            ON FrequencyReports.Word = PinyinAndDefinitions.Word
            WHERE IgnoredWords.Word IS NULL AND Timestamp > (date('now') - ?);`,
            [TIME_RANGE_IN_SECONDS], (err, rows) => {
              if (err) {
                reject(err);
              } else {
                resolve(rows);
              }
            });
  };

  var rows = await new Promise(query);

  return {
    "words": aggregate(rows),
    "hanviet": await getHanViet(rows),
  };
}

async function getRandomWords() {
  const RANDOM_WORDS_PER_DAY = 100;
  const HIGH_FREQUENCY = 2;
  const HIGH_FREQUENCY_SELECTION_RATIO = 0.5;

  var numberOfHighFreqWords = RANDOM_WORDS_PER_DAY * HIGH_FREQUENCY_SELECTION_RATIO;
  var numberOfLowFreqWords = RANDOM_WORDS_PER_DAY - numberOfHighFreqWords;

  var query = function(resolve, reject) {
    db.all(`SELECT RandomWords.Word, Pinyin, Definition
            FROM (
              SELECT * FROM (
                SELECT FrequencyReports.Word, count(Frequency) AS TotalFrequency
                FROM FrequencyReports
                LEFT JOIN IgnoredWords
                ON FrequencyReports.Word = IgnoredWords.Word
                GROUP BY FrequencyReports.Word
                HAVING TotalFrequency >= ? AND IgnoredWords.Word IS NULL
                ORDER BY RANDOM() LIMIT ?
              )
              UNION ALL
              SELECT * FROM (
                SELECT FrequencyReports.Word, count(Frequency) AS TotalFrequency
                FROM FrequencyReports
                LEFT JOIN IgnoredWords
                ON FrequencyReports.Word = IgnoredWords.Word
                GROUP BY FrequencyReports.Word
                HAVING TotalFrequency < ? AND IgnoredWords.Word IS NULL
                ORDER BY RANDOM() LIMIT ?
              )
            ) RandomWords
            INNER JOIN PinyinAndDefinitions
            ON RandomWords.Word = PinyinAndDefinitions.Word;`,
            [HIGH_FREQUENCY, numberOfHighFreqWords, HIGH_FREQUENCY, numberOfLowFreqWords],
            (err, rows) => {
              if (err) {
                reject(err);
              } else {
                resolve(rows);
              }
            });
  };

  var rows = await new Promise(query);

  return {
    "words": aggregate(rows),
    "hanviet": await getHanViet(rows),
  };
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

  CREATE TABLE IF NOT EXISTS IgnoredWords (
    Word TEXT NOT NULL PRIMARY KEY
  );
`);

/* GET home page. */
router.get('/', function(req, res, next) {
  (async() => {
    var todayWords = await getTodayWords();
    var randomWords = await getRandomWords();
    res.render('index',
                {
                  "words": todayWords.words.concat(randomWords.words),
                  "hanviet": Object.assign({}, todayWords.hanviet, randomWords.hanviet),
                });
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

router.post('/toBeIgnored', function(req, res) {
  // request body sample: "罢了 [罷-]"
  // console.log(req.body);
  var word = req.body["word"];
  db.run("INSERT INTO IgnoredWords (Word) VALUES (?);", word);
  res.send('Acknowledged.');
});

module.exports = router;

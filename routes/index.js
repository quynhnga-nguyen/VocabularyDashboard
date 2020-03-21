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

CREATE TABLE IF NOT EXISTS HanVietDictionary (
  Character TEXT NOT NULL,
  HanViet TEXT NOT NULL
);
`)

/* GET home page. */
router.get('/', function(req, res, next) {
  // Selecting a random top word from FrequencyReports and display.
  // TODO: Improve the query, make it a bit more sophisticated, for
  // example, giving the words from the last day more weight than
  // the days prior.
  db.all(`SELECT Word, SUM(Frequency) AS Frequency
          FROM FrequencyReports
          GROUP BY Word
          ORDER BY Frequency DESC
          LIMIT 10`, [], (err, topWords) => {
      if (err) {
        throw err;
      }
      const randomIndex = Math.floor(Math.random() * topWords.length);
      res.render('index', { word: topWords[randomIndex].Word });
    });
});

router.post('/freqreport', function(req, res) {
  // {"传 [傳]":{"frequency":1,"lastLookupTime":1584261521895},"山楂":{"frequency":1,"lastLookupTime":1584261596686}}
  console.log(req.body);
  var frequencyReport = req.body;

  for (const word of Object.keys(frequencyReport)) {
      var command = "INSERT INTO FrequencyReports (Word, Frequency, Timestamp) VALUES ('"
                    + word + "', "
                    + frequencyReport[word].frequency + ", "
                    + frequencyReport[word].lastLookupTime + ");"
      db.exec(command)
  }

  res.send('Acknowledged.');
});

router.post('/hvreport', function(req, res) {
  // {"内":"nội, nạp","向":"hướng"}
  console.log(req.body);
  var hanvietReport = req.body;

  for (const character of Object.keys(hanvietReport)) {
      var command = "INSERT OR IGNORE INTO HanVietDictionary (Character, HanViet) VALUES ('"
                    + character + "', '"
                    + hanvietReport[character] + "');"
      db.exec(command)
  }

  res.send('Acknowledged.');
});

module.exports = router;

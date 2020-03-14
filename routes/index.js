var express = require('express');
var router = express.Router();
const sqlite3 = require('sqlite3').verbose();
let db = new sqlite3.Database(':memory:');
db.exec(`
CREATE TABLE IF NOT EXISTS FrequencyReports (
  Word TEXT NOT NULL,
  Frequency INTEGER,
  Timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO FrequencyReports (Word, Frequency) VALUES ('出租车', 100);
INSERT INTO FrequencyReports (Word, Frequency) VALUES ('新冠病毒', 100);
`)

/* GET home page. */
router.get('/', function(req, res, next) {
  // Selecting a random top word from FrequencyReports and display.
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
  // TODO: Insert to FrequencyReports table here.
  res.send('POST request: ' + JSON.stringify(req.body));
});

module.exports = router;

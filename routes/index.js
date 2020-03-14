var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

router.post('/freqreport', function(req, res) {
  res.send('POST request: ' + JSON.stringify(req.body));
});

module.exports = router;

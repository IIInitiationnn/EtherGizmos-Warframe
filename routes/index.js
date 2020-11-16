var express = require('express');
var router = express.Router();

var Properties = undefined;

/* GET home page. */
router.get('/', function(req, res, next) {
    res.render('pages/index', Properties);
});

router.get('/discord', function(req, res, next) {
    res.redirect('https://discord.gg/DaVR72X');
});

module.exports.Router = router;


function SetProperties(properties) {
    Properties = properties;
}
module.exports.SetProperties = SetProperties;
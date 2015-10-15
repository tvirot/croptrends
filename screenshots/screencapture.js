// Call /Applications/phantomjs screencapture.js

var page = require('webpage').create();
page.viewportSize = {
  width: 1280*2,
  height: 1000*2
};
page.zoomFactor = 2;
// file:///Users/clertvic/playground/index.html
page.open('http://localhost:8080/', function() {
  var filename = (new Date()).toISOString().substring(0,16).replace(/:/g, '-');
  window.setTimeout(function () {
    page.render(filename + '.png');
    phantom.exit();
  }, 30000);
});

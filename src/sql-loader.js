// Initialize SQL.js and make it available globally
(function() {
  // Store a reference to the original initSqlJs function
  var originalInitSqlJs = initSqlJs;
  
  // Configuration for sql.js
  var config = {
    locateFile: function(filename) {
      return 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/' + filename;
    }
  };
  
  // Replace with our wrapper function
  window.initSqlJs = function() {
    return new Promise(function(resolve, reject) {
      try {
        // Call the original function with our config
        originalInitSqlJs(config).then(resolve).catch(reject);
      } catch (err) {
        reject(err);
      }
    });
  };
})(); 
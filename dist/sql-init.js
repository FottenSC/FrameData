// Initialize SQL.js configuration globally
window.SQL = {
  locateFile: function(filename) {
    return 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/' + filename;
  }
}; 
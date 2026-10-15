// Pacific Wallpapers - browser count backend
//
// Setup:
// 1. Create a plain text file in your Google Drive (its content should be
//    just a number, e.g. "0"). Open it once and note its file ID from the
//    URL: https://drive.google.com/file/d/FILE_ID_HERE/view
// 2. Go to https://script.google.com, create a new project, paste this file
//    in as Code.gs, and set FILE_ID below to that file ID.
// 3. Deploy > New deployment > type "Web app".
//    - Execute as: Me
//    - Who has access: Anyone
// 4. Copy the resulting /exec URL and paste it into js/config.js as
//    BROWSER_COUNT_URL.
//
// Endpoints (both are simple GET requests so the extension can call them
// with fetch()):
//   GET  {url}                  -> { "count": <current number> }
//   GET  {url}?action=increment -> increments by 1, returns the new number

var FILE_ID = "YOUR_DRIVE_FILE_ID_HERE";

function doGet(e) {
  var action = (e.parameter.action || "").toLowerCase();
  var file = DriveApp.getFileById(FILE_ID);

  if (action === "increment") {
    var lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      var current = parseInt(file.getBlob().getDataAsString().trim(), 10) || 0;
      var next = current + 1;
      file.setContent(String(next));
    } finally {
      lock.releaseLock();
    }
    return respond({ count: next });
  }

  var count = parseInt(file.getBlob().getDataAsString().trim(), 10) || 0;
  return respond({ count: count });
}

function respond(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('Page')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getAvailableSlots(date) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Availability");
  var data = sheet.getDataRange().getValues();
  var availableSlots = [];

  for (var i = 1; i < data.length; i++) {
    var sheetDate = new Date(data[i][0]);
    sheetDate.setHours(0, 0, 0, 0);
    var inputDate = new Date(date);
    inputDate.setHours(0, 0, 0, 0);

    if (sheetDate.getTime() === inputDate.getTime() && data[i][4] === "Available") {
      availableSlots.push({
        startTime: Utilities.formatDate(new Date(data[i][1]), Session.getScriptTimeZone(), "HH:mm"),
        endTime: Utilities.formatDate(new Date(data[i][2]), Session.getScriptTimeZone(), "HH:mm"),
        panelMemberEmail: data[i][3]
      });
    }
  }

  return availableSlots;
}

function bookInterview(candidateName, candidateEmail, date, startTime, endTime, panelMemberEmail) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Availability");
  var data = sheet.getDataRange().getValues();

  // Check if the user already has a booked slot
  for (var j = 1; j < data.length; j++) {
    if (data[j][6] === candidateEmail && data[j][5] === "Booked") {
      return {
        success: false,
        message: 'You have already booked an interview slot.'
      };
    }
  }

  var calendar = CalendarApp.getDefaultCalendar();
  var timeZone = Session.getScriptTimeZone();
  var parsedDate = new Date(date);
  parsedDate.setHours(0, 0, 0, 0);

  for (var i = 1; i < data.length; i++) {
    var sheetDate = new Date(data[i][0]);
    sheetDate.setHours(0, 0, 0, 0);

    if (sheetDate.getTime() === parsedDate.getTime() &&
        Utilities.formatDate(new Date(data[i][1]), timeZone, "HH:mm") === startTime &&
        Utilities.formatDate(new Date(data[i][2]), timeZone, "HH:mm") === endTime &&
        data[i][4] === "Available") {

      var lock = LockService.getScriptLock();
      try {
        lock.waitLock(30000);
        if (sheet.getRange(i + 1, 5).getValue() === "Available") {
          sheet.getRange(i + 1, 5).setValue("Booked");
          sheet.getRange(i + 1, 6).setValue(candidateEmail);

          var event = calendar.createEvent('Interview with ' + candidateName, 
                                           new Date(date + ' ' + startTime), 
                                           new Date(date + ' ' + endTime), {
                                             guests: candidateEmail + ',' + panelMemberEmail,
                                             sendUpdates: 'all'
                                           });

          return {
            success: true,
            message: 'Booking successful. Calendar event created.'
          };
        } else {
          return {
            success: false,
            message: 'This slot has just been booked by someone else.'
          };
        }
      } catch (e) {
        Logger.log('Error while trying to lock the sheet for booking: ' + e);
        return {
          success: false,
          message: 'Could not process your request. Error: ' + e.message
        };
      } finally {
        lock.releaseLock();
      }
    }
  }

  return {
    success: false,
    message: 'Unable to book the slot. It may no longer be available.'
  };
}

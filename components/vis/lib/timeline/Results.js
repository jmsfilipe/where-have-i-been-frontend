var Emitter = require('emitter-component');
var Hammer = require('../module/hammer');
var util = require('../util');
var DataSet = require('../DataSet');
var DataView = require('../DataView');
var Range = require('./Range');
var Core = require('./Core');
var TimeAxis = require('./component/TimeAxis');
var CurrentTime = require('./component/CurrentTime');
var CustomTime = require('./component/CustomTime');
var ItemSet = require('./component/ItemSet');
var Timeline = require('./Timeline');
var Map = require('./Map');

// Make the function wait until the connection is made...
function waitForSocketConnection(socket, callback) {
    setTimeout(
        function() {
            if (socket.readyState === 1) {
                console.log("Connection is made")
                if (callback != null) {
                    callback();
                }
                return;

            } else {
                console.log("wait for connection...")
                waitForSocketConnection(socket, callback);
            }

        }, 5); // wait 5 milisecond for the connection...
}

Results.prototype.sendMessage = function(msg) {
    // Wait until the state of the socket is not ready and send the message when it is...
    var me = this;
    waitForSocketConnection(this.ws, function() {
        console.log("message sent!!!");
        me.ws.send(msg);
    });
}

globalMapData = null;

var firstTime = true;
var firstTime2 = true;
function Results() {
    this.highlightedResults = [];
    this.globalMapData = null;
    var me = this;
    this.ws = new WebSocket("ws://localhost:8888/");
    this.itemSet;

    this.ws.onopen = function() {
      me.map = new Map();

        console.log("server connected");
        if(firstTime){
        
        $("#message").hide();

        me.sendLocationNamesRequest();

$('#importCategoryButton').on('click', function(e){ //hack to change the css style of the input file
        e.preventDefault()
        $("#importCategoryInput").trigger('click')
    });

        document.getElementById('importCategoryInput').addEventListener('change', uploadCategory, false);

        document.getElementById('exportCategoryButton').addEventListener('click', exportCategory, false);

        document.getElementById('newCategoryButton').addEventListener('click', newCategory, false);

$('#importPlaceButton').on('click', function(e){ //hack to change the css style of the input file
        e.preventDefault()
        $("#importPlaceInput").trigger('click')
    });

        document.getElementById('importPlaceInput').addEventListener('change', uploadPlace, false);

        document.getElementById('exportPlaceButton').addEventListener('click', exportPlace, false);

        document.getElementById('newPlaceButton').addEventListener('click', newPlace, false);


        document.getElementById('saveButton').addEventListener('click', me.saveSettings.bind(me), false);
        firstTime = false;
      }

    };

    $(document.getElementById("results")).resizable({
        handles: 'e',
        resize: function( event, ui ) {me.map.resizeMap()}
    });
    this.ws.onmessage = function(evt) {
        $("#message").hide();
        var obj = JSON.parse(evt.data);

        switch (obj.message) {
            case "query colapsable results":
                var size = obj.size
                me.addColapsableResult(obj.data, size);
                break;
            case "query colapsed results":
                me.addColapsedResult(obj.data);
                break;
            case "map result":
                me.map.loadJson(obj.data);
                break;
            case "location result":
                me.map.highlightLocation(obj.data);
                break;
            case "route result":
                me.map.highlightRoute(obj.data);
                break;
            case "empty query":
                me.showNoResults();
                break;
            case "location names result":
                me.updateLocationNames(obj.data);
                me.loadSettingsFromDatabase();
                break;
            case "map data":
                me.map.mapView(obj.data);
                break;
            case "global map data":
                globalMapData = obj.data;
                me.globalMapView(obj.data);
                break;
            case "settings result":

     
                  updateSettings(obj.data);
                  if(Object.keys(util.categoriesPlaces).length  == 0 || Object.keys(util.categoriesColors).length  == 0)
                    me.updateLocationSettings();
                  else{
                    updateTables();
                  }
  
                break;
        }

    };

}




Results.prototype.globalMapView = function(data) {

    this.map.mapView(data);

};

Results.prototype.addSet = function(set) {
    this.itemSet = set;

};

Results.prototype.unselectResult = function(id) {

    var index = this.highlightedResults.indexOf(id);
    if (index > -1) {
        this.highlightedResults.splice(index, 1);
    }

    if (this.highlightedResults.length == 0)
        this.globalMapView(globalMapData);

};

Results.prototype.selectResult = function(id) {

    this.highlightedResults.push(id);



};

Results.prototype.showNoResults = function() {

    var message = document.getElementById("message");
    $("#message").show();
    message.innerHTML = 'No results';

};


Results.prototype.sendQueryData = function(jsonData) {

    this.sendMessage(jsonData);

};

Results.prototype.updateLocationNames = function(jsonData) {



    var suggestions = [];

    jsonData.forEach(function(name) {
    suggestions.push( { "value": name, "data": "any" });
  });

  util.locationNames = suggestions;
  


};


Results.prototype.sendEntryMapRequest = function(ids) {

    var message = {
        message: "entry map request",
        data: ids
    };
    var msg = JSON.stringify(message);
    this.sendMessage(msg);
}

Results.prototype.sendMoreResultsRequest = function(id) {
    var msg = "{\"message\": \"more results request\", \"data\":\"" + id + "\"}";
    this.sendMessage(msg);
}

Results.prototype.highlightRoute = function(id) {
    this.map.highlightRoute(id);
}

Results.prototype.highlightLocation = function(id) {
    this.map.highlightLocation(id);
}

Results.prototype.sendLocationNamesRequest = function() {
    var msg = "{\"message\": \"location names request\", \"data\":\"\"}";
    this.sendMessage(msg);
}

Results.prototype.sendGlobalMapRequest = function(id) {
    var msg = "{\"message\": \"colapsable map request\", \"data\":\"" + id + "\"}";
    this.sendMessage(msg);
}

Results.prototype.addColapsableResult = function(obj, size) {
    var options = {
        editable: false,
        selectable: true,
        showCurrentTime: false,
        type: 'range',
        stack: 'false',
        results: true,
        colapsed: false,
        moreResultsId: obj[0].moreResultsId,


        margin: {
            axis: 0,
            item: 0
        }
    };

    var colapsable = true;
    if (obj.length == size) {
        options.colapsed = true;
        options.moreResultsId = null;
        colapsable = false;
    }

    var container = document.getElementById('results');
    var content = [];
    for (i = 0; i < obj.length; i++) {
        content.push({
            id: i,
            type: obj[i].type,
            content: 'item ' + i,
            start: obj[i].start_date,
            end: obj[i].end_date,
            trip: obj[i].id,
            colapsable: colapsable,
            date: obj[i].date
        });
    }
    var data = new vis.DataSet(content);
    var timeline = new vis.Timeline(container, data, options);

};

colapsedResults = {};
Results.prototype.addColapsedResult = function(obj) {
    var options = {
        editable: false,
        selectable: true,
        showCurrentTime: false,
        type: 'range',
        stack: 'false',
        results: true,
        colapsed: true,
        groupBy: obj[0].groupBy,

        margin: {
            axis: 0,
            item: 0
        }
    };

    var newItem = document.createElement("div");

    var list = document.getElementById("results");
    var colapsedItem = document.getElementById(obj[0].groupBy);

    colapsedItem.parentNode.insertBefore(newItem, colapsedItem.nextSibling);

    var content = []
    for (i = 0; i < obj.length; i++) {
        content.push({
            id: i,
            type: obj[i].type,
            content: 'item ' + i,
            start: obj[i].start_date,
            end: obj[i].end_date,
            trip: obj[i].id,
            colapsable: false,
            date: obj[i].date
        });
    }
    var data = new vis.DataSet(content);
    var timeline = new vis.Timeline(newItem, data, options);

    if (colapsedResults[obj[0].groupBy]) {
        colapsedResults[obj[0].groupBy].push(timeline);
    } else {
        colapsedResults[obj[0].groupBy] = [];
        colapsedResults[obj[0].groupBy].push(timeline);
    }
};

Results.prototype.hideResults = function(id) {

    for (var key in colapsedResults) {
        if (key == id) {

            for (i = 0; i < colapsedResults[key].length; i++) {
                $(colapsedResults[key][i].dom.root).hide();
            }
        }
    }
};

Results.prototype.showResults = function(id) {

    for (var key in colapsedResults) {
        if (key == id) {

            for (i = 0; i < colapsedResults[key].length; i++) {
                $(colapsedResults[key][i].dom.root).show();
            }
        }
    }
};

Results.prototype.zoomEveryIdenticResult = function(id, scale, pointerDate, delta) {
    for (var key in colapsedResults) {

        if (parseInt(key) == parseInt(id)) {
            var value = colapsedResults[key];
            for (i = 0; i < value.length; i++) {
                value[i].range.zoom(scale, pointerDate, delta);
            }
        }

    }

};

Results.prototype.dragEveryIdenticResult = function(id, newStart, newEnd) {
    for (var key in colapsedResults) {
        if (parseInt(key) == parseInt(id)) {

            var value = colapsedResults[key];
            for (i = 0; i < value.length; i++) {
                var datePartS = moment(newStart).format("YYYY MM DD ");
                var datePartE = moment(newEnd).format("YYYY MM DD ");

                var dayStart = moment(newStart).format("DD");
                var dayEnd = moment(newEnd).format("DD");

                var startPart = moment(newStart).format("HH mm");
                var endPart = moment(newEnd).format("HH mm");

                newStart = moment(datePartS + startPart, "YYYY MM DD HH mm");
                newEnd = moment(datePartE + endPart, "YYYY MM DD HH mm");

                value[i].range.setRange(newStart, newEnd);
            }
        }

    }

};



function browserSupportFileUpload() {
    var isCompatible = false;
    if (window.File && window.FileReader && window.FileList && window.Blob) {
        isCompatible = true;
    }
    return isCompatible;
}


var nrCategory = -1;
var nrPlace = -1;
var categories = [];



function updateCategories() {
    categories = [];
    table = document.getElementById("categoriesTable");
    rows = table.rows.length;

        for (i = 0; i < rows; i++) {
          category = document.getElementById("categoryName" + i);
    categories.push( { "value": category.value, "data": "any" });


    }


 return categories;

}

function uploadCategory(evt) {
    if (!browserSupportFileUpload()) {
        alert('The File APIs are not fully supported in this browser!');
    } else {
        table = document.getElementById("categoriesTable");
        var data = null;
        var file = evt.target.files[0];
        var reader = new FileReader();
        reader.readAsText(file);
        reader.onload = function(event) {
            var csvData = event.target.result;
            data = $.csv.toArrays(csvData);
            if (data && data.length > 0) {

                for (var i = 0; i < data.length; i++) {
                    tr = document.createElement('tr');
                    td = document.createElement('td');
                    text = document.createElement('input');
                    text.style.width = "60px";
                    text.style.border = "0";
                    text.style.background = "transparent";
                    text.style.color = "white";

                    ++nrCategory;
                    text.id = "categoryName" + nrCategory;

                    text.setAttribute("value", data[i][0]);
                    tr.appendChild(td);
                    td.appendChild(text);

                    td = document.createElement('td');
                    color = document.createElement('input');
                    color.style.border = "0";
                    color.style.width = "55px";
                    color.id = "categoryColor" + nrCategory;
                    var myPicker = new jscolor.color(color, {});
                    myPicker.fromString(data[i][1]);
                    tr.appendChild(td);
                    td.appendChild(color);

                    table.appendChild(tr);
                }



            } else {
                alert('No data to import!');
            }
        };
        reader.onerror = function() {
            alert('Unable to read ' + file.fileName);
        };
    }
}


Results.prototype.updateLocationSettings = function() {


    var table = document.getElementById("placesTable");

    for (i = 0; i < util.locationNames.length; i++) {

        // Create an empty <tr> element and add it to the 1st position of the table:
        var row = table.insertRow(0);

        // Insert new cells (<td> elements) at the 1st and 2nd position of the "new" <tr> element:
        var cell1 = row.insertCell(0);
        var cell2 = row.insertCell(1);
        ++nrPlace;

        text = document.createElement('input');
        text.style.width = "60px";
        text.style.border = "0";
        text.style.background = "transparent";
        text.style.color = "white";
        text.id = "placeName" + nrPlace;
        text.setAttribute("value",util.locationNames[i].value);
        $(text).autocomplete({
            lookup: util.locationNames
        });
        cell1.appendChild(text);

        text = document.createElement('input');
        text.style.width = "60px";
        text.style.border = "0";
        text.style.background = "transparent";
        text.style.color = "white";
        text.id = "placeCategoryName" + nrPlace;
        text.setAttribute("value","Category");


             $(text).autocomplete({
                         lookup: function (query, done) {
        // Do ajax call or lookup locally, when done,
        // call the callback and pass your results:
        var result = {
            suggestions: updateCategories()
        };
        done(result);
    }
                    });

        cell2.appendChild(text);


    }


}


function updateTables() {
  nrPlace = -1;
  nrCategory = -1;

    var table = document.getElementById("placesTable");

    for (entry in util.categoriesPlaces) {
      for (i = 0; i< util.categoriesPlaces[entry].length; i++){


        // Create an empty <tr> element and add it to the 1st position of the table:
        var row = table.insertRow(0);

        // Insert new cells (<td> elements) at the 1st and 2nd position of the "new" <tr> element:
        var cell1 = row.insertCell(0);
        var cell2 = row.insertCell(1);
        ++nrPlace;

        text = document.createElement('input');
        text.style.width = "60px";
        text.style.border = "0";
        text.style.background = "transparent";
        text.style.color = "white";
        text.id = "placeName" + nrPlace;
        text.setAttribute("value",util.categoriesPlaces[entry][i]);
        $(text).autocomplete({
            lookup: util.locationNames
        });
        cell1.appendChild(text);

        text = document.createElement('input');
        text.style.width = "60px";
        text.style.border = "0";
        text.style.background = "transparent";
        text.style.color = "white";
        text.id = "placeCategoryName" + nrPlace;
        text.setAttribute("value",entry);


             $(text).autocomplete({
                         lookup: function (query, done) {
        // Do ajax call or lookup locally, when done,
        // call the callback and pass your results:
        var result = {
            suggestions: updateCategories()
        };
        done(result);
    }
                    });

        cell2.appendChild(text);


    }
  }


      var table = document.getElementById("categoriesTable");

    for (entry in util.categoriesColors) {

        // Create an empty <tr> element and add it to the 1st position of the table:
        var row = table.insertRow(0);

        // Insert new cells (<td> elements) at the 1st and 2nd position of the "new" <tr> element:
        var cell1 = row.insertCell(0);
        var cell2 = row.insertCell(1);
        ++nrCategory;

        text = document.createElement('input');
        text.style.width = "60px";
        text.style.border = "0";
        text.style.background = "transparent";
        text.style.color = "white";
        text.id = "categoryName" + nrCategory;
        text.setAttribute("value",entry);
        $(text).autocomplete({
            lookup: util.locationNames
        });
        cell1.appendChild(text);

        color = document.createElement('input');
        color.style.border = "0";
        color.style.width = "55px";
        color.id = "categoryColor" + nrCategory;
        var myPicker = new jscolor.color(color, {});
        myPicker.fromString(util.categoriesColors[entry]);

        cell2.appendChild(color);


    }
  


}

function uploadPlace(evt) {
    if (!browserSupportFileUpload()) {
        alert('The File APIs are not fully supported in this browser!');
    } else {
        table = document.getElementById("placesTable");
        var data = null;
        var file = evt.target.files[0];
        var reader = new FileReader();
        reader.readAsText(file);
        reader.onload = function(event) {
            var csvData = event.target.result;
            data = $.csv.toArrays(csvData);
            if (data && data.length > 0) {

                for (var i = 0; i < data.length; i++) {
                    tr = document.createElement('tr');
                    td = document.createElement('td');
                    text = document.createElement('input');
                    text.style.width = "60px";
                    text.style.border = "0";
                    text.style.background = "transparent";
                    text.style.color = "white";

                    ++nrPlace;

                    text.id = "placeName" + nrPlace;

                    text.setAttribute("value", data[i][0]);

                    $(text).autocomplete({
                        lookup: util.locationNames
                    });

                    tr.appendChild(td);
                    td.appendChild(text);

                    td = document.createElement('td');
                    text = document.createElement('input');
                    text.style.width = "60px";
                    text.style.border = "0";
                    text.style.background = "transparent";
                    text.style.color = "white";

                    text.id = "placeCategoryName" + nrPlace;

                    text.setAttribute("value", data[i][1]);

   
                             

                    tr.appendChild(td);
                    td.appendChild(text);

                    table.appendChild(tr);
                }



            } else {
                alert('No data to import!');
            }
        };
        reader.onerror = function() {
            alert('Unable to read ' + file.fileName);
        };
    }
}

function newCategory() {
    var table = document.getElementById("categoriesTable");

    // Create an empty <tr> element and add it to the 1st position of the table:
    var row = table.insertRow(0);

    // Insert new cells (<td> elements) at the 1st and 2nd position of the "new" <tr> element:
    var cell1 = row.insertCell(0);
    var cell2 = row.insertCell(1);
    ++nrCategory;

    text = document.createElement('input');
    text.style.width = "60px";
    text.style.border = "0";
    text.style.background = "transparent";
    text.style.color = "white";
    text.id = "categoryName" + nrCategory;
    text.setAttribute("value","Category");
    cell1.appendChild(text);



    color = document.createElement('input');
    color.style.border = "0";
    color.style.width = "55px";
    color.id = "categoryColor" + nrCategory;
    var myPicker = new jscolor.color(color, {});
    myPicker.fromString("#000000");
    cell2.appendChild(color);


}


function newPlace() {
    var table = document.getElementById("placesTable");

    // Create an empty <tr> element and add it to the 1st position of the table:
    var row = table.insertRow(0);

    // Insert new cells (<td> elements) at the 1st and 2nd position of the "new" <tr> element:
    var cell1 = row.insertCell(0);
    var cell2 = row.insertCell(1);
    ++nrPlace;

    text = document.createElement('input');
    text.style.width = "60px";
    text.style.border = "0";
    text.style.background = "transparent";
    text.style.color = "white";
    text.id = "placeName" + nrPlace;
    text.setAttribute("value", "Place");
    $(text).autocomplete({
        lookup: util.locationNames
    });
    cell1.appendChild(text);

    text = document.createElement('input');
    text.style.width = "60px";
    text.style.border = "0";
    text.style.background = "transparent";
    text.style.color = "white";
    text.id = "placeCategoryName" + nrPlace;
    text.setAttribute("value", "Category");
    cell2.appendChild(text);
 

}

function exportCategory(evt) {

    table = document.getElementById("categoriesTable");
    $table = $(table);


    var $rows = $table.find('tr:has(td)'),

        // Temporary delimiter characters unlikely to be typed by keyboard
        // This is to avoid accidentally splitting the actual contents
        tmpColDelim = String.fromCharCode(11), // vertical tab character
        tmpRowDelim = String.fromCharCode(0), // null character

        // actual delimiter characters for CSV format
        colDelim = '","',
        rowDelim = '"\r\n"',

        // Grab text from table into CSV formatted string
        csv = '"' + $rows.map(function(i, row) {
            var $row = $(row),
                $cols = $row.find('td');

            return $cols.map(function(j, col) {
                if (j % 2 == 0) {
                    category = document.getElementById("categoryName" + i);

                    text = category.value;
                } else {
                    var $col = $(col),
                        text = $col.html();
                    html = $.parseHTML(text);
                    color = $(html).css("background-color");
                    text = colorToHex(color);
                }
                return text.replace(/"/g, '""'); // escape double quotes

            }).get().join(tmpColDelim);

        }).get().join(tmpRowDelim)
        .split(tmpRowDelim).join(rowDelim)
        .split(tmpColDelim).join(colDelim) + '"';



    window.location.href = 'data:application/csv;charset=UTF-8,' + encodeURIComponent(csv);


}

function exportPlace(evt) {

    table = document.getElementById("placesTable");
    $table = $(table);


    var $rows = $table.find('tr:has(td)'),

        // Temporary delimiter characters unlikely to be typed by keyboard
        // This is to avoid accidentally splitting the actual contents
        tmpColDelim = String.fromCharCode(11), // vertical tab character
        tmpRowDelim = String.fromCharCode(0), // null character

        // actual delimiter characters for CSV format
        colDelim = '","',
        rowDelim = '"\r\n"',

        // Grab text from table into CSV formatted string
        csv = '"' + $rows.map(function(i, row) {
            var $row = $(row),
                $cols = $row.find('td');

            return $cols.map(function(j, col) {
                if (j % 2 == 0) {
                    category = document.getElementById("placeName" + i);

                    text = category.value;
                } else {
                    category = document.getElementById("placeCategoryName" + i);

                    text = category.value;
                }
                return text.replace(/"/g, '""'); // escape double quotes

            }).get().join(tmpColDelim);

        }).get().join(tmpRowDelim)
        .split(tmpRowDelim).join(rowDelim)
        .split(tmpColDelim).join(colDelim) + '"';



    window.location.href = 'data:application/csv;charset=UTF-8,' + encodeURIComponent(csv);


}


function colorToHex(color) {
    if (color.substr(0, 1) === '#') {
        return color;
    }
    var digits = /(.*?)rgb\((\d+), (\d+), (\d+)\)/.exec(color);

    var red = parseInt(digits[2]);
    var green = parseInt(digits[3]);
    var blue = parseInt(digits[4]);

    var rgb = blue | (green << 8) | (red << 16);
    return digits[1] + '#' + rgb.toString(16);
};



Results.prototype.saveSettings = function() {


util.categoriesColors = {};
util.categoriesPlaces = {};
$('.ui.sidebar').sidebar('toggle');


for(i = 0; i<= nrCategory; i++){
  category = document.getElementById("categoryName" + i);
  category = category.value;
  color = document.getElementById("categoryColor" + i);
  color = $(color).css("background-color");
  color = colorToHex(color);

  util.categoriesColors[category] = color;
}

for(i = 0; i<= nrPlace; i++){
  category = document.getElementById("placeCategoryName" + i);
  category = category.value;
  place = document.getElementById("placeName" + i);
  place = place.value;
  if(category in util.categoriesPlaces){
    util.categoriesPlaces[category].push(place);
  }
  else{
    util.categoriesPlaces[category] = [];   
    util.categoriesPlaces[category].push(place);
  }
  }

    for (var key in util.categoriesPlaces){

      if (util.categoriesPlaces.hasOwnProperty(key)) {
              var places = util.categoriesPlaces[key];
        for(i=0; i<places.length; i++){
            if( !(places[i] in util.placesColors) )
                util.placesColors[places[i]] = util.categoriesColors[key];
        }
      }

    }


    this.saveToDatabase(util.categoriesColors, util.categoriesPlaces);


};


Results.prototype.saveToDatabase = function(colors, categories){

    var content = {
        colors: colors,
        categories: categories
    };
    var message = {
        message: "save settings",
        data: content
    };

    var msg = JSON.stringify(message);
    this.sendMessage(msg);

};

Results.prototype.loadSettingsFromDatabase = function(){


    var message = {
        message: "load settings",
        data: ""
    };

    var msg = JSON.stringify(message);
    this.sendMessage(msg);
};

function updateSettings(data){
  var categories = data[0];
  var colors = data[1];

  util.categoriesPlaces = {};
  util.categoriesColors = {};

  for(i = 0; i < categories.length; i++){
    util.categoriesPlaces[categories[i][0]] = categories[i][1];
  }
  for(i = 0; i < colors.length; i++){
    util.categoriesColors[colors[i][0]] = colors[i][1];
  }

    for (var key in util.categoriesPlaces){

      if (util.categoriesPlaces.hasOwnProperty(key)) {
              var places = util.categoriesPlaces[key];
        for(i=0; i<places.length; i++){
            if( !(places[i] in util.placesColors) )
                util.placesColors[places[i]] = util.categoriesColors[key];
        }
      }

    }

};


Results.prototype.clearEverything = function() {

if(typeof this.itemSet != 'undefined'){
$("#results").empty();
this.map.clearAll();
this.itemSet.removeAllItems();
 }

}

module.exports = Results;
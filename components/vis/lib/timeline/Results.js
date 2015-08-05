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


var _globalCategories = [];

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

var totalResults;
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

var options = {
  valueNames: [ 'place', 'category', 'color']
  
};

$('#results').bind('scroll', function(){
   if($(this).scrollTop() + $(this).innerHeight() >= $(this)[0].scrollHeight){
      me.addMoreColapsableResult();
   }
});



        vis.categoriesPlaces = new List('placesList', options);

        vis.categoriesColors = new List('categoriesList', options);


      //  vis.categoriesColors.remove("category", "Category");
        //vis.categoriesColors.remove("color", "#eeeeee");
        
        //vis.categoriesPlaces.remove("category", "Category");
        //vis.categoriesPlaces.remove("place", "Place");


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
                totalResults = "~ " + obj.total + " results";
                $("#totalResults").text(totalResults);
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
                  
                  if(vis.categoriesPlaces.items.length  == 0 || vis.categoriesColors.items.length  == 0)
                    me.updateLocationSettings();
                updateColors();

        $('.category').autocomplete({
            lookup:  _globalCategories,
        });
  
                break;
        }

    };

}




Results.prototype.globalMapView = function(data) {

    this.map.globalMapView(data);

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
    message.innerText = 'No results';

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

totalShown = 10;
Results.prototype.addMoreColapsableResult = function() {
    rest = _obj.length - 10;
    last = amount + 10;

    if(last>rest)
        last = totalShown + (rest-amount);
       //console.log(last + "         " + rest + "      " + amount + "     "+ totalShown)



        
    for(j = amount; j < last; j++){
        totalShown++;
            if(totalShown > rest)
        return;
        var options = {
            editable: false,
            selectable: true,
            showCurrentTime: false,
            type: 'range',
            stack: 'false',
            results: true,
            colapsed: false,
            moreResultsId: _obj[j][0].moreResultsId,


            margin: {
                axis: 0,
                item: 0
            }
        };

        var colapsable = true;
        if (_obj[j].length == _size) {
            options.colapsed = true;
            options.moreResultsId = null;
            colapsable = false;
        }

        var container = document.getElementById('results');
        var content = [];
        for (i = 0; i < _obj[j].length; i++) {
            content.push({
                id: i,
                type: _obj[j][i].type,
                content: 'item ' + i,
                start: _obj[j][i].start_date,
                end: _obj[j][i].end_date,
                trip: _obj[j][i].id,
                colapsable: colapsable,
                date: _obj[j][i].date,
                quartile: _obj[j][i].quartile
            });
        }
        var data = new vis.DataSet(content);
        var timeline = new vis.Timeline(container, data, options);

    if (allResults[_objCounter]) {
        allResults[_objCounter].push(timeline);
    } else {
        allResults[_objCounter] = [];
        allResults[_objCounter].push(timeline);
    }
    _objCounter++;
    
    }
    amount = last;


}

var amount = 0;
var _obj = [];
var _size = 0;
var _objCounter = 0;
Results.prototype.addColapsableResult = function(obj, size) {


    _obj.push(obj);
    _size = size;

    if(amount > 10)
        return;

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
            date: obj[i].date,
            quartile: obj[i].quartile
        });
    }
    var data = new vis.DataSet(content);
    var timeline = new vis.Timeline(container, data, options);
    amount += 1;

    if (allResults[_objCounter]) {
        allResults[_objCounter].push(timeline);
    } else {
        allResults[_objCounter] = [];
        allResults[_objCounter].push(timeline);
    }
    _objCounter++;
};

colapsedResults = {};
allResults = {};
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

Results.prototype.zoomAllResults = function(scale, pointerDate, delta) {
    for (var key in allResults) {
            var value = allResults[key];
            for (i = 0; i < value.length; i++) {

                value[i].range.zoom(scale, pointerDate, delta);
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


Results.prototype.dragAllResults = function(newStart, newEnd) {
    for (var key in allResults) {
            var value = allResults[key];
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
    

};



function browserSupportFileUpload() {
    var isCompatible = false;
    if (window.File && window.FileReader && window.FileList && window.Blob) {
        isCompatible = true;
    }
    return isCompatible;
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
                            vis.categoriesColors.add({
  place: data[i][0],
  category: data[i][1]
});
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

function updateColors(){
console.log(vis.categoriesPlaces.items)
console.log(vis.categoriesColors.items)
            vis.categoriesPlaces.items.forEach(function(key) {

         vis.categoriesColors.items.forEach(function(key2){

                if(key._values.category == key2._values.category)
                util.placesColors[key._values.place] = key2._values.color;
         });
    });

}

Results.prototype.updateLocationSettings = function() {

 for (i = 0; i < util.locationNames.length; i++) {
        vis.categoriesPlaces.add({
  place: util.locationNames[i].value,
  category: "All"
});
    }



/*
    var table = document.getElementById("placesTable");

    for (i = 0; i < util.locationNames.length; i++) {

        // Create an empty <tr> element and add it to the 1st position of the table:
        var row = table.insertRow(0);

        // Insert new cells (<td> elements) at the 1st and 2nd position of the "new" <tr> element:
        var cell1 = row.insertCell(0);
        var cell2 = row.insertCell(1);
        ++nrPlace;

        text = document.createElement('input');
        text.style.width = "150px";
        text.style.border = "0";
        text.style.background = "transparent";
        text.style.color = "white";
        text.id = "placeName" + nrPlace;
        text.setAttribute("value",util.locationNames[i].value);
        $(text).autocomplete({
            lookup: util.locationNames
        });
        text.className = "place";
        cell1.appendChild(text);

        text = document.createElement('input');
        text.style.width = "60px";
        text.style.border = "0";
        text.style.background = "transparent";
        text.style.color = "white";
        text.id = "placeCategoryName" + nrPlace;
        text.setAttribute("value","Category");
        text.className = "category";


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

*/
}


function updateTables() {
/*  nrPlace = -1;
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
        text.style.width = "150px";
        text.style.border = "0";
        text.style.background = "transparent";
        text.style.color = "white";
        text.id = "placeName" + nrPlace;
        text.setAttribute("value",util.categoriesPlaces[entry][i]);
        $(text).autocomplete({
            lookup: util.locationNames
        });
        text.className = "place";
        cell1.appendChild(text);

        text = document.createElement('input');
        text.style.width = "60px";
        text.style.border = "0";
        text.style.background = "transparent";
        text.style.color = "white";
        text.id = "placeCategoryName" + nrPlace;
        text.setAttribute("value",entry);
        text.className = "category";

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
        text.style.width = "150px";
        text.style.border = "0";
        text.style.background = "transparent";
        text.style.color = "white";
        text.id = "categoryName" + nrCategory;
        text.setAttribute("value",entry);
        text.className = "category";
        $(text).autocomplete({
            lookup: util.locationNames
        });
        cell1.appendChild(text);

        color = document.createElement('input');
        color.style.border = "0";
        color.style.width = "55px";
        color.id = "categoryColor" + nrCategory;
        color.type = "color";
        color.value = util.categoriesColors[entry];
        color.className = "color";

        cell2.appendChild(color);


    }
  
*/

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

        vis.categoriesPlaces.add({
  place: data[i][0],
  category: data[i][1]
});

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

    vis.categoriesColors.add({
  category: "All",
  color: "#000000"
});

}


function newPlace() {
        vis.categoriesPlaces.add({
  place: "Place",
  category: "All"
});

}

function exportCategory(evt) {

    var items = vis.categoriesColors.items;
    var csv = "";
    items.forEach(function(item) {
    csv += item._values.category + "," + item._values.color + "\n";
  });


    window.location.href = 'data:application/csv;charset=UTF-8,' + encodeURIComponent(csv);


}

function exportPlace(evt) {

    var items = vis.categoriesPlaces.items;
    var csv = "";
    items.forEach(function(item) {
    csv += item._values.place + "," + item._values.category + "\n";
  });


    window.location.href = 'data:application/csv;charset=UTF-8,' + encodeURIComponent(csv);


}


Results.prototype.saveSettings = function() {
$('.ui.sidebar').sidebar('toggle');

var options = {
  valueNames: [ 'place', 'category', 'color']
  
};


        vis.categoriesPlacesTemp = new List('placesList', options);

        vis.categoriesColorsTemp = new List('categoriesList', options);


/*
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
*/
    var colors = [];
    var categories = [];
    _globalCategories = [];

    vis.categoriesColorsTemp.items.forEach(function(item) {
    colors.push([item._values.category, item._values.color]);
    _globalCategories.push(item._values.category);
  });
    vis.categoriesPlacesTemp.items.forEach(function(item) {
    categories.push([item._values.place, item._values.category]);
  });

    this.saveToDatabase(colors, categories);
    vis.categoriesPlaces = vis.categoriesPlacesTemp;
    vis.categoriesColors = vis.categoriesColorsTemp;


    vis.categoriesPlaces.items.forEach(function(key) {

         vis.categoriesColors.items.forEach(function(key2){

                if(key._values.category == key2._values.category)
                util.placesColors[key._values.place] = key2._values.color;
         });
    });

            $('.category').autocomplete({
            lookup:  _globalCategories,
        });
  
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

var options = {
  valueNames: [ 'place', 'category', 'color']
  
};


        vis.categoriesPlaces = new List('placesList', options);

        vis.categoriesColors = new List('categoriesList', options);

        vis.categoriesColors.remove("category", "All");
        vis.categoriesColors.remove("color", "#eeeeee");
        
        vis.categoriesPlaces.remove("category", "All");
        vis.categoriesPlaces.remove("place", "Place");

vis.categoriesColors.add({
  category: "All",
  color: "#D5DDF6"
});

  for(i = 0; i < categories.length; i++){

        vis.categoriesPlaces.add({
  place: categories[i][0],
  category: categories[i][1]
});

  }
  for(i = 0; i < colors.length; i++){
    if(colors[i][0] != 'All' && colors[i][1] != '#D5DDF6')
            vis.categoriesColors.add({
  category: colors[i][0],
  color: colors[i][1]
});
_globalCategories.push(colors[i][0]);
  }

 /*   for (var key in util.categoriesPlaces){

      if (util.categoriesPlaces.hasOwnProperty(key)) {
              var places = util.categoriesPlaces[key];
        for(i=0; i<places.length; i++){
            if( !(places[i] in util.placesColors) )
                util.placesColors[places[i]] = util.categoriesColors[key];
        }
      }

    }*/

};


Results.prototype.clearEverything = function() {

amount = 0;
_obj = [];
_size = 0;
_objCounter = 0;
totalShown = 10;
colapsedResults = {};
allResults = {};
if(typeof this.itemSet != 'undefined'){
$("#results").empty();

            var iDiv = document.createElement('div');
            var iDiv2 = document.createElement('div');
iDiv.id = 'message';
iDiv2.id = 'totalResults';
$("#results").append(iDiv);
$("#results").append(iDiv2);

this.map.clearAll();
this.itemSet.removeAllItems();
 }

}

Results.prototype.clearEverythingButCurrentSearch = function() {

amount = 0;
_obj = [];
_size = 0;
_objCounter = 0;
totalShown = 10;
colapsedResults = {};
allResults = {};
if(typeof this.itemSet != 'undefined'){
$("#results").empty();

            var iDiv = document.createElement('div');
            var iDiv2 = document.createElement('div');
iDiv.id = 'message';
iDiv2.id = 'totalResults';
$("#results").append(iDiv);
$("#results").append(iDiv2);

this.map.clearAll();
 }

}

Results.prototype.clearResults = function() {

if(typeof this.itemSet != 'undefined'){
$("#results").empty();

            var iDiv = document.createElement('div');
            var iDiv2 = document.createElement('div');
iDiv.id = 'message';
iDiv2.id = 'totalResults';
$("#results").append(iDiv);
$("#results").append(iDiv2);

this.map.clearAll();
//this.itemSet.removeAllItems();
 }

}


module.exports = Results;
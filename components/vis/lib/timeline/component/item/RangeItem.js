var Hammer = require('../../../module/hammer');
var Item = require('./Item');
var util = require('../../../util');
var Core = require('../../Core');

/**
 * @constructor RangeItem
 * @extends Item
 * @param {Object} data             Object containing parameters start, end
 *                                  content, className.
 * @param {{toScreen: function, toTime: function}} conversion
 *                                  Conversion functions from time to screen and vice versa
 * @param {Object} [options]        Configuration options
 *                                  // TODO: describe options
 */
function RangeItem(data, conversion, options) {
    this.props = {
        content: {
            width: 0
        },
        range: {
            width: 0
        }
    };
    this.overflow = false; // if contents can overflow (css styling), this flag is set to true

    // validate data
    if (data) {
        if (data.start == undefined) {
            throw new Error('Property "start" missing in item ' + data.id);
        }
        if (data.end == undefined) {
            throw new Error('Property "end" missing in item ' + data.id);
        }
        if (data.range == undefined) {
            data.range = 0;
        }

         RangeItem.prototype.baseClassName = 'item range';

    }

    Item.call(this, data, conversion, options);
    this.f = 30;



}

RangeItem.prototype = new Item(null, null, null);

RangeItem.prototype.baseClassName = 'item range';

RangeItem.prototype._repaintResultStartBox = function(anchor) {
    if (this.options.results && !this.dom.resultStartBox) {
        // create and show button
        var me = this;

        var startBox = document.createElement('div');
        var everything = document.getElementById("visualization");
        startBox.className = "result-start"
        var hours = moment(this.data.start).format("HH:mm");
        startBox.innerText = hours;
        startBox.title = hours;

        anchor.appendChild(startBox);
        this.dom.resultStartBox = startBox;

    }

};

RangeItem.prototype._repaintResultLocation = function(anchor) {
    if (this.options.results && !this.dom.resultLocation) {
        // create and show button
        var me = this;

        var location = document.createElement('div');
        location.className = "content-location-result"
        location.innerText = this.data.trip;
        location.style.zIndex = '100';
        location.title = this.data.trip;
        anchor.appendChild(location);
        this.dom.resultLocation = location;

    }

};

RangeItem.prototype._repaintResultEndBox = function(anchor) {
    if (this.options.results && !this.dom.resultEndBox) {
        // create and show button
        var me = this;

        var endBox = document.createElement('div');
        var everything = document.getElementById("visualization");
        endBox.className = "result-end"
        var hours = moment(this.data.end).format("HH:mm");
        endBox.innerText = hours;
        endBox.title = hours;
        anchor.appendChild(endBox);
        this.dom.resultEndBox = endBox;

    }

};

/**
 * Repaint a delete button on the top right of the item when the item is selected
 * @param {HTMLElement} anchor
 * @protected
 */

RangeItem.prototype._repaintStartBox = function(anchor) {
    if (this.options.editable.remove && !this.dom.startBox ) {
        // create and show button
        var me = this;

        var startBox = document.createElement('div');
        var everything = document.getElementById("visualization");
        startBox.title = "Starting time";
        if(!this.data.newSearch)
        startBox.innerHTML = '<div class="input-group clockpicker">' +
            '<input  id="startBox' + this.id + '" type="text" class="start-box form-control" value="--:--">' +
            '</div>';
            else{
                var start = moment(this.data.start).format("HH:mm");
                 startBox.innerHTML = '<div class="input-group clockpicker">' +
            '<input  id="startBox' + this.id + '" type="text" class="start-box form-control" value="' + start + '">' +
            '</div>';
            }
        anchor.appendChild(startBox);
        this.dom.startBox = startBox;



        var input = document.getElementById("startBox" + this.id);

        $(".clockpicker").clockpicker({
            placement: "left",
            align: "top",
            autoclose: "true",
            afterDone: function() {
                //me.verifyField();
            }
        });

        Hammer(input, {
            preventDefault: true
        }).on('tap', function(event) {
            input.focus();
            if (input.value === "--:--") input.value = "";
            $(me.dom.durationBox).timepicker('hideWidget');
            event.stopPropagation();
        });
        Hammer(everything, { //unfocus if clicked outside
            preventDefault: true
        }).on('tap', function(event) {
            input.blur();

            //me.verifyField();
            event.stopPropagation();
        });
        input.addEventListener("blur", function() {
            if (input.value === "") input.value = "--:--";
            else if (!util.verifyHours(input.value)) {
                input.value = "--:--";
            }

        });

        $(input).on("keydown", function search(e) { //unfocus if enter
            if (e.keyCode == 13) {
                input.blur();
                // me.verifyField();
            }
        });



    }

};

RangeItem.prototype.errorMessage = function(anchor) {
    anchor.style.color = 'red';
}
RangeItem.prototype.okMessage = function(anchor) {
    anchor.style.color = '#666';
}

RangeItem.prototype.verifyField = function() {

    var startAnchor = document.getElementById("startBox" + this.id);
    var endAnchor = document.getElementById("endBox" + this.id);

    var startString = startAnchor.value;
    var endString = endAnchor.value;

    var today = new Date();
    var dd = today.getDate();
    var mm = today.getMonth() + 1; //January is 0!
    var yyyy = today.getFullYear();

    if (dd < 10) {
        dd = '0' + dd
    }

    if (mm < 10) {
        mm = '0' + mm
    }

    today = dd + '/' + mm + '/' + yyyy;


    var startDate = moment(today + " " + startString, "DD/MM/YYYY HH:mm");
    var endDate = moment(today + " " + endString, "DD/MM/YYYY HH:mm");

    //this.data.range = this.dom.rangeBox.value;
    if (startString != "--:--" && endString != "--:--") {
        if (endDate.isBefore(startDate)) this.errorMessage(endAnchor);
        else if (startDate.isAfter(endDate)) this.errorMessage(startAnchor);
        else if (endDate.isAfter(startDate)) {
            this.okMessage(startAnchor);
            this.okMessage(endAnchor);
            this.data.start = startDate;
            this.data.end = endDate;
            // this.parent.itemSet.itemsData.getDataSet().update2(this);

        }
    } else if (startString == "--:--" && endString != "--:--") {
        this.data.end = endDate;
        this.data.start = moment(endDate).subtract(3, 'h');
        //  this.parent.itemSet.itemsData.getDataSet().update2(this);
    } else if (endString == "--:--" && startString != "--:--") {
        this.data.start = startDate;
        this.data.end = moment(startDate).add(3, 'h');

        //  this.parent.itemSet.itemsData.getDataSet().update2(this);
    }

    this.parent.itemSet.itemsData.getDataSet().update2(this);
    this.redraw();
    this.repositionX();

};

/**
 * Repaint a delete button on the top right of the item when the item is selected
 * @param {HTMLElement} anchor
 * @protected
 */
RangeItem.prototype._repaintEndBox = function(anchor) {
    if (this.options.editable.remove && !this.dom.endBox) {
        // create and show button
        var me = this;

        var endBox = document.createElement('div');
        var everything = document.getElementById("visualization");
        endBox.title = "Ending time";
        if(!this.data.newSearch)
        endBox.innerHTML = '<div class="input-group clockpicker">' +
            '<input  id="endBox' + this.id + '" type="text" class="end-box form-control" value="--:--">' +
            '</div>';
            else{
                                var end = moment(this.data.end).format("HH:mm");

                endBox.innerHTML = '<div class="input-group clockpicker">' +
            '<input  id="endBox' + this.id + '" type="text" class="end-box form-control" value="' + end + '">' +
            '</div>';
            }
        anchor.appendChild(endBox);
        this.dom.endBox = endBox;


        var input = document.getElementById("endBox" + this.id);
        $(".clockpicker").clockpicker({
            placement: "right",
            align: "top",
            autoclose: "true",
            afterDone: function() {
                // me.verifyField();
            }
        });

        Hammer(input, {
            preventDefault: true
        }).on('tap', function(event) {
            input.focus();
            if (input.value === "--:--") input.value = "";
            $(me.dom.durationBox).timepicker('hideWidget');
            event.stopPropagation();
        });
        Hammer(everything, { //unfocus if clicked outside
            preventDefault: true
        }).on('tap', function(event) {
            //me.verifyField();
            input.blur();

            event.stopPropagation();
        });

        input.addEventListener("blur", function() {
            if (input.value === "") input.value = "--:--";
            else if (!util.verifyHours(input.value)) {
                input.value = "--:--";
            }
        });

        $(input).on("keydown", function search(e) { //unfocus if enter
            if (e.keyCode == 13) {
                input.blur();

            }
        });
    }

};
var hidden = false;
RangeItem.prototype.applyDuration = function(prevDuration) {

    var temp3 = prevDuration.replace("h", ":");
    var temp4 = temp3.replace("m", "");

    if (temp4.slice(-1) === ':')
        temp4 += '00';
    var prev = moment.duration(temp4);



    var temp = this.dom.durationBox.value.replace("h", ":");
    var temp2 = temp.replace("m", "");
    if (temp2.slice(-1) === ':')
        temp2 += '00';
    var duration = moment.duration(temp2);

    duration.subtract(moment.duration(prev));

    var half = moment.duration(duration).as('milliseconds') / 2.0;



    var me = this;


    util.forEach(me.parent.itemSet.items, function(item) {


        if (moment(item.data.end).isAfter(me.data.end) && item.id != me.id) { //dates must be added
            item.data.end = moment(item.data.end).add(half, "ms");
            item.data.start = moment(item.data.start).add(half, "ms");
            item.data.refresh = 'no';
            me.parent.itemSet.itemsData.getDataSet().update(item.data);
            item.repositionX();
        } else if (moment(item.data.start).isBefore(me.data.start) && item.id != me.id) { //dates must be subtracted
            item.data.end = moment(item.data.end).subtract(half, "ms");
            item.data.start = moment(item.data.start).subtract(half, "ms");
            item.data.refresh = 'no';
            me.parent.itemSet.itemsData.getDataSet().update(item.data);
            item.repositionX();
        }

        // item.repositionX(limitSize);
    });
    this.data.start = moment(this.data.start).subtract(half, "ms");
    this.data.end = moment(this.data.end).add(half, "ms");
    this.parent.itemSet.itemsData.getDataSet().update(this.data);

    this.repositionX();


    //this.data.start = moment(this.data.start).subtract(half, "ms");
    //this.data.end = moment(this.data.end).add(half, "ms");

    /*

     var leftData = this.parent.itemSet.itemsData.get(this.data.leftIntervalId);
      var rightData = this.parent.itemSet.itemsData.get(this.data.rightIntervalId);


      var leftInterval = this.parent.itemSet.items[this.data.leftIntervalId];
      var rightInterval = this.parent.itemSet.items[this.data.rightIntervalId];

      if(leftInterval)
      var leftWidth = parseInt(leftInterval.dom.box.style.width);
    if(rightInterval)
      var rightWidth = parseInt(rightInterval.dom.box.style.width);

    var thisWidth = parseInt(this.dom.box.style.width);



    if(leftInterval === undefined || leftWidth > 70)
      this.data.start = moment(this.data.start).subtract(half, "ms");
    if(rightInterval === undefined ||rightWidth > 70)
      this.data.end = moment(this.data.end).add(half, "ms");


        leftData.end = this.data.start;
        rightData.start = this.data.end;



    if(leftInterval != undefined || leftWidth > 70)
        this.parent.itemSet.itemsData.getDataSet().update(leftData);
    if(rightInterval!= undefined ||rightWidth > 70)
        this.parent.itemSet.itemsData.getDataSet().update(rightData);

      this.repositionX();

      if((leftWidth<70 || rightWidth < 70 || thisWidth < 100)){
        $(this.dom.durationBox).timepicker('hideWidget');
    }*/

};

RangeItem.prototype.getData = function() {
    var startBox = document.getElementById("startBox" + this.id);
    var endBox = document.getElementById("endBox" + this.id);

    var data = {
        location: this.dom.content.coords,
        start: startBox.value,
        end: endBox.value,
        spatialRange: this.dom.rangeBox.value,
        temporalStartRange: this.dom.fuzzyIconBoxStart.value,
        temporalEndRange: this.dom.fuzzyIconBoxEnd.value,
        duration: this.dom.durationBox.value

    }
    return data;

};

/**
 * Repaint a delete button on the top right of the item when the item is selected
 * @param {HTMLElement} anchor
 * @protected
 */
RangeItem.prototype._repaintDurationBox = function(anchor) {

    if (this.options.editable.remove && !this.dom.durationBox) {
        // create and show button
        var me = this;
        var prevDuration = "";
        var durationBox = document.createElement('input');
        var everything = document.getElementById("visualization");
        durationBox.type = 'text';
        //durationBox.setAttribute("maxlength", 5);
        durationBox.className = 'duration-box clearable';
        durationBox.title = 'Duration time';
        if(!this.data.drag)
        durationBox.value = 'duration';

 
        Hammer(durationBox, {
            preventDefault: true
        }).on('tap', function(event) {
            me.getData();
            durationBox.focus();
            if (durationBox.value === "duration") durationBox.value = "";
            event.stopPropagation();
        });


        Hammer(everything, {
            preventDefault: true
        }).on('tap', function(event) {

            durationBox.blur();
            event.stopPropagation();
        });
        $(durationBox).on("keydown", function search(e) {
            if (e.keyCode == 13) {
                durationBox.blur();
            }
        });



        durationBox.addEventListener("blur", function() {

            //$(me.dom.durationBox).timepicker('hideWidget');

            if (durationBox.value === "") durationBox.value = "duration";
            else if (!util.verifyDuration(durationBox.value)) {
                durationBox.value = "duration";
            }

        });

       $(durationBox).timepicker({
            minuteStep: 5,
            showSeconds: false,
            showMeridian: false,
            defaultTime: false
        });

        $(durationBox).timepicker().on('show.timepicker', function(e) {
            prevDuration = durationBox.value;
        });

        var me = this;
        $(durationBox).timepicker().on('change.timepicker', function(e) {
            me.applyDuration(prevDuration);
            prevDuration = durationBox.value;

        });


        anchor.appendChild(durationBox);
        this.dom.durationBox = durationBox;

        //this.verifyDuration();
    }

};

/**
 * Repaint a delete button on the top right of the item when the item is selected
 * @param {HTMLElement} anchor
 * @protected
 */
RangeItem.prototype._repaintRangeBox = function(anchor) {
    if (this.options.editable.remove && !this.dom.rangeBox) {
        // create and show button
        var me = this;

        var rangeBox = document.createElement('input');
        var everything = document.getElementById("visualization");
        rangeBox.type = 'text';
        rangeBox.title = 'Location range (m)';
        rangeBox.className = 'location-range';
        rangeBox.value = "0m";

        Hammer(rangeBox, {
            preventDefault: true
        }).on('tap', function(event) {
            $(me.dom.durationBox).timepicker('hideWidget');
            rangeBox.focus();
            rangeBox.value = rangeBox.value.substring(0, rangeBox.value.length - 1);
            event.stopPropagation();
            Hammer(everything, {
                preventDefault: true
            }).on('tap', function(event) {
                rangeBox.blur();



                event.stopPropagation();
            });
            rangeBox.select();
        });

        $(rangeBox).timepicker({
            minuteStep: 5,
            showSeconds: false,
            showMeridian: false,
            defaultTime: false,
            onlySignals: true
        });


        


        $(rangeBox).on("keydown", function search(e) {
            if (e.keyCode == 13) {
                rangeBox.blur();

            }
        });

        rangeBox.addEventListener("blur", function() {
            me.data.range = logslider4(logslider3(parseInt(rangeBox.value)));
            if (rangeBox.value.slice(-1) != 'm') rangeBox.value = rangeBox.value + "m";
            me.repositionY(true);
            if (!util.verifyRange(rangeBox.value)) {
                rangeBox.value = "0m";
                me.data.range = 0;
                me.height = 30;
                me.repositionY(true);
            };


        });

       $(rangeBox).timepicker().on('hide.timepicker', function(e) {

            if(rangeBox.value === '0m') {me.height = 30;
                        me.f = 30;
                        me.data.range = 0;
                 me.repositionY(true);}
        });


$(rangeBox).on('input', function() { 
    var event1 = new CustomEvent(
  "rangeInfo", 
  {
    detail: {
      message: parseInt(rangeBox.value)
    }
  }
);

document.dispatchEvent(event1);
});




        anchor.appendChild(rangeBox);
        this.dom.rangeBox = rangeBox;
    }

};

/**
 * Repaint a delete button on the top right of the item when the item is selected
 * @param {HTMLElement} anchor
 * @protected
 */
RangeItem.prototype._repaintContentBox = function(anchor) {
    if (this.options.editable.remove && !this.dom.rangeBox) {
        // create and show button
        var me = this;

        var content = document.createElement('input');
        var everything = document.getElementById("visualization");
        content.type = 'text';
        content.title = 'Location name';
        content.className = 'content';
        if(!this.data.newSearch){
        content.value = "local";
        content.coords = "local";
        }
        else{
            content.value = this.data.trip;
            content.coords = this.data.trip;
        }

//console.log( this.parent.itemSet.locationNames)
        $(content).autocomplete({
            lookup: util.locationNames,
            onSelect: function (suggestion) {
        content.coords = suggestion.value;
    }
        });

        Hammer(content, {
            preventDefault: true
        }).on('tap', function(event) {
            $(me.dom.durationBox).timepicker('hideWidget');
            if (content.value === "local") {content.value = ""; content.coords = "";}
            content.focus();
            content.select();



content.onfocus=function(){
    var patt = /^[-+]?([1-8]?\d(\.\d+)?|90(\.0+)?),\s*[-+]?(180(\.0+)?|((1[0-7]\d)|([1-9]?\d))(\.\d+)?)$/g
var res = patt.test(content.coords);
if(res){


    var event1 = new CustomEvent(
  "showCoordinates", 
  {
    detail: {
      message: content.coords
    }
  }
);

document.dispatchEvent(event1);
}


        document.addEventListener("mapCoordinates", function(event) {
            coords = event.detail.message;
            res = coords.split(",");

            lat = Math.floor(res[0]*1000+0.5)/1000;
            lon = Math.floor(res[1]*1000+0.5)/1000;

            content.coords = coords;
            content.value = lat + "," + lon;
        });


};


            event.stopPropagation();
        });
        Hammer(everything, {
            preventDefault: true
        }).on('tap', function(event) {
            content.blur();
            event.stopPropagation();
        });
        $(content).on("keydown", function search(e) {
            if (e.keyCode == 13) {

                content.blur();
            }
        });

        content.addEventListener("blur", function() {
            if (content.value === "") {content.value = "local"; content.coords = "local";}
            else{
                content.coords = content.value;
            }
        });



        anchor.appendChild(content);
        content.style.bottom = "calc(50% - " + 21 + "px)";
        this.dom.content = content;
    }

};

/**
 * Repaint a delete button on the top right of the item when the item is selected
 * @param {HTMLElement} anchor
 * @protected
 */
var prevX = -1;
var prevX2 = -1;
RangeItem.prototype._repaintFuzzyStart = function(anchor) {
    function resetToArrow() {
        fuzzyIconStart.style.display = 'block';
        fuzzyIconBoxStart.style.display = 'none';
        fuzzyIconInterval.style.display = 'none';
        fuzzyIconBoxStart.value = "0min";
        fuzzyIconInterval.width = "25px";
    }
    if (this.options.editable.remove && !this.dom.fuzzyIconStart) {
        // create and show button
        var me = this;

        var fuzzyIconStart = document.createElement('div');
        var fuzzyDragLeft = document.createElement('div');
        var fuzzyDragRight = document.createElement('div');
        var fuzzyIconInterval = document.createElement('div');

        var fuzzyIconBoxStart = document.createElement('input')
        var everything = document.getElementById("visualization");

        fuzzyDragLeft.className = 'fuzzy-drag-left';
        fuzzyDragRight.className = 'fuzzy-drag-right';

        fuzzyIconStart.className = 'fuzzy-icon-start';

        fuzzyIconInterval.className = 'fuzzy-interval-start';
        fuzzyIconInterval.style.display = 'none';
        fuzzyIconInterval.style.width = '25px';

        fuzzyIconBoxStart.className = 'fuzzy-interval-box';
        fuzzyIconBoxStart.value = "0min";
        fuzzyIconBoxStart.title = "Time range (minutes)";
        fuzzyIconBoxStart.style.display = 'none';

        fuzzyDragLeft.fuzzyDragLeft = this;
        fuzzyDragRight.fuzzyDragRight = this;


        fuzzyIconInterval.appendChild(fuzzyDragRight);
        fuzzyIconInterval.appendChild(fuzzyDragLeft);
        fuzzyIconInterval.appendChild(fuzzyIconBoxStart);
        anchor.appendChild(fuzzyIconInterval);
        anchor.appendChild(fuzzyIconStart);
        this.dom.fuzzyIconStart = fuzzyIconStart;
        this.dom.fuzzyIconBoxStart = fuzzyIconBoxStart;

        Hammer(fuzzyIconStart, {
            preventDefault: true
        }).on('tap', function(event) {
            fuzzyIconStart.style.display = 'none';
            fuzzyIconBoxStart.style.display = 'block';
            fuzzyIconInterval.style.display = 'block';
            fuzzyIconBoxStart.value = "1min";
            fuzzyIconBoxStart.focus();
            fuzzyIconBoxStart.select();
            event.stopPropagation();
        });

        Hammer(fuzzyIconInterval, {
            preventDefault: true
        }).on('tap', function(event) {
            resetToArrow();
            event.stopPropagation();
        });

        fuzzyIconBoxStart.addEventListener("blur", function() {
            if (fuzzyIconBoxStart.value.slice(-3) != 'min') fuzzyIconBoxStart.value = fuzzyIconBoxStart.value + "min";
        });


        Hammer(fuzzyIconBoxStart, {
            preventDefault: true
        }).on('tap', function(event) {

            $(me.dom.durationBox).timepicker('hideWidget');
            if (fuzzyIconBoxStart.value === "") fuzzyIconBoxStart.value = "1min";
            fuzzyIconBoxStart.focus();
            fuzzyIconBoxStart.value = fuzzyIconBoxStart.value.substring(0, fuzzyIconBoxStart.value.length - 3);
            fuzzyIconBoxStart.select();
            event.stopPropagation();
        });
        Hammer(everything, {
            preventDefault: true
        }).on('tap', function(event) {
            fuzzyIconBoxStart.blur();
            fuzzyIconInterval.style.width = fuzzyIconBoxStart.value + 'px';
            fuzzyIconInterval.style.left = '0px';
            fuzzyIconInterval.style.transform = 'translateX(-50%)';
            if (fuzzyIconBoxStart.value.slice(-3) != 'min') fuzzyIconBoxStart.value = fuzzyIconBoxStart.value + "min";

            event.stopPropagation();
        });
        $(fuzzyIconBoxStart).on("keydown", function search(e) {
            if (e.keyCode == 13) {
                fuzzyIconInterval.style.width = fuzzyIconBoxStart.value + 'px';
                fuzzyIconInterval.style.left = '0px';
                fuzzyIconInterval.style.transform = 'translateX(-50%)';
                if (fuzzyIconBoxStart.value.slice(-3).value != 'min') fuzzyIconBoxStart.value = fuzzyIconBoxStart.value + "min";

                fuzzyIconBoxStart.blur();
            }
        });

        Hammer(fuzzyDragLeft, {
            preventDefault: true
        }).on('drag', function(event) {

            if (prevX == -1) {
                prevX = event.gesture.center.clientX;
                return false;
            }

            if (prevX > event.gesture.center.clientX) { //dragged left
                if (fuzzyIconStart.style.display == 'none') {


                    initialX = window.innerWidth + event.gesture.center.clientX;
                    fuzzyIconInterval.style.width = (parseInt(fuzzyIconInterval.style.width) + logslider(initialX)) + 'px';
                    fuzzyIconInterval.style.left = '0px';
                    fuzzyIconInterval.style.transform = 'translateX(-50%)';
                    teste = parseInt(fuzzyIconBoxStart.value);
                    teste = (teste + logslider(initialX)).toFixed();
                    fuzzyIconBoxStart.value = teste + 'min';

                }
            } else if (prevX < event.gesture.center.clientX) { // dragged right
                if (fuzzyIconStart.style.display == 'none') {


                    initialX = window.innerWidth + event.gesture.center.clientX;
                    fuzzyIconInterval.style.width = (parseInt(fuzzyIconInterval.style.width) - logslider(initialX)) + 'px';
                    fuzzyIconInterval.style.left = '0px';
                    fuzzyIconInterval.style.transform = 'translateX(-50%)';
                    teste = parseInt(fuzzyIconBoxStart.value);
                    teste = (teste - logslider(initialX)).toFixed();
                    if (teste < 1) {
                        resetToArrow();
                        teste = 1;
                    }

                    fuzzyIconBoxStart.value = teste + 'min';


                }
            }
            prevX = event.gesture.center.clientX;


        });


        Hammer(fuzzyDragRight, {
            preventDefault: true
        }).on('drag', function(event) {

            if (prevX2 == -1) {
                prevX2 = event.gesture.center.clientX;
                return false;
            }


            if (prevX2 > event.gesture.center.clientX) { //dragged left

                if (fuzzyIconStart.style.display == 'none') {


                    initialX = window.innerWidth + event.gesture.center.clientX;
                    fuzzyIconInterval.style.width = (parseInt(fuzzyIconInterval.style.width) - logslider(initialX)) + 'px';
                    fuzzyIconInterval.style.left = '0px';
                    fuzzyIconInterval.style.transform = 'translateX(calc(-50%)';
                    teste = parseInt(fuzzyIconBoxStart.value);
                    teste = (teste - logslider(initialX)).toFixed();
                    if (teste < 1) {
                        resetToArrow();
                        teste = 1;
                    }
                    fuzzyIconBoxStart.value = teste + 'min';


                }
            } else if (prevX2 < event.gesture.center.clientX) { // dragged right
                if (fuzzyIconStart.style.display == 'none') {

                    initialX = window.innerWidth + event.gesture.center.clientX;
                    fuzzyIconInterval.style.width = (parseInt(fuzzyIconInterval.style.width) + logslider(initialX)) + 'px';
                    fuzzyIconInterval.style.left = '0px';
                    fuzzyIconInterval.style.transform = 'translateX(calc(-50%)';
                    teste = parseInt(fuzzyIconBoxStart.value);
                    teste = (teste + logslider(initialX)).toFixed();
                    fuzzyIconBoxStart.value = teste + 'min';

                }

            }
            prevX2 = event.gesture.center.clientX;
        });
    }

};

function logslider(position) {
    // position will be between 0 and 100
    var minp = 0;
    var maxp = window.innerWidth;

    // The result should be between 100 an 10000000
    var minv = Math.log(1);
    var maxv = Math.log(3);

    // calculate adjustment factor
    var scale = (maxv - minv) / (maxp - minp);

    return Math.exp(minv + scale * (position - minp)) - 1;
}

/**
 * Repaint a delete button on the top right of the item when the item is selected
 * @param {HTMLElement} anchor
 * @protected
 */
var prevX3 = -1;
var prevX4 = -1;
RangeItem.prototype._repaintFuzzyEnd = function(anchor) {
    function resetToArrow() {
        fuzzyIconEnd.style.display = 'block';
        fuzzyIconBoxEnd.style.display = 'none';
        fuzzyIconInterval.style.display = 'none';
        fuzzyIconBoxEnd.value = "0min";
        fuzzyIconInterval.width = "25px";
    }
    if (this.options.editable.remove && !this.dom.fuzzyIconEnd) {
        // create and show button
        var me = this;

        var fuzzyIconEnd = document.createElement('div');
        var fuzzyDragLeft = document.createElement('div');
        var fuzzyDragRight = document.createElement('div');
        var fuzzyIconInterval = document.createElement('div');

        var fuzzyIconBoxEnd = document.createElement('input')
        var everything = document.getElementById("visualization");

        fuzzyDragLeft.className = 'fuzzy-drag-left';
        fuzzyDragRight.className = 'fuzzy-drag-right';

        fuzzyIconEnd.className = 'fuzzy-icon-end';

        fuzzyIconInterval.className = 'fuzzy-interval-end';
        fuzzyIconInterval.style.display = 'none';
        fuzzyIconInterval.style.width = '25px';

        fuzzyIconBoxEnd.className = 'fuzzy-interval-box';
        fuzzyIconBoxEnd.value = "0min";
        fuzzyIconBoxEnd.title = "Time range (minutes)";
        fuzzyIconBoxEnd.style.display = 'none';

        fuzzyDragLeft.fuzzyDragLeft = this;
        fuzzyDragRight.fuzzyDragRight = this;


        fuzzyIconInterval.appendChild(fuzzyDragRight);
        fuzzyIconInterval.appendChild(fuzzyDragLeft);
        fuzzyIconInterval.appendChild(fuzzyIconBoxEnd);
        anchor.appendChild(fuzzyIconInterval);
        anchor.appendChild(fuzzyIconEnd);
        this.dom.fuzzyIconEnd = fuzzyIconEnd;
        this.dom.fuzzyIconBoxEnd = fuzzyIconBoxEnd;

        Hammer(fuzzyIconEnd, {
            preventDefault: true
        }).on('tap', function(event) {
            fuzzyIconEnd.style.display = 'none';
            fuzzyIconBoxEnd.style.display = 'block';
            fuzzyIconInterval.style.display = 'block';
            fuzzyIconBoxEnd.value = "1min";
            fuzzyIconBoxEnd.focus();
            fuzzyIconBoxEnd.select();
            event.stopPropagation();
        });

        Hammer(fuzzyIconInterval, {
            preventDefault: true
        }).on('tap', function(event) {
            resetToArrow();
            event.stopPropagation();
        });

        fuzzyIconBoxEnd.addEventListener("blur", function() {
            if (fuzzyIconBoxEnd.value.slice(-3) != 'min') fuzzyIconBoxEnd.value = fuzzyIconBoxEnd.value + "min";
        });


        Hammer(fuzzyIconBoxEnd, {
            preventDefault: true
        }).on('tap', function(event) {

            fuzzyIconBoxEnd.focus();
            if (fuzzyIconBoxEnd.value === "") fuzzyIconBoxEnd.value = "1min";
            fuzzyIconBoxEnd.value = fuzzyIconBoxEnd.value.substring(0, fuzzyIconBoxEnd.value.length - 3);
            fuzzyIconBoxEnd.select();
            event.stopPropagation();
        });
        Hammer(everything, {
            preventDefault: true
        }).on('tap', function(event) {
            $(me.dom.durationBox).timepicker('hideWidget');
            fuzzyIconBoxEnd.blur();
            fuzzyIconInterval.style.width = fuzzyIconBoxEnd.value + 'px';
            fuzzyIconInterval.style.right = '0px';
            fuzzyIconInterval.style.transform = 'translateX(50%)';
            if (fuzzyIconBoxEnd.value.slice(-3) != 'min') fuzzyIconBoxEnd.value = fuzzyIconBoxEnd.value + "min";

            event.stopPropagation();
        });
        $(fuzzyIconBoxEnd).on("keydown", function search(e) {
            if (e.keyCode == 13) {
                fuzzyIconInterval.style.width = fuzzyIconBoxEnd.value + 'px';
                fuzzyIconInterval.style.right = '0px';
                fuzzyIconInterval.style.transform = 'translateX(50%)';
                if (fuzzyIconBoxEnd.value.slice(-3).value != 'min') fuzzyIconBoxEnd.value = fuzzyIconBoxEnd.value + "min";

                fuzzyIconBoxEnd.blur();
            }
        });

        Hammer(fuzzyDragLeft, {
            preventDefault: true
        }).on('drag', function(event) {
            if (fuzzyIconEnd.style.display == 'none') {
                if (prevX3 == -1) {
                    prevX3 = event.gesture.center.clientX;
                    return false;
                }

                if (prevX3 > event.gesture.center.clientX) { //dragged left
                    initialX = window.innerWidth + event.gesture.center.clientX;
                    fuzzyIconInterval.style.width = (parseInt(fuzzyIconInterval.style.width) + logslider(initialX)) + 'px';
                    fuzzyIconInterval.style.right = '0px';
                    fuzzyIconInterval.style.transform = 'translateX(50%)';
                    teste = parseInt(fuzzyIconBoxEnd.value);
                    teste = (teste + logslider(initialX)).toFixed();
                    fuzzyIconBoxEnd.value = teste + 'min';
                } else if (prevX3 < event.gesture.center.clientX) { // dragged right
                    initialX = window.innerWidth + event.gesture.center.clientX;
                    fuzzyIconInterval.style.width = (parseInt(fuzzyIconInterval.style.width) - logslider(initialX)) + 'px';
                    fuzzyIconInterval.style.right = '0px';
                    fuzzyIconInterval.style.transform = 'translateX(50%)';
                    teste = parseInt(fuzzyIconBoxEnd.value);
                    teste = (teste - logslider(initialX)).toFixed();
                    if (teste < 1) {
                        resetToArrow();
                        teste = 1;
                    }

                    fuzzyIconBoxEnd.value = teste + 'min';

                }


            }
            prevX3 = event.gesture.center.clientX;
        });


        Hammer(fuzzyDragRight, {
            preventDefault: true
        }).on('drag', function(event) {
            if (fuzzyIconEnd.style.display == 'none') {
                if (prevX4 == -1) {
                    prevX4 = event.gesture.center.clientX;
                    return false;
                }

                if (prevX4 > event.gesture.center.clientX) { //dragged left
                    initialX = window.innerWidth + event.gesture.center.clientX;
                    fuzzyIconInterval.style.width = (parseInt(fuzzyIconInterval.style.width) - logslider(initialX)) + 'px';
                    fuzzyIconInterval.style.right = '0px';
                    fuzzyIconInterval.style.transform = 'translateX(50%)';
                    teste = parseInt(fuzzyIconBoxEnd.value);
                    teste = (teste - logslider(initialX)).toFixed();
                    if (teste < 1) {
                        resetToArrow();
                        teste = 1;
                    }

                    fuzzyIconBoxEnd.value = teste + 'min';
                } else if (prevX4 < event.gesture.center.clientX) { // dragged right
                    initialX =  window.innerWidth +  event.gesture.center.clientX;
                    fuzzyIconInterval.style.width = (parseInt(fuzzyIconInterval.style.width) + logslider(initialX)) + 'px';
                    fuzzyIconInterval.style.right = '0px';
                    fuzzyIconInterval.style.transform = 'translateX(50%)';
                    teste = parseInt(fuzzyIconBoxEnd.value);
                    teste = (teste + logslider(initialX)).toFixed();

                    fuzzyIconBoxEnd.value = teste + 'min';

                }

            }
            prevX4 = event.gesture.center.clientX;

        });
    }

};

/**
 * Set HTML contents for the item
 * @param {Element} element   HTML element to fill with the contents
 * @private
 */
RangeItem.prototype._updateContents = function(element) {
    var content;
    if (this.options.template) {
        var itemData = this.parent.itemSet.itemsData.get(this.id); // get a clone of the data from the dataset
        content = this.options.template(itemData);
    } else {
        content = this.data.content;
    }

    if (content !== this.content) {
        // only replace the content when changed
        if (content instanceof Element) {
            element.value = '';
            element.appendChild(content);
        } else if (content != undefined) {
            element.value = content;
        } else {
            if (!(this.data.type == 'background' && this.data.content === undefined)) {
                throw new Error('Property "content" missing in item ' + this.id);
            }
        }

        this.content = content;
    }
};

/**
 * Check whether this item is visible inside given range
 * @returns {{start: Number, end: Number}} range with a timestamp for start and end
 * @returns {boolean} True if visible
 */
RangeItem.prototype.isVisible = function(range) {
    // determine visibility
    return (this.data.start < range.end) && (this.data.end > range.start);
};

/**
 * Repaint a delete button on the top right of the item when the item is selected
 * @param {HTMLElement} anchor
 * @protected
 */

Item.prototype._repaintDeleteButton = function(anchor) {
    if (this.selected && this.options.editable.remove && !this.dom.deleteButton) {
        // create and show button
        var me = this;

        var deleteButton = document.createElement('div');
        deleteButton.className = 'delete';
        deleteButton.title = 'Delete this item';

        Hammer(deleteButton, {
            preventDefault: true
        }).on('tap', function(event) {
            if (me.data.leftIntervalId && !me.data.rightIntervalId)
                me.parent.removeFromDataSet2(me.parent.itemSet.itemsData.getDataSet().get(me.data.leftIntervalId));
            if (me.data.rightIntervalId && !me.data.leftIntervalId)
                me.parent.removeFromDataSet2(me.parent.itemSet.itemsData.getDataSet().get(me.data.rightIntervalId));

            me.parent.removeFromDataSet(me);
            event.stopPropagation();
        });

        anchor.appendChild(deleteButton);
        this.dom.deleteButton = deleteButton;
    } else if (!this.selected && this.dom.deleteButton) {
        // remove button
        if (this.dom.deleteButton.parentNode) {
            this.dom.deleteButton.parentNode.removeChild(this.dom.deleteButton);
        }
        this.dom.deleteButton = null;
    }
};

/**
 * Repaint the item
 */
RangeItem.prototype.redraw = function() {


    var dom = this.dom;
    if (!dom) {
        // create DOM
        this.dom = {};
        dom = this.dom;


        // background box
        dom.box = document.createElement('div');
        // className is updated in redraw()


if(this.options.results){
    dom.content = document.createElement('div');
    dom.content.className = 'content';
    dom.box.appendChild(dom.content);
    this.dom.box.style.maxHeight = '30px';

}
        // attach this item as attribute
        dom.box['timeline-item'] = this;

        this.height = 30;
        this.dirty = true;
    }
    // append DOM to parent DOM
    if (!this.parent) {
        throw new Error('Cannot redraw item: no parent attached');
    }
    if (!dom.box.parentNode) {
        var foreground = this.parent.dom.foreground;
        if (!foreground) {
            throw new Error('Cannot redraw item: parent has no foreground container element');
        }
        foreground.appendChild(dom.box);
    }
    this.displayed = true;

    // Update DOM when item is marked dirty. An item is marked dirty when:
    // - the item is not yet rendered
    // - the item's data is changed
    // - the item is selected/deselected

    this._repaintContentBox(dom.box);
    this._repaintDeleteButton(dom.box);
    
    this._repaintStartBox(dom.box);
    this._repaintDurationBox(dom.box);
    this._repaintEndBox(dom.box);
    this._repaintFuzzyStart(dom.box);
    this._repaintFuzzyEnd(dom.box);
    this._repaintRangeBox(dom.box);
    this._repaintDragLeft();
    this._repaintDragRight();
    this._repaintDragUp();
    this._repaintDragDown();
    this._repaintDeleteButton();
    this._repaintResultStartBox(dom.box);
    this._repaintResultEndBox(dom.box);
    this._repaintResultLocation(dom.box);




    if (this.data.leftIntervalId || this.data.rightIntervalId) {


        util.forEach(this.parent.itemSet.items, function(item) {
            if (item.id === this.data.leftIntervalId || item.id === this.data.rightIntervalId) {
                item.repositionX();
                //me.visibleItems.push(item);
            }
            // item.repositionX(limitSize);
        });

    }

    if (this.dirty) {
        if(this.options.results)
        this._updateContents(this.dom.content);
        this._updateTitle(this.dom.box);
        this._updateDataAttributes(this.dom.box);
        this._updateStyle(this.dom.box);

        // update class
        var className = (this.data.className ? (' ' + this.data.className) : '');
        if(!this.options.results)
            className += (this.selected ? ' selected' : '');
        dom.box.className = this.baseClassName + className;

        // determine from css whether this box has overflow
        this.overflow = window.getComputedStyle(dom.content).overflow !== 'hidden' && window.getComputedStyle(dom.range).overflow !== 'hidden';

        // recalculate size
        // turn off max-width to be able to calculate the real width
        // this causes an extra browser repaint/reflow, but so be it

        // this.props.content.width = this.dom.content.offsetWidth;
        //this.props.content.height = this.dom.content.offsetHeight;//new

        this.dom.box.style.bottom = "calc(50% - " + this.height / 2.0 + "px)";




        this.dirty = false;
    }




};

function hexToRgb(hex) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

/**
 * Show the item in the DOM (when not already visible). The items DOM will
 * be created when needed.
 */
RangeItem.prototype.show = function() {
    if (!this.displayed) {
        this.redraw();
    }

        //coloring according to settings
    if(this.options.results){
    var place = this.dom.resultLocation.innerText;
    color = util.placesColors[place];
        if(this.data.colapsable && color){
            rgb = hexToRgb(color);
        this.dom.box.style.backgroundColor = "rgba(" + rgb.r + "," + rgb.g + "," + rgb.b + ",0.5)";
    }
    else{
         this.dom.box.style.backgroundColor = color;
    }
    }



};

/**
 * Hide the item from the DOM (when visible)
 * @return {Boolean} changed
 */
RangeItem.prototype.hide = function() {
    if (this.displayed) {
        var box = this.dom.box;

        if (box.parentNode) {
            box.parentNode.removeChild(box);
        }

        this.displayed = false;
    }
};


/**
 * Reposition the item horizontally
 * @param {boolean} [limitSize=true] If true (default), the width of the range
 *                                   item will be limited, as the browser cannot
 *                                   display very wide divs. This means though
 *                                   that the applied left and width may
 *                                   not correspond to the ranges start and end
 * @Override
 */

RangeItem.prototype.repositionX = function(limitSize) {


    //if created by dragging, then the duration must be updated
    if (this.data.drag && this.dom.durationBox.value != 'duration') {

        var ms = moment(this.data.end).diff(moment(this.data.start));
        var d = moment.duration(ms);
        var s = Math.floor(d.asHours()) + moment.utc(ms).format("!mm-");
        var temp = s.replace("!", "h");
        var res = temp.replace("-", "m");
        var sign = "";
        if(this.dom.durationBox.value != 'duration')
            if(isNaN(this.dom.durationBox.value.charAt(0)))
                sign = this.dom.durationBox.value.charAt(0);
        this.dom.durationBox.value = sign + res;

    }


    var parentWidth = this.parent.width;
    var start = this.conversion.toScreen(this.data.start);
    var end = this.conversion.toScreen(this.data.end);
    var contentLeft;
    var contentWidth;



    // var startValue = document.getElementById("startBox" + this.id).value;
    //var endValue = document.getElementById("endBox" + this.id).value;
    // var startSign = startValue.length == 5 ? "" : startValue.charAt(0);
    //var endSign = endValue.length == 5 ? "" : endValue.charAt(0);

    //  if (startValue != "--:--")
    //     document.getElementById("startBox" + this.id).value = startSign + moment(this.data.start).format('HH:mm');
    // if (endValue != "--:--")
    //   document.getElementById("endBox" + this.id).value = endSign + moment(this.data.end).format('HH:mm');

    //if(this.data.rightIntervalId){
    //this.rightInterval.repositionX();}

    // limit the width of the range, as browsers cannot draw very wide divs
    if (limitSize === undefined || limitSize === true) {
        if (start < -parentWidth) {
            start = -parentWidth;
        }
        if (end > 2 * parentWidth) {
            end = 2 * parentWidth;
        }
    }
    var boxWidth = Math.max(end - start, 1);

    /*if (this.overflow) {
        this.left = start;
        this.width = boxWidth + this.props.content.width;
        contentWidth = this.props.content.width;

        // Note: The calculation of width is an optimistic calculation, giving
        //       a width which will not change when moving the Timeline
        //       So no re-stacking needed, which is nicer for the eye;
    } else {*/
        this.left = start;
        this.width = boxWidth;
        contentWidth = Math.min(end - start - 2 * this.options.padding, this.props.content.width);
    //}

    this.dom.box.style.left = this.left + 'px';
    this.dom.box.style.width = boxWidth + 'px';
    if(!this.options.results)
    this.dom.box.style.minWidth = 240 + 'px';

    switch (this.options.align) {
        case 'left':
            this.dom.content.style.left = '0';
            break;

        case 'right':
            this.dom.content.style.left = Math.max((boxWidth - contentWidth - 2 * this.options.padding), 0) + 'px';
            break;

        case 'center':
            this.dom.content.style.left = Math.max((boxWidth - contentWidth - 2 * this.options.padding) / 2, 0) + 'px';
            break;

        default: // 'auto'
            // when range exceeds left of the window, position the contents at the left of the visible area
            /*if (this.overflow) {
                if (end > 0) {
                    contentLeft = Math.max(-start, 0);
                } else {
                    contentLeft = -contentWidth; // ensure it's not visible anymore
                }
            } else {*/
                if (start < 0) {
                    contentLeft = Math.min(-start, (end - start - contentWidth - 2 * this.options.padding));
                    // TODO: remove the need for options.padding. it's terrible.
                } else {
                    contentLeft = 30;
                }
            //}
            this.dom.content.style.left = 30 + 'px';
    }


};

//converts meters to pixels
function logslider3(position) {
    // position will be between 0 and 100
    var minp = 0;
    var maxp = 1000;

    // The result should be between 100 an 10000000
    var minv = Math.log(30);
    var maxv = Math.log(70);

    // calculate adjustment factor
    var scale = (maxv - minv) / (maxp - minp);

    return Math.exp(minv + scale * (position - minp));
}

//converts meters to pixels
function logslider5(value) {
    // position will be between 0 and 100
    var minp = 0;
    var maxp = 1000;

    // The result should be between 100 an 10000000
    var minv = Math.log(30);
    var maxv = Math.log(70);

    // calculate adjustment factor
    var scale = (maxv - minv) / (maxp - minp);

    return (Math.log(value) - minv) / scale + minp;
}


//converts pixel range to pixels
function logslider2(position) {
    // position will be between 0 and 100
    var minp = 30;
    var maxp = 70;

    // The result should be between 100 an 10000000
    var minv = Math.log(1);
    var maxv = Math.log(500);

    // calculate adjustment factor
    var scale = (maxv - minv) / (maxp - minp);

    return Math.exp(minv + scale * (position - minp));
}

//converts pixel range to pixels
function logslider7(position) {
    // position will be between 0 and 100
    var minp = -30;
    var maxp = -70;

    // The result should be between 100 an 10000000
    var minv = Math.log(1);
    var maxv = Math.log(900);

    // calculate adjustment factor
    var scale = (maxv - minv) / (maxp - minp);

    return Math.exp(minv + scale * (position - minp));
}

//converts pixel range to pixels
function logslider4(value) {
        // position will be between 0 and 100
        var minp = 0;
        var maxp = 50;

        // The result should be between 100 an 10000000
        var minv = Math.log(30);
        var maxv = Math.log(70);

        // calculate adjustment factor
        var scale = (maxv - minv) / (maxp - minp);

        return (Math.log(value) - minv) / scale + minp;
    }
    /**
     * Reposition the item vertically
     * @Override
     */


RangeItem.prototype.repositionY = function(doNotUpdateBox) {
if(!this.options.results){
    range = this.data.range;
    if(!isNaN(range))
    this.f += range/10.0;
    if (this.f < 70 && this.f >= 30)
        this.height = this.f;
    else if (this.f > 70) this.f = 70;
    else if (this.f < 30) this.f = 30;

    var orientation = this.options.orientation,
    box = this.dom.box;

    if (orientation == 'top') {
        box.style.top = this.top + 'px';
    } else {
        box.style.top = (this.parent.height - this.height) / 2 + 'px';
        box.style.bottom = (this.parent.height - this.height) / 2 + 'px';
    }

    if (doNotUpdateBox != true) {
        var sign = "";
        if ( this.f < 70 && this.f > 30) {
            if(isNaN(this.dom.rangeBox.value.charAt(0)))
                sign = this.dom.rangeBox.value.charAt(0);
            this.dom.rangeBox.value = sign +logslider2(this.f).toFixed() + "m";

        }
        if (this.f <= 30) {
            this.dom.rangeBox.value = sign+"0m";
            this.height = 30;
        }
    }

        var event1 = new CustomEvent(
  "rangeInfo", 
  {
    detail: {
      message: parseInt( this.dom.rangeBox.value)
    }
  }
);

document.dispatchEvent(event1);

}
};

/**
 * Repaint a drag area on the left side of the range when the range is selected
 * @protected
 */
RangeItem.prototype._repaintDragLeft = function() {
    if (this.options.editable.updateTime && !this.dom.dragLeft) {
        // create and show drag area
        var dragLeft = document.createElement('div');
        dragLeft.className = 'drag-left';
        dragLeft.dragLeftItem = this;

        // TODO: this should be redundant?
        Hammer(dragLeft, {
            preventDefault: true
        }).on('drag', function() {
            //console.log('drag left')
        });

        this.dom.box.appendChild(dragLeft);
        this.dom.dragLeft = dragLeft;
    }

};

/**
 * Repaint a drag area on the right side of the range when the range is selected
 * @protected
 */
RangeItem.prototype._repaintDragRight = function() {
    if (this.options.editable.updateTime && !this.dom.dragRight) {
        // create and show drag area
        var dragRight = document.createElement('div');
        dragRight.className = 'drag-right';
        dragRight.dragRightItem = this;

        // TODO: this should be redundant?
        Hammer(dragRight, {
            preventDefault: true
        }).on('drag', function() {
            //console.log('drag right')
        });

        this.dom.box.appendChild(dragRight);
        this.dom.dragRight = dragRight;
    }

};

/**
 * Repaint a drag area on the upper side of the range when the range is selected
 * @protected
 */
RangeItem.prototype._repaintDragUp = function() {
    if (this.options.editable.updateTime && !this.dom.dragUp) {
        // create and show drag area
        var dragUp = document.createElement('div');
        dragUp.className = 'drag-up';
        dragUp.dragUpItem = this;

        // TODO: this should be redundant?
        Hammer(dragUp, {
            preventDefault: true
        }).on('drag', function() {
            //console.log('drag right')
        });

        this.dom.box.appendChild(dragUp);
        this.dom.dragUp = dragUp;
    }

};

/**
 * Repaint a drag area on the down side of the range when the range is selected
 * @protected
 */
RangeItem.prototype._repaintDragDown = function() {
    if (this.options.editable.updateTime && !this.dom.dragDown) {
        // create and show drag area
        var dragDown = document.createElement('div');
        dragDown.className = 'drag-down';
        dragDown.dragDownItem = this;

        // TODO: this should be redundant?
        Hammer(dragDown, {
            preventDefault: true
        }).on('drag', function() {
            //console.log('drag right')
        });

        this.dom.box.appendChild(dragDown);
        this.dom.dragDown = dragDown;
    }

};

module.exports = RangeItem;
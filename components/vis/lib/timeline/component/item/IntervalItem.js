var Hammer = require('../../../module/hammer');
var Item = require('./Item');
var util = require('../../../util');
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
function IntervalItem (data, conversion, options) {
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
  }

  Item.call(this, data, conversion, options);

  if(this.options.results)
    this.baseClassName = 'item interval results';

}

IntervalItem.prototype = new Item (null, null, null);

IntervalItem.prototype.baseClassName = 'item interval';

/**
 * Repaint a delete button on the top right of the item when the item is selected
 * @param {HTMLElement} anchor
 * @protected
 */
IntervalItem.prototype._repaintLocationBox = function (anchor) { 
  if (this.options.editable.remove && !this.dom.locationBox) {

    // create and show button
    var me = this;

    var locationBox = document.createElement('input');
    var everything = document.getElementById("visualization");
    locationBox.type = 'text';
    locationBox.setAttribute("maxlength", 5);
    locationBox.className = 'location-box';
    locationBox.title = 'Route name';
    locationBox.value = 'route';
    locationBox.coords = "route";

    $(locationBox).autocomplete({
      lookup: this.parent.itemSet.availableTags,
      onSelect: function (suggestion) {
        locationBox.coords = suggestion.value;
    }
    });

    Hammer(locationBox, {
      preventDefault: true
    }).on('tap', function (event) {
      document.body.style.cursor = " url(components/vis/img/timeline/red-dot.png), auto";
      locationBox.style.cursor = " url(components/vis/img/timeline/red-dot.png), auto";
                           $(me.dom.durationBox).timepicker('hideWidget');
$(locationBox).bind('input', function() { 
   locationBox.coords = locationBox.value;
});

      locationBox.focus();
      if(locationBox.value === "route") {locationBox.value = ""; locationBox.coords = "";};



      event.stopPropagation();
    });

    locationBox.onfocus=function(){
    var patt = /^[-+]?([1-8]?\d(\.\d+)?|90(\.0+)?),\s*[-+]?(180(\.0+)?|((1[0-7]\d)|([1-9]?\d))(\.\d+)?)$/g
var res = patt.test(locationBox.coords);
if(res){


    var event1 = new CustomEvent(
  "showCoordinates", 
  {
    detail: {
      message: locationBox.coords
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

            locationBox.coords = coords;
            locationBox.value = lat + "," + lon;

            document.body.style.cursor = "default";
      locationBox.style.cursor = "default";

        });
        
};


    Hammer(everything, { //unfocus if clicked outside
      preventDefault: true
    }).on('tap', function (event) {
      locationBox.blur();
      event.stopPropagation();
    });
    $(locationBox).on("keydown",function search(e) { //unfocus if enter
    if(e.keyCode == 13) {
        locationBox.blur();
    }
    });

                    locationBox.addEventListener("blur", function() {
              if(locationBox.value === "") {locationBox.value = "route"; locationBox.coords = "route";}
        });


    anchor.appendChild(locationBox);
    this.dom.locationBox = locationBox;
  }

};

IntervalItem.prototype.applyDuration = function(prevDuration) {
  var temp3 = prevDuration.replace("h",":");
  var temp4 = temp3.replace("m", "");

  if(temp4.slice(-1) === ':')
    temp4 += '00';
  var prev = moment.duration(temp4);



  var temp = this.dom.durationBox.value.replace("h",":");
  var temp2 = temp.replace("m", "");
    if(temp2.slice(-1) === ':')
    temp2 += '00';
  var duration = moment.duration(temp2);

  duration.subtract(moment.duration(prev));

  var half = moment.duration(duration).as('milliseconds')/2.0;


var me = this;


                          util.forEach(me.parent.itemSet.items, function(item) {
 

    if(moment(me.data.end).isBefore(moment(item.data.end)) && item.id != me.id){ //dates must be added
      //console.log("ADD " + me.data.end + " " + item.data.end)
      item.data.end = moment(item.data.end).add(half, "ms");
      item.data.start = moment(item.data.start).add(half, "ms");
      me.parent.itemSet.itemsData.getDataSet().update(item.data);
    }

    else if(moment(me.data.start).isAfter(moment(item.data.start)) && item.id != me.id){ //dates must be subtracted
      //console.log("REM " + me.data.start + " " + item.data.start)
      item.data.end = moment(item.data.end).subtract(half, "ms");
      item.data.start = moment(item.data.start).subtract(half, "ms");
      me.parent.itemSet.itemsData.getDataSet().update(item.data);
    }

                              // item.repositionX(limitSize);
                          });
this.data.start = moment(this.data.start).subtract(half, "ms");
 this.data.end = moment(this.data.end).add(half, "ms");

  this.repositionX();



 /* var leftData = this.parent.itemSet.itemsData.get(this.data.leftItemId);
  var rightData = this.parent.itemSet.itemsData.get(this.data.rightItemId);

  var leftItem = this.parent.itemSet.items[this.data.leftItemId];
  var rightItem = this.parent.itemSet.items[this.data.rightItemId];
  var leftWidth = parseInt(leftItem.dom.box.style.width);
  var rightWidth = parseInt(rightItem.dom.box.style.width);


var thisWidth = parseInt(this.dom.box.style.width);


  if((leftWidth<70 || rightWidth < 70 || thisWidth < 100)){
    $(this.dom.durationBox).timepicker('hideWidget');
}
    

if(leftWidth > 70)
  this.data.start = moment(this.data.start).subtract(half, "ms");
if(rightWidth > 70)
  this.data.end = moment(this.data.end).add(half, "ms");


    leftData.end = this.data.start;
    rightData.start = this.data.end;

    if(leftWidth > 70)
    this.parent.itemSet.itemsData.getDataSet().update(leftData);
  if(rightWidth > 70)
    this.parent.itemSet.itemsData.getDataSet().update(rightData);
*/


  
};


/**
 * Repaint a delete button on the top right of the item when the item is selected
 * @param {HTMLElement} anchor
 * @protected
 */
IntervalItem.prototype._repaintDurationBox = function (anchor) { 
  if (this.options.editable.remove && !this.dom.durationBox) {
    // create and show button
    var me = this;
    var prevDuration;
    var durationBox = document.createElement('input');
    var everything = document.getElementById("visualization");
    durationBox.type = 'text';
    //durationBox.setAttribute("maxlength", 5);
    durationBox.className = 'duration-box';
    durationBox.title = 'Duration time';
    durationBox.value = 'duration';

    Hammer(durationBox, {
      preventDefault: true
    }).on('tap', function (event) {

      durationBox.focus();
            if (durationBox.value === "duration") durationBox.value = "";
      event.stopPropagation();
    });
    Hammer(everything, {
      preventDefault: true
    }).on('tap', function (event) {
      durationBox.blur();
      event.stopPropagation();
    });
    $(durationBox).on("keydown",function search(e) {
    if(e.keyCode == 13) {
        durationBox.blur();
    }
    });

        durationBox.addEventListener("blur", function() {

            if (durationBox.value === "") durationBox.value = "duration";
          else if(!util.verifyDuration(durationBox.value)){durationBox.value = "duration";}
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
  }

};

/**
 * Check whether this item is visible inside given range
 * @returns {{start: Number, end: Number}} range with a timestamp for start and end
 * @returns {boolean} True if visible
 */
IntervalItem.prototype.isVisible = function(range) {
  // determine visibility
  return (this.data.start < range.end) && (this.data.end > range.start);
};

IntervalItem.prototype.getData = function() {
  var data = {
      route: this.dom.locationBox.coords,
      duration: this.dom.durationBox.value,
      start : document.getElementById("endBox" + this.data.leftItemId).value,
      end : document.getElementById("startBox" + this.data.rightItemId).value,
      temporalStartRange: this.parent.items[this.data.leftItemId].dom.fuzzyIconBoxEnd.value,
      temporalEndRange: this.parent.items[this.data.rightItemId].dom.fuzzyIconBoxStart.value
  }
  return data;

  };

/**
 * Repaint the item
 */
IntervalItem.prototype.redraw = function() {
  var dom = this.dom;
  if (!dom) {
    // create DOM
    this.dom = {};
    dom = this.dom;

      // background box
    dom.box = document.createElement('div');
    // className is updated in redraw()

    // attach this item as attribute
    dom.box['timeline-item'] = this;

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

  if (this.dirty) {
    this._updateTitle(this.dom.box);
    this._updateDataAttributes(this.dom.box);
    this._updateStyle(this.dom.box);

    // update class
    var className = (this.data.className ? (' ' + this.data.className) : '') +
        (this.selected ? ' selected' : '');
    dom.box.className = this.baseClassName + className;

    this.dom.box.style.bottom = 'calc(50% - 2.5px)';



    this.dirty = false;
  }

  //this._repaintDeleteButton(dom.box);
  this._repaintLocationBox(dom.box);
  this._repaintDurationBox(dom.box);
  //this._repaintEndBox(dom.box);
  //this._repaintDragLeft();
  //this._repaintDragRight();
  //this._repaintDragUp();
  //this._repaintDragDown();
};

/**
 * Show the item in the DOM (when not already visible). The items DOM will
 * be created when needed.
 */
IntervalItem.prototype.show = function() {
  if (!this.displayed) {
    this.redraw();
  }
};

/**
 * Hide the item from the DOM (when visible)
 * @return {Boolean} changed
 */
IntervalItem.prototype.hide = function() {
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
IntervalItem.prototype.repositionX = function(limitSize) {


//console.log("end.... " + this.parent.itemSet.itemsData.get(this.data.rightItemId).start + "start...." + this.parent.itemSet.itemsData.get(this.data.leftItemId).end );
if(!this.options.results){
if(this.parent.itemSet.itemsData.get(this.data.rightItemId) && this.data.refresh != 'no')
  this.data.end = this.parent.itemSet.itemsData.get(this.data.rightItemId).start;
if(this.parent.itemSet.itemsData.get(this.data.leftItemId) && this.data.refresh != 'no')
 this.data.start = this.parent.itemSet.itemsData.get(this.data.leftItemId).end;
}


  var parentWidth = this.parent.width;
  var start = this.conversion.toScreen(this.data.start);
  var end = this.conversion.toScreen(this.data.end);
  var contentLeft;
  var contentWidth;

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

  if (this.overflow) {
    this.left = start;
    this.width = boxWidth ;//+ this.props.content.width;
   // contentWidth = this.props.content.width;

    // Note: The calculation of width is an optimistic calculation, giving
    //       a width which will not change when moving the Timeline
    //       So no re-stacking needed, which is nicer for the eye;
  }
  else {
    this.left = start;
    this.width = boxWidth;
   // contentWidth = Math.min(end - start - 2 * this.options.padding, this.props.content.width);
  }

  this.dom.box.style.left = this.left + 'px';
  this.dom.box.style.width = boxWidth + 'px';

  switch (this.options.align) {
    case 'left':
      //this.dom.content.style.left = '0';
      break;

    case 'right':
     // this.dom.content.style.left = Math.max((boxWidth - contentWidth - 2 * this.options.padding), 0) + 'px';
      break;

    case 'center':
     // this.dom.content.style.left = Math.max((boxWidth - contentWidth - 2 * this.options.padding) / 2, 0) + 'px';
      break;

    default: // 'auto'
      // when range exceeds left of the window, position the contents at the left of the visible area
      if (this.overflow) {
        if (end > 0) {
        //  contentLeft = Math.max(-start, 0);
        }
        else {
        //  contentLeft = -contentWidth; // ensure it's not visible anymore
        }
      }
      else {
        if(end-start < 150)
          //this.dom.range.visibility = 'hidden';
        if (start < 0) {
         // contentLeft = Math.min(-start,
           //   (end - start - contentWidth - 2 * this.options.padding));
          // TODO: remove the need for options.padding. it's terrible.
        }
        else {
        //  contentLeft = 0;
        }
      }
      //this.dom.content.style.left = contentLeft + 'px';
  }
};
module.exports = IntervalItem;




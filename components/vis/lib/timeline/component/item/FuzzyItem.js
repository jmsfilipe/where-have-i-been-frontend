var Hammer = require('../../../module/hammer');
var Item = require('./Item');

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
function FuzzyItem (data, conversion, options) {
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
}

FuzzyItem.prototype = new Item (null, null, null);

FuzzyItem.prototype.baseClassName = 'item fuzzy';


/**
 * Repaint a delete button on the top right of the item when the item is selected
 * @param {HTMLElement} anchor
 * @protected
 */
FuzzyItem.prototype._repaintDurationBox = function (anchor) { 
  if (this.options.editable.remove && !this.dom.durationBox) {
    // create and show button
    var me = this;

    var durationBox = document.createElement('input');
    var everything = document.getElementById("visualization");
    durationBox.type = 'text';
    durationBox.setAttribute("maxlength", 5);
    durationBox.className = 'duration-box';
    durationBox.title = 'Duration time';
    durationBox.value = 'durat';

    Hammer(durationBox, {
      preventDefault: true
    }).on('tap', function (event) {
      durationBox.focus();
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


    anchor.appendChild(durationBox);
    this.dom.durationBox = durationBox;
  }

};

/**
 * Check whether this item is visible inside given range
 * @returns {{start: Number, end: Number}} range with a timestamp for start and end
 * @returns {boolean} True if visible
 */
FuzzyItem.prototype.isVisible = function(range) {
  // determine visibility
  return (this.data.start < range.end) && (this.data.end > range.start);
};

/**
 * Repaint the item
 */
FuzzyItem.prototype.redraw = function() {
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

  console.log("INTERVAL S: " + this.data.start + " E " + this.data.end);
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
FuzzyItem.prototype.show = function() {
  if (!this.displayed) {
    this.redraw();
  }
};

/**
 * Hide the item from the DOM (when visible)
 * @return {Boolean} changed
 */
FuzzyItem.prototype.hide = function() {
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
FuzzyItem.prototype.repositionX = function(limitSize) {


//console.log("end.... " + this.parent.itemSet.itemsData.get(this.data.rightItemId).start + "start...." + this.parent.itemSet.itemsData.get(this.data.leftItemId).end );


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
module.exports = FuzzyItem;




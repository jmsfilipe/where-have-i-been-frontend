	var Hammer = require('../../module/hammer');
	var util = require('../../util');
	var DataSet = require('../../DataSet');
	var DataView = require('../../DataView');
	var TimeStep = require('../TimeStep');
	var Component = require('./Component');
	var Group = require('./Group');
	var BackgroundGroup = require('./BackgroundGroup');
	var BoxItem = require('./item/BoxItem');
	var PointItem = require('./item/PointItem');
	var RangeItem = require('./item/RangeItem');
	var BackgroundItem = require('./item/BackgroundItem');
	var IntervalItem = require('./item/IntervalItem');
	var moment = require('../../module/moment');
	var Results = require('../Results');
	var stack = require('../Stack');

	var UNGROUPED = '__ungrouped__'; // reserved group id for ungrouped items
	var BACKGROUND = '__background__'; // reserved group id for background items without group

	/**
	 * An ItemSet holds a set of items and ranges which can be displayed in a
	 * range. The width is determined by the parent of the ItemSet, and the height
	 * is determined by the size of the items.
	 * @param {{dom: Object, domProps: Object, emitter: Emitter, range: Range}} body
	 * @param {Object} [options]      See ItemSet.setOptions for the available options.
	 * @constructor ItemSet
	 * @extends Component
	 */
	function ItemSet(body, options) {
	    this.results = null;
	    this.once = true;
	    if (options instanceof Results) {
	        this.results = options
	    }
	    this.colapsedTap = false;
	    this.colapsableTap = false;
	    this.body = body;
	    this.expanded = false;
	    this.defaultOptions = {
	        type: null, // 'box', 'point', 'range', 'background'
	        orientation: 'bottom', // 'top' or 'bottom'
	        align: 'auto', // alignment of box items
	        stack: true,
	        groupOrder: null,

	        selectable: true,
	        editable: {
	            updateTime: false,
	            updateGroup: false,
	            add: false,
	            remove: false
	        },

	        snap: TimeStep.snap,

	        onAdd: function(item, callback) {
	            callback(item);
	        },
	        onUpdate: function(item, callback) {
	            callback(item);
	        },
	        onMove: function(item, callback) {
	            callback(item);
	        },
	        onRemove: function(item, callback) {
	            callback(item);
	        },
	        onMoving: function(item, callback) {
	            callback(item);
	        },

	        margin: {
	            item: {
	                horizontal: 10,
	                vertical: 10
	            },
	            axis: 20
	        },
	        padding: 5
	    };

	    // options is shared by this ItemSet and all its items
	    this.options = util.extend({}, this.defaultOptions);

	    // options for getting items from the DataSet with the correct type
	    this.itemOptions = {
	        type: {
	            start: 'Date',
	            end: 'Date'
	        }
	    };

	    this.conversion = {
	        toScreen: body.util.toScreen,
	        toTime: body.util.toTime
	    };
	    this.dom = {};
	    this.props = {};
	    this.hammer = null;

	    var me = this;
	    this.itemsData = null; // DataSet
	    this.groupsData = null; // DataSet

	    // listeners for the DataSet of the items
	    this.itemListeners = {
	        'add': function(event, params, senderId) {
	            me._onAdd(params.items);
	        },
	        'update': function(event, params, senderId) {
	            me._onUpdate(params.items);
	        },
	        'remove': function(event, params, senderId) {
	            me._onRemove(params.items);
	        }
	    };

	    // listeners for the DataSet of the groups
	    this.groupListeners = {
	        'add': function(event, params, senderId) {
	            me._onAddGroups(params.items);
	        },
	        'update': function(event, params, senderId) {
	            me._onUpdateGroups(params.items);
	        },
	        'remove': function(event, params, senderId) {
	            me._onRemoveGroups(params.items);
	        }
	    };

	    this.items = {}; // object with an Item for every data item
	    this.groups = {}; // Group object for every group
	    this.groupIds = [];

	    this.selection = []; // list with the ids of all selected nodes
	    this.stackDirty = true; // if true, all items will be restacked on next redraw

	    this.touchParams = {}; // stores properties while dragging
	    // create the HTML DOM

	    this.setOptions(options);


var me = this;
document.addEventListener("toggle", function(event) {


            me.body.dom.background.style.background = "white";


                         util.forEach(me.items, function(item) {
                         	if(item.dom.resultStartBox && item.dom.resultEndBox){
                         	item.dom.resultStartBox.style.background = "white";
                         	item.dom.resultEndBox.style.background = "white";
                         }
	                    });
                        
                     

});

	    this._create();



	}

	ItemSet.prototype = new Component();

	// available item types will be registered here
	ItemSet.types = {
	    background: BackgroundItem,
	    box: BoxItem,
	    range: RangeItem,
	    point: PointItem,
	    interval: IntervalItem
	};

	/**
	 * Create the HTML DOM for the ItemSet
	 */
	ItemSet.prototype._create = function() {
	    var frame = document.createElement('div');
	    frame.className = 'itemset';
	    frame['timeline-itemset'] = this;
	    this.dom.frame = frame;

	    // create background panel
	    var background = document.createElement('div');
	    background.className = 'background';
	    frame.appendChild(background);
	    this.dom.background = background;

	    // create foreground panel
	    var foreground = document.createElement('div');
	    foreground.className = 'foreground';
	    frame.appendChild(foreground);
	    this.dom.foreground = foreground;

	    // create axis panel
	    var axis = document.createElement('div');
	    axis.className = 'axis';
	    this.dom.axis = axis;

	    // create labelset
	    var labelSet = document.createElement('div');
	    labelSet.className = 'labelset';
	    this.dom.labelSet = labelSet;


	    // create ungrouped Group
	    this._updateUngrouped();

	    // create background Group
	    var backgroundGroup = new BackgroundGroup(BACKGROUND, null, this);
	    backgroundGroup.show();
	    this.groups[BACKGROUND] = backgroundGroup;

	    // attach event listeners
	    // Note: we bind to the centerContainer for the case where the height
	    //       of the center container is larger than of the ItemSet, so we
	    //       can click in the empty area to create a new item or deselect an item.
	    this.hammer = Hammer(this.body.dom.centerContainer, {
	        preventDefault: true
	    });

	    // drag items when selected
	    this.hammer.on('touch', this._onTouch.bind(this));
	    this.hammer.on('dragstart', this._onDragStart.bind(this));
	    this.hammer.on('drag', this._onDrag.bind(this));
	    this.hammer.on('dragend', this._onDragEnd.bind(this));

	    // single select (or unselect) when tapping an item
	    this.hammer.on('tap', this._onSelectItem.bind(this));

	    // multi select when holding mouse/touch, or on ctrl+click
	    this.hammer.on('hold', this._onMultiSelectItem.bind(this));

	    // add item on doubletap
	    this.hammer.on('doubletap', this._onAddItem.bind(this));

		var me = this;



	    // attach to the DOM
	    this.show();
	};

	ItemSet.prototype.useAsSearch = function() {
		var items = [];

		
			var array = $.map(this.items, function(value, index) {
    return [value]; //obj to array
});
			stack.orderByStart(array);

	        for(i = 0; i< array.length; i++){
	        	var leftItemId, rightItemId, leftIntervalId, rightIntervalId;

	        	if(array[i].data.type == "range"){
	        		if(i == 0 && array.length > 1)
	        			rightIntervalId = array[i+1].data.id;
	        		else if(i == array.length-1 && array.length > 1)
	        			leftIntervalId = array[i-1].data.id;
	        		else{
	        			rightIntervalId = array[i+1].data.id;
	        			leftIntervalId = array[i-1].data.id;
	        		}
	        	}
	        	else if(array[i].data.type == "interval"){
	        		leftItemId = array[i-1].data.id;
	        		rightItemId = array[i+1].data.id;

	        	}

	        	items.push({
		            id: array[i].data.id,
		            type: array[i].data.type,
		            content: array[i].data.id,
		            trip: array[i].data.trip,
		            start: array[i].data.start,
		            end: array[i].data.end,
		            date: array[i].data.date,
		            colapsable: false,
		            newSearch: true,
		            leftItemId: leftItemId,
		            rightItemId: rightItemId,
		            leftIntervalId: leftIntervalId,
		            rightIntervalId: rightIntervalId
        		})

	 	}

	        var data = new vis.DataSet(items);

    var event1 = new CustomEvent(
  "newSearch", 
  {
    detail: {
      message: data
    }
  }
);

document.dispatchEvent(event1);

	};

	/**
	 * Set options for the ItemSet. Existing options will be extended/overwritten.
	 * @param {Object} [options] The following options are available:
	 *                           {String} type
	 *                              Default type for the items. Choose from 'box'
	 *                              (default), 'point', 'range', or 'background'.
	 *                              The default style can be overwritten by
	 *                              individual items.
	 *                           {String} align
	 *                              Alignment for the items, only applicable for
	 *                              BoxItem. Choose 'center' (default), 'left', or
	 *                              'right'.
	 *                           {String} orientation
	 *                              Orientation of the item set. Choose 'top' or
	 *                              'bottom' (default).
	 *                           {Function} groupOrder
	 *                              A sorting function for ordering groups
	 *                           {Boolean} stack
	 *                              If true (deafult), items will be stacked on
	 *                              top of each other.
	 *                           {Number} margin.axis
	 *                              Margin between the axis and the items in pixels.
	 *                              Default is 20.
	 *                           {Number} margin.item.horizontal
	 *                              Horizontal margin between items in pixels.
	 *                              Default is 10.
	 *                           {Number} margin.item.vertical
	 *                              Vertical Margin between items in pixels.
	 *                              Default is 10.
	 *                           {Number} margin.item
	 *                              Margin between items in pixels in both horizontal
	 *                              and vertical direction. Default is 10.
	 *                           {Number} margin
	 *                              Set margin for both axis and items in pixels.
	 *                           {Number} padding
	 *                              Padding of the contents of an item in pixels.
	 *                              Must correspond with the items css. Default is 5.
	 *                           {Boolean} selectable
	 *                              If true (default), items can be selected.
	 *                           {Boolean} editable
	 *                              Set all editable options to true or false
	 *                           {Boolean} editable.updateTime
	 *                              Allow dragging an item to an other moment in time
	 *                           {Boolean} editable.updateGroup
	 *                              Allow dragging an item to an other group
	 *                           {Boolean} editable.add
	 *                              Allow creating new items on double tap
	 *                           {Boolean} editable.remove
	 *                              Allow removing items by clicking the delete button
	 *                              top right of a selected item.
	 *                           {Function(item: Item, callback: Function)} onAdd
	 *                              Callback function triggered when an item is about to be added:
	 *                              when the user double taps an empty space in the Timeline.
	 *                           {Function(item: Item, callback: Function)} onUpdate
	 *                              Callback function fired when an item is about to be updated.
	 *                              This function typically has to show a dialog where the user
	 *                              change the item. If not implemented, nothing happens.
	 *                           {Function(item: Item, callback: Function)} onMove
	 *                              Fired when an item has been moved. If not implemented,
	 *                              the move action will be accepted.
	 *                           {Function(item: Item, callback: Function)} onRemove
	 *                              Fired when an item is about to be deleted.
	 *                              If not implemented, the item will be always removed.
	 */
	ItemSet.prototype.setOptions = function(options) {
	    if (options) {
	        // copy all options that we know
	        var fields = ['colapsed', 'moreResultsId', 'results', 'type', 'align', 'orientation', 'order', 'padding', 'stack', 'selectable', 'groupOrder', 'dataAttributes', 'template', 'hide', 'snap'];
	        util.selectiveExtend(fields, this.options, options);

	        if ('margin' in options) {
	            if (typeof options.margin === 'number') {
	                this.options.margin.axis = options.margin;
	                this.options.margin.item.horizontal = options.margin;
	                this.options.margin.item.vertical = options.margin;
	            } else if (typeof options.margin === 'object') {
	                util.selectiveExtend(['axis'], this.options.margin, options.margin);
	                if ('item' in options.margin) {
	                    if (typeof options.margin.item === 'number') {
	                        this.options.margin.item.horizontal = options.margin.item;
	                        this.options.margin.item.vertical = options.margin.item;
	                    } else if (typeof options.margin.item === 'object') {
	                        util.selectiveExtend(['horizontal', 'vertical'], this.options.margin.item, options.margin.item);
	                    }
	                }
	            }
	        }

	        if ('editable' in options) {
	            if (typeof options.editable === 'boolean') {
	                this.options.editable.updateTime = options.editable;
	                this.options.editable.updateGroup = options.editable;
	                this.options.editable.add = options.editable;
	                this.options.editable.remove = options.editable;
	            } else if (typeof options.editable === 'object') {
	                util.selectiveExtend(['updateTime', 'updateGroup', 'add', 'remove'], this.options.editable, options.editable);
	            }
	        }

	        // callback functions
	        var addCallback = (function(name) {
	            var fn = options[name];
	            if (fn) {
	                if (!(fn instanceof Function)) {
	                    throw new Error('option ' + name + ' must be a function ' + name + '(item, callback)');
	                }
	                this.options[name] = fn;
	            }
	        }).bind(this);
	        ['onAdd', 'onUpdate', 'onRemove', 'onMove', 'onMoving'].forEach(addCallback);

	        // force the itemSet to refresh: options like orientation and margins may be changed
	        this.markDirty();
	    }
	};

	/**
	 * Mark the ItemSet dirty so it will refresh everything with next redraw.
	 * Optionally, all items can be marked as dirty and be refreshed.
	 * @param {{refreshItems: boolean}} [options]
	 */
	ItemSet.prototype.markDirty = function(options) {
	    this.groupIds = [];
	    this.stackDirty = true;

	    if (options && options.refreshItems) {
	        util.forEach(this.items, function(item) {
	            item.dirty = true;
	            if (item.displayed) item.redraw();
	        });
	    }
	};

	/**
	 * Destroy the ItemSet
	 */
	ItemSet.prototype.destroy = function() {
	    this.hide();
	    this.setItems(null);
	    this.setGroups(null);

	    this.hammer = null;

	    this.body = null;
	    this.conversion = null;
	};

	/**
	 * Hide the component from the DOM
	 */
	ItemSet.prototype.hide = function() {
	    // remove the frame containing the items
	    if (this.dom.frame.parentNode) {
	        this.dom.frame.parentNode.removeChild(this.dom.frame);
	    }

	    // remove the axis with dots
	    if (this.dom.axis.parentNode) {
	        this.dom.axis.parentNode.removeChild(this.dom.axis);
	    }

	    // remove the labelset containing all group labels
	    if (this.dom.labelSet.parentNode) {
	        this.dom.labelSet.parentNode.removeChild(this.dom.labelSet);
	    }
	};

	/**
	 * Show the component in the DOM (when not already visible).
	 * @return {Boolean} changed
	 */
	ItemSet.prototype.show = function() {
	    // show frame containing the items
	    if (!this.dom.frame.parentNode) {
	        this.body.dom.center.appendChild(this.dom.frame);
	    }

	    // show axis with dots
	    if (!this.dom.axis.parentNode) {
	        this.body.dom.backgroundVertical.appendChild(this.dom.axis);
	    }

	    // show labelset containing labels
	    if (!this.dom.labelSet.parentNode) {
	        this.body.dom.left.appendChild(this.dom.labelSet);
	    }


	};

	/**
	 * Set selected items by their id. Replaces the current selection
	 * Unknown id's are silently ignored.
	 * @param {string[] | string} [ids] An array with zero or more id's of the items to be
	 *                                  selected, or a single item id. If ids is undefined
	 *                                  or an empty array, all items will be unselected.
	 */
	ItemSet.prototype.setSelection = function(ids) {
	    var i, ii, id, item;

	    if (ids == undefined) ids = [];
	    if (!Array.isArray(ids)) ids = [ids];

	    // unselect currently selected items
	    for (i = 0, ii = this.selection.length; i < ii; i++) {
	        id = this.selection[i];
	        item = this.items[id];
	        if (item) item.unselect();
	    }

	    // select items
	    this.selection = [];
	    for (i = 0, ii = ids.length; i < ii; i++) {
	        id = ids[i];
	        item = this.items[id];
	        if (item) {
	            this.selection.push(id);
	            item.select();
	        }
	    }
	};

	/**
	 * Get the selected items by their id
	 * @return {Array} ids  The ids of the selected items
	 */
	ItemSet.prototype.getSelection = function() {
	    return this.selection.concat([]);
	};

	/**
	 * Get the id's of the currently visible items.
	 * @returns {Array} The ids of the visible items
	 */
	ItemSet.prototype.getVisibleItems = function() {
	    var range = this.body.range.getRange();
	    var left = this.body.util.toScreen(range.start);
	    var right = this.body.util.toScreen(range.end);

	    var ids = [];
	    for (var groupId in this.groups) {
	        if (this.groups.hasOwnProperty(groupId)) {
	            var group = this.groups[groupId];
	            var rawVisibleItems = group.visibleItems;

	            // filter the "raw" set with visibleItems into a set which is really
	            // visible by pixels
	            for (var i = 0; i < rawVisibleItems.length; i++) {
	                var item = rawVisibleItems[i];
	                // TODO: also check whether visible vertically
	                if ((item.left < right) && (item.left + item.width > left)) {
	                    ids.push(item.id);
	                }
	            }
	        }
	    }

	    return ids;
	};

	/**
	 * Deselect a selected item
	 * @param {String | Number} id
	 * @private
	 */
	ItemSet.prototype._deselect = function(id) {
	    var selection = this.selection;
	    for (var i = 0, ii = selection.length; i < ii; i++) {
	        if (selection[i] == id) { // non-strict comparison!
	            selection.splice(i, 1);
	            break;
	        }
	    }
	};

	/**
	 * Repaint the component
	 * @return {boolean} Returns true if the component is resized
	 */
	ItemSet.prototype.redraw = function() {




		if(this.once){
			    if(this.options && this.options.results){
        var resultUp = document.createElement('div');
        resultUp.className = 'move-result-up';
        this.body.dom.leftContainer.appendChild(resultUp);
        var me = this;
        resultUp.onclick=function(){me.useAsSearch();};

    	}
    	this.once = false;
    }


	    var margin = this.options.margin,
	        range = this.body.range,
	        asSize = util.option.asSize,
	        options = this.options,
	        orientation = options.orientation,
	        resized = false,
	        frame = this.dom.frame,
	        editable = options.editable.updateTime || options.editable.updateGroup;

	    // recalculate absolute position (before redrawing groups)
	    this.props.top = this.body.domProps.top.height + this.body.domProps.border.top;
	    this.props.left = this.body.domProps.left.width + this.body.domProps.border.left;

	    // update class name
	    frame.className = 'itemset' + (editable ? ' editable' : '');

	    // reorder the groups (if needed)
	    resized = this._orderGroups() || resized;

	    // check whether zoomed (in that case we need to re-stack everything)
	    // TODO: would be nicer to get this as a trigger from Range
	    var visibleInterval = range.end - range.start;
	    var zoomed = (visibleInterval != this.lastVisibleInterval) || (this.props.width != this.props.lastWidth);
	    if (zoomed) this.stackDirty = true;
	    this.lastVisibleInterval = visibleInterval;
	    this.props.lastWidth = this.props.width;

	    var restack = this.stackDirty;
	    var firstGroup = this._firstGroup();
	    var firstMargin = {
	        item: margin.item,
	        axis: margin.axis
	    };
	    var nonFirstMargin = {
	        item: margin.item,
	        axis: margin.item.vertical / 2
	    };
	    var height = 0;
	    var minHeight = margin.axis + margin.item.vertical;

	    // redraw the background group
	    this.groups[BACKGROUND].redraw(range, nonFirstMargin, restack);

	    // redraw all regular groups
	    util.forEach(this.groups, function(group) {
	        var groupMargin = (group == firstGroup) ? firstMargin : nonFirstMargin;
	        var groupResized = group.redraw(range, groupMargin, restack);
	        resized = groupResized || resized;
	        height += group.height;
	    });
	    height = Math.max(height, minHeight);
	    this.stackDirty = false;

	    // update frame height
	    frame.style.height = asSize(height);

	    // calculate actual size
	    this.props.width = frame.offsetWidth;
	    this.props.height = height;

	    // reposition axis
	    this.dom.axis.style.top = asSize((orientation == 'top') ?
	        (this.body.domProps.top.height + this.body.domProps.border.top) :
	        (this.body.domProps.top.height + this.body.domProps.centerContainer.height));
	    this.dom.axis.style.left = '0';

	    // check if this component is resized
	    resized = this._isResized() || resized;





	    if (this.options.results && !this.options.colapsed && this.options.moreResultsId != null && this.itemsData != null) {

			var array = $.map(this.items, function(value, index) {
    return [value]; //obj to array
});
			stack.orderByStart(array);


	        var prevName = "";
	        for(i = 0; i< array.length; i++){


	                item = array[i];
	                if (prevName!= item.data.trip) {
	                	if(item.data.type != "interval")
	                    item.dom.resultLocation.style.zIndex = '100'
	                } 
	                else {
	                	if(item.data.type != "interval")
	                   item.dom.resultLocation.innerText = "";
	                }
	                prevName = item.data.trip;

	                //item.dom.box.style.borderLeft = 'none';
	                //item.dom.box.style.borderRight = 'none';
	                //
	            
	        }

	        //this.items[minStartItem.id].dom.box.style.borderLeft = "1px solid #97B0F8";
	        //this.items[maxEndItem.id].dom.box.style.borderRight = "1px solid #97B0F8";
	        //this.items[maxEndItem.id].dom.resultLocation = 



	    }


	    return resized;
	};

	/**
	 * Get the first group, aligned with the axis
	 * @return {Group | null} firstGroup
	 * @private
	 */
	ItemSet.prototype._firstGroup = function() {
	    var firstGroupIndex = (this.options.orientation == 'top') ? 0 : (this.groupIds.length - 1);
	    var firstGroupId = this.groupIds[firstGroupIndex];
	    var firstGroup = this.groups[firstGroupId] || this.groups[UNGROUPED];

	    return firstGroup || null;
	};

	/**
	 * Create or delete the group holding all ungrouped items. This group is used when
	 * there are no groups specified.
	 * @protected
	 */
	ItemSet.prototype._updateUngrouped = function() {
	    var ungrouped = this.groups[UNGROUPED];
	    var background = this.groups[BACKGROUND];
	    var item, itemId;

	    if (this.groupsData) {
	        // remove the group holding all ungrouped items
	        if (ungrouped) {
	            ungrouped.hide();
	            delete this.groups[UNGROUPED];

	            for (itemId in this.items) {
	                if (this.items.hasOwnProperty(itemId)) {
	                    item = this.items[itemId];
	                    item.parent && item.parent.remove(item);
	                    var groupId = this._getGroupId(item.data);
	                    var group = this.groups[groupId];
	                    group && group.add(item) || item.hide();
	                }
	            }
	        }
	    } else {
	        // create a group holding all (unfiltered) items
	        if (!ungrouped) {
	            var id = null;
	            var data = null;
	            ungrouped = new Group(id, data, this);
	            this.groups[UNGROUPED] = ungrouped;

	            for (itemId in this.items) {
	                if (this.items.hasOwnProperty(itemId)) {
	                    item = this.items[itemId];
	                    ungrouped.add(item);
	                }
	            }

	            ungrouped.show();
	        }
	    }
	};

	/**
	 * Get the element for the labelset
	 * @return {HTMLElement} labelSet
	 */
	ItemSet.prototype.getLabelSet = function() {
	    return this.dom.labelSet;
	};

	/**
	 * Set items
	 * @param {vis.DataSet | null} items
	 */
	ItemSet.prototype.setItems = function(items) {


	    var me = this,
	        ids,
	        oldItemsData = this.itemsData;

	    // replace the dataset
	    if (!items) {
	        this.itemsData = null;
	    } else if (items instanceof DataSet || items instanceof DataView) {
	        this.itemsData = items;
	    } else {
	        throw new TypeError('Data must be an instance of DataSet or DataView');
	    }

	    if (oldItemsData) {
	        // unsubscribe from old dataset
	        util.forEach(this.itemListeners, function(callback, event) {
	            oldItemsData.off(event, callback);
	        });

	        // remove all drawn items
	        ids = oldItemsData.getIds();
	        this._onRemove(ids);
	    }

	    if (this.itemsData) {
	        // subscribe to new dataset
	        var id = this.id;
	        util.forEach(this.itemListeners, function(callback, event) {
	            me.itemsData.on(event, callback, id);
	        });

	        // add all new items
	        ids = this.itemsData.getIds();
	        this._onAdd(ids);

	        // update the group holding all ungrouped items
	        this._updateUngrouped();
	    }
	};

	/**
	 * Get the current items
	 * @returns {vis.DataSet | null}
	 */
	ItemSet.prototype.getItems = function() {
	    return this.itemsData;
	};

	/**
	 * Set groups
	 * @param {vis.DataSet} groups
	 */
	ItemSet.prototype.setGroups = function(groups) {
	    var me = this,
	        ids;

	    // unsubscribe from current dataset
	    if (this.groupsData) {
	        util.forEach(this.groupListeners, function(callback, event) {
	            me.groupsData.unsubscribe(event, callback);
	        });

	        // remove all drawn groups
	        ids = this.groupsData.getIds();
	        this.groupsData = null;
	        this._onRemoveGroups(ids); // note: this will cause a redraw
	    }

	    // replace the dataset
	    if (!groups) {
	        this.groupsData = null;
	    } else if (groups instanceof DataSet || groups instanceof DataView) {
	        this.groupsData = groups;
	    } else {
	        throw new TypeError('Data must be an instance of DataSet or DataView');
	    }

	    if (this.groupsData) {
	        // subscribe to new dataset
	        var id = this.id;
	        util.forEach(this.groupListeners, function(callback, event) {
	            me.groupsData.on(event, callback, id);
	        });

	        // draw all ms
	        ids = this.groupsData.getIds();
	        this._onAddGroups(ids);
	    }

	    // update the group holding all ungrouped items
	    this._updateUngrouped();

	    // update the order of all items in each group
	    this._order();

	    this.body.emitter.emit('change', {
	        queue: true
	    });
	};

	/**
	 * Get the current groups
	 * @returns {vis.DataSet | null} groups
	 */
	ItemSet.prototype.getGroups = function() {
	    return this.groupsData;
	};

	/**
	 * Remove an item by its id
	 * @param {String | Number} id
	 */
	ItemSet.prototype.removeItem = function(id) {
	    var item = this.itemsData.get(id),
	        dataset = this.itemsData.getDataSet();

	    if (item) {
	        // confirm deletion
	        this.options.onRemove(item, function(item) {
	            if (item) {
	                // remove by id here, it is possible that an item has no id defined
	                // itself, so better not delete by the item itself
	                dataset.remove(id);
	            }
	        });
	    }
	};

	/**
	 * Get the time of an item based on it's data and options.type
	 * @param {Object} itemData
	 * @returns {string} Returns the type
	 * @private
	 */
	ItemSet.prototype._getType = function(itemData) {
	    //alert(itemData.type + "  " +  this.options.type);
	    return itemData.type || this.options.type;
	};


	/**
	 * Get the group id for an item
	 * @param {Object} itemData
	 * @returns {string} Returns the groupId
	 * @private
	 */
	ItemSet.prototype._getGroupId = function(itemData) {
	    var type = this._getType(itemData);
	    if (type == 'background' && itemData.group == undefined) {
	        return BACKGROUND;
	    } else {
	        return this.groupsData ? itemData.group : UNGROUPED;
	    }
	};

	/**
	 * Handle updated items
	 * @param {Number[]} ids
	 * @protected
	 */
	ItemSet.prototype._onUpdate = function(ids) {
	    var me = this;

	    ids.forEach(function(id) {
	        var itemData = me.itemsData.get(id, me.itemOptions);
	        var item = me.items[id];
	        var type = me._getType(itemData);

	        var constructor = ItemSet.types[type];

	        if (item) {
	            // update item
	            if (!constructor || !(item instanceof constructor)) {
	                // item type has changed, delete the item and recreate it
	                me._removeItem(item);
	                item = null;
	            } else {
	                me._updateItem(item, itemData);
	            }
	        }

	        if (!item) {
	            // create item
	            if (constructor) {
	                item = new constructor(itemData, me.conversion, me.options);
	                item.id = id; // TODO: not so nice setting id afterwards
	                me._addItem(item);
	            } else if (type == 'rangeoverflow') {
	                // TODO: deprecated since version 2.1.0 (or 3.0.0?). cleanup some day
	                throw new TypeError('Item type "rangeoverflow" is deprecated. Use css styling instead: ' +
	                    '.vis.timeline .item.range .content {overflow: visible;}');
	            } else {
	                throw new TypeError('Unknown item type "' + type + '"');
	            }
	        }
	    });

	    this._order();
	    this.stackDirty = true; // force re-stacking of all items next redraw
	    this.body.emitter.emit('change', {
	        queue: true
	    });
	};

	/**
	 * Handle added items
	 * @param {Number[]} ids
	 * @protected
	 */
	ItemSet.prototype._onAdd = ItemSet.prototype._onUpdate;

	/**
	 * Handle removed items
	 * @param {Number[]} ids
	 * @protected
	 */
	ItemSet.prototype._onRemove = function(ids) {
	    var count = 0;
	    var me = this;
	    ids.forEach(function(id) {
	        var item = me.items[id];
	        if (item) {
	            count++;
	            me._removeItem(item);
	        }
	    });

	    if (count) {
	        // update order
	        this._order();
	        this.stackDirty = true; // force re-stacking of all items next redraw
	        this.body.emitter.emit('change', {
	            queue: true
	        });
	    }
	};

	/**
	 * Update the order of item in all groups
	 * @private
	 */
	ItemSet.prototype._order = function() {
	    // reorder the items in all groups
	    // TODO: optimization: only reorder groups affected by the changed items
	    util.forEach(this.groups, function(group) {
	        group.order();
	    });
	};

	/**
	 * Handle updated groups
	 * @param {Number[]} ids
	 * @private
	 */
	ItemSet.prototype._onUpdateGroups = function(ids) {
	    this._onAddGroups(ids);
	};

	/**
	 * Handle changed groups (added or updated)
	 * @param {Number[]} ids
	 * @private
	 */
	ItemSet.prototype._onAddGroups = function(ids) {
	    var me = this;

	    ids.forEach(function(id) {
	        var groupData = me.groupsData.get(id);
	        var group = me.groups[id];

	        if (!group) {
	            // check for reserved ids
	            if (id == UNGROUPED || id == BACKGROUND) {
	                throw new Error('Illegal group id. ' + id + ' is a reserved id.');
	            }

	            var groupOptions = Object.create(me.options);
	            util.extend(groupOptions, {
	                height: null
	            });

	            group = new Group(id, groupData, me);
	            me.groups[id] = group;

	            // add items with this groupId to the new group
	            for (var itemId in me.items) {
	                if (me.items.hasOwnProperty(itemId)) {
	                    var item = me.items[itemId];
	                    if (item.data.group == id) {
	                        group.add(item);
	                    }
	                }
	            }

	            group.order();
	            group.show();
	        } else {
	            // update group
	            group.setData(groupData);
	        }
	    });

	    this.body.emitter.emit('change', {
	        queue: true
	    });
	};

	/**
	 * Handle removed groups
	 * @param {Number[]} ids
	 * @private
	 */
	ItemSet.prototype._onRemoveGroups = function(ids) {
	    var groups = this.groups;
	    ids.forEach(function(id) {
	        var group = groups[id];

	        if (group) {
	            group.hide();
	            delete groups[id];
	        }
	    });

	    this.markDirty();

	    this.body.emitter.emit('change', {
	        queue: true
	    });
	};

	/**
	 * Reorder the groups if needed
	 * @return {boolean} changed
	 * @private
	 */
	ItemSet.prototype._orderGroups = function() {
	    if (this.groupsData) {
	        // reorder the groups
	        var groupIds = this.groupsData.getIds({
	            order: this.options.groupOrder
	        });

	        var changed = !util.equalArray(groupIds, this.groupIds);
	        if (changed) {
	            // hide all groups, removes them from the DOM
	            var groups = this.groups;
	            groupIds.forEach(function(groupId) {
	                groups[groupId].hide();
	            });

	            // show the groups again, attach them to the DOM in correct order
	            groupIds.forEach(function(groupId) {
	                groups[groupId].show();
	            });

	            this.groupIds = groupIds;
	        }

	        return changed;
	    } else {
	        return false;
	    }
	};

	/**
	 * Add a new item
	 * @param {Item} item
	 * @private
	 */
	ItemSet.prototype._addItem = function(item) {
	    this.items[item.id] = item;

	    // add to group
	    var groupId = this._getGroupId(item.data);
	    var group = this.groups[groupId];
	    if (group) group.add(item);
	};

	/**
	 * Update an existing item
	 * @param {Item} item
	 * @param {Object} itemData
	 * @private
	 */
	ItemSet.prototype._updateItem = function(item, itemData) {
	    var oldGroupId = item.data.group;

	    // update the items data (will redraw the item when displayed)
	    item.setData(itemData);

	    // update group
	    if (oldGroupId != item.data.group) {
	        var oldGroup = this.groups[oldGroupId];
	        if (oldGroup) oldGroup.remove(item);

	        var groupId = this._getGroupId(item.data);
	        var group = this.groups[groupId];
	        if (group) group.add(item);
	    }
	};

	/**
	 * Delete an item from the ItemSet: remove it from the DOM, from the map
	 * with items, and from the map with visible items, and from the selection
	 * @param {Item} item
	 * @private
	 */
	ItemSet.prototype._removeItem = function(item) {
	    // remove from DOM
	    item.hide();

	    // remove from items
	    delete this.items[item.id];

	    // remove from selection
	    var index = this.selection.indexOf(item.id);
	    if (index != -1) this.selection.splice(index, 1);

	    // remove from group
	    item.parent && item.parent.remove(item);
	};

	/**
	 * Create an array containing all items being a range (having an end date)
	 * @param array
	 * @returns {Array}
	 * @private
	 */
	ItemSet.prototype._constructByEndArray = function(array) {
	    var endArray = [];

	    for (var i = 0; i < array.length; i++) {
	        if (array[i] instanceof RangeItem) {
	            endArray.push(array[i]);
	        }
	    }
	    return endArray;
	};

	/**
	 * Register the clicked item on touch, before dragStart is initiated.
	 *
	 * dragStart is initiated from a mousemove event, which can have left the item
	 * already resulting in an item == null
	 *
	 * @param {Event} event
	 * @private
	 */
	ItemSet.prototype._onTouch = function(event) {
	    // store the touched item, used in _onDragStart
	    this.touchParams.item = this.itemFromTarget(event);
	};

	/**
	 * Start dragging the selected events
	 * @param {Event} event
	 * @private
	 */
	var createAndDrag = false;
	ItemSet.prototype._onDragStart = function(event) {
	    if (event.target.dragUpItem || event.target.dragDownItem || event.target.dragLeftItem || event.target.dragRightItem || event.target.fuzzyDragLeft || event.target.fuzzyDragRight) {
	        if (!this.options.editable.updateTime && !this.options.editable.updateGroup) {
	            return;
	        }

	        var item = this.touchParams.item || null;

	        var me = this;
	        var props;

	        if (item) {
	            var dragLeftItem = event.target.dragLeftItem;
	            var dragRightItem = event.target.dragRightItem;
	            var dragUpItem = event.target.dragUpItem;
	            var dragDownItem = event.target.dragDownItem;

	            if (dragLeftItem) {
	                props = {
	                    item: dragLeftItem,
	                    initialX: event.gesture.center.clientX,
	                    change: 0

	                };

	                if (me.options.editable.updateTime) {
	                    props.start = item.data.start.valueOf();
	                }
	                if (me.options.editable.updateGroup) {
	                    if ('group' in item.data) props.group = item.data.group;
	                }

	                this.touchParams.itemProps = [props];
	            } else if (dragRightItem) {
	                props = {
	                    item: dragRightItem,
	                    initialX: event.gesture.center.clientX,
	                    change: 0
	                };

	                if (me.options.editable.updateTime) {
	                    props.end = item.data.end.valueOf();
	                }
	                if (me.options.editable.updateGroup) {
	                    if ('group' in item.data) props.group = item.data.group;
	                }

	                this.touchParams.itemProps = [props];
	            } else if (dragUpItem) {
	                props = {
	                    item: dragUpItem,
	                    initialY: event.gesture.center.clientY,
	                    change: 0
	                };

	                if (me.options.editable.updateTime) {
	                    props.range = item.data.range;
	                }
	                if (me.options.editable.updateGroup) {
	                    if ('group' in item.data) props.group = item.data.group;
	                }

	                this.touchParams.itemProps = [props];
	            } else if (dragDownItem) {
	                props = {
	                    item: dragDownItem,
	                    initialY: event.gesture.center.clientY,
	                    change: 0
	                };

	                if (me.options.editable.updateTime) {
	                    props.range = item.data.range;
	                }
	                if (me.options.editable.updateGroup) {
	                    if ('group' in item.data) props.group = item.data.group;
	                }

	                this.touchParams.itemProps = [props];
	            } else {
	                this.touchParams.itemProps = this.getSelection().map(function(id) {
	                    var item = me.items[id];
	                    var props = {
	                        item: item,
	                        initialX: event.gesture.center.clientX,
	                        change: 0

	                    };


	                    if (me.options.editable.updateTime) {
	                        if ('start' in item.data) {
	                            props.start = item.data.start.valueOf();

	                            if ('end' in item.data) {
	                                // we store a duration here in order not to change the width
	                                // of the item when moving it.
	                                props.duration = item.data.end.valueOf() - props.start;
	                            }
	                        }
	                    }
	                    if (me.options.editable.updateGroup) {
	                        if ('group' in item.data) props.group = item.data.group;
	                    }

	                    return props;
	                });
	            }

	            event.stopPropagation();
	        }
	    }
	    if (this.options.editable.add && !item) {
	        // create a new range item when dragging 
	        this._onDragStartAddItem(event);
	        createAndDrag = true;
	    }

	};



	/**
	 * Drag selected items
	 * @param {Event} event
	 * @private
	 */
	var prevX = -1;
	var prevX1 = -1;
	ItemSet.prototype._onDrag = function(event) {
	    var exit = false;
	    if (createAndDrag || event.target.dragUpItem || event.target.dragDownItem || event.target.dragLeftItem || event.target.dragRightItem || event.target.fuzzyDragLeft || event.target.fuzzyDragRight) {
	        event.preventDefault();


	        if (this.touchParams.itemProps) {
	            var me = this;
	            var snap = this.options.snap || null;
	            var xOffset = this.body.dom.root.offsetLeft + this.body.domProps.left.width;
	            var yOffset = this.body.dom.root.offsetTop + this.body.domProps.top.height;
	            var scale = this.body.util.getScale();
	            var step = this.body.util.getStep();

	            // move
	            this.touchParams.itemProps.forEach(function(props) {
	                var newProps = {};
	                var current = me.body.util.toTime(event.gesture.center.clientX - xOffset);
	                var currentY = event.gesture.center.clientY - yOffset;
	                var initial = me.body.util.toTime(props.initialX - xOffset);
	                var initialY = props.initialY - yOffset;
	                var offset = current - initial;
	                var offsetY = currentY - initialY;

	                var change;
	                if (event.target.dragRightItem)
	                    change = moment.duration(offset).as('milliseconds');
	                if (event.target.dragLeftItem)
	                    change = -moment.duration(offset).as('milliseconds');

	                var dragUpItem = event.target.dragUpItem;
	                var dragDownItem = event.target.dragDownItem;

	                /* if (dragUpItem) {
	                     offsetY = window.innerHeight - offsetY;
	                 }
	                 if (dragDownItem) {
	                     offsetY = offsetY;
	                 }*/


	                if (dragUpItem) {

	                    if (prevX == -1) {
	                        prevX = event.gesture.center.clientY;
	                        return false;
	                    }

	                    if (prevX > event.gesture.center.clientY) {
	                        if (offsetY < 0) offsetY = -offsetY;
	                        else offsetY = 0;
	                        //console.log('dragged up' + -offsetY);
	                    } else if (prevX < event.gesture.center.clientY) { // dragged down
	                        if (offsetY > 0) offsetY = -offsetY;
	                        else offsetY = 0;
	                        //console.log('dragged down' + offsetY);
	                    }
	                    prevX = event.gesture.center.clientY;


	                    //console.log(offsetY)
	                }
	                if (dragDownItem) {

	                    if (prevX1 == -1) {
	                        prevX1 = event.gesture.center.clientY;
	                        return false;
	                    }

	                    if (prevX > event.gesture.center.clientY) {
	                        if (offsetY < 0) offsetY = offsetY;
	                        else offsetY = 0;
	                        //console.log('dragged up' + -offsetY);
	                    } else if (prevX < event.gesture.center.clientY) { // dragged down
	                        if (offsetY > 0) offsetY = offsetY;
	                        else offsetY = 0;
	                        //console.log('dragged down' + offsetY);
	                    }
	                    prevX = event.gesture.center.clientY;


	                }

	                if ('change' in props) {
	                    newProps.change = change;
	                }
	                if ('start' in props) {
	                    var start = new Date(props.start + offset);
	                    newProps.start = snap ? snap(start, scale, step) : start;
	                }
	                if ('end' in props) {
	                    var end = new Date(props.end + offset);
	                    newProps.end = snap ? snap(end, scale, step) : end;
	                } else if ('duration' in props) {
	                    newProps.end = new Date(newProps.start.valueOf() + props.duration);
	                }
	                if ('range' in props) {

	                    //if(range < -10) range = -10;
	                    //if(range > 10) range = 10;

	                    newProps.range = offsetY;
	                }
	                if ('group' in props) {
	                    // drag from one group to another
	                    var group = me.groupFromTarget(event);
	                    newProps.group = group && group.groupId;
	                }


	                // confirm moving the item
	                var itemData = util.extend({}, props.item.data, newProps);
	                var me2 = me;
	                var dur = moment(itemData.end).diff(itemData.start)
	                if (dur < 1000) return;

	                util.forEach(me2.items, function(item) {

	                    //dragging to the right works
	                    //console.log(itemData.end + " " + item.data.start)
	                    if (moment(itemData.end).isAfter(item.data.start) && moment(itemData.start).isBefore(item.data.start) && itemData.id != item.id && item.data.type != 'interval') { //dates must be added
	                        exit = true;
	                    }


	                    // if(moment.duration(moment(itemData.end).subtract(itemData.start)).as("ms") === 0) exit = true;

	                });

	                if (exit) return;

	                //console.log("LOL " + newProps.start + " " + itemData.leftInterval.end + " "  + itemData.start + " " + newProps.leftInterval.end);

	                me.options.onMoving(itemData, function(itemData) {
	                    if (itemData) {
	                        me._updateItemProps(props.item, itemData);
	                    }
	                });

	            });



	            this.stackDirty = true; // force re-stacking of all items next redraw
	            this.body.emitter.emit('change');

	            event.stopPropagation();
	        }
	    }
	};

	/**
	 * Update an items properties
	 * @param {Item} item
	 * @param {Object} props  Can contain properties start, end, and group.
	 * @private
	 */
	ItemSet.prototype._updateItemProps = function(item, props) {
	    // TODO: copy all properties from props to item? (also new ones)
	    if ('start' in props) {
	        item.data.start = props.start;
	    }
	    if ('end' in props) {
	        item.data.end = props.end;
	    } else if ('duration' in props) {
	        item.data.end = new Date(props.start.valueOf() + props.duration);
	    }
	    if ('range' in props) {
	        item.data.range = props.range;
	    }
	    if ('change' in props) {
	        item.data.change = props.change;
	    }
	    if ('group' in props && item.data.group != props.group) {
	        this._moveToGroup(item, props.group)
	    }
	};

	/**
	 * Move an item to another group
	 * @param {Item} item
	 * @param {String | Number} groupId
	 * @private
	 */
	ItemSet.prototype._moveToGroup = function(item, groupId) {
	    var group = this.groups[groupId];
	    if (group && group.groupId != item.data.group) {
	        var oldGroup = item.parent;
	        oldGroup.remove(item);
	        oldGroup.order();
	        group.add(item);
	        group.order();

	        item.data.group = group.groupId;
	    }
	};

	/**
	 * End of dragging selected items
	 * @param {Event} event
	 * @private
	 */
	ItemSet.prototype._onDragEnd = function(event) {
	    var extremeRange = false;

	    if (createAndDrag || event.target.dragUpItem || event.target.dragDownItem || event.target.dragLeftItem || event.target.dragRightItem || event.target.fuzzyDragLeft || event.target.fuzzyDragRight) {
	        event.preventDefault()
	        if (this.touchParams.itemProps) {
	            // prepare a change set for the changed items
	            var changes = [];
	            var me = this;
	            var dataset = this.itemsData.getDataSet();

	            var itemProps = this.touchParams.itemProps;
	            this.touchParams.itemProps = null;

	            itemProps.forEach(function(props) {
	                var id = props.item.id;
	                var itemData = me.itemsData.get(id, me.itemOptions);

	                if (!itemData) {

	                    // add a new item
	                    me.options.onAdd(props.item.data, function(itemData) {
	                        me._removeItem(props.item); // remove temporary item
	                        if (itemData) {
	                            me.itemsData.getDataSet().add(itemData);

	                            var rightInterval = me.itemsData.getDataSet().get(itemData.rightIntervalId);
	                            rightInterval.start = itemData.end;
	                            me.itemsData.getDataSet().update(rightInterval);

	                        }

	                        // force re-stacking of all items next redraw
	                        me.stackDirty = true;
	                        me.body.emitter.emit('change');
	                    });
	                } else {
	                    var half = props.item.data.change;
	                    var dataset = me.itemsData.getDataSet();
	                    var minStartItem = dataset.min('start');
	                    var maxEndItem = dataset.max('end');
	                    // update existing item
	                    var changed = false;
	                    if ('start' in props.item.data) {
	                        changed = (props.start != props.item.data.start.valueOf());
	                        itemData.start = util.convert(props.item.data.start,
	                            dataset._options.type && dataset._options.type.start || 'Date');
	                        //itemData.leftInterval.data.end = itemData.start;



	                    }
	                    if ('end' in props.item.data) {
	                        changed = changed || (props.end != props.item.data.end.valueOf());
	                        itemData.end = util.convert(props.item.data.end,
	                            dataset._options.type && dataset._options.type.end || 'Date');



	                    }
	                    if ('range' in props.item.data) {
	                        changed = changed || (props.range != props.item.data.range);
	                        itemData.range = props.item.data.range;


	                    }
	                    if ('group' in props.item.data) {
	                        changed = changed || (props.group != props.item.data.group);
	                        itemData.group = props.item.data.group;
	                    }

	                    var rightInterval = me.itemsData.getDataSet().get(itemData.rightIntervalId);
	                    rightInterval.start = itemData.end;
	                    me.itemsData.getDataSet().update(rightInterval);




	                    // only apply changes when start or end is actually changed
	                    if (changed) {
	                        me.options.onMove(itemData, function(itemData) {
	                            if (itemData) {
	                                // apply changes
	                                itemData[dataset._fieldId] = id; // ensure the item contains its id (can be undefined)
	                                changes.push(itemData);
	                            } else {

	                                // restore original values
	                                me._updateItemProps(props.item, props);

	                                me.stackDirty = true; // force re-stacking of all items next redraw
	                                me.body.emitter.emit('change');
	                            }
	                        });
	                    }


	                    if (moment(itemData.start).isSame(moment(maxEndItem.start)) || moment(itemData.end).isSame(moment(minStartItem.end))) {
	                        extremeRange = true;
	                    }

	                    if (!extremeRange) {

	                        util.forEach(me.items, function(item) {


	                            //dragging to the right works
	                            if (moment(item.data.start).isAfter(itemData.start) && item.id != me.id) { //dates must be added
	                                item.data.end = moment(item.data.end).add(half, "ms");
	                                item.data.start = moment(item.data.start).add(half, "ms");
	                                me.itemsData.getDataSet().update(item.data);
	                                item.repositionX();
	                            } else if (moment(item.data.start).isBefore(itemData.start) && item.id != me.id) { //dates must be added
	                                //console.log("right " +itemData.end + " " + moment(minStartItem.end).toDate())
	                                item.data.end = moment(item.data.end).subtract(half, "ms");
	                                item.data.start = moment(item.data.start).subtract(half, "ms");
	                                me.itemsData.getDataSet().update(item.data);
	                                item.repositionX();
	                            }



	                        });
	                    }

	                }
	            });

	            // apply the changes to the data (if there are changes)
	            if (changes.length) {
	                dataset.update(changes);
	            }

	            event.stopPropagation();
	        }
	    }
	};

	//when a range is deleted, there may be a need to join the left and right interval
	ItemSet.prototype.joinRanges = function(item) {


	    if (item.data.leftIntervalId != null && item.data.rightIntervalId != null) {

	        var leftIntervalData = this.itemsData.getDataSet().get(item.data.leftIntervalId);
	        var rightIntervalData = this.itemsData.getDataSet().get(item.data.rightIntervalId);
	        // console.log(this.itemsData.getDataSet());
	        // console.log(item.data.leftIntervalId + " " + item.data.rightIntervalId);
	        leftIntervalData.end = rightIntervalData.end;
	        leftIntervalData.rightItemId = rightIntervalData.rightItemId;
	        this.itemsData.getDataSet().update(leftIntervalData);
	        this.itemsData.getDataSet().remove(rightIntervalData);


	    }

	};
	/**
	 * Handle selecting/deselecting an item when tapping it
	 * @param {Event} event
	 * @private
	 */
	ItemSet.prototype._onSelectItem = function(event) {

		    if (this.options.results) {
        
if(this.body.dom.background.style.background === 'rgb(238, 238, 238)'){
	 this.results.hideResults(this.options.moreResultsId);
	 this.expanded = false;

	this.body.dom.background.style.background = "white";
            	var me = this;
                         util.forEach(me.items, function(item) {
                         	if(item.dom.resultStartBox && item.dom.resultEndBox){
                         	item.dom.resultStartBox.style.background = "white";
                         	item.dom.resultEndBox.style.background = "white";
                         }
	                    });
                         return;
}

        var event1 = new CustomEvent(
  "toggle", 
  {
  }
);
        var me = this;
        document.dispatchEvent(event1);



    	


            this.body.dom.background.style.background = "#EEEEEE";


            	var me = this;
                         util.forEach(me.items, function(item) {
                         	if(item.dom.resultStartBox && item.dom.resultEndBox){
                         	item.dom.resultStartBox.style.background = "#EEEEEE";
                         	item.dom.resultEndBox.style.background = "#EEEEEE";
                         }
	                    });
 


                     

    }

	    if (!this.options.selectable) return;




	    var ctrlKey = event.gesture.srcEvent && event.gesture.srcEvent.ctrlKey;
	    var shiftKey = event.gesture.srcEvent && event.gesture.srcEvent.shiftKey;
	    if (ctrlKey || shiftKey) {
	        this._onMultiSelectItem(event);
	        return;
	    }

	    var oldSelection = this.getSelection();

	    var item = this.itemFromTarget(event);



	    var selection = item ? [item.id] : [];
	    this.setSelection(selection);

	    var newSelection = this.getSelection();

	    if (this.options.results && !this.options.colapsed && !this.colapsableTap) {
	        this.colapsableTap = !this.colapsableTap;
	        this.results.selectResult(this.options.moreResultsId, true);
	        this.results.sendGlobalMapRequest(this.options.moreResultsId);
	        console.log("FIRST")
	    
	    } else if (this.options.results && this.options.colapsed && item == null) {
	        this.colapsedTap = !this.colapsedTap;
	        console.log("THIRD")
	        idList = []
	        this.itemsData.forEach(function(data) {

	            idList.push(new Array(data.trip, data.type));
	        });

	        this.results.sendEntryMapRequest(idList);
	    } else if (this.options.results && item != null && item.data.type === "interval" && this.options.colapsed) {
	        console.log("FOURTH")
	        this.results.highlightRoute(item.data.trip);
	    } else if (this.options.results && item != null && this.options.colapsed && item.data.type === "range") {
	        console.log("FIFTH")
	        this.results.highlightLocation(item.data.trip);
	    }

	    if (this.options.results && !this.options.colapsed) {

	        if (!this.expanded)
	            if (this.resultsStored)
	                this.results.showResults(this.options.moreResultsId);
	            else {
	                this.results.sendMoreResultsRequest(this.options.moreResultsId);
	                this.resultsStored = true;
	            } else {
	            this.results.hideResults(this.options.moreResultsId);
	        }
	        this.expanded = !this.expanded;
	    }



	    // emit a select event,
	    // except when old selection is empty and new selection is still empty
	    if (newSelection.length > 0 || oldSelection.length > 0) {
	        this.body.emitter.emit('select', {
	            items: newSelection
	        });
	    }
	};

	/**
	 * Start creating a new range item by dragging.
	 * @param {Event} event
	 * @private
	 */

	ItemSet.prototype._onDragStartAddItem = function(event) {

	    //if (this.itemFromTarget(event) ==='drag' ) {return;}
	    var cancel = false;
	    if (this.itemFromTarget(event) === null) {
	        var me = this;
	        var snap = this.options.snap || null;
	        var xAbs = util.getAbsoluteLeft(this.dom.frame);
	        var x = event.gesture.center.pageX - xAbs - 10; // minus 10 to compensate for the drag starting as soon as you've moved 10px
	        var time = this.body.util.toTime(x);
	        var scale = this.body.util.getScale();
	        var step = this.body.util.getStep();
	        var start = snap ? snap(time, scale, step) : start;
	        var end = start;

	        this.itemsData.forEach(function(data) {

	            if (moment(time).isAfter(data.start) && moment(time).isBefore(data.end)) {
	                cancel = true;
	            }



	        });
	        if (cancel) {
	            return;
	        }

	        var itemData = {
	            type: 'range',
	            start: start,
	            end: end,
	            content: 'new item',
	            range: 0,
	            drag: true
	        };

	        var id = util.randomUUID();
	        itemData[this.itemsData._fieldId] = id;

	        var group = this.groupFromTarget(event);
	        if (group) {
	            itemData.group = group.groupId;
	        }

	        var newItem = new RangeItem(itemData, this.conversion, this.options);
	        newItem.id = id; // TODO: not so nice setting id afterwards
	        this._addItem(newItem);

	        var props = {
	            item: newItem,
	            end: end.valueOf(),
	            initialX: event.gesture.center.clientX
	        };
	        this.touchParams.itemProps = [props];
	        if (Object.keys(this.items).length > 1) { //if there is more than 1 range, there is a need to establish the interval between

	            var test = new IntervalItem();

	            var dataset = this.itemsData.getDataSet();
	            var minStartItem = dataset.min('start');
	            var maxEndItem = dataset.max('end');

	            if (start > maxEndItem.end) {
	                newInterval = {

	                    //start: snap ? snap(start, scale, step) : start,
	                    type: 'interval',
	                    leftItemId: maxEndItem.id,
	                    start: maxEndItem.end,
	                    rightItemId: newItem.id,
	                    end: newItem.data.start
	                };


	                id2 = util.randomUUID();
	                newInterval[this.itemsData._fieldId] = id2;
	                test.data = newInterval;
	                test.id = id2;



	                newItem.data.leftIntervalId = test.id;
	                lastItem.rightIntervalId = test.id;
	            } else if (start < minStartItem.start) {
	                newInterval = {
	                    //start: snap ? snap(start, scale, step) : start,
	                    type: 'interval',
	                    leftItemId: newItem.id,
	                    start: newItem.data.end,
	                    rightItemId: minStartItem.id,
	                    end: minStartItem.start
	                };



	                var id3 = util.randomUUID();
	                newInterval[this.itemsData._fieldId] = id3;
	                test.data = newInterval;
	                test.id = id3;

	                newItem.data.rightIntervalId = test.id;
	                lastItem.leftIntervalId = test.id;
	            }

	            me.itemsData.getDataSet().add(newItem.data);
	            me.itemsData.getDataSet().add(test.data);
	            if (me.itemsData.getDataSet().get(lastItem.id))
	                me.itemsData.getDataSet().update2(lastItem);
	            //me.itemsData.getDataSet().update2(newItem);
	        }


	        lastItem = newItem;




	        event.stopPropagation();
	        createAndDrag = false;
	    } else if (this.itemFromTarget(event).data.type === 'interval' && parseInt(this.itemFromTarget(event).width) > 200) {
	        var test = new IntervalItem();

	        var interval = this.itemFromTarget(event);
	        var rightItemId = this.itemFromTarget(event).data.rightItemId;
	        var rightItemData = this.itemsData.getDataSet().get(rightItemId);


	        var me = this;
	        var snap = this.options.snap || null;
	        var xAbs = util.getAbsoluteLeft(this.dom.frame);
	        var x = event.gesture.center.pageX - xAbs - 10; // minus 10 to compensate for the drag starting as soon as you've moved 10px
	        var time = this.body.util.toTime(x);
	        var scale = this.body.util.getScale();
	        var step = this.body.util.getStep();
	        var start = snap ? snap(time, scale, step) : start;
	        var end = start;

	        var itemData = {
	            type: 'range',
	            start: start,
	            end: end,
	            content: 'new item',
	            range: 0,
	            drag: true
	        };

	        var id = util.randomUUID();
	        itemData[this.itemsData._fieldId] = id;

	        var group = this.groupFromTarget(event);
	        if (group) {
	            itemData.group = group.groupId;
	        }

	        var newItem = new RangeItem(itemData, this.conversion, this.options);
	        newItem.id = id; // TODO: not so nice setting id afterwards
	        newItem.data.leftIntervalId = interval.id;


	        newInterval = {
	            //start: snap ? snap(start, scale, step) : start,
	            type: 'interval',
	            leftItemId: newItem.id,
	            start: newItem.data.end,
	            rightItemId: rightItemId,
	            end: rightItemData.start
	        };




	        var id3 = util.randomUUID();
	        newInterval[this.itemsData._fieldId] = id3;
	        test.data = newInterval;
	        test.id = id3;


	        newItem.data.rightIntervalId = newInterval.id;
	        this._addItem(newItem);

	        var props = {
	            item: newItem,
	            end: end.valueOf(),
	            initialX: event.gesture.center.clientX
	        };
	        this.touchParams.itemProps = [props];

	        interval.data.rightItemId = newItem.id;
	        interval.data.end = newItem.data.start;

	        me.itemsData.getDataSet().update2(interval);
	        interval.repositionX();



	        rightItemData.leftIntervalId = newInterval.id;


	        me.itemsData.getDataSet().add(test.data);

	        me.itemsData.getDataSet().update(rightItemData);


	        event.stopPropagation();
	        createAndDrag = false;
	    }
	};


	ItemSet.prototype.verifyFields = function() {

	    for (var id in this.items) {
	        if (this.items.hasOwnProperty(id)) {

	            var startAnchor = document.getElementById("startBox" + id);
	            var endAnchor = document.getElementById("endBox" + id);

	            var startString = startAnchor.value;
	            var endString = endAnchor.value;

	            var startDate = moment("10/10/2015 " + startString, "dd/MM/yyyy HH:mm");
	            var endDate = moment("10/10/2015 " + endString, "dd/MM/yyyy HH:mm");

	            if (startString != "--:--" && endString != "--:--") {
	                if (endDate.isBefore(startDate)) this.errorMessage(endAnchor);
	                else if (startDate.isAfter(endDate)) this.errorMessage(startAnchor);
	                else if (endDate.isAfter(startDate)) {
	                    this.okMessage(startAnchor);
	                    this.okMessage(endAnchor);
	                }
	            }

	        }
	    }
	}



	/**
	 * Handle creation and updates of an item on double tap
	 * @param event
	 * @private
	 */
	var lastItem;
	var newInterval;
	ItemSet.prototype._onAddItem = function(event) {
	    var cancel = false;
	    if (!this.options.selectable) return;
	    if (!this.options.editable.add) return;
	    if (this.itemFromTarget(event) != null) return;



	    var me = this,
	        snap = this.options.snap || null,
	        item = this.itemFromTarget(event);
	    if (!item) {
	        // add item
	        var xAbs = util.getAbsoluteLeft(this.dom.frame);
	        var x = event.gesture.center.pageX - xAbs;
	        var start = this.body.util.toTime(x);
	        var scale = this.body.util.getScale();
	        var step = this.body.util.getStep();

	        this.itemsData.forEach(function(data) {

	            if (moment(start).isAfter(data.start) && moment(start).isBefore(data.end)) {
	                cancel = true;
	            }
	        });
	        if (cancel) {
	            return;
	        }

	        var newItem = {
	            start: snap ? snap(start, scale, step) : start,
	            content: 'new item',
	        };



	        // when default type is a range, add a default end date to the new item
	        if (this.options.type === 'range') {
	            var end = this.body.util.toTime(x + this.props.width / 5);
	            newItem.end = snap ? snap(end, scale, step) : end;
	        }
	        var id = util.randomUUID();
	        newItem[this.itemsData._fieldId] = id;
	        newItem.id = id;



	        var group = this.groupFromTarget(event);
	        if (group) {
	            newItem.group = group.groupId;
	            if (newInterval)
	                newInterval.group = group.groupId;
	        }

	        //console.log(newItem.id);
	        if (Object.keys(this.items).length > 0) { //if there is more than 1 range, there is a need to establish the interval between

	            var test = new IntervalItem();

	            var dataset = this.itemsData.getDataSet();
	            var minStartItem = dataset.min('start');
	            var maxEndItem = dataset.max('end');

	            if (start > maxEndItem.end) {
	                newInterval = {

	                    //start: snap ? snap(start, scale, step) : start,
	                    type: 'interval',
	                    leftItemId: maxEndItem.id,
	                    start: maxEndItem.end,
	                    rightItemId: newItem.id,
	                    end: newItem.start
	                };

	                var id3 = util.randomUUID();
	                newInterval[this.itemsData._fieldId] = id3;
	                test.data = newInterval;
	                test.id = id3;



	                newItem.leftIntervalId = test.id;
	                lastItem.rightIntervalId = test.id;

	            } else if (start < minStartItem.start) {
	                newInterval = {
	                    //start: snap ? snap(start, scale, step) : start,
	                    type: 'interval',
	                    leftItemId: newItem.id,
	                    start: newItem.end,
	                    rightItemId: minStartItem.id,
	                    end: minStartItem.start
	                };



	                var id3 = util.randomUUID();
	                newInterval[this.itemsData._fieldId] = id3;
	                test.data = newInterval;
	                test.id = id3;



	                newItem.rightIntervalId = test.id;
	                lastItem.leftIntervalId = test.id;
	            }

	            if (me.itemsData.getDataSet().get(lastItem.id))
	                me.itemsData.getDataSet().update(lastItem);

	            me.itemsData.getDataSet().add(test.data);


	        }

	        lastItem = newItem;



	        this.itemsData.getDataSet().add(newItem);
	        // TODO: need to trigger a redraw?




	    }

	};

	/**
	 * Handle selecting/deselecting multiple items when holding an item
	 * @param {Event} event
	 * @private
	 */
	ItemSet.prototype._onMultiSelectItem = function(event) {
	    if (!this.options.selectable) return;

	    var selection,
	        item = this.itemFromTarget(event);

	    if (item) {
	        // multi select items
	        selection = this.getSelection(); // current selection

	        var shiftKey = event.gesture.touches[0] && event.gesture.touches[0].shiftKey || false;
	        if (shiftKey) {
	            // select all items between the old selection and the tapped item

	            // determine the selection range
	            selection.push(item.id);
	            var range = ItemSet._getItemRange(this.itemsData.get(selection, this.itemOptions));

	            // select all items within the selection range
	            selection = [];
	            for (var id in this.items) {
	                if (this.items.hasOwnProperty(id)) {
	                    var _item = this.items[id];
	                    var start = _item.data.start;
	                    var end = (_item.data.end !== undefined) ? _item.data.end : start;

	                    if (start >= range.min && end <= range.max) {
	                        selection.push(_item.id); // do not use id but item.id, id itself is stringified
	                    }
	                }
	            }
	        } else {
	            // add/remove this item from the current selection
	            var index = selection.indexOf(item.id);
	            if (index == -1) {
	                // item is not yet selected -> select it
	                selection.push(item.id);
	            } else {
	                // item is already selected -> deselect it
	                selection.splice(index, 1);
	            }
	        }

	        this.setSelection(selection);

	        this.body.emitter.emit('select', {
	            items: this.getSelection()
	        });
	    }
	};

	/**
	 * Calculate the time range of a list of items
	 * @param {Array.<Object>} itemsData
	 * @return {{min: Date, max: Date}} Returns the range of the provided items
	 * @private
	 */
	ItemSet._getItemRange = function(itemsData) {
	    var max = null;
	    var min = null;

	    itemsData.forEach(function(data) {
	        if (min == null || data.start < min) {
	            min = data.start;
	        }

	        if (data.end != undefined) {
	            if (max == null || data.end > max) {
	                max = data.end;
	            }
	        } else {
	            if (max == null || data.start > max) {
	                max = data.start;
	            }
	        }
	    });

	    return {
	        min: min,
	        max: max
	    }
	};


	ItemSet.prototype.getData = function() {

	    message = "{ \"message\": \"query data\",";

	    var date = {
	        date: document.getElementById("dateInput").value
	    };
	    var result = JSON.stringify(date) + ",";
	    var me = this;
	    var orderedIds = me.itemsData.getIds();

	    for (var i = 0; i < orderedIds.length; i++) {
	        result += JSON.stringify(me.items[orderedIds[i]].getData()) + ',';
	    }

	    result = result.slice(0, -1);
	    //result += ']';

	    var data = "\"data\": [" + result + "]}";

	    return message.concat(data);
	};

	/**
	 * Find an item from an event target:
	 * searches for the attribute 'timeline-item' in the event target's element tree
	 * @param {Event} event
	 * @return {Item | null} item
	 */
	ItemSet.prototype.itemFromTarget = function(event) {
	    var target = event.target;
	    while (target) {
	        if (target.hasOwnProperty('timeline-item')) {
	            return target['timeline-item'];
	        }
	        target = target.parentNode;
	    }

	    return null;
	};

	/**
	 * Find the Group from an event target:
	 * searches for the attribute 'timeline-group' in the event target's element tree
	 * @param {Event} event
	 * @return {Group | null} group
	 */
	ItemSet.prototype.groupFromTarget = function(event) {
	    var clientY = event.gesture ? event.gesture.center.clientY : event.clientY;
	    for (var i = 0; i < this.groupIds.length; i++) {
	        var groupId = this.groupIds[i];
	        var group = this.groups[groupId];
	        var foreground = group.dom.foreground;
	        var top = util.getAbsoluteTop(foreground);
	        if (clientY > top && clientY < top + foreground.offsetHeight) {
	            return group;
	        }

	        if (this.options.orientation === 'top') {
	            if (i === this.groupIds.length - 1 && clientY > top) {
	                return group;
	            }
	        } else {
	            if (i === 0 && clientY < top + foreground.offset) {
	                return group;
	            }
	        }
	    }

	    return null;
	};

	/**
	 * Find the ItemSet from an event target:
	 * searches for the attribute 'timeline-itemset' in the event target's element tree
	 * @param {Event} event
	 * @return {ItemSet | null} item
	 */
	ItemSet.itemSetFromTarget = function(event) {
	    var target = event.target;
	    while (target) {
	        if (target.hasOwnProperty('timeline-itemset')) {
	            return target['timeline-itemset'];
	        }
	        target = target.parentNode;
	    }

	    return null;
	};

	ItemSet.prototype.removeAllItems = function() {
	    var me = this;
	    this.itemsData.forEach(function(data) {

	        me.removeItem(data.id)
	    });

	};

	module.exports = ItemSet;
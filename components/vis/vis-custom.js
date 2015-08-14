(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.vis = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
exports.DataSet = require('./lib/DataSet');
exports.Timeline = require('./lib/timeline/Timeline');

},{"./lib/DataSet":2,"./lib/timeline/Timeline":16}],2:[function(require,module,exports){
var util = require('./util');
var Queue = require('./Queue');

/**
 * DataSet
 *
 * Usage:
 *     var dataSet = new DataSet({
 *         fieldId: '_id',
 *         type: {
 *             // ...
 *         }
 *     });
 *
 *     dataSet.add(item);
 *     dataSet.add(data);
 *     dataSet.update(item);
 *     dataSet.update(data);
 *     dataSet.remove(id);
 *     dataSet.remove(ids);
 *     var data = dataSet.get();
 *     var data = dataSet.get(id);
 *     var data = dataSet.get(ids);
 *     var data = dataSet.get(ids, options, data);
 *     dataSet.clear();
 *
 * A data set can:
 * - add/remove/update data
 * - gives triggers upon changes in the data
 * - can  import/export data in various data formats
 *
 * @param {Array | DataTable} [data]    Optional array with initial data
 * @param {Object} [options]   Available options:
 *                             {String} fieldId Field name of the id in the
 *                                              items, 'id' by default.
 *                             {Object.<String, String} type
 *                                              A map with field names as key,
 *                                              and the field type as value.
 *                             {Object} queue   Queue changes to the DataSet,
 *                                              flush them all at once.
 *                                              Queue options:
 *                                              - {number} delay  Delay in ms, null by default
 *                                              - {number} max    Maximum number of entries in the queue, Infinity by default
 * @constructor DataSet
 */
// TODO: add a DataSet constructor DataSet(data, options)
function DataSet (data, options) {
  // correctly read optional arguments
  if (data && !Array.isArray(data) && !util.isDataTable(data)) {
    options = data;
    data = null;
  }

  this._options = options || {};
  this._data = {};                                 // map with data indexed by id
  this.length = 0;                                 // number of items in the DataSet
  this._fieldId = this._options.fieldId || 'id';   // name of the field containing id
  this._type = {};                                 // internal field types (NOTE: this can differ from this._options.type)

  // all variants of a Date are internally stored as Date, so we can convert
  // from everything to everything (also from ISODate to Number for example)
  if (this._options.type) {
    for (var field in this._options.type) {
      if (this._options.type.hasOwnProperty(field)) {
        var value = this._options.type[field];
        if (value == 'Date' || value == 'ISODate' || value == 'ASPDate') {
          this._type[field] = 'Date';
        }
        else {
          this._type[field] = value;
        }
      }
    }
  }

  // TODO: deprecated since version 1.1.1 (or 2.0.0?)
  if (this._options.convert) {
    throw new Error('Option "convert" is deprecated. Use "type" instead.');
  }

  this._subscribers = {};  // event subscribers

  // add initial data when provided
  if (data) {
    this.add(data);
  }

  this.setOptions(options);
}

/**
 * @param {Object} [options]   Available options:
 *                             {Object} queue   Queue changes to the DataSet,
 *                                              flush them all at once.
 *                                              Queue options:
 *                                              - {number} delay  Delay in ms, null by default
 *                                              - {number} max    Maximum number of entries in the queue, Infinity by default
 * @param options
 */
DataSet.prototype.setOptions = function(options) {
  if (options && options.queue !== undefined) {
    if (options.queue === false) {
      // delete queue if loaded
      if (this._queue) {
        this._queue.destroy();
        delete this._queue;
      }
    }
    else {
      // create queue and update its options
      if (!this._queue) {
        this._queue = Queue.extend(this, {
          replace: ['add', 'update', 'remove']
        });
      }

      if (typeof options.queue === 'object') {
        this._queue.setOptions(options.queue);
      }
    }
  }
};

/**
 * Subscribe to an event, add an event listener
 * @param {String} event        Event name. Available events: 'put', 'update',
 *                              'remove'
 * @param {function} callback   Callback method. Called with three parameters:
 *                                  {String} event
 *                                  {Object | null} params
 *                                  {String | Number} senderId
 */
DataSet.prototype.on = function(event, callback) {
  var subscribers = this._subscribers[event];
  if (!subscribers) {
    subscribers = [];
    this._subscribers[event] = subscribers;
  }

  subscribers.push({
    callback: callback
  });
};

// TODO: make this function deprecated (replaced with `on` since version 0.5)
DataSet.prototype.subscribe = DataSet.prototype.on;

/**
 * Unsubscribe from an event, remove an event listener
 * @param {String} event
 * @param {function} callback
 */
DataSet.prototype.off = function(event, callback) {
  var subscribers = this._subscribers[event];
  if (subscribers) {
    this._subscribers[event] = subscribers.filter(function (listener) {
      return (listener.callback != callback);
    });
  }
};

// TODO: make this function deprecated (replaced with `on` since version 0.5)
DataSet.prototype.unsubscribe = DataSet.prototype.off;

/**
 * Trigger an event
 * @param {String} event
 * @param {Object | null} params
 * @param {String} [senderId]       Optional id of the sender.
 * @private
 */
DataSet.prototype._trigger = function (event, params, senderId) {
  if (event == '*') {
    throw new Error('Cannot trigger event *');
  }

  var subscribers = [];
  if (event in this._subscribers) {
    subscribers = subscribers.concat(this._subscribers[event]);
  }
  if ('*' in this._subscribers) {
    subscribers = subscribers.concat(this._subscribers['*']);
  }

  for (var i = 0; i < subscribers.length; i++) {
    var subscriber = subscribers[i];
    if (subscriber.callback) {
      subscriber.callback(event, params, senderId || null);
    }
  }
};

/**
 * Add data.
 * Adding an item will fail when there already is an item with the same id.
 * @param {Object | Array | DataTable} data
 * @param {String} [senderId] Optional sender id
 * @return {Array} addedIds      Array with the ids of the added items
 */
DataSet.prototype.add = function (data, senderId) {
  var addedIds = [],
      id,
      me = this;

  if (Array.isArray(data)) {
    // Array
    for (var i = 0, len = data.length; i < len; i++) {
      id = me._addItem(data[i]);
      addedIds.push(id);
    }
  }
  else if (util.isDataTable(data)) {
    // Google DataTable
    var columns = this._getColumnNames(data);
    for (var row = 0, rows = data.getNumberOfRows(); row < rows; row++) {
      var item = {};
      for (var col = 0, cols = columns.length; col < cols; col++) {
        var field = columns[col];
        item[field] = data.getValue(row, col);
      }

      id = me._addItem(item);
      addedIds.push(id);
    }
  }
  else if (data instanceof Object) {
    // Single item
    id = me._addItem(data);
    addedIds.push(id);
  }
  else {
    throw new Error('Unknown dataType');
  }

  if (addedIds.length) {
    this._trigger('add', {items: addedIds}, senderId);
  }

  return addedIds;
};

/**
 * Update existing items. When an item does not exist, it will be created
 * @param {Object | Array | DataTable} data
 * @param {String} [senderId] Optional sender id
 * @return {Array} updatedIds     The ids of the added or updated items
 */
DataSet.prototype.update2 = function (data, senderId) {
  var addedIds = [];
  var updatedIds = [];
  var updatedData = [];
  var me = this;
  var fieldId = me._fieldId;

  var addOrUpdate = function (item) {
    var id = item[fieldId];
    if (me._data[id]) {
      // update item
      id = me._updateItem(item);
      updatedIds.push(id);
      updatedData.push(item);
    }
    else {
      // add new item
      id = me._addItem(item);
      addedIds.push(id);
    }
  };

  if (Array.isArray(data)) {
    // Array
    for (var i = 0, len = data.length; i < len; i++) {
      addOrUpdate(data[i]);
    }
  }
  else if (util.isDataTable(data)) {
    // Google DataTable
    var columns = this._getColumnNames(data);
    for (var row = 0, rows = data.getNumberOfRows(); row < rows; row++) {
      var item = {};
      for (var col = 0, cols = columns.length; col < cols; col++) {
        var field = columns[col];
        item[field] = data.getValue(row, col);
      }

      addOrUpdate(item);
    }
  }
  else if (data instanceof Object) {
    // Single item
    addOrUpdate(data);
  }
  else {
    throw new Error('Unknown dataType');
  }

  if (addedIds.length) {
    this._trigger('add', {items: addedIds}, senderId);
  }
  if (updatedIds.length) {
    //this._trigger('update', {items: updatedIds, data: updatedData}, senderId); //TODO
  }

  return addedIds.concat(updatedIds);
};

/**
 * Update existing items. When an item does not exist, it will be created
 * @param {Object | Array | DataTable} data
 * @param {String} [senderId] Optional sender id
 * @return {Array} updatedIds     The ids of the added or updated items
 */
DataSet.prototype.update = function (data, senderId) {
  var addedIds = [];
  var updatedIds = [];
  var updatedData = [];
  var me = this;
  var fieldId = me._fieldId;

  var addOrUpdate = function (item) {
    var id = item[fieldId];
    if (me._data[id]) {
      // update item
      id = me._updateItem(item);
      updatedIds.push(id);
      updatedData.push(item);
    }
    else {
      // add new item
      id = me._addItem(item);
      addedIds.push(id);
    }
  };

  if (Array.isArray(data)) {
    // Array
    for (var i = 0, len = data.length; i < len; i++) {
      addOrUpdate(data[i]);
    }
  }
  else if (util.isDataTable(data)) {
    // Google DataTable
    var columns = this._getColumnNames(data);
    for (var row = 0, rows = data.getNumberOfRows(); row < rows; row++) {
      var item = {};
      for (var col = 0, cols = columns.length; col < cols; col++) {
        var field = columns[col];
        item[field] = data.getValue(row, col);
      }

      addOrUpdate(item);
    }
  }
  else if (data instanceof Object) {
    // Single item
    addOrUpdate(data);
  }
  else {
    throw new Error('Unknown dataType');
  }

  if (addedIds.length) {
    this._trigger('add', {items: addedIds}, senderId);
  }
  if (updatedIds.length) {
    this._trigger('update', {items: updatedIds, data: updatedData}, senderId); //TODO
  }

  return addedIds.concat(updatedIds);
};

/**
 * Get a data item or multiple items.
 *
 * Usage:
 *
 *     get()
 *     get(options: Object)
 *     get(options: Object, data: Array | DataTable)
 *
 *     get(id: Number | String)
 *     get(id: Number | String, options: Object)
 *     get(id: Number | String, options: Object, data: Array | DataTable)
 *
 *     get(ids: Number[] | String[])
 *     get(ids: Number[] | String[], options: Object)
 *     get(ids: Number[] | String[], options: Object, data: Array | DataTable)
 *
 * Where:
 *
 * {Number | String} id         The id of an item
 * {Number[] | String{}} ids    An array with ids of items
 * {Object} options             An Object with options. Available options:
 *                              {String} [returnType] Type of data to be
 *                                  returned. Can be 'DataTable' or 'Array' (default)
 *                              {Object.<String, String>} [type]
 *                              {String[]} [fields] field names to be returned
 *                              {function} [filter] filter items
 *                              {String | function} [order] Order the items by
 *                                  a field name or custom sort function.
 * {Array | DataTable} [data]   If provided, items will be appended to this
 *                              array or table. Required in case of Google
 *                              DataTable.
 *
 * @throws Error
 */
DataSet.prototype.get = function (args) {
  var me = this;

  // parse the arguments
  var id, ids, options, data;
  var firstType = util.getType(arguments[0]);
  if (firstType == 'String' || firstType == 'Number') {
    // get(id [, options] [, data])
    id = arguments[0];
    options = arguments[1];
    data = arguments[2];
  }
  else if (firstType == 'Array') {
    // get(ids [, options] [, data])
    ids = arguments[0];
    options = arguments[1];
    data = arguments[2];
  }
  else {
    // get([, options] [, data])
    options = arguments[0];
    data = arguments[1];
  }

  // determine the return type
  var returnType;
  if (options && options.returnType) {
    var allowedValues = ["DataTable", "Array", "Object"];
    returnType = allowedValues.indexOf(options.returnType) == -1 ? "Array" : options.returnType;

    if (data && (returnType != util.getType(data))) {
      throw new Error('Type of parameter "data" (' + util.getType(data) + ') ' +
          'does not correspond with specified options.type (' + options.type + ')');
    }
    if (returnType == 'DataTable' && !util.isDataTable(data)) {
      throw new Error('Parameter "data" must be a DataTable ' +
          'when options.type is "DataTable"');
    }
  }
  else if (data) {
    returnType = (util.getType(data) == 'DataTable') ? 'DataTable' : 'Array';
  }
  else {
    returnType = 'Array';
  }

  // build options
  var type = options && options.type || this._options.type;
  var filter = options && options.filter;
  var items = [], item, itemId, i, len;

  // convert items
  if (id != undefined) {
    // return a single item
    item = me._getItem(id, type);
    if (filter && !filter(item)) {
      item = null;
    }
  }
  else if (ids != undefined) {
    // return a subset of items
    for (i = 0, len = ids.length; i < len; i++) {
      item = me._getItem(ids[i], type);
      if (!filter || filter(item)) {
        items.push(item);
      }
    }
  }
  else {
    // return all items
    for (itemId in this._data) {
      if (this._data.hasOwnProperty(itemId)) {
        item = me._getItem(itemId, type);
        if (!filter || filter(item)) {
          items.push(item);
        }
      }
    }
  }

  // order the results
  if (options && options.order && id == undefined) {
    this._sort(items, options.order);
  }

  // filter fields of the items
  if (options && options.fields) {
    var fields = options.fields;
    if (id != undefined) {
      item = this._filterFields(item, fields);
    }
    else {
      for (i = 0, len = items.length; i < len; i++) {
        items[i] = this._filterFields(items[i], fields);
      }
    }
  }

  // return the results
  if (returnType == 'DataTable') {
    var columns = this._getColumnNames(data);
    if (id != undefined) {
      // append a single item to the data table
      me._appendRow(data, columns, item);
    }
    else {
      // copy the items to the provided data table
      for (i = 0; i < items.length; i++) {
        me._appendRow(data, columns, items[i]);
      }
    }
    return data;
  }
  else if (returnType == "Object") {
    var result = {};
    for (i = 0; i < items.length; i++) {
      result[items[i].id] = items[i];
    }
    return result;
  }
  else {
    // return an array
    if (id != undefined) {
      // a single item
      return item;
    }
    else {
      // multiple items
      if (data) {
        // copy the items to the provided array
        for (i = 0, len = items.length; i < len; i++) {
          data.push(items[i]);
        }
        return data;
      }
      else {
        // just return our array
        return items;
      }
    }
  }
};

/**
 * Get ids of all items or from a filtered set of items.
 * @param {Object} [options]    An Object with options. Available options:
 *                              {function} [filter] filter items
 *                              {String | function} [order] Order the items by
 *                                  a field name or custom sort function.
 * @return {Array} ids
 */
DataSet.prototype.getIds = function (options) {
  var data = this._data,
      filter = options && options.filter,
      order = 'start',
      type = options && options.type || this._options.type,
      i,
      len,
      id,
      item,
      items,
      ids = [];

  if (filter) {
    // get filtered items
    if (order) {
      // create ordered list
      items = [];
      for (id in data) {
        if (data.hasOwnProperty(id)) {
          item = this._getItem(id, type);
          if (filter(item)) {
            items.push(item);
          }
        }
      }

      this._sort(items, order);

      for (i = 0, len = items.length; i < len; i++) {
        ids[i] = items[i][this._fieldId];
      }
    }
    else {
      // create unordered list
      for (id in data) {
        if (data.hasOwnProperty(id)) {
          item = this._getItem(id, type);
          if (filter(item)) {
            ids.push(item[this._fieldId]);
          }
        }
      }
    }
  }
  else {
    // get all items
    if (order) {
      // create an ordered list
      items = [];
      for (id in data) {
        if (data.hasOwnProperty(id)) {
          items.push(data[id]);
        }
      }

      this._sort(items, order);

      for (i = 0, len = items.length; i < len; i++) {
        ids[i] = items[i][this._fieldId];
      }
    }
    else {
      // create unordered list
      for (id in data) {
        if (data.hasOwnProperty(id)) {
          item = data[id];
          ids.push(item[this._fieldId]);
        }
      }
    }
  }

  return ids;
};

/**
 * Returns the DataSet itself. Is overwritten for example by the DataView,
 * which returns the DataSet it is connected to instead.
 */
DataSet.prototype.getDataSet = function () {
  return this;
};

/**
 * Execute a callback function for every item in the dataset.
 * @param {function} callback
 * @param {Object} [options]    Available options:
 *                              {Object.<String, String>} [type]
 *                              {String[]} [fields] filter fields
 *                              {function} [filter] filter items
 *                              {String | function} [order] Order the items by
 *                                  a field name or custom sort function.
 */
DataSet.prototype.forEach = function (callback, options) {
  var filter = options && options.filter,
      type = options && options.type || this._options.type,
      data = this._data,
      item,
      id;

  if (options && options.order) {
    // execute forEach on ordered list
    var items = this.get(options);

    for (var i = 0, len = items.length; i < len; i++) {
      item = items[i];
      id = item[this._fieldId];
      callback(item, id);
    }
  }
  else {
    // unordered
    for (id in data) {
      if (data.hasOwnProperty(id)) {
        item = this._getItem(id, type);
        if (!filter || filter(item)) {
          callback(item, id);
        }
      }
    }
  }
};

/**
 * Map every item in the dataset.
 * @param {function} callback
 * @param {Object} [options]    Available options:
 *                              {Object.<String, String>} [type]
 *                              {String[]} [fields] filter fields
 *                              {function} [filter] filter items
 *                              {String | function} [order] Order the items by
 *                                  a field name or custom sort function.
 * @return {Object[]} mappedItems
 */
DataSet.prototype.map = function (callback, options) {
  var filter = options && options.filter,
      type = options && options.type || this._options.type,
      mappedItems = [],
      data = this._data,
      item;

  // convert and filter items
  for (var id in data) {
    if (data.hasOwnProperty(id)) {
      item = this._getItem(id, type);
      if (!filter || filter(item)) {
        mappedItems.push(callback(item, id));
      }
    }
  }

  // order items
  if (options && options.order) {
    this._sort(mappedItems, options.order);
  }

  return mappedItems;
};

/**
 * Filter the fields of an item
 * @param {Object | null} item
 * @param {String[]} fields     Field names
 * @return {Object | null} filteredItem or null if no item is provided
 * @private
 */
DataSet.prototype._filterFields = function (item, fields) {
  if (!item) { // item is null
    return item;
  }

  var filteredItem = {};

  if(Array.isArray(fields)){
    for (var field in item) {
      if (item.hasOwnProperty(field) && (fields.indexOf(field) != -1)) {
        filteredItem[field] = item[field];
      }
    }
  }else{
    for (var field in item) {
      if (item.hasOwnProperty(field) && fields.hasOwnProperty(field)) {
        filteredItem[fields[field]] = item[field];
      }
    }
  }

  return filteredItem;
};

/**
 * Sort the provided array with items
 * @param {Object[]} items
 * @param {String | function} order      A field name or custom sort function.
 * @private
 */
DataSet.prototype._sort = function (items, order) {
  if (util.isString(order)) {
    // order by provided field name
    var name = order; // field name
    items.sort(function (a, b) {
      var av = a[name];
      var bv = b[name];
      return (av > bv) ? 1 : ((av < bv) ? -1 : 0);
    });
  }
  else if (typeof order === 'function') {
    // order by sort function
    items.sort(order);
  }
  // TODO: extend order by an Object {field:String, direction:String}
  //       where direction can be 'asc' or 'desc'
  else {
    throw new TypeError('Order must be a function or a string');
  }
};


/**
 * Remove an object by pointer or by id
 * @param {String | Number | Object | Array} id Object or id, or an array with
 *                                              objects or ids to be removed
 * @param {String} [senderId] Optional sender id
 * @return {Array} removedIds
 */
DataSet.prototype.remove = function (id, senderId) {
  var removedIds = [],
      i, len, removedId;

  if (Array.isArray(id)) {
    for (i = 0, len = id.length; i < len; i++) {
      removedId = this._remove(id[i]);
      if (removedId != null) {
        removedIds.push(removedId);
      }
    }
  }
  else {
    removedId = this._remove(id);
    if (removedId != null) {
      removedIds.push(removedId);
    }
  }

  if (removedIds.length) {
    this._trigger('remove', {items: removedIds}, senderId);
  }

  return removedIds;
};

/**
 * Remove an item by its id
 * @param {Number | String | Object} id   id or item
 * @returns {Number | String | null} id
 * @private
 */
DataSet.prototype._remove = function (id) {
  if (util.isNumber(id) || util.isString(id)) {
    if (this._data[id]) {
      delete this._data[id];
      this.length--;
      return id;
    }
  }
  else if (id instanceof Object) {
    var itemId = id[this._fieldId];
    if (itemId && this._data[itemId]) {
      delete this._data[itemId];
      this.length--;
      return itemId;
    }
  }
  return null;
};

/**
 * Clear the data
 * @param {String} [senderId] Optional sender id
 * @return {Array} removedIds    The ids of all removed items
 */
DataSet.prototype.clear = function (senderId) {
  var ids = Object.keys(this._data);

  this._data = {};
  this.length = 0;

  this._trigger('remove', {items: ids}, senderId);

  return ids;
};

/**
 * Find the item with maximum value of a specified field
 * @param {String} field
 * @return {Object | null} item  Item containing max value, or null if no items
 */
DataSet.prototype.max = function (field) {
  var data = this._data,
      max = null,
      maxField = null;

  for (var id in data) {
    if (data.hasOwnProperty(id)) {
      var item = data[id];
      var itemField = item[field];
      if (itemField != null && (!max || itemField > maxField)) {
        max = item;
        maxField = itemField;
      }
    }
  }

  return max;
};

/**
 * Find the item with minimum value of a specified field
 * @param {String} field
 * @return {Object | null} item  Item containing max value, or null if no items
 */
DataSet.prototype.min = function (field) {
  var data = this._data,
      min = null,
      minField = null;

  for (var id in data) {
    if (data.hasOwnProperty(id)) {
      var item = data[id];
      var itemField = item[field];
      if (itemField != null && (!min || itemField < minField)) {
        min = item;
        minField = itemField;
      }
    }
  }

  return min;
};

/**
 * Find all distinct values of a specified field
 * @param {String} field
 * @return {Array} values  Array containing all distinct values. If data items
 *                         do not contain the specified field are ignored.
 *                         The returned array is unordered.
 */
DataSet.prototype.distinct = function (field) {
  var data = this._data;
  var values = [];
  var fieldType = this._options.type && this._options.type[field] || null;
  var count = 0;
  var i;

  for (var prop in data) {
    if (data.hasOwnProperty(prop)) {
      var item = data[prop];
      var value = item[field];
      var exists = false;
      for (i = 0; i < count; i++) {
        if (values[i] == value) {
          exists = true;
          break;
        }
      }
      if (!exists && (value !== undefined)) {
        values[count] = value;
        count++;
      }
    }
  }

  if (fieldType) {
    for (i = 0; i < values.length; i++) {
      values[i] = util.convert(values[i], fieldType);
    }
  }

  return values;
};

/**
 * Add a single item. Will fail when an item with the same id already exists.
 * @param {Object} item
 * @return {String} id
 * @private
 */
DataSet.prototype._addItem = function (item) {
  var id = item[this._fieldId];

  if (id != undefined) {
    // check whether this id is already taken
    if (this._data[id]) {
      // item already exists
      throw new Error('Cannot add item: item with id ' + id + ' already exists');
    }
  }
  else {
    // generate an id
    id = util.randomUUID();
    item[this._fieldId] = id;
  }

  var d = {};
  for (var field in item) {
    if (item.hasOwnProperty(field)) {
      var fieldType = this._type[field];  // type may be undefined
      d[field] = util.convert(item[field], fieldType);
    }
  }
  this._data[id] = d;
  this.length++;

  return id;
};

/**
 * Get an item. Fields can be converted to a specific type
 * @param {String} id
 * @param {Object.<String, String>} [types]  field types to convert
 * @return {Object | null} item
 * @private
 */
DataSet.prototype._getItem = function (id, types) {
  var field, value;

  // get the item from the dataset
  var raw = this._data[id];
  if (!raw) {
    return null;
  }

  // convert the items field types
  var converted = {};
  if (types) {
    for (field in raw) {
      if (raw.hasOwnProperty(field)) {
        value = raw[field];
        converted[field] = util.convert(value, types[field]);
      }
    }
  }
  else {
    // no field types specified, no converting needed
    for (field in raw) {
      if (raw.hasOwnProperty(field)) {
        value = raw[field];
        converted[field] = value;
      }
    }
  }
  return converted;
};

/**
 * Update a single item: merge with existing item.
 * Will fail when the item has no id, or when there does not exist an item
 * with the same id.
 * @param {Object} item
 * @return {String} id
 * @private
 */
DataSet.prototype._updateItem = function (item) {
  var id = item[this._fieldId];
  if (id == undefined) {
    throw new Error('Cannot update item: item has no id (item: ' + JSON.stringify(item) + ')');
  }
  var d = this._data[id];
  if (!d) {
    // item doesn't exist
    throw new Error('Cannot update item: no item with id ' + id + ' found');
  }

  // merge with current item
  for (var field in item) {
    if (item.hasOwnProperty(field)) {
      var fieldType = this._type[field];  // type may be undefined
      d[field] = util.convert(item[field], fieldType);
    }
  }

  return id;
};

/**
 * Get an array with the column names of a Google DataTable
 * @param {DataTable} dataTable
 * @return {String[]} columnNames
 * @private
 */
DataSet.prototype._getColumnNames = function (dataTable) {
  var columns = [];
  for (var col = 0, cols = dataTable.getNumberOfColumns(); col < cols; col++) {
    columns[col] = dataTable.getColumnId(col) || dataTable.getColumnLabel(col);
  }
  return columns;
};

/**
 * Append an item as a row to the dataTable
 * @param dataTable
 * @param columns
 * @param item
 * @private
 */
DataSet.prototype._appendRow = function (dataTable, columns, item) {
  var row = dataTable.addRow();

  for (var col = 0, cols = columns.length; col < cols; col++) {
    var field = columns[col];
    dataTable.setValue(row, col, item[field]);
  }
};

module.exports = DataSet;

},{"./Queue":4,"./util":31}],3:[function(require,module,exports){
var util = require('./util');
var DataSet = require('./DataSet');

/**
 * DataView
 *
 * a dataview offers a filtered view on a dataset or an other dataview.
 *
 * @param {DataSet | DataView} data
 * @param {Object} [options]   Available options: see method get
 *
 * @constructor DataView
 */
function DataView (data, options) {
  this._data = null;
  this._ids = {}; // ids of the items currently in memory (just contains a boolean true)
  this.length = 0; // number of items in the DataView
  this._options = options || {};
  this._fieldId = 'id'; // name of the field containing id
  this._subscribers = {}; // event subscribers

  var me = this;
  this.listener = function () {
    me._onEvent.apply(me, arguments);
  };

  this.setData(data);
}

// TODO: implement a function .config() to dynamically update things like configured filter
// and trigger changes accordingly

/**
 * Set a data source for the view
 * @param {DataSet | DataView} data
 */
DataView.prototype.setData = function (data) {
  var ids, i, len;

  if (this._data) {
    // unsubscribe from current dataset
    if (this._data.unsubscribe) {
      this._data.unsubscribe('*', this.listener);
    }

    // trigger a remove of all items in memory
    ids = [];
    for (var id in this._ids) {
      if (this._ids.hasOwnProperty(id)) {
        ids.push(id);
      }
    }
    this._ids = {};
    this.length = 0;
    this._trigger('remove', {items: ids});
  }

  this._data = data;

  if (this._data) {
    // update fieldId
    this._fieldId = this._options.fieldId ||
        (this._data && this._data.options && this._data.options.fieldId) ||
        'id';

    // trigger an add of all added items
    ids = this._data.getIds({filter: this._options && this._options.filter});
    for (i = 0, len = ids.length; i < len; i++) {
      id = ids[i];
      this._ids[id] = true;
    }
    this.length = ids.length;
    this._trigger('add', {items: ids});

    // subscribe to new dataset
    if (this._data.on) {
      this._data.on('*', this.listener);
    }
  }
};

/**
 * Refresh the DataView. Useful when the DataView has a filter function
 * containing a variable parameter.
 */
DataView.prototype.refresh = function () {
  var id;
  var ids = this._data.getIds({filter: this._options && this._options.filter});
  var newIds = {};
  var added = [];
  var removed = [];

  // check for additions
  for (var i = 0; i < ids.length; i++) {
    id = ids[i];
    newIds[id] = true;
    if (!this._ids[id]) {
      added.push(id);
      this._ids[id] = true;
      this.length++;
    }
  }

  // check for removals
  for (id in this._ids) {
    if (this._ids.hasOwnProperty(id)) {
      if (!newIds[id]) {
        removed.push(id);
        delete this._ids[id];
        this.length--;
      }
    }
  }

  // trigger events
  if (added.length) {
    this._trigger('add', {items: added});
  }
  if (removed.length) {
    this._trigger('remove', {items: removed});
  }
};

/**
 * Get data from the data view
 *
 * Usage:
 *
 *     get()
 *     get(options: Object)
 *     get(options: Object, data: Array | DataTable)
 *
 *     get(id: Number)
 *     get(id: Number, options: Object)
 *     get(id: Number, options: Object, data: Array | DataTable)
 *
 *     get(ids: Number[])
 *     get(ids: Number[], options: Object)
 *     get(ids: Number[], options: Object, data: Array | DataTable)
 *
 * Where:
 *
 * {Number | String} id         The id of an item
 * {Number[] | String{}} ids    An array with ids of items
 * {Object} options             An Object with options. Available options:
 *                              {String} [type] Type of data to be returned. Can
 *                                              be 'DataTable' or 'Array' (default)
 *                              {Object.<String, String>} [convert]
 *                              {String[]} [fields] field names to be returned
 *                              {function} [filter] filter items
 *                              {String | function} [order] Order the items by
 *                                  a field name or custom sort function.
 * {Array | DataTable} [data]   If provided, items will be appended to this
 *                              array or table. Required in case of Google
 *                              DataTable.
 * @param args
 */
DataView.prototype.get = function (args) {
  var me = this;

  // parse the arguments
  var ids, options, data;
  var firstType = util.getType(arguments[0]);
  if (firstType == 'String' || firstType == 'Number' || firstType == 'Array') {
    // get(id(s) [, options] [, data])
    ids = arguments[0];  // can be a single id or an array with ids
    options = arguments[1];
    data = arguments[2];
  }
  else {
    // get([, options] [, data])
    options = arguments[0];
    data = arguments[1];
  }

  // extend the options with the default options and provided options
  var viewOptions = util.extend({}, this._options, options);

  // create a combined filter method when needed
  if (this._options.filter && options && options.filter) {
    viewOptions.filter = function (item) {
      return me._options.filter(item) && options.filter(item);
    }
  }

  // build up the call to the linked data set
  var getArguments = [];
  if (ids != undefined) {
    getArguments.push(ids);
  }
  getArguments.push(viewOptions);
  getArguments.push(data);

  return this._data && this._data.get.apply(this._data, getArguments);
};

/**
 * Get ids of all items or from a filtered set of items.
 * @param {Object} [options]    An Object with options. Available options:
 *                              {function} [filter] filter items
 *                              {String | function} [order] Order the items by
 *                                  a field name or custom sort function.
 * @return {Array} ids
 */
DataView.prototype.getIds = function (options) {
  var ids;

  if (this._data) {
    var defaultFilter = this._options.filter;
    var filter;

    if (options && options.filter) {
      if (defaultFilter) {
        filter = function (item) {
          return defaultFilter(item) && options.filter(item);
        }
      }
      else {
        filter = options.filter;
      }
    }
    else {
      filter = defaultFilter;
    }

    ids = this._data.getIds({
      filter: filter,
      order: options && options.order
    });
  }
  else {
    ids = [];
  }

  return ids;
};

/**
 * Get the DataSet to which this DataView is connected. In case there is a chain
 * of multiple DataViews, the root DataSet of this chain is returned.
 * @return {DataSet} dataSet
 */
DataView.prototype.getDataSet = function () {
  var dataSet = this;
  while (dataSet instanceof DataView) {
    dataSet = dataSet._data;
  }
  return dataSet || null;
};

/**
 * Event listener. Will propagate all events from the connected data set to
 * the subscribers of the DataView, but will filter the items and only trigger
 * when there are changes in the filtered data set.
 * @param {String} event
 * @param {Object | null} params
 * @param {String} senderId
 * @private
 */
DataView.prototype._onEvent = function (event, params, senderId) {
  var i, len, id, item;
  var ids = params && params.items;
  var data = this._data;
  var updatedData = [];
  var added = [];
  var updated = [];
  var removed = [];

  if (ids && data) {
    switch (event) {
      case 'add':
        // filter the ids of the added items
        for (i = 0, len = ids.length; i < len; i++) {
          id = ids[i];
          item = this.get(id);
          if (item) {
            this._ids[id] = true;
            added.push(id);
          }
        }

        break;

      case 'update':
        // determine the event from the views viewpoint: an updated
        // item can be added, updated, or removed from this view.
        for (i = 0, len = ids.length; i < len; i++) {
          id = ids[i];
          item = this.get(id);

          if (item) {
            if (this._ids[id]) {
              updated.push(id);
              updatedData.push(params.data[i]);
            }
            else {
              this._ids[id] = true;
              added.push(id);
            }
          }
          else {
            if (this._ids[id]) {
              delete this._ids[id];
              removed.push(id);
            }
            else {
              // nothing interesting for me :-(
            }
          }
        }

        break;

      case 'remove':
        // filter the ids of the removed items
        for (i = 0, len = ids.length; i < len; i++) {
          id = ids[i];
          if (this._ids[id]) {
            delete this._ids[id];
            removed.push(id);
          }
        }

        break;
    }

    this.length += added.length - removed.length;

    if (added.length) {
      this._trigger('add', {items: added}, senderId);
    }
    if (updated.length) {
      this._trigger('update', {items: updated, data: updatedData}, senderId);
    }
    if (removed.length) {
      this._trigger('remove', {items: removed}, senderId);
    }
  }
};

// copy subscription functionality from DataSet
DataView.prototype.on = DataSet.prototype.on;
DataView.prototype.off = DataSet.prototype.off;
DataView.prototype._trigger = DataSet.prototype._trigger;

// TODO: make these functions deprecated (replaced with `on` and `off` since version 0.5)
DataView.prototype.subscribe = DataView.prototype.on;
DataView.prototype.unsubscribe = DataView.prototype.off;

module.exports = DataView;
},{"./DataSet":2,"./util":31}],4:[function(require,module,exports){
/**
 * A queue
 * @param {Object} options
 *            Available options:
 *            - delay: number    When provided, the queue will be flushed
 *                               automatically after an inactivity of this delay
 *                               in milliseconds.
 *                               Default value is null.
 *            - max: number      When the queue exceeds the given maximum number
 *                               of entries, the queue is flushed automatically.
 *                               Default value of max is Infinity.
 * @constructor
 */
function Queue(options) {
  // options
  this.delay = null;
  this.max = Infinity;

  // properties
  this._queue = [];
  this._timeout = null;
  this._extended = null;

  this.setOptions(options);
}

/**
 * Update the configuration of the queue
 * @param {Object} options
 *            Available options:
 *            - delay: number    When provided, the queue will be flushed
 *                               automatically after an inactivity of this delay
 *                               in milliseconds.
 *                               Default value is null.
 *            - max: number      When the queue exceeds the given maximum number
 *                               of entries, the queue is flushed automatically.
 *                               Default value of max is Infinity.
 * @param options
 */
Queue.prototype.setOptions = function (options) {
  if (options && typeof options.delay !== 'undefined') {
    this.delay = options.delay;
  }
  if (options && typeof options.max !== 'undefined') {
    this.max = options.max;
  }

  this._flushIfNeeded();
};

/**
 * Extend an object with queuing functionality.
 * The object will be extended with a function flush, and the methods provided
 * in options.replace will be replaced with queued ones.
 * @param {Object} object
 * @param {Object} options
 *            Available options:
 *            - replace: Array.<string>
 *                               A list with method names of the methods
 *                               on the object to be replaced with queued ones.
 *            - delay: number    When provided, the queue will be flushed
 *                               automatically after an inactivity of this delay
 *                               in milliseconds.
 *                               Default value is null.
 *            - max: number      When the queue exceeds the given maximum number
 *                               of entries, the queue is flushed automatically.
 *                               Default value of max is Infinity.
 * @return {Queue} Returns the created queue
 */
Queue.extend = function (object, options) {
  var queue = new Queue(options);

  if (object.flush !== undefined) {
    throw new Error('Target object already has a property flush');
  }
  object.flush = function () {
    queue.flush();
  };

  var methods = [{
    name: 'flush',
    original: undefined
  }];

  if (options && options.replace) {
    for (var i = 0; i < options.replace.length; i++) {
      var name = options.replace[i];
      methods.push({
        name: name,
        original: object[name]
      });
      queue.replace(object, name);
    }
  }

  queue._extended = {
    object: object,
    methods: methods
  };

  return queue;
};

/**
 * Destroy the queue. The queue will first flush all queued actions, and in
 * case it has extended an object, will restore the original object.
 */
Queue.prototype.destroy = function () {
  this.flush();

  if (this._extended) {
    var object = this._extended.object;
    var methods = this._extended.methods;
    for (var i = 0; i < methods.length; i++) {
      var method = methods[i];
      if (method.original) {
        object[method.name] = method.original;
      }
      else {
        delete object[method.name];
      }
    }
    this._extended = null;
  }
};

/**
 * Replace a method on an object with a queued version
 * @param {Object} object   Object having the method
 * @param {string} method   The method name
 */
Queue.prototype.replace = function(object, method) {
  var me = this;
  var original = object[method];
  if (!original) {
    throw new Error('Method ' + method + ' undefined');
  }

  object[method] = function () {
    // create an Array with the arguments
    var args = [];
    for (var i = 0; i < arguments.length; i++) {
      args[i] = arguments[i];
    }

    // add this call to the queue
    me.queue({
      args: args,
      fn: original,
      context: this
    });
  };
};

/**
 * Queue a call
 * @param {function | {fn: function, args: Array} | {fn: function, args: Array, context: Object}} entry
 */
Queue.prototype.queue = function(entry) {
  if (typeof entry === 'function') {
    this._queue.push({fn: entry});
  }
  else {
    this._queue.push(entry);
  }

  this._flushIfNeeded();
};

/**
 * Check whether the queue needs to be flushed
 * @private
 */
Queue.prototype._flushIfNeeded = function () {
  // flush when the maximum is exceeded.
  if (this._queue.length > this.max) {
    this.flush();
  }

  // flush after a period of inactivity when a delay is configured
  clearTimeout(this._timeout);
  if (this.queue.length > 0 && typeof this.delay === 'number') {
    var me = this;
    this._timeout = setTimeout(function () {
      me.flush();
    }, this.delay);
  }
};

/**
 * Flush all queued calls
 */
Queue.prototype.flush = function () {
  while (this._queue.length > 0) {
    var entry = this._queue.shift();
    entry.fn.apply(entry.context || entry.fn, entry.args || []);
  }
};

module.exports = Queue;

},{}],5:[function(require,module,exports){
var Hammer = require('./module/hammer');

/**
 * Fake a hammer.js gesture. Event can be a ScrollEvent or MouseMoveEvent
 * @param {Element} element
 * @param {Event} event
 */
exports.fakeGesture = function(element, event) {
  var eventType = null;

  // for hammer.js 1.0.5
  // var gesture = Hammer.event.collectEventData(this, eventType, event);

  // for hammer.js 1.0.6+
  var touches = Hammer.event.getTouchList(event, eventType);
  var gesture = Hammer.event.collectEventData(this, eventType, touches, event);

  // on IE in standards mode, no touches are recognized by hammer.js,
  // resulting in NaN values for center.pageX and center.pageY
  if (isNaN(gesture.center.pageX)) {
    gesture.center.pageX = event.pageX;
  }
  if (isNaN(gesture.center.pageY)) {
    gesture.center.pageY = event.pageY;
  }

  return gesture;
};

},{"./module/hammer":6}],6:[function(require,module,exports){
// Only load hammer.js when in a browser environment
// (loading hammer.js in a node.js environment gives errors)
if (typeof window !== 'undefined') {
  module.exports = window['Hammer'] || require('hammerjs');
}
else {
  module.exports = function () {
    throw Error('hammer.js is only available in a browser, not in node.js.');
  }
}

},{"hammerjs":33}],7:[function(require,module,exports){
// first check if moment.js is already loaded in the browser window, if so,
// use this instance. Else, load via commonjs.
module.exports = (typeof window !== 'undefined') && window['moment'] || require('moment');

},{"moment":35}],8:[function(require,module,exports){
var keycharm = require('keycharm');
var Emitter = require('emitter-component');
var Hammer = require('../module/hammer');
var util = require('../util');

/**
 * Turn an element into an clickToUse element.
 * When not active, the element has a transparent overlay. When the overlay is
 * clicked, the mode is changed to active.
 * When active, the element is displayed with a blue border around it, and
 * the interactive contents of the element can be used. When clicked outside
 * the element, the elements mode is changed to inactive.
 * @param {Element} container
 * @constructor
 */
function Activator(container) {
  this.active = false;

  this.dom = {
    container: container
  };

  this.dom.overlay = document.createElement('div');
  this.dom.overlay.className = 'overlay';

  this.dom.container.appendChild(this.dom.overlay);

  this.hammer = Hammer(this.dom.overlay, {prevent_default: false});
  this.hammer.on('tap', this._onTapOverlay.bind(this));

  // block all touch events (except tap)
  var me = this;
  var events = [
    'touch', 'pinch',
    'doubletap', 'hold',
    'dragstart', 'drag', 'dragend',
    'mousewheel', 'DOMMouseScroll' // DOMMouseScroll is needed for Firefox
  ];
  events.forEach(function (event) {
    me.hammer.on(event, function (event) {
      event.stopPropagation();
    });
  });

  // attach a tap event to the window, in order to deactivate when clicking outside the timeline
  this.windowHammer = Hammer(window, {prevent_default: false});
  this.windowHammer.on('tap', function (event) {
    // deactivate when clicked outside the container
    if (!_hasParent(event.target, container)) {
      me.deactivate();
    }
  });

  if (this.keycharm !== undefined) {
    this.keycharm.destroy();
  }
  this.keycharm = keycharm();

  // keycharm listener only bounded when active)
  this.escListener = this.deactivate.bind(this);
}

// turn into an event emitter
Emitter(Activator.prototype);

// The currently active activator
Activator.current = null;

/**
 * Destroy the activator. Cleans up all created DOM and event listeners
 */
Activator.prototype.destroy = function () {
  this.deactivate();

  // remove dom
  this.dom.overlay.parentNode.removeChild(this.dom.overlay);

  // cleanup hammer instances
  this.hammer = null;
  this.windowHammer = null;
  // FIXME: cleaning up hammer instances doesn't work (Timeline not removed from memory)
};

/**
 * Activate the element
 * Overlay is hidden, element is decorated with a blue shadow border
 */
Activator.prototype.activate = function () {
  // we allow only one active activator at a time
  if (Activator.current) {
    Activator.current.deactivate();
  }
  Activator.current = this;

  this.active = true;
  this.dom.overlay.style.display = 'none';
  util.addClassName(this.dom.container, 'vis-active');

  this.emit('change');
  this.emit('activate');

  // ugly hack: bind ESC after emitting the events, as the Network rebinds all
  // keyboard events on a 'change' event
  this.keycharm.bind('esc', this.escListener);
};

/**
 * Deactivate the element
 * Overlay is displayed on top of the element
 */
Activator.prototype.deactivate = function () {
  this.active = false;
  this.dom.overlay.style.display = '';
  util.removeClassName(this.dom.container, 'vis-active');
  this.keycharm.unbind('esc', this.escListener);

  this.emit('change');
  this.emit('deactivate');
};

/**
 * Handle a tap event: activate the container
 * @param event
 * @private
 */
Activator.prototype._onTapOverlay = function (event) {
  // activate the container
  this.activate();
  event.stopPropagation();
};

/**
 * Test whether the element has the requested parent element somewhere in
 * its chain of parent nodes.
 * @param {HTMLElement} element
 * @param {HTMLElement} parent
 * @returns {boolean} Returns true when the parent is found somewhere in the
 *                    chain of parent nodes.
 * @private
 */
function _hasParent(element, parent) {
  while (element) {
    if (element === parent) {
      return true
    }
    element = element.parentNode;
  }
  return false;
}

module.exports = Activator;

},{"../module/hammer":6,"../util":31,"emitter-component":32,"keycharm":34}],9:[function(require,module,exports){
var Emitter = require('emitter-component');
var Hammer = require('../module/hammer');
var util = require('../util');
var DataSet = require('../DataSet');
var DataView = require('../DataView');
var Range = require('./Range');
var ItemSet = require('./component/ItemSet');
var TimeAxis = require('./component/TimeAxis');
var Activator = require('../shared/Activator');
var DateUtil = require('./DateUtil');
var CustomTime = require('./component/CustomTime');

/**
 * Create a timeline visualization
 * @param {HTMLElement} container
 * @param {vis.DataSet | Array | google.visualization.DataTable} [items]
 * @param {Object} [options]  See Core.setOptions for the available options.
 * @constructor
 */
function Core () {}

// turn Core into an event emitter
Emitter(Core.prototype);

/**
 * Create the main DOM for the Core: a root panel containing left, right,
 * top, bottom, content, and background panel.
 * @param {Element} container  The container element where the Core will
 *                             be attached.
 * @protected
 */
Core.prototype._create = function (container, options, id) {
  this.dom = {};

  this.dom.root                 = document.createElement('div');
  this.dom.background           = document.createElement('div');
  this.dom.backgroundVertical   = document.createElement('div');
  this.dom.backgroundHorizontal = document.createElement('div');
  this.dom.centerContainer      = document.createElement('div');
  this.dom.leftContainer        = document.createElement('div');
  this.dom.rightContainer       = document.createElement('div');
  this.dom.center               = document.createElement('div');
  this.dom.left                 = document.createElement('div');
  this.dom.right                = document.createElement('div');
  this.dom.top                  = document.createElement('div');
  this.dom.bottom               = document.createElement('div');
  this.dom.shadowTop            = document.createElement('div');
  this.dom.shadowBottom         = document.createElement('div');
  this.dom.shadowTopLeft        = document.createElement('div');
  this.dom.shadowBottomLeft     = document.createElement('div');
  this.dom.shadowTopRight       = document.createElement('div');
  this.dom.shadowBottomRight    = document.createElement('div');

  if(typeof id != 'undefined')
  this.dom.root.id                        = id;

  this.dom.root.className                 = 'vis timeline root';
  this.dom.background.className           = 'vispanel background';
  this.dom.backgroundVertical.className   = 'vispanel background vertical';
  this.dom.backgroundHorizontal.className = 'vispanel background horizontal';
  this.dom.centerContainer.className      = 'vispanel center jooo';
  this.dom.leftContainer.className        = 'vispanel left';
  this.dom.rightContainer.className       = 'vispanel right';
  this.dom.top.className                  = 'vispanel top';
  this.dom.bottom.className               = 'vispanel bottom';
  this.dom.left.className                 = 'content';
  this.dom.center.className               = 'content';
  this.dom.right.className                = 'content';
  this.dom.shadowTop.className            = 'shadow top';
  this.dom.shadowBottom.className         = 'shadow bottom';
  this.dom.shadowTopLeft.className        = 'shadow top';
  this.dom.shadowBottomLeft.className     = 'shadow bottom';
  this.dom.shadowTopRight.className       = 'shadow top';
  this.dom.shadowBottomRight.className    = 'shadow bottom';


if(options.results){
  this.dom.rightContainer.style.width = "0px";
}
else{
    this.dom.rightContainer.style.width = "80px";

}
  this.dom.root.appendChild(this.dom.background);
  this.dom.root.appendChild(this.dom.backgroundVertical);
  this.dom.root.appendChild(this.dom.backgroundHorizontal);
  this.dom.root.appendChild(this.dom.centerContainer);
  this.dom.root.appendChild(this.dom.leftContainer);
  this.dom.root.appendChild(this.dom.rightContainer);
  this.dom.root.appendChild(this.dom.top);
  this.dom.root.appendChild(this.dom.bottom);

  this.dom.centerContainer.appendChild(this.dom.center);
  //this.dom.rightContainer.appendChild(this.dom.right);

  this.dom.centerContainer.appendChild(this.dom.shadowTop);
  this.dom.centerContainer.appendChild(this.dom.shadowBottom);
  //this.dom.rightContainer.appendChild(this.dom.shadowTopRight);
  //this.dom.rightContainer.appendChild(this.dom.shadowBottomRight);

  this.on('rangechange', this._redraw.bind(this));
  this.on('touch', this._onTouch.bind(this));
  this.on('pinch', this._onPinch.bind(this));
  this.on('dragstart', this._onDragStart.bind(this));
  this.on('drag', this._onDrag.bind(this));

  var me = this;
  this.on('change', function (properties) {
    if (properties && properties.queue == true) {
      // redraw once on next tick
      if (!me._redrawTimer) {
        me._redrawTimer = setTimeout(function () {
          me._redrawTimer = null;
          me._redraw();
        }, 0)
      }
    }
    else {
      // redraw immediately
      me._redraw();
    }
  });

  // create event listeners for all interesting events, these events will be
  // emitted via emitter
  this.hammer = Hammer(this.dom.root, {
    preventDefault: true
  });
  this.listeners = {};

  var events = [
    'touch', 'pinch',
    'tap', 'doubletap', 'hold',
    'dragstart', 'drag', 'dragend',
    'mousewheel', 'DOMMouseScroll' // DOMMouseScroll is needed for Firefox
  ];
  events.forEach(function (event) {
    var listener = function () {
      var args = [event].concat(Array.prototype.slice.call(arguments, 0));
      if (me.isActive()) {
        me.emit.apply(me, args);
      }
    };
    me.hammer.on(event, listener);
    me.listeners[event] = listener;
  });

  // size properties of each of the panels
  this.props = {
    root: {},
    background: {},
    centerContainer: {},
    leftContainer: {},
    rightContainer: {},
    center: {},
    left: {},
    right: {},
    top: {},
    bottom: {},
    border: {},
    scrollTop: 0,
    scrollTopMin: 0
  };
  this.touch = {}; // store state information needed for touch events

  this.redrawCount = 0;

  // attach the root panel to the provided container
  if (!container) throw new Error('No container provided');
  container.appendChild(this.dom.root);
};

/**
 * Set options. Options will be passed to all components loaded in the Timeline.
 * @param {Object} [options]
 *                           {String} orientation
 *                              Vertical orientation for the Timeline,
 *                              can be 'bottom' (default) or 'top'.
 *                           {String | Number} width
 *                              Width for the timeline, a number in pixels or
 *                              a css string like '1000px' or '75%'. '100%' by default.
 *                           {String | Number} height
 *                              Fixed height for the Timeline, a number in pixels or
 *                              a css string like '400px' or '75%'. If undefined,
 *                              The Timeline will automatically size such that
 *                              its contents fit.
 *                           {String | Number} minHeight
 *                              Minimum height for the Timeline, a number in pixels or
 *                              a css string like '400px' or '75%'.
 *                           {String | Number} maxHeight
 *                              Maximum height for the Timeline, a number in pixels or
 *                              a css string like '400px' or '75%'.
 *                           {Number | Date | String} start
 *                              Start date for the visible window
 *                           {Number | Date | String} end
 *                              End date for the visible window
 */
Core.prototype.setOptions = function (options) {
  if (options) {
    // copy the known options
    var fields = ['moreResultsId', 'results', 'width', 'height', 'minHeight', 'maxHeight', 'autoResize', 'start', 'end', 'orientation', 'clickToUse', 'dataAttributes', 'hiddenDates'];
    util.selectiveExtend(fields, this.options, options);

    if (this.options.orientation === 'both') {
      if (!this.timeAxis2) {
        var timeAxis2 = this.timeAxis2 = new TimeAxis(this.body);
        timeAxis2.setOptions = function (options) {
          var _options = options ? util.extend({}, options) : {};
          _options.orientation = 'top'; // override the orientation option, always top
          TimeAxis.prototype.setOptions.call(timeAxis2, _options);
        };
        this.components.push(timeAxis2);
      }
    }
    else {
      if (this.timeAxis2) {
        var index = this.components.indexOf(this.timeAxis2);
        if (index !== -1) {
          this.components.splice(index, 1);
        }
        this.timeAxis2.destroy();
        this.timeAxis2 = null;
      }
    }

    if ('hiddenDates' in this.options) {
      DateUtil.convertHiddenOptions(this.body, this.options.hiddenDates);
    }

    if ('clickToUse' in options) {
      if (options.clickToUse) {
        if (!this.activator) {
          this.activator = new Activator(this.dom.root);
        }
      }
      else {
        if (this.activator) {
          this.activator.destroy();
          delete this.activator;
        }
      }
    }

    // enable/disable autoResize
    this._initAutoResize();
  }

  // propagate options to all components
  this.components.forEach(function (component) {
    component.setOptions(options);
  });

  // redraw everything
  this._redraw();
};

/**
 * Returns true when the Timeline is active.
 * @returns {boolean}
 */
Core.prototype.isActive = function () {
  return !this.activator || this.activator.active;
};

/**
 * Destroy the Core, clean up all DOM elements and event listeners.
 */
Core.prototype.destroy = function () {
  // unbind datasets
  this.clear();

  // remove all event listeners
  this.off();

  // stop checking for changed size
  this._stopAutoResize();

  // remove from DOM
  if (this.dom.root.parentNode) {
    this.dom.root.parentNode.removeChild(this.dom.root);
  }
  this.dom = null;

  // remove Activator
  if (this.activator) {
    this.activator.destroy();
    delete this.activator;
  }

  // cleanup hammer touch events
  for (var event in this.listeners) {
    if (this.listeners.hasOwnProperty(event)) {
      delete this.listeners[event];
    }
  }
  this.listeners = null;
  this.hammer = null;

  // give all components the opportunity to cleanup
  this.components.forEach(function (component) {
    component.destroy();
  });

  this.body = null;
};


/**
 * Set a custom time bar
 * @param {Date} time
 * @param {int} id
 */
Core.prototype.setCustomTime = function (time, id) {
  if (!this.customTime) {
    throw new Error('Cannot get custom time: Custom time bar is not enabled');
  }

  var barId = id || 0;

  this.components.forEach(function (element, index, components) {
    if (element instanceof CustomTime && element.options.id === barId) {
      element.setCustomTime(time);
    }
  });
};

/**
 * Retrieve the current custom time.
 * @return {Date} customTime
 * @param {int} id
 */
Core.prototype.getCustomTime = function(id) {
  if (!this.customTime) {
    throw new Error('Cannot get custom time: Custom time bar is not enabled');
  }

  var barId = id || 0,
      customTime = this.customTime.getCustomTime();

  this.components.forEach(function (element, index, components) {
    if (element instanceof CustomTime && element.options.id === barId) {
      customTime = element.getCustomTime();
    }
  });

  return customTime;
};

/**
 * Add custom vertical bar
 * @param {Date | String | Number} time  A Date, unix timestamp, or
 *                                      ISO date string. Time point where the new bar should be placed
 * @param {Number | String} ID of the new bar
 * @return {Number | String} ID of the new bar
 */
Core.prototype.addCustomTime = function (time, id) {
  if (!this.currentTime) {
    throw new Error('Option showCurrentTime must be true');
  }

  if (time === undefined) {
    throw new Error('Time parameter for the custom bar must be provided');
  }

  var ts = util.convert(time, 'Date').valueOf(),
      numIds, customTime, customBarId;

  // All bar IDs are kept in 1 array, mixed types
  // Bar with ID 0 is the default bar.
  if (!this.customBarIds || this.customBarIds.constructor !== Array) {
    this.customBarIds = [0];
  }

  // If the ID is not provided, generate one, otherwise just use it
  if (id === undefined) {

    numIds = this.customBarIds.filter(function (element) {
      return util.isNumber(element);
    });

    customBarId = numIds.length > 0 ? Math.max.apply(null, numIds) + 1 : 1;

  } else {
    
    // Check for duplicates
    this.customBarIds.forEach(function (element) {
      if (element === id) {
        throw new Error('Custom time ID already exists');
      }
    });

    customBarId = id;
  }

  this.customBarIds.push(customBarId);

  customTime = new CustomTime(this.body, {
    showCustomTime : true,
    time : ts,
    id : customBarId
  });

  this.components.push(customTime);
  this.redraw();

  return customBarId;
};

/**
 * Remove previously added custom bar
 * @param {int} id ID of the custom bar to be removed
 * @return {boolean} True if the bar exists and is removed, false otherwise
 */
Core.prototype.removeCustomTime = function (id) {

  var me = this;

  this.components.forEach(function (bar, index, components) {
    if (bar instanceof CustomTime && bar.options.id === id) {
      // Only the lines added by the user will be removed
      if (bar.options.id !== 0) {
        me.customBarIds.splice(me.customBarIds.indexOf(id), 1);
        components.splice(index, 1);
        bar.destroy();
      }
    }
  });
};


/**
 * Get the id's of the currently visible items.
 * @returns {Array} The ids of the visible items
 */
Core.prototype.getVisibleItems = function() {
  return this.itemSet && this.itemSet.getVisibleItems() || [];
};



/**
 * Clear the Core. By Default, items, groups and options are cleared.
 * Example usage:
 *
 *     timeline.clear();                // clear items, groups, and options
 *     timeline.clear({options: true}); // clear options only
 *
 * @param {Object} [what]      Optionally specify what to clear. By default:
 *                             {items: true, groups: true, options: true}
 */
Core.prototype.clear = function(what) {
  // clear items
  if (!what || what.items) {
    this.setItems(null);
  }

  // clear groups
  if (!what || what.groups) {
    this.setGroups(null);
  }

  // clear options of timeline and of each of the components
  if (!what || what.options) {
    this.components.forEach(function (component) {
      component.setOptions(component.defaultOptions);
    });

    this.setOptions(this.defaultOptions); // this will also do a redraw
  }
};

/**
 * Set Core window such that it fits all items
 * @param {Object} [options]  Available options:
 *                            `animate: boolean | number`
 *                                 If true (default), the range is animated
 *                                 smoothly to the new window.
 *                                 If a number, the number is taken as duration
 *                                 for the animation. Default duration is 500 ms.
 */
Core.prototype.fit = function(options) {
  var range = this._getDataRange();

  range.start = moment().set("hour", 6).set("minute",0);
  range.end = moment().set("hour", 22).set("minute",0);

  // skip range set if there is no start and end date
  if (range.start === null && range.end === null) {
    return;
  }

  var animate = (options && options.animate !== undefined) ? options.animate : true;
  this.range.setRange(range.start, range.end, animate);
};

/**
 * Calculate the data range of the items and applies a 5% window around it.
 * @returns {{start: Date | null, end: Date | null}}
 * @protected
 */
Core.prototype._getDataRange = function() {
  // apply the data range as range
  var dataRange = this.getItemRange();

  // add 5% space on both sides
  var start = dataRange.min;
  var end = dataRange.max;
  if (start != null && end != null) {
    var interval = (end.valueOf() - start.valueOf());
    if (interval <= 0) {
      // prevent an empty interval
      interval = 24 * 60 * 60 * 1000; // 1 day
    }
    start = new Date(start.valueOf() - interval * 0.1);
    end = new Date(end.valueOf() + interval * 0.3);
  }

  return {
    start: start,
    end: end
  }
};

/**
 * Set the visible window. Both parameters are optional, you can change only
 * start or only end. Syntax:
 *
 *     TimeLine.setWindow(start, end)
 *     TimeLine.setWindow(start, end, options)
 *     TimeLine.setWindow(range)
 *
 * Where start and end can be a Date, number, or string, and range is an
 * object with properties start and end.
 *
 * @param {Date | Number | String | Object} [start] Start date of visible window
 * @param {Date | Number | String} [end]            End date of visible window
 * @param {Object} [options]  Available options:
 *                            `animate: boolean | number`
 *                                 If true (default), the range is animated
 *                                 smoothly to the new window.
 *                                 If a number, the number is taken as duration
 *                                 for the animation. Default duration is 500 ms.
 */
Core.prototype.setWindow = function(start, end, options) {
  var animate;
  if (arguments.length == 1) {
    var range = arguments[0];
    animate = (range.animate !== undefined) ? range.animate : true;
    this.range.setRange(range.start, range.end, animate);
  }
  else {
    animate = (options && options.animate !== undefined) ? options.animate : true;
    this.range.setRange(start, end, animate);
  }
};

/**
 * Move the window such that given time is centered on screen.
 * @param {Date | Number | String} time
 * @param {Object} [options]  Available options:
 *                            `animate: boolean | number`
 *                                 If true (default), the range is animated
 *                                 smoothly to the new window.
 *                                 If a number, the number is taken as duration
 *                                 for the animation. Default duration is 500 ms.
 */
Core.prototype.moveTo = function(time, options) {
  var interval = this.range.end - this.range.start;
  var t = util.convert(time, 'Date').valueOf();

  var start = t - interval / 2;
  var end = t + interval / 2;
  var animate = (options && options.animate !== undefined) ? options.animate : true;

  this.range.setRange(start, end, animate);
};

/**
 * Get the visible window
 * @return {{start: Date, end: Date}}   Visible range
 */
Core.prototype.getWindow = function() {
  var range = this.range.getRange();
  return {
    start: new Date(range.start),
    end: new Date(range.end)
  };
};

/**
 * Force a redraw. Can be overridden by implementations of Core
 */
Core.prototype.redraw = function() {
  this._redraw();
};

/**
 * Redraw for internal use. Redraws all components. See also the public
 * method redraw.
 * @protected
 */
Core.prototype._redraw = function() {
  var resized = false;
  var options = this.options;
  var props = this.props;
  var dom = this.dom;

  if (!dom) return; // when destroyed

  DateUtil.updateHiddenDates(this.body, this.options.hiddenDates);

  // update class names
  if (options.orientation == 'top') {
    util.addClassName(dom.root, 'top');
    util.removeClassName(dom.root, 'bottom');
  }
  else {
    util.removeClassName(dom.root, 'top');
    util.addClassName(dom.root, 'bottom');
  }

  // update root width and height options
  dom.root.style.maxHeight = util.option.asSize(options.maxHeight, '');
  dom.root.style.minHeight = util.option.asSize(options.minHeight, '');
  dom.root.style.width = util.option.asSize(options.width, '');

  // calculate border widths
  props.border.left   = (dom.centerContainer.offsetWidth - dom.centerContainer.clientWidth) / 2;
  props.border.right  = props.border.left;
  props.border.top    = (dom.centerContainer.offsetHeight - dom.centerContainer.clientHeight) / 2;
  props.border.bottom = props.border.top;
  var borderRootHeight= dom.root.offsetHeight - dom.root.clientHeight;
  var borderRootWidth = dom.root.offsetWidth - dom.root.clientWidth;

  // workaround for a bug in IE: the clientWidth of an element with
  // a height:0px and overflow:hidden is not calculated and always has value 0
  if (dom.centerContainer.clientHeight === 0) {
    props.border.left = props.border.top;
    props.border.right  = props.border.left;
  }
  if (dom.root.clientHeight === 0) {
    borderRootWidth = borderRootHeight;
  }

  // calculate the heights. If any of the side panels is empty, we set the height to
  // minus the border width, such that the border will be invisible
  props.center.height = dom.center.offsetHeight;
  props.left.height   = dom.left.offsetHeight;
  props.right.height  = dom.right.offsetHeight;
  props.top.height    = dom.top.clientHeight    || -props.border.top;
  props.bottom.height = dom.bottom.clientHeight || -props.border.bottom;

  // TODO: compensate borders when any of the panels is empty.

  // apply auto height
  // TODO: only calculate autoHeight when needed (else we cause an extra reflow/repaint of the DOM)
  var contentHeight = Math.max(props.left.height, props.center.height, props.right.height);
  var autoHeight = props.top.height + contentHeight + props.bottom.height +
    borderRootHeight + props.border.top + props.border.bottom;
  dom.root.style.height = util.option.asSize(options.height, autoHeight + 'px');

  // calculate heights of the content panels
  props.root.height = dom.root.offsetHeight;
  props.background.height = props.root.height - borderRootHeight;
  var containerHeight = props.root.height - props.top.height - props.bottom.height -
    borderRootHeight;
  props.centerContainer.height  = containerHeight;
  props.leftContainer.height    = containerHeight;
  props.rightContainer.height   = props.leftContainer.height;

  // calculate the widths of the panels
  props.root.width = dom.root.offsetWidth;
  props.background.width = props.root.width - borderRootWidth;
  props.left.width = dom.leftContainer.clientWidth   || -props.border.left;
  props.leftContainer.width = props.left.width;
  props.right.width = dom.rightContainer.clientWidth || -props.border.right;
  props.rightContainer.width = props.right.width;
  var centerWidth = props.root.width - props.left.width - props.right.width - borderRootWidth;
  props.center.width          = centerWidth;
  props.centerContainer.width = centerWidth;
  props.top.width             = centerWidth;
  props.bottom.width          = centerWidth;

  // resize the panels
  dom.background.style.height           = props.background.height + 'px';
  dom.backgroundVertical.style.height   = props.background.height + 'px';
  dom.backgroundHorizontal.style.height = props.centerContainer.height + 'px';
  dom.centerContainer.style.height      = props.centerContainer.height + 'px';
  dom.leftContainer.style.height        = props.leftContainer.height + 'px';
  dom.rightContainer.style.height       = props.rightContainer.height + 'px';

  dom.background.style.width            = props.background.width + 'px';
  dom.backgroundVertical.style.width    = props.centerContainer.width + 'px';
  dom.backgroundHorizontal.style.width  = props.background.width + 'px';
  dom.centerContainer.style.width       = props.center.width + 'px';
  dom.top.style.width                   = props.top.width + 'px';
  dom.bottom.style.width                = props.bottom.width + 'px';

  // reposition the panels
  dom.background.style.left           = '0';
  dom.background.style.top            = '0';
  dom.backgroundVertical.style.left   = (props.left.width + props.border.left) + 'px';
  dom.backgroundVertical.style.top    = '0';
  dom.backgroundHorizontal.style.left = '0';
  dom.backgroundHorizontal.style.top  = props.top.height + 'px';
  dom.centerContainer.style.left      = props.left.width + 'px';
  dom.centerContainer.style.top       = props.top.height + 'px';
  dom.leftContainer.style.left        = '0';
  dom.leftContainer.style.top         = props.top.height + 'px';
  dom.rightContainer.style.left       = (props.left.width + props.center.width) + 'px';
  dom.rightContainer.style.top        = props.top.height + 'px';
  dom.top.style.left                  = props.left.width + 'px';
  dom.top.style.top                   = '0';
  dom.bottom.style.left               = props.left.width + 'px';
  dom.bottom.style.top                = (props.top.height + props.centerContainer.height) + 'px';

  // update the scrollTop, feasible range for the offset can be changed
  // when the height of the Core or of the contents of the center changed
  this._updateScrollTop();

  // reposition the scrollable contents
  var offset = this.props.scrollTop;
  if (options.orientation == 'bottom') {
    offset += Math.max(this.props.centerContainer.height - this.props.center.height -
      this.props.border.top - this.props.border.bottom, 0);
  }
  dom.center.style.left = '0';
  dom.center.style.top  = offset + 'px';
  dom.left.style.left   = '0';
  dom.left.style.top    = offset + 'px';
  dom.right.style.left  = '0';
  dom.right.style.top   = offset + 'px';

  // show shadows when vertical scrolling is available
  var visibilityTop = this.props.scrollTop == 0 ? 'hidden' : '';
  var visibilityBottom = this.props.scrollTop == this.props.scrollTopMin ? 'hidden' : '';
  dom.shadowTop.style.visibility          = visibilityTop;
  dom.shadowBottom.style.visibility       = visibilityBottom;
  dom.shadowTopLeft.style.visibility      = visibilityTop;
  dom.shadowBottomLeft.style.visibility   = visibilityBottom;
  dom.shadowTopRight.style.visibility     = visibilityTop;
  dom.shadowBottomRight.style.visibility  = visibilityBottom;

  // redraw all components
  this.components.forEach(function (component) {
    resized = component.redraw() || resized;
  });
  if (resized) {
    // keep repainting until all sizes are settled
    var MAX_REDRAWS = 5; // maximum number of consecutive redraws
    if (this.redrawCount < MAX_REDRAWS) {
      this.redrawCount++;
      this._redraw();
    }
    else {
      console.log('WARNING: infinite loop in redraw?');
    }
    this.redrawCount = 0;
  }

  this.emit("finishedRedraw");
};

// TODO: deprecated since version 1.1.0, remove some day
Core.prototype.repaint = function () {
  throw new Error('Function repaint is deprecated. Use redraw instead.');
};

/**
 * Set a current time. This can be used for example to ensure that a client's
 * time is synchronized with a shared server time.
 * Only applicable when option `showCurrentTime` is true.
 * @param {Date | String | Number} time     A Date, unix timestamp, or
 *                                          ISO date string.
 */
Core.prototype.setCurrentTime = function(time) {
  if (!this.currentTime) {
    throw new Error('Option showCurrentTime must be true');
  }

  this.currentTime.setCurrentTime(time);
};

/**
 * Get the current time.
 * Only applicable when option `showCurrentTime` is true.
 * @return {Date} Returns the current time.
 */
Core.prototype.getCurrentTime = function() {
  if (!this.currentTime) {
    throw new Error('Option showCurrentTime must be true');
  }

  return this.currentTime.getCurrentTime();
};

/**
 * Convert a position on screen (pixels) to a datetime
 * @param {int}     x    Position on the screen in pixels
 * @return {Date}   time The datetime the corresponds with given position x
 * @protected
 */
// TODO: move this function to Range
Core.prototype._toTime = function(x) {
  return DateUtil.toTime(this, x, this.props.center.width);
};

/**
 * Convert a position on the global screen (pixels) to a datetime
 * @param {int}     x    Position on the screen in pixels
 * @return {Date}   time The datetime the corresponds with given position x
 * @protected
 */
// TODO: move this function to Range
Core.prototype._toGlobalTime = function(x) {
  return DateUtil.toTime(this, x, this.props.root.width);
  //var conversion = this.range.conversion(this.props.root.width);
  //return new Date(x / conversion.scale + conversion.offset);
};

/**
 * Convert a datetime (Date object) into a position on the screen
 * @param {Date}   time A date
 * @return {int}   x    The position on the screen in pixels which corresponds
 *                      with the given date.
 * @protected
 */
// TODO: move this function to Range
Core.prototype._toScreen = function(time) {
  return DateUtil.toScreen(this, time, this.props.center.width);
};



/**
 * Convert a datetime (Date object) into a position on the root
 * This is used to get the pixel density estimate for the screen, not the center panel
 * @param {Date}   time A date
 * @return {int}   x    The position on root in pixels which corresponds
 *                      with the given date.
 * @protected
 */
// TODO: move this function to Range
Core.prototype._toGlobalScreen = function(time) {
  return DateUtil.toScreen(this, time, this.props.root.width);
  //var conversion = this.range.conversion(this.props.root.width);
  //return (time.valueOf() - conversion.offset) * conversion.scale;
};


/**
 * Initialize watching when option autoResize is true
 * @private
 */
Core.prototype._initAutoResize = function () {
  if (this.options.autoResize == true) {
    this._startAutoResize();
  }
  else {
    this._stopAutoResize();
  }
};

/**
 * Watch for changes in the size of the container. On resize, the Panel will
 * automatically redraw itself.
 * @private
 */
Core.prototype._startAutoResize = function () {
  var me = this;

  this._stopAutoResize();

  this._onResize = function() {
    if (me.options.autoResize != true) {
      // stop watching when the option autoResize is changed to false
      me._stopAutoResize();
      return;
    }

    if (me.dom.root) {
      // check whether the frame is resized
      // Note: we compare offsetWidth here, not clientWidth. For some reason,
      // IE does not restore the clientWidth from 0 to the actual width after
      // changing the timeline's container display style from none to visible
      if ((me.dom.root.offsetWidth != me.props.lastWidth) ||
        (me.dom.root.offsetHeight != me.props.lastHeight)) {
        me.props.lastWidth = me.dom.root.offsetWidth;
        me.props.lastHeight = me.dom.root.offsetHeight;

        me.emit('change');
      }
    }
  };

  // add event listener to window resize
  util.addEventListener(window, 'resize', this._onResize);

  this.watchTimer = setInterval(this._onResize, 1000);
};

/**
 * Stop watching for a resize of the frame.
 * @private
 */
Core.prototype._stopAutoResize = function () {
  if (this.watchTimer) {
    clearInterval(this.watchTimer);
    this.watchTimer = undefined;
  }

  // remove event listener on window.resize
  util.removeEventListener(window, 'resize', this._onResize);
  this._onResize = null;
};

/**
 * Start moving the timeline vertically
 * @param {Event} event
 * @private
 */
Core.prototype._onTouch = function (event) {
  this.touch.allowDragging = true;
};

/**
 * Start moving the timeline vertically
 * @param {Event} event
 * @private
 */
Core.prototype._onPinch = function (event) {
  this.touch.allowDragging = false;
};

/**
 * Start moving the timeline vertically
 * @param {Event} event
 * @private
 */
Core.prototype._onDragStart = function (event) {
  this.touch.initialScrollTop = this.props.scrollTop;
};

/**
 * Move the timeline vertically
 * @param {Event} event
 * @private
 */
Core.prototype._onDrag = function (event) {
  // refuse to drag when we where pinching to prevent the timeline make a jump
  // when releasing the fingers in opposite order from the touch screen
  if (!this.touch.allowDragging) return;

  var delta = event.gesture.deltaY;

  var oldScrollTop = this._getScrollTop();
  var newScrollTop = this._setScrollTop(this.touch.initialScrollTop + delta);


  if (newScrollTop != oldScrollTop) {
    this._redraw(); // TODO: this causes two redraws when dragging, the other is triggered by rangechange already
    this.emit("verticalDrag");
  }
};

/**
 * Apply a scrollTop
 * @param {Number} scrollTop
 * @returns {Number} scrollTop  Returns the applied scrollTop
 * @private
 */
Core.prototype._setScrollTop = function (scrollTop) {
  this.props.scrollTop = scrollTop;
  this._updateScrollTop();
  return this.props.scrollTop;
};

/**
 * Update the current scrollTop when the height of  the containers has been changed
 * @returns {Number} scrollTop  Returns the applied scrollTop
 * @private
 */
Core.prototype._updateScrollTop = function () {
  // recalculate the scrollTopMin
  var scrollTopMin = Math.min(this.props.centerContainer.height - this.props.center.height, 0); // is negative or zero
  if (scrollTopMin != this.props.scrollTopMin) {
    // in case of bottom orientation, change the scrollTop such that the contents
    // do not move relative to the time axis at the bottom
    if (this.options.orientation == 'bottom') {
      this.props.scrollTop += (scrollTopMin - this.props.scrollTopMin);
    }
    this.props.scrollTopMin = scrollTopMin;
  }

  // limit the scrollTop to the feasible scroll range
  if (this.props.scrollTop > 0) this.props.scrollTop = 0;
  if (this.props.scrollTop < scrollTopMin) this.props.scrollTop = scrollTopMin;

  return this.props.scrollTop;
};

/**
 * Get the current scrollTop
 * @returns {number} scrollTop
 * @private
 */
Core.prototype._getScrollTop = function () {
  return this.props.scrollTop;
};

module.exports = Core;

},{"../DataSet":2,"../DataView":3,"../module/hammer":6,"../shared/Activator":8,"../util":31,"./DateUtil":10,"./Range":12,"./component/CustomTime":20,"./component/ItemSet":22,"./component/TimeAxis":23,"emitter-component":32}],10:[function(require,module,exports){
/**
 * Created by Alex on 10/3/2014.
 */
var moment = require('../module/moment');


/**
 * used in Core to convert the options into a volatile variable
 * 
 * @param Core
 */
exports.convertHiddenOptions = function(body, hiddenDates) {
  body.hiddenDates = [];
  if (hiddenDates) {
    if (Array.isArray(hiddenDates) == true) {
      for (var i = 0; i < hiddenDates.length; i++) {
        if (hiddenDates[i].repeat === undefined) {
          var dateItem = {};
          dateItem.start = moment(hiddenDates[i].start).toDate().valueOf();
          dateItem.end = moment(hiddenDates[i].end).toDate().valueOf();
          body.hiddenDates.push(dateItem);
        }
      }
      body.hiddenDates.sort(function (a, b) {
        return a.start - b.start;
      }); // sort by start time
    }
  }
};


/**
 * create new entrees for the repeating hidden dates
 * @param body
 * @param hiddenDates
 */
exports.updateHiddenDates = function (body, hiddenDates) {
  if (hiddenDates && body.domProps.centerContainer.width !== undefined) {
    exports.convertHiddenOptions(body, hiddenDates);

    var start = moment(body.range.start);
    var end = moment(body.range.end);

    var totalRange = (body.range.end - body.range.start);
    var pixelTime = totalRange / body.domProps.centerContainer.width;

    for (var i = 0; i < hiddenDates.length; i++) {
      if (hiddenDates[i].repeat !== undefined) {
        var startDate = moment(hiddenDates[i].start);
        var endDate = moment(hiddenDates[i].end);

        if (startDate._d == "Invalid Date") {
          throw new Error("Supplied start date is not valid: " + hiddenDates[i].start);
        }
        if (endDate._d == "Invalid Date") {
          throw new Error("Supplied end date is not valid: " + hiddenDates[i].end);
        }

        var duration = endDate - startDate;
        if (duration >= 4 * pixelTime) {

          var offset = 0;
          var runUntil = end.clone();
          switch (hiddenDates[i].repeat) {
            case "daily": // case of time
              if (startDate.day() != endDate.day()) {
                offset = 1;
              }
              startDate.dayOfYear(start.dayOfYear());
              startDate.year(start.year());
              startDate.subtract(7,'days');

              endDate.dayOfYear(start.dayOfYear());
              endDate.year(start.year());
              endDate.subtract(7 - offset,'days');

              runUntil.add(1, 'weeks');
              break;
            case "weekly":
              var dayOffset = endDate.diff(startDate,'days')
              var day = startDate.day();

              // set the start date to the range.start
              startDate.date(start.date());
              startDate.month(start.month());
              startDate.year(start.year());
              endDate = startDate.clone();

              // force
              startDate.day(day);
              endDate.day(day);
              endDate.add(dayOffset,'days');

              startDate.subtract(1,'weeks');
              endDate.subtract(1,'weeks');

              runUntil.add(1, 'weeks');
              break
            case "monthly":
              if (startDate.month() != endDate.month()) {
                offset = 1;
              }
              startDate.month(start.month());
              startDate.year(start.year());
              startDate.subtract(1,'months');

              endDate.month(start.month());
              endDate.year(start.year());
              endDate.subtract(1,'months');
              endDate.add(offset,'months');

              runUntil.add(1, 'months');
              break;
            case "yearly":
              if (startDate.year() != endDate.year()) {
                offset = 1;
              }
              startDate.year(start.year());
              startDate.subtract(1,'years');
              endDate.year(start.year());
              endDate.subtract(1,'years');
              endDate.add(offset,'years');

              runUntil.add(1, 'years');
              break;
            default:
              console.log("Wrong repeat format, allowed are: daily, weekly, monthly, yearly. Given:", hiddenDates[i].repeat);
              return;
          }
          while (startDate < runUntil) {
            body.hiddenDates.push({start: startDate.valueOf(), end: endDate.valueOf()});
            switch (hiddenDates[i].repeat) {
              case "daily":
                startDate.add(1, 'days');
                endDate.add(1, 'days');
                break;
              case "weekly":
                startDate.add(1, 'weeks');
                endDate.add(1, 'weeks');
                break
              case "monthly":
                startDate.add(1, 'months');
                endDate.add(1, 'months');
                break;
              case "yearly":
                startDate.add(1, 'y');
                endDate.add(1, 'y');
                break;
              default:
                console.log("Wrong repeat format, allowed are: daily, weekly, monthly, yearly. Given:", hiddenDates[i].repeat);
                return;
            }
          }
          body.hiddenDates.push({start: startDate.valueOf(), end: endDate.valueOf()});
        }
      }
    }
    // remove duplicates, merge where possible
    exports.removeDuplicates(body);
    // ensure the new positions are not on hidden dates
    var startHidden = exports.isHidden(body.range.start, body.hiddenDates);
    var endHidden = exports.isHidden(body.range.end,body.hiddenDates);
    var rangeStart = body.range.start;
    var rangeEnd = body.range.end;
    if (startHidden.hidden == true) {rangeStart = body.range.startToFront == true ? startHidden.startDate - 1 : startHidden.endDate + 1;}
    if (endHidden.hidden == true)   {rangeEnd   = body.range.endToFront == true ?   endHidden.startDate - 1   : endHidden.endDate + 1;}
    if (startHidden.hidden == true || endHidden.hidden == true) {
      body.range._applyRange(rangeStart, rangeEnd);
    }
  }

}


/**
 * remove duplicates from the hidden dates list. Duplicates are evil. They mess everything up.
 * Scales with N^2
 * @param body
 */
exports.removeDuplicates = function(body) {
  var hiddenDates = body.hiddenDates;
  var safeDates = [];
  for (var i = 0; i < hiddenDates.length; i++) {
    for (var j = 0; j < hiddenDates.length; j++) {
      if (i != j && hiddenDates[j].remove != true && hiddenDates[i].remove != true) {
        // j inside i
        if (hiddenDates[j].start >= hiddenDates[i].start && hiddenDates[j].end <= hiddenDates[i].end) {
          hiddenDates[j].remove = true;
        }
        // j start inside i
        else if (hiddenDates[j].start >= hiddenDates[i].start && hiddenDates[j].start <= hiddenDates[i].end) {
          hiddenDates[i].end = hiddenDates[j].end;
          hiddenDates[j].remove = true;
        }
        // j end inside i
        else if (hiddenDates[j].end >= hiddenDates[i].start && hiddenDates[j].end <= hiddenDates[i].end) {
          hiddenDates[i].start = hiddenDates[j].start;
          hiddenDates[j].remove = true;
        }
      }
    }
  }

  for (var i = 0; i < hiddenDates.length; i++) {
    if (hiddenDates[i].remove !== true) {
      safeDates.push(hiddenDates[i]);
    }
  }

  body.hiddenDates = safeDates;
  body.hiddenDates.sort(function (a, b) {
    return a.start - b.start;
  }); // sort by start time
}

exports.printDates = function(dates) {
  for (var i =0; i < dates.length; i++) {
    console.log(i, new Date(dates[i].start),new Date(dates[i].end), dates[i].start, dates[i].end, dates[i].remove);
  }
}

/**
 * Used in TimeStep to avoid the hidden times.
 * @param timeStep
 * @param previousTime
 */
exports.stepOverHiddenDates = function(timeStep, previousTime) {
  var stepInHidden = false;
  var currentValue = timeStep.current.valueOf();
  for (var i = 0; i < timeStep.hiddenDates.length; i++) {
    var startDate = timeStep.hiddenDates[i].start;
    var endDate = timeStep.hiddenDates[i].end;
    if (currentValue >= startDate && currentValue < endDate) {
      stepInHidden = true;
      break;
    }
  }

  if (stepInHidden == true && currentValue < timeStep._end.valueOf() && currentValue != previousTime) {
    var prevValue = moment(previousTime);
    var newValue = moment(endDate);
    //check if the next step should be major
    if (prevValue.year() != newValue.year()) {timeStep.switchedYear = true;}
    else if (prevValue.month() != newValue.month()) {timeStep.switchedMonth = true;}
    else if (prevValue.dayOfYear() != newValue.dayOfYear()) {timeStep.switchedDay = true;}

    timeStep.current = newValue.toDate();
  }
};


///**
// * Used in TimeStep to avoid the hidden times.
// * @param timeStep
// * @param previousTime
// */
//exports.checkFirstStep = function(timeStep) {
//  var stepInHidden = false;
//  var currentValue = timeStep.current.valueOf();
//  for (var i = 0; i < timeStep.hiddenDates.length; i++) {
//    var startDate = timeStep.hiddenDates[i].start;
//    var endDate = timeStep.hiddenDates[i].end;
//    if (currentValue >= startDate && currentValue < endDate) {
//      stepInHidden = true;
//      break;
//    }
//  }
//
//  if (stepInHidden == true && currentValue <= timeStep._end.valueOf()) {
//    var newValue = moment(endDate);
//    timeStep.current = newValue.toDate();
//  }
//};

/**
 * replaces the Core toScreen methods
 * @param Core
 * @param time
 * @param width
 * @returns {number}
 */
exports.toScreen = function(Core, time, width) {
  if (Core.body.hiddenDates.length == 0) {
    var conversion = Core.range.conversion(width);
    return (time.valueOf() - conversion.offset) * conversion.scale;
  }
  else {
    var hidden = exports.isHidden(time, Core.body.hiddenDates)
    if (hidden.hidden == true) {
      time = hidden.startDate;
    }

    var duration = exports.getHiddenDurationBetween(Core.body.hiddenDates, Core.range.start, Core.range.end);
    time = exports.correctTimeForHidden(Core.body.hiddenDates, Core.range, time);

    var conversion = Core.range.conversion(width, duration);
    return (time.valueOf() - conversion.offset) * conversion.scale;
  }
};


/**
 * Replaces the core toTime methods
 * @param body
 * @param range
 * @param x
 * @param width
 * @returns {Date}
 */
exports.toTime = function(Core, x, width) {
  if (Core.body.hiddenDates.length == 0) {
    var conversion = Core.range.conversion(width);
    return new Date(x / conversion.scale + conversion.offset);
  }
  else {
    var hiddenDuration = exports.getHiddenDurationBetween(Core.body.hiddenDates, Core.range.start, Core.range.end);
    var totalDuration = Core.range.end - Core.range.start - hiddenDuration;
    var partialDuration = totalDuration * x / width;
    var accumulatedHiddenDuration = exports.getAccumulatedHiddenDuration(Core.body.hiddenDates, Core.range, partialDuration);

    var newTime = new Date(accumulatedHiddenDuration + partialDuration + Core.range.start);
    return newTime;
  }
};


/**
 * Support function
 *
 * @param hiddenDates
 * @param range
 * @returns {number}
 */
exports.getHiddenDurationBetween = function(hiddenDates, start, end) {
  var duration = 0;
  for (var i = 0; i < hiddenDates.length; i++) {
    var startDate = hiddenDates[i].start;
    var endDate = hiddenDates[i].end;
    // if time after the cutout, and the
    if (startDate >= start && endDate < end) {
      duration += endDate - startDate;
    }
  }
  return duration;
};


/**
 * Support function
 * @param hiddenDates
 * @param range
 * @param time
 * @returns {{duration: number, time: *, offset: number}}
 */
exports.correctTimeForHidden = function(hiddenDates, range, time) {
  time = moment(time).toDate().valueOf();
  time -= exports.getHiddenDurationBefore(hiddenDates,range,time);
  return time;
};

exports.getHiddenDurationBefore = function(hiddenDates, range, time) {
  var timeOffset = 0;
  time = moment(time).toDate().valueOf();

  for (var i = 0; i < hiddenDates.length; i++) {
    var startDate = hiddenDates[i].start;
    var endDate = hiddenDates[i].end;
    // if time after the cutout, and the
    if (startDate >= range.start && endDate < range.end) {
      if (time >= endDate) {
        timeOffset += (endDate - startDate);
      }
    }
  }
  return timeOffset;
}

/**
 * sum the duration from start to finish, including the hidden duration,
 * until the required amount has been reached, return the accumulated hidden duration
 * @param hiddenDates
 * @param range
 * @param time
 * @returns {{duration: number, time: *, offset: number}}
 */
exports.getAccumulatedHiddenDuration = function(hiddenDates, range, requiredDuration) {
  var hiddenDuration = 0;
  var duration = 0;
  var previousPoint = range.start;
  //exports.printDates(hiddenDates)
  for (var i = 0; i < hiddenDates.length; i++) {
    var startDate = hiddenDates[i].start;
    var endDate = hiddenDates[i].end;
    // if time after the cutout, and the
    if (startDate >= range.start && endDate < range.end) {
      duration += startDate - previousPoint;
      previousPoint = endDate;
      if (duration >= requiredDuration) {
        break;
      }
      else {
        hiddenDuration += endDate - startDate;
      }
    }
  }

  return hiddenDuration;
};



/**
 * used to step over to either side of a hidden block. Correction is disabled on tablets, might be set to true
 * @param hiddenDates
 * @param time
 * @param direction
 * @param correctionEnabled
 * @returns {*}
 */
exports.snapAwayFromHidden = function(hiddenDates, time, direction, correctionEnabled) {
  var isHidden = exports.isHidden(time, hiddenDates);
  if (isHidden.hidden == true) {
    if (direction < 0) {
      if (correctionEnabled == true) {
        return isHidden.startDate - (isHidden.endDate - time) - 1;
      }
      else {
        return isHidden.startDate - 1;
      }
    }
    else {
      if (correctionEnabled == true) {
        return isHidden.endDate + (time - isHidden.startDate) + 1;
      }
      else {
        return isHidden.endDate + 1;
      }
    }
  }
  else {
    return time;
  }

}


/**
 * Check if a time is hidden
 *
 * @param time
 * @param hiddenDates
 * @returns {{hidden: boolean, startDate: Window.start, endDate: *}}
 */
exports.isHidden = function(time, hiddenDates) {
  for (var i = 0; i < hiddenDates.length; i++) {
    var startDate = hiddenDates[i].start;
    var endDate = hiddenDates[i].end;

    if (time >= startDate && time < endDate) { // if the start is entering a hidden zone
      return {hidden: true, startDate: startDate, endDate: endDate};
      break;
    }
  }
  return {hidden: false, startDate: startDate, endDate: endDate};
}
},{"../module/moment":7}],11:[function(require,module,exports){
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

var map;
var markers = {};
var trips = {};
var bounds = new google.maps.LatLngBounds();
var icons = {};

    var selectedStyle = {
        strokeColor: '#fc6355',
        strokeWeight: 3
    }
        var unselectedStyle = {
        strokeColor: '#e0e0e0',
        strokeWeight: 2
    }


function Map() {

}

function initialize() {

    var mapProp = {
        center: new google.maps.LatLng(38.7902476,-9.2141835),
        zoom: 10,
        mapTypeId: google.maps.MapTypeId.ROADMAP
    };
    map = new google.maps.Map(document.getElementById("map"), mapProp);

var range = 0;
      document.addEventListener("rangeInfo", function(event) {
            range = event.detail.message;
            
        });

var iconBase = 'http://www.google.com/intl/en_us/mapfiles/ms/micons/';
icons = {
  selected: {
    icon: iconBase + 'red-dot.png'
  },
  unselected: {
    icon: iconBase + 'grey.png'
  }
};

document.addEventListener("showCoordinates", function(event) {

coords = event.detail.message;
res = coords.split(",");
var position = new google.maps.LatLng(res[0], res[1]);
map.panTo(position);

              var iconBase = 'http://maps.google.com/mapfiles/ms/icons/';
            var marker = new google.maps.Marker({
                position: position,
                map: map,
                icon: iconBase + 'red-dot.png'
            });

              setTimeout(function () {
        marker.setMap(null);
        delete marker;
    }, 4000);

});

google.maps.event.addListener(map, "click", function (event) {
    var latitude = event.latLng.lat();
    var longitude = event.latLng.lng();
    var coords = latitude + ', ' + longitude;

    var yourLocation = new google.maps.LatLng(latitude, longitude);

              var iconBase = 'http://maps.google.com/mapfiles/ms/icons/';
            var marker = new google.maps.Marker({
                position: yourLocation,
                map: map,
                icon: iconBase + 'red-dot.png'
            });

            var circle = new google.maps.Circle({
  map: map,
  radius: range,    // 10 miles in metres
  fillColor: '#AA0000'
});
circle.bindTo('center', marker, 'position');
            
              setTimeout(function () {
        marker.setMap(null);
        circle.setMap(null);
        delete marker;
        delete circle;
    }, 2000);

var event1 = new CustomEvent(
  "mapCoordinates", 
  {
    detail: {
      message: coords
    }
  }
);

document.dispatchEvent(event1);


}); //end addListener


  google.maps.event.trigger(map, 'resize')
};


function setAllMap(map) {

for(var key in markers) {
    if(markers.hasOwnProperty(key)) {
        //key                 = keys,  left of the ":"
        //driversCounter[key] = value, right of the ":"
        markers[key].setMap(map);
    }
}

}

function clearMarkers() {
  bounds = new google.maps.LatLngBounds();


    


  setAllMap(null);
}

// Shows any markers currently in the array.
function showMarkers() {
  setAllMap(map);
}


function addMarker(name, data){
    if( data.features[0].geometry.coordinates[1] != 0 && data.features[0].geometry.coordinates[0] != 0){
    var yourLocation = new google.maps.LatLng(data.features[0].geometry.coordinates[1], data.features[0].geometry.coordinates[0]);

            var marker = new google.maps.Marker({
                position: yourLocation,
                map: map,
                icon: icons["unselected"].icon
            });
            var iw = new google.maps.InfoWindow({
       content: name
     });
     google.maps.event.addListener(marker, "click", function (e) { iw.open(map, this); });

            markers[name] = marker;


  for(var key in markers) {
    if(markers.hasOwnProperty(key)) {
        bounds.extend(markers[key].getPosition());
    }
}
}

}

Map.prototype.resizeMap = function() {
google.maps.event.trigger(map, 'resize');
}

Map.prototype.highlightLocation = function(id) {

if(markers[id]){
for(var mKey in markers) {
      if(mKey === id){
        markers[mKey].icon = icons["selected"].icon;
      }
      else{
         markers[mKey].icon = icons["unselected"].icon;
      }
    

}

showMarkers();

map.setZoom(17);
map.panTo(markers[id].position);
}
}


Map.prototype.highlightRoute = function(id) {


     map.data.addGeoJson(trips[id]);

}

Map.prototype.clearAll = function(id) {
    clearMarkers();
    clearMap();
}

Map.prototype.globalMapView = function(data) {
    clearMarkers();
    clearMap();

  var locations = data["locations"];
  var trips = data["trips"];



for(var key in locations) {
    if(locations.hasOwnProperty(key) && locations[key] && locations[key].features !== null) {
        addMarker(key, locations[key]);
    }
}



var noTrips = false;
map.data.setStyle(selectedStyle);
for(var key in trips) {
    if(trips.hasOwnProperty(key) && trips[key] && trips[key].features !== null) {
        map.data.addGeoJson(trips[key]);
    }
    else{
      noTrips = true;
    }
}


  if(Object.keys(trips).length == 0 || noTrips){
  map.fitBounds(bounds);
  map.setCenter(bounds.getCenter());}
else{
  zoom(map);
}

}

Map.prototype.mapView = function(data) {
        for(var mKey in markers) {

        markers[mKey].icon = icons["unselected"].icon;
      }
      showMarkers();

trips={};
markers ={};
    clearMarkers();
    clearMap();

  var locations = data["locations"];
  var trips = data["trips"];


var noMarkers = false;
for(var key in locations) {
  console.log(locations)
    if(locations.hasOwnProperty(key) && locations[key] && locations[key].features[0].geometry.coordinates[0] != 0 && locations[key].features[0].geometry.coordinates[1] != 0 && locations[key].features[0].geometry.coordinates[2] != 0) {
      console.log("impossible1")
        addMarker(key, locations[key]);
    }
    else{
      noMarkers = true;
    }
}


for(var mKey in markers) {
    markers[mKey].icon = icons["unselected"].icon;
    for(var lKey in locations) {
      if(mKey === lKey){
        console.log("SELECTED " + mKey)
        markers[mKey].icon = icons["selected"].icon;
      }
    
}
}

var noTrips = false;
map.data.setStyle(selectedStyle);
for(var key in trips) {
    if(trips.hasOwnProperty(key) && trips[key] && trips[key].features !== null) {
            console.log("impossible2")

        map.data.addGeoJson(trips[key]);
    }
    else{
      noTrips = true;
    }
}

if(noMarkers && noTrips){
  return;
}
  if(Object.keys(markers).length > 0 || !noMarkers){

    console.log("KLOLL")
  map.fitBounds(bounds);
  map.setCenter(bounds.getCenter());

}
else if (Object.keys(trips).length > 0 || !noTrips){
  console.log("JLOL")
  zoom(map);
}

}

Map.prototype.highlightMapView = function(data) {
  var locations = data["locations"];
  var _trips = data["trips"];
console.log(markers)
console.log(locations)
for(var mKey in markers) {
    markers[mKey].icon = icons["unselected"].icon;
    for(var lKey in locations) {
      if(mKey === lKey){
        console.log("SELECTED " + mKey)
        markers[mKey].icon = icons["selected"].icon;
      }
    
}
}
  
showMarkers();



  if(Object.keys(trips).length == 0){
  map.fitBounds(bounds);
  map.setCenter(bounds.getCenter());}
else{
  zoom(map);
}

}


Map.prototype.loadJson = function(geoString) {
    clearMap();
    for (i = 0; i < geoString.length; i++) {

        if (geoString[i].features[0].geometry.type === "Point") {
              var iconBase = 'http://maps.google.com/mapfiles/ms/icons/';
            var marker = new google.maps.Marker({
                position: new google.maps.LatLng(geoString[i].features[0].geometry.coordinates[1], geoString[i].features[0].geometry.coordinates[0]),
                map: map,
                icon: iconBase + 'red-dot.png'
            });
            markers.push(marker);

        } else {
            var featureStyle = {
                strokeColor: '#494949',
                strokeWeight: 2
            }
            map.data.addGeoJson(geoString[i]);
            map.data.setStyle(featureStyle);

        }


    }

    zoom(map);
};



function clearMap() {
  bounds = new google.maps.LatLngBounds();
    map.data.forEach(function(feature) {
       map.data.remove(feature);
    });
}

function zoom(map) {
    bounds = new google.maps.LatLngBounds();
    map.data.forEach(function(feature) {
        processPoints(feature.getGeometry(), bounds.extend, bounds);
    });
    map.fitBounds(bounds);
};

function processPoints(geometry, callback, thisArg) {
    if (geometry instanceof google.maps.LatLng) {
        callback.call(thisArg, geometry);
    } else if (geometry instanceof google.maps.Data.Point) {
        callback.call(thisArg, geometry.get());
    } else {
        geometry.getArray().forEach(function(g) {
            processPoints(g, callback, thisArg);
        });
    }
}

google.maps.event.addDomListener(window, 'load', initialize);



module.exports = Map;
},{"../DataSet":2,"../DataView":3,"../module/hammer":6,"../util":31,"./Core":9,"./Range":12,"./Timeline":16,"./component/CurrentTime":19,"./component/CustomTime":20,"./component/ItemSet":22,"./component/TimeAxis":23,"emitter-component":32}],12:[function(require,module,exports){
var util = require('../util');
var hammerUtil = require('../hammerUtil');
var moment = require('../module/moment');
var Component = require('./component/Component');
var DateUtil = require('./DateUtil');
var Hammer = require('../module/hammer');

/**
 * @constructor Range
 * A Range controls a numeric range with a start and end value.
 * The Range adjusts the range based on mouse events or programmatic changes,
 * and triggers events when the range is changing or has been changed.
 * @param {{dom: Object, domProps: Object, emitter: Emitter}} body
 * @param {Object} [options]    See description at Range.setOptions
 */
function Range(body, options, timelineDom, results) {
    var now = moment().hours(0).minutes(0).seconds(0).milliseconds(0);
    this.start = now.clone().add(-3, 'days').valueOf(); // Number
    this.end = now.clone().add(4, 'days').valueOf(); // Number
    this.tap = false;
    this.body = body;
    this.deltaDifference = 0;
    this.scaleOffset = 0;
    this.startToFront = false;
    this.endToFront = true;
    this.timelineDom = timelineDom;
    this.results = results;


    this.locked = true;

    // default options
    this.defaultOptions = {
        start: null,
        end: null,
        direction: 'horizontal', // 'horizontal' or 'vertical'
        moveable: true,
        zoomable: true,
        min: null,
        max: null,
        zoomMin: 10, // milliseconds
        zoomMax: 1000 * 60 * 60 * 24 * 365 * 10000 // milliseconds
    };
    this.options = util.extend({}, this.defaultOptions);

    this.props = {
        touch: {}
    };
    this.animateTimer = null;

    // drag listeners for dragging
    this.body.emitter.on('dragstart', this._onDragStart.bind(this));
    this.body.emitter.on('drag', this._onDrag.bind(this));
    this.body.emitter.on('dragend', this._onDragEnd.bind(this));

    // ignore dragging when holding
    this.body.emitter.on('hold', this._onHold.bind(this));

    // mouse wheel for zooming
    this.body.emitter.on('mousewheel', this._onMouseWheel.bind(this));
    this.body.emitter.on('DOMMouseScroll', this._onMouseWheel.bind(this)); // For FF

    this.body.emitter.on('tap', this._onTap.bind(this)); // For FF

    // pinch to zoom
    this.body.emitter.on('touch', this._onTouch.bind(this));
    this.body.emitter.on('pinch', this._onPinch.bind(this));

    this.setOptions(options);

    if (this.options.results) {
        var lock = document.createElement('div');
        lock.className = 'range-lock';
        this.body.dom.leftContainer.appendChild(lock);




        var me = this;
        Hammer(lock, {
            preventDefault: true
        }).on('tap', function(event) {
          if(me.options.colapsed){
            me.locked = !me.locked;
            if (me.locked)
                lock.className = 'range-lock';

            else {
                lock.className = 'range-unlock';
            }
          }
            event.stopPropagation();
        });

    }

    var me = this;
    document.addEventListener("toggle", function(event) {


            me.tap = false;
                        
                     

});


}

Range.prototype = new Component();

/**
 * Set options for the range controller
 * @param {Object} options      Available options:
 *                              {Number | Date | String} start  Start date for the range
 *                              {Number | Date | String} end    End date for the range
 *                              {Number} min    Minimum value for start
 *                              {Number} max    Maximum value for end
 *                              {Number} zoomMin    Set a minimum value for
 *                                                  (end - start).
 *                              {Number} zoomMax    Set a maximum value for
 *                                                  (end - start).
 *                              {Boolean} moveable Enable moving of the range
 *                                                 by dragging. True by default
 *                              {Boolean} zoomable Enable zooming of the range
 *                                                 by pinching/scrolling. True by default
 */
Range.prototype.setOptions = function(options) {
    if (options) {
        // copy the options that we know
        var fields = ['moreResultsId', 'colapsed', 'groupBy', 'results', 'direction', 'min', 'max', 'zoomMin', 'zoomMax', 'moveable', 'zoomable', 'activate', 'hiddenDates'];
        util.selectiveExtend(fields, this.options, options);

        if ('start' in options || 'end' in options) {
            // apply a new range. both start and end are optional
            this.setRange(options.start, options.end);
        }
    }
};

/**
 * Test whether direction has a valid value
 * @param {String} direction    'horizontal' or 'vertical'
 */
function validateDirection(direction) {
    if (direction != 'horizontal' && direction != 'vertical') {
        throw new TypeError('Unknown direction "' + direction + '". ' +
            'Choose "horizontal" or "vertical".');
    }
}

/**
 * Set a new start and end range
 * @param {Date | Number | String} [start]
 * @param {Date | Number | String} [end]
 * @param {boolean | number} [animate=false]     If true, the range is animated
 *                                               smoothly to the new window.
 *                                               If animate is a number, the
 *                                               number is taken as duration
 *                                               Default duration is 500 ms.
 * @param {Boolean} [byUser=false]
 *
 */
Range.prototype.setRange = function(start, end, animate, byUser) {
    if (byUser !== true) {
        byUser = false;
    }
    var _start = start != undefined ? util.convert(start, 'Date').valueOf() : null;
    var _end = end != undefined ? util.convert(end, 'Date').valueOf() : null;
    this._cancelAnimation();

    if (animate) {
        var me = this;
        var initStart = this.start;
        var initEnd = this.end;
        var duration = typeof animate === 'number' ? animate : 500;
        var initTime = new Date().valueOf();
        var anyChanged = false;

        var next = function() {
            if (!me.props.touch.dragging) {
                var now = new Date().valueOf();
                var time = now - initTime;
                var done = time > duration;
                var s = (done || _start === null) ? _start : util.easeInOutQuad(time, initStart, _start, duration);
                var e = (done || _end === null) ? _end : util.easeInOutQuad(time, initEnd, _end, duration);

                changed = me._applyRange(s, e);
                DateUtil.updateHiddenDates(me.body, me.options.hiddenDates);
                anyChanged = anyChanged || changed;
                if (changed) {
                    me.body.emitter.emit('rangechange', {
                        start: new Date(me.start),
                        end: new Date(me.end),
                        byUser: byUser
                    });
                }

                if (done) {
                    if (anyChanged) {
                        me.body.emitter.emit('rangechanged', {
                            start: new Date(me.start),
                            end: new Date(me.end),
                            byUser: byUser
                        });
                    }
                } else {
                    // animate with as high as possible frame rate, leave 20 ms in between
                    // each to prevent the browser from blocking
                    me.animateTimer = setTimeout(next, 20);
                }
            }
        };

        return next();
    } else {
        var changed = this._applyRange(_start, _end);
        DateUtil.updateHiddenDates(this.body, this.options.hiddenDates);
        if (changed) {
            var params = {
                start: new Date(this.start),
                end: new Date(this.end),
                byUser: byUser
            };
            this.body.emitter.emit('rangechange', params);
            this.body.emitter.emit('rangechanged', params);
        }
    }
};

/**
 * Stop an animation
 * @private
 */
Range.prototype._cancelAnimation = function() {
    if (this.animateTimer) {
        clearTimeout(this.animateTimer);
        this.animateTimer = null;
    }
};

/**
 * Set a new start and end range. This method is the same as setRange, but
 * does not trigger a range change and range changed event, and it returns
 * true when the range is changed
 * @param {Number} [start]
 * @param {Number} [end]
 * @return {Boolean} changed
 * @private
 */
Range.prototype._applyRange = function(start, end) {
    var newStart = (start != null) ? util.convert(start, 'Date').valueOf() : this.start,
        newEnd = (end != null) ? util.convert(end, 'Date').valueOf() : this.end,
        max = (this.options.max != null) ? util.convert(this.options.max, 'Date').valueOf() : null,
        min = (this.options.min != null) ? util.convert(this.options.min, 'Date').valueOf() : null,
        diff;

    // check for valid number
    if (isNaN(newStart) || newStart === null) {
        throw new Error('Invalid start "' + start + '"');
    }
    if (isNaN(newEnd) || newEnd === null) {
        throw new Error('Invalid end "' + end + '"');
    }

    // prevent start < end
    if (newEnd < newStart) {
        newEnd = newStart;
    }

    // prevent start < min
    if (min !== null) {
        if (newStart < min) {
            diff = (min - newStart);
            newStart += diff;
            newEnd += diff;

            // prevent end > max
            if (max != null) {
                if (newEnd > max) {
                    newEnd = max;
                }
            }
        }
    }

    // prevent end > max
    if (max !== null) {
        if (newEnd > max) {
            diff = (newEnd - max);
            newStart -= diff;
            newEnd -= diff;

            // prevent start < min
            if (min != null) {
                if (newStart < min) {
                    newStart = min;
                }
            }
        }
    }

    // prevent (end-start) < zoomMin
    if (this.options.zoomMin !== null) {
        var zoomMin = parseFloat(this.options.zoomMin);
        if (zoomMin < 0) {
            zoomMin = 0;
        }
        if ((newEnd - newStart) < zoomMin) {
            if ((this.end - this.start) === zoomMin && newStart > this.start && newEnd < this.end) {
                // ignore this action, we are already zoomed to the minimum
                newStart = this.start;
                newEnd = this.end;
            } else {
                // zoom to the minimum
                diff = (zoomMin - (newEnd - newStart));
                newStart -= diff / 2;
                newEnd += diff / 2;
            }
        }
    }

    // prevent (end-start) > zoomMax
    if (this.options.zoomMax !== null) {
        var zoomMax = parseFloat(this.options.zoomMax);
        if (zoomMax < 0) {
            zoomMax = 0;
        }

        if ((newEnd - newStart) > zoomMax) {
            if ((this.end - this.start) === zoomMax && newStart < this.start && newEnd > this.end) {
                // ignore this action, we are already zoomed to the maximum
                newStart = this.start;
                newEnd = this.end;
            } else {
                // zoom to the maximum

                diff = ((newEnd - newStart) - zoomMax);
                newStart += diff / 2;
                newEnd -= diff / 2;
            }
        }
    }

    var changed = (this.start != newStart || this.end != newEnd);

    // if the new range does NOT overlap with the old range, emit checkRangedItems to avoid not showing ranged items (ranged meaning has end time, not necessarily of type Range)
    if (!((newStart >= this.start && newStart <= this.end) || (newEnd >= this.start && newEnd <= this.end)) &&
        !((this.start >= newStart && this.start <= newEnd) || (this.end >= newStart && this.end <= newEnd))) {
        this.body.emitter.emit('checkRangedItems');
    }

    this.start = newStart;
    this.end = newEnd;

    return changed;
};

/**
 * Retrieve the current range.
 * @return {Object} An object with start and end properties
 */
Range.prototype.getRange = function() {
    return {
        start: this.start,
        end: this.end
    };
};

/**
 * Calculate the conversion offset and scale for current range, based on
 * the provided width
 * @param {Number} width
 * @returns {{offset: number, scale: number}} conversion
 */
Range.prototype.conversion = function(width, totalHidden) {
    return Range.conversion(this.start, this.end, width, totalHidden);
};

/**
 * Static method to calculate the conversion offset and scale for a range,
 * based on the provided start, end, and width
 * @param {Number} start
 * @param {Number} end
 * @param {Number} width
 * @returns {{offset: number, scale: number}} conversion
 */
Range.conversion = function(start, end, width, totalHidden) {
    if (totalHidden === undefined) {
        totalHidden = 0;
    }
    if (width != 0 && (end - start != 0)) {
        return {
            offset: start,
            scale: width / (end - start - totalHidden)
        }
    } else {
        return {
            offset: 0,
            scale: 1
        };
    }
};

/**
 * Start dragging horizontally or vertically
 * @param {Event} event
 * @private
 */
Range.prototype._onDragStart = function(event) {

    this.deltaDifference = 0;
    this.previousDelta = 0;
    // only allow dragging when configured as movable
    if (!this.options.moveable) return;

    // refuse to drag when we where pinching to prevent the timeline make a jump
    // when releasing the fingers in opposite order from the touch screen
    if (!this.props.touch.allowDragging) return;

    this.props.touch.start = this.start;
    this.props.touch.end = this.end;
    this.props.touch.dragging = true;

    if (this.body.dom.root) {
        this.body.dom.root.style.cursor = 'move';
    }
};

Range.prototype._onTap = function(event) {


            this.tap = !this.tap;

   /* if (this.options.results) {
        this.tap = !this.tap;
        if (this.tap) {
            this.timelineDom.background.style.background = "#EEEEEE";
            this.

        } else {
            this.timelineDom.background.style.background = "white";
        }
    }*/
};

/**
 * Perform dragging operation
 * @param {Event} event
 * @private
 */
Range.prototype._onDrag = function(event) {
    // only allow dragging when configured as movable
    if (!this.options.moveable) return;
    // refuse to drag when we where pinching to prevent the timeline make a jump
    // when releasing the fingers in opposite order from the touch screen
    if (!this.props.touch.allowDragging) return;

    var direction = this.options.direction;
    validateDirection(direction);

    var delta = (direction == 'horizontal') ? event.gesture.deltaX : event.gesture.deltaY;
    delta -= this.deltaDifference;
    var interval = (this.props.touch.end - this.props.touch.start);

    // normalize dragging speed if cutout is in between.
    var duration = DateUtil.getHiddenDurationBetween(this.body.hiddenDates, this.start, this.end);
    interval -= duration;

    var width = (direction == 'horizontal') ? this.body.domProps.center.width : this.body.domProps.center.height;
    var diffRange = -delta / width * interval;
    var newStart = this.props.touch.start + diffRange;
    var newEnd = this.props.touch.end + diffRange;


    // snapping times away from hidden zones
    var safeStart = DateUtil.snapAwayFromHidden(this.body.hiddenDates, newStart, this.previousDelta - delta, true);
    var safeEnd = DateUtil.snapAwayFromHidden(this.body.hiddenDates, newEnd, this.previousDelta - delta, true);
    if (safeStart != newStart || safeEnd != newEnd) {
        this.deltaDifference += delta;
        this.props.touch.start = safeStart;
        this.props.touch.end = safeEnd;
        this._onDrag(event);
        return;
    }

    this.previousDelta = delta;

    if (this.options.results) {

        /*if () {
            this._applyRange(newStart, newEnd);
        }*/

        if (this.locked){
            console.log(this.options.groupBy + "  " + this.options.moreResultsId + "  " + this.itemSet.expanded)
        if(this.options.moreResultsId !== undefined && this.itemSet.expanded){
            this._applyRange(newStart, newEnd);
            this.results.dragEveryIdenticResult(this.options.moreResultsId, newStart, newEnd);
           }
           else if(this.options.groupBy !== undefined){
            this.results.dragEveryIdenticResult(this.options.groupBy, newStart, newEnd);
           }
           
              else{
                this.results.dragAllResults(newStart, newEnd);
             }
              
        }
        else {
            this._applyRange(newStart, newEnd);
        }
    } else {
        this._applyRange(newStart, newEnd);

    }

    // fire a rangechange event
    this.body.emitter.emit('rangechange', {
        start: new Date(this.start),
        end: new Date(this.end),
        byUser: true
    });
};

/**
 * Stop dragging operation
 * @param {event} event
 * @private
 */
Range.prototype._onDragEnd = function(event) {
    // only allow dragging when configured as movable
    if (!this.options.moveable) return;

    // refuse to drag when we where pinching to prevent the timeline make a jump
    // when releasing the fingers in opposite order from the touch screen
    if (!this.props.touch.allowDragging) return;

    this.props.touch.dragging = false;
    if (this.body.dom.root) {
        this.body.dom.root.style.cursor = 'auto';
    }

    // fire a rangechanged event
    this.body.emitter.emit('rangechanged', {
        start: new Date(this.start),
        end: new Date(this.end),
        byUser: true
    });
};

/**
 * Event handler for mouse wheel event, used to zoom
 * Code from http://adomas.org/javascript-mouse-wheel/
 * @param {Event} event
 * @private
 */
Range.prototype._onMouseWheel = function(event) {
    // only allow zooming when configured as zoomable and moveable
    if (this.options.results && !this.tap) {
        return;
    }
    if (!(this.options.zoomable && this.options.moveable)) return;



    // retrieve delta
    var delta = 0;
    if (event.wheelDelta) { /* IE/Opera. */
        delta = event.wheelDelta / 120;
    } else if (event.detail) { /* Mozilla case. */
        // In Mozilla, sign of delta is different than in IE.
        // Also, delta is multiple of 3.
        delta = -event.detail / 3;
    }

    // If delta is nonzero, handle it.
    // Basically, delta is now positive if wheel was scrolled up,
    // and negative, if wheel was scrolled down.
    if (delta) {
        // perform the zoom action. Delta is normally 1 or -1

        // adjust a negative delta such that zooming in with delta 0.1
        // equals zooming out with a delta -0.1
        var scale;
        if (delta < 0) {
            scale = 1 - (delta / 5);
        } else {
            scale = 1 / (1 + (delta / 5));
        }


     if(this.itemSet && !this.options.results){
            if(this.itemSet.itemsData.getDataSet().length >= 3){
            for (var id in this.itemSet.items) {
                    if (this.itemSet.items.hasOwnProperty(id)) {
                        var _item = this.itemSet.items[id];
                        if(_item.data.type === 'interval'){
                            if(parseInt(_item.dom.box.style.width) < 180 && delta < 0){
                                event.preventDefault();
                                return;
                            }
                        }
                    }
                }
            }
        }

        // calculate center, the date to zoom around
        var gesture = hammerUtil.fakeGesture(this, event),
            pointer = getPointer(gesture.center, this.body.dom.center),
            pointerDate = this._pointerToDate(pointer);

       
        //TODO
        //console.log("group by "+this.options)
        if (this.options.results) {

            /*if (!this.options.colapsed) {
                this.zoom(scale, pointerDate, delta);
            }*/

            if (this.locked){
                 if(this.options.moreResultsId !== undefined && this.itemSet.expanded){
                    this.zoom(scale, pointerDate, delta);
                this.results.zoomEveryIdenticResult(this.options.moreResultsId, scale, pointerDate, delta);
              }
              else if(this.options.groupBy !== undefined){
                 this.results.zoomEveryIdenticResult(this.options.groupBy, scale, pointerDate, delta);
             
              }else{
              
                this.results.zoomAllResults(scale, pointerDate, delta);
            }
            

              }
            else {
                this.zoom(scale, pointerDate, delta);

            }
        } else {
            this.zoom(scale, pointerDate, delta);

        }
    }



    // Prevent default actions caused by mouse wheel
    // (else the page and timeline both zoom and scroll)
    event.preventDefault();
};

/**
 * Start of a touch gesture
 * @private
 */
Range.prototype._onTouch = function(event) {
    this.props.touch.start = this.start;
    this.props.touch.end = this.end;
    this.props.touch.allowDragging = true;
    this.props.touch.center = null;
    this.scaleOffset = 0;
    this.deltaDifference = 0;
};

/**
 * On start of a hold gesture
 * @private
 */
Range.prototype._onHold = function() {
    this.props.touch.allowDragging = false;
};

/**
 * Handle pinch event
 * @param {Event} event
 * @private
 */
Range.prototype._onPinch = function(event) {
    // only allow zooming when configured as zoomable and moveable
    if (!(this.options.zoomable && this.options.moveable)) return;

    this.props.touch.allowDragging = false;

    if (event.gesture.touches.length > 1) {
        if (!this.props.touch.center) {
            this.props.touch.center = getPointer(event.gesture.center, this.body.dom.center);
        }

        var scale = 1 / (event.gesture.scale + this.scaleOffset);
        var centerDate = this._pointerToDate(this.props.touch.center);

        var hiddenDuration = DateUtil.getHiddenDurationBetween(this.body.hiddenDates, this.start, this.end);
        var hiddenDurationBefore = DateUtil.getHiddenDurationBefore(this.body.hiddenDates, this, centerDate);
        var hiddenDurationAfter = hiddenDuration - hiddenDurationBefore;

        // calculate new start and end
        var newStart = (centerDate - hiddenDurationBefore) + (this.props.touch.start - (centerDate - hiddenDurationBefore)) * scale;
        var newEnd = (centerDate + hiddenDurationAfter) + (this.props.touch.end - (centerDate + hiddenDurationAfter)) * scale;

        // snapping times away from hidden zones
        this.startToFront = 1 - scale > 0 ? false : true; // used to do the right autocorrection with periodic hidden times
        this.endToFront = scale - 1 > 0 ? false : true; // used to do the right autocorrection with periodic hidden times

        var safeStart = DateUtil.snapAwayFromHidden(this.body.hiddenDates, newStart, 1 - scale, true);
        var safeEnd = DateUtil.snapAwayFromHidden(this.body.hiddenDates, newEnd, scale - 1, true);
        if (safeStart != newStart || safeEnd != newEnd) {
            this.props.touch.start = safeStart;
            this.props.touch.end = safeEnd;
            this.scaleOffset = 1 - event.gesture.scale;
            newStart = safeStart;
            newEnd = safeEnd;
        }

        this.setRange(newStart, newEnd, false, true);

        this.startToFront = false; // revert to default
        this.endToFront = true; // revert to default
    }
};

/**
 * Helper function to calculate the center date for zooming
 * @param {{x: Number, y: Number}} pointer
 * @return {number} date
 * @private
 */
Range.prototype._pointerToDate = function(pointer) {
    var conversion;
    var direction = this.options.direction;

    validateDirection(direction);

    if (direction == 'horizontal') {
        return this.body.util.toTime(pointer.x).valueOf();
    } else {
        var height = this.body.domProps.center.height;
        conversion = this.conversion(height);
        return pointer.y / conversion.scale + conversion.offset;
    }
};

/**
 * Get the pointer location relative to the location of the dom element
 * @param {{pageX: Number, pageY: Number}} touch
 * @param {Element} element   HTML DOM element
 * @return {{x: Number, y: Number}} pointer
 * @private
 */
function getPointer(touch, element) {
    return {
        x: touch.pageX - util.getAbsoluteLeft(element),
        y: touch.pageY - util.getAbsoluteTop(element)
    };
}

/**
 * Zoom the range the given scale in or out. Start and end date will
 * be adjusted, and the timeline will be redrawn. You can optionally give a
 * date around which to zoom.
 * For example, try scale = 0.9 or 1.1
 * @param {Number} scale      Scaling factor. Values above 1 will zoom out,
 *                            values below 1 will zoom in.
 * @param {Number} [center]   Value representing a date around which will
 *                            be zoomed.
 */
Range.prototype.zoom = function(scale, center, delta) {
    // if centerDate is not provided, take it half between start Date and end Date
    if (center == null) {
        center = (this.start + this.end) / 2;
    }

    var hiddenDuration = DateUtil.getHiddenDurationBetween(this.body.hiddenDates, this.start, this.end);
    var hiddenDurationBefore = DateUtil.getHiddenDurationBefore(this.body.hiddenDates, this, center);
    var hiddenDurationAfter = hiddenDuration - hiddenDurationBefore;

    // calculate new start and end
    var newStart = (center - hiddenDurationBefore) + (this.start - (center - hiddenDurationBefore)) * scale;
    var newEnd = (center + hiddenDurationAfter) + (this.end - (center + hiddenDurationAfter)) * scale;

    // snapping times away from hidden zones
    this.startToFront = delta > 0 ? false : true; // used to do the right autocorrection with periodic hidden times
    this.endToFront = -delta > 0 ? false : true; // used to do the right autocorrection with periodic hidden times
    var safeStart = DateUtil.snapAwayFromHidden(this.body.hiddenDates, newStart, delta, true);
    var safeEnd = DateUtil.snapAwayFromHidden(this.body.hiddenDates, newEnd, -delta, true);
    if (safeStart != newStart || safeEnd != newEnd) {
        newStart = safeStart;
        newEnd = safeEnd;
    }

    this.setRange(newStart, newEnd, false, true);

    this.startToFront = false; // revert to default
    this.endToFront = true; // revert to default
};



/**
 * Move the range with a given delta to the left or right. Start and end
 * value will be adjusted. For example, try delta = 0.1 or -0.1
 * @param {Number}  delta     Moving amount. Positive value will move right,
 *                            negative value will move left
 */
Range.prototype.move = function(delta) {
    // zoom start Date and end Date relative to the centerDate
    var diff = (this.end - this.start);

    // apply new values
    var newStart = this.start + diff * delta;
    var newEnd = this.end + diff * delta;

    // TODO: reckon with min and max range

    this.start = newStart;
    this.end = newEnd;
};

/**
 * Move the range to a new center point
 * @param {Number} moveTo      New center point of the range
 */
Range.prototype.moveTo = function(moveTo) {
    var center = (this.start + this.end) / 2;

    var diff = center - moveTo;

    // calculate new start and end
    var newStart = this.start - diff;
    var newEnd = this.end - diff;

    this.setRange(newStart, newEnd);
};

module.exports = Range;
},{"../hammerUtil":5,"../module/hammer":6,"../module/moment":7,"../util":31,"./DateUtil":10,"./component/Component":18}],13:[function(require,module,exports){
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
},{"../DataSet":2,"../DataView":3,"../module/hammer":6,"../util":31,"./Core":9,"./Map":11,"./Range":12,"./Timeline":16,"./component/CurrentTime":19,"./component/CustomTime":20,"./component/ItemSet":22,"./component/TimeAxis":23,"emitter-component":32}],14:[function(require,module,exports){
// Utility functions for ordering and stacking of items
var EPSILON = 0.001; // used when checking collisions, to prevent round-off errors

/**
 * Order items by their start data
 * @param {Item[]} items
 */
exports.orderByStart = function(items) {
  items.sort(function (a, b) {
    return a.data.start - b.data.start;
  });
};

/**
 * Order items by their end date. If they have no end date, their start date
 * is used.
 * @param {Item[]} items
 */
exports.orderByEnd = function(items) {
  items.sort(function (a, b) {
    var aTime = ('end' in a.data) ? a.data.end : a.data.start,
        bTime = ('end' in b.data) ? b.data.end : b.data.start;

    return aTime - bTime;
  });
};

/**
 * Adjust vertical positions of the items such that they don't overlap each
 * other.
 * @param {Item[]} items
 *            All visible items
 * @param {{item: {horizontal: number, vertical: number}, axis: number}} margin
 *            Margins between items and between items and the axis.
 * @param {boolean} [force=false]
 *            If true, all items will be repositioned. If false (default), only
 *            items having a top===null will be re-stacked
 */
exports.stack = function(items, margin, force) {
  var i, iMax;

  if (force) {
    // reset top position of all items
    for (i = 0, iMax = items.length; i < iMax; i++) {
      items[i].top = null;
    }
  }

  // calculate new, non-overlapping positions
  for (i = 0, iMax = items.length; i < iMax; i++) {
    var item = items[i];
    if (item.stack && item.top === null) {
      // initialize top position
      item.top = margin.axis;

      do {
        // TODO: optimize checking for overlap. when there is a gap without items,
        //       you only need to check for items from the next item on, not from zero
        var collidingItem = null;
        for (var j = 0, jj = items.length; j < jj; j++) {
          var other = items[j];
          if (other.top !== null && other !== item && other.stack && exports.collision(item, other, margin.item)) {
            collidingItem = other;
            break;
          }
        }

        if (collidingItem != null) {
          // There is a collision. Reposition the items above the colliding element
          item.top = collidingItem.top + collidingItem.height + margin.item.vertical;
        }
      } while (collidingItem);
    }
  }
};


/**
 * Adjust vertical positions of the items without stacking them
 * @param {Item[]} items
 *            All visible items
 * @param {{item: {horizontal: number, vertical: number}, axis: number}} margin
 *            Margins between items and between items and the axis.
 */
exports.nostack = function(items, margin, subgroups) {
  var i, iMax, newTop;

  // reset top position of all items
  for (i = 0, iMax = items.length; i < iMax; i++) {
    if (items[i].data.subgroup !== undefined) {
      newTop = margin.axis;
      for (var subgroup in subgroups) {
        if (subgroups.hasOwnProperty(subgroup)) {
          if (subgroups[subgroup].visible == true && subgroups[subgroup].index < subgroups[items[i].data.subgroup].index) {
            newTop += subgroups[subgroup].height + margin.item.vertical;
          }
        }
      }
      items[i].top = newTop;
    }
    else {
      items[i].top = margin.axis;
    }
  }
};

/**
 * Test if the two provided items collide
 * The items must have parameters left, width, top, and height.
 * @param {Item} a          The first item
 * @param {Item} b          The second item
 * @param {{horizontal: number, vertical: number}} margin
 *                          An object containing a horizontal and vertical
 *                          minimum required margin.
 * @return {boolean}        true if a and b collide, else false
 */
exports.collision = function(a, b, margin) {
  return ((a.left - margin.horizontal + EPSILON)       < (b.left + b.width) &&
      (a.left + a.width + margin.horizontal - EPSILON) > b.left &&
      (a.top - margin.vertical + EPSILON)              < (b.top + b.height) &&
      (a.top + a.height + margin.vertical - EPSILON)   > b.top);
};

},{}],15:[function(require,module,exports){
var moment = require('../module/moment');
var DateUtil = require('./DateUtil');
var util = require('../util');

/**
 * @constructor  TimeStep
 * The class TimeStep is an iterator for dates. You provide a start date and an
 * end date. The class itself determines the best scale (step size) based on the
 * provided start Date, end Date, and minimumStep.
 *
 * If minimumStep is provided, the step size is chosen as close as possible
 * to the minimumStep but larger than minimumStep. If minimumStep is not
 * provided, the scale is set to 1 DAY.
 * The minimumStep should correspond with the onscreen size of about 6 characters
 *
 * Alternatively, you can set a scale by hand.
 * After creation, you can initialize the class by executing first(). Then you
 * can iterate from the start date to the end date via next(). You can check if
 * the end date is reached with the function hasNext(). After each step, you can
 * retrieve the current date via getCurrent().
 * The TimeStep has scales ranging from milliseconds, seconds, minutes, hours,
 * days, to years.
 *
 * Version: 1.2
 *
 * @param {Date} [start]         The start date, for example new Date(2010, 9, 21)
 *                               or new Date(2010, 9, 21, 23, 45, 00)
 * @param {Date} [end]           The end date
 * @param {Number} [minimumStep] Optional. Minimum step size in milliseconds
 */
function TimeStep(start, end, minimumStep, hiddenDates) {
  // variables
  this.current = new Date();
  this._start = new Date();
  this._end = new Date();

  this.autoScale  = true;
  this.scale = 'day';
  this.step = 1;

  // initialize the range
  this.setRange(start, end, minimumStep);

  // hidden Dates options
  this.switchedDay = false;
  this.switchedMonth = false;
  this.switchedYear = false;
  this.hiddenDates = hiddenDates;
  if (hiddenDates === undefined) {
    this.hiddenDates = [];
  }

  this.format = TimeStep.FORMAT; // default formatting
}

// Time formatting
TimeStep.FORMAT = {
  minorLabels: {
    millisecond:'SSS',
    second:     's',
    minute:     'HH:mm',
    hour:       'HH:mm',
    weekday:    'ddd D',
    day:        'D',
    month:      'MMM',
    year:       'YYYY'
  },
  majorLabels: {
    millisecond:'HH:mm:ss',
    second:     'D MMMM HH:mm',
    minute:     'ddd D MMMM',
    hour:       'ddd D MMMM',
    weekday:    'MMMM YYYY',
    day:        'MMMM YYYY',
    month:      'YYYY',
    year:       ''
  }
};

/**
 * Set custom formatting for the minor an major labels of the TimeStep.
 * Both `minorLabels` and `majorLabels` are an Object with properties:
 * 'millisecond, 'second, 'minute', 'hour', 'weekday, 'day, 'month, 'year'.
 * @param {{minorLabels: Object, majorLabels: Object}} format
 */
TimeStep.prototype.setFormat = function (format) {
  var defaultFormat = util.deepExtend({}, TimeStep.FORMAT);
  this.format = util.deepExtend(defaultFormat, format);
};

/**
 * Set a new range
 * If minimumStep is provided, the step size is chosen as close as possible
 * to the minimumStep but larger than minimumStep. If minimumStep is not
 * provided, the scale is set to 1 DAY.
 * The minimumStep should correspond with the onscreen size of about 6 characters
 * @param {Date} [start]      The start date and time.
 * @param {Date} [end]        The end date and time.
 * @param {int} [minimumStep] Optional. Minimum step size in milliseconds
 */
TimeStep.prototype.setRange = function(start, end, minimumStep) {
  if (!(start instanceof Date) || !(end instanceof Date)) {
    throw  "No legal start or end date in method setRange";
  }

  this._start = (start != undefined) ? new Date(start.valueOf()) : new Date();
  this._end = (end != undefined) ? new Date(end.valueOf()) : new Date();

  if (this.autoScale) {
    this.setMinimumStep(minimumStep);
  }
};

/**
 * Set the range iterator to the start date.
 */
TimeStep.prototype.first = function() {
  this.current = new Date(this._start.valueOf());
  this.roundToMinor();
};

/**
 * Round the current date to the first minor date value
 * This must be executed once when the current date is set to start Date
 */
TimeStep.prototype.roundToMinor = function() {
  // round to floor
  // IMPORTANT: we have no breaks in this switch! (this is no bug)
  // noinspection FallThroughInSwitchStatementJS
  switch (this.scale) {
    case 'year':
      this.current.setFullYear(this.step * Math.floor(this.current.getFullYear() / this.step));
      this.current.setMonth(0);
    case 'month':        this.current.setDate(1);
    case 'day':          // intentional fall through
    case 'weekday':      this.current.setHours(0);
    case 'hour':         this.current.setMinutes(0);
    case 'minute':       this.current.setSeconds(0);
    case 'second':       this.current.setMilliseconds(0);
    //case 'millisecond': // nothing to do for milliseconds
  }

  if (this.step != 1) {
    // round down to the first minor value that is a multiple of the current step size
    switch (this.scale) {
      case 'millisecond':  this.current.setMilliseconds(this.current.getMilliseconds() - this.current.getMilliseconds() % this.step);  break;
      case 'second':       this.current.setSeconds(this.current.getSeconds() - this.current.getSeconds() % this.step); break;
      case 'minute':       this.current.setMinutes(this.current.getMinutes() - this.current.getMinutes() % this.step); break;
      case 'hour':         this.current.setHours(this.current.getHours() - this.current.getHours() % this.step); break;
      case 'weekday':      // intentional fall through
      case 'day':          this.current.setDate((this.current.getDate()-1) - (this.current.getDate()-1) % this.step + 1); break;
      case 'month':        this.current.setMonth(this.current.getMonth() - this.current.getMonth() % this.step);  break;
      case 'year':         this.current.setFullYear(this.current.getFullYear() - this.current.getFullYear() % this.step); break;
      default: break;
    }
  }
};

/**
 * Check if the there is a next step
 * @return {boolean}  true if the current date has not passed the end date
 */
TimeStep.prototype.hasNext = function () {
  return (this.current.valueOf() <= this._end.valueOf());
};

/**
 * Do the next step
 */
TimeStep.prototype.next = function() {
  var prev = this.current.valueOf();

  // Two cases, needed to prevent issues with switching daylight savings
  // (end of March and end of October)
  if (this.current.getMonth() < 6)   {
    switch (this.scale) {
      case 'millisecond':

        this.current = new Date(this.current.valueOf() + this.step); break;
      case 'second':       this.current = new Date(this.current.valueOf() + this.step * 1000); break;
      case 'minute':       this.current = new Date(this.current.valueOf() + this.step * 1000 * 60); break;
      case 'hour':
        this.current = new Date(this.current.valueOf() + this.step * 1000 * 60 * 60);
        // in case of skipping an hour for daylight savings, adjust the hour again (else you get: 0h 5h 9h ... instead of 0h 4h 8h ...)
        var h = this.current.getHours();
        this.current.setHours(h - (h % this.step));
        break;
      case 'weekday':      // intentional fall through
      case 'day':          this.current.setDate(this.current.getDate() + this.step); break;
      case 'month':        this.current.setMonth(this.current.getMonth() + this.step); break;
      case 'year':         this.current.setFullYear(this.current.getFullYear() + this.step); break;
      default:                      break;
    }
  }
  else {
    switch (this.scale) {
      case 'millisecond':  this.current = new Date(this.current.valueOf() + this.step); break;
      case 'second':       this.current.setSeconds(this.current.getSeconds() + this.step); break;
      case 'minute':       this.current.setMinutes(this.current.getMinutes() + this.step); break;
      case 'hour':         this.current.setHours(this.current.getHours() + this.step); break;
      case 'weekday':      // intentional fall through
      case 'day':          this.current.setDate(this.current.getDate() + this.step); break;
      case 'month':        this.current.setMonth(this.current.getMonth() + this.step); break;
      case 'year':         this.current.setFullYear(this.current.getFullYear() + this.step); break;
      default:                      break;
    }
  }

  if (this.step != 1) {
    // round down to the correct major value
    switch (this.scale) {
      case 'millisecond':  if(this.current.getMilliseconds() < this.step) this.current.setMilliseconds(0);  break;
      case 'second':       if(this.current.getSeconds() < this.step) this.current.setSeconds(0);  break;
      case 'minute':       if(this.current.getMinutes() < this.step) this.current.setMinutes(0);  break;
      case 'hour':         if(this.current.getHours() < this.step) this.current.setHours(0);  break;
      case 'weekday':      // intentional fall through
      case 'day':          if(this.current.getDate() < this.step+1) this.current.setDate(1); break;
      case 'month':        if(this.current.getMonth() < this.step) this.current.setMonth(0);  break;
      case 'year':         break; // nothing to do for year
      default:                break;
    }
  }

  // safety mechanism: if current time is still unchanged, move to the end
  if (this.current.valueOf() == prev) {
    this.current = new Date(this._end.valueOf());
  }

  DateUtil.stepOverHiddenDates(this, prev);
};


/**
 * Get the current datetime
 * @return {Date}  current The current date
 */
TimeStep.prototype.getCurrent = function() {
  return this.current;
};

/**
 * Set a custom scale. Autoscaling will be disabled.
 * For example setScale('minute', 5) will result
 * in minor steps of 5 minutes, and major steps of an hour.
 *
 * @param {{scale: string, step: number}} params
 *                               An object containing two properties:
 *                               - A string 'scale'. Choose from 'millisecond', 'second',
 *                                 'minute', 'hour', 'weekday, 'day, 'month, 'year'.
 *                               - A number 'step'. A step size, by default 1.
 *                                 Choose for example 1, 2, 5, or 10.
 */
TimeStep.prototype.setScale = function(params) {
  if (params && typeof params.scale == 'string') {
    this.scale = params.scale;
    this.step = params.step > 0 ? params.step : 1;
    this.autoScale = false;
  }
};

/**
 * Enable or disable autoscaling
 * @param {boolean} enable  If true, autoascaling is set true
 */
TimeStep.prototype.setAutoScale = function (enable) {
  this.autoScale = enable;
};


/**
 * Automatically determine the scale that bests fits the provided minimum step
 * @param {Number} [minimumStep]  The minimum step size in milliseconds
 */
TimeStep.prototype.setMinimumStep = function(minimumStep) {
  if (minimumStep == undefined) {
    return;
  }

  //var b = asc + ds;

  var stepYear       = (1000 * 60 * 60 * 24 * 30 * 12);
  var stepMonth      = (1000 * 60 * 60 * 24 * 30);
  var stepDay        = (1000 * 60 * 60 * 24);
  var stepHour       = (1000 * 60 * 60);
  var stepMinute     = (1000 * 60);
  var stepSecond     = (1000);
  var stepMillisecond= (1);

  // find the smallest step that is larger than the provided minimumStep
  if (stepYear*1000 > minimumStep)        {this.scale = 'year';        this.step = 1000;}
  if (stepYear*500 > minimumStep)         {this.scale = 'year';        this.step = 500;}
  if (stepYear*100 > minimumStep)         {this.scale = 'year';        this.step = 100;}
  if (stepYear*50 > minimumStep)          {this.scale = 'year';        this.step = 50;}
  if (stepYear*10 > minimumStep)          {this.scale = 'year';        this.step = 10;}
  if (stepYear*5 > minimumStep)           {this.scale = 'year';        this.step = 5;}
  if (stepYear > minimumStep)             {this.scale = 'year';        this.step = 1;}
  if (stepMonth*3 > minimumStep)          {this.scale = 'month';       this.step = 3;}
  if (stepMonth > minimumStep)            {this.scale = 'month';       this.step = 1;}
  if (stepDay*5 > minimumStep)            {this.scale = 'day';         this.step = 5;}
  if (stepDay*2 > minimumStep)            {this.scale = 'day';         this.step = 2;}
  if (stepDay > minimumStep)              {this.scale = 'day';         this.step = 1;}
  if (stepDay/2 > minimumStep)            {this.scale = 'weekday';     this.step = 1;}
  if (stepHour*4 > minimumStep)           {this.scale = 'hour';        this.step = 4;}
  if (stepHour > minimumStep)             {this.scale = 'hour';        this.step = 1;}
  if (stepMinute*15 > minimumStep)        {this.scale = 'minute';      this.step = 15;}
  if (stepMinute*10 > minimumStep)        {this.scale = 'minute';      this.step = 10;}
  if (stepMinute*5 > minimumStep)         {this.scale = 'minute';      this.step = 5;}
  if (stepMinute > minimumStep)           {this.scale = 'minute';      this.step = 1;}
  if (stepSecond*15 > minimumStep)        {this.scale = 'second';      this.step = 15;}
  if (stepSecond*10 > minimumStep)        {this.scale = 'second';      this.step = 10;}
  if (stepSecond*5 > minimumStep)         {this.scale = 'second';      this.step = 5;}
  if (stepSecond > minimumStep)           {this.scale = 'second';      this.step = 1;}
  if (stepMillisecond*200 > minimumStep)  {this.scale = 'millisecond'; this.step = 200;}
  if (stepMillisecond*100 > minimumStep)  {this.scale = 'millisecond'; this.step = 100;}
  if (stepMillisecond*50 > minimumStep)   {this.scale = 'millisecond'; this.step = 50;}
  if (stepMillisecond*10 > minimumStep)   {this.scale = 'millisecond'; this.step = 10;}
  if (stepMillisecond*5 > minimumStep)    {this.scale = 'millisecond'; this.step = 5;}
  if (stepMillisecond > minimumStep)      {this.scale = 'millisecond'; this.step = 1;}
};

/**
 * Snap a date to a rounded value.
 * The snap intervals are dependent on the current scale and step.
 * Static function
 * @param {Date} date    the date to be snapped.
 * @param {string} scale Current scale, can be 'millisecond', 'second',
 *                       'minute', 'hour', 'weekday, 'day, 'month, 'year'.
 * @param {number} step  Current step (1, 2, 4, 5, ...
 * @return {Date} snappedDate
 */
TimeStep.snap = function(date, scale, step) {
  var clone = new Date(date.valueOf());

  if (scale == 'year') {
    var year = clone.getFullYear() + Math.round(clone.getMonth() / 12);
    clone.setFullYear(Math.round(year / step) * step);
    clone.setMonth(0);
    clone.setDate(0);
    clone.setHours(0);
    clone.setMinutes(0);
    clone.setSeconds(0);
    clone.setMilliseconds(0);
  }
  else if (scale == 'month') {
    if (clone.getDate() > 15) {
      clone.setDate(1);
      clone.setMonth(clone.getMonth() + 1);
      // important: first set Date to 1, after that change the month.
    }
    else {
      clone.setDate(1);
    }

    clone.setHours(0);
    clone.setMinutes(0);
    clone.setSeconds(0);
    clone.setMilliseconds(0);
  }
  else if (scale == 'day') {
    //noinspection FallthroughInSwitchStatementJS
    switch (step) {
      case 5:
      case 2:
        clone.setHours(Math.round(clone.getHours() / 24) * 24); break;
      default:
        clone.setHours(Math.round(clone.getHours() / 12) * 12); break;
    }
    clone.setMinutes(0);
    clone.setSeconds(0);
    clone.setMilliseconds(0);
  }
  else if (scale == 'weekday') {
    //noinspection FallthroughInSwitchStatementJS
    switch (step) {
      case 5:
      case 2:
        clone.setHours(Math.round(clone.getHours() / 12) * 12); break;
      default:
        clone.setHours(Math.round(clone.getHours() / 6) * 6); break;
    }
    clone.setMinutes(0);
    clone.setSeconds(0);
    clone.setMilliseconds(0);
  }
  else if (scale == 'hour') {
    switch (step) {
      case 4:
        clone.setMinutes(Math.round(clone.getMinutes() / 60) * 60); break;
      default:
        clone.setMinutes(Math.round(clone.getMinutes() / 30) * 30); break;
    }
    clone.setSeconds(0);
    clone.setMilliseconds(0);
  } else if (scale == 'minute') {
    //noinspection FallthroughInSwitchStatementJS
    switch (step) {
      case 15:
      case 10:
        clone.setMinutes(Math.round(clone.getMinutes() / 5) * 5);
        clone.setSeconds(0);
        break;
      case 5:
        clone.setSeconds(Math.round(clone.getSeconds() / 60) * 60); break;
      default:
        clone.setSeconds(Math.round(clone.getSeconds() / 30) * 30); break;
    }
    clone.setMilliseconds(0);
  }
  else if (scale == 'second') {
    //noinspection FallthroughInSwitchStatementJS
    switch (step) {
      case 15:
      case 10:
        clone.setSeconds(Math.round(clone.getSeconds() / 5) * 5);
        clone.setMilliseconds(0);
        break;
      case 5:
        clone.setMilliseconds(Math.round(clone.getMilliseconds() / 1000) * 1000); break;
      default:
        clone.setMilliseconds(Math.round(clone.getMilliseconds() / 500) * 500); break;
    }
  }
  else if (scale == 'millisecond') {
    var _step = step > 5 ? step / 2 : 1;
    clone.setMilliseconds(Math.round(clone.getMilliseconds() / _step) * _step);
  }
  
  return clone;
};

/**
 * Check if the current value is a major value (for example when the step
 * is DAY, a major value is each first day of the MONTH)
 * @return {boolean} true if current date is major, else false.
 */
TimeStep.prototype.isMajor = function() {
  if (this.switchedYear == true) {
    this.switchedYear = false;
    switch (this.scale) {
      case 'year':
      case 'month':
      case 'weekday':
      case 'day':
      case 'hour':
      case 'minute':
      case 'second':
      case 'millisecond':
        return true;
      default:
        return false;
    }
  }
  else if (this.switchedMonth == true) {
    this.switchedMonth = false;
    switch (this.scale) {
      case 'weekday':
      case 'day':
      case 'hour':
      case 'minute':
      case 'second':
      case 'millisecond':
        return true;
      default:
        return false;
    }
  }
  else if (this.switchedDay == true) {
    this.switchedDay = false;
    switch (this.scale) {
      case 'millisecond':
      case 'second':
      case 'minute':
      case 'hour':
        return true;
      default:
        return false;
    }
  }

  switch (this.scale) {
    case 'millisecond':
      return (this.current.getMilliseconds() == 0);
    case 'second':
      return (this.current.getSeconds() == 0);
    case 'minute':
      return (this.current.getHours() == 0) && (this.current.getMinutes() == 0);
    case 'hour':
      return (this.current.getHours() == 0);
    case 'weekday': // intentional fall through
    case 'day':
      return (this.current.getDate() == 1);
    case 'month':
      return (this.current.getMonth() == 0);
    case 'year':
      return false;
    default:
      return false;
  }
};


/**
 * Returns formatted text for the minor axislabel, depending on the current
 * date and the scale. For example when scale is MINUTE, the current time is
 * formatted as "hh:mm".
 * @param {Date} [date] custom date. if not provided, current date is taken
 */
TimeStep.prototype.getLabelMinor = function(date) {
  if (date == undefined) {
    date = this.current;
  }

  var format = this.format.minorLabels[this.scale];
  return (format && format.length > 0) ? moment(date).format(format) : '';
};

/**
 * Returns formatted text for the major axis label, depending on the current
 * date and the scale. For example when scale is MINUTE, the major scale is
 * hours, and the hour will be formatted as "hh".
 * @param {Date} [date] custom date. if not provided, current date is taken
 */
TimeStep.prototype.getLabelMajor = function(date) {
  if (date == undefined) {
    date = this.current;
  }

  var format = this.format.majorLabels[this.scale];
  return (format && format.length > 0) ? moment(date).format(format) : '';
};

TimeStep.prototype.getClassName = function() {
  var m = moment(this.current);
  var date = m.locale ? m.locale('en') : m.lang('en'); // old versions of moment have .lang() function
  var step = this.step;

  function even(value) {
    return (value / step % 2 == 0) ? ' even' : ' odd';
  }

  function today(date) {
    if (date.isSame(new Date(), 'day')) {
      return ' today';
    }
    if (date.isSame(moment().add(1, 'day'), 'day')) {
      return ' tomorrow';
    }
    if (date.isSame(moment().add(-1, 'day'), 'day')) {
      return ' yesterday';
    }
    return '';
  }

  function currentWeek(date) {
    return date.isSame(new Date(), 'week') ? ' current-week' : '';
  }

  function currentMonth(date) {
    return date.isSame(new Date(), 'month') ? ' current-month' : '';
  }

  function currentYear(date) {
    return date.isSame(new Date(), 'year') ? ' current-year' : '';
  }

  switch (this.scale) {
    case 'millisecond':
      return even(date.milliseconds()).trim();

    case 'second':
      return even(date.seconds()).trim();

    case 'minute':
      return even(date.minutes()).trim();

    case 'hour':
      var hours = date.hours();
      if (this.step == 4) {
        hours = hours + '-' + (hours + 4);
      }
      return hours + 'h' + today(date) + even(date.hours());

    case 'weekday':
      return date.format('dddd').toLowerCase() +
          today(date) + currentWeek(date) + even(date.date());

    case 'day':
      var day = date.date();
      var month = date.format('MMMM').toLowerCase();
      return 'day' + day + ' ' + month + currentMonth(date) + even(day - 1);

    case 'month':
      return date.format('MMMM').toLowerCase() +
          currentMonth(date) + even(date.month());

    case 'year':
      var year = date.year();
      return 'year' + year + currentYear(date)+ even(year);

    default:
      return '';
  }
};

module.exports = TimeStep;

},{"../module/moment":7,"../util":31,"./DateUtil":10}],16:[function(require,module,exports){
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
var Results = require('./Results');
/**
 * Create a timeline visualization
 * @param {HTMLElement} container
 * @param {vis.DataSet | vis.DataView | Array | google.visualization.DataTable} [items]
 * @param {vis.DataSet | vis.DataView | Array | google.visualization.DataTable} [groups]
 * @param {Object} [options]  See Timeline.setOptions for the available options.
 * @constructor
 * @extends Core
 */
function Timeline (container, items, groups, options) {
    this.results = new Results();
  if (!(this instanceof Timeline)) {
    throw new SyntaxError('Constructor must be called with the new operator');
  }


  // if the third element is options, the forth is groups (optionally);
  if (!(Array.isArray(groups) || groups instanceof DataSet || groups instanceof DataView) && groups instanceof Object) {
    var forthArgument = options;
    options = groups;
    groups = forthArgument;
  }

  var me = this;
  this.defaultOptions = {
    start: null,
    end:   null,

    autoResize: true,

    orientation: 'bottom', // 'bottom', 'top', or 'both'
    width: null,
    height: null,
    maxHeight: null,
    minHeight: null
  };
  this.options = util.deepExtend({}, this.defaultOptions);


  // Create the DOM, props, and emitter
  if(typeof options.moreResultsId == 'number')
  this._create(container, options, options.moreResultsId);
else{
    this._create(container, options);

}

  // all components listed here will be repainted automatically
  this.components = [];

  this.body = {
    dom: this.dom,
    domProps: this.props,
    emitter: {
      on: this.on.bind(this),
      off: this.off.bind(this),
      emit: this.emit.bind(this)
    },
    hiddenDates: [],
    util: {
      getScale: function () {
        //return me.timeAxis.step.scale;
      },
      getStep: function () {
        //return me.timeAxis.step.step;
      },

      toScreen: me._toScreen.bind(me),
      toGlobalScreen: me._toGlobalScreen.bind(me), // this refers to the root.width
      toTime: me._toTime.bind(me),
      toGlobalTime : me._toGlobalTime.bind(me)
    }
  };

  // range
  this.range = new Range(this.body, options, this.body.dom, this.results);
  this.components.push(this.range);
  this.body.range = this.range;



  // current time bar
  this.currentTime = new CurrentTime(this.body);
  this.components.push(this.currentTime);

  // custom time bar
  // Note: time bar will be attached in this.setOptions when selected
  this.customTime = new CustomTime(this.body);
  this.components.push(this.customTime);

  // time axis


  // item set
  this.itemSet = new ItemSet(this.body, this.results);
  this.components.push(this.itemSet);
  this.results.addSet(this.itemSet);
  this.range.itemSet = this.itemSet;

  //timeaxis
  this.timeAxis = new TimeAxis(this.body, options, this.itemSet,this.results);
  this.timeAxis2 = null; // used in case of orientation option 'both'
  this.components.push(this.timeAxis);

  this.itemsData = null;      // DataSet
  this.groupsData = null;     // DataSet

  this.on('tap', function (event) {
    me.emit('click', me.getEventProperties(event))
  });
  this.on('doubletap', function (event) {
    me.emit('doubleClick', me.getEventProperties(event))
  });
  this.dom.root.oncontextmenu = function (event) {
    me.emit('contextmenu', me.getEventProperties(event))
  };

  // apply options
  if (options) {
    this.setOptions(options);
  }

  // IMPORTANT: THIS HAPPENS BEFORE SET ITEMS!
  if (groups) {
    this.setGroups(groups);
  }

  // create itemset
  if (items) {
    this.setItems(items, this.results);
  }
  else {
    this._redraw();
  }

   var me = this;

          document.addEventListener("newSearch", function(event) {
        	if(!me.options.results){
        		        		console.log("GGGGG")
        		        		console.log(data)

        	data = event.detail.message;
        	console.log(data)
        	$("#results").empty();

        	var iDiv = document.createElement('div');
iDiv.id = 'message';
$("#results").append(iDiv);

			me.results.map.clearAll();
			//me.itemSet.removeAllItems();
        	me.setItems(data);

        }
        });

}

// Extend the functionality from Core
Timeline.prototype = new Core();

/**
 * Force a redraw. The size of all items will be recalculated.
 * Can be useful to manually redraw when option autoResize=false and the window
 * has been resized, or when the items CSS has been changed.
 */
Timeline.prototype.redraw = function() {
  this.itemSet && this.itemSet.markDirty({refreshItems: true});



  this._redraw();


};

/**
 * Set items
 * @param {vis.DataSet | Array | google.visualization.DataTable | null} items
 */
Timeline.prototype.setItems = function(items, results) {
  var initialLoad = (this.itemsData == null);

  // convert to type DataSet when needed
  var newDataSet;
  if (!items) {
    newDataSet = null;
  }
  else if (items instanceof DataSet || items instanceof DataView) {
    newDataSet = items;
  }
  else {
    // turn an array into a dataset
    newDataSet = new DataSet(items, {
      type: {
        start: 'Date',
        end: 'Date'
      }
    });
  }

  // set items
  this.itemsData = newDataSet;
  this.itemSet && this.itemSet.setItems(newDataSet);
  if (initialLoad) {
    if (this.options.start != undefined || this.options.end != undefined) {
      if (this.options.start == undefined || this.options.end == undefined) {
        var dataRange = this._getDataRange();
      }

      var start = this.options.start != undefined ? this.options.start : dataRange.start;
      var end   = this.options.end != undefined   ? this.options.end   : dataRange.end;

      this.setWindow(start, end, {animate: false});
    }
    else {
      this.fit({animate: false});
    }
  }
};

/**
 * Set groups
 * @param {vis.DataSet | Array | google.visualization.DataTable} groups
 */
Timeline.prototype.setGroups = function(groups) {
  // convert to type DataSet when needed
  var newDataSet;
  if (!groups) {
    newDataSet = null;
  }
  else if (groups instanceof DataSet || groups instanceof DataView) {
    newDataSet = groups;
  }
  else {
    // turn an array into a dataset
    newDataSet = new DataSet(groups);
  }

  this.groupsData = newDataSet;
  this.itemSet.setGroups(newDataSet);
};

/**
 * Set selected items by their id. Replaces the current selection
 * Unknown id's are silently ignored.
 * @param {string[] | string} [ids]  An array with zero or more id's of the items to be
 *                                selected. If ids is an empty array, all items will be
 *                                unselected.
 * @param {Object} [options]      Available options:
 *                                `focus: boolean`
 *                                    If true, focus will be set to the selected item(s)
 *                                `animate: boolean | number`
 *                                    If true (default), the range is animated
 *                                    smoothly to the new window.
 *                                    If a number, the number is taken as duration
 *                                    for the animation. Default duration is 500 ms.
 *                                    Only applicable when option focus is true.
 */
Timeline.prototype.setSelection = function(ids, options) {
  this.itemSet && this.itemSet.setSelection(ids);

  if (options && options.focus) {
    this.focus(ids, options);
  }
};

/**
 * Get the selected items by their id
 * @return {Array} ids  The ids of the selected items
 */
Timeline.prototype.getSelection = function() {
  return this.itemSet && this.itemSet.getSelection() || [];
};

/**
 * Adjust the visible window such that the selected item (or multiple items)
 * are centered on screen.
 * @param {String | String[]} id     An item id or array with item ids
 * @param {Object} [options]      Available options:
 *                                `animate: boolean | number`
 *                                    If true (default), the range is animated
 *                                    smoothly to the new window.
 *                                    If a number, the number is taken as duration
 *                                    for the animation. Default duration is 500 ms.
 *                                    Only applicable when option focus is true
 */
Timeline.prototype.focus = function(id, options) {
  if (!this.itemsData || id == undefined) return;

  var ids = Array.isArray(id) ? id : [id];

  // get the specified item(s)
  var itemsData = this.itemsData.getDataSet().get(ids, {
    type: {
      start: 'Date',
      end: 'Date'
    }
  });

  // calculate minimum start and maximum end of specified items
  var start = null;
  var end = null;
  itemsData.forEach(function (itemData) {
    var s = itemData.start.valueOf();
    var e = 'end' in itemData ? itemData.end.valueOf() : itemData.start.valueOf();

    if (start === null || s < start) {
      start = s;
    }

    if (end === null || e > end) {
      end = e;
    }
  });

  if (start !== null && end !== null) {
    // calculate the new middle and interval for the window
    var middle = (start + end) / 2;
    var interval = Math.max((this.range.end - this.range.start), (end - start) * 1.1);

    var animate = (options && options.animate !== undefined) ? options.animate : true;
    this.range.setRange(middle - interval / 2, middle + interval / 2, animate);
  }
};

/**
 * Get the data range of the item set.
 * @returns {{min: Date, max: Date}} range  A range with a start and end Date.
 *                                          When no minimum is found, min==null
 *                                          When no maximum is found, max==null
 */
Timeline.prototype.getItemRange = function() {
  // calculate min from start filed
  var dataset = this.itemsData.getDataSet(),
    min = null,
    max = null;

  if (dataset) {
    // calculate the minimum value of the field 'start'
    var minItem = dataset.min('start');
    min = minItem ? util.convert(minItem.start, 'Date').valueOf() : null;
    // Note: we convert first to Date and then to number because else
    // a conversion from ISODate to Number will fail

    // calculate maximum value of fields 'start' and 'end'
    var maxStartItem = dataset.max('start');

    if (maxStartItem) {
      max = util.convert(maxStartItem.start, 'Date').valueOf();
    }
    var maxEndItem = dataset.max('end');
    if (maxEndItem) {
      if (max == null) {
        max = util.convert(maxEndItem.end, 'Date').valueOf();
      }
      else {
        max = Math.max(max, util.convert(maxEndItem.end, 'Date').valueOf());
      }
    }
  }
  return {
    min: (min != null) ? new Date(min) : null,
    max: (max != null) ? new Date(max) : null
  };
};

/**
 * Generate Timeline related information from an event
 * @param {Event} event
 * @return {Object} An object with related information, like on which area
 *                  The event happened, whether clicked on an item, etc.
 */
Timeline.prototype.getEventProperties = function (event) {
  var item  = this.itemSet.itemFromTarget(event);
  var group = this.itemSet.groupFromTarget(event);
  var pageX = event.gesture ? event.gesture.center.pageX : event.pageX;
  var pageY = event.gesture ? event.gesture.center.pageY : event.pageY;
  var x = pageX - util.getAbsoluteLeft(this.dom.centerContainer);
  var y = pageY - util.getAbsoluteTop(this.dom.centerContainer);

  var snap = this.itemSet.options.snap || null;
  var scale = this.body.util.getScale();
  var step = this.body.util.getStep();
  var time = this._toTime(x);
  var snappedTime = snap ? snap(time, scale, step) : time;

  var element = util.getTarget(event);
  var what = null;
  if (item != null)                                                    {what = 'item';}
  else if (util.hasParent(element, this.timeAxis.dom.foreground))      {what = 'axis';}
  else if (this.timeAxis2 && util.hasParent(element, this.timeAxis2.dom.foreground)) {what = 'axis';}
  else if (util.hasParent(element, this.itemSet.dom.labelSet))         {what = 'group-label';}
  else if (util.hasParent(element, this.customTime.bar))               {what = 'custom-time';} // TODO: fix for multiple custom time bars
  else if (util.hasParent(element, this.currentTime.bar))              {what = 'current-time';}
  else if (util.hasParent(element, this.dom.center))                   {what = 'background';}

  return {
    event: event,
    item: item ? item.id : null,
    group: group ? group.groupId : null,
    what: what,
    pageX: pageX,
    pageY: pageY,
    x: x,
    y: y,
    time: time,
    snappedTime: snappedTime
  }
};

module.exports = Timeline;

},{"../DataSet":2,"../DataView":3,"../module/hammer":6,"../util":31,"./Core":9,"./Range":12,"./Results":13,"./component/CurrentTime":19,"./component/CustomTime":20,"./component/ItemSet":22,"./component/TimeAxis":23,"emitter-component":32}],17:[function(require,module,exports){
var util = require('../../util');
var Group = require('./Group');

/**
 * @constructor BackgroundGroup
 * @param {Number | String} groupId
 * @param {Object} data
 * @param {ItemSet} itemSet
 */
function BackgroundGroup (groupId, data, itemSet) {
  Group.call(this, groupId, data, itemSet);

  this.width = 0;
  this.height = 0;
  this.top = 0;
  this.left = 0;
}

BackgroundGroup.prototype = Object.create(Group.prototype);

/**
 * Repaint this group
 * @param {{start: number, end: number}} range
 * @param {{item: {horizontal: number, vertical: number}, axis: number}} margin
 * @param {boolean} [restack=false]  Force restacking of all items
 * @return {boolean} Returns true if the group is resized
 */
BackgroundGroup.prototype.redraw = function(range, margin, restack) {
  var resized = false;

  this.visibleItems = this._updateVisibleItems(this.orderedItems, this.visibleItems, range);

  // calculate actual size
  this.width = this.dom.background.offsetWidth;

  // apply new height (just always zero for BackgroundGroup
  this.dom.background.style.height  = '0';

  // update vertical position of items after they are re-stacked and the height of the group is calculated
  for (var i = 0, ii = this.visibleItems.length; i < ii; i++) {
    var item = this.visibleItems[i];
    item.repositionY(margin);
  }

  return resized;
};

/**
 * Show this group: attach to the DOM
 */
BackgroundGroup.prototype.show = function() {
  if (!this.dom.background.parentNode) {
    this.itemSet.dom.background.appendChild(this.dom.background);
  }
};

module.exports = BackgroundGroup;

},{"../../util":31,"./Group":21}],18:[function(require,module,exports){
/**
 * Prototype for visual components
 * @param {{dom: Object, domProps: Object, emitter: Emitter, range: Range}} [body]
 * @param {Object} [options]
 */
function Component (body, options) {
  this.options = null;
  this.props = null;
}

/**
 * Set options for the component. The new options will be merged into the
 * current options.
 * @param {Object} options
 */
Component.prototype.setOptions = function(options) {
  if (options) {
    util.extend(this.options, options);
  }
};

/**
 * Repaint the component
 * @return {boolean} Returns true if the component is resized
 */
Component.prototype.redraw = function() {
  // should be implemented by the component
  return false;
};

/**
 * Destroy the component. Cleanup DOM and event listeners
 */
Component.prototype.destroy = function() {
  // should be implemented by the component
};

/**
 * Test whether the component is resized since the last time _isResized() was
 * called.
 * @return {Boolean} Returns true if the component is resized
 * @protected
 */
Component.prototype._isResized = function() {
  var resized = (this.props._previousWidth !== this.props.width ||
      this.props._previousHeight !== this.props.height);

  this.props._previousWidth = this.props.width;
  this.props._previousHeight = this.props.height;

  return resized;
};

module.exports = Component;

},{}],19:[function(require,module,exports){
var util = require('../../util');
var Component = require('./Component');
var moment = require('../../module/moment');
var locales = require('../locales');

/**
 * A current time bar
 * @param {{range: Range, dom: Object, domProps: Object}} body
 * @param {Object} [options]        Available parameters:
 *                                  {Boolean} [showCurrentTime]
 * @constructor CurrentTime
 * @extends Component
 */
function CurrentTime (body, options) {
  this.body = body;

  // default options
  this.defaultOptions = {
    showCurrentTime: true,

    locales: locales,
    locale: 'en'
  };
  this.options = util.extend({}, this.defaultOptions);
  this.offset = 0;

  this._create();

  this.setOptions(options);
}

CurrentTime.prototype = new Component();

/**
 * Create the HTML DOM for the current time bar
 * @private
 */
CurrentTime.prototype._create = function() {
  var bar = document.createElement('div');
  bar.className = 'currenttime';
  bar.style.position = 'absolute';
  bar.style.top = '0px';
  bar.style.height = '100%';

  this.bar = bar;
};

/**
 * Destroy the CurrentTime bar
 */
CurrentTime.prototype.destroy = function () {
  this.options.showCurrentTime = false;
  this.redraw(); // will remove the bar from the DOM and stop refreshing

  this.body = null;
};

/**
 * Set options for the component. Options will be merged in current options.
 * @param {Object} options  Available parameters:
 *                          {boolean} [showCurrentTime]
 */
CurrentTime.prototype.setOptions = function(options) {
  if (options) {
    // copy all options that we know
    util.selectiveExtend(['showCurrentTime', 'locale', 'locales'], this.options, options);
  }
};

/**
 * Repaint the component
 * @return {boolean} Returns true if the component is resized
 */
CurrentTime.prototype.redraw = function() {
  if (this.options.showCurrentTime) {
    var parent = this.body.dom.backgroundVertical;
    if (this.bar.parentNode != parent) {
      // attach to the dom
      if (this.bar.parentNode) {
        this.bar.parentNode.removeChild(this.bar);
      }
      parent.appendChild(this.bar);

      this.start();
    }

    var now = new Date(new Date().valueOf() + this.offset);
    var x = this.body.util.toScreen(now);

    var locale = this.options.locales[this.options.locale];
    var title = locale.current + ' ' + locale.time + ': ' + moment(now).format('dddd, MMMM Do YYYY, H:mm:ss');
    title = title.charAt(0).toUpperCase() + title.substring(1);

    this.bar.style.left = x + 'px';
    this.bar.title = title;
  }
  else {
    // remove the line from the DOM
    if (this.bar.parentNode) {
      this.bar.parentNode.removeChild(this.bar);
    }
    this.stop();
  }

  return false;
};

/**
 * Start auto refreshing the current time bar
 */
CurrentTime.prototype.start = function() {
  var me = this;

  function update () {
    me.stop();

    // determine interval to refresh
    var scale = me.body.range.conversion(me.body.domProps.center.width).scale;
    var interval = 1 / scale / 10;
    if (interval < 30)   interval = 30;
    if (interval > 1000) interval = 1000;

    me.redraw();

    // start a timer to adjust for the new time
    me.currentTimeTimer = setTimeout(update, interval);
  }

  update();
};

/**
 * Stop auto refreshing the current time bar
 */
CurrentTime.prototype.stop = function() {
  if (this.currentTimeTimer !== undefined) {
    clearTimeout(this.currentTimeTimer);
    delete this.currentTimeTimer;
  }
};

/**
 * Set a current time. This can be used for example to ensure that a client's
 * time is synchronized with a shared server time.
 * @param {Date | String | Number} time     A Date, unix timestamp, or
 *                                          ISO date string.
 */
CurrentTime.prototype.setCurrentTime = function(time) {
  var t = util.convert(time, 'Date').valueOf();
  var now = new Date().valueOf();
  this.offset = t - now;
  this.redraw();
};

/**
 * Get the current time.
 * @return {Date} Returns the current time.
 */
CurrentTime.prototype.getCurrentTime = function() {
  return new Date(new Date().valueOf() + this.offset);
};

module.exports = CurrentTime;

},{"../../module/moment":7,"../../util":31,"../locales":30,"./Component":18}],20:[function(require,module,exports){
var Hammer = require('../../module/hammer');
var util = require('../../util');
var Component = require('./Component');
var moment = require('../../module/moment');
var locales = require('../locales');

/**
 * A custom time bar
 * @param {{range: Range, dom: Object}} body
 * @param {Object} [options]        Available parameters:
 *                                  {Boolean} [showCustomTime]
 * @constructor CustomTime
 * @extends Component
 */

function CustomTime (body, options) {
  this.body = body;

  // default options
  this.defaultOptions = {
    showCustomTime: false,
    locales: locales,
    locale: 'en',
    id: 0
  };
  this.options = util.extend({}, this.defaultOptions);

  if (options && options.time) {
    this.customTime = options.time;
  } else {
    this.customTime = new Date();  
  }
  
  this.eventParams = {}; // stores state parameters while dragging the bar

  // create the DOM
  this._create();

  this.setOptions(options);
}

CustomTime.prototype = new Component();

/**
 * Set options for the component. Options will be merged in current options.
 * @param {Object} options  Available parameters:
 *                          {boolean} [showCustomTime]
 */
CustomTime.prototype.setOptions = function(options) {
  if (options) {
    // copy all options that we know
    util.selectiveExtend(['showCustomTime', 'locale', 'locales', 'id'], this.options, options);

    // Triggered by addCustomTimeBar, redraw to add new bar
    if (this.options.id) {
      this.redraw();
    }
  }
};

/**
 * Create the DOM for the custom time
 * @private
 */
CustomTime.prototype._create = function() {
  var bar = document.createElement('div');
  bar.className = 'customtime';
  bar.style.position = 'absolute';
  bar.style.top = '0px';
  bar.style.height = '100%';
  this.bar = bar;

  var drag = document.createElement('div');
  drag.style.position = 'relative';
  drag.style.top = '0px';
  drag.style.left = '-10px';
  drag.style.height = '100%';
  drag.style.width = '20px';
  bar.appendChild(drag);

  // attach event listeners
  this.hammer = Hammer(bar, {
    prevent_default: true
  });
  this.hammer.on('dragstart', this._onDragStart.bind(this));
  this.hammer.on('drag',      this._onDrag.bind(this));
  this.hammer.on('dragend',   this._onDragEnd.bind(this));
};

/**
 * Destroy the CustomTime bar
 */
CustomTime.prototype.destroy = function () {
  this.options.showCustomTime = false;
  this.redraw(); // will remove the bar from the DOM

  this.hammer.enable(false);
  this.hammer = null;

  this.body = null;
};

/**
 * Repaint the component
 * @return {boolean} Returns true if the component is resized
 */
CustomTime.prototype.redraw = function () {
  if (this.options.showCustomTime) {
    var parent = this.body.dom.backgroundVertical;
    if (this.bar.parentNode != parent) {
      // attach to the dom
      if (this.bar.parentNode) {
        this.bar.parentNode.removeChild(this.bar);
      }
      parent.appendChild(this.bar);
    }

    var x = this.body.util.toScreen(this.customTime);

    var locale = this.options.locales[this.options.locale];
    var title = locale.time + ': ' + moment(this.customTime).format('dddd, MMMM Do YYYY, H:mm:ss');
    title = title.charAt(0).toUpperCase() + title.substring(1);

    this.bar.style.left = x + 'px';
    this.bar.title = title;
  }
  else {
    // remove the line from the DOM
    if (this.bar.parentNode) {
      this.bar.parentNode.removeChild(this.bar);
    }
  }

  return false;
};

/**
 * Set custom time.
 * @param {Date | number | string} time
 */
CustomTime.prototype.setCustomTime = function(time) {
  this.customTime = util.convert(time, 'Date');
  this.redraw();
};

/**
 * Retrieve the current custom time.
 * @return {Date} customTime
 */
CustomTime.prototype.getCustomTime = function() {
  return new Date(this.customTime.valueOf());
};

/**
 * Start moving horizontally
 * @param {Event} event
 * @private
 */
CustomTime.prototype._onDragStart = function(event) {
  this.eventParams.dragging = true;
  this.eventParams.customTime = this.customTime;

  event.stopPropagation();
  event.preventDefault();
};

/**
 * Perform moving operating.
 * @param {Event} event
 * @private
 */
CustomTime.prototype._onDrag = function (event) {
  if (!this.eventParams.dragging) return;

  var deltaX = event.gesture.deltaX,
      x = this.body.util.toScreen(this.eventParams.customTime) + deltaX,
      time = this.body.util.toTime(x);

  this.setCustomTime(time);

  // fire a timechange event
  this.body.emitter.emit('timechange', {
    id: this.options.id,
    time: new Date(this.customTime.valueOf())
  });

  event.stopPropagation();
  event.preventDefault();
};

/**
 * Stop moving operating.
 * @param {event} event
 * @private
 */
CustomTime.prototype._onDragEnd = function (event) {
  if (!this.eventParams.dragging) return;

  // fire a timechanged event
  this.body.emitter.emit('timechanged', {
    id: this.options.id,
    time: new Date(this.customTime.valueOf())
  });

  event.stopPropagation();
  event.preventDefault();
};

module.exports = CustomTime;

},{"../../module/hammer":6,"../../module/moment":7,"../../util":31,"../locales":30,"./Component":18}],21:[function(require,module,exports){
var util = require('../../util');
var stack = require('../Stack');
var RangeItem = require('./item/RangeItem');

/**
 * @constructor Group
 * @param {Number | String} groupId
 * @param {Object} data
 * @param {ItemSet} itemSet
 */
function Group (groupId, data, itemSet) {
  this.groupId = groupId;
  this.subgroups = {};
  this.subgroupIndex = 0;
  this.subgroupOrderer = data && data.subgroupOrder;
  this.itemSet = itemSet;

  this.dom = {};
  this.props = {
    label: {
      width: 0,
      height: 0
    }
  };
  this.className = null;

  this.items = {};        // items filtered by groupId of this group
  this.visibleItems = []; // items currently visible in window
  this.orderedItems = {
    byStart: [],
    byEnd: []
  };
  this.checkRangedItems = false; // needed to refresh the ranged items if the window is programatically changed with NO overlap.
  var me = this;
  this.itemSet.body.emitter.on("checkRangedItems", function () {
    me.checkRangedItems = true;
  })

  this._create();

  this.setData(data);
}

/**
 * Create DOM elements for the group
 * @private
 */
Group.prototype._create = function() {
  var label = document.createElement('div');
  label.className = 'vlabel';
  this.dom.label = label;

  var inner = document.createElement('div');
  inner.className = 'inner';
  label.appendChild(inner);
  this.dom.inner = inner;

  var foreground = document.createElement('div');
  foreground.className = 'group';
  foreground['timeline-group'] = this;
  this.dom.foreground = foreground;

  this.dom.background = document.createElement('div');
  this.dom.background.className = 'group';

  this.dom.axis = document.createElement('div');
  this.dom.axis.className = 'group';

  // create a hidden marker to detect when the Timelines container is attached
  // to the DOM, or the style of a parent of the Timeline is changed from
  // display:none is changed to visible.
  this.dom.marker = document.createElement('div');
  this.dom.marker.style.visibility = 'hidden'; // TODO: ask jos why this is not none?
  this.dom.marker.innerHTML = '?';
  this.dom.background.appendChild(this.dom.marker);
};

/**
 * Set the group data for this group
 * @param {Object} data   Group data, can contain properties content and className
 */
Group.prototype.setData = function(data) {
  // update contents
  var content = data && data.content;
  if (content instanceof Element) {
    this.dom.inner.appendChild(content);
  }
  else if (content !== undefined && content !== null) {
    this.dom.inner.innerHTML = content;
  }
  else {
    this.dom.inner.innerHTML = this.groupId || ''; // groupId can be null
  }

  // update title
  this.dom.label.title = data && data.title || '';

  if (!this.dom.inner.firstChild) {
    util.addClassName(this.dom.inner, 'hidden');
  }
  else {
    util.removeClassName(this.dom.inner, 'hidden');
  }

  // update className
  var className = data && data.className || null;
  if (className != this.className) {
    if (this.className) {
      util.removeClassName(this.dom.label, this.className);
      util.removeClassName(this.dom.foreground, this.className);
      util.removeClassName(this.dom.background, this.className);
      util.removeClassName(this.dom.axis, this.className);
    }
    util.addClassName(this.dom.label, className);
    util.addClassName(this.dom.foreground, className);
    util.addClassName(this.dom.background, className);
    util.addClassName(this.dom.axis, className);
    this.className = className;
  }

  // update style
  if (this.style) {
    util.removeCssText(this.dom.label, this.style);
    this.style = null;
  }
  if (data && data.style) {
    util.addCssText(this.dom.label, data.style);
    this.style = data.style;
  }
};

/**
 * Get the width of the group label
 * @return {number} width
 */
Group.prototype.getLabelWidth = function() {
  return this.props.label.width;
};


/**
 * Repaint this group
 * @param {{start: number, end: number}} range
 * @param {{item: {horizontal: number, vertical: number}, axis: number}} margin
 * @param {boolean} [restack=false]  Force restacking of all items
 * @return {boolean} Returns true if the group is resized
 */
Group.prototype.redraw = function(range, margin, restack) {
  var resized = false;

  // force recalculation of the height of the items when the marker height changed
  // (due to the Timeline being attached to the DOM or changed from display:none to visible)
  var markerHeight = this.dom.marker.clientHeight;
  if (markerHeight != this.lastMarkerHeight) {
    this.lastMarkerHeight = markerHeight;

    util.forEach(this.items, function (item) {
      item.dirty = true;
      if (item.displayed) item.redraw();
    });

    restack = true;
  }

  // reposition visible items vertically
  if (typeof this.itemSet.options.order === 'function') {
    // a custom order function

    if (restack) {
      // brute force restack of all items

      // show all items
      var me = this;
      var limitSize = false;
      util.forEach(this.items, function (item) {
        if (!item.displayed) {
          item.redraw();
          me.visibleItems.push(item);
        }
        item.repositionX(limitSize);
      });

      // order all items and force a restacking
      var customOrderedItems = this.orderedItems.byStart.slice().sort(function (a, b) {
        return me.itemSet.options.order(a.data, b.data);
      });
      stack.stack(customOrderedItems, margin, true /* restack=true */);
    }

    this.visibleItems = this._updateVisibleItems(this.orderedItems, this.visibleItems, range);
  }
  else {
    // no custom order function, lazy stacking
    this.visibleItems = this._updateVisibleItems(this.orderedItems, this.visibleItems, range);

    //if (this.itemSet.options.stack) { // TODO: ugly way to access options...
   //   stack.stack(this.visibleItems, margin, restack);
   // }
   // else { // no stacking
      stack.nostack(this.visibleItems, margin, this.subgroups);
   // }
  }

  // recalculate the height of the group
  //var height = this._calculateHeight(margin);
  if(this.itemSet.options.results)
    var height = 5;
  else{
    var height = 60;}

  // calculate actual size and position
  var foreground = this.dom.foreground;
  this.top = foreground.offsetTop;
  this.left = foreground.offsetLeft;
  this.width = foreground.offsetWidth;
  resized = util.updateProperty(this, 'height', height) || resized;

  // recalculate size of label
  resized = util.updateProperty(this.props.label, 'width', this.dom.inner.clientWidth) || resized;
  resized = util.updateProperty(this.props.label, 'height', this.dom.inner.clientHeight) || resized;

  // apply new height
  this.dom.background.style.height  = height + 'px';
  this.dom.foreground.style.height  = height + 'px';
  this.dom.label.style.height = height + 'px';

  // update vertical position of items after they are re-stacked and the height of the group is calculated
  for (var i = 0, ii = this.visibleItems.length; i < ii; i++) {
    var item = this.visibleItems[i];
    item.repositionY(margin);
  }

  return resized;
};

/**
 * recalculate the height of the group
 * @param {{item: {horizontal: number, vertical: number}, axis: number}} margin
 * @returns {number} Returns the height
 * @private
 */
Group.prototype._calculateHeight = function (margin) {
  // recalculate the height of the group
  var height;
  var visibleItems = this.visibleItems;
  //var visibleSubgroups = [];
  //this.visibleSubgroups = 0;
  this.resetSubgroups();
  var me = this;
  if (visibleItems.length) {
    var min = visibleItems[0].top;
    var max = visibleItems[0].top + visibleItems[0].height;
    util.forEach(visibleItems, function (item) {
      min = Math.min(min, item.top);
      max = Math.max(max, (item.top + item.height));
      if (item.data.subgroup !== undefined) {
        me.subgroups[item.data.subgroup].height = Math.max(me.subgroups[item.data.subgroup].height,item.height);
        me.subgroups[item.data.subgroup].visible = true;
        //if (visibleSubgroups.indexOf(item.data.subgroup) == -1){
        //  visibleSubgroups.push(item.data.subgroup);
        //  me.visibleSubgroups += 1;
        //}
      }
    });
    if (min > margin.axis) {
      // there is an empty gap between the lowest item and the axis
      var offset = min - margin.axis;
      max -= offset;
      util.forEach(visibleItems, function (item) {
        item.top -= offset;
      });
    }
    height = max + margin.item.vertical / 2;
  }
  else {
    height = margin.axis + margin.item.vertical;
  }
  height = Math.max(height, this.props.label.height);

  return height;
};

/**
 * Show this group: attach to the DOM
 */
Group.prototype.show = function() {
  if (!this.dom.label.parentNode) {
    this.itemSet.dom.labelSet.appendChild(this.dom.label);
  }

  if (!this.dom.foreground.parentNode) {
    this.itemSet.dom.foreground.appendChild(this.dom.foreground);
  }

  if (!this.dom.background.parentNode) {
    this.itemSet.dom.background.appendChild(this.dom.background);
  }

  if (!this.dom.axis.parentNode) {
    this.itemSet.dom.axis.appendChild(this.dom.axis);
  }
};

/**
 * Hide this group: remove from the DOM
 */
Group.prototype.hide = function() {
  var label = this.dom.label;
  if (label.parentNode) {
    label.parentNode.removeChild(label);
  }

  var foreground = this.dom.foreground;
  if (foreground.parentNode) {
    foreground.parentNode.removeChild(foreground);
  }

  var background = this.dom.background;
  if (background.parentNode) {
    background.parentNode.removeChild(background);
  }

  var axis = this.dom.axis;
  if (axis.parentNode) {
    axis.parentNode.removeChild(axis);
  }
};

/**
 * Add an item to the group
 * @param {Item} item
 */
Group.prototype.add = function(item) {
  this.items[item.id] = item;
  item.setParent(this);

  // add to
  if (item.data.subgroup !== undefined) {
    if (this.subgroups[item.data.subgroup] === undefined) {
      this.subgroups[item.data.subgroup] = {height:0, visible: false, index:this.subgroupIndex, items: []};
      this.subgroupIndex++;
    }
    this.subgroups[item.data.subgroup].items.push(item);
  }
  this.orderSubgroups();

  if (this.visibleItems.indexOf(item) == -1) {
    var range = this.itemSet.body.range; // TODO: not nice accessing the range like this
    this._checkIfVisible(item, this.visibleItems, range);
  }
};

Group.prototype.orderSubgroups = function() {
  if (this.subgroupOrderer !== undefined) {
    var sortArray = [];
    if (typeof this.subgroupOrderer == 'string') {
      for (var subgroup in this.subgroups) {
        sortArray.push({subgroup: subgroup, sortField: this.subgroups[subgroup].items[0].data[this.subgroupOrderer]})
      }
      sortArray.sort(function (a, b) {
        return a.sortField - b.sortField;
      })
    }
    else if (typeof this.subgroupOrderer == 'function') {
      for (var subgroup in this.subgroups) {
        sortArray.push(this.subgroups[subgroup].items[0].data);
      }
      sortArray.sort(this.subgroupOrderer);
    }

    if (sortArray.length > 0) {
      for (var i = 0; i < sortArray.length; i++) {
        this.subgroups[sortArray[i].subgroup].index = i;
      }
    }
  }
};

Group.prototype.resetSubgroups = function() {
  for (var subgroup in this.subgroups) {
    if (this.subgroups.hasOwnProperty(subgroup)) {
      this.subgroups[subgroup].visible = false;
    }
  }
};

/**
 * Remove an item from the group
 * @param {Item} item
 */
Group.prototype.remove = function(item) {
  delete this.items[item.id];
  item.setParent(null);

  // remove from visible items
  var index = this.visibleItems.indexOf(item);
  if (index != -1) this.visibleItems.splice(index, 1);

  // TODO: also remove from ordered items?
};


/**
 * Remove an item from the corresponding DataSet
 * @param {Item} item
 */
Group.prototype.removeFromDataSet = function(item) {
  this.itemSet.joinRanges(item);
  this.itemSet.removeItem(item.id);
};

Group.prototype.removeFromDataSet2 = function(item) {
 // this.itemSet.joinRanges(item);
  this.itemSet.removeItem(item.id);
};


/**
 * Reorder the items
 */
Group.prototype.order = function() {
  var array = util.toArray(this.items);
  var startArray = [];
  var endArray = [];

  for (var i = 0; i < array.length; i++) {
    if (array[i].data.end !== undefined) {
      endArray.push(array[i]);
    }
    startArray.push(array[i]);
  }
  this.orderedItems = {
    byStart: startArray,
    byEnd: endArray
  };

  stack.orderByStart(this.orderedItems.byStart);
  stack.orderByEnd(this.orderedItems.byEnd);
};


/**
 * Update the visible items
 * @param {{byStart: Item[], byEnd: Item[]}} orderedItems   All items ordered by start date and by end date
 * @param {Item[]} visibleItems                             The previously visible items.
 * @param {{start: number, end: number}} range              Visible range
 * @return {Item[]} visibleItems                            The new visible items.
 * @private
 */
Group.prototype._updateVisibleItems = function(orderedItems, oldVisibleItems, range) {
  var visibleItems = [];
  var visibleItemsLookup = {}; // we keep this to quickly look up if an item already exists in the list without using indexOf on visibleItems
  var interval = (range.end - range.start) / 4;
  var lowerBound = range.start - interval;
  var upperBound = range.end + interval;
  var item, i;

  // this function is used to do the binary search.
  var searchFunction = function (value) {
    if      (value < lowerBound)  {return -1;}
    else if (value <= upperBound) {return  0;}
    else                          {return  1;}
  }

  // first check if the items that were in view previously are still in view.
  // IMPORTANT: this handles the case for the items with startdate before the window and enddate after the window!
  // also cleans up invisible items.
  if (oldVisibleItems.length > 0) {
    for (i = 0; i < oldVisibleItems.length; i++) {
      this._checkIfVisibleWithReference(oldVisibleItems[i], visibleItems, visibleItemsLookup, range);
    }
  }

  // we do a binary search for the items that have only start values.
  var initialPosByStart = util.binarySearchCustom(orderedItems.byStart, searchFunction, 'data','start');

  // trace the visible items from the inital start pos both ways until an invisible item is found, we only look at the start values.
  this._traceVisible(initialPosByStart, orderedItems.byStart, visibleItems, visibleItemsLookup, function (item) {
    return (item.data.start < lowerBound || item.data.start > upperBound);
  });

  // if the window has changed programmatically without overlapping the old window, the ranged items with start < lowerBound and end > upperbound are not shown.
  // We therefore have to brute force check all items in the byEnd list
  if (this.checkRangedItems == true) {
    this.checkRangedItems = false;
    for (i = 0; i < orderedItems.byEnd.length; i++) {
      this._checkIfVisibleWithReference(orderedItems.byEnd[i], visibleItems, visibleItemsLookup, range);
    }
  }
  else {
    // we do a binary search for the items that have defined end times.
    var initialPosByEnd = util.binarySearchCustom(orderedItems.byEnd, searchFunction, 'data','end');

    // trace the visible items from the inital start pos both ways until an invisible item is found, we only look at the end values.
    this._traceVisible(initialPosByEnd, orderedItems.byEnd, visibleItems, visibleItemsLookup, function (item) {
      return (item.data.end < lowerBound || item.data.end > upperBound);
    });
  }


  // finally, we reposition all the visible items.
  for (i = 0; i < visibleItems.length; i++) {
    item = visibleItems[i];
    if (!item.displayed) item.show();
    // reposition item horizontally
    item.repositionX();
  }

  // debug
  //console.log("new line")
  //if (this.groupId == null) {
  //  for (i = 0; i < orderedItems.byStart.length; i++) {
  //    item = orderedItems.byStart[i].data;
  //    console.log('start',i,initialPosByStart, item.start.valueOf(), item.content, item.start >= lowerBound && item.start <= upperBound,i == initialPosByStart ? "<------------------- HEREEEE" : "")
  //  }
  //  for (i = 0; i < orderedItems.byEnd.length; i++) {
  //    item = orderedItems.byEnd[i].data;
  //    console.log('rangeEnd',i,initialPosByEnd, item.end.valueOf(), item.content, item.end >= range.start && item.end <= range.end,i == initialPosByEnd ? "<------------------- HEREEEE" : "")
  //  }
  //}

  return visibleItems;
};

Group.prototype._traceVisible = function (initialPos, items, visibleItems, visibleItemsLookup, breakCondition) {
  var item;
  var i;

  if (initialPos != -1) {
    for (i = initialPos; i >= 0; i--) {
      item = items[i];
      if (breakCondition(item)) {
        break;
      }
      else {
        if (visibleItemsLookup[item.id] === undefined) {
          visibleItemsLookup[item.id] = true;
          visibleItems.push(item);
        }
      }
    }

    for (i = initialPos + 1; i < items.length; i++) {
      item = items[i];
      if (breakCondition(item)) {
        break;
      }
      else {
        if (visibleItemsLookup[item.id] === undefined) {
          visibleItemsLookup[item.id] = true;
          visibleItems.push(item);
        }
      }
    }
  }
}


/**
 * this function is very similar to the _checkIfInvisible() but it does not
 * return booleans, hides the item if it should not be seen and always adds to
 * the visibleItems.
 * this one is for brute forcing and hiding.
 *
 * @param {Item} item
 * @param {Array} visibleItems
 * @param {{start:number, end:number}} range
 * @private
 */
Group.prototype._checkIfVisible = function(item, visibleItems, range) {
    if (item.isVisible(range)) {
      if (!item.displayed) item.show();
      // reposition item horizontally
      item.repositionX();
      visibleItems.push(item);
    }
    else {
      if (item.displayed) item.hide();
    }
};


/**
 * this function is very similar to the _checkIfInvisible() but it does not
 * return booleans, hides the item if it should not be seen and always adds to
 * the visibleItems.
 * this one is for brute forcing and hiding.
 *
 * @param {Item} item
 * @param {Array} visibleItems
 * @param {{start:number, end:number}} range
 * @private
 */
Group.prototype._checkIfVisibleWithReference = function(item, visibleItems, visibleItemsLookup, range) {
  if (item.isVisible(range)) {
    if (visibleItemsLookup[item.id] === undefined) {
      visibleItemsLookup[item.id] = true;
      visibleItems.push(item);
    }
  }
  else {
    if (item.displayed) item.hide();
  }
};



module.exports = Group;

},{"../../util":31,"../Stack":14,"./item/RangeItem":29}],22:[function(require,module,exports){
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
},{"../../DataSet":2,"../../DataView":3,"../../module/hammer":6,"../../module/moment":7,"../../util":31,"../Results":13,"../Stack":14,"../TimeStep":15,"./BackgroundGroup":17,"./Component":18,"./Group":21,"./item/BackgroundItem":24,"./item/BoxItem":25,"./item/IntervalItem":26,"./item/PointItem":28,"./item/RangeItem":29}],23:[function(require,module,exports){
var util = require('../../util');
var Component = require('./Component');
var TimeStep = require('../TimeStep');
var DateUtil = require('../DateUtil');
var moment = require('../../module/moment');
var Hammer = require('../../module/hammer');
var ItemSet = require('./ItemSet');
var DataSet = require('../../DataSet');
var Results = require('../Results')
    /**
     * A horizontal time axis
     * @param {{dom: Object, domProps: Object, emitter: Emitter, range: Range}} body
     * @param {Object} [options]        See TimeAxis.setOptions for the available
     *                                  options.
     * @constructor TimeAxis
     * @extends Component
     */
function TimeAxis(body, options, itemSet, results) {
    if (options instanceof DataSet) {
        this.itemSet = options;
    }
    this.results = results;
    this.dom = {
        foreground: null,
    };
    this.appended = false;
    this.props = {
        range: {
            start: 0,
            end: 0,
            minimumStep: 0
        },
        lineTop: 0
    };

    this.defaultOptions = {
        orientation: 'bottom', // supported: 'top', 'bottom'
        // TODO: implement timeaxis orientations 'left' and 'right'
        showMinorLabels: false,
        showMajorLabels: false,
        format: null,
        timeAxis: null,
        results: false
    };
    this.options = util.extend({}, options);
    this.options = util.extend({}, this.defaultOptions);

    this.body = body;
    this.itemSet = itemSet;
    // create the HTML DOM
    this.setOptions(options);

    this._create();


}

TimeAxis.prototype = new Component();

/**
 * Set options for the TimeAxis.
 * Parameters will be merged in current options.
 * @param {Object} options  Available options:
 *                          {string} [orientation]
 *                          {boolean} [showMinorLabels]
 *                          {boolean} [showMajorLabels]
 */
TimeAxis.prototype.setOptions = function(options) {
    if (options) {
        // copy all options that we know
        util.selectiveExtend([
            'orientation',
            'showMinorLabels',
            'showMajorLabels',
            'hiddenDates',
            'format',
            'timeAxis',
            'results',
            'moreResultsId',
            'colapsed'
        ], this.options, options);
        // apply locale to moment.js
        // TODO: not so nice, this is applied globally to moment.js
        if ('locale' in options) {
            if (typeof moment.locale === 'function') {
                // moment.js 2.8.1+
                moment.locale(options.locale);
            } else {
                moment.lang(options.locale);
            }
        }
    }
};



/**
 * Create the HTML DOM for the TimeAxis
 */
TimeAxis.prototype._create = function() {

    this.dom.foreground = document.createElement('div');
    this.dom.background = document.createElement('div');


    this.dom.foreground.className = 'timeaxis foreground';
    this.dom.background.className = 'timeaxis background';

    var line = document.createElement('div');

    line.style.width = 5000 + 'px';
    line.style.bottom = '50%';

    line.className = 'grid horizontal major ';

    this.dom.background.appendChild(line);
    if (!this.options.results) {
        var dateDiv = document.createElement('div');
        dateDiv.className = "input-append";
        dateDiv.id = "datepicker";

        dateDiv.innerHTML = '<div class="input-group date" style="z-index:-1">' +
            '<input value="--/--/----" style="border:none;box-shadow:none" id="dateInput" style="z-index:1" type="text" class="form-control"><span class="input-group-addon" ><i class="icon-calendar"></i></span>' +
            '</div>';

        this.body.dom.leftContainer.appendChild(dateDiv);

        var me = this;

        window.onload = function() {

            var everything = document.getElementById("datepicker");
            var input = document.getElementById("dateInput");
            Hammer(input, {
                preventDefault: true
            }).on('tap', function(event) {
                input.focus();
                event.stopPropagation();
            });
            Hammer(everything, { //unfocus if clicked outside
                preventDefault: true
            }).on('tap', function(event) {
                input.blur();
                event.stopPropagation();
            });
            $(input).on("keydown", function search(e) { //unfocus if enter
                if (e.keyCode == 13) {
                    input.blur();
                }
            });


            $('.input-group.date').datepicker({
                format: "dd/mm/yyyy",
                orientation: "top left",
                autoclose: true,
                todayHighlight: true
            });


            var search = document.getElementById("searchButton");

            search.onclick = function() {
                me.results.sendQueryData(me.itemSet.getData());
                me.results.clearEverythingButCurrentSearch();
                me.results.clearResults();
            };
            var clear = document.getElementById("clearButton");

            clear.onclick = function() {
                me.results.clearEverything();
            };



        }

this.body.dom.rightContainer.style.textAlign = 'center';
        var searchButton = document.createElement("button");
        searchButton.id = "searchButton";
        searchButton.innerText = "Search";
        searchButton.className = "btn btn-default btn-sm";
        searchButton.style.top = '50%';
        searchButton.style.transform = 'translateY(-50%)';
        searchButton.style.position = 'relative';
        searchButton.style.fontSize = 'x-small';
        this.body.dom.rightContainer.appendChild(searchButton);


        var clearButton = document.createElement("button");
        clearButton.id = "clearButton";
        clearButton.innerText = "Clear";
        clearButton.className = "btn btn-default btn-xs";
        clearButton.style.top = '60%';
        clearButton.style.transform = 'translateY(-60%)';
        clearButton.style.position = 'relative';
        clearButton.style.fontSize = 'x-small';
        this.body.dom.rightContainer.appendChild(clearButton);

    }else if(this.options.results && !this.options.colapsed){
      this.body.dom.leftContainer.style.width = "0px";

        var moreIcon = document.createElement('div');
        moreIcon.className = "show-more-icon";

        this.body.dom.root.appendChild(moreIcon);

    }else if(this.options.results && this.options.colapsed && this.options.moreResultsId === null) {
        var dateDiv = document.createElement('div');
        dateDiv.className = "result-date";

        this.body.dom.leftContainer.appendChild(dateDiv);
        this.body.dom.resultDate = dateDiv;
    
    } else if(this.options.results && this.options.colapsed ) {

        var dateDiv = document.createElement('div');
        dateDiv.className = "result-date";
        this.body.dom.root.style.marginLeft = "33px";
        this.body.dom.root.style.borderLeftWidth = "4px";

        this.body.dom.leftContainer.appendChild(dateDiv);
        this.body.dom.resultDate = dateDiv;
      }

};

/**
 * Destroy the TimeAxis
 */
TimeAxis.prototype.destroy = function() {
    // remove from DOM
    if (this.dom.foreground.parentNode) {
        this.dom.foreground.parentNode.removeChild(this.dom.foreground);
    }
    if (this.dom.background.parentNode) {
        this.dom.background.parentNode.removeChild(this.dom.background);
    }

    this.body = null;
};


/**
 * Repaint the component
 * @return {boolean} Returns true if the component is resized
 */
TimeAxis.prototype.redraw = function() {


      var settings = document.getElementById("settings");
settings.onclick=function(){$('.ui.sidebar').sidebar('toggle');};
           
      



    if (this.itemSet.itemsData && this.options.results && (typeof this.options.moreResultsId == 'undefined' || this.options.moreResultsId == null) ) {
        var first;
        util.forEach(this.itemSet.items, function(item) {
            first = item;
            return;
        });

        var date = moment(first.data.date).format("DD/MM/YYYY");
        this.body.dom.resultDate.innerText = date;
    }
    var options = this.options;
    var props = this.props;
    var foreground = this.dom.foreground;
    var background = this.dom.background;

    // determine the correct parent DOM element (depending on option orientation)
    var parent = (options.orientation == 'top') ? this.body.dom.top : this.body.dom.bottom;
    var parentChanged = (foreground.parentNode !== parent);

    // calculate character width and height
    //this._calculateCharSize();

    // TODO: recalculate sizes only needed when parent is resized or options is changed
    var orientation = this.options.orientation,
        showMinorLabels = this.options.showMinorLabels,
        showMajorLabels = this.options.showMajorLabels;

    // determine the width and height of the elemens for the axis
    props.minorLabelHeight = showMinorLabels ? props.minorCharHeight : 0;
    props.majorLabelHeight = showMajorLabels ? props.majorCharHeight : 0;
    props.height = props.minorLabelHeight + props.majorLabelHeight;
    props.width = foreground.offsetWidth;

    props.minorLineHeight = this.body.domProps.root.height - props.majorLabelHeight -
        (options.orientation == 'top' ? this.body.domProps.bottom.height : this.body.domProps.top.height);
    props.minorLineWidth = 1; // TODO: really calculate width
    props.majorLineHeight = props.minorLineHeight + props.majorLabelHeight;
    props.majorLineWidth = 1; // TODO: really calculate width

    //  take foreground and background offline while updating (is almost twice as fast)
    var foregroundNextSibling = foreground.nextSibling;
    var backgroundNextSibling = background.nextSibling;
    foreground.parentNode && foreground.parentNode.removeChild(foreground);
    background.parentNode && background.parentNode.removeChild(background);

    foreground.style.height = this.props.height + 'px';



    // put DOM online again (at the same place)
    if (foregroundNextSibling) {
        parent.insertBefore(foreground, foregroundNextSibling);
    } else {
        parent.appendChild(foreground)
    }
    if (backgroundNextSibling) {
        this.body.dom.backgroundVertical.insertBefore(background, backgroundNextSibling);
    } else {
        this.body.dom.backgroundVertical.appendChild(background)
    }

    return this._isResized() || parentChanged;
};

module.exports = TimeAxis;
},{"../../DataSet":2,"../../module/hammer":6,"../../module/moment":7,"../../util":31,"../DateUtil":10,"../Results":13,"../TimeStep":15,"./Component":18,"./ItemSet":22}],24:[function(require,module,exports){
var Hammer = require('../../../module/hammer');
var Item = require('./Item');
var BackgroundGroup = require('../BackgroundGroup');
var RangeItem = require('./RangeItem');

/**
 * @constructor BackgroundItem
 * @extends Item
 * @param {Object} data             Object containing parameters start, end
 *                                  content, className.
 * @param {{toScreen: function, toTime: function}} conversion
 *                                  Conversion functions from time to screen and vice versa
 * @param {Object} [options]        Configuration options
 *                                  // TODO: describe options
 */
// TODO: implement support for the BackgroundItem just having a start, then being displayed as a sort of an annotation
function BackgroundItem (data, conversion, options) {
  this.props = {
    content: {
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

  this.emptyContent = false;
}

BackgroundItem.prototype = new Item (null, null, null);

BackgroundItem.prototype.baseClassName = 'item background';
BackgroundItem.prototype.stack = false;

/**
 * Check whether this item is visible inside given range
 * @returns {{start: Number, end: Number}} range with a timestamp for start and end
 * @returns {boolean} True if visible
 */
BackgroundItem.prototype.isVisible = function(range) {
  // determine visibility
  return (this.data.start < range.end) && (this.data.end > range.start);
};

/**
 * Repaint the item
 */
BackgroundItem.prototype.redraw = function() {
  var dom = this.dom;
  if (!dom) {
    // create DOM
    this.dom = {};
    dom = this.dom;

    // background box
    dom.box = document.createElement('div');
    // className is updated in redraw()

    // contents box
    dom.content = document.createElement('div');
    dom.content.className = 'content';
    dom.box.appendChild(dom.content);

    // Note: we do NOT attach this item as attribute to the DOM,
    //       such that background items cannot be selected
    //dom.box['timeline-item'] = this;

    this.dirty = true;
  }

  // append DOM to parent DOM
  if (!this.parent) {
    throw new Error('Cannot redraw item: no parent attached');
  }
  if (!dom.box.parentNode) {
    var background = this.parent.dom.background;
    if (!background) {
      throw new Error('Cannot redraw item: parent has no background container element');
    }
    background.appendChild(dom.box);
  }
  this.displayed = true;

  // Update DOM when item is marked dirty. An item is marked dirty when:
  // - the item is not yet rendered
  // - the item's data is changed
  // - the item is selected/deselected
  if (this.dirty) {
    this._updateContents(this.dom.content);
    this._updateTitle(this.dom.content);
    this._updateDataAttributes(this.dom.content);
    this._updateStyle(this.dom.box);

    // update class
    var className = (this.data.className ? (' ' + this.data.className) : '') +
        (this.selected ? ' selected' : '');
    dom.box.className = this.baseClassName + className;

    // determine from css whether this box has overflow
    this.overflow = window.getComputedStyle(dom.content).overflow !== 'hidden';

    // recalculate size
    this.props.content.width = this.dom.content.offsetWidth;
    this.height = 0; // set height zero, so this item will be ignored when stacking items

    this.dirty = false;
  }
};

/**
 * Show the item in the DOM (when not already visible). The items DOM will
 * be created when needed.
 */
BackgroundItem.prototype.show = RangeItem.prototype.show;

/**
 * Hide the item from the DOM (when visible)
 * @return {Boolean} changed
 */
BackgroundItem.prototype.hide = RangeItem.prototype.hide;

/**
 * Reposition the item horizontally
 * @Override
 */
BackgroundItem.prototype.repositionX = RangeItem.prototype.repositionX;

/**
 * Reposition the item vertically
 * @Override
 */
BackgroundItem.prototype.repositionY = function(margin) {
  var onTop = this.options.orientation === 'top';
  this.dom.content.style.top = onTop ? '' : '0';
  this.dom.content.style.bottom = onTop ? '0' : '';
  var height;

  // special positioning for subgroups
  if (this.data.subgroup !== undefined) {
    // TODO: instead of calculating the top position of the subgroups here for every BackgroundItem, calculate the top of the subgroup once in Itemset

    var itemSubgroup = this.data.subgroup;
    var subgroups = this.parent.subgroups;
    var subgroupIndex = subgroups[itemSubgroup].index;
    // if the orientation is top, we need to take the difference in height into account.
    if (onTop == true) {
      // the first subgroup will have to account for the distance from the top to the first item.
      height = this.parent.subgroups[itemSubgroup].height + margin.item.vertical;
      height += subgroupIndex == 0 ? margin.axis - 0.5*margin.item.vertical : 0;
      var newTop = this.parent.top;
      for (var subgroup in subgroups) {
        if (subgroups.hasOwnProperty(subgroup)) {
          if (subgroups[subgroup].visible == true && subgroups[subgroup].index < subgroupIndex) {
            newTop += subgroups[subgroup].height + margin.item.vertical;
          }
        }
      }

      // the others will have to be offset downwards with this same distance.
      newTop += subgroupIndex != 0 ? margin.axis - 0.5 * margin.item.vertical : 0;
      this.dom.box.style.top = newTop + 'px';
      this.dom.box.style.bottom = '';
    }
    // and when the orientation is bottom:
    else {
      var newTop = this.parent.top;
      var totalHeight = 0;
      for (var subgroup in subgroups) {
        if (subgroups.hasOwnProperty(subgroup)) {
          if (subgroups[subgroup].visible == true) {
            var newHeight = subgroups[subgroup].height + margin.item.vertical;
            totalHeight += newHeight;
            if (subgroups[subgroup].index > subgroupIndex) {
              newTop += newHeight;
            }
          }
        }
      }
      height = this.parent.subgroups[itemSubgroup].height + margin.item.vertical;
      this.dom.box.style.top = (this.parent.height - totalHeight + newTop) + 'px';
      this.dom.box.style.bottom = '';
    }
  }
  // and in the case of no subgroups:
  else {
    // we want backgrounds with groups to only show in groups.
    if (this.parent instanceof BackgroundGroup) {
      // if the item is not in a group:
      height = Math.max(this.parent.height,
          this.parent.itemSet.body.domProps.center.height,
          this.parent.itemSet.body.domProps.centerContainer.height);
      this.dom.box.style.top = onTop ? '0' : '';
      this.dom.box.style.bottom = onTop ? '' : '0';
    }
    else {
      height = this.parent.height;
      // same alignment for items when orientation is top or bottom
      this.dom.box.style.top = this.parent.top + 'px';
      this.dom.box.style.bottom = '';
    }
  }
  this.dom.box.style.height = height + 'px';
};

module.exports = BackgroundItem;

},{"../../../module/hammer":6,"../BackgroundGroup":17,"./Item":27,"./RangeItem":29}],25:[function(require,module,exports){
var Item = require('./Item');
var util = require('../../../util');

/**
 * @constructor BoxItem
 * @extends Item
 * @param {Object} data             Object containing parameters start
 *                                  content, className.
 * @param {{toScreen: function, toTime: function}} conversion
 *                                  Conversion functions from time to screen and vice versa
 * @param {Object} [options]        Configuration options
 *                                  // TODO: describe available options
 */
function BoxItem (data, conversion, options) {
  this.props = {
    dot: {
      width: 0,
      height: 0
    },
    line: {
      width: 0,
      height: 0
    }
  };

  // validate data
  if (data) {
    if (data.start == undefined) {
      throw new Error('Property "start" missing in item ' + data);
    }
  }

  Item.call(this, data, conversion, options);
}

BoxItem.prototype = new Item (null, null, null);

/**
 * Check whether this item is visible inside given range
 * @returns {{start: Number, end: Number}} range with a timestamp for start and end
 * @returns {boolean} True if visible
 */
BoxItem.prototype.isVisible = function(range) {
  // determine visibility
  // TODO: account for the real width of the item. Right now we just add 1/4 to the window
  var interval = (range.end - range.start) / 4;
  return (this.data.start > range.start - interval) && (this.data.start < range.end + interval);
};

/**
 * Repaint the item
 */
BoxItem.prototype.redraw = function() {
  var dom = this.dom;
  if (!dom) {
    // create DOM
    this.dom = {};
    dom = this.dom;

    // create main box
    dom.box = document.createElement('DIV');

    // contents box (inside the background box). used for making margins
    dom.content = document.createElement('DIV');
    dom.content.className = 'content';
    dom.box.appendChild(dom.content);

    // line to axis
    dom.line = document.createElement('DIV');
    dom.line.className = 'line';

    // dot on axis
    dom.dot = document.createElement('DIV');
    dom.dot.className = 'dot';

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
    if (!foreground) throw new Error('Cannot redraw item: parent has no foreground container element');
    foreground.appendChild(dom.box);
  }
  if (!dom.line.parentNode) {
    var background = this.parent.dom.background;
    if (!background) throw new Error('Cannot redraw item: parent has no background container element');
    background.appendChild(dom.line);
  }
  if (!dom.dot.parentNode) {
    var axis = this.parent.dom.axis;
    if (!background) throw new Error('Cannot redraw item: parent has no axis container element');
    axis.appendChild(dom.dot);
  }
  this.displayed = true;

  // Update DOM when item is marked dirty. An item is marked dirty when:
  // - the item is not yet rendered
  // - the item's data is changed
  // - the item is selected/deselected
  if (this.dirty) {
    this._updateContents(this.dom.content);
    this._updateTitle(this.dom.box);
    this._updateDataAttributes(this.dom.box);
    this._updateStyle(this.dom.box);

    // update class
    var className = (this.data.className? ' ' + this.data.className : '') +
        (this.selected ? ' selected' : '');
    dom.box.className = 'item box' + className;
    dom.line.className = 'item line' + className;
    dom.dot.className  = 'item dot' + className;

    // recalculate size
    this.props.dot.height = dom.dot.offsetHeight;
    this.props.dot.width = dom.dot.offsetWidth;
    this.props.line.width = dom.line.offsetWidth;
    this.width = dom.box.offsetWidth;
    this.height = dom.box.offsetHeight;

    this.dirty = false;
  }

  this._repaintDeleteButton(dom.box);
};

/**
 * Show the item in the DOM (when not already displayed). The items DOM will
 * be created when needed.
 */
BoxItem.prototype.show = function() {
  if (!this.displayed) {
    this.redraw();
  }
};

/**
 * Hide the item from the DOM (when visible)
 */
BoxItem.prototype.hide = function() {
  if (this.displayed) {
    var dom = this.dom;

    if (dom.box.parentNode)   dom.box.parentNode.removeChild(dom.box);
    if (dom.line.parentNode)  dom.line.parentNode.removeChild(dom.line);
    if (dom.dot.parentNode)   dom.dot.parentNode.removeChild(dom.dot);

    this.displayed = false;
  }
};

/**
 * Reposition the item horizontally
 * @Override
 */
BoxItem.prototype.repositionX = function() {
  var start = this.conversion.toScreen(this.data.start);
  var align = this.options.align;
  var left;

  // calculate left position of the box
  if (align == 'right') {
    this.left = start - this.width;
  }
  else if (align == 'left') {
    this.left = start;
  }
  else {
    // default or 'center'
    this.left = start - this.width / 2;
  }

  // reposition box
  this.dom.box.style.left = this.left + 'px';

  // reposition line
  this.dom.line.style.left = (start - this.props.line.width / 2) + 'px';

  // reposition dot
  this.dom.dot.style.left = (start - this.props.dot.width / 2) + 'px';
};

/**
 * Reposition the item vertically
 * @Override
 */
BoxItem.prototype.repositionY = function() {
  var orientation = this.options.orientation;
  var box = this.dom.box;
  var line = this.dom.line;
  var dot = this.dom.dot;

  if (orientation == 'top') {
    box.style.top     = (this.top || 0) + 'px';

    line.style.top    = '0';
    line.style.height = (this.parent.top + this.top + 1) + 'px';
    line.style.bottom = '';
  }
  else { // orientation 'bottom'
    var itemSetHeight = this.parent.itemSet.props.height; // TODO: this is nasty
    var lineHeight = itemSetHeight - this.parent.top - this.parent.height + this.top;

    box.style.top     = (this.parent.height - this.top - this.height || 0) + 'px';
    line.style.top    = (itemSetHeight - lineHeight) + 'px';
    line.style.bottom = '0';
  }

  dot.style.top = (-this.props.dot.height / 2) + 'px';
};

module.exports = BoxItem;

},{"../../../util":31,"./Item":27}],26:[function(require,module,exports){
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




},{"../../../module/hammer":6,"../../../util":31,"./Item":27}],27:[function(require,module,exports){
var Hammer = require('../../../module/hammer');
var util = require('../../../util');

/**
 * @constructor Item
 * @param {Object} data             Object containing (optional) parameters type,
 *                                  start, end, content, group, className.
 * @param {{toScreen: function, toTime: function}} conversion
 *                                  Conversion functions from time to screen and vice versa
 * @param {Object} options          Configuration options
 *                                  // TODO: describe available options
 */
function Item (data, conversion, options) {
  this.id = null;
  this.parent = null;
  this.data = data;
  this.dom = null;
  this.conversion = conversion || {};
  this.options = options || {};

  this.selected = false;
  this.displayed = false;
  this.dirty = true;

  this.top = null;
  this.left = null;
  this.width = null;
  this.height = null;
}

Item.prototype.stack = true;

/**
 * Select current item
 */
Item.prototype.select = function() {
  this.selected = true;
  this.dirty = true;
  if (this.displayed) this.redraw();
};

/**
 * Unselect current item
 */
Item.prototype.unselect = function() {
  this.selected = false;
  this.dirty = true;
  if (this.displayed) this.redraw();
};

/**
 * Set data for the item. Existing data will be updated. The id should not
 * be changed. When the item is displayed, it will be redrawn immediately.
 * @param {Object} data
 */
Item.prototype.setData = function(data) {
  this.data = data;
  this.dirty = true;
  if (this.displayed) this.redraw();
};

/**
 * Set a parent for the item
 * @param {ItemSet | Group} parent
 */
Item.prototype.setParent = function(parent) {
  if (this.displayed) {
    this.hide();
    this.parent = parent;
    if (this.parent) {
      this.show();
    }
  }
  else {
    this.parent = parent;
  }
};

/**
 * Check whether this item is visible inside given range
 * @returns {{start: Number, end: Number}} range with a timestamp for start and end
 * @returns {boolean} True if visible
 */
Item.prototype.isVisible = function(range) {
  // Should be implemented by Item implementations
  return false;
};

/**
 * Show the Item in the DOM (when not already visible)
 * @return {Boolean} changed
 */
Item.prototype.show = function() {
  return false;
};

/**
 * Hide the Item from the DOM (when visible)
 * @return {Boolean} changed
 */
Item.prototype.hide = function() {
  return false;
};

/**
 * Repaint the item
 */
Item.prototype.redraw = function() {
  // should be implemented by the item
};

/**
 * Reposition the Item horizontally
 */
Item.prototype.repositionX = function() {
  // should be implemented by the item
};

/**
 * Reposition the Item vertically
 */
Item.prototype.repositionY = function() {
  // should be implemented by the item
};

Item.prototype.getData = function() {
  // should be implemented by the item
};


/**
 * Set HTML contents for the item
 * @param {Element} element   HTML element to fill with the contents
 * @private
 */
Item.prototype._updateContents = function (element) {
  var content;
  if (this.options.template) {
    var itemData = this.parent.itemSet.itemsData.get(this.id); // get a clone of the data from the dataset
    content = this.options.template(itemData);
  }
  else {
    content = this.data.content;
  }

  if(content !== this.content) {
    // only replace the content when changed
    if (content instanceof Element) {
      element.innerHTML = '';
      element.appendChild(content);
    }
    else if (content != undefined) {
      element.innerHTML = content;
    }
    else {
      if (!(this.data.type == 'background' && this.data.content === undefined)) {
        throw new Error('Property "content" missing in item ' + this.id);
      }
    }

    this.content = content;
  }
};

/**
 * Set HTML contents for the item
 * @param {Element} element   HTML element to fill with the contents
 * @private
 */
Item.prototype._updateTitle = function (element) {
  if (this.data.title != null) {
    element.title = this.data.title || '';
  }
  else {
    element.removeAttribute('title');
  }
};

/**
 * Process dataAttributes timeline option and set as data- attributes on dom.content
 * @param {Element} element   HTML element to which the attributes will be attached
 * @private
 */
 Item.prototype._updateDataAttributes = function(element) {
  if (this.options.dataAttributes && this.options.dataAttributes.length > 0) {
    var attributes = [];

    if (Array.isArray(this.options.dataAttributes)) {
      attributes = this.options.dataAttributes;
    }
    else if (this.options.dataAttributes == 'all') {
      attributes = Object.keys(this.data);
    }
    else {
      return;
    }

    for (var i = 0; i < attributes.length; i++) {
      var name = attributes[i];
      var value = this.data[name];

      if (value != null) {
        element.setAttribute('data-' + name, value);
      }
      else {
        element.removeAttribute('data-' + name);
      }
    }
  }
};

/**
 * Update custom styles of the element
 * @param element
 * @private
 */
Item.prototype._updateStyle = function(element) {
  // remove old styles
  if (this.style) {
    util.removeCssText(element, this.style);
    this.style = null;
  }

  // append new styles
  if (this.data.style) {
    util.addCssText(element, this.data.style);
    this.style = this.data.style;
  }
};

module.exports = Item;

},{"../../../module/hammer":6,"../../../util":31}],28:[function(require,module,exports){
var Item = require('./Item');

/**
 * @constructor PointItem
 * @extends Item
 * @param {Object} data             Object containing parameters start
 *                                  content, className.
 * @param {{toScreen: function, toTime: function}} conversion
 *                                  Conversion functions from time to screen and vice versa
 * @param {Object} [options]        Configuration options
 *                                  // TODO: describe available options
 */
function PointItem (data, conversion, options) {
  this.props = {
    dot: {
      top: 0,
      width: 0,
      height: 0
    },
    content: {
      height: 0,
      marginLeft: 0
    }
  };

  // validate data
  if (data) {
    if (data.start == undefined) {
      throw new Error('Property "start" missing in item ' + data);
    }
  }

  Item.call(this, data, conversion, options);
}

PointItem.prototype = new Item (null, null, null);

/**
 * Check whether this item is visible inside given range
 * @returns {{start: Number, end: Number}} range with a timestamp for start and end
 * @returns {boolean} True if visible
 */
PointItem.prototype.isVisible = function(range) {
  // determine visibility
  // TODO: account for the real width of the item. Right now we just add 1/4 to the window
  var interval = (range.end - range.start) / 4;
  return (this.data.start > range.start - interval) && (this.data.start < range.end + interval);
};

/**
 * Repaint the item
 */
PointItem.prototype.redraw = function() {
  var dom = this.dom;
  if (!dom) {
    // create DOM
    this.dom = {};
    dom = this.dom;

    // background box
    dom.point = document.createElement('div');
    // className is updated in redraw()

    // contents box, right from the dot
    dom.content = document.createElement('div');
    dom.content.className = 'content';
    dom.point.appendChild(dom.content);

    // dot at start
    dom.dot = document.createElement('div');
    dom.point.appendChild(dom.dot);

    // attach this item as attribute
    dom.point['timeline-item'] = this;

    this.dirty = true;
  }

  // append DOM to parent DOM
  if (!this.parent) {
    throw new Error('Cannot redraw item: no parent attached');
  }
  if (!dom.point.parentNode) {
    var foreground = this.parent.dom.foreground;
    if (!foreground) {
      throw new Error('Cannot redraw item: parent has no foreground container element');
    }
    foreground.appendChild(dom.point);
  }
  this.displayed = true;

  // Update DOM when item is marked dirty. An item is marked dirty when:
  // - the item is not yet rendered
  // - the item's data is changed
  // - the item is selected/deselected
  if (this.dirty) {
    this._updateContents(this.dom.content);
    this._updateTitle(this.dom.point);
    this._updateDataAttributes(this.dom.point);
    this._updateStyle(this.dom.point);

    // update class
    var className = (this.data.className? ' ' + this.data.className : '') +
        (this.selected ? ' selected' : '');
    dom.point.className  = 'item point' + className;
    dom.dot.className  = 'item dot' + className;

    // recalculate size
    this.width = dom.point.offsetWidth;
    this.height = dom.point.offsetHeight;
    this.props.dot.width = dom.dot.offsetWidth;
    this.props.dot.height = dom.dot.offsetHeight;
    this.props.content.height = dom.content.offsetHeight;

    // resize contents
    dom.content.style.marginLeft = 2 * this.props.dot.width + 'px';
    //dom.content.style.marginRight = ... + 'px'; // TODO: margin right

    dom.dot.style.top = ((this.height - this.props.dot.height) / 2) + 'px';
    dom.dot.style.left = (this.props.dot.width / 2) + 'px';

    this.dirty = false;
  }

  this._repaintDeleteButton(dom.point);
};

/**
 * Show the item in the DOM (when not already visible). The items DOM will
 * be created when needed.
 */
PointItem.prototype.show = function() {
  if (!this.displayed) {
    this.redraw();
  }
};

/**
 * Hide the item from the DOM (when visible)
 */
PointItem.prototype.hide = function() {
  if (this.displayed) {
    if (this.dom.point.parentNode) {
      this.dom.point.parentNode.removeChild(this.dom.point);
    }

    this.displayed = false;
  }
};

/**
 * Reposition the item horizontally
 * @Override
 */
PointItem.prototype.repositionX = function() {
  var start = this.conversion.toScreen(this.data.start);

  this.left = start - this.props.dot.width;

  // reposition point
  this.dom.point.style.left = this.left + 'px';
};

/**
 * Reposition the item vertically
 * @Override
 */
PointItem.prototype.repositionY = function() {
  var orientation = this.options.orientation,
      point = this.dom.point;

  if (orientation == 'top') {
    point.style.top = this.top + 'px';
  }
  else {
    point.style.top = (this.parent.height - this.top - this.height) + 'px';
  }
};

module.exports = PointItem;

},{"./Item":27}],29:[function(require,module,exports){
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
},{"../../../module/hammer":6,"../../../util":31,"../../Core":9,"./Item":27}],30:[function(require,module,exports){
// English
exports['en'] = {
  current: 'current',
  time: 'time'
};
exports['en_EN'] = exports['en'];
exports['en_US'] = exports['en'];

// Dutch
exports['nl'] = {
  custom: 'aangepaste',
  time: 'tijd'
};
exports['nl_NL'] = exports['nl'];
exports['nl_BE'] = exports['nl'];

},{}],31:[function(require,module,exports){
// utility functions

// first check if moment.js is already loaded in the browser window, if so,
// use this instance. Else, load via commonjs.
var moment = require('./module/moment');

/**
 * Test whether given object is a number
 * @param {*} object
 * @return {Boolean} isNumber
 */



exports.categoriesPlaces = null;

exports.categoriesColors = null;

exports.locationNames = [];
//exports.categoriesPlaces = {};
//exports.categoriesColors = {};
exports.placesColors = {};

exports.isNumber = function(object) {
  return (object instanceof Number || typeof object == 'number');
};


/**
 * this function gives you a range between 0 and 1 based on the min and max values in the set, the total sum of all values and the current value.
 *
 * @param min
 * @param max
 * @param total
 * @param value
 * @returns {number}
 */
exports.giveRange = function(min,max,total,value) {
  if (max == min) {
    return 0.5;
  }
  else {
    var scale = 1 / (max - min);
    return Math.max(0,(value - min)*scale);
  }
}

/**
 * Test whether given object is a string
 * @param {*} object
 * @return {Boolean} isString
 */
exports.isString = function(object) {
  return (object instanceof String || typeof object == 'string');
};

/**
 * Test whether given object is a Date, or a String containing a Date
 * @param {Date | String} object
 * @return {Boolean} isDate
 */
exports.isDate = function(object) {
  if (object instanceof Date) {
    return true;
  }
  else if (exports.isString(object)) {
    // test whether this string contains a date
    var match = ASPDateRegex.exec(object);
    if (match) {
      return true;
    }
    else if (!isNaN(Date.parse(object))) {
      return true;
    }
  }

  return false;
};

/**
 * Test whether given object is an instance of google.visualization.DataTable
 * @param {*} object
 * @return {Boolean} isDataTable
 */
exports.isDataTable = function(object) {
  return (typeof (google) !== 'undefined') &&
      (google.visualization) &&
      (google.visualization.DataTable) &&
      (object instanceof google.visualization.DataTable);
};

/**
 * Create a semi UUID
 * source: http://stackoverflow.com/a/105074/1262753
 * @return {String} uuid
 */
exports.randomUUID = function() {
  var S4 = function () {
    return Math.floor(
        Math.random() * 0x10000 /* 65536 */
    ).toString(16);
  };

  return (
      S4() + S4() + '-' +
          S4() + '-' +
          S4() + '-' +
          S4() + '-' +
          S4() + S4() + S4()
      );
};

/**
 * Extend object a with the properties of object b or a series of objects
 * Only properties with defined values are copied
 * @param {Object} a
 * @param {... Object} b
 * @return {Object} a
 */
exports.extend = function (a, b) {
  for (var i = 1, len = arguments.length; i < len; i++) {
    var other = arguments[i];
    for (var prop in other) {
      if (other.hasOwnProperty(prop)) {
        a[prop] = other[prop];
      }
    }
  }

  return a;
};

/**
 * Extend object a with selected properties of object b or a series of objects
 * Only properties with defined values are copied
 * @param {Array.<String>} props
 * @param {Object} a
 * @param {... Object} b
 * @return {Object} a
 */
exports.selectiveExtend = function (props, a, b) {
  if (!Array.isArray(props)) {
    throw new Error('Array with property names expected as first argument');
  }

  for (var i = 2; i < arguments.length; i++) {
    var other = arguments[i];

    for (var p = 0; p < props.length; p++) {
      var prop = props[p];
      if (other.hasOwnProperty(prop)) {
        a[prop] = other[prop];
      }
    }
  }
  return a;
};

/**
 * Extend object a with selected properties of object b or a series of objects
 * Only properties with defined values are copied
 * @param {Array.<String>} props
 * @param {Object} a
 * @param {... Object} b
 * @return {Object} a
 */
exports.selectiveDeepExtend = function (props, a, b) {
  // TODO: add support for Arrays to deepExtend
  if (Array.isArray(b)) {
    throw new TypeError('Arrays are not supported by deepExtend');
  }
  for (var i = 2; i < arguments.length; i++) {
    var other = arguments[i];
    for (var p = 0; p < props.length; p++) {
      var prop = props[p];
      if (other.hasOwnProperty(prop)) {
        if (b[prop] && b[prop].constructor === Object) {
          if (a[prop] === undefined) {
            a[prop] = {};
          }
          if (a[prop].constructor === Object) {
            exports.deepExtend(a[prop], b[prop]);
          }
          else {
            a[prop] = b[prop];
          }
        } else if (Array.isArray(b[prop])) {
          throw new TypeError('Arrays are not supported by deepExtend');
        } else {
          a[prop] = b[prop];
        }

      }
    }
  }
  return a;
};

/**
 * Extend object a with selected properties of object b or a series of objects
 * Only properties with defined values are copied
 * @param {Array.<String>} props
 * @param {Object} a
 * @param {... Object} b
 * @return {Object} a
 */
exports.selectiveNotDeepExtend = function (props, a, b) {
  // TODO: add support for Arrays to deepExtend
  if (Array.isArray(b)) {
    throw new TypeError('Arrays are not supported by deepExtend');
  }
  for (var prop in b) {
    if (b.hasOwnProperty(prop)) {
      if (props.indexOf(prop) == -1) {
        if (b[prop] && b[prop].constructor === Object) {
          if (a[prop] === undefined) {
            a[prop] = {};
          }
          if (a[prop].constructor === Object) {
            exports.deepExtend(a[prop], b[prop]);
          }
          else {
            a[prop] = b[prop];
          }
        } else if (Array.isArray(b[prop])) {
          throw new TypeError('Arrays are not supported by deepExtend');
        } else {
          a[prop] = b[prop];
        }
      }
    }
  }
  return a;
};

/**
 * Deep extend an object a with the properties of object b
 * @param {Object} a
 * @param {Object} b
 * @returns {Object}
 */
exports.deepExtend = function(a, b) {
  // TODO: add support for Arrays to deepExtend
  if (Array.isArray(b)) {
    throw new TypeError('Arrays are not supported by deepExtend');
  }

  for (var prop in b) {
    if (b.hasOwnProperty(prop)) {
      if (b[prop] && b[prop].constructor === Object) {
        if (a[prop] === undefined) {
          a[prop] = {};
        }
        if (a[prop].constructor === Object) {
          exports.deepExtend(a[prop], b[prop]);
        }
        else {
          a[prop] = b[prop];
        }
      } else if (Array.isArray(b[prop])) {
        throw new TypeError('Arrays are not supported by deepExtend');
      } else {
        a[prop] = b[prop];
      }
    }
  }
  return a;
};

/**
 * Test whether all elements in two arrays are equal.
 * @param {Array} a
 * @param {Array} b
 * @return {boolean} Returns true if both arrays have the same length and same
 *                   elements.
 */
exports.equalArray = function (a, b) {
  if (a.length != b.length) return false;

  for (var i = 0, len = a.length; i < len; i++) {
    if (a[i] != b[i]) return false;
  }

  return true;
};

/**
 * Convert an object to another type
 * @param {Boolean | Number | String | Date | Moment | Null | undefined} object
 * @param {String | undefined} type   Name of the type. Available types:
 *                                    'Boolean', 'Number', 'String',
 *                                    'Date', 'Moment', ISODate', 'ASPDate'.
 * @return {*} object
 * @throws Error
 */
exports.convert = function(object, type) {
  var match;

  if (object === undefined) {
    return undefined;
  }
  if (object === null) {
    return null;
  }

  if (!type) {
    return object;
  }
  if (!(typeof type === 'string') && !(type instanceof String)) {
    throw new Error('Type must be a string');
  }

  //noinspection FallthroughInSwitchStatementJS
  switch (type) {
    case 'boolean':
    case 'Boolean':
      return Boolean(object);

    case 'number':
    case 'Number':
      return Number(object.valueOf());

    case 'string':
    case 'String':
      return String(object);

    case 'Date':
      if (exports.isNumber(object)) {
        return new Date(object);
      }
      if (object instanceof Date) {
        return new Date(object.valueOf());
      }
      else if (moment.isMoment(object)) {
        return new Date(object.valueOf());
      }
      if (exports.isString(object)) {
        match = ASPDateRegex.exec(object);
        if (match) {
          // object is an ASP date
          return new Date(Number(match[1])); // parse number
        }
        else {
          return moment(object).toDate(); // parse string
        }
      }
      else {
        throw new Error(
            'Cannot convert object of type ' + exports.getType(object) +
                ' to type Date');
      }

    case 'Moment':
      if (exports.isNumber(object)) {
        return moment(object);
      }
      if (object instanceof Date) {
        return moment(object.valueOf());
      }
      else if (moment.isMoment(object)) {
        return moment(object);
      }
      if (exports.isString(object)) {
        match = ASPDateRegex.exec(object);
        if (match) {
          // object is an ASP date
          return moment(Number(match[1])); // parse number
        }
        else {
          return moment(object); // parse string
        }
      }
      else {
        throw new Error(
            'Cannot convert object of type ' + exports.getType(object) +
                ' to type Date');
      }

    case 'ISODate':
      if (exports.isNumber(object)) {
        return new Date(object);
      }
      else if (object instanceof Date) {
        return object.toISOString();
      }
      else if (moment.isMoment(object)) {
        return object.toDate().toISOString();
      }
      else if (exports.isString(object)) {
        match = ASPDateRegex.exec(object);
        if (match) {
          // object is an ASP date
          return new Date(Number(match[1])).toISOString(); // parse number
        }
        else {
          return new Date(object).toISOString(); // parse string
        }
      }
      else {
        throw new Error(
            'Cannot convert object of type ' + exports.getType(object) +
                ' to type ISODate');
      }

    case 'ASPDate':
      if (exports.isNumber(object)) {
        return '/Date(' + object + ')/';
      }
      else if (object instanceof Date) {
        return '/Date(' + object.valueOf() + ')/';
      }
      else if (exports.isString(object)) {
        match = ASPDateRegex.exec(object);
        var value;
        if (match) {
          // object is an ASP date
          value = new Date(Number(match[1])).valueOf(); // parse number
        }
        else {
          value = new Date(object).valueOf(); // parse string
        }
        return '/Date(' + value + ')/';
      }
      else {
        throw new Error(
            'Cannot convert object of type ' + exports.getType(object) +
                ' to type ASPDate');
      }

    default:
      throw new Error('Unknown type "' + type + '"');
  }
};

// parse ASP.Net Date pattern,
// for example '/Date(1198908717056)/' or '/Date(1198908717056-0700)/'
// code from http://momentjs.com/
var ASPDateRegex = /^\/?Date\((\-?\d+)/i;

/**
 * Get the type of an object, for example exports.getType([]) returns 'Array'
 * @param {*} object
 * @return {String} type
 */
exports.getType = function(object) {
  var type = typeof object;

  if (type == 'object') {
    if (object == null) {
      return 'null';
    }
    if (object instanceof Boolean) {
      return 'Boolean';
    }
    if (object instanceof Number) {
      return 'Number';
    }
    if (object instanceof String) {
      return 'String';
    }
    if (Array.isArray(object)) {
      return 'Array';
    }
    if (object instanceof Date) {
      return 'Date';
    }
    return 'Object';
  }
  else if (type == 'number') {
    return 'Number';
  }
  else if (type == 'boolean') {
    return 'Boolean';
  }
  else if (type == 'string') {
    return 'String';
  }

  return type;
};

/**
 * Retrieve the absolute left value of a DOM element
 * @param {Element} elem        A dom element, for example a div
 * @return {number} left        The absolute left position of this element
 *                              in the browser page.
 */
exports.getAbsoluteLeft = function(elem) {
  return elem.getBoundingClientRect().left + window.pageXOffset;
};

/**
 * Retrieve the absolute top value of a DOM element
 * @param {Element} elem        A dom element, for example a div
 * @return {number} top        The absolute top position of this element
 *                              in the browser page.
 */
exports.getAbsoluteTop = function(elem) {
  return elem.getBoundingClientRect().top + window.pageYOffset;
};

/**
 * add a className to the given elements style
 * @param {Element} elem
 * @param {String} className
 */
exports.addClassName = function(elem, className) {
  var classes = elem.className.split(' ');
  if (classes.indexOf(className) == -1) {
    classes.push(className); // add the class to the array
    elem.className = classes.join(' ');
  }
};

/**
 * add a className to the given elements style
 * @param {Element} elem
 * @param {String} className
 */
exports.removeClassName = function(elem, className) {
  var classes = elem.className.split(' ');
  var index = classes.indexOf(className);
  if (index != -1) {
    classes.splice(index, 1); // remove the class from the array
    elem.className = classes.join(' ');
  }
};

/**
 * For each method for both arrays and objects.
 * In case of an array, the built-in Array.forEach() is applied.
 * In case of an Object, the method loops over all properties of the object.
 * @param {Object | Array} object   An Object or Array
 * @param {function} callback       Callback method, called for each item in
 *                                  the object or array with three parameters:
 *                                  callback(value, index, object)
 */
exports.forEach = function(object, callback) {
  var i,
      len;
  if (Array.isArray(object)) {
    // array
    for (i = 0, len = object.length; i < len; i++) {
      callback(object[i], i, object);
    }
  }
  else {
    // object
    for (i in object) {
      if (object.hasOwnProperty(i)) {
        callback(object[i], i, object);
      }
    }
  }
};

/**
 * Convert an object into an array: all objects properties are put into the
 * array. The resulting array is unordered.
 * @param {Object} object
 * @param {Array} array
 */
exports.toArray = function(object) {
  var array = [];

  for (var prop in object) {
    if (object.hasOwnProperty(prop)) array.push(object[prop]);
  }

  return array;
}

/**
 * Update a property in an object
 * @param {Object} object
 * @param {String} key
 * @param {*} value
 * @return {Boolean} changed
 */
exports.updateProperty = function(object, key, value) {
  if (object[key] !== value) {
    object[key] = value;
    return true;
  }
  else {
    return false;
  }
};

/**
 * Add and event listener. Works for all browsers
 * @param {Element}     element    An html element
 * @param {string}      action     The action, for example "click",
 *                                 without the prefix "on"
 * @param {function}    listener   The callback function to be executed
 * @param {boolean}     [useCapture]
 */
exports.addEventListener = function(element, action, listener, useCapture) {
  if (element.addEventListener) {
    if (useCapture === undefined)
      useCapture = false;

    if (action === "mousewheel" && navigator.userAgent.indexOf("Firefox") >= 0) {
      action = "DOMMouseScroll";  // For Firefox
    }

    element.addEventListener(action, listener, useCapture);
  } else {
    element.attachEvent("on" + action, listener);  // IE browsers
  }
};

/**
 * Remove an event listener from an element
 * @param {Element}     element         An html dom element
 * @param {string}      action          The name of the event, for example "mousedown"
 * @param {function}    listener        The listener function
 * @param {boolean}     [useCapture]
 */
exports.removeEventListener = function(element, action, listener, useCapture) {
  if (element.removeEventListener) {
    // non-IE browsers
    if (useCapture === undefined)
      useCapture = false;

    if (action === "mousewheel" && navigator.userAgent.indexOf("Firefox") >= 0) {
      action = "DOMMouseScroll";  // For Firefox
    }

    element.removeEventListener(action, listener, useCapture);
  } else {
    // IE browsers
    element.detachEvent("on" + action, listener);
  }
};

/**
 * Cancels the event if it is cancelable, without stopping further propagation of the event.
 */
exports.preventDefault = function (event) {
  if (!event)
    event = window.event;

  if (event.preventDefault) {
    event.preventDefault();  // non-IE browsers
  }
  else {
    event.returnValue = false;  // IE browsers
  }
};

/**
 * Get HTML element which is the target of the event
 * @param {Event} event
 * @return {Element} target element
 */
exports.getTarget = function(event) {
  // code from http://www.quirksmode.org/js/events_properties.html
  if (!event) {
    event = window.event;
  }

  var target;

  if (event.target) {
    target = event.target;
  }
  else if (event.srcElement) {
    target = event.srcElement;
  }

  if (target.nodeType != undefined && target.nodeType == 3) {
    // defeat Safari bug
    target = target.parentNode;
  }

  return target;
};

/**
 * Check if given element contains given parent somewhere in the DOM tree
 * @param {Element} element
 * @param {Element} parent
 */
exports.hasParent = function (element, parent) {
  var e = element;

  while (e) {
    if (e === parent) {
      return true;
    }
    e = e.parentNode;
  }

  return false;
};

exports.option = {};

/**
 * Convert a value into a boolean
 * @param {Boolean | function | undefined} value
 * @param {Boolean} [defaultValue]
 * @returns {Boolean} bool
 */
exports.option.asBoolean = function (value, defaultValue) {
  if (typeof value == 'function') {
    value = value();
  }

  if (value != null) {
    return (value != false);
  }

  return defaultValue || null;
};

/**
 * Convert a value into a number
 * @param {Boolean | function | undefined} value
 * @param {Number} [defaultValue]
 * @returns {Number} number
 */
exports.option.asNumber = function (value, defaultValue) {
  if (typeof value == 'function') {
    value = value();
  }

  if (value != null) {
    return Number(value) || defaultValue || null;
  }

  return defaultValue || null;
};

/**
 * Convert a value into a string
 * @param {String | function | undefined} value
 * @param {String} [defaultValue]
 * @returns {String} str
 */
exports.option.asString = function (value, defaultValue) {
  if (typeof value == 'function') {
    value = value();
  }

  if (value != null) {
    return String(value);
  }

  return defaultValue || null;
};

/**
 * Convert a size or location into a string with pixels or a percentage
 * @param {String | Number | function | undefined} value
 * @param {String} [defaultValue]
 * @returns {String} size
 */
exports.option.asSize = function (value, defaultValue) {
  if (typeof value == 'function') {
    value = value();
  }

  if (exports.isString(value)) {
    return value;
  }
  else if (exports.isNumber(value)) {
    return value + 'px';
  }
  else {
    return defaultValue || null;
  }
};

/**
 * Convert a value into a DOM element
 * @param {HTMLElement | function | undefined} value
 * @param {HTMLElement} [defaultValue]
 * @returns {HTMLElement | null} dom
 */
exports.option.asElement = function (value, defaultValue) {
  if (typeof value == 'function') {
    value = value();
  }

  return value || defaultValue || null;
};

/**
 * http://stackoverflow.com/questions/5623838/rgb-to-hex-and-hex-to-rgb
 *
 * @param {String} hex
 * @returns {{r: *, g: *, b: *}} | 255 range
 */
exports.hexToRGB = function(hex) {
  // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
  var shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  hex = hex.replace(shorthandRegex, function(m, r, g, b) {
      return r + r + g + g + b + b;
  });
  var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
  } : null;
};

/**
 * This function takes color in hex format or rgb() or rgba() format and overrides the opacity. Returns rgba() string.
 * @param color
 * @param opacity
 * @returns {*}
 */
exports.overrideOpacity = function(color,opacity) {
  if (color.indexOf("rgb") != -1) {
    var rgb = color.substr(color.indexOf("(")+1).replace(")","").split(",");
    return "rgba(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + "," + opacity + ")"
  }
  else {
    var rgb = exports.hexToRGB(color);
    if (rgb == null) {
      return color;
    }
    else {
      return "rgba(" + rgb.r + "," + rgb.g + "," + rgb.b + "," + opacity + ")"
    }
  }
}

/**
 *
 * @param red     0 -- 255
 * @param green   0 -- 255
 * @param blue    0 -- 255
 * @returns {string}
 * @constructor
 */
exports.RGBToHex = function(red,green,blue) {
  return "#" + ((1 << 24) + (red << 16) + (green << 8) + blue).toString(16).slice(1);
};

/**
 * Parse a color property into an object with border, background, and
 * highlight colors
 * @param {Object | String} color
 * @return {Object} colorObject
 */
exports.parseColor = function(color) {
  var c;
  if (exports.isString(color)) {
    if (exports.isValidRGB(color)) {
      var rgb = color.substr(4).substr(0,color.length-5).split(',');
      color = exports.RGBToHex(rgb[0],rgb[1],rgb[2]);
    }
    if (exports.isValidHex(color)) {
      var hsv = exports.hexToHSV(color);
      var lighterColorHSV = {h:hsv.h,s:hsv.s * 0.45,v:Math.min(1,hsv.v * 1.05)};
      var darkerColorHSV  = {h:hsv.h,s:Math.min(1,hsv.v * 1.25),v:hsv.v*0.6};
      var darkerColorHex  = exports.HSVToHex(darkerColorHSV.h ,darkerColorHSV.h ,darkerColorHSV.v);
      var lighterColorHex = exports.HSVToHex(lighterColorHSV.h,lighterColorHSV.s,lighterColorHSV.v);

      c = {
        background: color,
        border:darkerColorHex,
        highlight: {
          background:lighterColorHex,
          border:darkerColorHex
        },
        hover: {
          background:lighterColorHex,
          border:darkerColorHex
        }
      };
    }
    else {
      c = {
        background:color,
        border:color,
        highlight: {
          background:color,
          border:color
        },
        hover: {
          background:color,
          border:color
        }
      };
    }
  }
  else {
    c = {};
    c.background = color.background || 'white';
    c.border = color.border || c.background;

    if (exports.isString(color.highlight)) {
      c.highlight = {
        border: color.highlight,
        background: color.highlight
      }
    }
    else {
      c.highlight = {};
      c.highlight.background = color.highlight && color.highlight.background || c.background;
      c.highlight.border = color.highlight && color.highlight.border || c.border;
    }

    if (exports.isString(color.hover)) {
      c.hover = {
        border: color.hover,
        background: color.hover
      }
    }
    else {
      c.hover = {};
      c.hover.background = color.hover && color.hover.background || c.background;
      c.hover.border = color.hover && color.hover.border || c.border;
    }
  }

  return c;
};

/**
 * http://www.javascripter.net/faq/rgb2hsv.htm
 *
 * @param red
 * @param green
 * @param blue
 * @returns {*}
 * @constructor
 */
exports.RGBToHSV = function(red,green,blue) {
  red=red/255; green=green/255; blue=blue/255;
  var minRGB = Math.min(red,Math.min(green,blue));
  var maxRGB = Math.max(red,Math.max(green,blue));

  // Black-gray-white
  if (minRGB == maxRGB) {
    return {h:0,s:0,v:minRGB};
  }

  // Colors other than black-gray-white:
  var d = (red==minRGB) ? green-blue : ((blue==minRGB) ? red-green : blue-red);
  var h = (red==minRGB) ? 3 : ((blue==minRGB) ? 1 : 5);
  var hue = 60*(h - d/(maxRGB - minRGB))/360;
  var saturation = (maxRGB - minRGB)/maxRGB;
  var value = maxRGB;
  return {h:hue,s:saturation,v:value};
};

var cssUtil = {
  // split a string with css styles into an object with key/values
  split: function (cssText) {
    var styles = {};

    cssText.split(';').forEach(function (style) {
      if (style.trim() != '') {
        var parts = style.split(':');
        var key = parts[0].trim();
        var value = parts[1].trim();
        styles[key] = value;
      }
    });

    return styles;
  },

  // build a css text string from an object with key/values
  join: function (styles) {
    return Object.keys(styles)
        .map(function (key) {
          return key + ': ' + styles[key];
        })
        .join('; ');
  }
};

/**
 * Append a string with css styles to an element
 * @param {Element} element
 * @param {String} cssText
 */
exports.addCssText = function (element, cssText) {
  var currentStyles = cssUtil.split(element.style.cssText);
  var newStyles = cssUtil.split(cssText);
  var styles = exports.extend(currentStyles, newStyles);

  element.style.cssText = cssUtil.join(styles);
};

/**
 * Remove a string with css styles from an element
 * @param {Element} element
 * @param {String} cssText
 */
exports.removeCssText = function (element, cssText) {
  var styles = cssUtil.split(element.style.cssText);
  var removeStyles = cssUtil.split(cssText);

  for (var key in removeStyles) {
    if (removeStyles.hasOwnProperty(key)) {
      delete styles[key];
    }
  }

  element.style.cssText = cssUtil.join(styles);
};

/**
 * https://gist.github.com/mjijackson/5311256
 * @param h
 * @param s
 * @param v
 * @returns {{r: number, g: number, b: number}}
 * @constructor
 */
exports.HSVToRGB = function(h, s, v) {
  var r, g, b;

  var i = Math.floor(h * 6);
  var f = h * 6 - i;
  var p = v * (1 - s);
  var q = v * (1 - f * s);
  var t = v * (1 - (1 - f) * s);

  switch (i % 6) {
    case 0: r = v, g = t, b = p; break;
    case 1: r = q, g = v, b = p; break;
    case 2: r = p, g = v, b = t; break;
    case 3: r = p, g = q, b = v; break;
    case 4: r = t, g = p, b = v; break;
    case 5: r = v, g = p, b = q; break;
  }

  return {r:Math.floor(r * 255), g:Math.floor(g * 255), b:Math.floor(b * 255) };
};

exports.HSVToHex = function(h, s, v) {
  var rgb = exports.HSVToRGB(h, s, v);
  return exports.RGBToHex(rgb.r, rgb.g, rgb.b);
};

exports.hexToHSV = function(hex) {
  var rgb = exports.hexToRGB(hex);
  return exports.RGBToHSV(rgb.r, rgb.g, rgb.b);
};

exports.isValidHex = function(hex) {
  var isOk = /(^#[0-9A-F]{6}$)|(^#[0-9A-F]{3}$)/i.test(hex);
  return isOk;
};

exports.isValidRGB = function(rgb) {
  rgb = rgb.replace(" ","");
  var isOk = /rgb\((\d{1,3}),(\d{1,3}),(\d{1,3})\)/i.test(rgb);
  return isOk;
}

/**
 * This recursively redirects the prototype of JSON objects to the referenceObject
 * This is used for default options.
 *
 * @param referenceObject
 * @returns {*}
 */
exports.selectiveBridgeObject = function(fields, referenceObject) {
  if (typeof referenceObject == "object") {
    var objectTo = Object.create(referenceObject);
    for (var i = 0; i < fields.length; i++) {
      if (referenceObject.hasOwnProperty(fields[i])) {
        if (typeof referenceObject[fields[i]] == "object") {
          objectTo[fields[i]] = exports.bridgeObject(referenceObject[fields[i]]);
        }
      }
    }
    return objectTo;
  }
  else {
    return null;
  }
};

/**
 * This recursively redirects the prototype of JSON objects to the referenceObject
 * This is used for default options.
 *
 * @param referenceObject
 * @returns {*}
 */
exports.bridgeObject = function(referenceObject) {
  if (typeof referenceObject == "object") {
    var objectTo = Object.create(referenceObject);
    for (var i in referenceObject) {
      if (referenceObject.hasOwnProperty(i)) {
        if (typeof referenceObject[i] == "object") {
          objectTo[i] = exports.bridgeObject(referenceObject[i]);
        }
      }
    }
    return objectTo;
  }
  else {
    return null;
  }
};


/**
 * this is used to set the options of subobjects in the options object. A requirement of these subobjects
 * is that they have an 'enabled' element which is optional for the user but mandatory for the program.
 *
 * @param [object] mergeTarget | this is either this.options or the options used for the groups.
 * @param [object] options     | options
 * @param [String] option      | this is the option key in the options argument
 * @private
 */
exports.mergeOptions = function (mergeTarget, options, option) {
  if (options[option] !== undefined) {
    if (typeof options[option] == 'boolean') {
      mergeTarget[option].enabled = options[option];
    }
    else {
      mergeTarget[option].enabled = true;
      for (var prop in options[option]) {
        if (options[option].hasOwnProperty(prop)) {
          mergeTarget[option][prop] = options[option][prop];
        }
      }
    }
  }
}


/**
 * This function does a binary search for a visible item in a sorted list. If we find a visible item, the code that uses
 * this function will then iterate in both directions over this sorted list to find all visible items.
 *
 * @param {Item[]} orderedItems       | Items ordered by start
 * @param {function} searchFunction   | -1 is lower, 0 is found, 1 is higher
 * @param {String} field
 * @param {String} field2
 * @returns {number}
 * @private
 */
exports.binarySearchCustom = function(orderedItems, searchFunction, field, field2) {
  var maxIterations = 10000;
  var iteration = 0;
  var low = 0;
  var high = orderedItems.length - 1;

  while (low <= high && iteration < maxIterations) {
    var middle = Math.floor((low + high) / 2);

    var item = orderedItems[middle];
    var value = (field2 === undefined) ? item[field] : item[field][field2];

    var searchResult = searchFunction(value);
    if (searchResult == 0) { // jihaa, found a visible item!
      return middle;
    }
    else if (searchResult == -1) {  // it is too small --> increase low
      low = middle + 1;
    }
    else {  // it is too big --> decrease high
      high = middle - 1;
    }

    iteration++;
  }

  return -1;
};

/**
 * This function does a binary search for a specific value in a sorted array. If it does not exist but is in between of
 * two values, we return either the one before or the one after, depending on user input
 * If it is found, we return the index, else -1.
 *
 * @param {Array} orderedItems
 * @param {{start: number, end: number}} target
 * @param {String} field
 * @param {String} sidePreference   'before' or 'after'
 * @returns {number}
 * @private
 */
exports.binarySearchValue = function(orderedItems, target, field, sidePreference) {
  var maxIterations = 10000;
  var iteration = 0;
  var low = 0;
  var high = orderedItems.length - 1;
  var prevValue, value, nextValue, middle;

  while (low <= high && iteration < maxIterations) {
    // get a new guess
    middle = Math.floor(0.5*(high+low));
    prevValue = orderedItems[Math.max(0,middle - 1)][field];
    value     = orderedItems[middle][field];
    nextValue = orderedItems[Math.min(orderedItems.length-1,middle + 1)][field];

    if (value == target) { // we found the target
      return middle;
    }
    else if (prevValue < target && value > target) {  // target is in between of the previous and the current
      return sidePreference == 'before' ? Math.max(0,middle - 1) : middle;
    }
    else if (value < target && nextValue > target) { // target is in between of the current and the next
      return sidePreference == 'before' ? middle : Math.min(orderedItems.length-1,middle + 1);
    }
    else {  // didnt find the target, we need to change our boundaries.
      if (value < target) { // it is too small --> increase low
        low = middle + 1;
      }
      else {  // it is too big --> decrease high
        high = middle - 1;
      }
    }
    iteration++;
  }

  // didnt find anything. Return -1.
  return -1;
};

/**
 * Quadratic ease-in-out
 * http://gizma.com/easing/
 * @param {number} t        Current time
 * @param {number} start    Start value
 * @param {number} end      End value
 * @param {number} duration Duration
 * @returns {number} Value corresponding with current time
 */
exports.easeInOutQuad = function (t, start, end, duration) {
  var change = end - start;
  t /= duration/2;
  if (t < 1) return change/2*t*t + start;
  t--;
  return -change/2 * (t*(t-2) - 1) + start;
};

exports.verifyHours = function(string){
  var patt = /^(2[0-3]|[01]?[0-9]):([0-5]?[0-9])$/;
  return patt.test(string);
 };

exports.verifyDuration = function(string){
  var patt = /((\d{1,2})h)?(([0-5]?[0-9])m)+|((\d{1,2})h)+(([0-5]?[0-9])m)?/;
  return patt.test(string);
 };

exports.verifyRange = function(string){
var x = parseInt(string.match(/\d+/)[0]);
if (x > 0) return true;
else {return false;}
 };

/*
 * Easing Functions - inspired from http://gizma.com/easing/
 * only considering the t value for the range [0, 1] => [0, 1]
 * https://gist.github.com/gre/1650294
 */
exports.easingFunctions = {
  // no easing, no acceleration
  linear: function (t) {
    return t
  },
  // accelerating from zero velocity
  easeInQuad: function (t) {
    return t * t
  },
  // decelerating to zero velocity
  easeOutQuad: function (t) {
    return t * (2 - t)
  },
  // acceleration until halfway, then deceleration
  easeInOutQuad: function (t) {
    return t < .5 ? 2 * t * t : -1 + (4 - 2 * t) * t
  },
  // accelerating from zero velocity
  easeInCubic: function (t) {
    return t * t * t
  },
  // decelerating to zero velocity
  easeOutCubic: function (t) {
    return (--t) * t * t + 1
  },
  // acceleration until halfway, then deceleration
  easeInOutCubic: function (t) {
    return t < .5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1
  },
  // accelerating from zero velocity
  easeInQuart: function (t) {
    return t * t * t * t
  },
  // decelerating to zero velocity
  easeOutQuart: function (t) {
    return 1 - (--t) * t * t * t
  },
  // acceleration until halfway, then deceleration
  easeInOutQuart: function (t) {
    return t < .5 ? 8 * t * t * t * t : 1 - 8 * (--t) * t * t * t
  },
  // accelerating from zero velocity
  easeInQuint: function (t) {
    return t * t * t * t * t
  },
  // decelerating to zero velocity
  easeOutQuint: function (t) {
    return 1 + (--t) * t * t * t * t
  },
  // acceleration until halfway, then deceleration
  easeInOutQuint: function (t) {
    return t < .5 ? 16 * t * t * t * t * t : 1 + 16 * (--t) * t * t * t * t
  }
};
},{"./module/moment":7}],32:[function(require,module,exports){

/**
 * Expose `Emitter`.
 */

module.exports = Emitter;

/**
 * Initialize a new `Emitter`.
 *
 * @api public
 */

function Emitter(obj) {
  if (obj) return mixin(obj);
};

/**
 * Mixin the emitter properties.
 *
 * @param {Object} obj
 * @return {Object}
 * @api private
 */

function mixin(obj) {
  for (var key in Emitter.prototype) {
    obj[key] = Emitter.prototype[key];
  }
  return obj;
}

/**
 * Listen on the given `event` with `fn`.
 *
 * @param {String} event
 * @param {Function} fn
 * @return {Emitter}
 * @api public
 */

Emitter.prototype.on =
Emitter.prototype.addEventListener = function(event, fn){
  this._callbacks = this._callbacks || {};
  (this._callbacks[event] = this._callbacks[event] || [])
    .push(fn);
  return this;
};

/**
 * Adds an `event` listener that will be invoked a single
 * time then automatically removed.
 *
 * @param {String} event
 * @param {Function} fn
 * @return {Emitter}
 * @api public
 */

Emitter.prototype.once = function(event, fn){
  var self = this;
  this._callbacks = this._callbacks || {};

  function on() {
    self.off(event, on);
    fn.apply(this, arguments);
  }

  on.fn = fn;
  this.on(event, on);
  return this;
};

/**
 * Remove the given callback for `event` or all
 * registered callbacks.
 *
 * @param {String} event
 * @param {Function} fn
 * @return {Emitter}
 * @api public
 */

Emitter.prototype.off =
Emitter.prototype.removeListener =
Emitter.prototype.removeAllListeners =
Emitter.prototype.removeEventListener = function(event, fn){
  this._callbacks = this._callbacks || {};

  // all
  if (0 == arguments.length) {
    this._callbacks = {};
    return this;
  }

  // specific event
  var callbacks = this._callbacks[event];
  if (!callbacks) return this;

  // remove all handlers
  if (1 == arguments.length) {
    delete this._callbacks[event];
    return this;
  }

  // remove specific handler
  var cb;
  for (var i = 0; i < callbacks.length; i++) {
    cb = callbacks[i];
    if (cb === fn || cb.fn === fn) {
      callbacks.splice(i, 1);
      break;
    }
  }
  return this;
};

/**
 * Emit `event` with the given args.
 *
 * @param {String} event
 * @param {Mixed} ...
 * @return {Emitter}
 */

Emitter.prototype.emit = function(event){
  this._callbacks = this._callbacks || {};
  var args = [].slice.call(arguments, 1)
    , callbacks = this._callbacks[event];

  if (callbacks) {
    callbacks = callbacks.slice(0);
    for (var i = 0, len = callbacks.length; i < len; ++i) {
      callbacks[i].apply(this, args);
    }
  }

  return this;
};

/**
 * Return array of callbacks for `event`.
 *
 * @param {String} event
 * @return {Array}
 * @api public
 */

Emitter.prototype.listeners = function(event){
  this._callbacks = this._callbacks || {};
  return this._callbacks[event] || [];
};

/**
 * Check if this emitter has `event` handlers.
 *
 * @param {String} event
 * @return {Boolean}
 * @api public
 */

Emitter.prototype.hasListeners = function(event){
  return !! this.listeners(event).length;
};

},{}],33:[function(require,module,exports){
/*! Hammer.JS - v1.1.3 - 2014-05-20
 * http://eightmedia.github.io/hammer.js
 *
 * Copyright (c) 2014 Jorik Tangelder <j.tangelder@gmail.com>;
 * Licensed under the MIT license */

(function(window, undefined) {
  'use strict';

/**
 * @main
 * @module hammer
 *
 * @class Hammer
 * @static
 */

/**
 * Hammer, use this to create instances
 * ````
 * var hammertime = new Hammer(myElement);
 * ````
 *
 * @method Hammer
 * @param {HTMLElement} element
 * @param {Object} [options={}]
 * @return {Hammer.Instance}
 */
var Hammer = function Hammer(element, options) {
    return new Hammer.Instance(element, options || {});
};

/**
 * version, as defined in package.json
 * the value will be set at each build
 * @property VERSION
 * @final
 * @type {String}
 */
Hammer.VERSION = '1.1.3';

/**
 * default settings.
 * more settings are defined per gesture at `/gestures`. Each gesture can be disabled/enabled
 * by setting it's name (like `swipe`) to false.
 * You can set the defaults for all instances by changing this object before creating an instance.
 * @example
 * ````
 *  Hammer.defaults.drag = false;
 *  Hammer.defaults.behavior.touchAction = 'pan-y';
 *  delete Hammer.defaults.behavior.userSelect;
 * ````
 * @property defaults
 * @type {Object}
 */
Hammer.defaults = {
    /**
     * this setting object adds styles and attributes to the element to prevent the browser from doing
     * its native behavior. The css properties are auto prefixed for the browsers when needed.
     * @property defaults.behavior
     * @type {Object}
     */
    behavior: {
        /**
         * Disables text selection to improve the dragging gesture. When the value is `none` it also sets
         * `onselectstart=false` for IE on the element. Mainly for desktop browsers.
         * @property defaults.behavior.userSelect
         * @type {String}
         * @default 'none'
         */
        userSelect: 'none',

        /**
         * Specifies whether and how a given region can be manipulated by the user (for instance, by panning or zooming).
         * Used by Chrome 35> and IE10>. By default this makes the element blocking any touch event.
         * @property defaults.behavior.touchAction
         * @type {String}
         * @default: 'pan-y'
         */
        touchAction: 'pan-y',

        /**
         * Disables the default callout shown when you touch and hold a touch target.
         * On iOS, when you touch and hold a touch target such as a link, Safari displays
         * a callout containing information about the link. This property allows you to disable that callout.
         * @property defaults.behavior.touchCallout
         * @type {String}
         * @default 'none'
         */
        touchCallout: 'none',

        /**
         * Specifies whether zooming is enabled. Used by IE10>
         * @property defaults.behavior.contentZooming
         * @type {String}
         * @default 'none'
         */
        contentZooming: 'none',

        /**
         * Specifies that an entire element should be draggable instead of its contents.
         * Mainly for desktop browsers.
         * @property defaults.behavior.userDrag
         * @type {String}
         * @default 'none'
         */
        userDrag: 'none',

        /**
         * Overrides the highlight color shown when the user taps a link or a JavaScript
         * clickable element in Safari on iPhone. This property obeys the alpha value, if specified.
         *
         * If you don't specify an alpha value, Safari on iPhone applies a default alpha value
         * to the color. To disable tap highlighting, set the alpha value to 0 (invisible).
         * If you set the alpha value to 1.0 (opaque), the element is not visible when tapped.
         * @property defaults.behavior.tapHighlightColor
         * @type {String}
         * @default 'rgba(0,0,0,0)'
         */
        tapHighlightColor: 'rgba(0,0,0,0)'
    }
};

/**
 * hammer document where the base events are added at
 * @property DOCUMENT
 * @type {HTMLElement}
 * @default window.document
 */
Hammer.DOCUMENT = document;

/**
 * detect support for pointer events
 * @property HAS_POINTEREVENTS
 * @type {Boolean}
 */
Hammer.HAS_POINTEREVENTS = navigator.pointerEnabled || navigator.msPointerEnabled;

/**
 * detect support for touch events
 * @property HAS_TOUCHEVENTS
 * @type {Boolean}
 */
Hammer.HAS_TOUCHEVENTS = ('ontouchstart' in window);

/**
 * detect mobile browsers
 * @property IS_MOBILE
 * @type {Boolean}
 */
Hammer.IS_MOBILE = /mobile|tablet|ip(ad|hone|od)|android|silk/i.test(navigator.userAgent);

/**
 * detect if we want to support mouseevents at all
 * @property NO_MOUSEEVENTS
 * @type {Boolean}
 */
Hammer.NO_MOUSEEVENTS = (Hammer.HAS_TOUCHEVENTS && Hammer.IS_MOBILE) || Hammer.HAS_POINTEREVENTS;

/**
 * interval in which Hammer recalculates current velocity/direction/angle in ms
 * @property CALCULATE_INTERVAL
 * @type {Number}
 * @default 25
 */
Hammer.CALCULATE_INTERVAL = 25;

/**
 * eventtypes per touchevent (start, move, end) are filled by `Event.determineEventTypes` on `setup`
 * the object contains the DOM event names per type (`EVENT_START`, `EVENT_MOVE`, `EVENT_END`)
 * @property EVENT_TYPES
 * @private
 * @writeOnce
 * @type {Object}
 */
var EVENT_TYPES = {};

/**
 * direction strings, for safe comparisons
 * @property DIRECTION_DOWN|LEFT|UP|RIGHT
 * @final
 * @type {String}
 * @default 'down' 'left' 'up' 'right'
 */
var DIRECTION_DOWN = Hammer.DIRECTION_DOWN = 'down';
var DIRECTION_LEFT = Hammer.DIRECTION_LEFT = 'left';
var DIRECTION_UP = Hammer.DIRECTION_UP = 'up';
var DIRECTION_RIGHT = Hammer.DIRECTION_RIGHT = 'right';

/**
 * pointertype strings, for safe comparisons
 * @property POINTER_MOUSE|TOUCH|PEN
 * @final
 * @type {String}
 * @default 'mouse' 'touch' 'pen'
 */
var POINTER_MOUSE = Hammer.POINTER_MOUSE = 'mouse';
var POINTER_TOUCH = Hammer.POINTER_TOUCH = 'touch';
var POINTER_PEN = Hammer.POINTER_PEN = 'pen';

/**
 * eventtypes
 * @property EVENT_START|MOVE|END|RELEASE|TOUCH
 * @final
 * @type {String}
 * @default 'start' 'change' 'move' 'end' 'release' 'touch'
 */
var EVENT_START = Hammer.EVENT_START = 'start';
var EVENT_MOVE = Hammer.EVENT_MOVE = 'move';
var EVENT_END = Hammer.EVENT_END = 'end';
var EVENT_RELEASE = Hammer.EVENT_RELEASE = 'release';
var EVENT_TOUCH = Hammer.EVENT_TOUCH = 'touch';

/**
 * if the window events are set...
 * @property READY
 * @writeOnce
 * @type {Boolean}
 * @default false
 */
Hammer.READY = false;

/**
 * plugins namespace
 * @property plugins
 * @type {Object}
 */
Hammer.plugins = Hammer.plugins || {};

/**
 * gestures namespace
 * see `/gestures` for the definitions
 * @property gestures
 * @type {Object}
 */
Hammer.gestures = Hammer.gestures || {};

/**
 * setup events to detect gestures on the document
 * this function is called when creating an new instance
 * @private
 */
function setup() {
    if(Hammer.READY) {
        return;
    }

    // find what eventtypes we add listeners to
    Event.determineEventTypes();

    // Register all gestures inside Hammer.gestures
    Utils.each(Hammer.gestures, function(gesture) {
        Detection.register(gesture);
    });

    // Add touch events on the document
    Event.onTouch(Hammer.DOCUMENT, EVENT_MOVE, Detection.detect);
    Event.onTouch(Hammer.DOCUMENT, EVENT_END, Detection.detect);

    // Hammer is ready...!
    Hammer.READY = true;
}

/**
 * @module hammer
 *
 * @class Utils
 * @static
 */
var Utils = Hammer.utils = {
    /**
     * extend method, could also be used for cloning when `dest` is an empty object.
     * changes the dest object
     * @method extend
     * @param {Object} dest
     * @param {Object} src
     * @param {Boolean} [merge=false]  do a merge
     * @return {Object} dest
     */
    extend: function extend(dest, src, merge) {
        for(var key in src) {
            if(!src.hasOwnProperty(key) || (dest[key] !== undefined && merge)) {
                continue;
            }
            dest[key] = src[key];
        }
        return dest;
    },

    /**
     * simple addEventListener wrapper
     * @method on
     * @param {HTMLElement} element
     * @param {String} type
     * @param {Function} handler
     */
    on: function on(element, type, handler) {
        element.addEventListener(type, handler, false);
    },

    /**
     * simple removeEventListener wrapper
     * @method off
     * @param {HTMLElement} element
     * @param {String} type
     * @param {Function} handler
     */
    off: function off(element, type, handler) {
        element.removeEventListener(type, handler, false);
    },

    /**
     * forEach over arrays and objects
     * @method each
     * @param {Object|Array} obj
     * @param {Function} iterator
     * @param {any} iterator.item
     * @param {Number} iterator.index
     * @param {Object|Array} iterator.obj the source object
     * @param {Object} context value to use as `this` in the iterator
     */
    each: function each(obj, iterator, context) {
        var i, len;

        // native forEach on arrays
        if('forEach' in obj) {
            obj.forEach(iterator, context);
        // arrays
        } else if(obj.length !== undefined) {
            for(i = 0, len = obj.length; i < len; i++) {
                if(iterator.call(context, obj[i], i, obj) === false) {
                    return;
                }
            }
        // objects
        } else {
            for(i in obj) {
                if(obj.hasOwnProperty(i) &&
                    iterator.call(context, obj[i], i, obj) === false) {
                    return;
                }
            }
        }
    },

    /**
     * find if a string contains the string using indexOf
     * @method inStr
     * @param {String} src
     * @param {String} find
     * @return {Boolean} found
     */
    inStr: function inStr(src, find) {
        return src.indexOf(find) > -1;
    },

    /**
     * find if a array contains the object using indexOf or a simple polyfill
     * @method inArray
     * @param {String} src
     * @param {String} find
     * @return {Boolean|Number} false when not found, or the index
     */
    inArray: function inArray(src, find) {
        if(src.indexOf) {
            var index = src.indexOf(find);
            return (index === -1) ? false : index;
        } else {
            for(var i = 0, len = src.length; i < len; i++) {
                if(src[i] === find) {
                    return i;
                }
            }
            return false;
        }
    },

    /**
     * convert an array-like object (`arguments`, `touchlist`) to an array
     * @method toArray
     * @param {Object} obj
     * @return {Array}
     */
    toArray: function toArray(obj) {
        return Array.prototype.slice.call(obj, 0);
    },

    /**
     * find if a node is in the given parent
     * @method hasParent
     * @param {HTMLElement} node
     * @param {HTMLElement} parent
     * @return {Boolean} found
     */
    hasParent: function hasParent(node, parent) {
        while(node) {
            if(node == parent) {
                return true;
            }
            node = node.parentNode;
        }
        return false;
    },

    /**
     * get the center of all the touches
     * @method getCenter
     * @param {Array} touches
     * @return {Object} center contains `pageX`, `pageY`, `clientX` and `clientY` properties
     */
    getCenter: function getCenter(touches) {
        var pageX = [],
            pageY = [],
            clientX = [],
            clientY = [],
            min = Math.min,
            max = Math.max;

        // no need to loop when only one touch
        if(touches.length === 1) {
            return {
                pageX: touches[0].pageX,
                pageY: touches[0].pageY,
                clientX: touches[0].clientX,
                clientY: touches[0].clientY
            };
        }

        Utils.each(touches, function(touch) {
            pageX.push(touch.pageX);
            pageY.push(touch.pageY);
            clientX.push(touch.clientX);
            clientY.push(touch.clientY);
        });

        return {
            pageX: (min.apply(Math, pageX) + max.apply(Math, pageX)) / 2,
            pageY: (min.apply(Math, pageY) + max.apply(Math, pageY)) / 2,
            clientX: (min.apply(Math, clientX) + max.apply(Math, clientX)) / 2,
            clientY: (min.apply(Math, clientY) + max.apply(Math, clientY)) / 2
        };
    },

    /**
     * calculate the velocity between two points. unit is in px per ms.
     * @method getVelocity
     * @param {Number} deltaTime
     * @param {Number} deltaX
     * @param {Number} deltaY
     * @return {Object} velocity `x` and `y`
     */
    getVelocity: function getVelocity(deltaTime, deltaX, deltaY) {
        return {
            x: Math.abs(deltaX / deltaTime) || 0,
            y: Math.abs(deltaY / deltaTime) || 0
        };
    },

    /**
     * calculate the angle between two coordinates
     * @method getAngle
     * @param {Touch} touch1
     * @param {Touch} touch2
     * @return {Number} angle
     */
    getAngle: function getAngle(touch1, touch2) {
        var x = touch2.clientX - touch1.clientX,
            y = touch2.clientY - touch1.clientY;

        return Math.atan2(y, x) * 180 / Math.PI;
    },

    /**
     * do a small comparision to get the direction between two touches.
     * @method getDirection
     * @param {Touch} touch1
     * @param {Touch} touch2
     * @return {String} direction matches `DIRECTION_LEFT|RIGHT|UP|DOWN`
     */
    getDirection: function getDirection(touch1, touch2) {
        var x = Math.abs(touch1.clientX - touch2.clientX),
            y = Math.abs(touch1.clientY - touch2.clientY);

        if(x >= y) {
            return touch1.clientX - touch2.clientX > 0 ? DIRECTION_LEFT : DIRECTION_RIGHT;
        }
        return touch1.clientY - touch2.clientY > 0 ? DIRECTION_UP : DIRECTION_DOWN;
    },

    /**
     * calculate the distance between two touches
     * @method getDistance
     * @param {Touch}touch1
     * @param {Touch} touch2
     * @return {Number} distance
     */
    getDistance: function getDistance(touch1, touch2) {
        var x = touch2.clientX - touch1.clientX,
            y = touch2.clientY - touch1.clientY;

        return Math.sqrt((x * x) + (y * y));
    },

    /**
     * calculate the scale factor between two touchLists
     * no scale is 1, and goes down to 0 when pinched together, and bigger when pinched out
     * @method getScale
     * @param {Array} start array of touches
     * @param {Array} end array of touches
     * @return {Number} scale
     */
    getScale: function getScale(start, end) {
        // need two fingers...
        if(start.length >= 2 && end.length >= 2) {
            return this.getDistance(end[0], end[1]) / this.getDistance(start[0], start[1]);
        }
        return 1;
    },

    /**
     * calculate the rotation degrees between two touchLists
     * @method getRotation
     * @param {Array} start array of touches
     * @param {Array} end array of touches
     * @return {Number} rotation
     */
    getRotation: function getRotation(start, end) {
        // need two fingers
        if(start.length >= 2 && end.length >= 2) {
            return this.getAngle(end[1], end[0]) - this.getAngle(start[1], start[0]);
        }
        return 0;
    },

    /**
     * find out if the direction is vertical   *
     * @method isVertical
     * @param {String} direction matches `DIRECTION_UP|DOWN`
     * @return {Boolean} is_vertical
     */
    isVertical: function isVertical(direction) {
        return direction == DIRECTION_UP || direction == DIRECTION_DOWN;
    },

    /**
     * set css properties with their prefixes
     * @param {HTMLElement} element
     * @param {String} prop
     * @param {String} value
     * @param {Boolean} [toggle=true]
     * @return {Boolean}
     */
    setPrefixedCss: function setPrefixedCss(element, prop, value, toggle) {
        var prefixes = ['', 'Webkit', 'Moz', 'O', 'ms'];
        prop = Utils.toCamelCase(prop);

        for(var i = 0; i < prefixes.length; i++) {
            var p = prop;
            // prefixes
            if(prefixes[i]) {
                p = prefixes[i] + p.slice(0, 1).toUpperCase() + p.slice(1);
            }

            // test the style
            if(p in element.style) {
                element.style[p] = (toggle == null || toggle) && value || '';
                break;
            }
        }
    },

    /**
     * toggle browser default behavior by setting css properties.
     * `userSelect='none'` also sets `element.onselectstart` to false
     * `userDrag='none'` also sets `element.ondragstart` to false
     *
     * @method toggleBehavior
     * @param {HtmlElement} element
     * @param {Object} props
     * @param {Boolean} [toggle=true]
     */
    toggleBehavior: function toggleBehavior(element, props, toggle) {
        if(!props || !element || !element.style) {
            return;
        }

        // set the css properties
        Utils.each(props, function(value, prop) {
            Utils.setPrefixedCss(element, prop, value, toggle);
        });

        var falseFn = toggle && function() {
            return false;
        };

        // also the disable onselectstart
        if(props.userSelect == 'none') {
            element.onselectstart = falseFn;
        }
        // and disable ondragstart
        if(props.userDrag == 'none') {
            element.ondragstart = falseFn;
        }
    },

    /**
     * convert a string with underscores to camelCase
     * so prevent_default becomes preventDefault
     * @param {String} str
     * @return {String} camelCaseStr
     */
    toCamelCase: function toCamelCase(str) {
        return str.replace(/[_-]([a-z])/g, function(s) {
            return s[1].toUpperCase();
        });
    }
};


/**
 * @module hammer
 */
/**
 * @class Event
 * @static
 */
var Event = Hammer.event = {
    /**
     * when touch events have been fired, this is true
     * this is used to stop mouse events
     * @property prevent_mouseevents
     * @private
     * @type {Boolean}
     */
    preventMouseEvents: false,

    /**
     * if EVENT_START has been fired
     * @property started
     * @private
     * @type {Boolean}
     */
    started: false,

    /**
     * when the mouse is hold down, this is true
     * @property should_detect
     * @private
     * @type {Boolean}
     */
    shouldDetect: false,

    /**
     * simple event binder with a hook and support for multiple types
     * @method on
     * @param {HTMLElement} element
     * @param {String} type
     * @param {Function} handler
     * @param {Function} [hook]
     * @param {Object} hook.type
     */
    on: function on(element, type, handler, hook) {
        var types = type.split(' ');
        Utils.each(types, function(type) {
            Utils.on(element, type, handler);
            hook && hook(type);
        });
    },

    /**
     * simple event unbinder with a hook and support for multiple types
     * @method off
     * @param {HTMLElement} element
     * @param {String} type
     * @param {Function} handler
     * @param {Function} [hook]
     * @param {Object} hook.type
     */
    off: function off(element, type, handler, hook) {
        var types = type.split(' ');
        Utils.each(types, function(type) {
            Utils.off(element, type, handler);
            hook && hook(type);
        });
    },

    /**
     * the core touch event handler.
     * this finds out if we should to detect gestures
     * @method onTouch
     * @param {HTMLElement} element
     * @param {String} eventType matches `EVENT_START|MOVE|END`
     * @param {Function} handler
     * @return onTouchHandler {Function} the core event handler
     */
    onTouch: function onTouch(element, eventType, handler) {
        var self = this;

        var onTouchHandler = function onTouchHandler(ev) {
            var srcType = ev.type.toLowerCase(),
                isPointer = Hammer.HAS_POINTEREVENTS,
                isMouse = Utils.inStr(srcType, 'mouse'),
                triggerType;

            // if we are in a mouseevent, but there has been a touchevent triggered in this session
            // we want to do nothing. simply break out of the event.
            if(isMouse && self.preventMouseEvents) {
                return;

            // mousebutton must be down
            } else if(isMouse && eventType == EVENT_START && ev.button === 0) {
                self.preventMouseEvents = false;
                self.shouldDetect = true;
            } else if(isPointer && eventType == EVENT_START) {
                self.shouldDetect = (ev.buttons === 1 || PointerEvent.matchType(POINTER_TOUCH, ev));
            // just a valid start event, but no mouse
            } else if(!isMouse && eventType == EVENT_START) {
                self.preventMouseEvents = true;
                self.shouldDetect = true;
            }

            // update the pointer event before entering the detection
            if(isPointer && eventType != EVENT_END) {
                PointerEvent.updatePointer(eventType, ev);
            }

            // we are in a touch/down state, so allowed detection of gestures
            if(self.shouldDetect) {
                triggerType = self.doDetect.call(self, ev, eventType, element, handler);
            }

            // ...and we are done with the detection
            // so reset everything to start each detection totally fresh
            if(triggerType == EVENT_END) {
                self.preventMouseEvents = false;
                self.shouldDetect = false;
                PointerEvent.reset();
            // update the pointerevent object after the detection
            }

            if(isPointer && eventType == EVENT_END) {
                PointerEvent.updatePointer(eventType, ev);
            }
        };

        this.on(element, EVENT_TYPES[eventType], onTouchHandler);
        return onTouchHandler;
    },

    /**
     * the core detection method
     * this finds out what hammer-touch-events to trigger
     * @method doDetect
     * @param {Object} ev
     * @param {String} eventType matches `EVENT_START|MOVE|END`
     * @param {HTMLElement} element
     * @param {Function} handler
     * @return {String} triggerType matches `EVENT_START|MOVE|END`
     */
    doDetect: function doDetect(ev, eventType, element, handler) {
        var touchList = this.getTouchList(ev, eventType);
        var touchListLength = touchList.length;
        var triggerType = eventType;
        var triggerChange = touchList.trigger; // used by fakeMultitouch plugin
        var changedLength = touchListLength;

        // at each touchstart-like event we want also want to trigger a TOUCH event...
        if(eventType == EVENT_START) {
            triggerChange = EVENT_TOUCH;
        // ...the same for a touchend-like event
        } else if(eventType == EVENT_END) {
            triggerChange = EVENT_RELEASE;

            // keep track of how many touches have been removed
            changedLength = touchList.length - ((ev.changedTouches) ? ev.changedTouches.length : 1);
        }

        // after there are still touches on the screen,
        // we just want to trigger a MOVE event. so change the START or END to a MOVE
        // but only after detection has been started, the first time we actualy want a START
        if(changedLength > 0 && this.started) {
            triggerType = EVENT_MOVE;
        }

        // detection has been started, we keep track of this, see above
        this.started = true;

        // generate some event data, some basic information
        var evData = this.collectEventData(element, triggerType, touchList, ev);

        // trigger the triggerType event before the change (TOUCH, RELEASE) events
        // but the END event should be at last
        if(eventType != EVENT_END) {
            handler.call(Detection, evData);
        }

        // trigger a change (TOUCH, RELEASE) event, this means the length of the touches changed
        if(triggerChange) {
            evData.changedLength = changedLength;
            evData.eventType = triggerChange;

            handler.call(Detection, evData);

            evData.eventType = triggerType;
            delete evData.changedLength;
        }

        // trigger the END event
        if(triggerType == EVENT_END) {
            handler.call(Detection, evData);

            // ...and we are done with the detection
            // so reset everything to start each detection totally fresh
            this.started = false;
        }

        return triggerType;
    },

    /**
     * we have different events for each device/browser
     * determine what we need and set them in the EVENT_TYPES constant
     * the `onTouch` method is bind to these properties.
     * @method determineEventTypes
     * @return {Object} events
     */
    determineEventTypes: function determineEventTypes() {
        var types;
        if(Hammer.HAS_POINTEREVENTS) {
            if(window.PointerEvent) {
                types = [
                    'pointerdown',
                    'pointermove',
                    'pointerup pointercancel lostpointercapture'
                ];
            } else {
                types = [
                    'MSPointerDown',
                    'MSPointerMove',
                    'MSPointerUp MSPointerCancel MSLostPointerCapture'
                ];
            }
        } else if(Hammer.NO_MOUSEEVENTS) {
            types = [
                'touchstart',
                'touchmove',
                'touchend touchcancel'
            ];
        } else {
            types = [
                'touchstart mousedown',
                'touchmove mousemove',
                'touchend touchcancel mouseup'
            ];
        }

        EVENT_TYPES[EVENT_START] = types[0];
        EVENT_TYPES[EVENT_MOVE] = types[1];
        EVENT_TYPES[EVENT_END] = types[2];
        return EVENT_TYPES;
    },

    /**
     * create touchList depending on the event
     * @method getTouchList
     * @param {Object} ev
     * @param {String} eventType
     * @return {Array} touches
     */
    getTouchList: function getTouchList(ev, eventType) {
        // get the fake pointerEvent touchlist
        if(Hammer.HAS_POINTEREVENTS) {
            return PointerEvent.getTouchList();
        }

        // get the touchlist
        if(ev.touches) {
            if(eventType == EVENT_MOVE) {
                return ev.touches;
            }

            var identifiers = [];
            var concat = [].concat(Utils.toArray(ev.touches), Utils.toArray(ev.changedTouches));
            var touchList = [];

            Utils.each(concat, function(touch) {
                if(Utils.inArray(identifiers, touch.identifier) === false) {
                    touchList.push(touch);
                }
                identifiers.push(touch.identifier);
            });

            return touchList;
        }

        // make fake touchList from mouse position
        ev.identifier = 1;
        return [ev];
    },

    /**
     * collect basic event data
     * @method collectEventData
     * @param {HTMLElement} element
     * @param {String} eventType matches `EVENT_START|MOVE|END`
     * @param {Array} touches
     * @param {Object} ev
     * @return {Object} ev
     */
    collectEventData: function collectEventData(element, eventType, touches, ev) {
        // find out pointerType
        var pointerType = POINTER_TOUCH;
        if(Utils.inStr(ev.type, 'mouse') || PointerEvent.matchType(POINTER_MOUSE, ev)) {
            pointerType = POINTER_MOUSE;
        } else if(PointerEvent.matchType(POINTER_PEN, ev)) {
            pointerType = POINTER_PEN;
        }

        return {
            center: Utils.getCenter(touches),
            timeStamp: Date.now(),
            target: ev.target,
            touches: touches,
            eventType: eventType,
            pointerType: pointerType,
            srcEvent: ev,

            /**
             * prevent the browser default actions
             * mostly used to disable scrolling of the browser
             */
            preventDefault: function() {
                var srcEvent = this.srcEvent;
                srcEvent.preventManipulation && srcEvent.preventManipulation();
                srcEvent.preventDefault && srcEvent.preventDefault();
            },

            /**
             * stop bubbling the event up to its parents
             */
            stopPropagation: function() {
                this.srcEvent.stopPropagation();
            },

            /**
             * immediately stop gesture detection
             * might be useful after a swipe was detected
             * @return {*}
             */
            stopDetect: function() {
                return Detection.stopDetect();
            }
        };
    }
};


/**
 * @module hammer
 *
 * @class PointerEvent
 * @static
 */
var PointerEvent = Hammer.PointerEvent = {
    /**
     * holds all pointers, by `identifier`
     * @property pointers
     * @type {Object}
     */
    pointers: {},

    /**
     * get the pointers as an array
     * @method getTouchList
     * @return {Array} touchlist
     */
    getTouchList: function getTouchList() {
        var touchlist = [];
        // we can use forEach since pointerEvents only is in IE10
        Utils.each(this.pointers, function(pointer) {
            touchlist.push(pointer);
        });
        return touchlist;
    },

    /**
     * update the position of a pointer
     * @method updatePointer
     * @param {String} eventType matches `EVENT_START|MOVE|END`
     * @param {Object} pointerEvent
     */
    updatePointer: function updatePointer(eventType, pointerEvent) {
        if(eventType == EVENT_END || (eventType != EVENT_END && pointerEvent.buttons !== 1)) {
            delete this.pointers[pointerEvent.pointerId];
        } else {
            pointerEvent.identifier = pointerEvent.pointerId;
            this.pointers[pointerEvent.pointerId] = pointerEvent;
        }
    },

    /**
     * check if ev matches pointertype
     * @method matchType
     * @param {String} pointerType matches `POINTER_MOUSE|TOUCH|PEN`
     * @param {PointerEvent} ev
     */
    matchType: function matchType(pointerType, ev) {
        if(!ev.pointerType) {
            return false;
        }

        var pt = ev.pointerType,
            types = {};

        types[POINTER_MOUSE] = (pt === (ev.MSPOINTER_TYPE_MOUSE || POINTER_MOUSE));
        types[POINTER_TOUCH] = (pt === (ev.MSPOINTER_TYPE_TOUCH || POINTER_TOUCH));
        types[POINTER_PEN] = (pt === (ev.MSPOINTER_TYPE_PEN || POINTER_PEN));
        return types[pointerType];
    },

    /**
     * reset the stored pointers
     * @method reset
     */
    reset: function resetList() {
        this.pointers = {};
    }
};


/**
 * @module hammer
 *
 * @class Detection
 * @static
 */
var Detection = Hammer.detection = {
    // contains all registred Hammer.gestures in the correct order
    gestures: [],

    // data of the current Hammer.gesture detection session
    current: null,

    // the previous Hammer.gesture session data
    // is a full clone of the previous gesture.current object
    previous: null,

    // when this becomes true, no gestures are fired
    stopped: false,

    /**
     * start Hammer.gesture detection
     * @method startDetect
     * @param {Hammer.Instance} inst
     * @param {Object} eventData
     */
    startDetect: function startDetect(inst, eventData) {
        // already busy with a Hammer.gesture detection on an element
        if(this.current) {
            return;
        }

        this.stopped = false;

        // holds current session
        this.current = {
            inst: inst, // reference to HammerInstance we're working for
            startEvent: Utils.extend({}, eventData), // start eventData for distances, timing etc
            lastEvent: false, // last eventData
            lastCalcEvent: false, // last eventData for calculations.
            futureCalcEvent: false, // last eventData for calculations.
            lastCalcData: {}, // last lastCalcData
            name: '' // current gesture we're in/detected, can be 'tap', 'hold' etc
        };

        this.detect(eventData);
    },

    /**
     * Hammer.gesture detection
     * @method detect
     * @param {Object} eventData
     * @return {any}
     */
    detect: function detect(eventData) {
        if(!this.current || this.stopped) {
            return;
        }

        // extend event data with calculations about scale, distance etc
        eventData = this.extendEventData(eventData);

        // hammer instance and instance options
        var inst = this.current.inst,
            instOptions = inst.options;

        // call Hammer.gesture handlers
        Utils.each(this.gestures, function triggerGesture(gesture) {
            // only when the instance options have enabled this gesture
            if(!this.stopped && inst.enabled && instOptions[gesture.name]) {
                gesture.handler.call(gesture, eventData, inst);
            }
        }, this);

        // store as previous event event
        if(this.current) {
            this.current.lastEvent = eventData;
        }

        if(eventData.eventType == EVENT_END) {
            this.stopDetect();
        }

        return eventData;
    },

    /**
     * clear the Hammer.gesture vars
     * this is called on endDetect, but can also be used when a final Hammer.gesture has been detected
     * to stop other Hammer.gestures from being fired
     * @method stopDetect
     */
    stopDetect: function stopDetect() {
        // clone current data to the store as the previous gesture
        // used for the double tap gesture, since this is an other gesture detect session
        this.previous = Utils.extend({}, this.current);

        // reset the current
        this.current = null;
        this.stopped = true;
    },

    /**
     * calculate velocity, angle and direction
     * @method getVelocityData
     * @param {Object} ev
     * @param {Object} center
     * @param {Number} deltaTime
     * @param {Number} deltaX
     * @param {Number} deltaY
     */
    getCalculatedData: function getCalculatedData(ev, center, deltaTime, deltaX, deltaY) {
        var cur = this.current,
            recalc = false,
            calcEv = cur.lastCalcEvent,
            calcData = cur.lastCalcData;

        if(calcEv && ev.timeStamp - calcEv.timeStamp > Hammer.CALCULATE_INTERVAL) {
            center = calcEv.center;
            deltaTime = ev.timeStamp - calcEv.timeStamp;
            deltaX = ev.center.clientX - calcEv.center.clientX;
            deltaY = ev.center.clientY - calcEv.center.clientY;
            recalc = true;
        }

        if(ev.eventType == EVENT_TOUCH || ev.eventType == EVENT_RELEASE) {
            cur.futureCalcEvent = ev;
        }

        if(!cur.lastCalcEvent || recalc) {
            calcData.velocity = Utils.getVelocity(deltaTime, deltaX, deltaY);
            calcData.angle = Utils.getAngle(center, ev.center);
            calcData.direction = Utils.getDirection(center, ev.center);

            cur.lastCalcEvent = cur.futureCalcEvent || ev;
            cur.futureCalcEvent = ev;
        }

        ev.velocityX = calcData.velocity.x;
        ev.velocityY = calcData.velocity.y;
        ev.interimAngle = calcData.angle;
        ev.interimDirection = calcData.direction;
    },

    /**
     * extend eventData for Hammer.gestures
     * @method extendEventData
     * @param {Object} ev
     * @return {Object} ev
     */
    extendEventData: function extendEventData(ev) {
        var cur = this.current,
            startEv = cur.startEvent,
            lastEv = cur.lastEvent || startEv;

        // update the start touchlist to calculate the scale/rotation
        if(ev.eventType == EVENT_TOUCH || ev.eventType == EVENT_RELEASE) {
            startEv.touches = [];
            Utils.each(ev.touches, function(touch) {
                startEv.touches.push({
                    clientX: touch.clientX,
                    clientY: touch.clientY
                });
            });
        }

        var deltaTime = ev.timeStamp - startEv.timeStamp,
            deltaX = ev.center.clientX - startEv.center.clientX,
            deltaY = ev.center.clientY - startEv.center.clientY;

        this.getCalculatedData(ev, lastEv.center, deltaTime, deltaX, deltaY);

        Utils.extend(ev, {
            startEvent: startEv,

            deltaTime: deltaTime,
            deltaX: deltaX,
            deltaY: deltaY,

            distance: Utils.getDistance(startEv.center, ev.center),
            angle: Utils.getAngle(startEv.center, ev.center),
            direction: Utils.getDirection(startEv.center, ev.center),
            scale: Utils.getScale(startEv.touches, ev.touches),
            rotation: Utils.getRotation(startEv.touches, ev.touches)
        });

        return ev;
    },

    /**
     * register new gesture
     * @method register
     * @param {Object} gesture object, see `gestures/` for documentation
     * @return {Array} gestures
     */
    register: function register(gesture) {
        // add an enable gesture options if there is no given
        var options = gesture.defaults || {};
        if(options[gesture.name] === undefined) {
            options[gesture.name] = true;
        }

        // extend Hammer default options with the Hammer.gesture options
        Utils.extend(Hammer.defaults, options, true);

        // set its index
        gesture.index = gesture.index || 1000;

        // add Hammer.gesture to the list
        this.gestures.push(gesture);

        // sort the list by index
        this.gestures.sort(function(a, b) {
            if(a.index < b.index) {
                return -1;
            }
            if(a.index > b.index) {
                return 1;
            }
            return 0;
        });

        return this.gestures;
    }
};


/**
 * @module hammer
 */

/**
 * create new hammer instance
 * all methods should return the instance itself, so it is chainable.
 *
 * @class Instance
 * @constructor
 * @param {HTMLElement} element
 * @param {Object} [options={}] options are merged with `Hammer.defaults`
 * @return {Hammer.Instance}
 */
Hammer.Instance = function(element, options) {
    var self = this;

    // setup HammerJS window events and register all gestures
    // this also sets up the default options
    setup();

    /**
     * @property element
     * @type {HTMLElement}
     */
    this.element = element;

    /**
     * @property enabled
     * @type {Boolean}
     * @protected
     */
    this.enabled = true;

    /**
     * options, merged with the defaults
     * options with an _ are converted to camelCase
     * @property options
     * @type {Object}
     */
    Utils.each(options, function(value, name) {
        delete options[name];
        options[Utils.toCamelCase(name)] = value;
    });

    this.options = Utils.extend(Utils.extend({}, Hammer.defaults), options || {});

    // add some css to the element to prevent the browser from doing its native behavoir
    if(this.options.behavior) {
        Utils.toggleBehavior(this.element, this.options.behavior, true);
    }

    /**
     * event start handler on the element to start the detection
     * @property eventStartHandler
     * @type {Object}
     */
    this.eventStartHandler = Event.onTouch(element, EVENT_START, function(ev) {
        if(self.enabled && ev.eventType == EVENT_START) {
            Detection.startDetect(self, ev);
        } else if(ev.eventType == EVENT_TOUCH) {
            Detection.detect(ev);
        }
    });

    /**
     * keep a list of user event handlers which needs to be removed when calling 'dispose'
     * @property eventHandlers
     * @type {Array}
     */
    this.eventHandlers = [];
};

Hammer.Instance.prototype = {
    /**
     * bind events to the instance
     * @method on
     * @chainable
     * @param {String} gestures multiple gestures by splitting with a space
     * @param {Function} handler
     * @param {Object} handler.ev event object
     */
    on: function onEvent(gestures, handler) {
        var self = this;
        Event.on(self.element, gestures, handler, function(type) {
            self.eventHandlers.push({ gesture: type, handler: handler });
        });
        return self;
    },

    /**
     * unbind events to the instance
     * @method off
     * @chainable
     * @param {String} gestures
     * @param {Function} handler
     */
    off: function offEvent(gestures, handler) {
        var self = this;

        Event.off(self.element, gestures, handler, function(type) {
            var index = Utils.inArray({ gesture: type, handler: handler });
            if(index !== false) {
                self.eventHandlers.splice(index, 1);
            }
        });
        return self;
    },

    /**
     * trigger gesture event
     * @method trigger
     * @chainable
     * @param {String} gesture
     * @param {Object} [eventData]
     */
    trigger: function triggerEvent(gesture, eventData) {
        // optional
        if(!eventData) {
            eventData = {};
        }

        // create DOM event
        var event = Hammer.DOCUMENT.createEvent('Event');
        event.initEvent(gesture, true, true);
        event.gesture = eventData;

        // trigger on the target if it is in the instance element,
        // this is for event delegation tricks
        var element = this.element;
        if(Utils.hasParent(eventData.target, element)) {
            element = eventData.target;
        }

        element.dispatchEvent(event);
        return this;
    },

    /**
     * enable of disable hammer.js detection
     * @method enable
     * @chainable
     * @param {Boolean} state
     */
    enable: function enable(state) {
        this.enabled = state;
        return this;
    },

    /**
     * dispose this hammer instance
     * @method dispose
     * @return {Null}
     */
    dispose: function dispose() {
        var i, eh;

        // undo all changes made by stop_browser_behavior
        Utils.toggleBehavior(this.element, this.options.behavior, false);

        // unbind all custom event handlers
        for(i = -1; (eh = this.eventHandlers[++i]);) {
            Utils.off(this.element, eh.gesture, eh.handler);
        }

        this.eventHandlers = [];

        // unbind the start event listener
        Event.off(this.element, EVENT_TYPES[EVENT_START], this.eventStartHandler);

        return null;
    }
};


/**
 * @module gestures
 */
/**
 * Move with x fingers (default 1) around on the page.
 * Preventing the default browser behavior is a good way to improve feel and working.
 * ````
 *  hammertime.on("drag", function(ev) {
 *    console.log(ev);
 *    ev.gesture.preventDefault();
 *  });
 * ````
 *
 * @class Drag
 * @static
 */
/**
 * @event drag
 * @param {Object} ev
 */
/**
 * @event dragstart
 * @param {Object} ev
 */
/**
 * @event dragend
 * @param {Object} ev
 */
/**
 * @event drapleft
 * @param {Object} ev
 */
/**
 * @event dragright
 * @param {Object} ev
 */
/**
 * @event dragup
 * @param {Object} ev
 */
/**
 * @event dragdown
 * @param {Object} ev
 */

/**
 * @param {String} name
 */
(function(name) {
    var triggered = false;

    function dragGesture(ev, inst) {
        var cur = Detection.current;

        // max touches
        if(inst.options.dragMaxTouches > 0 &&
            ev.touches.length > inst.options.dragMaxTouches) {
            return;
        }

        switch(ev.eventType) {
            case EVENT_START:
                triggered = false;
                break;

            case EVENT_MOVE:
                // when the distance we moved is too small we skip this gesture
                // or we can be already in dragging
                if(ev.distance < inst.options.dragMinDistance &&
                    cur.name != name) {
                    return;
                }

                var startCenter = cur.startEvent.center;

                // we are dragging!
                if(cur.name != name) {
                    cur.name = name;
                    if(inst.options.dragDistanceCorrection && ev.distance > 0) {
                        // When a drag is triggered, set the event center to dragMinDistance pixels from the original event center.
                        // Without this correction, the dragged distance would jumpstart at dragMinDistance pixels instead of at 0.
                        // It might be useful to save the original start point somewhere
                        var factor = Math.abs(inst.options.dragMinDistance / ev.distance);
                        startCenter.pageX += ev.deltaX * factor;
                        startCenter.pageY += ev.deltaY * factor;
                        startCenter.clientX += ev.deltaX * factor;
                        startCenter.clientY += ev.deltaY * factor;

                        // recalculate event data using new start point
                        ev = Detection.extendEventData(ev);
                    }
                }

                // lock drag to axis?
                if(cur.lastEvent.dragLockToAxis ||
                    ( inst.options.dragLockToAxis &&
                        inst.options.dragLockMinDistance <= ev.distance
                        )) {
                    ev.dragLockToAxis = true;
                }

                // keep direction on the axis that the drag gesture started on
                var lastDirection = cur.lastEvent.direction;
                if(ev.dragLockToAxis && lastDirection !== ev.direction) {
                    if(Utils.isVertical(lastDirection)) {
                        ev.direction = (ev.deltaY < 0) ? DIRECTION_UP : DIRECTION_DOWN;
                    } else {
                        ev.direction = (ev.deltaX < 0) ? DIRECTION_LEFT : DIRECTION_RIGHT;
                    }
                }

                // first time, trigger dragstart event
                if(!triggered) {
                    inst.trigger(name + 'start', ev);
                    triggered = true;
                }

                // trigger events
                inst.trigger(name, ev);
                inst.trigger(name + ev.direction, ev);

                var isVertical = Utils.isVertical(ev.direction);

                // block the browser events
                if((inst.options.dragBlockVertical && isVertical) ||
                    (inst.options.dragBlockHorizontal && !isVertical)) {
                    ev.preventDefault();
                }
                break;

            case EVENT_RELEASE:
                if(triggered && ev.changedLength <= inst.options.dragMaxTouches) {
                    inst.trigger(name + 'end', ev);
                    triggered = false;
                }
                break;

            case EVENT_END:
                triggered = false;
                break;
        }
    }

    Hammer.gestures.Drag = {
        name: name,
        index: 50,
        handler: dragGesture,
        defaults: {
            /**
             * minimal movement that have to be made before the drag event gets triggered
             * @property dragMinDistance
             * @type {Number}
             * @default 10
             */
            dragMinDistance: 10,

            /**
             * Set dragDistanceCorrection to true to make the starting point of the drag
             * be calculated from where the drag was triggered, not from where the touch started.
             * Useful to avoid a jerk-starting drag, which can make fine-adjustments
             * through dragging difficult, and be visually unappealing.
             * @property dragDistanceCorrection
             * @type {Boolean}
             * @default true
             */
            dragDistanceCorrection: true,

            /**
             * set 0 for unlimited, but this can conflict with transform
             * @property dragMaxTouches
             * @type {Number}
             * @default 1
             */
            dragMaxTouches: 1,

            /**
             * prevent default browser behavior when dragging occurs
             * be careful with it, it makes the element a blocking element
             * when you are using the drag gesture, it is a good practice to set this true
             * @property dragBlockHorizontal
             * @type {Boolean}
             * @default false
             */
            dragBlockHorizontal: false,

            /**
             * same as `dragBlockHorizontal`, but for vertical movement
             * @property dragBlockVertical
             * @type {Boolean}
             * @default false
             */
            dragBlockVertical: false,

            /**
             * dragLockToAxis keeps the drag gesture on the axis that it started on,
             * It disallows vertical directions if the initial direction was horizontal, and vice versa.
             * @property dragLockToAxis
             * @type {Boolean}
             * @default false
             */
            dragLockToAxis: false,

            /**
             * drag lock only kicks in when distance > dragLockMinDistance
             * This way, locking occurs only when the distance has become large enough to reliably determine the direction
             * @property dragLockMinDistance
             * @type {Number}
             * @default 25
             */
            dragLockMinDistance: 25
        }
    };
})('drag');

/**
 * @module gestures
 */
/**
 * trigger a simple gesture event, so you can do anything in your handler.
 * only usable if you know what your doing...
 *
 * @class Gesture
 * @static
 */
/**
 * @event gesture
 * @param {Object} ev
 */
Hammer.gestures.Gesture = {
    name: 'gesture',
    index: 1337,
    handler: function releaseGesture(ev, inst) {
        inst.trigger(this.name, ev);
    }
};

/**
 * @module gestures
 */
/**
 * Touch stays at the same place for x time
 *
 * @class Hold
 * @static
 */
/**
 * @event hold
 * @param {Object} ev
 */

/**
 * @param {String} name
 */
(function(name) {
    var timer;

    function holdGesture(ev, inst) {
        var options = inst.options,
            current = Detection.current;

        switch(ev.eventType) {
            case EVENT_START:
                clearTimeout(timer);

                // set the gesture so we can check in the timeout if it still is
                current.name = name;

                // set timer and if after the timeout it still is hold,
                // we trigger the hold event
                timer = setTimeout(function() {
                    if(current && current.name == name) {
                        inst.trigger(name, ev);
                    }
                }, options.holdTimeout);
                break;

            case EVENT_MOVE:
                if(ev.distance > options.holdThreshold) {
                    clearTimeout(timer);
                }
                break;

            case EVENT_RELEASE:
                clearTimeout(timer);
                break;
        }
    }

    Hammer.gestures.Hold = {
        name: name,
        index: 10,
        defaults: {
            /**
             * @property holdTimeout
             * @type {Number}
             * @default 500
             */
            holdTimeout: 500,

            /**
             * movement allowed while holding
             * @property holdThreshold
             * @type {Number}
             * @default 2
             */
            holdThreshold: 2
        },
        handler: holdGesture
    };
})('hold');

/**
 * @module gestures
 */
/**
 * when a touch is being released from the page
 *
 * @class Release
 * @static
 */
/**
 * @event release
 * @param {Object} ev
 */
Hammer.gestures.Release = {
    name: 'release',
    index: Infinity,
    handler: function releaseGesture(ev, inst) {
        if(ev.eventType == EVENT_RELEASE) {
            inst.trigger(this.name, ev);
        }
    }
};

/**
 * @module gestures
 */
/**
 * triggers swipe events when the end velocity is above the threshold
 * for best usage, set `preventDefault` (on the drag gesture) to `true`
 * ````
 *  hammertime.on("dragleft swipeleft", function(ev) {
 *    console.log(ev);
 *    ev.gesture.preventDefault();
 *  });
 * ````
 *
 * @class Swipe
 * @static
 */
/**
 * @event swipe
 * @param {Object} ev
 */
/**
 * @event swipeleft
 * @param {Object} ev
 */
/**
 * @event swiperight
 * @param {Object} ev
 */
/**
 * @event swipeup
 * @param {Object} ev
 */
/**
 * @event swipedown
 * @param {Object} ev
 */
Hammer.gestures.Swipe = {
    name: 'swipe',
    index: 40,
    defaults: {
        /**
         * @property swipeMinTouches
         * @type {Number}
         * @default 1
         */
        swipeMinTouches: 1,

        /**
         * @property swipeMaxTouches
         * @type {Number}
         * @default 1
         */
        swipeMaxTouches: 1,

        /**
         * horizontal swipe velocity
         * @property swipeVelocityX
         * @type {Number}
         * @default 0.6
         */
        swipeVelocityX: 0.6,

        /**
         * vertical swipe velocity
         * @property swipeVelocityY
         * @type {Number}
         * @default 0.6
         */
        swipeVelocityY: 0.6
    },

    handler: function swipeGesture(ev, inst) {
        if(ev.eventType == EVENT_RELEASE) {
            var touches = ev.touches.length,
                options = inst.options;

            // max touches
            if(touches < options.swipeMinTouches ||
                touches > options.swipeMaxTouches) {
                return;
            }

            // when the distance we moved is too small we skip this gesture
            // or we can be already in dragging
            if(ev.velocityX > options.swipeVelocityX ||
                ev.velocityY > options.swipeVelocityY) {
                // trigger swipe events
                inst.trigger(this.name, ev);
                inst.trigger(this.name + ev.direction, ev);
            }
        }
    }
};

/**
 * @module gestures
 */
/**
 * Single tap and a double tap on a place
 *
 * @class Tap
 * @static
 */
/**
 * @event tap
 * @param {Object} ev
 */
/**
 * @event doubletap
 * @param {Object} ev
 */

/**
 * @param {String} name
 */
(function(name) {
    var hasMoved = false;

    function tapGesture(ev, inst) {
        var options = inst.options,
            current = Detection.current,
            prev = Detection.previous,
            sincePrev,
            didDoubleTap;

        switch(ev.eventType) {
            case EVENT_START:
                hasMoved = false;
                break;

            case EVENT_MOVE:
                hasMoved = hasMoved || (ev.distance > options.tapMaxDistance);
                break;

            case EVENT_END:
                if(!Utils.inStr(ev.srcEvent.type, 'cancel') && ev.deltaTime < options.tapMaxTime && !hasMoved) {
                    // previous gesture, for the double tap since these are two different gesture detections
                    sincePrev = prev && prev.lastEvent && ev.timeStamp - prev.lastEvent.timeStamp;
                    didDoubleTap = false;

                    // check if double tap
                    if(prev && prev.name == name &&
                        (sincePrev && sincePrev < options.doubleTapInterval) &&
                        ev.distance < options.doubleTapDistance) {
                        inst.trigger('doubletap', ev);
                        didDoubleTap = true;
                    }

                    // do a single tap
                    if(!didDoubleTap || options.tapAlways) {
                        current.name = name;
                        inst.trigger(current.name, ev);
                    }
                }
                break;
        }
    }

    Hammer.gestures.Tap = {
        name: name,
        index: 100,
        handler: tapGesture,
        defaults: {
            /**
             * max time of a tap, this is for the slow tappers
             * @property tapMaxTime
             * @type {Number}
             * @default 250
             */
            tapMaxTime: 250,

            /**
             * max distance of movement of a tap, this is for the slow tappers
             * @property tapMaxDistance
             * @type {Number}
             * @default 10
             */
            tapMaxDistance: 10,

            /**
             * always trigger the `tap` event, even while double-tapping
             * @property tapAlways
             * @type {Boolean}
             * @default true
             */
            tapAlways: true,

            /**
             * max distance between two taps
             * @property doubleTapDistance
             * @type {Number}
             * @default 20
             */
            doubleTapDistance: 20,

            /**
             * max time between two taps
             * @property doubleTapInterval
             * @type {Number}
             * @default 300
             */
            doubleTapInterval: 300
        }
    };
})('tap');

/**
 * @module gestures
 */
/**
 * when a touch is being touched at the page
 *
 * @class Touch
 * @static
 */
/**
 * @event touch
 * @param {Object} ev
 */
Hammer.gestures.Touch = {
    name: 'touch',
    index: -Infinity,
    defaults: {
        /**
         * call preventDefault at touchstart, and makes the element blocking by disabling the scrolling of the page,
         * but it improves gestures like transforming and dragging.
         * be careful with using this, it can be very annoying for users to be stuck on the page
         * @property preventDefault
         * @type {Boolean}
         * @default false
         */
        preventDefault: false,

        /**
         * disable mouse events, so only touch (or pen!) input triggers events
         * @property preventMouse
         * @type {Boolean}
         * @default false
         */
        preventMouse: false
    },
    handler: function touchGesture(ev, inst) {
        if(inst.options.preventMouse && ev.pointerType == POINTER_MOUSE) {
            ev.stopDetect();
            return;
        }

        if(inst.options.preventDefault) {
            ev.preventDefault();
        }

        if(ev.eventType == EVENT_TOUCH) {
            inst.trigger('touch', ev);
        }
    }
};

/**
 * @module gestures
 */
/**
 * User want to scale or rotate with 2 fingers
 * Preventing the default browser behavior is a good way to improve feel and working. This can be done with the
 * `preventDefault` option.
 *
 * @class Transform
 * @static
 */
/**
 * @event transform
 * @param {Object} ev
 */
/**
 * @event transformstart
 * @param {Object} ev
 */
/**
 * @event transformend
 * @param {Object} ev
 */
/**
 * @event pinchin
 * @param {Object} ev
 */
/**
 * @event pinchout
 * @param {Object} ev
 */
/**
 * @event rotate
 * @param {Object} ev
 */

/**
 * @param {String} name
 */
(function(name) {
    var triggered = false;

    function transformGesture(ev, inst) {
        switch(ev.eventType) {
            case EVENT_START:
                triggered = false;
                break;

            case EVENT_MOVE:
                // at least multitouch
                if(ev.touches.length < 2) {
                    return;
                }

                var scaleThreshold = Math.abs(1 - ev.scale);
                var rotationThreshold = Math.abs(ev.rotation);

                // when the distance we moved is too small we skip this gesture
                // or we can be already in dragging
                if(scaleThreshold < inst.options.transformMinScale &&
                    rotationThreshold < inst.options.transformMinRotation) {
                    return;
                }

                // we are transforming!
                Detection.current.name = name;

                // first time, trigger dragstart event
                if(!triggered) {
                    inst.trigger(name + 'start', ev);
                    triggered = true;
                }

                inst.trigger(name, ev); // basic transform event

                // trigger rotate event
                if(rotationThreshold > inst.options.transformMinRotation) {
                    inst.trigger('rotate', ev);
                }

                // trigger pinch event
                if(scaleThreshold > inst.options.transformMinScale) {
                    inst.trigger('pinch', ev);
                    inst.trigger('pinch' + (ev.scale < 1 ? 'in' : 'out'), ev);
                }
                break;

            case EVENT_RELEASE:
                if(triggered && ev.changedLength < 2) {
                    inst.trigger(name + 'end', ev);
                    triggered = false;
                }
                break;
        }
    }

    Hammer.gestures.Transform = {
        name: name,
        index: 45,
        defaults: {
            /**
             * minimal scale factor, no scale is 1, zoomin is to 0 and zoomout until higher then 1
             * @property transformMinScale
             * @type {Number}
             * @default 0.01
             */
            transformMinScale: 0.01,

            /**
             * rotation in degrees
             * @property transformMinRotation
             * @type {Number}
             * @default 1
             */
            transformMinRotation: 1
        },

        handler: transformGesture
    };
})('transform');

/**
 * @module hammer
 */

// AMD export
if(typeof define == 'function' && define.amd) {
    define(function() {
        return Hammer;
    });
// commonjs export
} else if(typeof module !== 'undefined' && module.exports) {
    module.exports = Hammer;
// browser export
} else {
    window.Hammer = Hammer;
}

})(window);
},{}],34:[function(require,module,exports){
"use strict";
/**
 * Created by Alex on 11/6/2014.
 */

// https://github.com/umdjs/umd/blob/master/returnExports.js#L40-L60
// if the module has no dependencies, the above pattern can be simplified to
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD. Register as an anonymous module.
    define([], factory);
  } else if (typeof exports === 'object') {
    // Node. Does not work with strict CommonJS, but
    // only CommonJS-like environments that support module.exports,
    // like Node.
    module.exports = factory();
  } else {
    // Browser globals (root is window)
    root.keycharm = factory();
  }
}(this, function () {

  function keycharm(options) {
    var preventDefault = options && options.preventDefault || false;

    var container = options && options.container || window;

    var _exportFunctions = {};
    var _bound = {keydown:{}, keyup:{}};
    var _keys = {};
    var i;

    // a - z
    for (i = 97; i <= 122; i++) {_keys[String.fromCharCode(i)] = {code:65 + (i - 97), shift: false};}
    // A - Z
    for (i = 65; i <= 90; i++) {_keys[String.fromCharCode(i)] = {code:i, shift: true};}
    // 0 - 9
    for (i = 0;  i <= 9;   i++) {_keys['' + i] = {code:48 + i, shift: false};}
    // F1 - F12
    for (i = 1;  i <= 12;   i++) {_keys['F' + i] = {code:111 + i, shift: false};}
    // num0 - num9
    for (i = 0;  i <= 9;   i++) {_keys['num' + i] = {code:96 + i, shift: false};}

    // numpad misc
    _keys['num*'] = {code:106, shift: false};
    _keys['num+'] = {code:107, shift: false};
    _keys['num-'] = {code:109, shift: false};
    _keys['num/'] = {code:111, shift: false};
    _keys['num.'] = {code:110, shift: false};
    // arrows
    _keys['left']  = {code:37, shift: false};
    _keys['up']    = {code:38, shift: false};
    _keys['right'] = {code:39, shift: false};
    _keys['down']  = {code:40, shift: false};
    // extra keys
    _keys['space'] = {code:32, shift: false};
    _keys['enter'] = {code:13, shift: false};
    _keys['shift'] = {code:16, shift: undefined};
    _keys['esc']   = {code:27, shift: false};
    _keys['backspace'] = {code:8, shift: false};
    _keys['tab']       = {code:9, shift: false};
    _keys['ctrl']      = {code:17, shift: false};
    _keys['alt']       = {code:18, shift: false};
    _keys['delete']    = {code:46, shift: false};
    _keys['pageup']    = {code:33, shift: false};
    _keys['pagedown']  = {code:34, shift: false};
    // symbols
    _keys['=']     = {code:187, shift: false};
    _keys['-']     = {code:189, shift: false};
    _keys[']']     = {code:221, shift: false};
    _keys['[']     = {code:219, shift: false};



    var down = function(event) {handleEvent(event,'keydown');};
    var up = function(event) {handleEvent(event,'keyup');};

    // handle the actualy bound key with the event
    var handleEvent = function(event,type) {
      if (_bound[type][event.keyCode] !== undefined) {
        var bound = _bound[type][event.keyCode];
        for (var i = 0; i < bound.length; i++) {
          if (bound[i].shift === undefined) {
            bound[i].fn(event);
          }
          else if (bound[i].shift == true && event.shiftKey == true) {
            bound[i].fn(event);
          }
          else if (bound[i].shift == false && event.shiftKey == false) {
            bound[i].fn(event);
          }
        }

        if (preventDefault == true) {
          event.preventDefault();
        }
      }
    };

    // bind a key to a callback
    _exportFunctions.bind = function(key, callback, type) {
      if (type === undefined) {
        type = 'keydown';
      }
      if (_keys[key] === undefined) {
        throw new Error("unsupported key: " + key);
      }
      if (_bound[type][_keys[key].code] === undefined) {
        _bound[type][_keys[key].code] = [];
      }
      _bound[type][_keys[key].code].push({fn:callback, shift:_keys[key].shift});
    };


    // bind all keys to a call back (demo purposes)
    _exportFunctions.bindAll = function(callback, type) {
      if (type === undefined) {
        type = 'keydown';
      }
      for (var key in _keys) {
        if (_keys.hasOwnProperty(key)) {
          _exportFunctions.bind(key,callback,type);
        }
      }
    };

    // get the key label from an event
    _exportFunctions.getKey = function(event) {
      for (var key in _keys) {
        if (_keys.hasOwnProperty(key)) {
          if (event.shiftKey == true && _keys[key].shift == true && event.keyCode == _keys[key].code) {
            return key;
          }
          else if (event.shiftKey == false && _keys[key].shift == false && event.keyCode == _keys[key].code) {
            return key;
          }
          else if (event.keyCode == _keys[key].code && key == 'shift') {
            return key;
          }
        }
      }
      return "unknown key, currently not supported";
    };

    // unbind either a specific callback from a key or all of them (by leaving callback undefined)
    _exportFunctions.unbind = function(key, callback, type) {
      if (type === undefined) {
        type = 'keydown';
      }
      if (_keys[key] === undefined) {
        throw new Error("unsupported key: " + key);
      }
      if (callback !== undefined) {
        var newBindings = [];
        var bound = _bound[type][_keys[key].code];
        if (bound !== undefined) {
          for (var i = 0; i < bound.length; i++) {
            if (!(bound[i].fn == callback && bound[i].shift == _keys[key].shift)) {
              newBindings.push(_bound[type][_keys[key].code][i]);
            }
          }
        }
        _bound[type][_keys[key].code] = newBindings;
      }
      else {
        _bound[type][_keys[key].code] = [];
      }
    };

    // reset all bound variables.
    _exportFunctions.reset = function() {
      _bound = {keydown:{}, keyup:{}};
    };

    // unbind all listeners and reset all variables.
    _exportFunctions.destroy = function() {
      _bound = {keydown:{}, keyup:{}};
      container.removeEventListener('keydown', down, true);
      container.removeEventListener('keyup', up, true);
    };

    // create listeners.
    container.addEventListener('keydown',down,true);
    container.addEventListener('keyup',up,true);

    // return the public functions.
    return _exportFunctions;
  }

  return keycharm;
}));



},{}],35:[function(require,module,exports){
(function (global){
//! moment.js
//! version : 2.9.0
//! authors : Tim Wood, Iskren Chernev, Moment.js contributors
//! license : MIT
//! momentjs.com

(function (undefined) {
    /************************************
        Constants
    ************************************/

    var moment,
        VERSION = '2.9.0',
        // the global-scope this is NOT the global object in Node.js
        globalScope = (typeof global !== 'undefined' && (typeof window === 'undefined' || window === global.window)) ? global : this,
        oldGlobalMoment,
        round = Math.round,
        hasOwnProperty = Object.prototype.hasOwnProperty,
        i,

        YEAR = 0,
        MONTH = 1,
        DATE = 2,
        HOUR = 3,
        MINUTE = 4,
        SECOND = 5,
        MILLISECOND = 6,

        // internal storage for locale config files
        locales = {},

        // extra moment internal properties (plugins register props here)
        momentProperties = [],

        // check for nodeJS
        hasModule = (typeof module !== 'undefined' && module && module.exports),

        // ASP.NET json date format regex
        aspNetJsonRegex = /^\/?Date\((\-?\d+)/i,
        aspNetTimeSpanJsonRegex = /(\-)?(?:(\d*)\.)?(\d+)\:(\d+)(?:\:(\d+)\.?(\d{3})?)?/,

        // from http://docs.closure-library.googlecode.com/git/closure_goog_date_date.js.source.html
        // somewhat more in line with 4.4.3.2 2004 spec, but allows decimal anywhere
        isoDurationRegex = /^(-)?P(?:(?:([0-9,.]*)Y)?(?:([0-9,.]*)M)?(?:([0-9,.]*)D)?(?:T(?:([0-9,.]*)H)?(?:([0-9,.]*)M)?(?:([0-9,.]*)S)?)?|([0-9,.]*)W)$/,

        // format tokens
        formattingTokens = /(\[[^\[]*\])|(\\)?(Mo|MM?M?M?|Do|DDDo|DD?D?D?|ddd?d?|do?|w[o|w]?|W[o|W]?|Q|YYYYYY|YYYYY|YYYY|YY|gg(ggg?)?|GG(GGG?)?|e|E|a|A|hh?|HH?|mm?|ss?|S{1,4}|x|X|zz?|ZZ?|.)/g,
        localFormattingTokens = /(\[[^\[]*\])|(\\)?(LTS|LT|LL?L?L?|l{1,4})/g,

        // parsing token regexes
        parseTokenOneOrTwoDigits = /\d\d?/, // 0 - 99
        parseTokenOneToThreeDigits = /\d{1,3}/, // 0 - 999
        parseTokenOneToFourDigits = /\d{1,4}/, // 0 - 9999
        parseTokenOneToSixDigits = /[+\-]?\d{1,6}/, // -999,999 - 999,999
        parseTokenDigits = /\d+/, // nonzero number of digits
        parseTokenWord = /[0-9]*['a-z\u00A0-\u05FF\u0700-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]+|[\u0600-\u06FF\/]+(\s*?[\u0600-\u06FF]+){1,2}/i, // any word (or two) characters or numbers including two/three word month in arabic.
        parseTokenTimezone = /Z|[\+\-]\d\d:?\d\d/gi, // +00:00 -00:00 +0000 -0000 or Z
        parseTokenT = /T/i, // T (ISO separator)
        parseTokenOffsetMs = /[\+\-]?\d+/, // 1234567890123
        parseTokenTimestampMs = /[\+\-]?\d+(\.\d{1,3})?/, // 123456789 123456789.123

        //strict parsing regexes
        parseTokenOneDigit = /\d/, // 0 - 9
        parseTokenTwoDigits = /\d\d/, // 00 - 99
        parseTokenThreeDigits = /\d{3}/, // 000 - 999
        parseTokenFourDigits = /\d{4}/, // 0000 - 9999
        parseTokenSixDigits = /[+-]?\d{6}/, // -999,999 - 999,999
        parseTokenSignedNumber = /[+-]?\d+/, // -inf - inf

        // iso 8601 regex
        // 0000-00-00 0000-W00 or 0000-W00-0 + T + 00 or 00:00 or 00:00:00 or 00:00:00.000 + +00:00 or +0000 or +00)
        isoRegex = /^\s*(?:[+-]\d{6}|\d{4})-(?:(\d\d-\d\d)|(W\d\d$)|(W\d\d-\d)|(\d\d\d))((T| )(\d\d(:\d\d(:\d\d(\.\d+)?)?)?)?([\+\-]\d\d(?::?\d\d)?|\s*Z)?)?$/,

        isoFormat = 'YYYY-MM-DDTHH:mm:ssZ',

        isoDates = [
            ['YYYYYY-MM-DD', /[+-]\d{6}-\d{2}-\d{2}/],
            ['YYYY-MM-DD', /\d{4}-\d{2}-\d{2}/],
            ['GGGG-[W]WW-E', /\d{4}-W\d{2}-\d/],
            ['GGGG-[W]WW', /\d{4}-W\d{2}/],
            ['YYYY-DDD', /\d{4}-\d{3}/]
        ],

        // iso time formats and regexes
        isoTimes = [
            ['HH:mm:ss.SSSS', /(T| )\d\d:\d\d:\d\d\.\d+/],
            ['HH:mm:ss', /(T| )\d\d:\d\d:\d\d/],
            ['HH:mm', /(T| )\d\d:\d\d/],
            ['HH', /(T| )\d\d/]
        ],

        // timezone chunker '+10:00' > ['10', '00'] or '-1530' > ['-', '15', '30']
        parseTimezoneChunker = /([\+\-]|\d\d)/gi,

        // getter and setter names
        proxyGettersAndSetters = 'Date|Hours|Minutes|Seconds|Milliseconds'.split('|'),
        unitMillisecondFactors = {
            'Milliseconds' : 1,
            'Seconds' : 1e3,
            'Minutes' : 6e4,
            'Hours' : 36e5,
            'Days' : 864e5,
            'Months' : 2592e6,
            'Years' : 31536e6
        },

        unitAliases = {
            ms : 'millisecond',
            s : 'second',
            m : 'minute',
            h : 'hour',
            d : 'day',
            D : 'date',
            w : 'week',
            W : 'isoWeek',
            M : 'month',
            Q : 'quarter',
            y : 'year',
            DDD : 'dayOfYear',
            e : 'weekday',
            E : 'isoWeekday',
            gg: 'weekYear',
            GG: 'isoWeekYear'
        },

        camelFunctions = {
            dayofyear : 'dayOfYear',
            isoweekday : 'isoWeekday',
            isoweek : 'isoWeek',
            weekyear : 'weekYear',
            isoweekyear : 'isoWeekYear'
        },

        // format function strings
        formatFunctions = {},

        // default relative time thresholds
        relativeTimeThresholds = {
            s: 45,  // seconds to minute
            m: 45,  // minutes to hour
            h: 22,  // hours to day
            d: 26,  // days to month
            M: 11   // months to year
        },

        // tokens to ordinalize and pad
        ordinalizeTokens = 'DDD w W M D d'.split(' '),
        paddedTokens = 'M D H h m s w W'.split(' '),

        formatTokenFunctions = {
            M    : function () {
                return this.month() + 1;
            },
            MMM  : function (format) {
                return this.localeData().monthsShort(this, format);
            },
            MMMM : function (format) {
                return this.localeData().months(this, format);
            },
            D    : function () {
                return this.date();
            },
            DDD  : function () {
                return this.dayOfYear();
            },
            d    : function () {
                return this.day();
            },
            dd   : function (format) {
                return this.localeData().weekdaysMin(this, format);
            },
            ddd  : function (format) {
                return this.localeData().weekdaysShort(this, format);
            },
            dddd : function (format) {
                return this.localeData().weekdays(this, format);
            },
            w    : function () {
                return this.week();
            },
            W    : function () {
                return this.isoWeek();
            },
            YY   : function () {
                return leftZeroFill(this.year() % 100, 2);
            },
            YYYY : function () {
                return leftZeroFill(this.year(), 4);
            },
            YYYYY : function () {
                return leftZeroFill(this.year(), 5);
            },
            YYYYYY : function () {
                var y = this.year(), sign = y >= 0 ? '+' : '-';
                return sign + leftZeroFill(Math.abs(y), 6);
            },
            gg   : function () {
                return leftZeroFill(this.weekYear() % 100, 2);
            },
            gggg : function () {
                return leftZeroFill(this.weekYear(), 4);
            },
            ggggg : function () {
                return leftZeroFill(this.weekYear(), 5);
            },
            GG   : function () {
                return leftZeroFill(this.isoWeekYear() % 100, 2);
            },
            GGGG : function () {
                return leftZeroFill(this.isoWeekYear(), 4);
            },
            GGGGG : function () {
                return leftZeroFill(this.isoWeekYear(), 5);
            },
            e : function () {
                return this.weekday();
            },
            E : function () {
                return this.isoWeekday();
            },
            a    : function () {
                return this.localeData().meridiem(this.hours(), this.minutes(), true);
            },
            A    : function () {
                return this.localeData().meridiem(this.hours(), this.minutes(), false);
            },
            H    : function () {
                return this.hours();
            },
            h    : function () {
                return this.hours() % 12 || 12;
            },
            m    : function () {
                return this.minutes();
            },
            s    : function () {
                return this.seconds();
            },
            S    : function () {
                return toInt(this.milliseconds() / 100);
            },
            SS   : function () {
                return leftZeroFill(toInt(this.milliseconds() / 10), 2);
            },
            SSS  : function () {
                return leftZeroFill(this.milliseconds(), 3);
            },
            SSSS : function () {
                return leftZeroFill(this.milliseconds(), 3);
            },
            Z    : function () {
                var a = this.utcOffset(),
                    b = '+';
                if (a < 0) {
                    a = -a;
                    b = '-';
                }
                return b + leftZeroFill(toInt(a / 60), 2) + ':' + leftZeroFill(toInt(a) % 60, 2);
            },
            ZZ   : function () {
                var a = this.utcOffset(),
                    b = '+';
                if (a < 0) {
                    a = -a;
                    b = '-';
                }
                return b + leftZeroFill(toInt(a / 60), 2) + leftZeroFill(toInt(a) % 60, 2);
            },
            z : function () {
                return this.zoneAbbr();
            },
            zz : function () {
                return this.zoneName();
            },
            x    : function () {
                return this.valueOf();
            },
            X    : function () {
                return this.unix();
            },
            Q : function () {
                return this.quarter();
            }
        },

        deprecations = {},

        lists = ['months', 'monthsShort', 'weekdays', 'weekdaysShort', 'weekdaysMin'],

        updateInProgress = false;

    // Pick the first defined of two or three arguments. dfl comes from
    // default.
    function dfl(a, b, c) {
        switch (arguments.length) {
            case 2: return a != null ? a : b;
            case 3: return a != null ? a : b != null ? b : c;
            default: throw new Error('Implement me');
        }
    }

    function hasOwnProp(a, b) {
        return hasOwnProperty.call(a, b);
    }

    function defaultParsingFlags() {
        // We need to deep clone this object, and es5 standard is not very
        // helpful.
        return {
            empty : false,
            unusedTokens : [],
            unusedInput : [],
            overflow : -2,
            charsLeftOver : 0,
            nullInput : false,
            invalidMonth : null,
            invalidFormat : false,
            userInvalidated : false,
            iso: false
        };
    }

    function printMsg(msg) {
        if (moment.suppressDeprecationWarnings === false &&
                typeof console !== 'undefined' && console.warn) {
            console.warn('Deprecation warning: ' + msg);
        }
    }

    function deprecate(msg, fn) {
        var firstTime = true;
        return extend(function () {
            if (firstTime) {
                printMsg(msg);
                firstTime = false;
            }
            return fn.apply(this, arguments);
        }, fn);
    }

    function deprecateSimple(name, msg) {
        if (!deprecations[name]) {
            printMsg(msg);
            deprecations[name] = true;
        }
    }

    function padToken(func, count) {
        return function (a) {
            return leftZeroFill(func.call(this, a), count);
        };
    }
    function ordinalizeToken(func, period) {
        return function (a) {
            return this.localeData().ordinal(func.call(this, a), period);
        };
    }

    function monthDiff(a, b) {
        // difference in months
        var wholeMonthDiff = ((b.year() - a.year()) * 12) + (b.month() - a.month()),
            // b is in (anchor - 1 month, anchor + 1 month)
            anchor = a.clone().add(wholeMonthDiff, 'months'),
            anchor2, adjust;

        if (b - anchor < 0) {
            anchor2 = a.clone().add(wholeMonthDiff - 1, 'months');
            // linear across the month
            adjust = (b - anchor) / (anchor - anchor2);
        } else {
            anchor2 = a.clone().add(wholeMonthDiff + 1, 'months');
            // linear across the month
            adjust = (b - anchor) / (anchor2 - anchor);
        }

        return -(wholeMonthDiff + adjust);
    }

    while (ordinalizeTokens.length) {
        i = ordinalizeTokens.pop();
        formatTokenFunctions[i + 'o'] = ordinalizeToken(formatTokenFunctions[i], i);
    }
    while (paddedTokens.length) {
        i = paddedTokens.pop();
        formatTokenFunctions[i + i] = padToken(formatTokenFunctions[i], 2);
    }
    formatTokenFunctions.DDDD = padToken(formatTokenFunctions.DDD, 3);


    function meridiemFixWrap(locale, hour, meridiem) {
        var isPm;

        if (meridiem == null) {
            // nothing to do
            return hour;
        }
        if (locale.meridiemHour != null) {
            return locale.meridiemHour(hour, meridiem);
        } else if (locale.isPM != null) {
            // Fallback
            isPm = locale.isPM(meridiem);
            if (isPm && hour < 12) {
                hour += 12;
            }
            if (!isPm && hour === 12) {
                hour = 0;
            }
            return hour;
        } else {
            // thie is not supposed to happen
            return hour;
        }
    }

    /************************************
        Constructors
    ************************************/

    function Locale() {
    }

    // Moment prototype object
    function Moment(config, skipOverflow) {
        if (skipOverflow !== false) {
            checkOverflow(config);
        }
        copyConfig(this, config);
        this._d = new Date(+config._d);
        // Prevent infinite loop in case updateOffset creates new moment
        // objects.
        if (updateInProgress === false) {
            updateInProgress = true;
            moment.updateOffset(this);
            updateInProgress = false;
        }
    }

    // Duration Constructor
    function Duration(duration) {
        var normalizedInput = normalizeObjectUnits(duration),
            years = normalizedInput.year || 0,
            quarters = normalizedInput.quarter || 0,
            months = normalizedInput.month || 0,
            weeks = normalizedInput.week || 0,
            days = normalizedInput.day || 0,
            hours = normalizedInput.hour || 0,
            minutes = normalizedInput.minute || 0,
            seconds = normalizedInput.second || 0,
            milliseconds = normalizedInput.millisecond || 0;

        // representation for dateAddRemove
        this._milliseconds = +milliseconds +
            seconds * 1e3 + // 1000
            minutes * 6e4 + // 1000 * 60
            hours * 36e5; // 1000 * 60 * 60
        // Because of dateAddRemove treats 24 hours as different from a
        // day when working around DST, we need to store them separately
        this._days = +days +
            weeks * 7;
        // It is impossible translate months into days without knowing
        // which months you are are talking about, so we have to store
        // it separately.
        this._months = +months +
            quarters * 3 +
            years * 12;

        this._data = {};

        this._locale = moment.localeData();

        this._bubble();
    }

    /************************************
        Helpers
    ************************************/


    function extend(a, b) {
        for (var i in b) {
            if (hasOwnProp(b, i)) {
                a[i] = b[i];
            }
        }

        if (hasOwnProp(b, 'toString')) {
            a.toString = b.toString;
        }

        if (hasOwnProp(b, 'valueOf')) {
            a.valueOf = b.valueOf;
        }

        return a;
    }

    function copyConfig(to, from) {
        var i, prop, val;

        if (typeof from._isAMomentObject !== 'undefined') {
            to._isAMomentObject = from._isAMomentObject;
        }
        if (typeof from._i !== 'undefined') {
            to._i = from._i;
        }
        if (typeof from._f !== 'undefined') {
            to._f = from._f;
        }
        if (typeof from._l !== 'undefined') {
            to._l = from._l;
        }
        if (typeof from._strict !== 'undefined') {
            to._strict = from._strict;
        }
        if (typeof from._tzm !== 'undefined') {
            to._tzm = from._tzm;
        }
        if (typeof from._isUTC !== 'undefined') {
            to._isUTC = from._isUTC;
        }
        if (typeof from._offset !== 'undefined') {
            to._offset = from._offset;
        }
        if (typeof from._pf !== 'undefined') {
            to._pf = from._pf;
        }
        if (typeof from._locale !== 'undefined') {
            to._locale = from._locale;
        }

        if (momentProperties.length > 0) {
            for (i in momentProperties) {
                prop = momentProperties[i];
                val = from[prop];
                if (typeof val !== 'undefined') {
                    to[prop] = val;
                }
            }
        }

        return to;
    }

    function absRound(number) {
        if (number < 0) {
            return Math.ceil(number);
        } else {
            return Math.floor(number);
        }
    }

    // left zero fill a number
    // see http://jsperf.com/left-zero-filling for performance comparison
    function leftZeroFill(number, targetLength, forceSign) {
        var output = '' + Math.abs(number),
            sign = number >= 0;

        while (output.length < targetLength) {
            output = '0' + output;
        }
        return (sign ? (forceSign ? '+' : '') : '-') + output;
    }

    function positiveMomentsDifference(base, other) {
        var res = {milliseconds: 0, months: 0};

        res.months = other.month() - base.month() +
            (other.year() - base.year()) * 12;
        if (base.clone().add(res.months, 'M').isAfter(other)) {
            --res.months;
        }

        res.milliseconds = +other - +(base.clone().add(res.months, 'M'));

        return res;
    }

    function momentsDifference(base, other) {
        var res;
        other = makeAs(other, base);
        if (base.isBefore(other)) {
            res = positiveMomentsDifference(base, other);
        } else {
            res = positiveMomentsDifference(other, base);
            res.milliseconds = -res.milliseconds;
            res.months = -res.months;
        }

        return res;
    }

    // TODO: remove 'name' arg after deprecation is removed
    function createAdder(direction, name) {
        return function (val, period) {
            var dur, tmp;
            //invert the arguments, but complain about it
            if (period !== null && !isNaN(+period)) {
                deprecateSimple(name, 'moment().' + name  + '(period, number) is deprecated. Please use moment().' + name + '(number, period).');
                tmp = val; val = period; period = tmp;
            }

            val = typeof val === 'string' ? +val : val;
            dur = moment.duration(val, period);
            addOrSubtractDurationFromMoment(this, dur, direction);
            return this;
        };
    }

    function addOrSubtractDurationFromMoment(mom, duration, isAdding, updateOffset) {
        var milliseconds = duration._milliseconds,
            days = duration._days,
            months = duration._months;
        updateOffset = updateOffset == null ? true : updateOffset;

        if (milliseconds) {
            mom._d.setTime(+mom._d + milliseconds * isAdding);
        }
        if (days) {
            rawSetter(mom, 'Date', rawGetter(mom, 'Date') + days * isAdding);
        }
        if (months) {
            rawMonthSetter(mom, rawGetter(mom, 'Month') + months * isAdding);
        }
        if (updateOffset) {
            moment.updateOffset(mom, days || months);
        }
    }

    // check if is an array
    function isArray(input) {
        return Object.prototype.toString.call(input) === '[object Array]';
    }

    function isDate(input) {
        return Object.prototype.toString.call(input) === '[object Date]' ||
            input instanceof Date;
    }

    // compare two arrays, return the number of differences
    function compareArrays(array1, array2, dontConvert) {
        var len = Math.min(array1.length, array2.length),
            lengthDiff = Math.abs(array1.length - array2.length),
            diffs = 0,
            i;
        for (i = 0; i < len; i++) {
            if ((dontConvert && array1[i] !== array2[i]) ||
                (!dontConvert && toInt(array1[i]) !== toInt(array2[i]))) {
                diffs++;
            }
        }
        return diffs + lengthDiff;
    }

    function normalizeUnits(units) {
        if (units) {
            var lowered = units.toLowerCase().replace(/(.)s$/, '$1');
            units = unitAliases[units] || camelFunctions[lowered] || lowered;
        }
        return units;
    }

    function normalizeObjectUnits(inputObject) {
        var normalizedInput = {},
            normalizedProp,
            prop;

        for (prop in inputObject) {
            if (hasOwnProp(inputObject, prop)) {
                normalizedProp = normalizeUnits(prop);
                if (normalizedProp) {
                    normalizedInput[normalizedProp] = inputObject[prop];
                }
            }
        }

        return normalizedInput;
    }

    function makeList(field) {
        var count, setter;

        if (field.indexOf('week') === 0) {
            count = 7;
            setter = 'day';
        }
        else if (field.indexOf('month') === 0) {
            count = 12;
            setter = 'month';
        }
        else {
            return;
        }

        moment[field] = function (format, index) {
            var i, getter,
                method = moment._locale[field],
                results = [];

            if (typeof format === 'number') {
                index = format;
                format = undefined;
            }

            getter = function (i) {
                var m = moment().utc().set(setter, i);
                return method.call(moment._locale, m, format || '');
            };

            if (index != null) {
                return getter(index);
            }
            else {
                for (i = 0; i < count; i++) {
                    results.push(getter(i));
                }
                return results;
            }
        };
    }

    function toInt(argumentForCoercion) {
        var coercedNumber = +argumentForCoercion,
            value = 0;

        if (coercedNumber !== 0 && isFinite(coercedNumber)) {
            if (coercedNumber >= 0) {
                value = Math.floor(coercedNumber);
            } else {
                value = Math.ceil(coercedNumber);
            }
        }

        return value;
    }

    function daysInMonth(year, month) {
        return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    }

    function weeksInYear(year, dow, doy) {
        return weekOfYear(moment([year, 11, 31 + dow - doy]), dow, doy).week;
    }

    function daysInYear(year) {
        return isLeapYear(year) ? 366 : 365;
    }

    function isLeapYear(year) {
        return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    }

    function checkOverflow(m) {
        var overflow;
        if (m._a && m._pf.overflow === -2) {
            overflow =
                m._a[MONTH] < 0 || m._a[MONTH] > 11 ? MONTH :
                m._a[DATE] < 1 || m._a[DATE] > daysInMonth(m._a[YEAR], m._a[MONTH]) ? DATE :
                m._a[HOUR] < 0 || m._a[HOUR] > 24 ||
                    (m._a[HOUR] === 24 && (m._a[MINUTE] !== 0 ||
                                           m._a[SECOND] !== 0 ||
                                           m._a[MILLISECOND] !== 0)) ? HOUR :
                m._a[MINUTE] < 0 || m._a[MINUTE] > 59 ? MINUTE :
                m._a[SECOND] < 0 || m._a[SECOND] > 59 ? SECOND :
                m._a[MILLISECOND] < 0 || m._a[MILLISECOND] > 999 ? MILLISECOND :
                -1;

            if (m._pf._overflowDayOfYear && (overflow < YEAR || overflow > DATE)) {
                overflow = DATE;
            }

            m._pf.overflow = overflow;
        }
    }

    function isValid(m) {
        if (m._isValid == null) {
            m._isValid = !isNaN(m._d.getTime()) &&
                m._pf.overflow < 0 &&
                !m._pf.empty &&
                !m._pf.invalidMonth &&
                !m._pf.nullInput &&
                !m._pf.invalidFormat &&
                !m._pf.userInvalidated;

            if (m._strict) {
                m._isValid = m._isValid &&
                    m._pf.charsLeftOver === 0 &&
                    m._pf.unusedTokens.length === 0 &&
                    m._pf.bigHour === undefined;
            }
        }
        return m._isValid;
    }

    function normalizeLocale(key) {
        return key ? key.toLowerCase().replace('_', '-') : key;
    }

    // pick the locale from the array
    // try ['en-au', 'en-gb'] as 'en-au', 'en-gb', 'en', as in move through the list trying each
    // substring from most specific to least, but move to the next array item if it's a more specific variant than the current root
    function chooseLocale(names) {
        var i = 0, j, next, locale, split;

        while (i < names.length) {
            split = normalizeLocale(names[i]).split('-');
            j = split.length;
            next = normalizeLocale(names[i + 1]);
            next = next ? next.split('-') : null;
            while (j > 0) {
                locale = loadLocale(split.slice(0, j).join('-'));
                if (locale) {
                    return locale;
                }
                if (next && next.length >= j && compareArrays(split, next, true) >= j - 1) {
                    //the next array item is better than a shallower substring of this one
                    break;
                }
                j--;
            }
            i++;
        }
        return null;
    }

    function loadLocale(name) {
        var oldLocale = null;
        if (!locales[name] && hasModule) {
            try {
                oldLocale = moment.locale();
                require('./locale/' + name);
                // because defineLocale currently also sets the global locale, we want to undo that for lazy loaded locales
                moment.locale(oldLocale);
            } catch (e) { }
        }
        return locales[name];
    }

    // Return a moment from input, that is local/utc/utcOffset equivalent to
    // model.
    function makeAs(input, model) {
        var res, diff;
        if (model._isUTC) {
            res = model.clone();
            diff = (moment.isMoment(input) || isDate(input) ?
                    +input : +moment(input)) - (+res);
            // Use low-level api, because this fn is low-level api.
            res._d.setTime(+res._d + diff);
            moment.updateOffset(res, false);
            return res;
        } else {
            return moment(input).local();
        }
    }

    /************************************
        Locale
    ************************************/


    extend(Locale.prototype, {

        set : function (config) {
            var prop, i;
            for (i in config) {
                prop = config[i];
                if (typeof prop === 'function') {
                    this[i] = prop;
                } else {
                    this['_' + i] = prop;
                }
            }
            // Lenient ordinal parsing accepts just a number in addition to
            // number + (possibly) stuff coming from _ordinalParseLenient.
            this._ordinalParseLenient = new RegExp(this._ordinalParse.source + '|' + /\d{1,2}/.source);
        },

        _months : 'January_February_March_April_May_June_July_August_September_October_November_December'.split('_'),
        months : function (m) {
            return this._months[m.month()];
        },

        _monthsShort : 'Jan_Feb_Mar_Apr_May_Jun_Jul_Aug_Sep_Oct_Nov_Dec'.split('_'),
        monthsShort : function (m) {
            return this._monthsShort[m.month()];
        },

        monthsParse : function (monthName, format, strict) {
            var i, mom, regex;

            if (!this._monthsParse) {
                this._monthsParse = [];
                this._longMonthsParse = [];
                this._shortMonthsParse = [];
            }

            for (i = 0; i < 12; i++) {
                // make the regex if we don't have it already
                mom = moment.utc([2000, i]);
                if (strict && !this._longMonthsParse[i]) {
                    this._longMonthsParse[i] = new RegExp('^' + this.months(mom, '').replace('.', '') + '$', 'i');
                    this._shortMonthsParse[i] = new RegExp('^' + this.monthsShort(mom, '').replace('.', '') + '$', 'i');
                }
                if (!strict && !this._monthsParse[i]) {
                    regex = '^' + this.months(mom, '') + '|^' + this.monthsShort(mom, '');
                    this._monthsParse[i] = new RegExp(regex.replace('.', ''), 'i');
                }
                // test the regex
                if (strict && format === 'MMMM' && this._longMonthsParse[i].test(monthName)) {
                    return i;
                } else if (strict && format === 'MMM' && this._shortMonthsParse[i].test(monthName)) {
                    return i;
                } else if (!strict && this._monthsParse[i].test(monthName)) {
                    return i;
                }
            }
        },

        _weekdays : 'Sunday_Monday_Tuesday_Wednesday_Thursday_Friday_Saturday'.split('_'),
        weekdays : function (m) {
            return this._weekdays[m.day()];
        },

        _weekdaysShort : 'Sun_Mon_Tue_Wed_Thu_Fri_Sat'.split('_'),
        weekdaysShort : function (m) {
            return this._weekdaysShort[m.day()];
        },

        _weekdaysMin : 'Su_Mo_Tu_We_Th_Fr_Sa'.split('_'),
        weekdaysMin : function (m) {
            return this._weekdaysMin[m.day()];
        },

        weekdaysParse : function (weekdayName) {
            var i, mom, regex;

            if (!this._weekdaysParse) {
                this._weekdaysParse = [];
            }

            for (i = 0; i < 7; i++) {
                // make the regex if we don't have it already
                if (!this._weekdaysParse[i]) {
                    mom = moment([2000, 1]).day(i);
                    regex = '^' + this.weekdays(mom, '') + '|^' + this.weekdaysShort(mom, '') + '|^' + this.weekdaysMin(mom, '');
                    this._weekdaysParse[i] = new RegExp(regex.replace('.', ''), 'i');
                }
                // test the regex
                if (this._weekdaysParse[i].test(weekdayName)) {
                    return i;
                }
            }
        },

        _longDateFormat : {
            LTS : 'h:mm:ss A',
            LT : 'h:mm A',
            L : 'MM/DD/YYYY',
            LL : 'MMMM D, YYYY',
            LLL : 'MMMM D, YYYY LT',
            LLLL : 'dddd, MMMM D, YYYY LT'
        },
        longDateFormat : function (key) {
            var output = this._longDateFormat[key];
            if (!output && this._longDateFormat[key.toUpperCase()]) {
                output = this._longDateFormat[key.toUpperCase()].replace(/MMMM|MM|DD|dddd/g, function (val) {
                    return val.slice(1);
                });
                this._longDateFormat[key] = output;
            }
            return output;
        },

        isPM : function (input) {
            // IE8 Quirks Mode & IE7 Standards Mode do not allow accessing strings like arrays
            // Using charAt should be more compatible.
            return ((input + '').toLowerCase().charAt(0) === 'p');
        },

        _meridiemParse : /[ap]\.?m?\.?/i,
        meridiem : function (hours, minutes, isLower) {
            if (hours > 11) {
                return isLower ? 'pm' : 'PM';
            } else {
                return isLower ? 'am' : 'AM';
            }
        },


        _calendar : {
            sameDay : '[Today at] LT',
            nextDay : '[Tomorrow at] LT',
            nextWeek : 'dddd [at] LT',
            lastDay : '[Yesterday at] LT',
            lastWeek : '[Last] dddd [at] LT',
            sameElse : 'L'
        },
        calendar : function (key, mom, now) {
            var output = this._calendar[key];
            return typeof output === 'function' ? output.apply(mom, [now]) : output;
        },

        _relativeTime : {
            future : 'in %s',
            past : '%s ago',
            s : 'a few seconds',
            m : 'a minute',
            mm : '%d minutes',
            h : 'an hour',
            hh : '%d hours',
            d : 'a day',
            dd : '%d days',
            M : 'a month',
            MM : '%d months',
            y : 'a year',
            yy : '%d years'
        },

        relativeTime : function (number, withoutSuffix, string, isFuture) {
            var output = this._relativeTime[string];
            return (typeof output === 'function') ?
                output(number, withoutSuffix, string, isFuture) :
                output.replace(/%d/i, number);
        },

        pastFuture : function (diff, output) {
            var format = this._relativeTime[diff > 0 ? 'future' : 'past'];
            return typeof format === 'function' ? format(output) : format.replace(/%s/i, output);
        },

        ordinal : function (number) {
            return this._ordinal.replace('%d', number);
        },
        _ordinal : '%d',
        _ordinalParse : /\d{1,2}/,

        preparse : function (string) {
            return string;
        },

        postformat : function (string) {
            return string;
        },

        week : function (mom) {
            return weekOfYear(mom, this._week.dow, this._week.doy).week;
        },

        _week : {
            dow : 0, // Sunday is the first day of the week.
            doy : 6  // The week that contains Jan 1st is the first week of the year.
        },

        firstDayOfWeek : function () {
            return this._week.dow;
        },

        firstDayOfYear : function () {
            return this._week.doy;
        },

        _invalidDate: 'Invalid date',
        invalidDate: function () {
            return this._invalidDate;
        }
    });

    /************************************
        Formatting
    ************************************/


    function removeFormattingTokens(input) {
        if (input.match(/\[[\s\S]/)) {
            return input.replace(/^\[|\]$/g, '');
        }
        return input.replace(/\\/g, '');
    }

    function makeFormatFunction(format) {
        var array = format.match(formattingTokens), i, length;

        for (i = 0, length = array.length; i < length; i++) {
            if (formatTokenFunctions[array[i]]) {
                array[i] = formatTokenFunctions[array[i]];
            } else {
                array[i] = removeFormattingTokens(array[i]);
            }
        }

        return function (mom) {
            var output = '';
            for (i = 0; i < length; i++) {
                output += array[i] instanceof Function ? array[i].call(mom, format) : array[i];
            }
            return output;
        };
    }

    // format date using native date object
    function formatMoment(m, format) {
        if (!m.isValid()) {
            return m.localeData().invalidDate();
        }

        format = expandFormat(format, m.localeData());

        if (!formatFunctions[format]) {
            formatFunctions[format] = makeFormatFunction(format);
        }

        return formatFunctions[format](m);
    }

    function expandFormat(format, locale) {
        var i = 5;

        function replaceLongDateFormatTokens(input) {
            return locale.longDateFormat(input) || input;
        }

        localFormattingTokens.lastIndex = 0;
        while (i >= 0 && localFormattingTokens.test(format)) {
            format = format.replace(localFormattingTokens, replaceLongDateFormatTokens);
            localFormattingTokens.lastIndex = 0;
            i -= 1;
        }

        return format;
    }


    /************************************
        Parsing
    ************************************/


    // get the regex to find the next token
    function getParseRegexForToken(token, config) {
        var a, strict = config._strict;
        switch (token) {
        case 'Q':
            return parseTokenOneDigit;
        case 'DDDD':
            return parseTokenThreeDigits;
        case 'YYYY':
        case 'GGGG':
        case 'gggg':
            return strict ? parseTokenFourDigits : parseTokenOneToFourDigits;
        case 'Y':
        case 'G':
        case 'g':
            return parseTokenSignedNumber;
        case 'YYYYYY':
        case 'YYYYY':
        case 'GGGGG':
        case 'ggggg':
            return strict ? parseTokenSixDigits : parseTokenOneToSixDigits;
        case 'S':
            if (strict) {
                return parseTokenOneDigit;
            }
            /* falls through */
        case 'SS':
            if (strict) {
                return parseTokenTwoDigits;
            }
            /* falls through */
        case 'SSS':
            if (strict) {
                return parseTokenThreeDigits;
            }
            /* falls through */
        case 'DDD':
            return parseTokenOneToThreeDigits;
        case 'MMM':
        case 'MMMM':
        case 'dd':
        case 'ddd':
        case 'dddd':
            return parseTokenWord;
        case 'a':
        case 'A':
            return config._locale._meridiemParse;
        case 'x':
            return parseTokenOffsetMs;
        case 'X':
            return parseTokenTimestampMs;
        case 'Z':
        case 'ZZ':
            return parseTokenTimezone;
        case 'T':
            return parseTokenT;
        case 'SSSS':
            return parseTokenDigits;
        case 'MM':
        case 'DD':
        case 'YY':
        case 'GG':
        case 'gg':
        case 'HH':
        case 'hh':
        case 'mm':
        case 'ss':
        case 'ww':
        case 'WW':
            return strict ? parseTokenTwoDigits : parseTokenOneOrTwoDigits;
        case 'M':
        case 'D':
        case 'd':
        case 'H':
        case 'h':
        case 'm':
        case 's':
        case 'w':
        case 'W':
        case 'e':
        case 'E':
            return parseTokenOneOrTwoDigits;
        case 'Do':
            return strict ? config._locale._ordinalParse : config._locale._ordinalParseLenient;
        default :
            a = new RegExp(regexpEscape(unescapeFormat(token.replace('\\', '')), 'i'));
            return a;
        }
    }

    function utcOffsetFromString(string) {
        string = string || '';
        var possibleTzMatches = (string.match(parseTokenTimezone) || []),
            tzChunk = possibleTzMatches[possibleTzMatches.length - 1] || [],
            parts = (tzChunk + '').match(parseTimezoneChunker) || ['-', 0, 0],
            minutes = +(parts[1] * 60) + toInt(parts[2]);

        return parts[0] === '+' ? minutes : -minutes;
    }

    // function to convert string input to date
    function addTimeToArrayFromToken(token, input, config) {
        var a, datePartArray = config._a;

        switch (token) {
        // QUARTER
        case 'Q':
            if (input != null) {
                datePartArray[MONTH] = (toInt(input) - 1) * 3;
            }
            break;
        // MONTH
        case 'M' : // fall through to MM
        case 'MM' :
            if (input != null) {
                datePartArray[MONTH] = toInt(input) - 1;
            }
            break;
        case 'MMM' : // fall through to MMMM
        case 'MMMM' :
            a = config._locale.monthsParse(input, token, config._strict);
            // if we didn't find a month name, mark the date as invalid.
            if (a != null) {
                datePartArray[MONTH] = a;
            } else {
                config._pf.invalidMonth = input;
            }
            break;
        // DAY OF MONTH
        case 'D' : // fall through to DD
        case 'DD' :
            if (input != null) {
                datePartArray[DATE] = toInt(input);
            }
            break;
        case 'Do' :
            if (input != null) {
                datePartArray[DATE] = toInt(parseInt(
                            input.match(/\d{1,2}/)[0], 10));
            }
            break;
        // DAY OF YEAR
        case 'DDD' : // fall through to DDDD
        case 'DDDD' :
            if (input != null) {
                config._dayOfYear = toInt(input);
            }

            break;
        // YEAR
        case 'YY' :
            datePartArray[YEAR] = moment.parseTwoDigitYear(input);
            break;
        case 'YYYY' :
        case 'YYYYY' :
        case 'YYYYYY' :
            datePartArray[YEAR] = toInt(input);
            break;
        // AM / PM
        case 'a' : // fall through to A
        case 'A' :
            config._meridiem = input;
            // config._isPm = config._locale.isPM(input);
            break;
        // HOUR
        case 'h' : // fall through to hh
        case 'hh' :
            config._pf.bigHour = true;
            /* falls through */
        case 'H' : // fall through to HH
        case 'HH' :
            datePartArray[HOUR] = toInt(input);
            break;
        // MINUTE
        case 'm' : // fall through to mm
        case 'mm' :
            datePartArray[MINUTE] = toInt(input);
            break;
        // SECOND
        case 's' : // fall through to ss
        case 'ss' :
            datePartArray[SECOND] = toInt(input);
            break;
        // MILLISECOND
        case 'S' :
        case 'SS' :
        case 'SSS' :
        case 'SSSS' :
            datePartArray[MILLISECOND] = toInt(('0.' + input) * 1000);
            break;
        // UNIX OFFSET (MILLISECONDS)
        case 'x':
            config._d = new Date(toInt(input));
            break;
        // UNIX TIMESTAMP WITH MS
        case 'X':
            config._d = new Date(parseFloat(input) * 1000);
            break;
        // TIMEZONE
        case 'Z' : // fall through to ZZ
        case 'ZZ' :
            config._useUTC = true;
            config._tzm = utcOffsetFromString(input);
            break;
        // WEEKDAY - human
        case 'dd':
        case 'ddd':
        case 'dddd':
            a = config._locale.weekdaysParse(input);
            // if we didn't get a weekday name, mark the date as invalid
            if (a != null) {
                config._w = config._w || {};
                config._w['d'] = a;
            } else {
                config._pf.invalidWeekday = input;
            }
            break;
        // WEEK, WEEK DAY - numeric
        case 'w':
        case 'ww':
        case 'W':
        case 'WW':
        case 'd':
        case 'e':
        case 'E':
            token = token.substr(0, 1);
            /* falls through */
        case 'gggg':
        case 'GGGG':
        case 'GGGGG':
            token = token.substr(0, 2);
            if (input) {
                config._w = config._w || {};
                config._w[token] = toInt(input);
            }
            break;
        case 'gg':
        case 'GG':
            config._w = config._w || {};
            config._w[token] = moment.parseTwoDigitYear(input);
        }
    }

    function dayOfYearFromWeekInfo(config) {
        var w, weekYear, week, weekday, dow, doy, temp;

        w = config._w;
        if (w.GG != null || w.W != null || w.E != null) {
            dow = 1;
            doy = 4;

            // TODO: We need to take the current isoWeekYear, but that depends on
            // how we interpret now (local, utc, fixed offset). So create
            // a now version of current config (take local/utc/offset flags, and
            // create now).
            weekYear = dfl(w.GG, config._a[YEAR], weekOfYear(moment(), 1, 4).year);
            week = dfl(w.W, 1);
            weekday = dfl(w.E, 1);
        } else {
            dow = config._locale._week.dow;
            doy = config._locale._week.doy;

            weekYear = dfl(w.gg, config._a[YEAR], weekOfYear(moment(), dow, doy).year);
            week = dfl(w.w, 1);

            if (w.d != null) {
                // weekday -- low day numbers are considered next week
                weekday = w.d;
                if (weekday < dow) {
                    ++week;
                }
            } else if (w.e != null) {
                // local weekday -- counting starts from begining of week
                weekday = w.e + dow;
            } else {
                // default to begining of week
                weekday = dow;
            }
        }
        temp = dayOfYearFromWeeks(weekYear, week, weekday, doy, dow);

        config._a[YEAR] = temp.year;
        config._dayOfYear = temp.dayOfYear;
    }

    // convert an array to a date.
    // the array should mirror the parameters below
    // note: all values past the year are optional and will default to the lowest possible value.
    // [year, month, day , hour, minute, second, millisecond]
    function dateFromConfig(config) {
        var i, date, input = [], currentDate, yearToUse;

        if (config._d) {
            return;
        }

        currentDate = currentDateArray(config);

        //compute day of the year from weeks and weekdays
        if (config._w && config._a[DATE] == null && config._a[MONTH] == null) {
            dayOfYearFromWeekInfo(config);
        }

        //if the day of the year is set, figure out what it is
        if (config._dayOfYear) {
            yearToUse = dfl(config._a[YEAR], currentDate[YEAR]);

            if (config._dayOfYear > daysInYear(yearToUse)) {
                config._pf._overflowDayOfYear = true;
            }

            date = makeUTCDate(yearToUse, 0, config._dayOfYear);
            config._a[MONTH] = date.getUTCMonth();
            config._a[DATE] = date.getUTCDate();
        }

        // Default to current date.
        // * if no year, month, day of month are given, default to today
        // * if day of month is given, default month and year
        // * if month is given, default only year
        // * if year is given, don't default anything
        for (i = 0; i < 3 && config._a[i] == null; ++i) {
            config._a[i] = input[i] = currentDate[i];
        }

        // Zero out whatever was not defaulted, including time
        for (; i < 7; i++) {
            config._a[i] = input[i] = (config._a[i] == null) ? (i === 2 ? 1 : 0) : config._a[i];
        }

        // Check for 24:00:00.000
        if (config._a[HOUR] === 24 &&
                config._a[MINUTE] === 0 &&
                config._a[SECOND] === 0 &&
                config._a[MILLISECOND] === 0) {
            config._nextDay = true;
            config._a[HOUR] = 0;
        }

        config._d = (config._useUTC ? makeUTCDate : makeDate).apply(null, input);
        // Apply timezone offset from input. The actual utcOffset can be changed
        // with parseZone.
        if (config._tzm != null) {
            config._d.setUTCMinutes(config._d.getUTCMinutes() - config._tzm);
        }

        if (config._nextDay) {
            config._a[HOUR] = 24;
        }
    }

    function dateFromObject(config) {
        var normalizedInput;

        if (config._d) {
            return;
        }

        normalizedInput = normalizeObjectUnits(config._i);
        config._a = [
            normalizedInput.year,
            normalizedInput.month,
            normalizedInput.day || normalizedInput.date,
            normalizedInput.hour,
            normalizedInput.minute,
            normalizedInput.second,
            normalizedInput.millisecond
        ];

        dateFromConfig(config);
    }

    function currentDateArray(config) {
        var now = new Date();
        if (config._useUTC) {
            return [
                now.getUTCFullYear(),
                now.getUTCMonth(),
                now.getUTCDate()
            ];
        } else {
            return [now.getFullYear(), now.getMonth(), now.getDate()];
        }
    }

    // date from string and format string
    function makeDateFromStringAndFormat(config) {
        if (config._f === moment.ISO_8601) {
            parseISO(config);
            return;
        }

        config._a = [];
        config._pf.empty = true;

        // This array is used to make a Date, either with `new Date` or `Date.UTC`
        var string = '' + config._i,
            i, parsedInput, tokens, token, skipped,
            stringLength = string.length,
            totalParsedInputLength = 0;

        tokens = expandFormat(config._f, config._locale).match(formattingTokens) || [];

        for (i = 0; i < tokens.length; i++) {
            token = tokens[i];
            parsedInput = (string.match(getParseRegexForToken(token, config)) || [])[0];
            if (parsedInput) {
                skipped = string.substr(0, string.indexOf(parsedInput));
                if (skipped.length > 0) {
                    config._pf.unusedInput.push(skipped);
                }
                string = string.slice(string.indexOf(parsedInput) + parsedInput.length);
                totalParsedInputLength += parsedInput.length;
            }
            // don't parse if it's not a known token
            if (formatTokenFunctions[token]) {
                if (parsedInput) {
                    config._pf.empty = false;
                }
                else {
                    config._pf.unusedTokens.push(token);
                }
                addTimeToArrayFromToken(token, parsedInput, config);
            }
            else if (config._strict && !parsedInput) {
                config._pf.unusedTokens.push(token);
            }
        }

        // add remaining unparsed input length to the string
        config._pf.charsLeftOver = stringLength - totalParsedInputLength;
        if (string.length > 0) {
            config._pf.unusedInput.push(string);
        }

        // clear _12h flag if hour is <= 12
        if (config._pf.bigHour === true && config._a[HOUR] <= 12) {
            config._pf.bigHour = undefined;
        }
        // handle meridiem
        config._a[HOUR] = meridiemFixWrap(config._locale, config._a[HOUR],
                config._meridiem);
        dateFromConfig(config);
        checkOverflow(config);
    }

    function unescapeFormat(s) {
        return s.replace(/\\(\[)|\\(\])|\[([^\]\[]*)\]|\\(.)/g, function (matched, p1, p2, p3, p4) {
            return p1 || p2 || p3 || p4;
        });
    }

    // Code from http://stackoverflow.com/questions/3561493/is-there-a-regexp-escape-function-in-javascript
    function regexpEscape(s) {
        return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    }

    // date from string and array of format strings
    function makeDateFromStringAndArray(config) {
        var tempConfig,
            bestMoment,

            scoreToBeat,
            i,
            currentScore;

        if (config._f.length === 0) {
            config._pf.invalidFormat = true;
            config._d = new Date(NaN);
            return;
        }

        for (i = 0; i < config._f.length; i++) {
            currentScore = 0;
            tempConfig = copyConfig({}, config);
            if (config._useUTC != null) {
                tempConfig._useUTC = config._useUTC;
            }
            tempConfig._pf = defaultParsingFlags();
            tempConfig._f = config._f[i];
            makeDateFromStringAndFormat(tempConfig);

            if (!isValid(tempConfig)) {
                continue;
            }

            // if there is any input that was not parsed add a penalty for that format
            currentScore += tempConfig._pf.charsLeftOver;

            //or tokens
            currentScore += tempConfig._pf.unusedTokens.length * 10;

            tempConfig._pf.score = currentScore;

            if (scoreToBeat == null || currentScore < scoreToBeat) {
                scoreToBeat = currentScore;
                bestMoment = tempConfig;
            }
        }

        extend(config, bestMoment || tempConfig);
    }

    // date from iso format
    function parseISO(config) {
        var i, l,
            string = config._i,
            match = isoRegex.exec(string);

        if (match) {
            config._pf.iso = true;
            for (i = 0, l = isoDates.length; i < l; i++) {
                if (isoDates[i][1].exec(string)) {
                    // match[5] should be 'T' or undefined
                    config._f = isoDates[i][0] + (match[6] || ' ');
                    break;
                }
            }
            for (i = 0, l = isoTimes.length; i < l; i++) {
                if (isoTimes[i][1].exec(string)) {
                    config._f += isoTimes[i][0];
                    break;
                }
            }
            if (string.match(parseTokenTimezone)) {
                config._f += 'Z';
            }
            makeDateFromStringAndFormat(config);
        } else {
            config._isValid = false;
        }
    }

    // date from iso format or fallback
    function makeDateFromString(config) {
        parseISO(config);
        if (config._isValid === false) {
            delete config._isValid;
            moment.createFromInputFallback(config);
        }
    }

    function map(arr, fn) {
        var res = [], i;
        for (i = 0; i < arr.length; ++i) {
            res.push(fn(arr[i], i));
        }
        return res;
    }

    function makeDateFromInput(config) {
        var input = config._i, matched;
        if (input === undefined) {
            config._d = new Date();
        } else if (isDate(input)) {
            config._d = new Date(+input);
        } else if ((matched = aspNetJsonRegex.exec(input)) !== null) {
            config._d = new Date(+matched[1]);
        } else if (typeof input === 'string') {
            makeDateFromString(config);
        } else if (isArray(input)) {
            config._a = map(input.slice(0), function (obj) {
                return parseInt(obj, 10);
            });
            dateFromConfig(config);
        } else if (typeof(input) === 'object') {
            dateFromObject(config);
        } else if (typeof(input) === 'number') {
            // from milliseconds
            config._d = new Date(input);
        } else {
            moment.createFromInputFallback(config);
        }
    }

    function makeDate(y, m, d, h, M, s, ms) {
        //can't just apply() to create a date:
        //http://stackoverflow.com/questions/181348/instantiating-a-javascript-object-by-calling-prototype-constructor-apply
        var date = new Date(y, m, d, h, M, s, ms);

        //the date constructor doesn't accept years < 1970
        if (y < 1970) {
            date.setFullYear(y);
        }
        return date;
    }

    function makeUTCDate(y) {
        var date = new Date(Date.UTC.apply(null, arguments));
        if (y < 1970) {
            date.setUTCFullYear(y);
        }
        return date;
    }

    function parseWeekday(input, locale) {
        if (typeof input === 'string') {
            if (!isNaN(input)) {
                input = parseInt(input, 10);
            }
            else {
                input = locale.weekdaysParse(input);
                if (typeof input !== 'number') {
                    return null;
                }
            }
        }
        return input;
    }

    /************************************
        Relative Time
    ************************************/


    // helper function for moment.fn.from, moment.fn.fromNow, and moment.duration.fn.humanize
    function substituteTimeAgo(string, number, withoutSuffix, isFuture, locale) {
        return locale.relativeTime(number || 1, !!withoutSuffix, string, isFuture);
    }

    function relativeTime(posNegDuration, withoutSuffix, locale) {
        var duration = moment.duration(posNegDuration).abs(),
            seconds = round(duration.as('s')),
            minutes = round(duration.as('m')),
            hours = round(duration.as('h')),
            days = round(duration.as('d')),
            months = round(duration.as('M')),
            years = round(duration.as('y')),

            args = seconds < relativeTimeThresholds.s && ['s', seconds] ||
                minutes === 1 && ['m'] ||
                minutes < relativeTimeThresholds.m && ['mm', minutes] ||
                hours === 1 && ['h'] ||
                hours < relativeTimeThresholds.h && ['hh', hours] ||
                days === 1 && ['d'] ||
                days < relativeTimeThresholds.d && ['dd', days] ||
                months === 1 && ['M'] ||
                months < relativeTimeThresholds.M && ['MM', months] ||
                years === 1 && ['y'] || ['yy', years];

        args[2] = withoutSuffix;
        args[3] = +posNegDuration > 0;
        args[4] = locale;
        return substituteTimeAgo.apply({}, args);
    }


    /************************************
        Week of Year
    ************************************/


    // firstDayOfWeek       0 = sun, 6 = sat
    //                      the day of the week that starts the week
    //                      (usually sunday or monday)
    // firstDayOfWeekOfYear 0 = sun, 6 = sat
    //                      the first week is the week that contains the first
    //                      of this day of the week
    //                      (eg. ISO weeks use thursday (4))
    function weekOfYear(mom, firstDayOfWeek, firstDayOfWeekOfYear) {
        var end = firstDayOfWeekOfYear - firstDayOfWeek,
            daysToDayOfWeek = firstDayOfWeekOfYear - mom.day(),
            adjustedMoment;


        if (daysToDayOfWeek > end) {
            daysToDayOfWeek -= 7;
        }

        if (daysToDayOfWeek < end - 7) {
            daysToDayOfWeek += 7;
        }

        adjustedMoment = moment(mom).add(daysToDayOfWeek, 'd');
        return {
            week: Math.ceil(adjustedMoment.dayOfYear() / 7),
            year: adjustedMoment.year()
        };
    }

    //http://en.wikipedia.org/wiki/ISO_week_date#Calculating_a_date_given_the_year.2C_week_number_and_weekday
    function dayOfYearFromWeeks(year, week, weekday, firstDayOfWeekOfYear, firstDayOfWeek) {
        var d = makeUTCDate(year, 0, 1).getUTCDay(), daysToAdd, dayOfYear;

        d = d === 0 ? 7 : d;
        weekday = weekday != null ? weekday : firstDayOfWeek;
        daysToAdd = firstDayOfWeek - d + (d > firstDayOfWeekOfYear ? 7 : 0) - (d < firstDayOfWeek ? 7 : 0);
        dayOfYear = 7 * (week - 1) + (weekday - firstDayOfWeek) + daysToAdd + 1;

        return {
            year: dayOfYear > 0 ? year : year - 1,
            dayOfYear: dayOfYear > 0 ?  dayOfYear : daysInYear(year - 1) + dayOfYear
        };
    }

    /************************************
        Top Level Functions
    ************************************/

    function makeMoment(config) {
        var input = config._i,
            format = config._f,
            res;

        config._locale = config._locale || moment.localeData(config._l);

        if (input === null || (format === undefined && input === '')) {
            return moment.invalid({nullInput: true});
        }

        if (typeof input === 'string') {
            config._i = input = config._locale.preparse(input);
        }

        if (moment.isMoment(input)) {
            return new Moment(input, true);
        } else if (format) {
            if (isArray(format)) {
                makeDateFromStringAndArray(config);
            } else {
                makeDateFromStringAndFormat(config);
            }
        } else {
            makeDateFromInput(config);
        }

        res = new Moment(config);
        if (res._nextDay) {
            // Adding is smart enough around DST
            res.add(1, 'd');
            res._nextDay = undefined;
        }

        return res;
    }

    moment = function (input, format, locale, strict) {
        var c;

        if (typeof(locale) === 'boolean') {
            strict = locale;
            locale = undefined;
        }
        // object construction must be done this way.
        // https://github.com/moment/moment/issues/1423
        c = {};
        c._isAMomentObject = true;
        c._i = input;
        c._f = format;
        c._l = locale;
        c._strict = strict;
        c._isUTC = false;
        c._pf = defaultParsingFlags();

        return makeMoment(c);
    };

    moment.suppressDeprecationWarnings = false;

    moment.createFromInputFallback = deprecate(
        'moment construction falls back to js Date. This is ' +
        'discouraged and will be removed in upcoming major ' +
        'release. Please refer to ' +
        'https://github.com/moment/moment/issues/1407 for more info.',
        function (config) {
            config._d = new Date(config._i + (config._useUTC ? ' UTC' : ''));
        }
    );

    // Pick a moment m from moments so that m[fn](other) is true for all
    // other. This relies on the function fn to be transitive.
    //
    // moments should either be an array of moment objects or an array, whose
    // first element is an array of moment objects.
    function pickBy(fn, moments) {
        var res, i;
        if (moments.length === 1 && isArray(moments[0])) {
            moments = moments[0];
        }
        if (!moments.length) {
            return moment();
        }
        res = moments[0];
        for (i = 1; i < moments.length; ++i) {
            if (moments[i][fn](res)) {
                res = moments[i];
            }
        }
        return res;
    }

    moment.min = function () {
        var args = [].slice.call(arguments, 0);

        return pickBy('isBefore', args);
    };

    moment.max = function () {
        var args = [].slice.call(arguments, 0);

        return pickBy('isAfter', args);
    };

    // creating with utc
    moment.utc = function (input, format, locale, strict) {
        var c;

        if (typeof(locale) === 'boolean') {
            strict = locale;
            locale = undefined;
        }
        // object construction must be done this way.
        // https://github.com/moment/moment/issues/1423
        c = {};
        c._isAMomentObject = true;
        c._useUTC = true;
        c._isUTC = true;
        c._l = locale;
        c._i = input;
        c._f = format;
        c._strict = strict;
        c._pf = defaultParsingFlags();

        return makeMoment(c).utc();
    };

    // creating with unix timestamp (in seconds)
    moment.unix = function (input) {
        return moment(input * 1000);
    };

    // duration
    moment.duration = function (input, key) {
        var duration = input,
            // matching against regexp is expensive, do it on demand
            match = null,
            sign,
            ret,
            parseIso,
            diffRes;

        if (moment.isDuration(input)) {
            duration = {
                ms: input._milliseconds,
                d: input._days,
                M: input._months
            };
        } else if (typeof input === 'number') {
            duration = {};
            if (key) {
                duration[key] = input;
            } else {
                duration.milliseconds = input;
            }
        } else if (!!(match = aspNetTimeSpanJsonRegex.exec(input))) {
            sign = (match[1] === '-') ? -1 : 1;
            duration = {
                y: 0,
                d: toInt(match[DATE]) * sign,
                h: toInt(match[HOUR]) * sign,
                m: toInt(match[MINUTE]) * sign,
                s: toInt(match[SECOND]) * sign,
                ms: toInt(match[MILLISECOND]) * sign
            };
        } else if (!!(match = isoDurationRegex.exec(input))) {
            sign = (match[1] === '-') ? -1 : 1;
            parseIso = function (inp) {
                // We'd normally use ~~inp for this, but unfortunately it also
                // converts floats to ints.
                // inp may be undefined, so careful calling replace on it.
                var res = inp && parseFloat(inp.replace(',', '.'));
                // apply sign while we're at it
                return (isNaN(res) ? 0 : res) * sign;
            };
            duration = {
                y: parseIso(match[2]),
                M: parseIso(match[3]),
                d: parseIso(match[4]),
                h: parseIso(match[5]),
                m: parseIso(match[6]),
                s: parseIso(match[7]),
                w: parseIso(match[8])
            };
        } else if (duration == null) {// checks for null or undefined
            duration = {};
        } else if (typeof duration === 'object' &&
                ('from' in duration || 'to' in duration)) {
            diffRes = momentsDifference(moment(duration.from), moment(duration.to));

            duration = {};
            duration.ms = diffRes.milliseconds;
            duration.M = diffRes.months;
        }

        ret = new Duration(duration);

        if (moment.isDuration(input) && hasOwnProp(input, '_locale')) {
            ret._locale = input._locale;
        }

        return ret;
    };

    // version number
    moment.version = VERSION;

    // default format
    moment.defaultFormat = isoFormat;

    // constant that refers to the ISO standard
    moment.ISO_8601 = function () {};

    // Plugins that add properties should also add the key here (null value),
    // so we can properly clone ourselves.
    moment.momentProperties = momentProperties;

    // This function will be called whenever a moment is mutated.
    // It is intended to keep the offset in sync with the timezone.
    moment.updateOffset = function () {};

    // This function allows you to set a threshold for relative time strings
    moment.relativeTimeThreshold = function (threshold, limit) {
        if (relativeTimeThresholds[threshold] === undefined) {
            return false;
        }
        if (limit === undefined) {
            return relativeTimeThresholds[threshold];
        }
        relativeTimeThresholds[threshold] = limit;
        return true;
    };

    moment.lang = deprecate(
        'moment.lang is deprecated. Use moment.locale instead.',
        function (key, value) {
            return moment.locale(key, value);
        }
    );

    // This function will load locale and then set the global locale.  If
    // no arguments are passed in, it will simply return the current global
    // locale key.
    moment.locale = function (key, values) {
        var data;
        if (key) {
            if (typeof(values) !== 'undefined') {
                data = moment.defineLocale(key, values);
            }
            else {
                data = moment.localeData(key);
            }

            if (data) {
                moment.duration._locale = moment._locale = data;
            }
        }

        return moment._locale._abbr;
    };

    moment.defineLocale = function (name, values) {
        if (values !== null) {
            values.abbr = name;
            if (!locales[name]) {
                locales[name] = new Locale();
            }
            locales[name].set(values);

            // backwards compat for now: also set the locale
            moment.locale(name);

            return locales[name];
        } else {
            // useful for testing
            delete locales[name];
            return null;
        }
    };

    moment.langData = deprecate(
        'moment.langData is deprecated. Use moment.localeData instead.',
        function (key) {
            return moment.localeData(key);
        }
    );

    // returns locale data
    moment.localeData = function (key) {
        var locale;

        if (key && key._locale && key._locale._abbr) {
            key = key._locale._abbr;
        }

        if (!key) {
            return moment._locale;
        }

        if (!isArray(key)) {
            //short-circuit everything else
            locale = loadLocale(key);
            if (locale) {
                return locale;
            }
            key = [key];
        }

        return chooseLocale(key);
    };

    // compare moment object
    moment.isMoment = function (obj) {
        return obj instanceof Moment ||
            (obj != null && hasOwnProp(obj, '_isAMomentObject'));
    };

    // for typechecking Duration objects
    moment.isDuration = function (obj) {
        return obj instanceof Duration;
    };

    for (i = lists.length - 1; i >= 0; --i) {
        makeList(lists[i]);
    }

    moment.normalizeUnits = function (units) {
        return normalizeUnits(units);
    };

    moment.invalid = function (flags) {
        var m = moment.utc(NaN);
        if (flags != null) {
            extend(m._pf, flags);
        }
        else {
            m._pf.userInvalidated = true;
        }

        return m;
    };

    moment.parseZone = function () {
        return moment.apply(null, arguments).parseZone();
    };

    moment.parseTwoDigitYear = function (input) {
        return toInt(input) + (toInt(input) > 68 ? 1900 : 2000);
    };

    moment.isDate = isDate;

    /************************************
        Moment Prototype
    ************************************/


    extend(moment.fn = Moment.prototype, {

        clone : function () {
            return moment(this);
        },

        valueOf : function () {
            return +this._d - ((this._offset || 0) * 60000);
        },

        unix : function () {
            return Math.floor(+this / 1000);
        },

        toString : function () {
            return this.clone().locale('en').format('ddd MMM DD YYYY HH:mm:ss [GMT]ZZ');
        },

        toDate : function () {
            return this._offset ? new Date(+this) : this._d;
        },

        toISOString : function () {
            var m = moment(this).utc();
            if (0 < m.year() && m.year() <= 9999) {
                if ('function' === typeof Date.prototype.toISOString) {
                    // native implementation is ~50x faster, use it when we can
                    return this.toDate().toISOString();
                } else {
                    return formatMoment(m, 'YYYY-MM-DD[T]HH:mm:ss.SSS[Z]');
                }
            } else {
                return formatMoment(m, 'YYYYYY-MM-DD[T]HH:mm:ss.SSS[Z]');
            }
        },

        toArray : function () {
            var m = this;
            return [
                m.year(),
                m.month(),
                m.date(),
                m.hours(),
                m.minutes(),
                m.seconds(),
                m.milliseconds()
            ];
        },

        isValid : function () {
            return isValid(this);
        },

        isDSTShifted : function () {
            if (this._a) {
                return this.isValid() && compareArrays(this._a, (this._isUTC ? moment.utc(this._a) : moment(this._a)).toArray()) > 0;
            }

            return false;
        },

        parsingFlags : function () {
            return extend({}, this._pf);
        },

        invalidAt: function () {
            return this._pf.overflow;
        },

        utc : function (keepLocalTime) {
            return this.utcOffset(0, keepLocalTime);
        },

        local : function (keepLocalTime) {
            if (this._isUTC) {
                this.utcOffset(0, keepLocalTime);
                this._isUTC = false;

                if (keepLocalTime) {
                    this.subtract(this._dateUtcOffset(), 'm');
                }
            }
            return this;
        },

        format : function (inputString) {
            var output = formatMoment(this, inputString || moment.defaultFormat);
            return this.localeData().postformat(output);
        },

        add : createAdder(1, 'add'),

        subtract : createAdder(-1, 'subtract'),

        diff : function (input, units, asFloat) {
            var that = makeAs(input, this),
                zoneDiff = (that.utcOffset() - this.utcOffset()) * 6e4,
                anchor, diff, output, daysAdjust;

            units = normalizeUnits(units);

            if (units === 'year' || units === 'month' || units === 'quarter') {
                output = monthDiff(this, that);
                if (units === 'quarter') {
                    output = output / 3;
                } else if (units === 'year') {
                    output = output / 12;
                }
            } else {
                diff = this - that;
                output = units === 'second' ? diff / 1e3 : // 1000
                    units === 'minute' ? diff / 6e4 : // 1000 * 60
                    units === 'hour' ? diff / 36e5 : // 1000 * 60 * 60
                    units === 'day' ? (diff - zoneDiff) / 864e5 : // 1000 * 60 * 60 * 24, negate dst
                    units === 'week' ? (diff - zoneDiff) / 6048e5 : // 1000 * 60 * 60 * 24 * 7, negate dst
                    diff;
            }
            return asFloat ? output : absRound(output);
        },

        from : function (time, withoutSuffix) {
            return moment.duration({to: this, from: time}).locale(this.locale()).humanize(!withoutSuffix);
        },

        fromNow : function (withoutSuffix) {
            return this.from(moment(), withoutSuffix);
        },

        calendar : function (time) {
            // We want to compare the start of today, vs this.
            // Getting start-of-today depends on whether we're locat/utc/offset
            // or not.
            var now = time || moment(),
                sod = makeAs(now, this).startOf('day'),
                diff = this.diff(sod, 'days', true),
                format = diff < -6 ? 'sameElse' :
                    diff < -1 ? 'lastWeek' :
                    diff < 0 ? 'lastDay' :
                    diff < 1 ? 'sameDay' :
                    diff < 2 ? 'nextDay' :
                    diff < 7 ? 'nextWeek' : 'sameElse';
            return this.format(this.localeData().calendar(format, this, moment(now)));
        },

        isLeapYear : function () {
            return isLeapYear(this.year());
        },

        isDST : function () {
            return (this.utcOffset() > this.clone().month(0).utcOffset() ||
                this.utcOffset() > this.clone().month(5).utcOffset());
        },

        day : function (input) {
            var day = this._isUTC ? this._d.getUTCDay() : this._d.getDay();
            if (input != null) {
                input = parseWeekday(input, this.localeData());
                return this.add(input - day, 'd');
            } else {
                return day;
            }
        },

        month : makeAccessor('Month', true),

        startOf : function (units) {
            units = normalizeUnits(units);
            // the following switch intentionally omits break keywords
            // to utilize falling through the cases.
            switch (units) {
            case 'year':
                this.month(0);
                /* falls through */
            case 'quarter':
            case 'month':
                this.date(1);
                /* falls through */
            case 'week':
            case 'isoWeek':
            case 'day':
                this.hours(0);
                /* falls through */
            case 'hour':
                this.minutes(0);
                /* falls through */
            case 'minute':
                this.seconds(0);
                /* falls through */
            case 'second':
                this.milliseconds(0);
                /* falls through */
            }

            // weeks are a special case
            if (units === 'week') {
                this.weekday(0);
            } else if (units === 'isoWeek') {
                this.isoWeekday(1);
            }

            // quarters are also special
            if (units === 'quarter') {
                this.month(Math.floor(this.month() / 3) * 3);
            }

            return this;
        },

        endOf: function (units) {
            units = normalizeUnits(units);
            if (units === undefined || units === 'millisecond') {
                return this;
            }
            return this.startOf(units).add(1, (units === 'isoWeek' ? 'week' : units)).subtract(1, 'ms');
        },

        isAfter: function (input, units) {
            var inputMs;
            units = normalizeUnits(typeof units !== 'undefined' ? units : 'millisecond');
            if (units === 'millisecond') {
                input = moment.isMoment(input) ? input : moment(input);
                return +this > +input;
            } else {
                inputMs = moment.isMoment(input) ? +input : +moment(input);
                return inputMs < +this.clone().startOf(units);
            }
        },

        isBefore: function (input, units) {
            var inputMs;
            units = normalizeUnits(typeof units !== 'undefined' ? units : 'millisecond');
            if (units === 'millisecond') {
                input = moment.isMoment(input) ? input : moment(input);
                return +this < +input;
            } else {
                inputMs = moment.isMoment(input) ? +input : +moment(input);
                return +this.clone().endOf(units) < inputMs;
            }
        },

        isBetween: function (from, to, units) {
            return this.isAfter(from, units) && this.isBefore(to, units);
        },

        isSame: function (input, units) {
            var inputMs;
            units = normalizeUnits(units || 'millisecond');
            if (units === 'millisecond') {
                input = moment.isMoment(input) ? input : moment(input);
                return +this === +input;
            } else {
                inputMs = +moment(input);
                return +(this.clone().startOf(units)) <= inputMs && inputMs <= +(this.clone().endOf(units));
            }
        },

        min: deprecate(
                 'moment().min is deprecated, use moment.min instead. https://github.com/moment/moment/issues/1548',
                 function (other) {
                     other = moment.apply(null, arguments);
                     return other < this ? this : other;
                 }
         ),

        max: deprecate(
                'moment().max is deprecated, use moment.max instead. https://github.com/moment/moment/issues/1548',
                function (other) {
                    other = moment.apply(null, arguments);
                    return other > this ? this : other;
                }
        ),

        zone : deprecate(
                'moment().zone is deprecated, use moment().utcOffset instead. ' +
                'https://github.com/moment/moment/issues/1779',
                function (input, keepLocalTime) {
                    if (input != null) {
                        if (typeof input !== 'string') {
                            input = -input;
                        }

                        this.utcOffset(input, keepLocalTime);

                        return this;
                    } else {
                        return -this.utcOffset();
                    }
                }
        ),

        // keepLocalTime = true means only change the timezone, without
        // affecting the local hour. So 5:31:26 +0300 --[utcOffset(2, true)]-->
        // 5:31:26 +0200 It is possible that 5:31:26 doesn't exist with offset
        // +0200, so we adjust the time as needed, to be valid.
        //
        // Keeping the time actually adds/subtracts (one hour)
        // from the actual represented time. That is why we call updateOffset
        // a second time. In case it wants us to change the offset again
        // _changeInProgress == true case, then we have to adjust, because
        // there is no such time in the given timezone.
        utcOffset : function (input, keepLocalTime) {
            var offset = this._offset || 0,
                localAdjust;
            if (input != null) {
                if (typeof input === 'string') {
                    input = utcOffsetFromString(input);
                }
                if (Math.abs(input) < 16) {
                    input = input * 60;
                }
                if (!this._isUTC && keepLocalTime) {
                    localAdjust = this._dateUtcOffset();
                }
                this._offset = input;
                this._isUTC = true;
                if (localAdjust != null) {
                    this.add(localAdjust, 'm');
                }
                if (offset !== input) {
                    if (!keepLocalTime || this._changeInProgress) {
                        addOrSubtractDurationFromMoment(this,
                                moment.duration(input - offset, 'm'), 1, false);
                    } else if (!this._changeInProgress) {
                        this._changeInProgress = true;
                        moment.updateOffset(this, true);
                        this._changeInProgress = null;
                    }
                }

                return this;
            } else {
                return this._isUTC ? offset : this._dateUtcOffset();
            }
        },

        isLocal : function () {
            return !this._isUTC;
        },

        isUtcOffset : function () {
            return this._isUTC;
        },

        isUtc : function () {
            return this._isUTC && this._offset === 0;
        },

        zoneAbbr : function () {
            return this._isUTC ? 'UTC' : '';
        },

        zoneName : function () {
            return this._isUTC ? 'Coordinated Universal Time' : '';
        },

        parseZone : function () {
            if (this._tzm) {
                this.utcOffset(this._tzm);
            } else if (typeof this._i === 'string') {
                this.utcOffset(utcOffsetFromString(this._i));
            }
            return this;
        },

        hasAlignedHourOffset : function (input) {
            if (!input) {
                input = 0;
            }
            else {
                input = moment(input).utcOffset();
            }

            return (this.utcOffset() - input) % 60 === 0;
        },

        daysInMonth : function () {
            return daysInMonth(this.year(), this.month());
        },

        dayOfYear : function (input) {
            var dayOfYear = round((moment(this).startOf('day') - moment(this).startOf('year')) / 864e5) + 1;
            return input == null ? dayOfYear : this.add((input - dayOfYear), 'd');
        },

        quarter : function (input) {
            return input == null ? Math.ceil((this.month() + 1) / 3) : this.month((input - 1) * 3 + this.month() % 3);
        },

        weekYear : function (input) {
            var year = weekOfYear(this, this.localeData()._week.dow, this.localeData()._week.doy).year;
            return input == null ? year : this.add((input - year), 'y');
        },

        isoWeekYear : function (input) {
            var year = weekOfYear(this, 1, 4).year;
            return input == null ? year : this.add((input - year), 'y');
        },

        week : function (input) {
            var week = this.localeData().week(this);
            return input == null ? week : this.add((input - week) * 7, 'd');
        },

        isoWeek : function (input) {
            var week = weekOfYear(this, 1, 4).week;
            return input == null ? week : this.add((input - week) * 7, 'd');
        },

        weekday : function (input) {
            var weekday = (this.day() + 7 - this.localeData()._week.dow) % 7;
            return input == null ? weekday : this.add(input - weekday, 'd');
        },

        isoWeekday : function (input) {
            // behaves the same as moment#day except
            // as a getter, returns 7 instead of 0 (1-7 range instead of 0-6)
            // as a setter, sunday should belong to the previous week.
            return input == null ? this.day() || 7 : this.day(this.day() % 7 ? input : input - 7);
        },

        isoWeeksInYear : function () {
            return weeksInYear(this.year(), 1, 4);
        },

        weeksInYear : function () {
            var weekInfo = this.localeData()._week;
            return weeksInYear(this.year(), weekInfo.dow, weekInfo.doy);
        },

        get : function (units) {
            units = normalizeUnits(units);
            return this[units]();
        },

        set : function (units, value) {
            var unit;
            if (typeof units === 'object') {
                for (unit in units) {
                    this.set(unit, units[unit]);
                }
            }
            else {
                units = normalizeUnits(units);
                if (typeof this[units] === 'function') {
                    this[units](value);
                }
            }
            return this;
        },

        // If passed a locale key, it will set the locale for this
        // instance.  Otherwise, it will return the locale configuration
        // variables for this instance.
        locale : function (key) {
            var newLocaleData;

            if (key === undefined) {
                return this._locale._abbr;
            } else {
                newLocaleData = moment.localeData(key);
                if (newLocaleData != null) {
                    this._locale = newLocaleData;
                }
                return this;
            }
        },

        lang : deprecate(
            'moment().lang() is deprecated. Instead, use moment().localeData() to get the language configuration. Use moment().locale() to change languages.',
            function (key) {
                if (key === undefined) {
                    return this.localeData();
                } else {
                    return this.locale(key);
                }
            }
        ),

        localeData : function () {
            return this._locale;
        },

        _dateUtcOffset : function () {
            // On Firefox.24 Date#getTimezoneOffset returns a floating point.
            // https://github.com/moment/moment/pull/1871
            return -Math.round(this._d.getTimezoneOffset() / 15) * 15;
        }

    });

    function rawMonthSetter(mom, value) {
        var dayOfMonth;

        // TODO: Move this out of here!
        if (typeof value === 'string') {
            value = mom.localeData().monthsParse(value);
            // TODO: Another silent failure?
            if (typeof value !== 'number') {
                return mom;
            }
        }

        dayOfMonth = Math.min(mom.date(),
                daysInMonth(mom.year(), value));
        mom._d['set' + (mom._isUTC ? 'UTC' : '') + 'Month'](value, dayOfMonth);
        return mom;
    }

    function rawGetter(mom, unit) {
        return mom._d['get' + (mom._isUTC ? 'UTC' : '') + unit]();
    }

    function rawSetter(mom, unit, value) {
        if (unit === 'Month') {
            return rawMonthSetter(mom, value);
        } else {
            return mom._d['set' + (mom._isUTC ? 'UTC' : '') + unit](value);
        }
    }

    function makeAccessor(unit, keepTime) {
        return function (value) {
            if (value != null) {
                rawSetter(this, unit, value);
                moment.updateOffset(this, keepTime);
                return this;
            } else {
                return rawGetter(this, unit);
            }
        };
    }

    moment.fn.millisecond = moment.fn.milliseconds = makeAccessor('Milliseconds', false);
    moment.fn.second = moment.fn.seconds = makeAccessor('Seconds', false);
    moment.fn.minute = moment.fn.minutes = makeAccessor('Minutes', false);
    // Setting the hour should keep the time, because the user explicitly
    // specified which hour he wants. So trying to maintain the same hour (in
    // a new timezone) makes sense. Adding/subtracting hours does not follow
    // this rule.
    moment.fn.hour = moment.fn.hours = makeAccessor('Hours', true);
    // moment.fn.month is defined separately
    moment.fn.date = makeAccessor('Date', true);
    moment.fn.dates = deprecate('dates accessor is deprecated. Use date instead.', makeAccessor('Date', true));
    moment.fn.year = makeAccessor('FullYear', true);
    moment.fn.years = deprecate('years accessor is deprecated. Use year instead.', makeAccessor('FullYear', true));

    // add plural methods
    moment.fn.days = moment.fn.day;
    moment.fn.months = moment.fn.month;
    moment.fn.weeks = moment.fn.week;
    moment.fn.isoWeeks = moment.fn.isoWeek;
    moment.fn.quarters = moment.fn.quarter;

    // add aliased format methods
    moment.fn.toJSON = moment.fn.toISOString;

    // alias isUtc for dev-friendliness
    moment.fn.isUTC = moment.fn.isUtc;

    /************************************
        Duration Prototype
    ************************************/


    function daysToYears (days) {
        // 400 years have 146097 days (taking into account leap year rules)
        return days * 400 / 146097;
    }

    function yearsToDays (years) {
        // years * 365 + absRound(years / 4) -
        //     absRound(years / 100) + absRound(years / 400);
        return years * 146097 / 400;
    }

    extend(moment.duration.fn = Duration.prototype, {

        _bubble : function () {
            var milliseconds = this._milliseconds,
                days = this._days,
                months = this._months,
                data = this._data,
                seconds, minutes, hours, years = 0;

            // The following code bubbles up values, see the tests for
            // examples of what that means.
            data.milliseconds = milliseconds % 1000;

            seconds = absRound(milliseconds / 1000);
            data.seconds = seconds % 60;

            minutes = absRound(seconds / 60);
            data.minutes = minutes % 60;

            hours = absRound(minutes / 60);
            data.hours = hours % 24;

            days += absRound(hours / 24);

            // Accurately convert days to years, assume start from year 0.
            years = absRound(daysToYears(days));
            days -= absRound(yearsToDays(years));

            // 30 days to a month
            // TODO (iskren): Use anchor date (like 1st Jan) to compute this.
            months += absRound(days / 30);
            days %= 30;

            // 12 months -> 1 year
            years += absRound(months / 12);
            months %= 12;

            data.days = days;
            data.months = months;
            data.years = years;
        },

        abs : function () {
            this._milliseconds = Math.abs(this._milliseconds);
            this._days = Math.abs(this._days);
            this._months = Math.abs(this._months);

            this._data.milliseconds = Math.abs(this._data.milliseconds);
            this._data.seconds = Math.abs(this._data.seconds);
            this._data.minutes = Math.abs(this._data.minutes);
            this._data.hours = Math.abs(this._data.hours);
            this._data.months = Math.abs(this._data.months);
            this._data.years = Math.abs(this._data.years);

            return this;
        },

        weeks : function () {
            return absRound(this.days() / 7);
        },

        valueOf : function () {
            return this._milliseconds +
              this._days * 864e5 +
              (this._months % 12) * 2592e6 +
              toInt(this._months / 12) * 31536e6;
        },

        humanize : function (withSuffix) {
            var output = relativeTime(this, !withSuffix, this.localeData());

            if (withSuffix) {
                output = this.localeData().pastFuture(+this, output);
            }

            return this.localeData().postformat(output);
        },

        add : function (input, val) {
            // supports only 2.0-style add(1, 's') or add(moment)
            var dur = moment.duration(input, val);

            this._milliseconds += dur._milliseconds;
            this._days += dur._days;
            this._months += dur._months;

            this._bubble();

            return this;
        },

        subtract : function (input, val) {
            var dur = moment.duration(input, val);

            this._milliseconds -= dur._milliseconds;
            this._days -= dur._days;
            this._months -= dur._months;

            this._bubble();

            return this;
        },

        get : function (units) {
            units = normalizeUnits(units);
            return this[units.toLowerCase() + 's']();
        },

        as : function (units) {
            var days, months;
            units = normalizeUnits(units);

            if (units === 'month' || units === 'year') {
                days = this._days + this._milliseconds / 864e5;
                months = this._months + daysToYears(days) * 12;
                return units === 'month' ? months : months / 12;
            } else {
                // handle milliseconds separately because of floating point math errors (issue #1867)
                days = this._days + Math.round(yearsToDays(this._months / 12));
                switch (units) {
                    case 'week': return days / 7 + this._milliseconds / 6048e5;
                    case 'day': return days + this._milliseconds / 864e5;
                    case 'hour': return days * 24 + this._milliseconds / 36e5;
                    case 'minute': return days * 24 * 60 + this._milliseconds / 6e4;
                    case 'second': return days * 24 * 60 * 60 + this._milliseconds / 1000;
                    // Math.floor prevents floating point math errors here
                    case 'millisecond': return Math.floor(days * 24 * 60 * 60 * 1000) + this._milliseconds;
                    default: throw new Error('Unknown unit ' + units);
                }
            }
        },

        lang : moment.fn.lang,
        locale : moment.fn.locale,

        toIsoString : deprecate(
            'toIsoString() is deprecated. Please use toISOString() instead ' +
            '(notice the capitals)',
            function () {
                return this.toISOString();
            }
        ),

        toISOString : function () {
            // inspired by https://github.com/dordille/moment-isoduration/blob/master/moment.isoduration.js
            var years = Math.abs(this.years()),
                months = Math.abs(this.months()),
                days = Math.abs(this.days()),
                hours = Math.abs(this.hours()),
                minutes = Math.abs(this.minutes()),
                seconds = Math.abs(this.seconds() + this.milliseconds() / 1000);

            if (!this.asSeconds()) {
                // this is the same as C#'s (Noda) and python (isodate)...
                // but not other JS (goog.date)
                return 'P0D';
            }

            return (this.asSeconds() < 0 ? '-' : '') +
                'P' +
                (years ? years + 'Y' : '') +
                (months ? months + 'M' : '') +
                (days ? days + 'D' : '') +
                ((hours || minutes || seconds) ? 'T' : '') +
                (hours ? hours + 'H' : '') +
                (minutes ? minutes + 'M' : '') +
                (seconds ? seconds + 'S' : '');
        },

        localeData : function () {
            return this._locale;
        },

        toJSON : function () {
            return this.toISOString();
        }
    });

    moment.duration.fn.toString = moment.duration.fn.toISOString;

    function makeDurationGetter(name) {
        moment.duration.fn[name] = function () {
            return this._data[name];
        };
    }

    for (i in unitMillisecondFactors) {
        if (hasOwnProp(unitMillisecondFactors, i)) {
            makeDurationGetter(i.toLowerCase());
        }
    }

    moment.duration.fn.asMilliseconds = function () {
        return this.as('ms');
    };
    moment.duration.fn.asSeconds = function () {
        return this.as('s');
    };
    moment.duration.fn.asMinutes = function () {
        return this.as('m');
    };
    moment.duration.fn.asHours = function () {
        return this.as('h');
    };
    moment.duration.fn.asDays = function () {
        return this.as('d');
    };
    moment.duration.fn.asWeeks = function () {
        return this.as('weeks');
    };
    moment.duration.fn.asMonths = function () {
        return this.as('M');
    };
    moment.duration.fn.asYears = function () {
        return this.as('y');
    };

    /************************************
        Default Locale
    ************************************/


    // Set default locale, other locale will inherit from English.
    moment.locale('en', {
        ordinalParse: /\d{1,2}(th|st|nd|rd)/,
        ordinal : function (number) {
            var b = number % 10,
                output = (toInt(number % 100 / 10) === 1) ? 'th' :
                (b === 1) ? 'st' :
                (b === 2) ? 'nd' :
                (b === 3) ? 'rd' : 'th';
            return number + output;
        }
    });

    /* EMBED_LOCALES */

    /************************************
        Exposing Moment
    ************************************/

    function makeGlobal(shouldDeprecate) {
        /*global ender:false */
        if (typeof ender !== 'undefined') {
            return;
        }
        oldGlobalMoment = globalScope.moment;
        if (shouldDeprecate) {
            globalScope.moment = deprecate(
                    'Accessing Moment through the global scope is ' +
                    'deprecated, and will be removed in an upcoming ' +
                    'release.',
                    moment);
        } else {
            globalScope.moment = moment;
        }
    }

    // CommonJS module is defined
    if (hasModule) {
        module.exports = moment;
    } else if (typeof define === 'function' && define.amd) {
        define(function (require, exports, module) {
            if (module.config && module.config() && module.config().noGlobal === true) {
                // release the global variable
                globalScope.moment = oldGlobalMoment;
            }

            return moment;
        });
        makeGlobal(true);
    } else {
        makeGlobal();
    }
}).call(this);

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}]},{},[1])(1)
});
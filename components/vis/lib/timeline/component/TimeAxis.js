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
/*! mapmap.js 0.1.0 © 2014 Florian Ledermann */
// UMD header
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['d3', 'jquery'], function(d3, jquery) {
      return (root.mapmap = factory(d3, jquery, root));
    });
  } else if (typeof exports === 'object') {
    module.exports = factory(require('d3'), require('jquery'));
  } else {
    root.mapmap = factory(root.d3, root.jQuery, root);
  }
}(this, function(d3, $, window) {
  'use strict';

(function(window) {
"use strict";

var data = [];

// returns a promise for data for everything
var dd = function(spec, map, reduce) {
    if (map && typeof map != 'function') {
        // map is string -> map to attribute value
        map = dd.map.key(map);
    }
    if ($.type(spec) === 'string') {
        // consider spec to be a URL to load
        // guess type
        var ext = spec.split('.').pop();
        if (ext == 'json' || ext == 'topojson' || ext == 'geojson') {
            return new Promise(function(resolve, reject) {
                d3.json(spec, function(error, data) {
                    if (error) {
                        reject(error);
                        return;
                    }
                                        
                    if (data.slice && typeof data.slice == 'function') {
                        // array
                        resolve(dd.mapreduce(data, map, reduce));
                    }
                    else {
                        // object - treat entries as keys by default
                        var keys = Object.keys(data);
                        var map_func;
                        if (!map) {
                            // use keys as data to emit key/data pairs in map step!
                            map_func = dd.map.dict(data);
                        }
                        else {
                            map_func = function(k, emit) {
                                // put original key into object
                                var obj = data[k];
                                obj.__key__ = k;
                                // call user-provided map funtion with object
                                map(obj, emit);
                            }
                        }
                        resolve(dd.mapreduce(keys, map_func, reduce));
                    }                    
                });
            });
        }
        else {
            return new Promise(function(resolve, reject) {
                d3.csv(spec, function(row) {
                    var keys = Object.keys(row);
                    for (var i=0; i<keys.length; i++) {
                        var key = keys[i];
                        if (!isNaN(+row[key])) { // in JavaScript, NaN !== NaN !!!
                            // convert to number if number
                            row[key] = +row[key];
                        }
                    }
                    return row;
                },
                function(error, data) {
                    if (error) {
                        reject(error);
                        return;
                    }
                    resolve(dd.mapreduce(data, map, reduce));                    
                });
            });
        }
    }
    else if (typeof spec == 'function') {
        // synthesize data from function?
        console.warn("Not implemented: datadata from function!");
    }
    else {
        // if ($.isArray(spec)) 
        // treat everything else as data
        return new Promise(function(resolve, reject) {
            resolve(dd.mapreduce(spec, map, reduce));
        });
    }
}

// simple load function, returns a promise for data without map/reduce-ing
// mostly present for legacy reasons
dd.load = function(spec, key) {
    if (spec.then && typeof spec.then === 'function') {
        // already a thenable / promise
        return spec;
    }
    else if ($.type(spec) === 'string') {
        // consider spec to be a URL to load
        // guess type
        var ext = spec.split('.').pop();
        if (ext == 'json' || ext == 'topojson' || ext == 'geojson') {
            return new Promise(function(resolve, reject) {
                d3.json(spec, function(error, data) {
                    if (error) {
                        reject(error);
                        return;
                    }
                    resolve(data);
                });
            });
        }
        else {
            return new Promise(function(resolve, reject) {
                d3.csv(obj, function(row) {
                    var keys = Object.keys(row);
                    for (var i=0; i<keys.length; i++) {
                        var key = keys[i];
                        if (!isNaN(+row[key])) { // in JavaScript, NaN !== NaN !!!
                            // convert to number if number
                            row[key] = +row[key];
                        }
                    }
                    return row;
                },
                function(error, data) {
                    if (error) {
                        reject(error);
                        return;
                    }
                    resolve(data);                    
                });
            });
        }
    }
}

dd.OrderedHash = function() {
    // ordered hash implementation
    var keys = [];
    var vals = {};
    return {
        push: function(k,v) {
            if (!vals[k]) keys.push(k);
            vals[k] = v;
        },
        insert: function(i,k,v) {
            if (!vals[k]) {
                keys.splice(i,0,k);
                vals[k] = v;
            }
        },
        get: function(k) {
            // string -> key
            return vals[k];
        },
        at: function(i) {
            // number -> nth object
            return vals[keys[i]];
        },
        length: function(){return keys.length;},
        keys: function(){return keys;},
        key: function(i) {return keys[i];},
        values: function() {
            return keys.map(function(key){return vals[key];});
        },
        map: function(func) {
            return keys.map(function(k){return func(k, vals[k]);});
        },
        unsorted_dict: function() {
            return vals;
        },
        geometries: function(){
            return Object.keys(vals).map(function (k) {
                return vals[k];
            });
        }
    };
};

// Utility functions for map/reduce
dd.map = {
    key: function(attr, remap) {
        return function(d, emit) {
            var key = d[attr];
            if (remap && remap[key] !== undefined) {
                key = remap[key];
            }
            emit(key, d);
        }
    },
    dict: function(dict) {
        return function(d, emit) {
            emit(d, dict[d]);
        }
    }
};
dd.emit = {
    ident: function() {
        return function(key, values, emit) {
            emit(key, values);
        }
    },
    first: function() {
        return function(key, values, emit) {
            emit(key, values[0]);
        }
    },
    last: function() {
        return function(key, values, emit) {
            emit(key, values[values.length - 1]);
        }
    },
    merge: function() {
        return function(key, values, emit) {
            var obj = values.reduce(function(prev, curr) {
                var keys = Object.keys(curr);
                for (var i=0; i<keys.length; i++) {
                    var k = keys[i];
                    prev[k] = curr[k];
                }
                return prev;
            });
            
            emit(key, obj);
        }
    },
    toAttr: function(attr, func) {
        func = func || dd.emit.last();
        return function(key, values, emit) {
            func(key, values, function(k, v) {
                var obj = {};
                obj[attr] = v;
                emit(k, obj);
            });
        }
    },
    sum: function(include, exclude) {
        include = wildcards(include || '*');
        exclude = wildcards(exclude);       

        return function(key, values, emit) {
            var obj = values.reduce(function(prev, curr) {
                var keys = Object.keys(curr);
                for (var i=0; i<keys.length; i++) {
                    var key = keys[i],
                        doAdd = false;
                    
                    for (var j=0; j<include.length; j++) {
                        if (key.search(include[i]) > -1) {
                            doAdd = true;
                            break;
                        }
                    }
                    for (var j=0; j<exclude.length; j++) {
                        if (key.search(include[j]) > -1) {
                            doAdd = false;
                            break;
                        }
                    }
                    if (doAdd && prev[key] && curr[key] && !isNaN(prev[key]) && !isNaN(curr[key])) {
                        prev[key] = prev[key] + curr[key];
                    }
                    else {
                        prev[key] = curr[key];
                        if (doAdd) {
                            console.warn("datadata.emit.sum(): Cannot add keys " + key + "!");
                        }
                    }
                }
                return prev;
            });
            
            emit(key, obj);
        }
    }
};

function arrayify(el) {
    if (!el) return [];
    // return a copy if aready array, else singel-element array
    return (el.slice() && el.push && typeof el.push == 'function') ? el.slice() : [el];
}

function wildcards(spec) {
    spec = arrayify(spec);
    for (var i=0; i<spec.length; i++) {
        if (!(spec[i] instanceof RegExp)) {
            spec[i] = new RegExp('^' + spec[i].replace('*','.*').replace('?','.'));
        }
    }
    return spec;
}

// https://code.google.com/p/mapreduce-js/
// Mozilla Public License
dd.mapreduce = function (data, map, reduce) {
	var mapResult = [],
        reduceResult = dd.OrderedHash(),
        reduceKey;
	
    reduce = reduce || dd.emit.last(); // default
    
	var mapEmit = function(key, value) {
		if(!mapResult[key]) {
			mapResult[key] = [];
		}
		mapResult[key].push(value);
	};
	
	var reduceEmit = function(key, value) {
		reduceResult.push(key, value);
	};
	
	for(var i = 0; i < data.length; i++) {
		map(data[i], mapEmit);
	}
	
	for(reduceKey in mapResult) {
		reduce(reduceKey, mapResult[reduceKey], reduceEmit);
	}
	
	return reduceResult;
};

dd.mapreducer = function(map, reduce) {
    return function(data) {
        dd.mapreduce(data, map, reduce);
    };
};
// Helper functions for map etc.

// put 'd' in another object using the attribute 'key'
// optional 'pull' is the name of a key to leave on the top level 
dd.envelope = function(key, pull, func) {
    return function(d) {
        if (pull && typeof pull == 'function') {
            // envelope(key, func) case
            func = pull;
            pull = none;
        }
        if (func) d = func(d);
        var val = {};
        val[key] = d;
        if (pull) {
            val[pull] = d[pull];
            delete d[pull];
        }
        return val;
    }
}
dd.prefix = function(prefix, func) {
    return function(d) {
    
        if (func) d = func(d);
    
        var val = {},
            keys = Object.keys(d);
            
        for (var i=0; i<keys.length; i++) {
            val[prefix + keys[i]] = d[keys[i]];
        }
            
        return val;
    }
}
dd.prefix_attr = function(attr, func) {
    return function(d) {
    
        if (func) d = func(d);
    
        var val = {},
            keys = Object.keys(d),
            prefix = d[attr] ? d[attr] + '_' : '';
            
        for (var i=0; i<keys.length; i++) {
            val[prefix + keys[i]] = d[keys[i]];
        }
            
        return val;
    }
}
dd.map_attr = function(map, func) {
    return function(d) {
    
        if (func) d = func(d);
    
        if (typeof map == 'function') {
            d = map(d);
        }
        else {
            var keys = Object.keys(map);
            for (var i=0; i<keys.length; i++) {
                var key = keys[i];
                var val = map[key];
                if (typeof val == 'function') {
                    d[key] = val(d);
                }
                else if (d[val]) {
                    d[key] = d[val];
                    delete d[val];
                }
            }
        }
            
        return d;
    }
}
dd.reverse = function(data) {
    if (data.slice && typeof data.slice == 'function') {
        // slice() = copy
        return data.slice().reverse(); 
    }
    return data;
}

window.datadata = window.dd = dd;

})(window);

// core
var version = '0.1.0';

// TODO: can we get rid of jQuery dependency through var extend = require("jquery-extend")?
function _assert(test, message) { if (test) return; throw new Error("[mapmap] " + message);}
_assert(d3, "d3.js is required!");
_assert($, "jQuery is required!");

var default_settings = {
    language: 'en',
    legend: true,
    keepAspectRatio: true,
    clipHover: true,
    clipHoverMargin: {top: 40, left: 40, bottom: 0, right: 40},
    hoverClassName: 'hoverInfo',
    placeholderClassName: 'placeholder',
    pathAttributes: {
        'fill': 'none',
        'stroke': '#000',
        'stroke-width': '0.2px',
        'stroke-linejoin': 'bevel',
        'pointer-events': 'none'
    },
    backgroundAttributes: {
        'width': '300%',
        'height': '300%',
        'fill': 'none',
        'stroke': 'none',
        'transform': 'translate(-800,-400)',
        'pointer-events': 'all'
    },
    overlayAttributes: {
        'fill': '#ffffff',
        'fill-opacity': '0.2',
        'stroke-width': '0.8',
        'stroke': '#333',
        'pointer-events': 'none'
    },
    legendOptions: {
        cellSpacing: 5,
        layout: 'vertical',
        histogram: false,
        histogramLength: 80,
        containerAttributes: {
            transform: 'translate(20,10)'
        },
        backgroundAttributes: {
            fill: '#fff',
            'fill-opacity': 0.9,
            x: -10,
            y: -10,
            width: 220
        },
        cellAttributes: {
        },
        colorAttributes: {
            'width': 40,
            'height': 18,
            'stroke': '#000',
            'stroke-width': '0.5px',
            'fill': '#fff'  // this will be used before first transition
        },
        textAttributes: {
            'font-size': 10,
            'pointer-events': 'none',
            dy: 12
        },
        histogramBarAttributes: {
            width: 0,
            x: 140,
            y: 4,
            height: 10,
            fill: '#000',
            'fill-opacity': 0.2
        }
    },
    extentOptions: {
        size: 0.95
    },
    zoomOptions: {
        event: 'click',
        cursor: 'pointer',
        fitScale: 0.7,
        animationDuration: 750,
        maxZoom: 8,
        hierarchical: false,
        showRing: true,
        ringRadius: 1.1, // relative to height/2
        ringAttributes: {
            stroke: '#000',
            'stroke-width': 6,
            'stroke-opacity': 0.3,
            'pointer-events': 'none',
            fill: 'none',
            xfilter: 'url(#light-glow)'
        },
        closeButton: function(parent) {
            parent.append('circle')
                .attr({
                    r: 10,
                    fill: '#fff',
                    stroke: '#000',
                    'stroke-width': 2.5,
                    'stroke-opacity': 0.9,
                    'fill-opacity': 0.9,
                    cursor: 'pointer'
                });
                
            parent.append('text')
                .attr({
                    'text-anchor':'middle',
                    cursor: 'pointer',
                    'font-weight': 'bold',
                    'font-size': '18',
                    y: 6
                })
                .text('×');
        }
    }
};

var mapmap = function(element, options) {

    // ensure constructor invocation
    if (!(this instanceof mapmap)) return new mapmap(element, options);

    this.settings = {};    
    this.options(mapmap.extend(true, {}, default_settings, options));
    
    // promises
    this._promise = {
        geometry: null,
        data: null
    };

    this.selected = null;
    
    this.layers = new datadata.OrderedHash();
    this.identify_func = identify_layer;
    
    if (typeof element == 'string' || element instanceof String) {
        element = document.getElementById(element);
    }
    
    this.initEngine(element);
    this.initEvents(element);
    
    this.dispatcher = d3.dispatch('choropleth','view');
    
    return this;    
};

mapmap.prototype = {
	version: version
};

mapmap.extend = $.extend;
/*
// TODO: this or jquery-extend to get rid of jquery dep.?
// http://andrewdupont.net/2009/08/28/deep-extending-objects-in-javascript/
mapmap.extend = function(destination, source) {
  for (var property in source) {
    if (source[property] && source[property].constructor && source[property].constructor === Object) {
      destination[property] = destination[property] || {};
      mapmap.extend(destination[property], source[property]);
    }
    else {
      destination[property] = source[property];
    }
  }
  return destination;
};
*/

mapmap.prototype.initEngine = function(element) {
    // SVG specific initialization, for now we have no engine switching functionality
    
    // HTML elements, stored as d3 selections    
    var mainEl = d3.select(element).classed('mapmap', true),
        mapEl = mainEl.append('g').attr('class', 'map');
        
    this._elements = {
        main: mainEl,
        map: mapEl,
        parent: $(mainEl.node()).parent(),
        // child elements
        defs: mainEl.insert('defs', '.map'),
        backgroundGeometry: mapEl.append('g').attr('class', 'background-geometry'),
        background: mapEl.append('rect').attr('class', 'background').attr(this.settings.backgroundAttributes),
        shadowGroup: mapEl.append('g'),
        geometry: mapEl.append('g').attr('class', 'geometry'),
        overlay: mapEl.append('g').attr('class', 'overlays'),
        fixed: mainEl.append('g').attr('class', 'fixed'),
        legend: mainEl.append('g').attr('class', 'legend'),
        placeholder: mainEl.select('.' + this.settings.placeholderClassName)
    };
    
    // set up width/height
    this.width = null;
    this.height = null;
    
    var viewBox = mainEl.attr('viewBox');
    if (viewBox) {
        var dim = viewBox.trim().split(' ');
        if (dim.length == 4) {
            this.width = parseInt(dim[2]);
            this.height = parseInt(dim[3]);
        }
    }
    if (!this.width) {
        this.width = parseInt(mainEl.attr('width')) || 800;
    }
    if (!this.height) {
        this.height = parseInt(mainEl.attr('height')) || 400;
    }
    if (!viewBox) {
        mainEl.attr('viewBox', '0 0 ' + this.width + ' ' + this.height);
    }
    
    this._elements.defs.append('filter')
        .attr('id', 'shadow-glow')
        .append('feGaussianBlur')
        .attr('stdDeviation', 5);

    this._elements.defs.append('filter')
        .attr('id', 'light-glow')
        .append('feGaussianBlur')
        .attr('stdDeviation', 1);
    
    this._elements.shadowEl = this._elements.shadowGroup
        .append('g')
        .attr('class', 'shadow')
        .attr('filter', 'url(#shadow-glow)');
        
    this._elements.shadowCropEl = this._elements.shadowGroup
        .append('g')
        .attr('class', 'shadow-crop');
       
    this.supports = {};
    
    // feature detection
    var el = this._elements.main.append('path').attr({
        'paint-order': 'stroke',
        'vector-effect': 'non-scaling-stroke'
    });  
    
    var val = getComputedStyle(el.node()).getPropertyValue('paint-order');
    this.supports.paintOrder = val && val.indexOf('stroke') == 0;
    
    val = getComputedStyle(el.node()).getPropertyValue('vector-effect');
    this.supports.nonScalingStroke = val && val.indexOf('non-scaling-stroke') == 0;
    this._elements.main.classed('supports-non-scaling-stroke', this.supports.nonScalingStroke);
        
    el.remove();
    
    // any IE?
    if (navigator.userAgent.indexOf('MSIE') !== -1 || navigator.appVersion.indexOf('Trident/') > 0) {
        this.supports.hoverDomModification = false;
    }
    else {
        this.supports.hoverDomModification = true;
    }

    var map = this;
    // save viewport state separately, as zoom may not have exact values (due to animation interpolation)
    this.current_scale = 1;
    this.current_translate = [0,0];
    
    this.zoom = d3.behavior.zoom()
        .translate([0, 0])
        .scale(1)
        .scaleExtent([1, 8])
        .on("zoom", function () {
            mapEl.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
            if (!map.supports.nonScalingStroke) {
                //map._elements.geometry.selectAll("path").style("stroke-width", 1.5 / d3.event.scale + "px");
            }
        });

    mapEl
        //.call(zoom) // free mousewheel zooming
        .call(this.zoom.event);
    

};

mapmap.prototype.initEvents = function(element) {
    var map = this;
    // keep aspect ratio on resize
    function resize() {
        if (map.settings.keepAspectRatio) {
            var width = element.getAttribute('width'),
                height = element.getAttribute('height');
            if (width && height) {
                var ratio = width / height,
                    bounds = element.getBoundingClientRect ? element.getBoundingClientRect() : null,
                    // if there are problems with this, another attempt would be getComputedStyle()
                    // see http://stackoverflow.com/questions/13122790/how-to-get-svg-element-dimensions-in-firefox
                    realWidth = element.clientWidth || element.parentNode.clientWidth; //(bounds ? (bounds.right - bounds.left) : 0);
                if (realWidth) {
                    element.style.height = (realWidth / ratio) + 'px';
                }
            }
        }
    }
    
    window.onresize = resize;
    
    resize();
};

// defaults
var projection = d3.geo.mercator().scale(1);
var path = d3.geo.path().projection(projection);
var domain = [0,1];

// layernames is deprecated, use options.layernames instead
mapmap.prototype.geometry = function(spec, options, layernames) {

    var default_options = {
        key: 'id'
    };
    
    // key is default option
    if (options.toLowerCase) {
        options = {key: options};
    }
    // layernames is legacy argument
    if (layernames) {
        options.layernames = layernames;
    }
    
    options = mapmap.extend({}, default_options, options);

    var map = this;
    
    if (typeof spec == 'function') {
        this._promise.geometry.then(function(topo){
            if (options.onload) options.onload();
            var new_topo = spec(topo);
            if (typeof new_topo.length == 'undefined') {
                new_topo = [new_topo];
            }
            new_topo.map(function(t) {
                if (typeof t.geometry.length == 'undefined') {
                    t.geometry = [t.geometry];
                }
                if (typeof t.index == 'undefined') {
                    map.layers.push(t.name, t.geometry);
                }
                else {
                    map.layers.insert(t.index, t.name, t.geometry);
                }
            });
            map.draw();
            if (options.ondraw) options.ondraw();
        });
        return this;
    }

    var promise = datadata.load(spec);
    // put into chained data promise to make sure is loaded before later data
    this.promise_data(promise);

    // chain to existing geometry promise
    if (this._promise.geometry) {
        var parent = this._promise.geometry;
        this._promise.geometry = new Promise(function(resolve, reject) {
            parent.then(function(_) {
                promise.then(function(data) {
                    resolve(data);
                });
            });
        });
    }
    else {
        this._promise.geometry = promise;
    }
    
    this._promise.geometry.then(function(geom) {
        if (options.onload) options.onload();
        if (geom.type && geom.type == 'Topology') {
            // TopoJSON
            var keys = options.layernames || Object.keys(geom.objects);
            keys.map(function(k) {
                if (geom.objects[k]) {
                    var objs = topojson.feature(geom, geom.objects[k]).features;
                    map.layers.push(k, objs);
                    if (options.key) {
                        for (var i=0; i<objs.length; i++) {
                            var obj = objs[i];
                            if (obj.properties && obj.properties[options.key]) {
                                objs[i].properties.__key__ = obj.properties[options.key];
                            }
                        }
                    }
                }
            });
        }
        else {
            // GeoJSON
            if (geom.features) {
                map.layers.push(options.layernames, geom.features);
            }
            else {
                map.layers.push(options.layernames, [geom]);
            }
        }
        // set up projection first to avoid reprojecting geometry
        if (!map.selected_extent) {
            map._extent(geom);           
        }
        // TODO: we need a smarter way of setting up projection/bounding box initially
        // if extent() was called, this should have set up bounds, else we need to do it here
        // however, extent() currently operates on the rendered <path>s generated by draw()
        //this._promise.geometry.then(draw);
        map.draw();
        if (options.ondraw) options.ondraw();
    });
    
    return this;
};

var identify_by_properties = function(properties){
    // single string case
    if (properties.substr) {
        properties = [properties];
    }
    return function(layers, name){
        name = name.toString().toLowerCase();
        // layers have priority, so iterate them first
        var lyr = layers.get(name);
        if (lyr) return lyr;
        var result = [];
        // properties are ordered by relevance, so iterate these first
        for (var k=0; k<properties.length; k++) {
            var property = properties[k];
            for (var i=0; i<layers.length(); i++) {
                var key = layers.keys()[i],
                    geoms = layers.get(key);
                for (var j=0; j<geoms.length; j++) {
                    var geom = geoms[j];
                    if (geom.properties && geom.properties[property] !== undefined && geom.properties[property].toString().toLowerCase() == name) {
                        result.push(geom);
                    }
                }
            }
        }
        return result;
    };
};

var identify_layer = function(layers, name) {
    name = name.toLowerCase();
    return layers.get(name);
};

// TODO: use all arguments to identify - can be used to provide multiple properties or functions
mapmap.prototype.identify = function(spec) {
    if (typeof spec == 'function') {
        this.identify_func = spec;
        return this;
    }
    // cast to array
    if (!spec.slice) {
        spec = [spec];
    }
    this.identify_func = identify_by_properties(spec);
    return this;
};

mapmap.prototype.searchAdapter = function(selection, propName) {
    var map = this;
    return function(query, callback) {
        map.promise_data().then(function() {
            var sel = map.getObjects(selection),
                results = [];
            sel = sel[0];
            for (var i=0; i<sel.length; i++) {
                var d = sel[i].__data__.properties;
                if (d[propName] && d[propName].toLowerCase().indexOf(query.toLowerCase()) == 0) {
                    results.push(sel[i].__data__);
                }
            }
            callback(results);
        });
    };
};

// TODO: this is needed for search functionality (see tools.js) - generalize and integrate
// into identify() etc.
mapmap.prototype.search = function(value, key) {
    key = key || '__key__';
    return identify_by_properties([key])(this.layers, value);
};

// return the representation (= SVG element) of a given object
mapmap.prototype.repr = function(d) {
    return d.__repr__;
};


mapmap.prototype.draw = function() {

    var groupSel = this._elements.geometry
        .selectAll('g')
        .data(this.layers.keys(), function(d,i) { return d; });
    
    var map = this;

    if (this._elements.placeholder) {
        this._elements.placeholder.remove();
        this._elements.placeholder = null;
    }
    
    groupSel.enter()
        .append('g')
        .attr('class', function(d){
            return d;
        })
        .each(function(d) {
            // d is name of topology object
            var geom = map.layers.get(d);
            var geomSel = d3.select(this)
                .selectAll('path')
                .data(geom);
                        
            geomSel
                .enter()
                .append('path')
                .attr('d', path)
                .attr(map.settings.pathAttributes)
                .each(function(d) {
                    // link data object to its representation
                    d.__repr__ = this;
                });
        });
    
    groupSel.order();
};

mapmap.prototype.size = function() {
    return {
        width: this.width,
        height: this.height
    };
    // getBBox() is far too large, as we currently use a background that
    // is 300% wide & high...
    //return this._elements.main.node().getBBox();
};

// TODO: disable pointer-events for not selected paths
mapmap.prototype.select = function(selection) {

    var map = this;
    
    function getName(sel) {
        return (typeof sel == 'string') ? sel : (sel.selectionName || 'function');
    }
    var oldSel = this.selected;
    if (this.selected) {
        this._elements.main.classed('selected-' + getName(this.selected), false);
    }
    this.selected = selection;
    if (this.selected) {
        this._elements.main.classed('selected-' + getName(this.selected), true);
    }
    this.promise_data().then(function(){
        if (oldSel) {
            map.getObjects(oldSel).classed('selected',false);
        }
        if (selection) {
            map.getObjects(selection).classed('selected',true);
        }
    });
    return this;
};

mapmap.prototype.highlight = function(selection) {

    var map = this;
    
    this.promise_data().then(function(data) {      
        var obj = map.getObjects(selection);
        map._elements.shadowEl.selectAll('path').remove();
        map._elements.shadowCropEl.selectAll('path').remove();
        obj.each(function() {
            map._elements.shadowEl.append('path')
                .attr({
                    d: this.attributes.d.value,
                    fill: 'rgba(0,0,0,0.5)' //'#999'
                });
            map._elements.shadowCropEl.append('path')
                .attr({
                    d: this.attributes.d.value,
                    fill: '#fff'
                });
        });
    });
    return this;
};

/*
Call without parameters to get current selection.
Call with null to get all topology objects.
Call with function to filter geometries.
Call with string to filter geometries/layers based on identify().
Call with geometry to convert into d3 selection.

Returns a D3 selection.
*/
mapmap.prototype.getObjects = function(selection) {
    if (typeof selection == 'undefined') {
        selection = this.selected;
    }
    if (selection) {
        if (typeof selection == 'function') {
            return this._elements.geometry.selectAll('path').filter(function(d,i){
                return selection(d.properties);
            });
        }
        if (selection.__data__) {
            // is a geometry generated by d3 -> return selection
            return d3.select(selection);
        }
        // TODO: this should have a nicer API
        var obj = this.identify_func(this.layers, selection);
        // layer case
        if (obj.length) {
            return d3.selectAll(obj.map(function(d){return d.__repr__;}));
        }
        // object case
        return d3.select(obj.__repr__);
    }
    return this._elements.geometry.selectAll('path');
};

// TODO: this is an ugly hack for now, until we properly keep track of current merged data!
mapmap.prototype.getData = function(key, selection) {

    var map = this;
    
    return new Promise(function(resolve, reject) {
        map._promise.data.then(function(data) {
        
            data = dd.OrderedHash();
            
            map.getObjects(selection)[0].forEach(function(d){
                if (typeof d.__data__.properties[key] != 'undefined') {
                    data.push(d.__data__.properties[key], d.__data__.properties);
                }
            });
            
            resolve(data);
        });
    });
};

mapmap.prototype.getOverlayContext = function() {
    return this._elements.overlay;
};

mapmap.prototype.project = function(point) {
    return projection(point);
};


mapmap.prototype.promise_data = function(promise) {
    // chain a new promise to the data promise
    // this allows a more elegant API than Promise.all([promises])
    // since we use only a single promise the "encapsulates" the
    // previous ones
    
    // TODO: hide this._promise.data through a closure?
    
    // TODO: we only fulfill with most recent data - should
    // we not *always* fulfill with canonical data i.e. the
    // underlying selection, or keep canonical data and refresh
    // selection always?

    var map = this;
    
    if (promise) {
        if (this._promise.data) {
            this._promise.data = new Promise(function(resolve, reject) {
                map._promise.data.then(function(_) {
                    promise.then(function(data) {
                        resolve(data);
                    });
                });
            });
        }
        else {
            this._promise.data = promise;
        }
    }
    return this._promise.data;   
};

mapmap.prototype.then = function(callback) {
    this.promise_data().then(callback);
    return this;
};

mapmap.prototype.data = function(spec, map, reduce, key) {

    var self = this;
    
    key = key || '__key__'; // TODO: natural key
    
    if (typeof spec == 'function') {
        this.promise_data().then(function(data){
            // TODO: this is a mess, see above - data
            // doesn't contain the actual canonical data, but 
            // only the most recently requested one, which doesn't
            // help us for transformations
            self._elements.geometry.selectAll('path')
            .each(function(geom) {
                if (geom.properties) {
                    var val = spec(geom.properties);
                    if (val) {
                        mapmap.extend(geom.properties, val);
                    }
                }
            });
        });
    }
    else {
        this.promise_data(datadata(spec, map, reduce))
        .then(function(data) {
            self._elements.geometry.selectAll('path')
                .each(function(d) {
                    if (d.properties) {
                        var k = d.properties[key];
                        if (k) {
                            mapmap.extend(d.properties, data.get(k));
                        }
                        else {
                            //console.warn("No '" + key + "' value present for " + this + "!");
                        }    
                    }
                });
        });
    }
    return this;
};

default_settings.defaultMetadata = {
    // domain will be determined by data analysis
    scale: 'quantize',
    colors: ["#ffffcc","#c7e9b4","#7fcdbb","#41b6c4","#2c7fb8","#253494"], // Colorbrewer YlGnBu[6] 
    // TODO: allow for localization of this string
    undefinedValue: '(undefined)',
    undefinedColor: '#eeeeee'
};

var MetaDataSpec = function(key, fields) {
    // ensure constructor invocation
    if (!(this instanceof MetaDataSpec)) return new MetaDataSpec(key, fields);
    mapmap.extend(this, fields);
    this.key = key;
    return this;
};
MetaDataSpec.prototype.specificity = function() {
    // regex case. use length of string representation without enclosing /.../
    if (this.key instanceof RegExp) return this.key.toString()-2;
    // return number of significant letters
    return this.key.length - (this.key.match(/[\*\?]/g) || []).length;
};
MetaDataSpec.prototype.match = function(str) {
    if (this.key instanceof RegExp) return (str.search(this.key) == 0);
    var rex = new RegExp('^' + this.key.replace('*','.*').replace('?','.'));
    return (str.search(rex) == 0);
};
var MetaData = function(fields, localeProvider) {
    // ensure constructor invocation
    if (!(this instanceof MetaData)) return new MetaData(fields, localeProvider);
    mapmap.extend(this, fields);
    this.format = function(val) {
        if (!this._format) {
            this._format = this.getFormatter();
        }
        if ((this.numberFormat && (isNaN(val) || val === undefined || val === null)) || (!this.numberFormat && !val)) {
            return this.undefinedValue;
        }
        return this._format(val);
    };
    this.getFormatter = function() {
        if (this.numberFormat) {
            if (typeof this.numberFormat == 'function') {
                return this.numberFormat;
            }
            if (localeProvider._locale) {
                return localeProvider._locale.numberFormat(this.numberFormat);
            }
            return d3.format(this.numberFormat);
        }
        // TODO: detect numbers and use default format of '.02f' for them?
        return function(val) { return val };
    };
    return this;
};

mapmap.prototype.meta = function(metadata){
    var keys = Object.keys(metadata);
    // lazy initialization
    if (!this.metadata_specs) {
        this.metadata_specs = [];
    }
    for (var i=0; i<keys.length; i++) {
        this.metadata_specs.push(MetaDataSpec(keys[i], metadata[keys[i]]));
    }
    this.metadata_specs.sort(function(a,b) {
        return a.specificity()-b.specificity();
    });
    return this;
};

mapmap.prototype.getMetadata = function(key) {
    if (!this.metadata) {
        this.metadata = {};
    }
    if (!this.metadata[key]) {
        var fields = mapmap.extend({}, this.settings.defaultMetadata);
        for (var i=0; i<this.metadata_specs.length; i++) {
            if (this.metadata_specs[i].match(key)) {
                mapmap.extend(fields, this.metadata_specs[i]);
            }
        }
        this.metadata[key] = MetaData(fields, this);
    }
    return this.metadata[key];
};

function getStats(data, valueFunc) {
    var stats = {
        count: 0,
        countNumbers: 0,
        anyNegative: false,
        anyPositive: false,
        anyStrings: false,
        min: undefined,
        max: undefined
    };
    function datumFunc(d) {
        var val = valueFunc(d);
        if (val !== undefined) {
            stats.count += 1;
            if (!isNaN(+val)) {
                stats.countNumbers += 1;
                if (stats.min === undefined) stats.min = val;
                if (stats.max === undefined) stats.max = val;
                if (val < stats.min) stats.min = val;
                if (val > stats.max) stats.max = val;
                if (val > 0) stats.anyPositive = true;
                if (val < 0) stats.anyNegative = true;
            }
            if (isNaN(+val) && val) stats.anyString = true;
        }
    }
    if (data.each && typeof data.each == 'function') {
        data.each(datumFunc);
    }
    else {
        for (var i=0; i<data.length; i++) {
            datumFunc(data[i]);
        }
    }
    return stats;
}

function properties_accessor(func) {
    // converts a data callback function to access data's .properties entry
    // useful for processing geojson objects
    return function(data) {
        if (data.properties) return func(data.properties);
    };
}

mapmap.prototype.autoColorScale = function(value, metadata) {
    
    if (!metadata) {
        metadata = this.getMetadata(value);
    }
    else {
        metadata = $.extend({}, this.settings.defaultMetadata, metadata);
    }
    
    if (!metadata.domain) {
        var stats = getStats(this._elements.geometry.selectAll('path'), properties_accessor(keyOrCallback(value)));
        
        if (stats.anyNegative && stats.anyPositive) {
            // make symmetrical
            metadata.domain = [Math.min(stats.min, -stats.max), Math.max(stats.max, -stats.min)];
        }
        else {
            metadata.domain = [stats.min,stats.max];
        }
    }
    // support d3 scales out of the box
    var scale = d3.scale[metadata.scale];
    
    return scale().domain(metadata.domain).range(metadata.colors);    
};

mapmap.prototype.autoLinearScale = function(valueFunc) {    
    var stats = getStats(this._elements.geometry.selectAll('path'), properties_accessor(valueFunc));    
    return d3.scale.linear()
        .domain([0,stats.max]);    
};
mapmap.prototype.autoSqrtScale = function(valueFunc) {    
    var stats = getStats(this._elements.geometry.selectAll('path'), properties_accessor(valueFunc));    
    return d3.scale.sqrt()
        .domain([0,stats.max]);    
};

mapmap.prototype.symbolize = function(callback, selection, finalize) {

    var map = this;
    
    // store in closure for later access
    selection = selection || this.selected;
    this.promise_data().then(function(data) {      
        map.getObjects(selection)
            .each(function(geom) {
                callback.call(map, d3.select(this), geom);
            });
        if (finalize) finalize.call(map);
    });
    return this;
};

// TODO: improve handling of using a function here vs. using a named property
// probably needs a unified mechanism to deal with property/func to be used elsewhere
mapmap.prototype.choropleth = function(spec, metadata, selection) {    
    // we have to remember the scale for legend()
    var colorScale = null,
        valueFunc = keyOrCallback(spec),
        map = this;
        
    function color(el, geom, data) {
        if (spec === null) {
            // clear
            el.attr('fill', this.settings.pathAttributes.fill);
            return;
        }
        // on first call, set up scale & legend
        if (!colorScale) {
            // TODO: improve handling of things that need the data, but should be performed
            // only once. Should we provide a separate callback for this, or use the 
            // promise_data().then() for setup? As this could be considered a public API usecase,
            // maybe using promises is a bit steep for outside users?
            if (typeof metadata == 'string') {
                metadata = this.getMetadata(metadata);
            }
            if (!metadata) {
                metadata = this.getMetadata(spec);
            }
            colorScale = this.autoColorScale(spec, metadata);
            this.draw_legend(spec, metadata, colorScale, selection);
        }
        if (el.attr('fill') != 'none') {
            // transition if color already set
            el = el.transition();
        }
        el.attr('fill', function(geom) {           
            var val = valueFunc(geom.properties);
            // explicitly check if value is valid - this can be a problem with ordinal scales
            if (typeof(val) != 'undefined') {
                return colorScale(val) || map.settings.pathAttributes.fill;
            }
            return map.settings.pathAttributes.fill;
        });
    }
    
    this.symbolize(color, selection, function(){
        this.dispatcher.choropleth.call(this, spec);
    });
        
    return this;
};

mapmap.prototype.proportional_circles = function(value, scale) {
    
    var valueFunc = keyOrCallback(value);
    
    scale = scale || 20;
    
    this.symbolize(function(el, geom, data) {
        if (value === null) {
            this._elements.overlay.select('circle').remove();
        }
        else if (geom.properties && typeof valueFunc(geom.properties) != 'undefined') {
            // if scale is not set, calculate scale on first call
            if (typeof scale != 'function') {
                scale = this.autoSqrtScale(valueFunc).range([0,scale]);
            }
            var centroid = path.centroid(geom);
            this._elements.overlay.append('circle')
                .attr(this.settings.overlayAttributes)
                .attr({
                    r: scale(valueFunc(geom.properties)),
                    cx: centroid[0],
                    cy: centroid[1]
                });
        }
    });
    return this;
};

function addOptionalElement(elementName) {
    return function(value) {
        var valueFunc = keyOrCallback(value);
        this.symbolize(function(el, d) {  
            if (value === null) {
                el.select(elementName).remove();
                return;
            }
            el.append(elementName)
                .text(valueFunc(d.properties));
        });
        return this;
    };
}

mapmap.prototype.title = addOptionalElement('title');
mapmap.prototype.desc = addOptionalElement('desc');

var center = {
    x: 0.5,
    y: 0.5
};

mapmap.prototype.center = function(center_x, center_y) {
    center.x = center_x;
    if (typeof center_y != 'undefined') {
        center.y = center_y;
    }
    return this;
};
// store all hover out callbacks here, this will be called on zoom
var hoverOutCallbacks = [];

function callHoverOut() {
    for (var i=0; i<hoverOutCallbacks.length; i++) {
        hoverOutCallbacks[i]();
    }
}

var mouseover = null;

mapmap.showHover = function(el) {
    if (mouseover) {
        mouseover.call(el, el.__data__);
    }
};

mapmap.prototype.getBoundingClientRect = function() {
    // basically returns getBoundingClientRect() for main SVG element
    // Firefox < 35 will report wrong BoundingClientRect (adding clipped background),
    // so we have to fix it
    // https://bugzilla.mozilla.org/show_bug.cgi?id=530985
    // http://stackoverflow.com/questions/23684821/calculate-size-of-svg-element-in-html-page
    var el = this._elements.main.node(),
        $el = $(el),
        bounds = el.getBoundingClientRect(),
        offset = $el.offset(),
        cs = getComputedStyle(el),
        parentOffset = $(el.parentNode).offset(),
        left = parentOffset.left;
    // TODO: take into account margins etc.
    if (cs.left.indexOf('px') > -1) {
        left += parseInt(cs.left.slice(0,-2));
    }
    // this tests getBoundingClientRect() to be non-buggy
    if (bounds.left == left) {
        return bounds;
    }
    // construct synthetic boundingbox from computed style
    var top = parentOffset.top,
        width = parseInt(cs.width.slice(0,-2)),
        height = parseInt(cs.height.slice(0,-2));
    return {
        left: left,
        top: top,
        width: width,
        height: height,
        right: left + width,
        bottom: top + height
    };
};

var oldPointerEvents = [];

mapmap.prototype.hover = function(overCB, outCB, selection) {

    var map = this;
    
    this.promise_data().then(function() {
        hoverOutCallbacks.push(outCB);
        var obj = map.getObjects(selection);
        mouseover = function(d) {
        
            var el = this;
            
            // move to top = end of parent node
            // this screws up IE event handling!
            if (map.supports.hoverDomModification) {
                // TODO: this should be solved via a second element to be placed in front!
                el.parentNode.appendChild(el);
            }
            
            var bounds = this.getBoundingClientRect();
            var pt = map._elements.main.node().createSVGPoint();
            
            pt.x = (bounds.left + bounds.right) / 2;
            pt.y = bounds.top;
            
            var mapBounds = map.getBoundingClientRect();
            //pt = pt.matrixTransform(this._elements.main.node().getScreenCTM().inverse());
            if (map.settings.clipHover) {                
                if (pt.x < mapBounds.left + map.settings.clipHoverMargin.left) pt.x = mapBounds.left + map.settings.clipHoverMargin.left;
                if (pt.x > mapBounds.right - map.settings.clipHoverMargin.right) pt.x = mapBounds.right - map.settings.clipHoverMargin.right;
                if (pt.y < mapBounds.top + map.settings.clipHoverMargin.top) pt.y = mapBounds.top + map.settings.clipHoverMargin.top;
                if (pt.y > mapBounds.bottom - map.settings.clipHoverMargin.bottom) pt.y = mapBounds.bottom - map.settings.clipHoverMargin.bottom;
            }
            // is this needed any more? we calculate our position relative to
            // parent element, and add hover element in the same way...
            //pt.x -= mapBounds.left;
            //pt.y -= mapBounds.top;

            overCB.call(map, d.properties, pt, this);
        };
        // reset previously overridden pointer events
        for (var i=0; i<oldPointerEvents.length; i++) {
            var pair = oldPointerEvents[i];
            pair[0].style('pointer-events', pair[1]);
        }
        oldPointerEvents = [];
        obj.on('mouseover', mouseover)
            .on('mouseout', outCB)
            .each(function(){
                // TODO: not sure if this is the best idea, but we need to make sure
                // to receive pointer events even if css disables them. This has to work
                // even for complex (function-based) selections, so we cannot use containment
                // selectors (e.g. .selected-foo .foo) for this...
                // https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/pointer-events
                var sel = d3.select(this);
                oldPointerEvents.push([sel, sel.style('pointer-events')]);
                sel.style('pointer-events','all');
            });
    });
    return this;
};

mapmap.prototype.formatValue = function(d, attr) {
    var meta = this.getMetadata(attr),
        val = meta.format(d[attr]);
    if (val == 'NaN') val = d[attr];
    return val;
};

mapmap.prototype.buildHTMLFunc = function(spec) {
    // function case
    if (typeof spec == 'function') return spec;
    // string case
    if (spec.substr) spec = [spec];
    
    var map = this;
    
    var func = function(d) {
        var html = "",
            pre, post;
        for (var i=0; i<spec.length; i++) {
            var part = spec[i];
            if (part) {
                pre = (i==0) ? '<b>' : '';
                post = (i==0) ? '</b><br>' : '<br>';
                if (typeof part == 'function') {
                    var str = part.call(map, d);
                    if (str) {
                        html += pre + str + post;
                    }
                    continue;
                }
                var meta = map.getMetadata(part);
                var prefix = meta.hoverLabel || meta.valueLabel || meta.label || '';
                if (prefix) prefix += ": ";
                var val = meta.format(d[part]);
                if (val !== undefined && val !== null) {
                    html += pre + prefix + val + post;
                }
            }
        }
        return html;
    };
    
    return func;
};

mapmap.prototype.hoverInfo = function(spec, selection) {
    var htmlFunc = this.buildHTMLFunc(spec);
    var hoverEl = this._elements.parent.find('.' + this.settings.hoverClassName);
    if (hoverEl.length == 0) {
        hoverEl = $('<div class="' + this.settings.hoverClassName + '"></div>');
        // TODO: move this to options object and make configurable
        // currently this can only be overridden using important declarations
        hoverEl.css({
            position: 'absolute',
            backgroundColor: 'rgba(255,255,255,0.9)',
            padding: '0.3em'
        });
        this._elements.parent.append(hoverEl);
    }
    if (!hoverEl.mapmap_eventHandlerInstalled) {
        hoverEl.on('mouseenter', function() {
            hoverEl.css({
                display: 'block'
            });
        }).on('mouseleave', function() {
            hoverEl.css({
                display: 'none'
            });
        });
        hoverEl.mapmap_eventHandlerInstalled = true;
    }
    
    function show(d, point){
        // offsetParent only works for rendered objects, so place object first!
        // https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement.offsetParent
        hoverEl.css({
            display: 'block'
        });        
        var offsetEl = hoverEl.offsetParent();
        hoverEl
            .css({
                bottom: (offsetEl.height()- point.y) + 'px',
                //bottom: point.y + 'px',
                left: point.x + 'px'
            })
            .html(htmlFunc(d));
    }
    function hide() {
        hoverEl.css('display','none');
    }
    
    return this.hover(show, hide, selection);
};

// remove all symbology
// TODO: symbolizers should be registered somehow and iterated over here
mapmap.prototype.clear = function() {
    this.choropleth(null);
    this.proportional_circles(null);
    this.title(null);
    this.desc(null);
    return this;
};

mapmap.interactions = {};

mapmap.interactions.zoom = function(options) {

    var defaults = {
        // event callbacks
        zoomstart: null,
        zoomend: null
    };
    
    var ring = null,
        map = null,
        r, r0,
        zoomed = null;
    
    var z = function(selection) {
            
        map = this;

        options = mapmap.extend(true, {}, map.settings.zoomOptions, defaults, options);
        
        r = this.height / 2.0 * options.ringRadius;
        r0 = Math.sqrt(this.width*this.width + this.height*this.height) / 1.5;
            
        if (!options.center) {
            // zoom to globally set center by default
            options.center = [center.x, center.y];
        }

        if (options.cursor) {
            selection.attr({
                cursor: options.cursor
            });
        }
        
        if (options.showRing && !ring) {
            ring = map._elements.fixed.selectAll('g.zoomRing')
                .data([1]);
            
            var newring = ring.enter()
                .append('g')
                .attr('class','zoomRing')
                .attr('transform','translate(' + this.width * options.center[0] + ',' + this.height * options.center[1] + ')')
                .attr('opacity', 0);
                       
            newring.append('circle')
                .attr('class', 'main')
                .attr('r', r0)
                .attr(options.ringAttributes);
                
            var close = newring.append('g')
                .attr('class','zoomOut')
                .attr('transform','translate(' + (r0 * 0.707) + ',-' + (r0 * 0.707) + ')');
                        
            if (options.closeButton) {
                options.closeButton(close);
            }
            
        }

        // this is currently needed if e.g. search zooms to somewhere else,
        // but map is still zoomed in through this behaviour
        // do a reset(), but without modifying the map view (=zooming out)
        map.on('view', function(translate, scale) {
            if (zoomed && scale == 1) {
                zoomed = null;
                animateRing(null);
                map._elements.map.select('.background').on(options.event + '.zoom', null);
                options.zoomstart && options.zoomstart.call(map, null);
                options.zoomend && options.zoomend.call(map, null);
            }
        });
                
        selection.on(options.event, function(d) {
            callHoverOut();
            if (zoomed == this) {
                reset();
            }
            else {
                var el = this;
                options.zoomstart && options.zoomstart.call(map, el);
                map.zoomTo(this, {
                    callback: function() {
                        options.zoomend && options.zoomend.call(map, el);
                    },
                    maxZoom: options.maxZoom
                });
                animateRing(this);
                zoomed = this;
                map._elements.map.select('.background').on(options.event + '.zoom', reset);
            }
        });

        if (zoomed) {
            options.zoomstart && options.zoomstart.call(map, zoomed);
            options.zoomend && options.zoomend.call(map, zoomed);
        }

    };
    
    function zoomTo(selection) {
        options.zoomstart && options.zoomstart.call(map, selection);
        map.zoomTo(selection, {
            callback: function() {
                options.zoomend && options.zoomend.call(map, selection);
            },
            maxZoom: options.maxZoom
        });
        animateRing(selection);
        zoomed = selection;
        map._elements.map.select('.background').on(options.event + '.zoom', reset);
    }

    function animateRing(selection) {
        if (ring) {
            var new_r = (selection) ? r : r0,
                new_opacity = (selection) ? (options.ringAttributes.opacity || 1.0) : 0.0
            
            ring.transition().duration(options.animationDuration)
                .attr({
                    'opacity': new_opacity
                })
            ;
            ring.select('circle.main').transition().duration(options.animationDuration)
                .attr({
                    r: new_r
                })
            ;
            ring.select('g.zoomOut').transition().duration(options.animationDuration)
                .attr('transform', 'translate(' + (new_r * 0.707) + ',-' + (new_r * 0.707) + ')'); // sqrt(2) / 2

            // caveat: make sure to assign this every time to apply correct closure if we have multiple zoom behaviours!!
            ring.select('g.zoomOut').on('click', reset);
        }
    }
        
    function reset() {
        if (map) {
            zoomed = null;
            map.resetZoom();
            animateRing(null);
            map._elements.map.select('.background').on(options.event + '.zoom', null);
            if (options.zoomstart) {
                options.zoomstart.call(map, null);
            }
            if (options.zoomend) {
                options.zoomend.call(map, null);
            }
        }
    }
    
    z.reset = reset;
    
    z.active = function() {
        return zoomed;
    };   

    z.remove = function() {
        reset();
    };
        
    z.from = function(other){
        if (other && other.active) {
            zoomed = other.active();
            /*
            if (zoomed) {
                zoomTo(zoomed);
            }
            */
            // TODO: make up our mind whether this should remove the other behaviour
            // in burgenland_demographie.html, we need to keep it as it would otherwise zoom out
            // but if we mix different behaviours, we may want to remove the other one automatically
            // (or maybe require it to be done manually)
            // in pendeln.js, we remove the other behaviour here, which is inconsistent!
            
            //other.remove();
        }
        return z;
    };
    
    return z;
};

mapmap.prototype.animateView = function(translate, scale, callback) {
    if (translate[0] == this.current_translate[0] && translate[1] == this.current_translate[1] && scale == this.current_scale) {
        // nothing to do
        callback && callback();
        return this;
    }
    this.current_translate = translate;
    this.current_scale = scale;
    callHoverOut();
    var map = this;
    this._elements.map.transition()
        .duration(this.settings.zoomOptions.animationDuration)
        .call(map.zoom.translate(translate).scale(scale).event)
        .each('start', function() {
            map._elements.shadowGroup.attr('display','none');
        })
        .each('end', function() {
            map._elements.shadowGroup.attr('display','block');
            if (callback) {
                callback();
            }
        })
        .each('interrupt', function() {
            map._elements.shadowGroup.attr('display','block');
            // not sure if we should call callback here, but it may be non-intuitive
            // for callback to never be called if zoom is cancelled
            if (callback) {
                callback();
            }
        });        
    this.dispatcher.view.call(this, translate, scale);
    return this;
};

mapmap.prototype.zoomTo = function(selection, options) {
    var sel = this.getObjects(selection),
        bounds = [[Infinity,Infinity],[-Infinity, -Infinity]];
    
    options = mapmap.extend({}, this.settings.zoomOptions, options);
        
    sel.each(function(el){
        var b = path.bounds(el);
        bounds[0][0] = Math.min(bounds[0][0], b[0][0]);
        bounds[0][1] = Math.min(bounds[0][1], b[0][1]);
        bounds[1][0] = Math.max(bounds[1][0], b[1][0]);
        bounds[1][1] = Math.max(bounds[1][1], b[1][1]);
    });
    
    var dx = bounds[1][0] - bounds[0][0],
        dy = bounds[1][1] - bounds[0][1],
        x = (bounds[0][0] + bounds[1][0]) / 2,
        y = (bounds[0][1] + bounds[1][1]) / 2,
        scale = Math.min(options.maxZoom, options.fitScale / Math.max(dx / this.width, dy / this.height)),
        translate = [this.width * center.x - scale * x, this.height * center.y - scale * y];
    this.animateView(translate, scale, options.callback);
    return this;
};

mapmap.prototype.zoomToBounds = function(bounds, callback) {
    var w = bounds[1][0]-bounds[0][0],
        h = bounds[1][1]-bounds[0][1],
        cx = (bounds[1][0]+bounds[0][0]) / 2,
        cy = (bounds[1][1]+bounds[0][1]) / 2,
        scale = Math.min(2, 0.9 / Math.max(w / this.width, h / this.height)),
        translate = [this.width * 0.5 - scale * cx, this.height * 0.5 - scale * cy];
    
    return this.animateView(translate, scale, callback);
};

mapmap.prototype.zoomToCenter = function(center, scale, callback) {

    scale = scale || 1;
    
    var translate = [this.width * 0.5 - scale * center[0], this.height * 0.5 - scale * center[1]];

    return this.animateView(translate, scale, callback);
};

mapmap.prototype.resetZoom = function(callback) {
    return this.animateView([0,0],1, callback);
    // TODO take center into account zoomed-out, we may not always want this?
    //doZoom([width * (center.x-0.5),height * (center.y-0.5)],1);
};

// Manipulate representation geometry. This can be used e.g. to register event handlers.
// spec is either a function to be called with selection to set up event handler manually
// or a dictionary that contains event handler names as keys and callback functions as
// values (deprecated)
mapmap.prototype.applyBehaviour = function(spec, selection) {
    var map = this;
    this._promise.geometry.then(function(topo) {
        var sel = map.getObjects(selection);
        if (typeof spec == 'function') {
            spec.call(map, sel);
        }
        else {
            var keys = Object.keys(spec);
            for (var i=0; i<keys.length; i++) {
                var key = keys[i],
                    handler = spec[key];
                sel.on(key, handler);
            }
        }
    });
    return this;
};

// handler for high-level events on the map object
mapmap.prototype.on = function(eventName, handler) {
    this.dispatcher.on(eventName, handler);
    return this;
};

var d3_locales = {
    'en': {
        decimal: ".",
        thousands: ",",
        grouping: [ 3 ],
        currency: [ "$", "" ],
        dateTime: "%a %b %e %X %Y",
        date: "%m/%d/%Y",
        time: "%H:%M:%S",
        periods: [ "AM", "PM" ],
        days: [ "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday" ],
        shortDays: [ "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat" ],
        months: [ "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December" ],
        shortMonths: [ "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec" ]
    },
    'de': {
        decimal: ",",
        thousands: ".",
        grouping: [3],
        currency: ["€", ""],
        dateTime: "%a %b %e %X %Y",
        date: "%m/%d/%Y",
        time: "%H:%M:%S",
        periods: ["AM", "PM"],
        days: ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"],
        shortDays: ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"],
        months: ["Jänner", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"],
        shortMonths: ["Jan.", "Feb.", "März", "Apr.", "Mai", "Juni", "Juli", "Aug.", "Sep.", "Okt.", "Nov.", "Dez."]
    }
};

var optionsListeners = {
    'locale': function(val, old_val) {
        if (val.substr && d3_locales[val]) {
            this._locale = d3.locale(d3_locales[val]);
        }
        else {
            this._locale = d3.locale(val);
        }
        return this;
    }
};

mapmap.prototype.options = function(spec, value) {
    // get/set indexed property
    // http://stackoverflow.com/a/6394168/171579
    function propertyDeep(obj, is, value) {
        if (typeof is == 'string')
            return propertyDeep(obj,is.split('.'), value);
        else if (is.length==1 && value!==undefined) {
            obj[is[0]] = value;
            return value;
        }
        else if (is.length==0)
            return obj;
        else
            return propertyDeep(obj[is[0]],is.slice(1), value);
    }
    if (typeof spec == 'string') {
        if (optionsListeners[spec]) {
            optionsListeners[spec].call(this, value, propertyDeep(this.settings, spec, value));
        }
        else {
            propertyDeep(this.settings, spec, value);
        }
    }
    else {
        var old = mapmap.extend(true, {}, this.settings);
        mapmap.extend(true, this.settings, spec);
        // TODO: this is quite inefficient, should be integrated into a custom extend() function
        var keys = Object.keys(optionsListeners);
        for (var i=0; i<keys.length; i++) {
            var a = propertyDeep(old, keys[i]),
                b = propertyDeep(this.settings, keys[i]);
            if (a !== b) {
                optionsListeners[keys[i]](b, a);
            }
        }
        
    }
    //settings.legendOptions.containerAttributes.transform = value;
    return this;
};

mapmap.prototype.draw_legend = function(value, metadata, scale, selection) {

    if (!(this.legend && scale)) {
        // nothing to do
        return this;
    }
    
    var options = mapmap.extend(true, {}, this.settings.legendOptions);
    
    if (typeof metadata == 'string') {
        metadata = mapmap.getMetadata(metadata);
    }
    
    var range = scale.range().slice(0), // clone, we might reverse() later
        labelFormat,
        thresholds;

    // set up labels and histogram bins according to scale
    if (scale.invertExtent) {
        // for quantization scales we have invertExtent to fully specify bins
        labelFormat = function(d,i) {
            var extent = scale.invertExtent(d);
            if (isNaN(extent[0])) {
                return "unter " + metadata.format(extent[1]);
            }
            if (isNaN(extent[1])) {
                return "> " + metadata.format(extent[0]) + " und mehr";
            }
            return ((i<range.length-1) ? "> " : "") + metadata.format(extent[0]) + " bis " + metadata.format(extent[1]);
        };
    }
    else {
        // ordinal scales
        labelFormat = metadata.getFormatter();
    }
    
    var histogram = null;

    if (options.histogram) {
        if (scale.invertExtent) {
            var hist_range = scale.range();
            thresholds = [scale.invertExtent(hist_range[0])[0]];
            for (var i=0; i<hist_range.length; i++) {
                var extent = scale.invertExtent(hist_range[i]);
                thresholds.push(extent[1]);
            }
        }
        else {
            // ordinal scales
            thresholds = range.length;
        }
        
        var histogram_objects = this.getObjects(selection)[0];
        
        var make_histogram = d3.layout.histogram()
            .bins(thresholds)
            .value(function(d){
                return d.__data__.properties[value];
            })
            // use "density" mode, giving us histogram y values in the range of [0..1]
            .frequency(false);

        histogram = make_histogram(histogram_objects);
    }
    
    if (this.legend) {
        this.legend.call(this, value, metadata, range, labelFormat, histogram, options);
    }
    
    return this;

};

function valueOrCall(spec) {
    if (typeof spec == 'function') {
        return spec.apply(this, Array.prototype.slice.call(arguments, 1));
    }
    return spec;
}

mapmap.prototype.legend = function(legend) {
    this.legend = legend;
}

mapmap.legend = {};

mapmap.legend.html = function(options) {

    var defaultOptions = {
        legendClassName: 'mapLegend',
        legendStyle: {},
        cellStyle: {},
        colorBoxStyle: {
            display: 'inline-block',
            overflow: 'hidden',
            width: '1em',
            height: '1em',
            'vertical-align': '-0.1em',
            'margin-right': '0.3em'
        },
        colorFillStyle: {
            width: '0',
            height: '0',
            'border-width': '100px',
            'border-style': 'solid'
        },
        histogramBarStyle: {},
        textStyle: {}
    };
    
    
return function(value, metadata, range, labelFormat, histogram, _options) {

    options = mapmap.extend(defaultOptions, this.settings.legendOptions, options, _options);
    
    var legend = this._elements.parent.find('.' + options.legendClassName);
    if (legend.length == 0) {
        legend = $('<div class="' + options.legendClassName + '"></div>');
        this._elements.parent.prepend(legend);
    }
    legend = d3.select(legend[0]);
    
    legend.style(options.legendStyle);
    
    // TODO: value may be a function, so we cannot easily generate a label for it
    var title = legend.selectAll('h3')
        .data([valueOrCall(metadata.label, value) || '']);
        
    title.enter()
        .append('h3');
    
    title
        .html(function(d){return d;});
    
    // we need highest values first
    range.reverse();
    
    var cells = legend.selectAll('div.legendCell')
        .data(range);
    
    cells.exit().remove();
    
    var newcells = cells.enter()
        .append('div')
        .attr('class', 'legendCell')
        .style(options.cellStyle);
        
    newcells.append('span')
        .attr('class', 'legendColor')
        .style(options.colorBoxStyle)
        .append('span')
        .attr('class', 'fill')
        .style(options.colorFillStyle);
                
    newcells.append('span')
        .attr('class','legendLabel')
        .style(options.textStyle);
    
    if (options.histogram) {

        newcells.append('span')
            .attr('class', 'legendHistogramBar')
            .style(options.histogramBarStyle);

        cells.select('.legendHistogramBar').transition()
            .style('width', function(d,i){
                var width = (histogram[histogram.length-i-1].y * options.histogramLength);
                // always round up to make sure at least 1px wide
                if (width > 0 && width < 1) width = 1;
                return Math.round(width) + 'px';
            });
    }

    cells.select('.legendColor .fill').transition()
        .style({
            'background-color': function(d) {return d;},
            'border-color': function(d) {return d;},
            'color': function(d) {return d;}
        });
    
    cells.select('.legendLabel')
        .text(labelFormat);
};
}

mapmap.legend.svg = function() {
return function svg_legend(range, labelFormat, histogram, options) {
    
    // TODO: we can't integrate thes into settings because it references settings attributes
    var layouts = {
        'horizontal': {
            cellAttributes: {
                transform: function(d,i){ return 'translate(' + i * (options.colorAttributes.width + options.cellSpacing) + ',0)';}
            },
            textAttributes: {
                y: function() { return options.colorAttributes.height + options.cellSpacing;}
                
            }
        },
        'vertical': {
            cellAttributes: {
                transform: function(d,i){ return 'translate(0,' + i * (options.colorAttributes.height + options.cellSpacing) + ')';}
            },
            textAttributes: {
                x: function() { return options.colorAttributes.width + options.cellSpacing;},
            }
        }
    };

    var layout = layouts[options.layout];
    
    if (options.layout == 'vertical') {
        range.reverse();
    }
    
    this._elements.legend.attr(options.containerAttributes);
 
    var bg = this._elements.legend.selectAll('rect.background')
        .data([1]);
    
    bg.enter()
        .append('rect')
        .attr('class', 'background')
        .attr(options.backgroundAttributes);
    bg.transition().attr('height', histogram.length * (options.colorAttributes.height + options.cellSpacing) + (20 - options.cellSpacing));    
        
    var cells = this._elements.legend.selectAll('g.cell')
        .data(range);
    
    cells.exit().remove();
    
    var newcells = cells.enter()
        .append('g')
        .attr('class', 'cell')
        .attr(options.cellAttributes)
        .attr(layout.cellAttributes);
        
    newcells.append('rect')
        .attr('class', 'color')
        .attr(options.colorAttributes)
        .attr(layout.colorAttributes);
                
    if (options.histogram) {

        newcells.append('rect')
            .attr("class", "bar")
            .attr(options.histogramBarAttributes);

        cells.select('.bar').transition()
            .attr("width", function(d,i){
                return histogram[histogram.length-i-1].y * options.histogramLength;
            });
    }

    newcells.append('text')
        .attr(options.textAttributes)
        .attr(layout.textAttributes);
    
    cells.select('.color').transition()
        .attr('fill', function(d) {return d;});
    
    cells.select('text')
        .text(labelFormat);
};
};

mapmap.size = function() {
    return {
        width: this.width,
        height: this.height
    };
};

mapmap.prototype.extent = function(selection, options) {

    var map = this;
    
    this.selected_extent = selection || this.selected;
    
    this._promise.geometry.then(function(topo) {
        // TODO: getObjects() depends on <path>s being drawn, but we want to 
        // be able to call extent() before draw() to set up projection
        // solution: manage merged geometry + data independent from SVG representation
        var geom = map.getObjects(map.selected_extent);
        var all = {
            'type': 'FeatureCollection',
            'features': []
        };
        geom.each(function(d){
            all.features.push(d);
        });

        map._extent(all, options);
    });
    return this;
};

mapmap.prototype._extent = function(geom, options) {

    options = mapmap.extend(true, {}, this.settings.extentOptions, options);
    
    // convert/merge topoJSON
    if (geom.type && geom.type == 'Topology') {
        // we need to merge all named features
        var names = Object.keys(geom.objects);
        var all = {
            'type': 'FeatureCollection',
            'features': []
        };
        for (var i=0; i<names.length; i++) {
            $.merge(all.features, topojson.feature(geom, geom.objects[names[i]]).features);
        }
        geom = all;
    }
    
    // reset scale to be able to calculate extents of geometry
    projection.scale(1);
    var bounds = path.bounds(geom);
    var geo_bounds = d3.geo.bounds(geom);
    var fac_x = 1 - Math.abs(0.5 - center.x) * 2,
        fac_y = 1 - Math.abs(0.5 - center.y) * 2;
    var scale = options.size / Math.max((bounds[1][0] - bounds[0][0]) / this.width / fac_x, (bounds[1][1] - bounds[0][1]) / this.height / fac_y);
    
    projection
        .scale(scale)
        .center([(geo_bounds[0][0] + geo_bounds[1][0]) / 2, (geo_bounds[0][1] + geo_bounds[1][1]) / 2])
        .translate([this.width / 2, this.height / 2]);  
    
    // apply new projection to existing paths
    this._elements.map.selectAll("path")
        .attr("d", path);
        
    
};

function keyOrCallback(val) {
    if (typeof val != 'function') {
        return function(d){
            return d[val];
        };
    }
    return val;
}

// UMD footer
  return mapmap;
}));

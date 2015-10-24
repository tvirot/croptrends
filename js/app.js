(function() {

  // Constants
  var
    METADATA_API = "http://nass-api.azurewebsites.net/api/get_dependent_param_values?",
    DATA_API = "http://nass-api.azurewebsites.net/api/api_get?";

  var stateNames = {};

  // DOMS
  var tooltip = d3.select(".tooltip"),
      tooltipState = tooltip.select("#tooltip-state"),
      tooltipContent = tooltip.select("#tooltip-content");
  var tooltipOffset = [0][0];
  var labels = [];

  // Viz elements
  var width = 725;
  var height = 420;

  var svg, counties, states, highlight, projection, path;
  // TO-DO: Get width and height from DOM to fully support responsive UI

  var miniSVG, timeseries, slider, knob, x, y, xAxis, yAxis, brush, line;

  var radius = d3.scale.sqrt()
    .range([2, 40]);
  var color = d3.scale.quantile()
    .range(["#f0f9e8", "#ccebc5", "#a8ddb5", "#7bccc4", "#4eb3d3", "#2b8cbe", "#08589e"]);
    //.range(["#ccebc5", "#a8ddb5", "#7bccc4", "#4eb3d3", "#2b8cbe", "#08589e"]);//.range(["#00B6A6", "#54278f"]);
    //.range(["#f2f0f7", "#dadaeb", "#bcbddc", "#9e9ac8", "#756bb1", "#54278f"]);

  // State variables
  var isMapReady = false; // Don't bind any data unless the map data is loaded.
  var isDataReady = false;
  var dataSelection = {
    commodity: "BARLEY",
    group: "FIELD CROPS",
    stat: "YIELD"
  };
  var uiState = {
    year: undefined,
    zoom: d3.select(null),
    state: 6,
    county: 6029
  };
  var data, metadata;

  function initMap() {
    var vizDiv = d3.select(".viz")[0][0];
    tooltipOffset = [vizDiv.offsetLeft, vizDiv.offsetTop];

    var margin = {top: 20, right: 20, bottom: 20, left: 20},
      width_ = width - margin.left - margin.right,
      height_ = height - margin.top - margin.bottom;

    var mapDiv = d3.select(".map");
    svg = mapDiv.append("svg")
      .attr("class", "map-background")
      .attr("width", width)
      .attr("height", height)
      .on("click", resetZoom)
        .append("g")
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    counties = svg.append("g")
      .attr("class", "counties");

    states = svg.append("g")
      .attr("class", "states");

    highlight = svg.append("g")
      .attr("class", "highlight");

    projection = d3.geo.albersUsa()
      .scale(800)
      .translate([width_ / 2, height_ / 2]);

    path = d3.geo.path()
      .projection(projection);

    // TO-DO: Compile a new topojson file with state names included
    d3.tsv("dat/us-state-names.tsv", function(err, tsv){
      if (err) throw err;

      tsv.forEach(function(d, i){
        stateNames[d.id] = d.name;
      });

      d3.json("dat/us.json", function(err2, us) {
        if (err2) throw err2;

        /* BUBBLE MAP */

        // states.selectAll(".state")
        //   .data(topojson.feature(us, us.objects.states).features)
        //   .enter()
        //     .append("path")
        //   .attr("class", "state")
        //   .attr("d", path)
        //   .on("mouseout", function() {
        //     tooltip.style("visibility", "hidden");
        //   })
        //   .on("mousemove", showTooltip);

        // counties.selectAll(".bubble")
        //   .data(topojson.feature(us, us.objects.counties).features)
        //   .enter()
        //     .append("circle")
        //   .attr("class", "bubble")
        //   .attr("transform", function(d) {
        //     var centroid = path.centroid(d);
        //     if (isNaN(centroid[0])) return;
        //     return "translate(" + path.centroid(d) + ")";
        //   })
        //   .attr("r", 0);

        // counties.selectAll(".dot")
        //   .data(topojson.feature(us, us.objects.counties).features)
        //   .enter()
        //     .append("circle")
        //   .attr("class", "dot")
        //   .attr("transform", function(d) {
        //     var centroid = path.centroid(d);
        //     if (isNaN(centroid[0])) return;
        //     return "translate(" + path.centroid(d) + ")";
        //   })
        //   .attr("r", 1.5);

        /* CHOROPLETH */

        counties.selectAll(".county")
          .data(topojson.feature(us, us.objects.counties).features)
          .enter()
            .append("path")
          .attr("class", "county")
          .attr("d", path);

        // states.append("path")
        //   .datum(topojson.mesh(us, us.objects.states, function(a, b) {
        //     return a.id !== b.id;
        //   }))
        //   .attr("class", "state-outline")
        //   .attr("d", path);

        states.selectAll(".state")
          .data(topojson.feature(us, us.objects.states).features)
          .enter()
            .append("path")
          .attr("class", "state")
          .attr("d", path)
          .on("mouseout", function() {
            highlight.selectAll('*').remove();
            changeState(undefined)
          })
          .on("mouseover", function(d) {
            highlight.append("path")
              .datum(d)
              .attr("class", "highlight-outer")
              .attr("d", path);
            highlight.append("path")
              .datum(d)
              .attr("class", "highlight-inner")
              .attr("d", path);
            changeState(d.id);
          })
          .on("click", zoomed);

        isMapReady = true;
      });
    });
  }

  function initTimeseries() {
    labels.commodity = d3.select("#label-commodity");
    labels.stat = d3.select("#label-stat");
    labels.number = d3.select("#label-number");
    labels.unit = d3.select("#label-unit");
    labels.region = d3.select("#label-region");
    labels.year = d3.select("#label-year");

    var timeseriesDiv = d3.select(".timeseries");
    var margin = {top: 10, right: 20, left: 50},
      width_ = width - margin.left - margin.right;

    var lineChartHeight = 64;

    x = d3.scale.linear()
      .range([5, width_ - 5])
      .clamp(true);

    y = d3.scale.linear()
      .domain([0, 100])
      .range([lineChartHeight-5, 5]);

    brush = d3.svg.brush()
      .x(x)
      .on("brush", slided);

    miniSVG = timeseriesDiv.append("svg")
      .attr("width", width)
      .attr("height", 160)
        .append("g")
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    timeseries = miniSVG.append("g")
    timeseries.append("rect")
      .attr("class", "background")
      .attr("width", width_)
      .attr("height", lineChartHeight);

    yAxis = d3.svg.axis()
      .scale(y)
      .orient("left")
      .ticks(4)
      .tickSize(-width_)
      .tickPadding(12);

    timeseries.append("g")
      .attr("class", "y axis")
      .call(yAxis);

    xAxis = d3.svg.axis()
      .scale(x)
      .orient("bottom")
      .tickFormat(function(d) { return d; })
      .tickSize(-lineChartHeight)
      .ticks(12)
      .tickPadding(12);

    timeseries.append("g")
      .attr("class", "x axis")
      .attr("transform", "translate(0," + lineChartHeight + ")")
      .call(xAxis);

    sliderBar = d3.svg.axis()
      .scale(x)
      .orient("top")
      .tickFormat("")
      .tickSize(0)
      .tickPadding(20);

    timeseries.append("g")
      .attr("class", "slider-bar")
      .attr("transform", "translate(0," + (100 + 10 / 2) + ")")
      .call(sliderBar)
      .select(".domain")
      .select(function() {
        return this.parentNode.appendChild(this.cloneNode(true));
      })
      .attr("class", "halo");

    slider = miniSVG.append("g")
      .attr("class", "slider")
      .attr("transform", "translate(0, " + 100 + ")")
      .call(brush);

    slider.select(".background")
      .attr("height", 10)
      .style("cursor", "pointer");

    handle = slider.append("g")
      .attr("transform", "translate(0," + 10 / 2 + ")");

    handle.append("circle")
      .attr("class", "handle")
      .attr("r", 8);

    handle.append("circle")
      .attr("class", "handle-color")
      .attr("r", 4);

    line = d3.svg.line()
      .x(function(d) { return x(d.x); })
      .y(function(d) { return y(d.y); });


    slider.selectAll(".slider .extent").remove();
    slider.selectAll(".slider .resize").remove();

    // slider
    //   .call(brush.event)
    // .transition()
    //   .duration(750)
    //   .call(brush.extent([uiState.year, uiState.year]))
    //   .call(brush.event);
  }

  function resetZoom() {
    uiState.zoom = d3.select(null);
    svg.transition()
      .duration(500)
      .ease("exp-out")
      .attr("transform", "");

    setTimeout(function() {
      states.selectAll("*")
        .style("visibility", "visible");
      highlight.selectAll("*")
        .style("visibility", "visible");
      counties.selectAll(".county")
        .style("visibility", "visible")
        .style("stroke-width", "0.5px");
    }, 500);
  }

  function zoomed(state) {
    d3.event.stopPropagation();

    // TO-DO: If no data, return.

    if (uiState.zoom.node() === this) return resetZoom();
    uiState.zoom = d3.select(this);

    var bounds = path.bounds(state),
      dx = bounds[1][0] - bounds[0][0],
      dy = bounds[1][1] - bounds[0][1],
      x = (bounds[0][0] + bounds[1][0]) / 2,
      y = (bounds[0][1] + bounds[1][1]) / 2,
      scale = .8 / Math.max(dx / width, dy / height),
      translate = [width / 2 - scale * x, height / 2 - scale * y];

    svg.transition()
      .duration(500)
      .attr("transform", "translate(" + translate + ")scale(" + scale + ")");

    highlight.selectAll("*")
        .style("visibility", "hidden");

    states.selectAll("*")
      .style("visibility", "hidden");

    counties.selectAll(".county")
      .style("visibility", function(d) {
        if (Math.floor(d.id / 1000) === state.id) {
          return "visible";
        }
        return "hidden";
      })
      .style("stroke-width", 1.0 / scale + "px");

  }

  function slided() {
    var value = Math.round(brush.extent()[0]);

    if (d3.event.sourceEvent) {
      value = Math.round(x.invert(d3.mouse(this)[0]));
      brush.extent([value, value]);
    }

    handle.selectAll("circle")
      .transition()
      .duration(25)
      .attr("cx", x(value));

    changeYear(value);
  }

  function changeState(stateID) {
    uiState.state = stateID;
    updateTimeseries();
    if (!uiState.state) {
      labels.region.html('National');
    } else {
      labels.region.html(stateNames[stateID]);
    }
    updateNumberLabel();
  }

  function changeYear(year) {
    uiState.year = year;

    updateMap();
    updateTimeseries(); // TO-DO: Consider removing this.

    labels.year.html(year);
    updateNumberLabel();
  }

  function changeCounty(countyID) {
    updateNumberLabel()
  }

  function toggleZoom() {
    updateNumberLabel()
  }

  function updateNumberLabel() {
    labels.number.html('stat_here');
  }

  function updateData() {
    isDataReady = false;

    var params = {
        "commodity_desc": dataSelection.commodity,
        "group_desc": dataSelection.group,
        "agg_level_desc": "COUNTY",
        "statisticcat_desc": dataSelection.stat,
        "source_desc": "SURVEY",
        "freq_desc": "ANNUAL",
        "prodn_practice_desc": "ALL PRODUCTION PRACTICES",
        "util_practice_desc": "ALL UTILIZATION PRACTICES",
        "class_desc": "ALL CLASSES",
        "domain_desc": "TOTAL",
        "reference_period_desc": "YEAR",
        // "year__ge": "1900",
        "value__ne": "(D)"
    };

    // if (dataSelection.stat === "PRODUCTION") {
    //   params.unit_desc = "$";
    // }

    getData(
      params,
      {},
      function(err, json) {
        if (err) throw err;
        // console.log(JSON.stringify(json));
        // console.log(json.data.length);

        data = {};
        metadata = { unit: json.data[0].unit_desc };

        values = [];
        json.data.forEach(function(d) {
          if (!data.hasOwnProperty(d.year)) {
            data[d.year] = {};
          }

          if (data[d.year].hasOwnProperty(+d.county_code)) {
            throw "There are multiple records corresponding to (" + d.year + ", county " + d.county_code + ")";
          }

          var value = +d.value.replace(/,/g, "");
          data[d.year][+(d.state_fips_code + d.county_code)] = value;
          values.push(value);
        });

        metadata.years = Object.keys(data).sort();

        // Update scales
        color.domain(values);
        // color.domain(d3.extent(values));
        // console.log(color.quantiles());
        radius.domain(d3.extent(values));

        x.domain(d3.extent(metadata.years));
        timeseries.select("g.x.axis")
          .call(xAxis);

        labels.commodity.html(dataSelection.commodity);
        labels.stat.html(dataSelection.stat);
        labels.unit.html(metadata.unit);
        if (uiState.year &&
            uiState.year <= metadata.years[1] &&
            uiState.year >= metadata.years[0]) {
          changeYear(uiState.year);
        } else {
          changeYear(metadata.years[0]);
        }

        isDataReady = true;

        updateMap();
        updateTimeseries();
        updateNumberLabel();

        // console.log(data);
      }
    );
  }

  function updateMap() {
    if (!isMapReady || !isDataReady) return;

    // counties.selectAll(".bubble")
    //   .style("fill", function(d) {
    //     if (data[uiState.year].hasOwnProperty(d.id)) {
    //       return color(data[uiState.year][d.id]);
    //     }
    //     return 0;
    //   })
    //   .attr("r", function(d) {
    //     if (data[uiState.year].hasOwnProperty(d.id)) {
    //       return radius(data[uiState.year][d.id]);
    //     }
    //     return 0;
    //   });
    // counties.selectAll(".dot")
    //   .style("fill", function(d) {
    //     if (data[uiState.year].hasOwnProperty(d.id)) {
    //       return color(data[uiState.year][d.id]);
    //     }
    //     return 0;
    //   })
    //   .style("visibility", function(d) {
    //     if (data[uiState.year].hasOwnProperty(d.id)) {
    //       return "visible"
    //     }
    //     return "hidden";
    //   });

    counties.selectAll(".county")
      .style("fill", function(d) {
        if (data[uiState.year].hasOwnProperty(d.id)) {
          return color(data[uiState.year][d.id]);
        }
        return "#fff";
      })
  }

  function updateTimeseries() {
    if (!isMapReady || !isDataReady) return;

    // TO-DO: Check aggregation level
    var lineData = metadata.years
      .map(function(d) {
        if (data[d].hasOwnProperty(uiState.county)) {
          return {x: +d, y: data[d][uiState.county]};
        }
      })
      .filter(function(d) {
        return d !== undefined;
      });

    y.domain(d3.extent(lineData, function(d) { return d.y; }));
    timeseries.select("g.y.axis")
      .call(yAxis);

    timeseries.selectAll(".line").remove();
    timeseries.append("path")
      .attr("class", "line")
      .attr("d", line(lineData));

    timeseries.selectAll(".point").remove()
    timeseries.selectAll(".point")
      .data(lineData).enter()
        .append("circle")
      .attr("class", "point")
      .classed("selected", function(d) { return d.x == uiState.year; })
      .attr("r", 4)
      .attr("cx", function(d) { return x(d.x); })
      .attr("cy", function(d) { return y(d.y); });
  }

  function showTooltip(d) {
    if (!isDataReady) return;

    tooltipState.html(stateNames[d.id]);
    if (data[uiState.year].hasOwnProperty(d.id)) {
      tooltipContent.html(data[uiState.year][d.id] + " " +  metadata.unit);
    } else {
      tooltipContent.html("n/a");
    }

    tooltip.style("visibility", "visible")
      .style("left", d3.event.pageX - tooltipOffset[0] + "px")
      .style("top", d3.event.pageY - tooltipOffset[1] + "px");
  }

  function genURLparams(params) {
    return Object.keys(params).map(function(key) {
      return [key, params[key]].map(encodeURIComponent).join("=");
    }).join("&");
  }

  function genURLparamsOR(params) {
    return Object.keys(params).map(function(key) {
      return params[key].map(function(d) {
        return encodeURIComponent(key + '__or=' + d);
      }).join("&");
    }).join("&");
  }

  function getMetaData(params, callback) {
    var url = METADATA_API + genURLparams(params);
    console.log(url);
    d3.json(url, callback);
  }

  function getData(params, paramsOR, callback) {
    var url = DATA_API + genURLparams(params) + genURLparamsOR(paramsOR);
    console.log(url);
    console.log("READ FROM LOCAL!!");
    console.log($('#popoverLegend').html());
    d3.json('dat/county-sample-big.json', callback);
    // d3.json(url, callback);
  }

  // function changeClass(params){

  //   if (params.classList.contains("expanded")) return;

  //   var x = document.querySelectorAll(".expanded");
  //   var index;
  //   for (index = 0; index < x.length; ++index) {
  //     x[index].classList.remove("expanded");
  //     x[index].classList.add("collapsed");
  //   }

  //   params.classList.remove("collapsed");
  //   params.classList.add("expanded");
  // }

  // window.onload = function()
  // {
  //   document.getElementById("crops").onclick = function() {changeClass(this)};
  //   document.getElementById("fruitTreeNuts").onclick = function() {changeClass(this)};
  //   document.getElementById("vegetables").onclick = function() {changeClass(this)};
  // }

//  $(document).ready(function(){
//     $('[data-toggle="tooltip"]').tooltip();
//     // $('[data-toggle="popover"]').popover()
// });

    // title: function() {
    //   // console.log($('#popoverLegend').html(););
    //   return $('#popoverLegend').html();
    // })

$(function () {
  $('[data-toggle="tooltip"]').tooltip()
  $('.icon-legend').tooltip({
    html: true,
    placement: "left",
    title:
    '<div class="title">Bushels per acre</div>' +
    '<div><span class="concentration level1"></span><span>Not estimated</span></div>' +
    '<div><span class="concentration level2"></span><span>< 50</span></div>' +
    '<div><span class="concentration level3"></span><span>50 - 59.9</span></div>' +
    '<div><span class="concentration level4"></span><span>60 - 69.9</span></div>' +
    '<div><span class="concentration level5"></span><span>70 - 79.9</span></div>' +
    '<div><span class="concentration level6"></span><span>80 - 89.9</span></div>' +
    '<div><span class="concentration level7"></span><span>90 +</span></div>'
    });

  // $('[data-toggle="popover"]').popover()
  // $('.icon-legend').popover({
  //   html: true,
  //   title: "Bushels per acre",
  //   content: function() {
  //     return $('#popoverLegend').html();
  //   },
  //   placement: "left"
  // }); 
})

  initMap();
  initTimeseries();
  window.setTimeout(updateData, 2000);

  // getMetaData(
  //   {
  //     "distinctParams": "agg_level_desc",
  //     "group_desc": "FIELD CROPS",
  //     // Fixed conditions
  //     "statisticcat_desc": "PRICE RECEIVED",
  //     //"unit_desc": "$",
  //     //"agg_level_desc": "STATE",
  //     "freq_desc": "ANNUAL",
  //     "prodn_practice_desc": "ALL PRODUCTION PRACTICES",
  //     "util_practice_desc": "ALL UTILIZATION PRACTICES",
  //     "class_desc": "ALL CLASSES",
  //     "domain_desc": "TOTAL"
  //   },
  //   function(err, json) {
  //     if (err) throw err;
  //     console.log(json);
  //     console.log(JSON.stringify(json.data[0].Values));
  //   }
  // );

  // getData(
  //   {
  //     "commodity_desc": "COTTON",
  //     "group_desc": "FIELD CROPS",
  //     "agg_level_desc": "STATE",
  //     "statisticcat_desc": "PRODUCTION",
  //     "unit_desc": "$",
  //     "freq_desc": "ANNUAL",
  //     "prodn_practice_desc": "ALL PRODUCTION PRACTICES",
  //     "util_practice_desc": "ALL UTILIZATION PRACTICES",
  //     "class_desc": "ALL CLASSES",
  //     "domain_desc": "TOTAL",
  //     "reference_period_desc": "YEAR",
  //     // "year": "1990"
  //   },
  //   {
  //     // "commodity_desc": ["COTTON", "BARLEY"]
  //     // "statisticcat_desc": ["AREA HARVESTED","AREA PLANTED","PRICE RECEIVED","PRODUCTION","YIELD"]
  //   },
  //   function(err, json) {
  //     if (err) throw err;
  //     console.log(json);
  //   }
  // )

})();
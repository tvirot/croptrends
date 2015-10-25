(function() {

  var commodities = [
    'barley', 'beans', 'canola', 'corn',
    'cotton-pima', 'cotton-upland', 'flaxseed', 'hay-alfalfa',
    'hay-others', 'oats', 'peanuts', 'rice', 'sorghum' ,
    'soybeans', 'sugarbeets', 'sugarcane', 'sunflower-non-oil',
    'sunflower-oil', 'sweet_potatoes', 'tobacco-burley', 'tobacco-flue-cured',
    'wheat-durum', 'wheat-spring', 'wheat-winter'
  ];
  var statStrs = {
    planted: "Area Planted",
    harvested: "Area Harvested",
    yield: "Yield",
    production: "Production"
  };
  var noPlanted = [
    'hay-alfalfa', 'hay-others', 'sugarcane',
    'tobacco-burley', 'tobacco-flue-cured',
  ];

  // DOMS
  var tooltip = d3.select(".tooltip"),
      tooltipState = tooltip.select("#tooltip-state"),
      tooltipContent = tooltip.select("#tooltip-content");
  var tooltipOffset = [0][0];
  var labels = [];

  // Viz elements
  var width = 725;
  var height = 380;
  var mapMargin = {top: 10, right: 10, bottom: 10, left: 10}

  var svg, counties, states, highlight, projection, path;
  var miniSVG, timeseries, slider, knob, x, y, xAxis, yAxis, brush, line;

  var radius = d3.scale.sqrt()
    .range([2, 40]);
  var color = d3.scale.threshold()
    .range(["#f0f9e8", "#ccebc5", "#a8ddb5", "#7bccc4", "#4eb3d3", "#2b8cbe", "#08589e"]);
  var thousandComma = d3.format('0,000');

  // State variables
  var isMapReady = false; // Don't bind any data unless the map data is loaded.
  var isDataReady = false;

  var dataSelection = {
    commodity: "barley",
    stat: "planted"
  };
  var uiState = {
    year: undefined,
    zoom: d3.select(null),
    mode: "NATIONAL",
    state: undefined,
    county: undefined
  };

  var summary;

  function initUI() {
    var menu = d3.select(".commodity ul");
    menu.selectAll("li")
      .data(commodities)
      .enter()
        .append("li")
      .classed("active", function(d,i) { return i == 0; })
      .html(function(d) {
        d = d.replace(/_/g, " ");
        var breakpoint = d.indexOf('-');
        if (breakpoint > -1) {
          return capitalize(d.substr(0, breakpoint)) + " (" +
            d.substr(breakpoint+1) + ")";
        }
        return capitalize(d);
      })
      .on("click", function(d) {
        dataSelection.commodity = d;
        menu.select("li.active").classed("active", false);
        d3.select(this).classed("active", true);
        updateData();
      });
  }

  function initMap() {
    var vizDiv = d3.select(".viz")[0][0];
    tooltipOffset = [vizDiv.offsetLeft, vizDiv.offsetTop];

    var width_ = width - mapMargin.left - mapMargin.right,
        height_ = height - mapMargin.top - mapMargin.bottom;

    var mapDiv = d3.select(".map");
    svg = mapDiv.append("svg")
      .attr("class", "map-background")
      .attr("width", width)
      .attr("height", height)
      .on("click", resetZoom)
        .append("g")
      .attr("transform", "translate(" + mapMargin.left + "," + mapMargin.top + ")");

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

    d3.json("dat/us.json", function(err2, us) {
      if (err2) throw err2;

      counties.selectAll(".county")
        .data(topojson.feature(us, us.objects.counties).features)
        .enter()
          .append("path")
        .attr("class", "county")
        .attr("d", path)
        .on("mouseout", function() {
          highlight.selectAll('*').remove();
          changeCounty(undefined)
        })
        .on("mouseover", function(d) {
          if (!summary.county.hasOwnProperty(d.id)) {
            d3.select(this).style("cursor", "not-allowed")
            return;
          }

          highlight.append("path")
            .datum(d)
            .attr("class", "highlight-outer")
            .attr("d", path)
            .style("stroke-width", 4.5 / uiState.zoomScale + "px");
          highlight.append("path")
            .datum(d)
            .attr("class", "highlight-inner")
            .attr("d", path)
            .style("stroke-width", 1 / uiState.zoomScale + "px");
          changeCounty(d.id);
        });

      states.selectAll(".state")
        .data(topojson.feature(us, us.objects.states).features)
        .enter()
          .append("path")
        .attr("class", "state")
        .attr("d", path)
        .on("mouseout", function() {
          highlight.selectAll('*').remove();
          if (uiState.mode === 'NATIONAL') {
            changeState(undefined);
          }
        })
        .on("mouseover", function(d) {
          if (!summary.state.hasOwnProperty(d.id)) {
            d3.select(this).style("cursor", "not-allowed")
            return;
          }

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
        .on("click", function(d) {
          if (!summary.state.hasOwnProperty(d.id)) {
            return;
          }
          zoomed(d);
        });

      isMapReady = true;
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
      .tickPadding(12)
      .tickFormat(d3.format("s"));

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
  }

  function resetZoom() {
    uiState.zoom = d3.select(null);
    highlight.selectAll('*').remove();

    svg.transition()
      .duration(500)
      .ease("exp-out")
      .attr("transform", "translate(" + mapMargin.left + "," + mapMargin.top + ")");

    setTimeout(function() {
      states.selectAll("*")
        .style("visibility", "visible");
      counties.selectAll(".county")
        .style("visibility", "visible")
        .style("stroke-width", "0.5px");
    }, 500);

    toggleZoom();
    changeState(undefined);
  }

  function zoomed(state) {
    d3.event.stopPropagation();

    // TO-DO: If no data, return.

    if (uiState.zoom.node() === this) return resetZoom();

    var width_ = width - mapMargin.left - mapMargin.right,
        height_ = height - mapMargin.top - mapMargin.bottom;

    uiState.zoom = d3.select(this);

    var bounds = path.bounds(state),
      dx = bounds[1][0] - bounds[0][0],
      dy = bounds[1][1] - bounds[0][1],
      x = (bounds[0][0] + bounds[1][0]) / 2,
      y = (bounds[0][1] + bounds[1][1]) / 2,
      scale = .8 / Math.max(dx / width_, dy / height_),
      translate = [width_ / 2 - scale * x, height_ / 2 - scale * y];

    uiState.zoomScale = scale;

    svg.transition()
      .duration(500)
      .attr("transform", "translate(" + translate + ")scale(" + scale + ")");

    highlight.selectAll('*').remove();

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

    toggleZoom();
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
    if (uiState.state === undefined) {
      labels.region.html('United States');
    } else {
      labels.region.html(summary.state[stateID].name);
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
    uiState.county = countyID;
    updateTimeseries();
    if (uiState.county === undefined) {
      labels.region.html(summary.state[uiState.state].name);
    } else {
      labels.region.html(summary.county[countyID].name);
    }
    updateNumberLabel()
  }

  function toggleZoom() {
    if (uiState.mode == 'NATIONAL') {
      uiState.mode = 'STATE';
    } else if (uiState.mode == 'STATE') {
      uiState.mode = 'NATIONAL';
    }
    updateNumberLabel()
  }

  function updateNumberLabel() {
    var value;
    if (uiState.mode == 'NATIONAL') {
      if (uiState.state) {
        value = summary.state[uiState.state].data[uiState.year];
      } else {
        value = summary.national.data[uiState.year];
      }
    } else if (uiState.mode == 'STATE') {
      if (uiState.county) {
        value = summary.county[uiState.county].data[uiState.year];
      } else {
        value = summary.state[uiState.state].data[uiState.year];
      }
    }

    if (value === undefined) {
      labels.number.html("-");
      labels.unit.html("");
    } else {
      labels.number.html(thousandComma(value));
      labels.unit.html(summary.metadata.unit.toLowerCase());
    }
  }

  function updateData() {
    isDataReady = false;

    // Load spinner

    var filename = "dat/nass/" + dataSelection.commodity + "-" +
      dataSelection.stat + ".json";

    d3.json(filename, function(err, json) {
      if (err) throw err;

      summary = json;

      // Update scales
      color.domain(summary.metadata.colorQuantiles);

      x.domain(summary.metadata.yearRange);
      timeseries.select("g.x.axis")
        .call(xAxis);

      labels.commodity.html(dataSelection.commodity);
      labels.stat.html(statStrs[dataSelection.stat]);
      labels.unit.html(summary.metadata.unit.toLowerCase());

      changeState(uiState.state);
      if (uiState.year &&
          uiState.year <= summary.metadata.yearRange[1] &&
          uiState.year >= summary.metadata.yearRange[0]) {
        changeYear(uiState.year);
      } else {
        changeYear(summary.metadata.yearRange[1]);
      }

      slider
        .call(brush.extent([uiState.year, uiState.year]))
        .call(brush.event);

      $('.icon-legend').tooltip({
        html: true,
        placement: "left",
        title:
        '<div class="title">' + summary.metadata.unit.toLowerCase() + '</div>' +
        '<div><span class="concentration level1"></span><span>Not estimated</span></div>' +
        '<div><span class="concentration level2"></span><span>< ' +
          summary.metadata.colorQuantiles[0] +
        '</span></div>' +
        '<div><span class="concentration level3"></span><span>' +
          thousandComma(summary.metadata.colorQuantiles[0]) + '-' + thousandComma(summary.metadata.colorQuantiles[0] - 1) +
        '</span></div>' +
        '<div><span class="concentration level4"></span><span>60 - 69.9</span></div>' +
        '<div><span class="concentration level5"></span><span>70 - 79.9</span></div>' +
        '<div><span class="concentration level6"></span><span>80 - 89.9</span></div>' +
        '<div><span class="concentration level7"></span><span>90 +</span></div>'
      });

      isDataReady = true;

      updateMap();
      updateTimeseries();
      updateNumberLabel();
    });
  }

  function updateMap() {
    if (!isMapReady || !isDataReady) return;

    counties.selectAll(".county")
      .style("fill", function(d) {
        if (summary.county.hasOwnProperty(d.id) &&
          summary.county[d.id].data.hasOwnProperty(uiState.year)) {
          return color(summary.county[d.id].data[uiState.year]);
        }
        return "#fff";
      })
  }

  function updateTimeseries() {
    if (!isMapReady || !isDataReady) return;

    var dat, extent;
    if (uiState.mode === "NATIONAL") {
      if (uiState.state) {
        dat = summary.state[uiState.state];
      } else {
        dat = summary.national;
      }
    } else if (uiState.mode === "STATE") {
      if (uiState.county) {
        dat = summary.county[uiState.county];
      } else {
        dat = summary.state[uiState.state];
      }
    }

    var lineData = Object.keys(dat.data)
      .map(function(d) {
        return {x: +d, y: dat.data[d]};
      });

    y.domain(dat.yRange);
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
      .attr("r", function(d) {
        if (summary.metadata.yearRange[1] -
          summary.metadata.yearRange[0] < 30) return 4;
        return 3;
      })
      .attr("cx", function(d) { return x(d.x); })
      .attr("cy", function(d) { return y(d.y); });
  }

  function capitalize(str) {
    return str.toLowerCase().replace(/(?:^|\s)\S/g, function(a) {
      return a.toUpperCase();
    });
  };

  function showTooltip(d) {
    if (!isDataReady) return;

    // tooltipState.html(stateNames[d.id]);
    // if (data[uiState.year].hasOwnProperty(d.id)) {
    //   tooltipContent.html(data[uiState.year][d.id] + " " +  metadata.unit);
    // } else {
    //   tooltipContent.html("n/a");
    // }

    tooltip.style("visibility", "visible")
      .style("left", d3.event.pageX - tooltipOffset[0] + "px")
      .style("top", d3.event.pageY - tooltipOffset[1] + "px");
  }

  $(function () {
    $('[data-toggle="tooltip"]').tooltip()
  })

  initUI();
  initMap();
  initTimeseries();
  window.setTimeout(updateData, 2000);

})();
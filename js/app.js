(function() {

  // Constants
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

    d3.json(filename, function(err, json) {
      if (err) throw err;

      // Update scales
      color.domain(values);
      // color.domain(d3.extent(values));
      // console.log(color.quantiles());

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
    });
  }

  function updateMap() {
    if (!isMapReady || !isDataReady) return;

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

  function changeClass(params){

    if (params.classList.contains("expanded")) return;

    var x = document.querySelectorAll(".expanded");
    var index;
    for (index = 0; index < x.length; ++index) {
      x[index].classList.remove("expanded");
      x[index].classList.add("collapsed");
    }

    params.classList.remove("collapsed");
    params.classList.add("expanded");
  }

  window.onload = function()
  {
    document.getElementById("crops").onclick = function() {changeClass(this)};
    document.getElementById("fruitTreeNuts").onclick = function() {changeClass(this)};
    document.getElementById("vegetables").onclick = function() {changeClass(this)};
  }

  initMap();
  initTimeseries();
  // window.setTimeout(updateData, 2000);

})();
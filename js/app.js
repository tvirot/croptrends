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

  // Viz elements
  var svg, counties, states, projection, path;
  var margin = {top: 20, right: 10, bottom: 20, left: 10},
    width = 880 - margin.left - margin.right,
    height = 420 - margin.top - margin.bottom;
  var radius = d3.scale.sqrt()
    .range([2, 40]);

  var color = d3.scale.quantile()
    //.range(["#c2e699", "#78c679", "#31a354", "#006837"]);
    .range(["#ccebc5", "#a8ddb5", "#7bccc4", "#4eb3d3", "#2b8cbe", "#08589e"]);//.range(["#00B6A6", "#54278f"]);
    //.range(["#f2f0f7", "#dadaeb", "#bcbddc", "#9e9ac8", "#756bb1", "#54278f"]);

  // State variables
  var isMapReady = false; // Don't bind any data unless the map data is loaded.
  var isDataReady = false;
  var selection = {
    commodity: "BARLEY",
    group: "FIELD CROPS",
    stat: "AREA HARVESTED",//"PRODUCTION",
    year: "2014"
  };
  var data;

  function init() {
    var vizDiv = d3.select(".viz")[0][0];
    tooltipOffset = [vizDiv.offsetLeft, vizDiv.offsetTop];

    var mapDiv = d3.select(".map");
    svg = mapDiv.append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
        .append("g")
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    states = svg.append("g")
      .attr("class", "states");

    counties = svg.append("g")
      .attr("class", "counties");

    projection = d3.geo.albersUsa()
      .scale(800)
      .translate([width / 2, height / 2]);

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

        states.selectAll(".state")
          .data(topojson.feature(us, us.objects.states).features)
          .enter()
            .append("path")
          .attr("class", "state")
          .attr("d", path)
          .on("mouseout", function() {
            tooltip.style("visibility", "hidden");
          })
          .on("mousemove", showTooltip);

        // states.append("path")
        //   .datum(topojson.mesh(us, us.objects.states, function(a, b) {
        //     return a.id !== b.id;
        //   }))
        //   .attr("class", "state-outline")
        //   .attr("d", path);

        counties.selectAll(".bubble")
          .data(topojson.feature(us, us.objects.counties).features)
          .enter()
            .append("circle")
          .attr("class", "bubble")
          .attr("transform", function(d) {
            var centroid = path.centroid(d);
            if (isNaN(centroid[0])) return;
            return "translate(" + path.centroid(d) + ")";
          })
          .attr("r", 0);

        counties.selectAll(".dot")
          .data(topojson.feature(us, us.objects.counties).features)
          .enter()
            .append("circle")
          .attr("class", "dot")
          .attr("transform", function(d) {
            var centroid = path.centroid(d);
            if (isNaN(centroid[0])) return;
            return "translate(" + path.centroid(d) + ")";
          })
          .attr("r", 1.5);

        isMapReady = true;
      });
    });
  }

  function updateData() {
    isDataReady = false;

    var params = {
        "commodity_desc": selection.commodity,
        "group_desc": selection.group,
        "agg_level_desc": "COUNTY",
        "statisticcat_desc": selection.stat,
        "source_desc": "SURVEY",
        "freq_desc": "ANNUAL",
        "prodn_practice_desc": "ALL PRODUCTION PRACTICES",
        "util_practice_desc": "ALL UTILIZATION PRACTICES",
        "class_desc": "ALL CLASSES",
        "domain_desc": "TOTAL",
        "reference_period_desc": "YEAR",
        "year__ge": "2000",
        "value__ne": "(D)"
    };

    // if (selection.stat === "PRODUCTION") {
    //   params.unit_desc = "$";
    // }

    getData(
      params,
      {},
      function(err, json) {
        if (err) throw err;
        console.log(JSON.stringify(json));
        // console.log(json);

        data = { unit: json.data[0].unit_desc };
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

        // color.domain(d3.extent(values));
        color.domain(values);
        console.log(color.quantiles());
        radius.domain(d3.extent(values));
        isDataReady = true;
        updateViz();
        // console.log(data);
      }
    );
  }

  function updateViz() {
    counties.selectAll(".bubble")
      .style("fill", function(d) {
        if (data[selection.year].hasOwnProperty(d.id)) {
          return color(data[selection.year][d.id]);
        }
        return 0;
      })
      .attr("r", function(d) {
        if (data[selection.year].hasOwnProperty(d.id)) {
          return radius(data[selection.year][d.id]);
        }
        return 0;
      });
    counties.selectAll(".dot")
      .style("fill", function(d) {
        if (data[selection.year].hasOwnProperty(d.id)) {
          return color(data[selection.year][d.id]);
        }
        return 0;
      })
      .style("visibility", function(d) {
        if (data[selection.year].hasOwnProperty(d.id)) {
          return "visible"
        }
        return "hidden";
      });
  }

  function showTooltip(d) {
    if (!isDataReady) return;

    tooltipState.html(stateNames[d.id]);
    if (data[selection.year].hasOwnProperty(d.id)) {
      tooltipContent.html(data[selection.year][d.id] + " " +  data.unit);
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
    d3.json('dat/county-sample.json', callback);
    // d3.json(url, callback);
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

  // window.onload = function()
  // {
  //   document.getElementById("crops").onclick = function() {changeClass(this)};
  //   document.getElementById("fruitTreeNuts").onclick = function() {changeClass(this)};
  //   document.getElementById("vegetables").onclick = function() {changeClass(this)};
  // }

  init();
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
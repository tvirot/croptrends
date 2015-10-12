(function() {

  // Constants
  var
    API = "http://nass-api.azurewebsites.net/api/",
    GROUP_DESC = ["FIELD CROPS", "FRUIT & TREE NUTS", "VEGETABLES"],
    YEARS = [1866, 2015],
    STATES = ["ALABAMA","ALASKA","ARIZONA","ARKANSAS","CALIFORNIA","COLORADO","CONNECTICUT","DELAWARE","FLORIDA","GEORGIA","HAWAII","IDAHO","ILLINOIS","INDIANA","IOWA","KANSAS","KENTUCKY","LOUISIANA","MAINE","MARYLAND","MASSACHUSETTS","MICHIGAN","MINNESOTA","MISSISSIPPI","MISSOURI","MONTANA","NEBRASKA","NEVADA","NEW HAMPSHIRE","NEW JERSEY","NEW MEXICO","NEW YORK","NORTH CAROLINA","NORTH DAKOTA","OHIO","OKLAHOMA","OREGON","PENNSYLVANIA","RHODE ISLAND","SOUTH CAROLINA","SOUTH DAKOTA","TENNESSEE","TEXAS","UTAH","VERMONT","VIRGINIA","WASHINGTON","WEST VIRGINIA","WISCONSIN","WYOMING"],
    COMMODITIES = [];

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
  var color = d3.scale.threshold()
    .domain([.0, .2, .4, .6, .8])
    .range(["#f2f0f7", "#dadaeb", "#bcbddc", "#9e9ac8", "#756bb1", "#54278f"]);

  // State variables
  var isMapReady = false; // Don't bind any data unless the map data is loaded.
  var isCountyDataReady = false;
  var isStateDataReady = false;
  var selection = {
    commodity: "BARLEY",
    group: "FIELD CROPS",
    stat: "AREA HARVESTED",//"PRODUCTION",
    unit: "$",
    year: "2014"
  };
  var countyData, stateData;

  function init() {
    var vizDiv = d3.select(".viz")[0][0];
    tooltipOffset = [vizDiv.offsetLeft, vizDiv.offsetTop];

    var mapDiv = d3.select(".map");
    svg = mapDiv.append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
        .append("g")
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    counties = svg.append("g")
      .attr("class", "counties");

    states = svg.append("g")
      .attr("class", "states");

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

        counties.selectAll("path")
          .data(topojson.feature(us, us.objects.counties).features)
          .enter()
            .append("path")
          .attr("class", "county")
          .attr("fill", "#ccc")
          .attr("d", path);

        states.append("path")
          .datum(topojson.mesh(us, us.objects.states, function(a, b) {
            return a.id !== b.id;
          }))
          .attr("class", "state-outline")
          .attr("d", path);

        states.selectAll("path")
          .data(topojson.feature(us, us.objects.states).features)
          .enter()
            .append("path")
          .attr("class", "state")
          .attr("d", path)
          .on("mouseout", function() {
            tooltip.style("visibility", "hidden");
          })
          .on("mousemove", showTooltip);

        isMapReady = true;
      });
    });
  }

  function updateData() {
    isCountyDataReady = false;
    isStateDataReady = false;

    var params = {
        "commodity_desc": selection.commodity,
        "group_desc": selection.group,
        "agg_level_desc": "COUNTY",
        "statisticcat_desc": selection.stat,
        "freq_desc": "ANNUAL",
        "prodn_practice_desc": "ALL PRODUCTION PRACTICES",
        "util_practice_desc": "ALL UTILIZATION PRACTICES",
        "class_desc": "ALL CLASSES",
        "domain_desc": "TOTAL",
        "reference_period_desc": "YEAR",
        "year__ge": "2010",
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
        countyData = json.data;
        isCountyDataReady = true;
        updateViz();
        console.log(json);
      }
    );
  }

  function updateViz() {

  }

  function showTooltip(d) {
    tooltipState.html(stateNames[d.id]);
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
    var url = API + "get_dependent_param_values?" + genURLparams(params);
    console.log(url);
    d3.json(url, callback);
  }

  function getData(params, paramsOR, callback) {
    var url = API + "api_get?" +
      genURLparams(params) + genURLparamsOR(paramsOR);
    console.log(url);
    d3.json(url, callback);
  }

  init();
  updateData();


  getMetaData(
    {
      "distinctParams": "agg_level_desc",
      "group_desc": "FIELD CROPS",
      // Fixed conditions
      "statisticcat_desc": "PRICE RECEIVED",
      //"unit_desc": "$",
      //"agg_level_desc": "STATE",
      "freq_desc": "ANNUAL",
      "prodn_practice_desc": "ALL PRODUCTION PRACTICES",
      "util_practice_desc": "ALL UTILIZATION PRACTICES",
      "class_desc": "ALL CLASSES",
      "domain_desc": "TOTAL"
    },
    function(err, json) {
      if (err) throw err;
      console.log(json);
      console.log(JSON.stringify(json.data[0].Values));
    }
  );

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
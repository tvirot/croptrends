(function() {

  // Constants
  var
    API = "http://nass-api.azurewebsites.net/api/",
    GROUP_DESC = ["FIELD CROPS", "FRUIT & TREE NUTS", "VEGETABLES"],
    YEARS = [1866, 2015],
    STATES = ["ALABAMA","ALASKA","ARIZONA","ARKANSAS","CALIFORNIA","COLORADO","CONNECTICUT","DELAWARE","FLORIDA","GEORGIA","HAWAII","IDAHO","ILLINOIS","INDIANA","IOWA","KANSAS","KENTUCKY","LOUISIANA","MAINE","MARYLAND","MASSACHUSETTS","MICHIGAN","MINNESOTA","MISSISSIPPI","MISSOURI","MONTANA","NEBRASKA","NEVADA","NEW HAMPSHIRE","NEW JERSEY","NEW MEXICO","NEW YORK","NORTH CAROLINA","NORTH DAKOTA","OHIO","OKLAHOMA","OREGON","PENNSYLVANIA","RHODE ISLAND","SOUTH CAROLINA","SOUTH DAKOTA","TENNESSEE","TEXAS","UTAH","VERMONT","VIRGINIA","WASHINGTON","WEST VIRGINIA","WISCONSIN","WYOMING"],
    COMMODITIES = [];

  // DOMS
  var sidebar;

  // State variables

  function init() {
    // Select all DOMs needed

    // sidebar = d3.select(".sidebar");
    // console.log(sidebar);

    // Initiailize UI
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

  getMetaData(
    {
      "distinctParams": "commodity_desc",
      "group_desc": "FIELD CROPS",
      // Fixed conditions
      "statisticcat_desc": "PRODUCTION",
      "unit_desc": "$",
      "agg_level_desc": "STATE",
      "freq_desc": "ANNUAL",
      "prodn_practice_desc": "ALL PRODUCTION PRACTICES",
      "util_practice_desc": "ALL UTILIZATION PRACTICES",
      "class_desc": "ALL CLASSES",
      "domain_desc": "TOTAL"
    },
    function(json) {
      console.log(json);
      console.log(JSON.stringify(json.data[0].Values));
    }
  );

  getData(
    {
      "commodity_desc": "COTTON",
      "agg_level_desc": "STATE",
      "state_name": "ALABAMA",
      "statisticcat_desc": "PRODUCTION",
      "unit_desc": "$",
      "freq_desc": "ANNUAL",
      "prodn_practice_desc": "ALL PRODUCTION PRACTICES",
      "util_practice_desc": "ALL UTILIZATION PRACTICES",
      "class_desc": "ALL CLASSES",
      "domain_desc": "TOTAL",
      "reference_period_desc": "YEAR",
      "year": "1997"
    },
    {
      // "statisticcat_desc": ["AREA HARVESTED","AREA PLANTED","PRICE RECEIVED","PRODUCTION","YIELD"]
    },
    function(json) {
      console.log(json);
    }
  )

})();
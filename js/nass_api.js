var request = require('request');

var METADATA_API = "http://nass-api.azurewebsites.net/api/get_dependent_param_values?";
var DATA_API = "http://nass-api.azurewebsites.net/api/api_get?";

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
  request(url, callback);
}

function getData(params, paramsOR, callback) {
  var url = DATA_API + genURLparams(params) + genURLparamsOR(paramsOR);
  console.log(url);
  request(url, callback);
}

getMetaData(
  {
    // "distinctParams": "statisticcat_desc",
    "distinctParams": "unit_desc",

    "group_desc": "FIELD CROPS",
    "commodity_desc": "COTTON",

    // "statisticcat_desc": "AREA HARVESTED",
    // "statisticcat_desc": "AREA PLANTED",
    // "statisticcat_desc": "PRODUCTION",
    "statisticcat_desc": "YIELD",

    // "unit_desc": "BU / ACRE",

    "agg_level_desc": "COUNTY",
    // "agg_level_desc": "STATE",

    "prodn_practice_desc": "ALL PRODUCTION PRACTICES",
    "util_practice_desc": "ALL UTILIZATION PRACTICES",
    // "util_practice_desc": "SUGAR",
    // "class_desc": '(EXCL ALFALFA)',
    "class_desc": "PIMA",

    "domain_desc": "TOTAL",
    "source_desc": "SURVEY",
    "freq_desc": "ANNUAL"
  },
  function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var info = JSON.parse(body);
      console.log(JSON.stringify(info.data[0].Values));
    }
  }
);

getData(
  {
    "commodity_desc": "BARLEY",
    "group_desc": "FIELD CROPS",
    "agg_level_desc": "NATIONAL",
    "statisticcat_desc": "PRODUCTION",
    "unit_desc": "$",
    "freq_desc": "ANNUAL",
    "prodn_practice_desc": "ALL PRODUCTION PRACTICES",
    "util_practice_desc": "ALL UTILIZATION PRACTICES",
    "class_desc": "ALL CLASSES",
    "domain_desc": "TOTAL",
    "reference_period_desc": "YEAR",
    "year": "2013"
  },
  {
    // "commodity_desc": ["COTTON", "BARLEY"]
    // "statisticcat_desc": ["AREA HARVESTED","AREA PLANTED","PRICE RECEIVED","PRODUCTION","YIELD"]
  },
  function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var info = JSON.parse(body);
      console.log(info);
    }
  }
);

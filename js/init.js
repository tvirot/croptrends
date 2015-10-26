
$(function(){
    init();	
});

function init(){	
    changeCoverHeight();	
};

function changeCoverHeight(){
    var $cover = $('.landing');
    var height = window.innerHeight;
    $cover.css('height',height);
};

$(window).resize(function(){
    changeCoverHeight();
});
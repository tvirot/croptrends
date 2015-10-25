
$(function(){
    init();	
});

function init(){	
    changeCoverHeight();	
};

function changeCoverHeight(){
    var $cover = $('.landing');
    var wh = window.innerHeight;
    
    $cover.css('height',wh);
};

$(window).resize(function(){
    changeCoverHeight();
});
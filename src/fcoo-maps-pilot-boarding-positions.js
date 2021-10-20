/****************************************************************************
    fcoo-maps-pilot-boarding-positions

    (c) 2021, FCOO

    https://github.com/FCOO/fcoo-maps-pilot-boarding-positions
    https://github.com/FCOO

    Create MapLayer with GEOJSON-layer to read and display pilot points

****************************************************************************/

(function ($, L, window/*, document, undefined*/) {
    "use strict";

    //Create namespaces
    var ns = window.fcoo = window.fcoo || {},
        nsMap = ns.map = ns.map || {},


        id = 'NAVIGATION_PILOT_BOARDING_POSITIONS',
        bsMarkerOptions = {
            size           : 'small',
            colorName      : 'white',
            borderColorName: 'danger',
            innerIconClass : 'fas fa-diamond text-danger',
            scaleInner     : 180,
            round          : true,
            transparent    : true,
            hover          : true,

            pane           : nsMap.getMarkerPaneName(id),
            shadowPane     : nsMap.getShadowPaneName(id),

            tooltipHideWhenPopupOpen: true
        },

        footer = {icon: 'fa-copyright', text: 'name:dpa', link: 'link:dpa'};


    //createMapLayer = {MAPLAYER_ID: CREATE_MAPLAYER_AND_MENU_FUNCTION} See fcoo-maps/src/map-layer_00.js for description
    nsMap.createMapLayer = nsMap.createMapLayer || {};


    /*****************************************************************************
    List of pilotages and modal
    *****************************************************************************/
    var pilotageList,
        pilotageListModal,
        pilotageListFileName;

    function pilotageListAsModal(){
        if (pilotageList)
            pilotageList_resolve();
        else
            window.Promise.getJSON( pilotageListFileName, {}, pilotageList_resolve );
    }

    function pilotageList_resolve(data){
        pilotageList = pilotageList || data.list;
        pilotageListModal = pilotageListModal || $.bsModal({
            header: {da: 'Lodserier i Danmark', en: 'Pilotages in Denmark'},
            content: function($container){
                $.each(pilotageList, function(index, options){
                    $container._bsAddHtml([{text: options.name, link: options.link}, '<br>']);
                });
            },
            footer: footer,
            show  : false
        });
        pilotageListModal.show();
    }

    var pilotageButtonList = [{icon: 'fa-list', text: {da:'Lodserier', en:'Pilotages'}, onClick: pilotageListAsModal }];

    /*****************************************************************************
    Add create-function to create a MapLayer_PilotBoardingPositions = MapLayer with pilot boarding positions
    *****************************************************************************/
    nsMap.createMapLayer[id] = function(options, addMenu){
        options = $.extend({
            subDir           : 'navigation',
            positionFileName : 'pilot-boarding-positions.json',
            pilotagesFileName: 'pilotages.json'
        }, options || {});

        //Set file-name for list of pilotages
        pilotageListFileName = window.fcoo.dataFilePath(options.subDir, options.pilotagesFileName);

        //Adjust options
        options.layerOptions = {
            subDir  : options.subDir,
            fileName: options.fileName || options.positionFileName
        };

        //Create MapLayer_PilotBoardingPositions
        var mapLayer = nsMap._addMapLayer(id, MapLayer_PilotBoardingPositions, options);

        addMenu( mapLayer.menuItemOptions() );

    };

    /*****************************************************************************
    MapLayer_PilotBoardingPositions = Extended MapLayer with pilot points
    *****************************************************************************/
    function MapLayer_PilotBoardingPositions(options) {
        var icon = $.bsMarkerAsIcon('text-white', 'text-danger')[0];
        icon.push('fas fa-diamond text-danger fa-pilot-boarding-position-diamond');

        nsMap.MapLayer.call(this,
            $.extend({
                icon: [icon],
                text: {da:'Lodsmødesteder', en:'Pilot Boarding Positions'},
                createMarkerPane: true,
                minZoom: 6,
                buttonList: pilotageButtonList,
            }, options)
        );
    }

    MapLayer_PilotBoardingPositions.prototype = Object.create(nsMap.MapLayer.prototype);
    MapLayer_PilotBoardingPositions.prototype.createLayer = function(options){
        return new L.GeoJSON.PilotBoardingPositions(null, options);
    };



    /*****************************************************************************
    L.GeoJSON.PilotBoardingPositions = L.GeoJSON layer to display all points
    *****************************************************************************/
    L.GeoJSON.PilotBoardingPositions = L.GeoJSON.extend({
        //initialize
        initialize: function(initialize){
            return function (/*options*/) {

                var result = initialize.apply(this, arguments);

                this.options.pointToLayer = $.proxy(this.pointToLayer, this);
                this.options.onEachFeature = $.proxy(this.onEachFeature, this);

                this.list = [];

                //Read the meta-data
                window.Promise.getJSON( window.fcoo.dataFilePath(this.options.subDir, this.options.fileName), {}, $.proxy(this._resolve, this) );

                return result;
            };
        } (L.GeoJSON.prototype.initialize),


       //_resolve
       _resolve: function( data ){
            var geoJSON = {
                    type    : "FeatureCollection",
                    features: []
                },
                _this = this;

            //Create all PilotBoardingPosition and add them to the geoJSON-data
            this.typeList = data.type;

            /*
            The data is the official list of pilot boarding positions from dma at https://www.soefartsstyrelsen.dk/sikkerhed-til-soes/sejladssikkerhed/lodstilsyn/regelgrundlag-lodstilsyn.
            The list is a direct copy from the homepage that is adjusted into one long list with representing five columns: Name,Type,Area,Lat,Long.
            The text are only in Danish. Therefore there are a translation-file in pilot-boarding-positions-i18next.json. <----- MANGLER!
            type is a correspondence between the text in 2. column and a type The positions are in degree, decimal minuts",
            */
            for (var i=0; i<data.list.length; i=i+5){
                var pilotBoardingPosition = new PilotBoardingPosition({
                        name  : data.list[i].trim(),
                        type  : data.list[i+1].trim(),
                        area  : data.list[i+2].trim(),
                        latLng: [data.list[i+3].trim(), data.list[i+4].trim() ]
                    }, _this.list);

                _this.list.push(pilotBoardingPosition);

                geoJSON.features.push({
                    geometry: {
                        type       : "Point",
                        coordinates: [pilotBoardingPosition.latLng.lng, pilotBoardingPosition.latLng.lat]
                    },
                    type      : "Feature",
                    properties: { index: _this.list.length-1 }
                });
            }
            this.addData( geoJSON );
       },

        _findPilotBoardingPositionByFeature: function( feature, methodName, arg ){
            var pilotBoardingPosition = this.list[ feature.properties.index ];
            return pilotBoardingPosition[methodName].apply(pilotBoardingPosition, arg);
        },

        pointToLayer: function (feature/*, latLng*/) {
            return this._findPilotBoardingPositionByFeature( feature, 'createMarker'/*, [latLng] */);
        },

        //onEachFeature
        onEachFeature: function (feature, layer) {
            return this._findPilotBoardingPositionByFeature( feature, 'addPopup', [layer] );
        },
	});


    /*****************************************************************************
    PilotBoardingPosition = One marker
    ******************************************************************************/
    //Hard code translation of different types
    var typeTranslation = {
            'regional'        : 'regional',
            'gennemsejling'   : 'transit',
            'gennemsejling*'  : 'transit',
            'gennemsejling**' : 'transit'
        };


    /* TODO MANGLER:
    *  Lodspåsætningssted for skibe omfattet af IMO anbefaling for Rute T og Sundet.
    ** Lodspåsætningssted for skibe, der kommer fra Tyskland, og som er omfattet af IMO anbefaling for Rute T.
    */

    var PilotBoardingPosition = function(options, list){
        var _this = this;
        //Adjust options

        //name: Check if english name existe - MANGLER
        options.name = {da: options.name};
        options.name.en = options.name.da;

        //type
        this.type = {da: '', en:''};
        $.each(options.type.toLowerCase().split(','), function(index, str){
            var typeDK = str.trim().replace(/\*/g, '');
            if (index){
                _this.type.da += ', ';
                _this.type.en += ', ';
            }
            _this.type.da += typeDK;
            _this.type.en += typeTranslation[typeDK] || typeDK;
        });

        //position is []STRING = eq. "56° 24,0' N", "11° 05,0' E"
        var formatId = window.latLngFormat.options.formatId;
        window.latLngFormat.setTempFormat(window.latLngFormat.LATLNGFORMAT_DMM);
        this.latLng = L.latLng( window.latLngFormat(options.latLng).value() );
        window.latLngFormat.setTempFormat(formatId);

        this.options = options;
        this.list = list;
    };

    PilotBoardingPosition.prototype = {
        createMarker: function(){

            this.marker =
                L.bsMarkerCircle( this.latLng, bsMarkerOptions)
                    .bindTooltip(this.options.name);
            return this.marker;
        },

        addPopup: function(marker){
            //Create header-icon to look like the marker
            var headerIcon = L.bsMarkerAsIcon(bsMarkerOptions);
            headerIcon.push('fas fa-diamond fa-inside-circle text-danger');

            marker.bindPopup({
                width  : 180,
                fixable: true,
                header : {
                    icon: [headerIcon],
                    text: this.options.name
                },
                color: 'center',
                content: [
                    {text: this.type, textClass: 'd-block text-center text-capitalize'},
                    '<hr>',
                    {vfFormat:'latlng', vfValue: this.latLng,  textClass:'d-block text-center', onClick: $.proxy(this.showLatLngInModal, this)}
                ],
                buttons: pilotageButtonList,
                footer : footer
            });
        },

        showLatLngInModal: function(){
            nsMap.latLngAsModal(this.latLng, {header: [this.options.name]});
        }
    };

}(jQuery, L, this, document));

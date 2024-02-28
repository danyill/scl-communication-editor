"use strict";
(self.webpackChunktoolkit_site_docusaurus = self.webpackChunktoolkit_site_docusaurus || []).push([[2795], {
    57893: (e,t,n)=>{
        n.r(t),
        n.d(t, {
            default: ()=>s
        });
        var o = n(67294)
          , i = n(52263)
          , c = n(42921)
          , l = n(35742)
          , a = n(10412);
        function s() {
            const {siteConfig: e} = (0,
            i.Z)();
            return (0,
            o.useEffect)((()=>{
                if (a.Z.canUseDOM) {
                    const c = n(81140);
                    var e = new c.BrowserJsPlumbInstance(0,{
                        dragOptions: {
                            cursor: "pointer",
                            zIndex: 2e3,
                            grid: [20, 20],
                            containment: "notNegative"
                        },
                        connectionOverlays: [{
                            type: "Arrow",
                            options: {
                                location: 1,
                                visible: !0,
                                width: 11,
                                length: 11,
                                id: "ARROW",
                                events: {
                                    click: function() {
                                        alert("you clicked on the arrow overlay")
                                    }
                                }
                            }
                        }, {
                            type: "Label",
                            options: {
                                location: .1,
                                id: "label",
                                cssClass: "aLabel",
                                events: {
                                    tap: function() {
                                        alert("hey")
                                    }
                                }
                            }
                        }],
                        container: document.getElementById("canvas")
                    })
                      , t = {
                        fill: "#216477",
                        stroke: "#216477"
                    }
                      , o = {
                        endpoint: c.DotEndpoint.type,
                        paintStyle: {
                            stroke: "#7AB02C",
                            fill: "transparent",
                            radius: 7,
                            strokeWidth: 1
                        },
                        source: !0,
                        connector: {
                            type: "Orthogonal",
                            options: {
                                stub: [40, 60],
                                gap: 10,
                                cornerRadius: 5,
                                alwaysRespectStubs: !0
                            }
                        },
                        connectorStyle: {
                            strokeWidth: 2,
                            stroke: "#61B7CF",
                            joinstyle: "round",
                            outlineStroke: "white",
                            outlineWidth: 2
                        },
                        hoverPaintStyle: t,
                        connectorHoverStyle: {
                            strokeWidth: 3,
                            stroke: "#216477",
                            outlineWidth: 5,
                            outlineStroke: "white"
                        }
                    }
                      , i = {
                        endpoint: c.DotEndpoint.type,
                        paintStyle: {
                            fill: "#7AB02C",
                            radius: 7
                        },
                        hoverPaintStyle: t,
                        maxConnections: -1,
                        dropOptions: {
                            hoverClass: "hover",
                            activeClass: "active"
                        },
                        target: !0
                    };
                    const l = (t,n,c)=>{
                        for (var l = 0; l < n.length; l++) {
                            var a = t + n[l];
                            e.addEndpoint(document.getElementById("flowchart" + t), o, {
                                anchor: n[l],
                                uuid: a
                            })
                        }
                        for (var s = 0; s < c.length; s++) {
                            var r = t + c[s];
                            e.addEndpoint(document.getElementById("flowchart" + t), i, {
                                anchor: c[s],
                                uuid: r
                            })
                        }
                    }
                    ;
                    e.batch((function() {
                        l("Window4", [c.AnchorLocations.Top, c.AnchorLocations.Bottom], [c.AnchorLocations.Left, c.AnchorLocations.Right]),
                        l("Window2", [c.AnchorLocations.Left, c.AnchorLocations.Bottom], [c.AnchorLocations.Top, c.AnchorLocations.Right]),
                        l("Window3", [c.AnchorLocations.Right, c.AnchorLocations.Bottom], [c.AnchorLocations.Left, c.AnchorLocations.Top]),
                        l("Window1", [c.AnchorLocations.Left, c.AnchorLocations.Right], [c.AnchorLocations.Top, c.AnchorLocations.Bottom]),
                        e.bind("connection", (function(e, t) {
                            var n;
                            (n = e.connection).getOverlay("label").setLabel(n.source.id.substring(15) + "-" + n.target.id.substring(15))
                        }
                        )),
                        e.connect({
                            uuids: ["Window2Bottom", "Window3Top"]
                        }),
                        e.connect({
                            uuids: ["Window2Left", "Window4Left"]
                        }),
                        e.connect({
                            uuids: ["Window4Top", "Window4Right"]
                        }),
                        e.connect({
                            uuids: ["Window3Right", "Window2Right"]
                        }),
                        e.connect({
                            uuids: ["Window4Bottom", "Window1Top"]
                        }),
                        e.connect({
                            uuids: ["Window3Bottom", "Window1Bottom"]
                        }),
                        e.bind(c.EVENT_CLICK, (function(t, n) {
                            confirm("Delete connection from " + t.source.id + " to " + t.target.id + "?") && e.deleteConnection(t)
                        }
                        )),
                        e.bind(c.EVENT_CONNECTION_DRAG, (function(e) {
                            console.log("connection " + e.id + " is being dragged. suspendedElement is ", e.suspendedElement, " of type ", e.suspendedElementType)
                        }
                        )),
                        e.bind(c.EVENT_CONNECTION_MOVED, (function(e) {
                            console.log("connection " + e.connection.id + " was moved")
                        }
                        )),
                        e.bind(c.EVENT_CONNECTION_DETACHED, (function(e) {
                            console.log("connection " + e.connection.id + " was detached")
                        }
                        )),
                        e.bind(c.EVENT_CONNECTION_ABORT, (function(e) {
                            console.log("connection aborted " + e.id)
                        }
                        ))
                    }
                    ))
                }
            }
            ), []),
            o.createElement(c.Z, {
                title: "jsPlumb Community Edition",
                description: "Community edition"
            }, o.createElement(l.Z, null, o.createElement("link", {
                href: "//fonts.googleapis.com/css?family=Roboto&display=swap",
                rel: "stylesheet"
            }), o.createElement("link", {
                rel: "stylesheet",
                href: "/css/community-flowchart.css"
            })), o.createElement("div", {
                className: "container-fluid container"
            }, o.createElement("div", {
                className: "row"
            }, o.createElement("div", {
                className: "col col-9",
                style: {
                    height: "600px"
                }
            }, o.createElement("div", {
                className: "flowchart-demo",
                id: "canvas"
            }, o.createElement("div", {
                className: "window jtk-node",
                id: "flowchartWindow1"
            }, o.createElement("strong", null, "1"), o.createElement("br", null), o.createElement("br", null)), o.createElement("div", {
                className: "window jtk-node",
                id: "flowchartWindow2"
            }, o.createElement("strong", null, "2"), o.createElement("br", null), o.createElement("br", null)), o.createElement("div", {
                className: "window jtk-node",
                id: "flowchartWindow3"
            }, o.createElement("strong", null, "3"), o.createElement("br", null), o.createElement("br", null)), o.createElement("div", {
                className: "window jtk-node",
                id: "flowchartWindow4"
            }, o.createElement("strong", null, "4"), o.createElement("br", null), o.createElement("br", null)))), o.createElement("div", {
                className: "col col-3 d-flex flex-column p-3"
            }, o.createElement("div", {
                className: "mt-2"
            }, "jsPlumb Community Edition is an open source project written in Typescript that gives you the tools you need to visually connect DOM elements."), o.createElement("div", {
                className: "mt-2"
            }, "It is a fully vanilla JS solution, with no external dependencies. Using Angular, React, or Vue 2/3 ? jsPlumb slots right in."), o.createElement("div", {
                className: "mt-2"
            }, "Leverage HTML5 and CSS3. Seamless integration with mobile devices. Never worry about a touch event again!"), o.createElement("div", {
                className: "mt-2"
            }, "The project is MIT (or GPLV2, you choose) licensed, and available on ", o.createElement("a", {
                href: "https://github.com/jsplumb/jsplumb/",
                target: "_blank"
            }, "Github"))))), o.createElement("div", {
                className: "jtk-page-slice mt-3 text-center "
            }, "This page is for the Community Edition of jsPlumb. Looking for the Toolkit Edition? ", o.createElement("a", {
                href: "/",
                className: "callout"
            }, "Click here.")))
        }
    }
}]);

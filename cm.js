function ContextMenu(target, params) {
    // to prevent ContextMenu usage as a function (not as a constructor)
    if (!(this instanceof ContextMenu)) {
        return new ContextMenu(target, params);
    }

    var alreadyDefined = ContextMenu._instances.find((i) => {
        return i.target === target;
    });

    if (alreadyDefined) return alreadyDefined;

    this.target = target;
    this.params = params;

    // store Submenues
    this.subMenues = [];

    // listening to CM invoked and executing the callback function when it happened
    this.listenToCMInvoked((event) => {
        // if user wants the overlay laying under the CM


        if (this.params.overlay) {
            this.prepareOverlay();
        }

        // drawing the CM with all the items, but making it "invisible" to the end user
        this.prepareLayoutItems();
        this.prepareCM();

        // calculating the position of the real-one CM and making it visible
        var pos = this.calculatePosition(event);
        this.draw(pos);

        // listening to CM closed and executing the callback function when it happened
        this.listenToCMClosed((event) => {
            this.close();
        });
    });

    ContextMenu._instances.push(this);
}

ContextMenu._instances = [];

ContextMenu.prototype.listenToCMInvoked = function (callback) {
    this.target.addEventListener("contextmenu", (event) => {
        // if CM is not disabled
        if (!(this.params.disabled === true)) {
            // defaultOnAlt enabled
            var defaultOnAlt = ("defaultOnAlt" in this.params) ? this.params.defaultOnAlt : true;

            if (defaultOnAlt ? event.altKey === false : true) {
                // preventing default CM to appear
                event.preventDefault();
                /*
                    stop of the propagation is needed because if you have overlay
                    enabled then right click on the non-document CM's overlay will
                    open the document's CM even if the click happened on an element
                    that has it's own CM
                */
                event.stopPropagation();

                callback(event);
            }
        }
    });
};

ContextMenu.prototype.listenToCMClosed = function (callback) {
    var noRecreate = this.overlay && this.params.noRecreate;

    // storing "closing" event listeners as an array to easily later removal
    if (this.overlay) {
        this.eventListenersToRemove = [
            {
                t: document,
                e: "mousedown",
                cb: (event) => {
                    if (noRecreate ? event.which !== 3 : true) {
                        // if clicked not on item
                        var items = [].slice.call(document.querySelectorAll("[data-item-cm]"));
                        if (!(~items.indexOf(event.target))) {
                            callback(event);
                        }
                    }
                }
            },

            {
                t: this.overlay,
                e: "contextmenu",
                cb: (event) => {
                    event.preventDefault();
                    event.stopPropagation();

                    // if clicked not on item
                    var items = [].slice.call(document.querySelectorAll("[data-item-cm]"));
                    if (!(~items.indexOf(event.target))) {
                        callback(event);
                    }
                }
            },
        ];
    } else {
        this.eventListenersToRemove = [
            {
                t: document,
                e: "mousedown",
                cb: (event) => {
                    // if clicked not on item
                    var items = [].slice.call(document.querySelectorAll("[data-item-cm]"));
                    if (!(~items.indexOf(event.target))) {
                        callback(event);
                    }
                }
            },
        ];
    }

    this.eventListenersToRemove.push({
            t: document,
            e: "keydown",
            cb: (event) => {
                if (event.keyCode === 27) {
                    callback(event);
                }
            }
        }
    );

    // adding previously defined event listeners
    this.eventListenersToRemove.forEach(function(eventListener) {
        eventListener.t.addEventListener(eventListener.e, eventListener.cb);
    });
};

ContextMenu.prototype.prepareOverlay = function () {
    // creating an overlay a.k.a container for the future CM
    this.overlay = document.createElement("div");
    // addind data-overlay-cm for styling purposes
    this.overlay.dataset.overlayCm = this.params.id || "";

    var scrollLeft = document.documentElement.scrollLeft,
        scrollTop = document.documentElement.scrollTop,
        width = scrollLeft + document.documentElement.clientWidth,
        height = scrollTop + document.documentElement.clientHeight;

    // necsessary styles
    this.overlay.style.position = "absolute";
    this.overlay.style.display = "block";
    this.overlay.style.left = 0; this.overlay.style.top = 0;
    this.overlay.style.width = width + "px";
    this.overlay.style.height = height + "px";
    this.overlay.style.visibility = "hidden";
    this.overlay.style.zIndex = 2147483646;

    // drawing overlay right in the body
    document.body.appendChild(this.overlay);
};

ContextMenu.prototype.prepareLayoutItems = function () {
    // everything that should be rendered on the page
    this.itemsToRender = this.params.items.map((item) => {
        if (item === "divider") {
            var node = document.createElement("div");
            node.dataset.itemServiceCm = "divider";

            return node;
        }

        var text = document.createTextNode(item.title),
            node = document.createElement("li");

        node.dataset.itemCm = this.params.id || "";
        node.appendChild(text);

        if (item.function instanceof ContextSubMenu) {
            node.addEventListener("mouseenter", (event) => {
                this.timer = setTimeout(() => {
                    if (!this.openedCSM) {
                        this.openedCSM = item.function.init(this, node);
                    } else if (this.openedCSM !== item.function) {
                        this.openedCSM.close();
                        console.log(this.openedCSM);
                        this.openedCSM = item.function.init(this, node);
                    }
                }, item.function.params.delay.open * 1000); // TODO: if nothing given
            });

            node.addEventListener("mouseleave", (event) => {
                clearTimeout(this.timer);
            });

            node.addEventListener("mousedown", (event) => {
                clearTimeout(this.timer);

                if (!this.openedCSM) {
                    this.openedCSM = item.function.init(this, node);
                } else if (this.openedCSM !== item.function) {
                    this.openedCSM.close();
                    console.log(this.openedCSM);
                    this.openedCSM = item.function.init(this, node);
                }
            });
        } else {
            // when user releases mouse button on item
            node.addEventListener("mouseup", (event) => {
                this.close();
                item.function();
            });
        }

        return node;
    });

    // items that are actual buttons (not dividers or sort of)
    this.items = this.itemsToRender.filter((item) => {
        return item.dataset.hasOwnProperty("itemCm");
    });
};

ContextMenu.prototype.prepareCM = function() {
    // creating the CM element
    this.cm = document.createElement("ol");
    // addind data-cm for styling purposes
    this.cm.dataset["cm"] = this.params.id || "";

    // necsessary styles
    this.cm.style.position = "absolute";
    this.cm.style.display = "block";
    this.cm.style.visibility = "hidden";
    this.cm.style.zIndex = 2147483647;

    // rendering every item (including dividers)
    this.itemsToRender.forEach((item) => {
        this.cm.appendChild(item);
    });

    // if we have the overlay then render CM in it else render right in the body
    if (this.params.overlay) {
        this.overlay.appendChild(this.cm);
    } else {
        document.body.appendChild(this.cm);
    }
};

ContextMenu.prototype.draw = function (pos) {
    // make overlay visible if we have it
    if (this.overlay) {
        this.overlay.style.visibility = "visible";
    }

    // make CM visible and set it's position
    this.cm.style.left = pos.x + "px";
    this.cm.style.top = pos.y + "px";
    this.cm.style.visibility = "visible";
};

ContextMenu.prototype.close = function() {
    // close opened CSM if any
    // TODO: delete this.subMenues
    if (this.openedCSM) {
        this.openedCSM.close();
    }

    // clear timeout if we have YET unopened CSM
    if (this.timer) {
        clearTimeout(this.timer);
    }

    // removing all no-longer-needed event listeners to keep everything clean
    this.eventListenersToRemove.forEach(function(eventListener) {
        eventListener.t.removeEventListener(eventListener.e, eventListener.cb);
    });

    // if we have the overlay then remove it else remove CM directly
    if (this.overlay) {
        this.overlay.remove();
    } else {
        this.cm.remove();
    }
};

ContextMenu.prototype.calculatePosition = function(event) {
    var viewportWidth = document.documentElement.clientWidth,
        viewportHeight = document.documentElement.clientHeight,

        clickedX = (event.clientX > viewportWidth) ? viewportWidth : event.clientX,
        clickedY = (event.clientY > viewportHeight) ? viewportHeight : event.clientY,

        cmWidth = this.cm.getBoundingClientRect().width,
        cmHeight = this.cm.getBoundingClientRect().height,

        furthestX = clickedX + cmWidth,
        furthestY = clickedY + cmHeight,

        pos = {x: clickedX, y: clickedY};

    if (furthestX > viewportWidth) {
        if (this.params.transfer) {
            pos.x -= cmWidth;
        } else {
            pos.x = viewportWidth - cmWidth;
        }
    }

    if (furthestY > viewportHeight) {
        if (this.params.transfer) {
            pos.y -= cmHeight;
        } else {
           pos.y = viewportHeight - cmHeight;
       }
    }

    pos.x += document.documentElement.scrollLeft;
    pos.y += document.documentElement.scrollTop;

    return pos;
};

function ContextSubMenu(params) {
    if (!(this instanceof ContextSubMenu)) {
        return new ContextSubMenu(params);
    }

    // TODO: restrict instances (like in parent)

    this.params = params;
}

ContextSubMenu.prototype.init = function(parent, callee) {
    this.parent = parent;
    this.callee = callee;

    this.prepareLayoutItems();
    this.prepareCSM();

    this.calculatePosition(callee);
    this.draw();

    this.listenToCSMClosed((event) => {
        if (this.parent.openedCSM) {
            this.close();
        }
    });

    return this;
}

ContextSubMenu.prototype.prepareLayoutItems = function() {
    // everything that should be rendered on the page
    this.itemsToRender = this.params.items.map((item) => {
        if (item === "divider") {
            var node = document.createElement("div");
            node.dataset.itemServiceCm = "divider";

            return node;
        }

        var text = document.createTextNode(item.title),
            node = document.createElement("li");

        node.dataset.itemCm = this.params.id || "";
        node.appendChild(text);

        if (item.function instanceof ContextSubMenu) {
            node.addEventListener("mouseenter", (event) => {
                // TODO: now only one nested CM
                item.function.init(this, node);
            });
        } else {
            // when user releases mouse button on item
            node.addEventListener("mouseup", (event) => {
                this.parent.close();
                item.function();
            });
        }

        return node;
    });

    // items that are actual buttons (not dividers or sort of)
    this.items = this.itemsToRender.filter((item) => {
        return item.dataset.hasOwnProperty("itemCm");
    });
}

ContextSubMenu.prototype.prepareCSM = function() {
    // creating the CSM element
    this.csm = document.createElement("ol");
    // addind data-cm for styling purposes
    this.csm.dataset["cm"] = this.params.id || "";

    // necsessary styles
    this.csm.style.position = "absolute";
    this.csm.style.display = "block";
    this.csm.style.visibility = "hidden";
    this.csm.style.zIndex = 2147483647;

    // rendering every item (including dividers)
    this.itemsToRender.forEach((item) => {
        this.csm.appendChild(item);
    });

    // TODO: z-index'es are: max in CSM, less in SM, less in overlay

    // if parent has the overlay then render CSM in it else render right in the body
    if (this.parent.overlay) {
        this.parent.overlay.appendChild(this.csm);
    } else {
        document.body.appendChild(this.csm);
    }
}

ContextSubMenu.prototype.draw = function() {
    // make CM visible and set it's position
    this.csm.style.left = this.pos.x + "px";
    this.csm.style.top = this.pos.y + "px";
    this.csm.style.visibility = "visible";
}

ContextSubMenu.prototype.close = function () {
    console.log("Closing CSM");
    this.eventListenersToRemove.forEach((eventListener) => {
        eventListener.t.removeEventListener(eventListener.e, eventListener.f);
    });

    if (this.timer) {
        clearTimeout(this.timer);
    }

    this.csm.remove();
    this.parent.openedCSM = null;
};

ContextSubMenu.prototype.listenToCSMClosed = function (callback) {
    // TODO: param: don't close when mouse inters devider

    this.eventListenersToRemove = [
        {
            t: this.callee,
            e: "mouseleave",
            f: (event) => {
                if (this.parent.itemsToRender.indexOf(event.toElement) !== -1) {
                    this.timer = setTimeout(() => {
                        callback(event);
                    }, this.params.delay.close * 1000); // TODO: if nothing given
                }
            }
        },

        {
            t: this.callee,
            e: "mouseenter",
            f: (event) => {
                clearTimeout(this.timer);
            }
        }
    ];

    this.eventListenersToRemove.forEach((eventListener) => {
        eventListener.t.addEventListener(eventListener.e, eventListener.f);
    });
};
// TODO: add class "invisible" and "visible" to 2 states corresponsively
// to easily adding "appending"-animations later
ContextSubMenu.prototype.calculatePosition = function(li) {
    var liRight = li.getBoundingClientRect().right,
        liTop = li.getBoundingClientRect().top;

    this.pos = {x: liRight, y: liTop};
    console.log(this.pos);
}

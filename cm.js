function ContextMenu(target, params) {
    // to prevent ContextMenu usage as a function (not as a constructor)
    if (!(this instanceof ContextMenu)) {
        return new ContextMenu(target, params);
    }

    this.target = target;
    this.params = params;

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
}

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
    this.eventListenersToRemove = [
        {
            t: document,
            e: "mousedown",
            cb: (event) => {
                if (noRecreate ? event.which !== 3 : true) {
                    // if clicked not on item
                    if (!(~this.items.indexOf(event.target))) {
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
                if (!(~this.items.indexOf(event.target))) {
                    callback(event);
                }
            }
        },

        {
            t: document,
            e: "keyup",
            cb: (event) => {
                if (event.keyCode === 27) {
                    callback(event);
                }
            }
        }
    ];

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

        // when user releases mouse button on item
        node.addEventListener("mouseup", (event) => {
            this.close();
            item.function();
        });

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
    this.overlay.style.zIndex = 2147483647;

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

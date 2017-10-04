function ContextMenu(target, params) {
    if (!(this instanceof ContextMenu)) {
        return new ContextMenu(target, params);
    }

    this.target = target;
    this.params = params;


    this.listenToCMInvoked((event) => {
        // if user wants the overlay laying under the CM
        if (this.params.overlay) {
            this.prepareOverlay();
        }

        this.prepareLayoutItems();
        this.prepareCM();

        var pos = this.calculatePosition(event);
        this.draw(pos);

        this.listenToCMClosed((event) => {
            this.close();
        });
    });
}

ContextMenu.prototype.listenToCMInvoked = function (callback) {
    this.target.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        event.stopPropagation();

        // if no items yet or not RMB on item
        // if (!this.items || !(~this.items.indexOf(event.target))) {
            // if CM is not disabled
            if (!(this.params.disabled === true)) {
                callback(event);
            }
        // }
    });
};

ContextMenu.prototype.listenToCMClosed = function (callback) {
    var noRecreate = this.overlay && this.params.noRecreate;

    this.eventListeners = [
        {
            target: document,
            event: "mousedown",
            callback: (event) => {
                if (noRecreate ? event.which !== 3 : true) {
                    if (!(~this.items.indexOf(event.target))) {
                        callback(event);
                    }
                }
            }
        },

        {
            target: this.overlay,
            event: "contextmenu",
            callback: (event) => {
                event.preventDefault();
                event.stopPropagation();

                if (!(~this.items.indexOf(event.target))) {
                    callback(event);
                }
            }
        },

        {
            target: document,
            event: "keyup",
            callback: (event) => {
                if (event.keyCode === 27) {
                    callback(event);
                }
            }
        }
    ];

    this.eventListeners.forEach(function(eventListener) {
        eventListener.target.addEventListener(eventListener.event, eventListener.callback);
    });
};

ContextMenu.prototype.prepareOverlay = function () {
    this.overlay = document.createElement("div");
    this.overlay.dataset.overlayCm = this.params.id || "";

    this.overlay.style.position = "absolute";
    this.overlay.style.display = "block";
    this.overlay.style.left = 0; this.overlay.style.top = 0;
    this.overlay.style.width = document.documentElement.getBoundingClientRect().width + "px";
    this.overlay.style.height = document.documentElement.getBoundingClientRect().height + "px";
    this.overlay.style.visibility = "hidden";

    document.body.appendChild(this.overlay);
};

ContextMenu.prototype.prepareLayoutItems = function () {
    this.itemsToRender = this.params.items.map((item) => {
        if (item === "divider") {
            var node = document.createElement("div");
            node.dataset.itemServiceCm = "divider";

            return node;
        }

        var text = document.createTextNode(item.title),
            node = document.createElement("div");

        node.dataset.itemCm = this.params.id || "";
        node.appendChild(text);

        node.addEventListener("mouseup", (event) => {
            this.close();
            item.function();
        });

        return node;
    });

    this.items = this.itemsToRender.filter((item) => {
        return item.dataset.hasOwnProperty("itemCm");
    });
};

ContextMenu.prototype.prepareCM = function() {
    this.cm = document.createElement("div");
    this.cm.dataset["cm"] = this.params.id || "";

    this.cm.style.position = "absolute";
    this.cm.style.display = "block";
    this.cm.style.visibility = "hidden";

    this.itemsToRender.forEach((item) => {
        this.cm.appendChild(item);
    });

    if (this.params.overlay) {
        this.overlay.appendChild(this.cm);
    } else {
        document.body.appendChild(this.cm);
    }
};

ContextMenu.prototype.draw = function (pos) {
    if (this.overlay) {
        this.overlay.style.visibility = "visible";
    }

    this.cm.style.left = pos.x + "px";
    this.cm.style.top = pos.y + "px";
    this.cm.style.visibility = "visible";

    this.opened = true;
};

ContextMenu.prototype.close = function() {
    console.log("Closing CM");

    this.eventListeners.forEach(function(eventListener) {
        eventListener.target.removeEventListener(eventListener.event, eventListener.callback);
    });

    if (this.overlay) {
        this.overlay.remove();
    } else {
        this.cm.remove();
    }

    this.opened = false;
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

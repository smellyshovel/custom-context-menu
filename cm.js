function ContextMenu(target, params) {
    if (!(this instanceof ContextMenu)) {
        return new ContextMenu(target, params);
    }

    this.target = target;
    this.params = params;


    this.listenToCMInvoked((event) => {
        // if user wants the overlay laying under the CM
        if (this.params.overlay) {
            this.overlay = this.prepareOverlay();
        }

        var layoutElements = this.prepareLayout();
        this.cm = this.prepareCM(layoutElements);

        var pos = this.calculatePosition(event);
        this.draw(pos);

        this.listenToCMClosed((event) => {
            this.close();
        });
    });


}

ContextMenu.prototype.listenToCMInvoked = function (callback) {
    var el = this.target.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        event.stopPropagation();

        // if CM is not disabled
        if (!(this.params.disabled === true)) {
            callback(event);
        }
    });
};

ContextMenu.prototype.listenToCMClosed = function (callback) {
    document.addEventListener("mousedown", (event) => {
        if (this.opened) {
            if (!(~this.items.indexOf(event.target))) {
                callback(event);
            }
        }
    });
};

ContextMenu.prototype.prepareOverlay = function () {
    var overlay = document.createElement("div");
    overlay.dataset.overlayCm = "";

    overlay.style.position = "absolute";
    overlay.style.display = "block";
    overlay.style.left = 0; overlay.style.top = 0;
    overlay.style.width = document.documentElement.getBoundingClientRect().width + "px";
    overlay.style.height = document.documentElement.getBoundingClientRect().height + "px";
    overlay.style.visibility = "hidden";

    document.body.appendChild(overlay);
    return overlay;
};

ContextMenu.prototype.prepareLayout = function () {
    this.items = Object.keys(this.params.layout).map((item) => {
        var text = document.createTextNode(item.toString()),
            elem = document.createElement("div");

        elem.dataset.itemCm = this.params.id || "";

        elem.appendChild(text);

        elem.addEventListener("mouseup", (event) => {
            this.close();
            this.params.layout[item.toString()]();
        });

        return elem;
    });

    return this.items;
};

ContextMenu.prototype.prepareCM = function(layoutElements) {
    var cm = document.createElement("div");
    cm.dataset["cm"] = this.params.id || "";

    cm.style.position = "absolute";
    cm.style.display = "block";
    cm.style.visibility = "hidden";

    layoutElements.forEach((element) => {
        cm.appendChild(element);
    });

    if (this.params.overlay) {
        this.overlay.appendChild(cm);
    } else {
        document.body.appendChild(cm);
    }


    return cm;
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

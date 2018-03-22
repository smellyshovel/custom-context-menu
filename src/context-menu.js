function ContextMenu(target, params) {
    // prevent ContextMenu to be executed as a function (not as a constructor)
    if (!(this instanceof ContextMenu)) {
        return new ContextMenu(target, params);
    }

    // search for CM already defined for this target
    var alreadyDefined = ContextMenu._instances.find((instance) => {
        return instance.target === target;
    });

    // return found one if any instead of creating a new one
    if (alreadyDefined) return alreadyDefined;

    // store params as a property to have an access to it in the methods
    this.params = params;

    // execute callback when CM invokation event happend
    this._listenToCMInvoked(target, (event) => {
        // prevent global namespace polluting by multiple assignment
        var scrollingDisabled, overflow;

        // prepare and draw overlay if needed
        if (this.params.overlay) {
            // force disable scrolling if using an overlay
            scrollingDisabled = overflow = this._disableScrolling();

            this._prepareOverlay();
            this._drawOverlay();
        } else {
            // disable scrolling unless it's not explicitly allowed
            if (!this.params.scrolling) {
                scrollingDisabled = overflow = this._disableScrolling();
            }
        }

        // prepare items and CM with this items
        this._prepareItems();
        this._prepareCM();

        // calculate the position of the CM and draw it there
        var pos = this._calculatePosition(event);
        this._drawCM(pos);

        // execute open callback (or a blank function if none)
        this._getCallback("open")();

        // execute callback when CM close happened
        this._listenToCMClosed((event) => {
            // close CM (with nested)
            this.close();

            // enable scrolling back
            if (scrollingDisabled) {
                this._enableScrolling(overflow);
            }

            // execute close callback (or a blank function if none)
            this._getCallback("close")();
        });
    });

    // store this instance to prevent "recreating"
    ContextMenu._instances.push(this);
}

ContextMenu._instances = [];

ContextMenu.prototype._getCallback = function (after) {
    if ("callback" in this.params) {
        var callback = this.params.callback;

        if (after === "open") {
            if (typeof callback === "function") {
                return callback;
            }

            if ("open" in callback && typeof callback.open === "function") {
                return callback.open;
            }
        } else if (after === "close") {
            if ("close" in callback && typeof callback.close === "function") {
                return callback.close;
            }
        }
    }

    return function() {};
};

ContextMenu.prototype._getRoot = function() {
    var parent = this;
    while("parent" in parent) {
      parent = parent.parent;
    }

    return parent;
};

ContextMenu.prototype._disableScrolling = function () {
    // save the pravious state of overflow property
    var previousState = getComputedStyle(document.documentElement).overflow;

    // disable scrolling via overflow set to `hidden`
    document.documentElement.style.overflow = "hidden";

    return previousState;
};

ContextMenu.prototype._enableScrolling = function (state) {
    // return the overflow property to the previous state
    document.documentElement.style.overflow = state;
};

ContextMenu.prototype._listenToCMInvoked = function(target, callback) {
    target.addEventListener("contextmenu", (event) => {
        event.stopPropagation();

        // force defaultOnAlt param to true if nothing's given
        var defaultOnAlt = ("defaultOnAlt" in this.params) ? this.params.defaultOnAlt : true;

        // if defaultOnAlt is true then check whether the alt key was not
        // holded when the event was triggered or it was. If it was then the
        // code below just won't be executed
        if (defaultOnAlt ? event.altKey === false : true) {
            // prevent default CM to appear
            event.preventDefault();

            // if the CM is not disabled
            if (!this.params.disabled) {
                callback(event);
            }
        }
    }, false);
};

ContextMenu.prototype._listenToCMClosed = function(callback) {
    // allow using noRecreate param only for CMs with overlay
    var noRecreate = this.params.overlay && this.params.noRecreate;

    // store close event listeners as an array to easily remove them in #close()
    if (noRecreate) {
        this.eventListenersToRemove = [
            {
                t: document,
                e: "mousedown",
                cb: (event) => {
                    if (event.which !== 3) {
                        callback(event);
                    }
                }
            },

            {
                t: this.overlay,
                e: "contextmenu",
                cb: (event) => {
                    event.stopPropagation();
                    event.preventDefault();

                    callback(event);
                }
            }
        ];
    } else {
        this.eventListenersToRemove = [
            {
                t: document,
                e: "mousedown",
                cb: (event) => {
                    callback(event);
                }
            },
        ];
    }

    // add keydown event either the CM has an overlay or not
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

    // add previously defined event listeners
    this.eventListenersToRemove.forEach(function(eventListener) {
        eventListener.t.addEventListener(eventListener.e, eventListener.cb, false);
    });
};

ContextMenu.prototype._prepareOverlay = function() {
    // create the overlay element
    this.overlay = document.createElement("div");
    // add data-overlay-cm for styling purposes
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
    this.overlay.style.zIndex = 2147483645;

    // append invisible overlay to the body
    document.body.appendChild(this.overlay);
};

ContextMenu.prototype._prepareItems = function() {
    // everything that is going to be rendered in the CM
    this.itemsToRender = this.params.items.map((item) => {
        if (item === "divider") {
            var node = document.createElement("div");
            node.dataset.itemServiceCm = "divider";

            return node;
        }

        var text = document.createTextNode(item.title),
            node = document.createElement("li");

        // add data-item-cm for styling purposes
        node.dataset.itemCm = this.params.id || "";
        node.appendChild(text);

        // if the purpose of the item is to open another CM
        if (item.function instanceof ContextSubMenu) {
            // ensure that given param's type is number else make it equals zero
            var openDelay = item.function.params.delay.open * 1000;
            openDelay = (!Number.isNaN(openDelay)) ? openDelay : 0;

            node.addEventListener("mouseenter", (event) => {
                this.timer = setTimeout(() => {
                    if (!this.openedCSM) {
                        // open new CSM
                        this.openedCSM = item.function._init(this, node);

                    // if CSM is already opened but mouse entered another item
                    // that is also opens a CSM
                    } else if (this.openedCSM !== item.function) {
                        // close existing CSM and open a new one
                        this.openedCSM.close();
                        this.openedCSM = item.function._init(this, node);
                    }
                }, openDelay);
            }, false);

            node.addEventListener("mouseleave", (event) => {
                clearTimeout(this.timer);
            }, false);

            // open CSM immidiatly
            node.addEventListener("mousedown", (event) => {
                clearTimeout(this.timer);

                if (!this.openedCSM) {
                    this.openedCSM = item.function._init(this, node);

                // unless event occurred on the same item again
                } else if (this.openedCSM !== item.function) {
                    this.openedCSM.close();
                    this.openedCSM = item.function._init(this, node);
                }
            }, false);

        // if the purpose of the item is to execute the given function
        } else {
            // this timeout is needed to prevent an item to be treated as
            // "mouseupped" in case of random mouse movement right after
            // the CM has been opened
            setTimeout(() => {
                node.addEventListener("mouseup", (event) => {
                    // close all the CMs and then execute the given function
                    this._getRoot().close();
                    item.function();
                }, false);
            }, 100)
        }

        // prevent CM close
        node.addEventListener("mousedown", (event) => {
            event.stopPropagation();
        }, false);

        node.addEventListener("contextmenu", (event) => {
            event.stopPropagation();
            event.preventDefault();
        }, false);

        return node;
    });
};

ContextMenu.prototype._prepareCM = function() {
    // create the CM element
    this.cm = document.createElement("ol");
    // add data-cm for styling purposes
    this.cm.dataset["cm"] = this.params.id || "";

    // necsessary styles
    this.cm.style.position = "absolute";
    this.cm.style.display = "block";
    this.cm.style.visibility = "hidden";
    this.cm.style.zIndex = 2147483646;

    // make every item the child of the CM
    this.itemsToRender.forEach((item) => {
        this.cm.appendChild(item);
    });

    // render CM/CSM in the overlay if it presents or in the body if not
    if (this._getRoot().overlay) {
        this._getRoot().overlay.appendChild(this.cm);
    } else {
        document.body.appendChild(this.cm);
    }
};

ContextMenu.prototype._drawOverlay = function() {
    // make overlay visible
    this.overlay.style.visibility = "visible";
};

ContextMenu.prototype._drawCM = function(pos) {
    // make CM visible on the calculated position
    this.cm.style.left = pos.x + "px";
    this.cm.style.top = pos.y + "px";
    this.cm.style.visibility = "visible";

    // add className for css transitions and animations
    this.cm.className = "visible";
};

ContextMenu.prototype._prepareForClose = function(triggeredByRoot) {
    // close opened CSM if any
    if (this.openedCSM) {
        this.openedCSM.close(triggeredByRoot);
    }

    // clear timeout if there is a YET unopened CSM
    if (this.timer) {
        clearTimeout(this.timer);
    }

    // clear CSM's closeTimer if there is a YET unclosed CSM
    if (this.closeTimer) {
        clearTimeout(this.closeTimer);
    }

    // remove all previously strored event listeners to keep everything clean
    this.eventListenersToRemove.forEach(function(eventListener) {
        eventListener.t.removeEventListener(eventListener.e, eventListener.cb);
    });
};

ContextMenu.prototype.close = function() {
    this._prepareForClose(true);

    // remove the overlay if it's present else remove CM directly
    if (this.overlay) {
        this.overlay.remove();
    } else {
        this.cm.remove();
    }
};

ContextMenu.prototype._calculatePosition = function(event) {
    var viewportWidth = document.documentElement.clientWidth,
        viewportHeight = document.documentElement.clientHeight,

        clickedX = (event.clientX > viewportWidth) ? viewportWidth : event.clientX,
        clickedY = (event.clientY > viewportHeight) ? viewportHeight : event.clientY,

        cmWidth = this.cm.getBoundingClientRect().width,
        cmHeight = this.cm.getBoundingClientRect().height,

        // furthest means the point that is opposite to the one FROM which the
        // CM will be rendered
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

    // bear in mind that page could be scrolled
    pos.x += document.documentElement.scrollLeft;
    pos.y += document.documentElement.scrollTop;

    return pos;
};

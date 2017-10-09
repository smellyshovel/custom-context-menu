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
        this.drawOverlay();
        var pos = this.calculatePosition(event);
        this.drawCM(pos);

        // listening to CM closed and executing the callback function when it happened
        this.listenToCMClosed((event) => {
            this.close();
        });
    });

    ContextMenu._instances.push(this);
}

ContextMenu._instances = [];

ContextMenu.prototype.getRoot = function() {
      var parent = this;
      while("parent" in parent) {
          parent = parent.parent;
      }

      return parent;
};

ContextMenu.prototype.listenToCMInvoked = function (callback) {
    var getItems = function() {
        return [].slice.call(document.querySelectorAll("[data-item-cm]"));
    };

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

                // bug #1 (created document CM if rightclicked on non-document cm's item)
                if (getItems().indexOf(event.target) === -1) {
                    callback(event);
                }
            }
        }
    });
};

ContextMenu.prototype.listenToCMClosed = function (callback) {
    var noRecreate = this.overlay && this.params.noRecreate,
        getItems = function() {
            return [].slice.call(document.querySelectorAll("[data-item-cm]"));
        };

    // storing "closing" event listeners as an array to easily later removal
    if (this.overlay) {
        this.eventListenersToRemove = [
            {
                t: document,
                e: "mousedown",
                cb: (event) => {
                    if (noRecreate ? event.which !== 3 : true) {
                        // if clicked not on item
                        if (getItems().indexOf(event.target) === -1) {
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
                    if (getItems().indexOf(event.target) === -1) {
                        callback(event);
                    }
                }
            }
        ];
    } else {
        this.eventListenersToRemove = [
            {
                t: document,
                e: "mousedown",
                cb: (event) => {
                    // if clicked not on item
                    if (getItems().indexOf(event.target) === -1) {
                        callback(event);
                    }
                }
            }
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
    this.overlay.style.zIndex = 2147483645;

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
            var openDelay = item.function.params.delay.open * 1000;
            openDelay = (!Number.isNaN(openDelay)) ? openDelay : 0;

            node.addEventListener("mouseenter", (event) => {
                this.timer = setTimeout(() => {
                    if (!this.openedCSM) {
                        this.openedCSM = item.function.init(this, node);
                    } else if (this.openedCSM !== item.function) {
                        this.openedCSM.close();
                        this.openedCSM = item.function.init(this, node);
                    }
                }, openDelay);
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
                    this.openedCSM = item.function.init(this, node);
                }
            });
        } else {
            // when user releases mouse button on item
            node.addEventListener("mouseup", (event) => {
                this.getRoot().close();
                item.function();
            });
        }

        return node;
    });

    // TODO: check if not needed
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
    this.cm.style.zIndex = 2147483646;

    // rendering every item (including dividers)
    this.itemsToRender.forEach((item) => {
        this.cm.appendChild(item);
    });

    // if we have the overlay then render CM in it else render right in the body
    if (this.getRoot().overlay) {
        this.getRoot().overlay.appendChild(this.cm);
    } else {
        document.body.appendChild(this.cm);
    }
};

ContextMenu.prototype.drawOverlay = function() {
    // make overlay visible if we have it
    if (this.overlay) {
        this.overlay.style.visibility = "visible";
    }
}

ContextMenu.prototype.drawCM = function (pos) {
    // make CM visible and set it's position
    this.cm.style.left = pos.x + "px";
    this.cm.style.top = pos.y + "px";
    this.cm.style.visibility = "visible";

    // adding className for css transitions and animations
    this.cm.className = "visible";
};

ContextMenu.prototype.closeCSMsAndRemoveEventListeners = function(triggeredByRoot) {
    // close opened CSM if any
    if (this.openedCSM) {
        this.openedCSM.close(triggeredByRoot);
    }

    // clear timeout if we have YET unopened CSM
    if (this.timer) {
        clearTimeout(this.timer);
    }

    // removing all no-longer-needed event listeners to keep everything clean
    this.eventListenersToRemove.forEach(function(eventListener) {
        eventListener.t.removeEventListener(eventListener.e, eventListener.cb);
    });
}

ContextMenu.prototype.close = function() {
    this.closeCSMsAndRemoveEventListeners(true);

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

    this.params = params;
}

ContextSubMenu.prototype = Object.create(ContextMenu.prototype);

ContextSubMenu.prototype.init = function(parent, callee) {
    this.parent = parent;
    this.callee = callee;

    this.prepareLayoutItems(); // from parent
    this.prepareCM(); // form parent

    var pos = this.calculatePosition(callee);
    this.drawCM(pos); // from parent

    this.listenToCSMClosed((event) => {
        if (this.parent.openedCSM) {
            this.close();
        }
    });

    return this;
}

ContextSubMenu.prototype.close = function (triggeredByRoot) {
    ContextMenu.prototype.closeCSMsAndRemoveEventListeners.call(this);

    // if close was triggered in the root CM, then we don't want to wait until transition ends
    if (triggeredByRoot) {
        this.cm.remove();
    } else {
        // if close was triggered by for exmaple mouseleave on CSM, then
        // we should check whether this CSM has transition property or not
        // if it does then we remove it right after the transition is done
        // if it doesn't then we remove it right on the way. This check is
        // necsessary, because the transitionend
        // event simply doesn't work if no transition provided (or it's)
        // duration equals zero.
        var transition = parseInt((getComputedStyle(this.cm)).transitionDuration) > 0;
        if (transition) {
            this.cm.className = "invisible";
            this.cm.addEventListener("transitionend", (event) => {
                this.cm.remove();
            });
        } else {
            this.cm.remove();
        }
    }

    this.parent.openedCSM = null;
};

ContextSubMenu.prototype.listenToCSMClosed = function (callback) {
    var closeDelay = this.params.delay.close * 1000;
    closeDelay = (!Number.isNaN(closeDelay)) ? closeDelay : 0;

    // var exceptCallee = this.parent.items

    this.eventListenersToRemove = [
        { // if mouse leaves the callee (CSM untouched)
            t: this.callee,
            e: "mouseleave",
            f: (event) => {
                console.log("Will be closed");
                this.closeTimer = setTimeout(() => {
                    console.log("CLOSING...");
                    callback(event);
                }, closeDelay);
            }
        },

        { // if mouse returns to the callee
            t: this.callee,
            e: "mouseenter",
            f: (event) => {
                console.log("CANCEL");
                clearTimeout(this.closeTimer);
            }
        },

        // TODO: think about this behavior. May be it's better to add mouseenter to this.parent.cm
        { // if mouse retuns to the parent CM (or CSM)
            t: this.cm,
            e: "mouseleave",
            f: (event) => {
                if (this.openedCSM) {
                    if (event.toElement !== this.openedCSM.cm) {
                        console.log("Will be closed");
                        this.closeTimer = setTimeout(() => {
                            console.log("CLOSING...");
                            callback(event);
                        }, closeDelay);
                    }
                } else {
                    console.log("Will be closed");
                    this.closeTimer = setTimeout(() => {
                        console.log("CLOSING...");
                        callback(event);
                    }, closeDelay);
                }
            }
        },

        { // if mouse enters the CSM
            t: this.cm,
            e: "mouseenter",
            f: (event) => {
                console.log("CANCEL");
                clearTimeout(this.closeTimer);
            }
        }
    ];

    this.eventListenersToRemove.forEach((eventListener) => {
        eventListener.t.addEventListener(eventListener.e, eventListener.f);
    });
};

ContextSubMenu.prototype.calculatePosition = function(li) {
    var viewportWidth = document.documentElement.clientWidth,
        viewportHeight = document.documentElement.clientHeight,

        liTop = li.getBoundingClientRect().top,
        liBottom = li.getBoundingClientRect().bottom,
        liLeft = li.getBoundingClientRect().left,
        liRight = li.getBoundingClientRect().right,

        cmWidth = this.cm.getBoundingClientRect().width,
        cmHeight = this.cm.getBoundingClientRect().height,

        furthestX = liRight + cmWidth,
        furthestY = liTop + cmHeight,

        pos = {x: liRight, y: liTop};

        if (furthestX > viewportWidth) {
            pos.x = liLeft - cmWidth;
        }

        if (furthestY > viewportHeight) {
            pos.y = liBottom - cmHeight;
        }

        return pos;
}

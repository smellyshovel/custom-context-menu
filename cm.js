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

    // store target and params as properties to have an access to them in the
    // methods
    this.target = target;
    this.params = params;

    // execute callback when CM invokation event happend
    this.listenToCMInvoked((event) => {
        // prepare and draw overlay if needed
        if (this.params.overlay) {
            this.prepareOverlay();
            this.drawOverlay();
        }

        // prepare items and CM with this items
        this.prepareItems();
        this.prepareCM();

        // calculate the position of the CM and draw it there
        var pos = this.calculatePosition(event);
        this.drawCM(pos);

        // execute callback when CM invokation happened
        this.listenToCMClosed((event) => {
            // close CM (with nested)
            this.close();
        });
    });

    // store this instance to prevent "recreating"
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

ContextMenu.prototype.getItems = function() {
    // return every element with data-item-cm in as an array
    return [].slice.call(document.querySelectorAll("[data-item-cm]"));
}

ContextMenu.prototype.listenToCMInvoked = function(callback) {
    this.target.addEventListener("contextmenu", (event) => {
        // if CM is not disabled
        if (!this.params.disabled) {
            // force defaultOnAlt param to true if nothing's given
            var defaultOnAlt = ("defaultOnAlt" in this.params) ? this.params.defaultOnAlt : true;

            // if defaultOnAlt is true then check whether the alt key was not
            // holded when the event was triggered or it was. If it was then the
            // code below just won't be executed
            if (defaultOnAlt ? event.altKey === false : true) {
                // prevent default CM to appear
                event.preventDefault();
                event.stopPropagation();

                // look for bug #1 in issues
                if (this.getItems().indexOf(event.target) === -1) {
                    callback(event);
                }
            }
        }
    });
};

ContextMenu.prototype.listenToCMClosed = function(callback) {
    // allow using noRecreate param only for CMs with overlay
    var noRecreate = this.params.overlay && this.params.noRecreate;

    // store close event listeners as an array to easily remove them in #close()
    if (this.overlay) {
        this.eventListenersToRemove = [
            {
                t: document,
                e: "mousedown",
                cb: (event) => {
                    if (noRecreate ? event.which !== 3 : true) {
                        // if clicked not on item
                        if (this.getItems().indexOf(event.target) === -1) {
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
                    if (this.getItems().indexOf(event.target) === -1) {
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
                    if (this.getItems().indexOf(event.target) === -1) {
                        callback(event);
                    }
                }
            }
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
        eventListener.t.addEventListener(eventListener.e, eventListener.cb);
    });
};

ContextMenu.prototype.prepareOverlay = function() {
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

ContextMenu.prototype.prepareItems = function() {
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
            // ensure that given params' type is number else make it zero
            var openDelay = item.function.params.delay.open * 1000;
            openDelay = (!Number.isNaN(openDelay)) ? openDelay : 0;

            node.addEventListener("mouseenter", (event) => {
                this.timer = setTimeout(() => {
                    if (!this.openedCSM) {
                        // open new CSM
                        this.openedCSM = item.function.init(this, node);

                    // if CSM is already opened but mouse entered another item
                    // that is also opens a CSM
                    } else if (this.openedCSM !== item.function) {
                        // close existing CSM and open a new one
                        this.openedCSM.close();
                        this.openedCSM = item.function.init(this, node);
                    }
                }, openDelay);
            });

            node.addEventListener("mouseleave", (event) => {
                clearTimeout(this.timer);
            });

            // open CSM immidiatly
            node.addEventListener("mousedown", (event) => {
                clearTimeout(this.timer);

                if (!this.openedCSM) {
                    this.openedCSM = item.function.init(this, node);

                // unless event occurred on the same item again
                } else if (this.openedCSM !== item.function) {
                    this.openedCSM.close();
                    this.openedCSM = item.function.init(this, node);
                }
            });

        // if the purpose of the item is to execute the given function
        } else {
            node.addEventListener("mouseup", (event) => {
                // close all the CMs and then execute the given function
                this.getRoot().close();
                item.function();
            });
        }

        return node;
    });
};

ContextMenu.prototype.prepareCM = function() {
    // creatie the CM element
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
    if (this.getRoot().overlay) {
        this.getRoot().overlay.appendChild(this.cm);
    } else {
        document.body.appendChild(this.cm);
    }
};

ContextMenu.prototype.drawOverlay = function() {
    // make overlay visible
    this.overlay.style.visibility = "visible";
}

ContextMenu.prototype.drawCM = function(pos) {
    // make CM visible on the calculated position
    this.cm.style.left = pos.x + "px";
    this.cm.style.top = pos.y + "px";
    this.cm.style.visibility = "visible";

    // add className for css transitions and animations
    this.cm.className = "visible";
};

ContextMenu.prototype.prepareForClose = function(triggeredByRoot) {
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
}

ContextMenu.prototype.close = function() {
    this.prepareForClose(true);

    // remove the overlay if it's present else remove CM directly
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

function ContextSubMenu(params) {
    // prevent ContextSubMenu executed as a function (not as a constructor)
    if (!(this instanceof ContextSubMenu)) {
        return new ContextSubMenu(params);
    }

    // store params as property to have an access to it in the methods
    this.params = params;
}

// set the ContextMenu's prototype as a prototype of the ContextSubMenu for code
// reuse / DRY / inheritance and then expand the ContextSubMenu's prototype with
// the unique properties
ContextSubMenu.prototype = Object.create(ContextMenu.prototype);

// the differences in the logics between the ContextMenu and ContextSubMenu are
// that all the "preparing" stuff for the ContextMenu happens right when the new
// instance of it is created. But for the ContextSubMenu it happens in the
// init() method which is called only when the CSM is going to opened.
ContextSubMenu.prototype.init = function(parent, callee) {
    this.parent = parent;
    this.callee = callee;

    this.prepareItems(); // from parent
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

ContextSubMenu.prototype.close = function(triggeredByRoot) {
    ContextMenu.prototype.prepareForClose.call(this);

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

ContextSubMenu.prototype.listenToCSMClosed = function(callback) {
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

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
// init() method which is called only when the CSM is going to be opened.
ContextSubMenu.prototype._init = function(parent, callee) {
    // the parent is the CM/CSM that has the "li" that opened this CSM
    this.parent = parent;
    // the callee is the "li" element mentioned above
    this.callee = callee;

    // prepare items and CSM with this items
    this._prepareItems(); // from ContextMenu
    this._prepareCM(); // form ContextMenu

    // calculate the position of the CM and draw it there
    var pos = this._calculatePosition(callee);
    this._drawCM(pos); // from ContextMenu

    // execute open callback (or a blank function if none)
    this._getCallback("open")();

    // execute callback when CSM close happened
    this._listenToCSMClosed((event) => {
        // if the CSM was not closed already
        if (this.parent.openedCSM) {
            // close CM (with nested)
            this.close();

            // execute open callback (or a blank function if none)
            this._getCallback("close")();
        }
    });

    return this;
};

ContextSubMenu.prototype.close = function(triggeredByRoot) {
    // all the "clearing" stuff before close
    ContextMenu.prototype._prepareForClose.call(this);

    // close CSM immidiatly if close was triggered by the root CM (specifically
    // the root CM close)
    if (triggeredByRoot) {
        this.cm.remove();
    } else {
        // if close was triggered by for exmaple mouseleave on CSM, then
        // we should check whether this CSM has transition property or not
        // if it does then we remove the CSM right after the transition is over
        // if it doesn't then we remove it right on the way. This check is
        // necsessary, because the transitionend event simply won't work if no
        // transition provided (or it's duration equals zero).
        var transition = parseInt((getComputedStyle(this.cm)).transitionDuration) > 0;
        if (transition) {
            // add className for css transitions and animations
            this.cm.className = "invisible";

            this.cm.addEventListener("transitionend", (event) => {
                this.cm.remove();
            }, false);
        } else {
            this.cm.remove();
        }
    }

    // tell the parent CM/CSM that it no longer have the opened CSM
    this.parent.openedCSM = null;
};

ContextSubMenu.prototype._listenToCSMClosed = function(callback) {
    // ensure that given param's type is number else make it equals zero
    var closeDelay = this.params.delay.close * 1000;
    closeDelay = (!Number.isNaN(closeDelay)) ? closeDelay : 0;

    this.eventListenersToRemove = [
        { // if mouse leaves the callee (CSM untouched)
            t: this.callee,
            e: "mouseleave",
            f: (event) => {
                this.closeTimer = setTimeout(() => {
                    callback(event);
                }, closeDelay);
            }
        },

        { // if mouse returns to the callee
            t: this.callee,
            e: "mouseenter",
            f: (event) => {
                clearTimeout(this.closeTimer);
            }
        },

        // TODO: think about this behavior. May be it's better to add mouseenter to this.parent.cm
        { // if mouse retuns to the parent CM (or CSM)
            t: this.cm,
            e: "mouseleave",
            f: (event) => {
                // if there is an opened CSM by this CSM
                if (this.openedCSM) {
                    // and if mouse leaved somwhere not to it's CSM
                    if (event.toElement !== this.openedCSM.cm) {
                        this.closeTimer = setTimeout(() => {
                            callback(event);
                        }, closeDelay);
                    }
                } else {
                    this.closeTimer = setTimeout(() => {
                        callback(event);
                    }, closeDelay);
                }
            }
        },

        { // if the mouse enters the CSM
            t: this.cm,
            e: "mouseenter",
            f: (event) => {
                clearTimeout(this.closeTimer);
            }
        }
    ];

    // add previously defined event listeners
    this.eventListenersToRemove.forEach((eventListener) => {
        eventListener.t.addEventListener(eventListener.e, eventListener.fm, false);
    });
};

ContextSubMenu.prototype._calculatePosition = function(li) {
    var viewportWidth = document.documentElement.clientWidth,
        viewportHeight = document.documentElement.clientHeight,

        liTop = li.getBoundingClientRect().top,
        liBottom = li.getBoundingClientRect().bottom,
        liLeft = li.getBoundingClientRect().left,
        liRight = li.getBoundingClientRect().right,

        cmWidth = this.cm.getBoundingClientRect().width,
        cmHeight = this.cm.getBoundingClientRect().height,

        // furthest means the point that is opposite to the one FROM which the
        // CM will be rendered
        furthestX = liRight + cmWidth,
        furthestY = liTop + cmHeight,

        pos = {x: liRight, y: liTop};

        if (furthestX > viewportWidth) {
            pos.x = liLeft - cmWidth;
        }

        if (furthestY > viewportHeight) {
            pos.y = liBottom - cmHeight;
        }

        // bear in mind that page could be scrolled
        pos.x += document.documentElement.scrollLeft;
        pos.y += document.documentElement.scrollTop;

        return pos;
};

void function() {
    "use strict";

    ContextMenu.Item.prototype._buildFromObject = function() {
        let text = document.createTextNode(this.descr.title);
        this._node = document.createElement("li");
        this._node.tabIndex = 0;

        this._node.appendChild(text);

        if (this.descr.action instanceof ContextMenu.Sub) {
            this._node.dataset.cmItem = "submenu-opener";
            this._registerSubOpenEventListener();
        } else {
            this._node.dataset.cmItem = "";
            this._registerActionEventListener(this.descr.action);
        }
    };

    ContextMenu.Item.prototype._registerSubOpenEventListener = function() {
        let openDelay = this.descr.action.options.delay.open;


        this._node.addEventListener("mouseenter", (event) => {
            this._timer = setTimeout(() => {
                if (!this._openedCSM) {
                    // open new CSM
                    this._openedCSM = this.descr.action._open(this.cm, this._node);

                // if CSM is already opened but mouse entered another item
                // that is also opens a CSM
            } else if (this._openedCSM !== this.descr.action) {
                    // close existing CSM and open a new one
                    this._openedCSM.close();
                    this._openedCSM = this.descr.action._open(this.cm, this._node);
                }
            }, openDelay);
        });

        this._node.addEventListener("mouseleave", (event) => {
            clearTimeout(this._timer);
        });
        //
        // // open CSM immidiatly
        // node.addEventListener("mousedown", (event) => {
        //     clearTimeout(this.timer);
        //
        //     if (!this.openedCSM) {
        //         this.openedCSM = item.function._init(this, node);
        //
        //     // unless event occurred on the same item again
        //     } else if (this.openedCSM !== item.function) {
        //         this.openedCSM.close();
        //         this.openedCSM = item.function._init(this, node);
        //     }
        // }, false);

        this._registerBehaviorEventListener();
    };

    ContextMenu.Sub = class Sub {
        // TODO: развернуто - flag when CSM is opened to countinue highlighting an item
        constructor(items, options) {
            /*
                Provide default (fallback) options values by setting the
                prototype of the `options` object to the ::_defaultOptions
                object.
            */
            Object.setPrototypeOf(options, ContextMenu.Sub._defaultOptions);

            /*
                Make items and options to be the properties of the CM instance
                to have an access to them in methods and outside. This provides
                a possibility to dinamically add new items and change options.
            */
            this.items = items;
            this.options = options;
        }

        _open(parent, caller) {
            /*
                ._parent keeps the CM/CSM interaction with an item of which led
                to creation of this instance. ._caller is the item (`li`
                element) iteself.
            */
            this._parent = parent;
            this._caller = caller;

            /*
                The process of opening a CSM is almost absolutely identical with
                the process of opening a CM, or rather the steps taken during
                the opening of the CSM are identical. Therefore, there's no need
                to copy here all these steps. Nevertheless, some single ones are
                a bit different from those for CM, so here we can adjust them to
                our needs. For example, we don't have to create a separate
                overlay for the CSM. So when the #_renderOverlay method is
                invoked inside the `ContextMenu.prototype._open`, called on
                `this` object, then it actually invokes the #_renderOverlay
                method of THIS (CSM instance) object. That means that we might
                not invoke the #_renderOverlay of the ContextMenu's prototype
                there (in order to create an overlay), but instead do something
                else (like, for example, save the existing overlay to use it as
                the overlay for this CSM).
            */
            ContextMenu.prototype._open.call(this);
        }

        _renderOverlay() {
            /*
                And yep, here we do so. No need in second (third, fouth etc.)
                overlay. Just use the existing one (the one created for the root
                CM).
            */
            this._overlay = this._parent._overlay;
        }

        _buildItemElements() {
            /*
                But there're no differences in building item elements between CM
                and CSM. So we can just invoke the #_buildItemElements method of
                the ContextMenu's prototype on `this` instance to avoid code
                duplication.
            */
            ContextMenu.prototype._buildItemElements.call(this);
        }

        _render() {
            /*
                The same applies for the rendering of the CSM. The process is
                absolutely identical with the one for the CM.
            */
            ContextMenu.prototype._render.call(this);
        }

        _registerNavigationEventListener() {
            ContextMenu.prototype._registerNavigationEventListener.call(this);
        }

        _determinePosition() {
            /*
                Determination of a CSM's position is a little different from the
                CM. Comments for all the common stuff you can find in the
                ContextMenu prototype #_determinePosition's source text.

                The initialazation of the CSM (its opening) happens after some
                sort of interaction with a parental CM's item. Therefore we
                don't have to know a thing about where the click happened, or
                something of this kind. It's enough just to know the initiator's
                (caller's) position. So, we get it and save it.
            */
            let callerLeft = this._caller.getBoundingClientRect().left,
                callerRight = this._caller.getBoundingClientRect().right,
                callerTop = this._caller.getBoundingClientRect().top,
                callerBottom = this._caller.getBoundingClientRect().bottom,

                viewportWidth = this._overlay.getBoundingClientRect().width,
                viewportHeight = this._overlay.getBoundingClientRect().height,

                cmWidth = this._cm.getBoundingClientRect().width,
                cmHeight = this._cm.getBoundingClientRect().height,

                furthestX = callerRight + cmWidth,
                furthestY = callerTop + cmHeight;

                /*
                    Initially the CSM's position equals the top right corner of
                    the caller.
                */
                this._position = {x: callerRight, y: callerTop};

            /*
                But due to the fact that the CSMs open aside the parental CMs,
                there's a big chance that the CSM simply won't fit the viewport
                (horizontally). Therefore we must somehow fit it. If the
                `transfer` option has the value `both` or `x`, then the CM's
                right edge will be at the caller's left edge. But if the
                `transfer` option's value is `false`, then we do the same as we
                do with the CMs - setting its position so that the CSM's right
                edge will be just at the viewport's right edge.
            */
            if (furthestX > viewportWidth) {
                if (this.options.transfer === "both" || this.options.transfer === "x") {
                    this._position.x = callerLeft - cmWidth;
                } else {
                    this._position.x = viewportWidth - cmWidth;
                }
            }

            /*
                The same thing goes for the vertical alignment. If the
                `transfer` option is set to `both` or `y`, then the CM's bottom
                edge will be at the same height as the caller's bottom edge. If
                the `transfer` option equals `false`, then we making it fit in
                the viewport, i.e. setting its position so that the CSM's bottom
                edge is equal with the viewport's bottom edge.
            */
            if (furthestY > viewportHeight) {
                if (this.options.transfer === "both" || this.options.transfer === "y") {
                    this._position.y = callerBottom - cmHeight;
                } else {
                    this._position.y = viewportHeight - cmHeight;
               }
            }
        }

        _setPosition() {
            /*
                Setting the CSM's position is identical with the CM. Notice
                also, that "setting the position" does not only mean "setting",
                but it's also "adjusting". More exactly, adjusting the `y`
                (vertical) position. It's necessary due to the fact that after
                the CM/CSM has been transfer it may then go beyond the
                viewport's top edge. Or the same may happen if the CM/CSM is
                simply overflowed with items. So in the #_setPosition method
                we have to make some final adjustments, like forcing the CM/CSM
                to lower its position so it won't overcome the top viewport's
                edge, or if even after the "lowering" the CM/CSM starts to
                overcome the bottom edge we must enable scrolling. Why don't
                bother the same way with the "x" though, you might ask? Well,
                browser windows (as well as monitors) are usually wide enough.
                Moreover, the width of a CM/CSM is typically less then its
                height, so it's way less probable that the CM/CSM might overflow
                the width of the viewport.
            */
            ContextMenu.prototype._setPosition.call(this);
        }

        _markAsVisible() {
            /*
                Nothing special here for a CSM.
            */
            ContextMenu.prototype._markAsVisible.call(this);
        }

        static get _defaultOptions() {
            // TODO: Object.create, prototype to parental to fallback to them?
            return {
                delay: {
                    open: 250,
                    close: 250
                },
                name: "",
                closeOnKey: false,
                transfer: "x",
                verticalMargin: 10,
                callback: {
                    opening() {},
                    closure() {}
                }
            }
        }
    }
}();

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

        _open(parent, li) {
            this._parent = parent;

            let clientX = li.getBoundingClientRect().right,
                clientY = li.getBoundingClientRect().top;

            ContextMenu.prototype._open.call(this, {clientX, clientY});
        }

        _renderOverlay() {
            this._overlay = this._parent._overlay;
        }

        _buildItemElements() {
            ContextMenu.prototype._buildItemElements.call(this);
        }

        _render() {
            ContextMenu.prototype._render.call(this);
        }

        _registerNavigationEventListener() {
            ContextMenu.prototype._registerNavigationEventListener.call(this);
        }

        _determinePosition(event) {
            ContextMenu.prototype._determinePosition.call(this, event);
        }

        _setPosition() {
            ContextMenu.prototype._setPosition.call(this);
        }

        _markAsVisible() {
            ContextMenu.prototype._markAsVisible.call(this);
        }

        static get _defaultOptions() {
            return {
                delay: {
                    open: 250,
                    close: 250
                },
                callback: {
                    opening() {},
                    closure() {}
                }
            }
        }
    }
}();

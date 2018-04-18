// basically this wrapper is necsessary only to enable strict mode
const ContextMenu = function() {
    "use strict";

    class ContextMenu {
        constructor(target, items, options, debug) {
            /*
                Each ContextMenu instance must have a separate logger because
                the logger is allowed to log messages only if the `debug` option
                is `true`. Creating a separate logger allows us to avoid passing
                the value of the `debug` option from call to call so we can just
                create an instance of logger passing the value of the `debug`
                option only once and the logger will know whether it's possible
                to log something or not.
            */
            try {
                this.logger = new ContextMenu.Logger(options.name, debug);
            } catch (e) {
                this.logger = new ContextMenu.Logger("", debug);
            }

            /*
                Here's an example. We just tell the logger what we need to log,
                and it decides itself whether to actually log it.
            */
            this.logger.log("creating...");

            /*
                Check target for errors. If there is a CM instance already
                defined for the same target as the one that's being created now
                then return a found instance instead of "recreating" the CM.
            */
            let alreadyDefined = ContextMenu._checkTarget(this.logger, target);
            if (alreadyDefined) return alreadyDefined;

            /*
                Check items for errors.
            */
            ContextMenu._checkItems(this.logger, items);

            /*
                Check options for those that are unknown, then proxy the options
                in order to track addition of new ones that are also might be
                unknown. Moreover, the proxying solves the problem with
                providing default valus for options.
            */
            ContextMenu._checkOptions(this.logger, options);
            options = ContextMenu._proxyOptions(this.logger, options);

            /*
                Making target, items and options to be properties of a CM
                instance to have an access to them in methods and outside. This
                provides a possibility to dinamically add new items and change
                options.
            */
            this.target = target;
            this.items = items;
            this.options = options;

            /*
                All the properties that are created asyncronously must be
                predefined, because we won't be able to define new properties
                after freezing the instance. However, due to the freezing we
                won't also be able to redefine existing properties. So we need
                only one predefined object in which we'll store all the
                asyncronously created properties, becase the freezing affects
                only one level, so the `_` object will act like unfrozen one.
            */
            this._ = {};

            /*
                Freezing the instance to prevent target, items and options
                redefinition, which may lead to multiple runtime errors and
                other undesired behavior.
            */
            Object.freeze(this);

            /*
                Save the instance to prevent "recreating".
            */
            ContextMenu._instances.push(this);

            /*
                Registering the event listener that is responsible for tracking
                the ContextMenu invokation.
            */
            this._registerOpenEventListener();

            this.logger.log("created. Waiting for call...");
        }

        _registerOpenEventListener() {
            /*
                When the `contextmenu` event takes place, handle it first and
                then register the event listener that is responsible for
                tracking the ContextMenu closure.
            */
            this.target.addEventListener("contextmenu", (event) => {
                this.logger.log("called.");

                this._handleCallOpen(event);
                this._registerCloseEventListener();
            });
        }

        _handleCallOpen(event) {
            /*
                Prevent opening of the context menues that are defined for those
                elements that are below the `this.target` in the DOM.
            */
            event.stopPropagation();

            /*
                If `defaultOnAlt` is `true` then check whether the alt key was not
                holded when the event was triggered or if it was. If it was then
                the code below just won't be executed, i.e. the default context
                menu will appear. But if `defaultOnAlt` is `false`, then just
                show a custom context menu in any way.
            */
            if (this.options.defaultOnAlt ? event.altKey === false : true) {
                /*
                    Prevent default (browser) context menu from appearing.
                */
                event.preventDefault();

                /*
                    Open the context menu if it's not `disabled`. Else just
                    remind that it is.
                */
                if (this.options.disabled) {
                    this.logger.log("the context menu is disabled.");
                } else {
                    this._open(event);
                }
            }
        }

        _registerCloseEventListener() {
            /*
                We need 2 sets of different event listeners to track the conetxt
                menu closure. The first one is used if the `noRecreate` option
                is `true` and the second one if not.
            */
            if (this.options.noRecreate) {
                /*
                    If a click happened on the overlay and the click is not the
                    rightclick, then close the context menu. If the click is the
                    rightclick, then it will be handled by the appropriate event
                    listener defined below this if-else block.
                */
                this._.overlay.addEventListener("mousedown", (event) => {
                    if (event.which !== 3) {
                        this.close();
                    }
                });
            } else {
                /*
                    Close the context menu on any click (whether right of left)
                    on the overlay. `contextmenu` event listener takes place
                    after the `mousedown`, so a new context menu will be opened
                    after the closure. This is the main idea lying under the
                    `noRecreate` option.
                */
                this._.overlay.addEventListener("mousedown", (event) => {
                    this.close();
                });
            }

            /*
                But it's also necessary to close the context menu if the
                click happened not on the overlay, but over the context
                menu itself. The next 2 event listeners are necessary in
                order just to close the context menu in such case and NOT
                to recreate it (yeah, even if the `noRecreate` option is
                true).

                This part has earlier been in the `else` block. But it became
                obvious that we have to close the context menu on the right
                click over the cm, but not to close it on the left click,
                because there's a need to be able to interact with a scrollbar
                using a mouse.
            */
            this._.cm.addEventListener("mousedown", (event) => {
                event.stopPropagation();
                /*
                    Uncomment the part below to enable the context menu closure
                    on the left button click on the context menu, but be aware
                    of thereby disabling interaction with the scrollbar with a
                    mouse cursor.
                */
                // if (event.which !== 3) {
                //     // this.close();
                // }
            });

            this._.cm.addEventListener("contextmenu", (event) => {
                event.preventDefault();
                event.stopPropagation();
                this.close();
            });

            /*
                Here we listen to the rightclick anywhere "above" the overlay.
                This event listener is also responsible for hitting the menu
                key, so we check the `closeOnKey` option's state as well.
            */
            this._.overlay.addEventListener("contextmenu", (event) => {
                event.stopPropagation();
                event.preventDefault();

                if (!this.options.closeOnKey ? event.which !== 0 : true) {
                    this.close();
                }
            });

            /*
                Here we define a callback function that is called when the
                `keydown` event takes place. We save in order to remove it later
                in #close method because if we don't do so, then this event
                listener will continue to live even after the context menu has
                been closed.
            */
            document.addEventListener("keydown", () => {
                if (event.keyCode === 27) {
                    this.close();
                }
            }, {once: true});
        }

        _open(event) {
            /*
                Render an overlay. The overlay is used to track the context menu
                closure and also acts as sort of a grouping element.
                !!! TODO: may be it's better not to use `_` at all but to pass
                overlay, items, etc. as formal parameters?
            */
            this._renderOverlay();

            /*
                Build items DOM elements from the `items` array.
            */
            this._buildItemElements();

            /*
                Render the invisible context menu in the top left corner of the
                page.
            */
            this._render();

            // add navigation events here? key down, key up, left, right, enter, etc...

            /*
                Determine where on the page the context menu must appear.
            */
            this._determinePosition(event);

            /*
                Set the correct context menu position.
            */
            this._setPosition();

            /*
                Mark the overlay and the context menu as visible.
            */
            this._markAsVisible();

            /*
                Execute open callback.
            */
            let callback = this.options.callback.open;
            try {
                if (callback) {
                    callback.call(this);
                }
            } catch (e) {
                this.logger.warn(M.runtime.badCallback(callback, "open"));
            }
        }

        _renderOverlay() {
            /*
                Disable scrolling via setting `overflow` to `hidden`.
            */
            document.documentElement.style.overflow = "hidden";

            /*
                Create a div element with `data-cm-overlay` attribute the
                value of which equals the `name` of the context menu.
            */
            this._.overlay = document.createElement("div");
            this._.overlay.dataset.cmOverlay = this.options.name;

            /*
                Set the necessary styles that are absolutely must be.
            */
            this._.overlay.style.cssText = "position: fixed !important;\
                                            display: block !important;\
                                            left: 0 !important;\
                                            top: 0 !important;\
                                            width: 100vw !important;\
                                            height: 100vh !important;\
                                            pointer-events: auto !important";

            /*
                Instert overlay to the body.
            */
            document.body.appendChild(this._.overlay);
        }

        _buildItemElements() {
            this._.itemElements = this.items.map((item, i) => {
                return new ContextMenu.Item(item, i, this);
            });
        }

        _render() {
            /*
                Create a div element with `data-cm` attribute the value of which
                equals the `name` of the context menu.
            */
            this._.cm = document.createElement("div");
            this._.cm.dataset.cm = this.options.name;

            /*
                Set the necessary styles that are absolutely must be.
            */
            this._.cm.style.cssText = "position: absolute !important;\
                                       display: block !important;\
                                       left: 0 !important;\
                                       top: 0 !important;";

            /*
                Create a list which will hold all the items of the context menu.
            */
            let list = document.createElement("ol");

            /*
                Populate the list with items.
            */
            this._.itemElements.forEach((item) => {
                list.appendChild(item);
            });

            /*
                Insert the list inside the context menu.
            */
            this._.cm.appendChild(list);

            /*
                Insert the context menu inside the overlay.
            */
            this._.overlay.appendChild(this._.cm);
        }

        _determinePosition(event) {
                /*
                    Where the click actually happened.
                */
            let clickedX = event.clientX,
                clickedY = event.clientY,

                /*
                    The width and height of the viewport equals the width and
                    height of the overlay because the overlay's `width` and
                    `height` CSS proerties have been set using `vw` and `vh`.
                */
                viewportWidth = this._.overlay.getBoundingClientRect().width,
                viewportHeight = this._.overlay.getBoundingClientRect().height,

                /*
                    The width and height of the yet invisible context menu.
                */
                cmWidth = this._.cm.getBoundingClientRect().width,
                cmHeight = this._.cm.getBoundingClientRect().height,

                /*
                    "Furthest" means the bottom right point of the context menu.
                */
                furthestX = clickedX + cmWidth,
                furthestY = clickedY + cmHeight;

                /*
                    The resulting position is initially equal to the coordinates
                    where the click happened.
                */
                this._.position = {x: clickedX, y: clickedY};

            /*
                But if it's obvious that the context menu won't fit on the page,
                than transfer it if necessary, or simply force it to fit by
                setting it's position so the context menu will be rendered right
                in the corner.
            */
            if (furthestX > viewportWidth) {
                if (this.options.transfer === "both" || this.options.transfer === "x") {
                    this._.position.x -= cmWidth;
                } else {
                    this._.position.x = viewportWidth - cmWidth;
                }
            }

            if (furthestY > viewportHeight) {
                if (this.options.transfer === "both" || this.options.transfer === "y") {
                    this._.position.y -= cmHeight;
                } else {
                    this._.position.y = viewportHeight - cmHeight;
               }
            }
        }

        _setPosition() {
            /*
                Setting the `x` coordinate. We have nothing to do with it, so
                it's OK just to set it as it is (because it has been previously
                determined).
            */
            this._.cm.style.left = this._.position.x + "px";

            /*
                For shortness later on.
            */
            let viewportHeight = this._.overlay.getBoundingClientRect().height,
                cmBottom = this._.cm.getBoundingClientRect().bottom,
                verticalMargin = this.options.verticalMargin;

            /*
                If the `y` coordinate is above the top screen side (because the
                context menu has too many items and it has been transfered)
                then force the menu to be rendered in screen bounds, i.e make
                it's top left coordinate to be below the top screen side for the
                `safeZone` amount of pixels.
            */
            if (this._.position.y < 0) {
                /*
                    If the context menu now doesn't fit the height of the
                    viewport (that is always the case, becase we previosly
                    transfered the menu due to that reason), then we shrink it,
                    add arrows and enable a scrollbar (for now, may be the
                    scrollbar will be replaced with some other sort of
                    interaction/scrolling in the future). This `if` condition
                    can not be combined with the previous one via the `&&`
                    because of incorrect `else` statement handling.
                */
                if (cmBottom > viewportHeight) {
                    /*
                        Setting the `y` position including the `verticalMargin`
                        and restricting the height of the context menu (also
                        including the `verticalMargin`).
                    */
                    this._.cm.style.top = `${verticalMargin}px`;
                    this._.cm.style.maxHeight = `${viewportHeight - verticalMargin * 2}px`;
                    this._.cm.style.overflow = "hidden";

                    /*
                        Preparing "up" and "down" arrows.
                    */
                    let arrowUp = document.createElement("div");
                    let arrowUpChar = document.createTextNode("▲");
                    arrowUp.appendChild(arrowUpChar);
                    arrowUp.dataset.cmItem = "arrow";

                    let arrowDown = document.createElement("div");
                    let arrowDownChar = document.createTextNode("▼");
                    arrowDown.appendChild(arrowDownChar);
                    arrowDown.dataset.cmItem = "arrow";

                    /*
                        Inserting the arrows as the first and the last elements
                        of the context menu (around the actual menu that is the
                        `ol` element).
                    */
                    this._.cm.insertBefore(arrowUp, this._.cm.firstChild);
                    this._.cm.appendChild(arrowDown);

                    /*
                        Now the the actual menu (`ol` element) is the second
                        element in the context menu (`div` element). Getting
                        the height of the `div` element and the height of the
                        two arrows.
                    */
                    let menu = this._.cm.children[1],
                        cmHeight = this._.cm.getBoundingClientRect().height,
                        arrowUpHeight = arrowUp.getBoundingClientRect().height,
                        arrowDownHeight = arrowDown.getBoundingClientRect().height;

                    /*
                        Restricting the actual menu's height to be the height
                        of the `div` element minus the height of the 2 arrows
                        and enabling a scrollbar to have access to all of the
                        items.
                    */
                    menu.style.maxHeight = `${cmHeight - arrowUpHeight - arrowDownHeight}px`;
                    menu.style.overflow = "auto";
                }
            } else {
                /*
                    If the context menu fits on the page, then just explicitly
                    set it's position to the earlier determined.
                */
                this._.cm.style.top = this._.position.y + "px";
            }
        }

        _markAsVisible() {
            this._.overlay.className = "visible";
            this._.cm.className = "visible";
        }

        close() {
            /*
                Restore the initial `overflow` value.
            */
            document.documentElement.style.overflow = "";

            /*
                Removing the overlay means removing all the fottprints of the
                context menu together with it's event listeners.
            */
            this._.overlay.remove();

            /*
                Execute close callback.
            */
            let callback = this.options.callback.close;
            try {
                if (callback) {
                    callback.call(this);
                }
            } catch (e) {
                this.logger.warn(M.runtime.badCallback(callback, "close"));
            }
        }

        static _checkTarget(logger, target) {
            /*
                Checking if target is instance of HTMLElement.
            */
            if (!(target instanceof HTMLElement)) {
                logger.error(M.target.bad(target));
            }

            /*
                Checking if there is an already defined for this target context
                menu.
            */
            let alreadyDefined = this._instances.find((instance) => {
                return instance.target === target;
            });

            /*
                Warn and return a found one if any.
            */
            if (alreadyDefined) {
                logger.warn(M.target.alreadyDefined(target));
                return alreadyDefined;
            }
        }

        static _checkItems(logger, items) {
            /*
                Checking if items is an array.
            */
            if (!(Array.isArray(items))) {
                logger.error(M.items.bad(items));
            }

            items.forEach((item, i) => {
                if (typeof item === "object" && item !== null) {
                    if (!("title" in item) || !("action" in item)) {
                        /*
                            If item is object, but this object lacks necessary
                            properties.
                        */
                        logger.error(M.items.missSmtn(i));
                    }
                } else if (typeof item === "string") {
                    if (!(item in ContextMenu.Item._specialItems)) {
                        /*
                            If item is string, but this string represents
                            unknown special item.
                        */
                        logger.error(M.items.unknownSpecial(item, i));
                    }
                } else {
                    /*
                        If items is neither object nor string.
                    */
                    logger.error(M.items.notAnItem(item, i));
                }
            });
        }

        static _checkOptions(logger, options) {
            /*
                Checking if options is passed to the ContextMenu constructor and
                that it's an object (but not an array). I wanted initially to
                make options an optional parameter, but it seems like there's no
                way to do so.
            */
            if (typeof options !== "object" && !Array.isArray(options)) {
                logger.error(M.options.bad(options));
            }

            /*
                Here we know for sure that options is the object. So check this
                object for unknown options and warn about any found one.
            */
            Object.keys(options).forEach((option) => {
                if (!Object.keys(this._defaultOptions).includes(option)) {
                    logger.warn(M.options.unknown(option));
                }
            });
        }

        static _proxyOptions(logger, options) {
            /*
                Proxying is necessary to warn user in case of adding an unknown
                option and to provide values for unspecified ones.
            */
            return new Proxy(options, {
                get: (target, prop) => {
                    return prop in target ? target[prop] : this._defaultOptions[prop];
                },

                set: (target, prop, value) => {
                    target[prop] = value;
                    this._checkOptions(logger, target);
                }
            });
        }

        static get _defaultOptions() {
            return {
                name: "",
                disabled: false,
                defaultOnAlt: true,
                closeOnKey: false,
                noRecreate: true,
                transfer: "y",
                verticalMargin: 10,
                callback: {
                    open() {},
                    close() {}
                }
            };
        }
    }

    ContextMenu._instances = [];

    ContextMenu.Logger = class Logger {
        constructor(contextMenuName, debugEnabled) {
            this._name = contextMenuName;
            this._allowed = debugEnabled;
        }

        static get _messages() {
            return {
                prefix: {
                    prefix: "Custom Context Menu",

                    get e() {
                        return `${this.prefix} Error`;
                    },

                    get w() {
                        return `${this.prefix} Warning`;
                    }
                },

                target: {
                    bad(given) {
                        return `target must be an HTMLElement instance, but ${typeof given} is given`;
                    },

                    alreadyDefined(given) {
                        function getTagName() {
                            if (given instanceof HTMLDocument) {
                                return "document"
                            } else {
                                return `${given.tagName}#${given.id ? given.id : "[no-id]"}`;
                            }
                        }

                        return `context menu for ${getTagName()} has already been defined. New instance was not created`
                    },

                    redefinition() {
                        return `a target can not be redefined`
                    }
                },

                items: {
                    bad(given) {
                        return `items must be an array, but ${typeof given} is given`;
                    },

                    missSmtn(index) {
                        return `each item represented by an object must contain "title" and "action" properties, but the item #${index + 1} seems to miss something`;
                    },

                    unknownSpecial(given, index) {
                        return `unknown special item "${given}" (#${index + 1})`;
                    },

                    notAnItem(given, index) {
                        return `each item must be an object or a string, but the item #${index + 1} is ${typeof given}`;
                    }
                },

                options: {
                    bad(given) {
                        return `options must be an object, but ${typeof given === "object" ? "array" : typeof given} is given`;
                    },

                    unknown(given) {
                        return `unknown option "${given}". Will be ignored. Refer to the documentation to find a list of all the available options`;
                    },

                    badName(given) {
                        return `the given name "${given}" of ${typeof given} type can not be converted to string via the standard toString() method. Ignoring`;
                    }
                },

                runtime: {
                    badAction(given, index) {
                        return `each item's action must be a function, but the action of the item #${index + 1} is ${typeof given}. Ignoring`;
                    },

                    badCallback(given, kind) {
                        return `${kind} callback must be a function, but ${typeof given} is given. Ignoring`;
                    }
                }
            };
        }

        log(msg) {
            if (this._allowed) {
                console.info(`${M.prefix.prefix} [${this.name}]: ${msg}`);
            }
        }

        get name() {
            return this._name ? this._name : "unnamed";
        }

        warn(warning) {
            console.warn(`${M.prefix.w} [${this.name}]: ${warning}`);
        }

        error(error) {
            throw `${M.prefix.e} [${this.name}]: ${error}`;
        }
    }

    ContextMenu.Item = class Item {
        constructor(descr, index, contextMenu) {
            this.descr = descr;
            this.index = index;
            this.cm = contextMenu;

            this._buildNode();

            return this._node;
        }

        _buildNode() {
            if (typeof this.descr === "object") {
                this._buildFromObject();
            } else if (typeof this.descr === "string") {
                this._buildFromString();
            }
        }

        _buildFromObject() {
            let text = document.createTextNode(this.descr.title);
            this._node = document.createElement("li");

            this._node.appendChild(text);
            this._node.dataset.cmItem = "";

            this._registerActionEventListener(this.descr.action);
        }

        _buildFromString() {
            let type = ContextMenu.Item._specialItems[this.descr];
            this._node = document.createElement(type);

            this._node.dataset.cmItem = this.descr;
        }

        _registerActionEventListener() {
            /*
                Threshold in 200ms is necessary to avoid "falsy" action
                triggering.
            */
            setTimeout(() => {
                this._node.addEventListener("mouseup", (event) => {
                    try {
                        this.descr.action.call(this.cm);
                    } catch (e) {
                        this.cm.logger.warn(M.runtime.badAction(this.descr.action, this.index))
                    }

                    this.cm.close();
                });
            }, 200);

            this._registerBehaviorEventListener();
        }

        _registerBehaviorEventListener() {
            this._node.addEventListener("mousedown", (event) => {
                event.stopPropagation();
            });

            this._node.addEventListener("contextmenu", (event) => {
                event.stopPropagation();
                event.preventDefault();
            });
        }

        static get _specialItems() {
            return {
                separator: "div"
            }
        }
    }

    /*
        In order to be able to get acces to messages simply by accessing `M`
        instead of passing the full path `ContextMenu.Logger._messages`.
    */
    const M = ContextMenu.Logger._messages;

    return ContextMenu;
}();

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
            this.logger = new ContextMenu.Logger(options.name, debug);

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

            // check items
            // ??? the future structure of items is currently unknown

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
                // this._registerCloseEventListener();
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

        _open(event) {
            /*
                Render an overlay. The overlay is used to track the context menu
                closure and also acts as sort of a grouping element.
                !!! TODO: may be it's better not to use `_` at all but to pass
                overlay, items, etc. as formal parameters?
            */
            this._renderOverlay();

            /*
                !!! TODO: may be `_constructItemElements`?
            */
            this._constructItems();

            /*

            */
            this._prepareCM();

            // // calculate the position of the CM and draw it there
            // var pos = this._calculatePosition(event);
            // this._drawCM(pos);
            //
            // // execute open callback (or a blank function if none)
            // this._getCallback("open")();
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
                                            disaply: block !important;\
                                            left: 0 !important;\
                                            top: 0 !important;\
                                            width: 100vw !important;\
                                            height: 100vh !important;";


            /*
                Instert overlay to the body.
            */
            document.body.appendChild(this._.overlay);
        }

        _constructItems() {
            this._.itemsToRender = this.items.map((item) => {
                return new ContextMenu.Item(item, this)
            });
        }

        _prepareCM() {
            
        }

        static _checkTarget(logger, target) {
            // checking if target is instance of HTMLDocument or HTMLElement
            if (!(target instanceof HTMLDocument) && !(target instanceof HTMLElement)) {
                logger.error(M.target.bad(target));
            }

            // checлing if there is a CM already defined for this target
            let alreadyDefined = this._instances.find((instance) => {
                return instance.target === target;
            });

            // warn and return found one if any
            if (alreadyDefined) {
                logger.warn(M.target.alreadyDefined(target));
                return alreadyDefined;
            }
        }

        static _checkOptions(logger, options) {
            Object.keys(options).forEach((option) => {
                if (!Object.keys(this._defaultOptions).includes(option)) {
                    logger.warn(M.options.unknown(option));
                }
            });
        }

        static _proxyOptions(logger, options) {
            // proxying is necessary to warn user in case of adding unknown option and to provide values for unspecified options
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
                noRecreate: true,
                transfer: true,
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

    ContextMenu.Logger.Messages = {
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
                return `target must be an instance of HTMLDocument or HTMLElement, but ${typeof given} is given`;
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

            notAnItem(given, index) {
                return `each item must be an instance of ContextMenuItem, but the item #${index + 1} is ${typeof given}. Ignoring`;
            }
        },

        options: {
            unknown(given) {
                return `unknown option "${given}". Will be ignored. Refer to the documentation to find a list of all the available options`;
            },

            badName(given) {
                return `the given name "${given}" of ${typeof given} type can not be converted to string via the standard toString() method. Ignoring`;
            }
        }
    }

    ContextMenu.Item = class Item {
        constructor(descr, contextMenu) {
            this._buildNode(descr);

            return this._node;
        }

        _buildNode(descr) {
            if (typeof descr === "object") {
                let text = document.createTextNode(descr.title);
                this._node = document.createElement("li");

                this._node.dataset.cmItem = "";
                this._node.appendChild(text);

                this._registerActionEventListener(descr.action);
            } else if (typeof descr === "string") {
                let type = ContextMenu.Item._specialItems[descr];
                this._node = document.createElement(type);

                this._node.dataset.cmItem = descr;
            }
        }

        _registerActionEventListener(action) {
            this._node.addEventListener("mouseup", (event) => {
                // close all the CMs and then execute the given function
                action();
            }, false);
        }

        static get _specialItems() {
            return {
                separator: "div"
            }
        }
    }

    /*
        In order to be able to get acces to messages simply by accessing `M`
        instead of passing the full path `ContextMenu.Logger.Messages`.
        !!! TODO: may be `Messages` should become a static method of the
        `ContextMenu.Logger`?
    */
    const M = ContextMenu.Logger.Messages;

    return ContextMenu;
}();

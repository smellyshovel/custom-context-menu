// basically this wrapper is necsessary only to enable strict mode
const {ContextMenu, ContextMenuItem} = function() {
    "use strict";

    class ContextMenu {
        constructor(target, items, options, debug) {
            // creating a logger
            this.logger = new ContextMenu.Logger(options.name, debug);

            this.logger.log("creating...");

            // check target for errors. If there is a CM already defined for the same target then return a found instance instead of recreating the CM
            let alreadyDefined = ContextMenu._checkTarget(this.logger, target);
            if (alreadyDefined) return alreadyDefined;

            // check items
            // ??? future structure of items is currently unknown

            // check options for unknown ones and proxy it
            ContextMenu._checkOptions(this.logger, options);
            options = ContextMenu._proxyOptions(this.logger, options);

            // making target, items and options properties of a CM instance to have an access to them in methods
            this.target = target;
            this.items = items;
            this.options = options;

            // freezing the instance to prevent changing of target
            Object.freeze(this);

            // store this instance to prevent "recreating"
            ContextMenu._instances.push(this);

            this.logger.log("created.")
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
                    return prop in target ? prop : this._defaultOptions[prop];
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
                overlay: true,
                noRecreate: true,
                scrolling: false,
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

    class ContextMenuItem{}

    // for shortness
    const M = ContextMenu.Logger.Messages;

    return {ContextMenu, ContextMenuItem};
}();

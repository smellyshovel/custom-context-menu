const ContextMenu = function() {
    "use strict";

    class ContextMenu {
        constructor(target, items, options, debug) {
            // search for a CM already defined for this target
            let alreadyDefined = ContextMenu._instances.find((instance) => {
                return instance.target === target;
            });

            // return found one if any instead of creating a new one
            if (alreadyDefined) return alreadyDefined;

            // getting logger instance
            this.logger = new ContextMenu.Logger(options.name);

            // check arguments before doing anything else
            ContextMenu._checkArguments(this.logger, ...arguments);

            //
            this.target = target;

            // store this instance to prevent "recreating"
            ContextMenu._instances.push(this);
        }

        static _checkArguments(logger, target, items, options) {
            let checkTarget = () => {
                if (!(target instanceof HTMLDocument) && !(target instanceof HTMLElement)) {
                    logger.error(this.Error.target.bad(target));
                }
            }

            let checkItems = () => {
                if (!Array.isArray(items)) {
                    logger.error(this.Error.items.bad(items));
                }

                if (items.length > 0) {
                    items.forEach((item, i) => {
                        if (!(item instanceof ContextMenuItem)) {
                            logger.error(this.Error.items.notAnItem(item, i));
                        }
                    });
                }
            }

            let checkOptions = () => {
                let knownOptions = ["name", "disabled", "defaultOnAlt", "overlay", "noRecreate", "scrolling", "transfer", "callback"];

                Object.keys(options).forEach((option) => {
                    if (!knownOptions.includes(option)) {
                        logger.warn(this.Error.options.unknown(option));
                        // delete options[option];
                    }
                });
            }

            checkTarget();
            checkItems();
            if (options) checkOptions(options);
        }
    }

    ContextMenu._instances = [];

    ContextMenu.Logger = class Logger {
        constructor(contextMenuName) {
            this._name = contextMenuName;
        }

        get name() {
            return this._name ? this._name : "unnamed";
        }

        warn(warning) {
            console.warn(`${ContextMenu.Error.prefix.w} ${warning} [CM: ${this.name}]`);
        }

        error(error) {
            throw `${ContextMenu.Error.prefix.e} ${error} [CM: ${this.name}]`;
        }
    }

    ContextMenu.Error = {
        prefix: {
            prefix: "Custom Context Menu",

            get e() {
                return `${this.prefix} Error:`;
            },

            get w() {
                return `${this.prefix} Warning:`;
            }
        },

        target: {
            bad(given) {
                return `target must be an instance of HTMLDocument or HTMLElement, but ${typeof given} is given`;
            }
        },

        items: {
            bad(given) {
                return `items must be an array, but ${typeof given} is given`;
            },

            notAnItem(given, index) {
                return `each item must be an instance of ContextMenuItem, but the item #${index} is ${typeof given}`;
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

    return ContextMenu;
}();

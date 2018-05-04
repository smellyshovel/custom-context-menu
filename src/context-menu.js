/*
    This wrapper is necessary to enable strict mode.
*/
const ContextMenu = function() {
    "use strict";

    class ContextMenu {
        constructor(target, items, options) {
            /*
                Check target for errors. If there is a CM instance already
                defined for the same target as the one that's being created now
                then return a found instance instead of "recreating" the CM.
            */
            let alreadyDefined = ContextMenu._checkTarget(target);
            if (alreadyDefined) return alreadyDefined;

            /*
                Provide default (fallback) options values by setting the
                prototype of the `options` object to the ::_defaultOptions
                object.
            */
            Object.setPrototypeOf(options, ContextMenu._defaultOptions);

            /*
                Make items and options to be the properties of the CM instance
                to have an access to them in methods and outside. This provides
                a possibility to dinamically add new items and change options.
            */
            this._target = target;
            this.items = items;
            this.options = options;

            /*
                Save the instance to prevent "recreating".
            */
            ContextMenu._instances.push(this);

            /*
                Register the event listener that is responsible for tracking the
                CM invokation.
            */
            this._registerOpeningEventListener();
        }

        _registerOpeningEventListener() {
            let handleCall = (event) => {
                /*
                    Prevent opening of the CMs that are defined for those elements
                    that are below the `this.target` in the DOM.
                */
                event.stopPropagation();

                /*
                    If `defaultOnAlt` is `true` then check whether the alt key was
                    not holded when the event was triggered or if it was. If it was
                    then the code below just won't be executed, i.e. the default
                    context menu will appear. But if `defaultOnAlt` is `false`, then
                    just show a custom context menu in any way.
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
                    if (!this.options.disabled) {
                        this._open(event);
                        this._registerClosureEventListener();
                    }
                }
            };

            /*
                When the `contextmenu` event takes place, handle it first and
                then register the event listener that is responsible for
                tracking the CM closure.
            */

            if (this._target instanceof NodeList) {
                this._target.forEach((target) => {
                    target.addEventListener("contextmenu", (event) => {
                        handleCall(event);

                    });
                })
            } else {
                this._target.addEventListener("contextmenu", (event) => {
                    handleCall(event);
                });
            }
        }

        _registerClosureEventListener() {
            /*
                We need 2 sets of different event listeners to track the context
                menu closure. The first one is used if the `noRecreate` option
                is `true` and the second one if `false`.
            */
            if (this.options.noRecreate) {
                /*
                    If a click happened on the overlay and the click is not the
                    rightclick, then close the context menu. If the click is the
                    rightclick, then it will be handled by the appropriate event
                    listener defined below this if-else block.
                */
                this._overlay.addEventListener("mousedown", (event) => {
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
                this._overlay.addEventListener("mousedown", (event) => {
                    this.close();
                });
            }

            /*
                But it's also necessary to close the context menu if the click
                happened not on the overlay, but over the context menu itself.
                The next 2 event listeners are necessary in order just to close
                the context menu in such case and NOT to recreate it (yeah, even
                if the `noRecreate` option is `false`).

                This part has earlier been in the `else` block. But it became
                obvious that we have to close the context menu on the right
                click over the cm, but not to close it on the left click,
                because there's a need to be able to interact with a scrollbar
                using a mouse cursor (but not only a wheel).
            */
            this._cm.addEventListener("mousedown", (event) => {
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

            this._cm.addEventListener("contextmenu", (event) => {
                event.preventDefault();
                event.stopPropagation();
                this.close();
            });

            /*
                Here we listen to the rightclick anywhere "above" the overlay.
                This event listener is also responsible for hitting the menu
                key, so we check the `closeOnKey` option's state as well.
            */
            this._overlay.addEventListener("contextmenu", (event) => {
                event.stopPropagation();
                event.preventDefault();

                if (!this.options.closeOnKey ? event.which !== 0 : true) {
                    this.close();
                }
            });

            /*
                The event listener responsible for the CM closure on the
                "escape" key press. We only need it to respond once for 2
                reasons: to prevent document event listeners list polluting and
                to avoid fake event triggering after the CM has been closed. It
                means that we must remove it later (in the #close to be exact),
                but to do so we have to save the callback as the property of the
                instance. Using `{once: true}` as the third option is not
                suitable because a user may press some other keys during the
                time the CM is opened, which means that this event will be fired
                and removed even if the user pressed not the "escape" key. And
                this means that he won't be able anymore to close the CM by
                pressing the "escape" key. So we have to remove the event
                listener manually in the #close method.
            */
            this._keyClosureListenerCallback = (event) => {
                if (event.keyCode === 27) {
                    this.close();
                }
            };

            document.addEventListener("keydown", this._keyClosureListenerCallback);
        }

        _open(event) {
            /*
                Render an overlay. The overlay is used to track the context menu
                closure and also acts as sort of a grouping element.
            */
            this._renderOverlay();

            /*
                Build items DOM elements from the .items array.
            */
            this._buildItemElements();

            /*
                Render the invisible context menu in the top left corner of the
                page.
            */
            this._render();

            /*
                Add event listeners that are responsible for hightlighting
                (which happens by focusing on) an item.
            */
            this._regKbNavEL();
            this._regMouseNavEL();

            /*
                Determine where on the page the context menu must appear.
            */
            this._determinePosition(event);

            /*
                Set the correct context menu position (determined earlier with,
                probably, some additions in rare cases).
            */
            this._setPosition();

            /*
                Mark the overlay and the context menu as visible in the right
                position.
            */
            this._markAsVisible();

            /*
                Execute the opening callback.
            */
            this.options.callback.opening.call(this);
        }

        _renderOverlay() {
            /*
                Disable page scrolling via setting the `overflow` CSS property
                to `hidden`. This denies page scrolling (in any form, whether
                the obvious mouse wheel scrolling or a `page down`, `arrow up`,
                and so on).
            */
            document.documentElement.style.overflow = "hidden";

            /*
                Create a div element with `data-cm-overlay` attribute the value
                of which equals the `name` of the context menu (for styling
                purposes).
            */
            this._overlay = document.createElement("div");
            this._overlay.dataset.cmOverlay = this.options.name;

            /*
                Set the necessary styles that are absolutely must be, i.e. those
                that make the overlay what it is and whithout which (or in case
                of redefining of which) the overlay may begin to work
                incorrectly (if work at all).
            */
            this._overlay.style.cssText = "position: fixed !important;\
                                           display: block !important;\
                                           left: 0 !important;\
                                           top: 0 !important;\
                                           width: 100vw !important;\
                                           height: 100vh !important;\
                                           pointer-events: auto !important";

            /*
                Insert the overlay to the end of the body (after all the other
                elements currently presenting in the body).
            */
            document.body.appendChild(this._overlay);
        }

        _buildItemElements() {
            /*
                ._itemElements are all the items that are about to be rendered
                on the page. ._normalItems are those that are not special ones.
                We need such a separation in order to be able to add keyboard
                event listeners only to those items that are used to trigger
                some `action`, but not to, for example, "separators".
            */
            this._itemElements = this.items.map((item) => {
                return new ContextMenu.Item(item, this);
            });

            this._normalItems = this._itemElements.filter((item) => {
                return item.dataset.cmItem === "" || item.dataset.cmItem === "submenu-opener";
            });
        }

        _render() {
            /*
                Create a `div` element with `data-cm` attribute the value of
                which equals the `name` of the CM (for styling purposes also).
            */
            this._cm = document.createElement("div");
            this._cm.dataset.cm = this.options.name;

            /*
                Set the necessary styles that are absolutely must be. These
                styles make the CM what it is.
            */
            this._cm.style.cssText = "position: absolute !important;\
                                      display: block !important;\
                                      left: 0 !important;\
                                      top: 0 !important;\
                                      overflow: hidden;";

            /*
                Create a list which will hold all the items of the CM.
            */
            let list = document.createElement("ol");

            /*
                Populate the list with items.
            */
            this._itemElements.forEach((item) => {
                list.appendChild(item);
            });

            /*
                Insert the list inside the context menu (inside the `div`
                element).
            */
            this._cm.appendChild(list);

            /*
                Insert the context menu inside the overlay.
            */
            this._overlay.appendChild(this._cm);
        }

        _regKbNavEL() {
            /*
                ._focusedItemIndex is the number (index) of the element (item)
                in the ._normalItems array which is being currently focused. Its
                initial state "-1" is used as a starting point, like a note that
                indicates that we should start from the very first/last item
                (depending on what arrow key is pressed), but not to continue
                incrementing/decrementing this value when a key is pressed.
            */
            this._focusedItemIndex = -1;

            /*
                This method is used with the DRY philosophy in mind. You can
                think of it as of any other `ContextMenu.prototype`s regular
                method, but it's defined here for sakes of consistency. It is
                basically just a regular method that can be (and is) shared with
                other classes that might want to use it. Pay attention that it's
                not an arrow function. It's very important.
            */
            this._kbNavigationActualCallback = function(event) {
                /*
                    Each time the arrow up or arrow down key is pressed we
                    determine the item to be focused (or rather it's index) and
                    actually focusing on the relevant item. Preventing defaul
                    behavior is necessary to avoid scrolling of an overflowed
                    context menu. The possibility to focus on an element (item)
                    that is not focusable (sort of) is provided to us thanks to
                    giving the item the `tab-index` attribute during its
                    creation.
                */
                if (event.keyCode === 40) {
                    event.preventDefault();
                    this._focusedItemIndex += this._focusedItemIndex > this._normalItems.length - 2 ? -this._normalItems.length + 1 : 1;
                    this._normalItems[this._focusedItemIndex].focus();
                }

                if (event.keyCode === 38) {
                    event.preventDefault();
                    this._focusedItemIndex = this._focusedItemIndex < 1 ? this._normalItems.length - 1 : this._focusedItemIndex - 1;
                    this._normalItems[this._focusedItemIndex].focus();
                }

                /*
                    However providing the item a `tab-index` attribute also
                    gives a user an ability to navigate through the menu using
                    the "tab" key. That is undesired, so here we disable such a
                    behavior by preventing the default action of the "tab" key.
                */
                if (event.keyCode === 9) {
                    event.preventDefault();
                }
            };

            /*
                3 additional lines of code here allow us to save more than 10
                times more of the CSM code. This keyboard navigation listener's
                callback is saved (is not an anonymous arrow function) for 2
                reasons: first of all to be able to remove it later during the
                CM closure process, and the second is to be able to remove it
                after a CSM opening. Why it is necessary you can find more about
                in the CSM's source.
            */
            this._kbNavigationListenerCallback = (event) => {
                this._kbNavigationActualCallback.call(this, event);
            }

            /*
                Register the event listener itself.
            */
            document.addEventListener("keydown", this._kbNavigationListenerCallback);
        }

        _regMouseNavEL() {
            /*
                Accessebility is a great thing, but we shouldn't forget about
                normal users as well. If a user hovers the mouse over any item
                (one of normal, i.e. excluding the special ones) it gets
                focused and the ._focusedItemIndex variable's value from this
                point holds the index of the focused item. That means that if
                the user than stops his mouse and starts navigating using a
                keyboard, then the next highlighted item is gonna be the one
                that is after/before (depending on which key was pressed) the
                one that's currently being focused (with mouse). But if the user
                moved a mouse out of any item (for example hovering a special
                item), then the prviously focused item gets blurred and if he'll
                press a key up or key down the first/last item will become
                focused. I decided to listen for mouse movement on the overlay
                so there'll be more chances that moving the mouse out of an item
                will lead to blurring, than it was with the ._cm as a
                `addEventListener`s target. However, such approach affects
                perfomance (not so much that it can be noticed though).
            */

            this._normalItems.forEach((item, i) => {
                item.addEventListener("mousemove", (event) => {
                    this._focusedItemIndex = i;
                    item.focus();
                });

                item.addEventListener("mouseleave", (event) => {
                    this._focusedItemIndex = -1;
                    item.blur();
                });
            });
        }

        _determinePosition(event) {
            /*
                Where the click actually happened (viewport relative).
            */
            let clickedX = event.clientX,
                clickedY = event.clientY,

                /*
                    The width and height of the viewport equals the width and
                    height of the overlay because the overlay's `width` and
                    `height` CSS proerties have been set using `vw` and `vh`.
                    I don't remember why you can't use something like
                    `window.inner(Width|Height)` here, but trust me, this
                    approach is way better and more reliable.
                */
                viewportWidth = this._overlay.getBoundingClientRect().width,
                viewportHeight = this._overlay.getBoundingClientRect().height,

                /*
                    The width and height of the yet invisible context menu. By
                    the way, this is the reason of why it was necessary to
                    render the CM before (even though invisible).
                */
                cmWidth = this._cm.getBoundingClientRect().width,
                cmHeight = this._cm.getBoundingClientRect().height,

                /*
                    "Furthest" means the bottom right point of the context menu.
                */
                furthestX = clickedX + cmWidth,
                furthestY = clickedY + cmHeight;

                /*
                    The resulting position is initially equal to the coordinates
                    where the click happened.
                */
                this._position = {x: clickedX, y: clickedY};

            /*
                But if it's obvious that the context menu won't fit on the page,
                than transfer it if necessary, or simply force it to fit by
                setting it's position so the context menu will be rendered right
                in the corner (the case of the `transfer` option set to
                `false`).
            */
            if (furthestX > viewportWidth) {
                if (this.options.transfer === "both" || this.options.transfer === "x") {
                    this._position.x -= cmWidth;
                } else {
                    this._position.x = viewportWidth - cmWidth;
                }
            }

            if (furthestY > viewportHeight) {
                if (this.options.transfer === "both" || this.options.transfer === "y") {
                    this._position.y -= cmHeight;
                } else {
                    this._position.y = viewportHeight - cmHeight;
               }
            }
        }

        _setPosition() {
            /*
                Setting the `x` coordinate. We have nothing to do with it, so
                it's OK just to set it as it is (because it has been previously
                determined).
            */
            this._cm.style.left = `${this._position.x}px`;

            /*
                For shortness later on. Familiar approach of getting the
                viewport height. `cmBottom` holds the coordinate of the bottom
                edge of the CM. `verticalMargin` is basically just an alias.
            */
            let viewportHeight = this._overlay.getBoundingClientRect().height,
                cmBottom = this._cm.getBoundingClientRect().bottom,
                verticalMargin = this.options.verticalMargin;

            /*
                If the `y` coordinate is above the top screen side (because the
                context menu has too many items and/or it has been transfered)
                then force the menu to be rendered in screen bounds, i.e make
                it's top edge's coordinate to be below the top screen (viewport)
                side for the `verticalMargin` amount of pixels.
            */
            if (this._position.y < 0) {
                /*
                    If the context menu now doesn't fit the height of the
                    viewport (that is almost always the case, becase we
                    previosly transfered the menu due to that reason), then we
                    shrink it, add arrows and enable a scrollbar (for now, may
                    be the scrollbar will be replaced with some other sort of
                    interaction (scrolling) in the future). This `if` condition
                    can not be combined with the previous one via the `&&`
                    because of incorrect `else` statement handling.
                */
                if (cmBottom > viewportHeight) {
                    /*
                        Setting the `y` position including the `verticalMargin`
                        and restricting the height of the context menu (also
                        including the `verticalMargin`).
                    */
                    this._cm.style.top = `${verticalMargin}px`;
                    this._cm.style.maxHeight = `${viewportHeight - verticalMargin * 2}px`;

                    /*
                        Prepare the "up" and "down" arrows.
                        `data-cm-item="arrow"` attribute may also be treated as
                        "special", but we don't add it to the list of allowed
                        specials because we don't want a user to use arrows
                        anywhere else (among items). We also use the same
                        identidier for both "up" and "down" because they will
                        probably be styled the identical. It's still possible to
                        overcome this restriction though.
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
                        Insert the arrows as the first and the last elements of
                        the context menu (around the actual menu that is the
                        `ol` element).
                    */
                    this._cm.insertBefore(arrowUp, this._cm.firstChild);
                    this._cm.appendChild(arrowDown);

                    /*
                        Now the the actual menu (`ol` element) is the second
                        element in the context menu (`div` element). Getting
                        the height of the `div` element and the height of the
                        two arrows for further calculations. Remember that the
                        arrows may still be styled independently one from
                        another, i.e. they may have different heights, so it's
                        good practice not to just multiply the height of the
                        first one by 2, but to encounter heights of the both.
                    */
                    let menu = this._cm.children[1],
                        cmHeight = this._cm.getBoundingClientRect().height,
                        arrowUpHeight = arrowUp.getBoundingClientRect().height,
                        arrowDownHeight = arrowDown.getBoundingClientRect().height;

                    /*
                        Restricting the actual menu's height to be the height
                        of the `div` element minus the height of the 2 arrows
                        and enabling a scrollbar to have access to all of the
                        items via scrolling.
                    */
                    menu.style.maxHeight = `${cmHeight - arrowUpHeight - arrowDownHeight}px`;
                    menu.style.overflow = "auto";
                }
            } else {
                /*
                    If the context menu fits on the page well, then just
                    explicitly set it's position to the earlier determined
                    without any tweaking.
                */
                this._cm.style.top = this._position.y + "px";
            }
        }

        _markAsVisible() {
            /*
                Here we can finally mark the CM as visible by respectively
                setting it's class attribute. Notice, that the CM has actually
                always been visible. The thing is that all the calculations
                happen so fast, that a user simply isn't able to notice the CM
                movement from the top left corner to the right position. This
                `visible` mark is necessary to give the user an ability to
                animate the appearance of the CM (for example using the CSS
                `opacity` property).
            */
            this._overlay.className = "visible";
            this._cm.className = "visible";
        }

        close() {
            /*
                Removing the overlay (which is the core of this method) may seem
                enough to close all the nested CSMs, but if we want the closing
                transitions of a CSM to work, then we have to invoke the CSM's
                #close method manually.
            */
            if (this._openedCSM) {
                this._openedCSM.close();
            }

            /*
                Restore the initial `overflow` CSS property's value.
            */
            document.documentElement.style.overflow = "";

            /*
                Remove the "escape" key press event listener.
            */
            document.removeEventListener("keydown", this._keyClosureListenerCallback);

            /*
                Remove the keyboard navigation event listener.
            */
            document.removeEventListener("keydown", this._kbNavigationListenerCallback);

            /*
                Remove "visible" class from the CM and the overlay. First of all
                that will trigger the transitions and secondly without that the
                next two variables would have incorrect values.
            */
            this._cm.className = "";
            this._overlay.className = "";

            /*
                Get the durations of transitions. If there's no transition then
                the variable's value will be `0`.
            */
            let cmTransDur = parseFloat(getComputedStyle(this._cm).transitionDuration),
                overlayTransDur = parseFloat(getComputedStyle(this._overlay).transitionDuration);

            /*
                If either the CM or the overlay has the transition then its
                duration is more than 0 for sure. Such way we determine whether
                the transition is applied to the element.
            */
            if (cmTransDur > 0 || overlayTransDur > 0) {

                /*
                    If the overlay becomes "invisible" faster than the CM then
                    there's no need to remove the CM first. It's enough just to
                    wait until the CM's transition is overed and then delete the
                    overlay (thereby deleting the CM itself, because it's a
                    child of the CSM). But if the overlay becomes "invisible"
                    after the CM than we have to remove the CM after it became
                    "invisible" (in order to prevent interaction with it) and
                    remove the overlay only after it itself became "invisible".
                */
                if (cmTransDur >= overlayTransDur) {
                    this._cm.addEventListener("transitionend", (event) => {
                        this._overlay.remove();
                    });
                } else {
                    this._cm.addEventListener("transitionend", (event) => {

                        /*
                            Both event listeners' callbacks will be fired at the
                            same time if we don't stop propagation of this
                            event.
                        */
                        event.stopPropagation();
                        this._cm.remove();
                    });

                    this._overlay.addEventListener("transitionend", (event) => {
                        this._overlay.remove();
                    });
                }
            } else {

                /*
                    If there're no transitions applied to both of the elements
                    then we can safely remove just the overlay right in time
                    (thereby removing the CM).
                */
                this._overlay.remove();
            }

            /*
                Execute the closure callback.
            */
            this.options.callback.closure.call(this);
        }

        static _checkTarget(target) {
            /*
                Checking if there is an already defined for this target context
                menu.
            */
            let alreadyDefined = this._instances.find((instance) => {
                return instance._target === target;
            });

            /*
                Warn and return a found one if any.
            */
            if (alreadyDefined) {
                return alreadyDefined;
            }
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
                    opening() {},
                    closure() {}
                }
            };
        }
    }

    /*
        The static property that holds all the instances of the ContextMenu to
        prevent recreating.
    */
    ContextMenu._instances = [];

    ContextMenu.Item = class Item {
        constructor(descr, contextMenu) {
            /*
                Store the description and the CM that this item belongs to as
                properties of the instance in order to have access to them in
                methods.
            */
            this._descr = descr;
            this._cm = contextMenu;

            /*
                Actually build the DOM node relying on the provided description
                (the object that describes the item).
            */
            this._buildNode();

            /*
                Return the built node as a ready-to-use DOM element.
            */
            return this._node;
        }

        _buildNode() {
            /*
                The description may take one of two forms: an object and a
                string. Using object a user defines custom items, and using
                string he defines "special" items like "separator". Therefore
                there're 2 deffirent ways of building the item.
            */
            if (typeof this._descr === "object") {
                this._buildFromObject();
            } else if (typeof this._descr === "string") {
                this._buildFromString();
            }
        }

        _buildFromObject() {
            /*
                If an object is provided as the description of the item, then we
                must create a `li` element with the text provided by the `title`
                property of the description object, add empty `data-cm-item`
                attribute to it and register the event listener responsible for
                tracking the action call. `tabIndex` attribute gives us a
                possibility to focus on the item (which is used basically for
                every tyoe of interaction with the item).
            */
            let text = document.createTextNode(this._descr.title);
            this._node = document.createElement("li");
            this._node.tabIndex = 0;

            this._node.appendChild(text);
            this._node.dataset.cmItem = "";

            this._registerActionEventListener();
        }

        _buildFromString() {
            /*
                If a string is provided as the description of the item, then
                this item must be trated as a special one. The (extensible) list
                of all the available special items is stored in the
                ::_specialItems static property. The elements that represent
                certain special items are also stored in there. Special items
                don't have actions attached to them so there's no need to add
                appropriate event listener (as it is in case of building the
                item from an object).
            */
            let type = ContextMenu.Item._specialItems[this._descr];
            this._node = document.createElement(type);

            this._node.dataset.cmItem = this._descr;
        }

        _registerActionEventListener() {
            /*
                Listen to `mouseup` (whether left of right button) and trigger
                the action attached to the item. Threshold in 200ms is necessary
                to avoid "falsy" action triggering. 200 is just an approximate
                value. More research is needed to establish the value more
                accurately.
            */
            setTimeout(() => {
                this._node.addEventListener("mouseup", (event) => {
                    this._descr.action.call(this._cm);
                    this._cm.close();
                });
            }, 200);

            /*
                Action triggering must also happen on "enter" key press.
            */
            this._node.addEventListener("keydown", (event) => {
                if (event.keyCode === 13) {
                    this._descr.action.call(this._cm);
                    this._cm.close();
                }
            });

            /*
                We must also register some other event listeners that are
                responsible for correct CM closure handling.
            */
            this._registerBehaviorEventListener();
        }

        _registerBehaviorEventListener() {
            /*
                `action` triggers on `mouseup` event. But the `mousedown` and
                `contextmenu` events happen before the `mouseup`. It means that
                these events will bubble up the DOM tree and will soon or later
                lead to the CM closure. So we have to stop event propagation in
                order to prevent such behavior. This is why this method is named
                so.
            */
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

    return ContextMenu;
}();

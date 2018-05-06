/*
    This wrapper is necessary to enable strict mode.
*/
const ContextMenu = function() {
    "use strict";

    class ContextMenu {
        constructor(target, items, options) {
            /*
                Provide default (fallback) options values by setting the
                prototype of the `options` object to the ::_defaultOptions one.
                Thus if an option's value is `undefined` it will be taken from
                from the prototype.
            */
            if (typeof options === "object") {
                Object.setPrototypeOf(options, ContextMenu._defaultOptions);
            } else {
                options = ContextMenu._defaultOptions;
            }

            /*
                Make `items` and `options` to be the properties of the instance
                in order to have an access to them in methods and outside. This
                also provides a possibility to dinamically add new items and change
                options.
            */
            this.items = items;
            this.options = options;

            /*
                Register the event listener that is responsible for tracking the
                CM invokation.
            */
            this._regOpeningEL(target);
        }

        _regOpeningEL(target) {
            /*
                Put a callback in a separate function то avoid code duplication.
            */
            let handleCall = (event) => {
                /*
                    Prevent opening of the CMs that are defined for those
                    elements that are below the target in the DOM.
                */
                event.stopPropagation();

                /*
                    If the "nativeOnAlt" option is true then check whether the
                    "alt" key was not holded when the event occurred or if it
                    was. If it was then the code below just won't be executed,
                    i.e. the browser's native context menu will appear. But if
                    the "nativeOnAlt" is false then prevent the native context
                    menu appearance and open the custom one.
                */
                if (this.options.nativeOnAlt ? event.altKey === false : true) {
                    event.preventDefault();

                    /*
                        Open the CM if it's not `disabled` and register the
                        event listener that is responsible for tracking the CM
                        closure.
                    */
                    if (!this.options.disabled) {
                        this._open(event);
                        this._regClosureEL();
                    }
                }
            };

            /*
                If the target is a collection of DOM elements then register the
                event listener for each of them. If it's a single element then
                register directly for this element.
            */
            if (target instanceof NodeList) {
                target.forEach((target) => {
                    target.addEventListener("contextmenu", (event) => {
                        handleCall(event);
                    });
                })
            } else {
                target.addEventListener("contextmenu", (event) => {
                    handleCall(event);
                });
            }
        }

        _regClosureEL() {
            if (this.options.penetrable) {
                /*
                    If the overlay of the CM is `penetrable` for right-clicking
                    through it (so a new CM might be immediately opened) then,
                    because the "mousedown" event is triggered before the
                    "contextmenu", we must first close the CM on any kind of
                    click, so when the "contextmenu" event will be triggered, it
                    will be triggered not on the overlay (therefore ignored as
                    you'll see later), but on some DOM element, causing the
                    opening of the new CM.
                */
                this._overlay.addEventListener("mousedown", (event) => {
                    this.close();
                });
            } else {
                /*
                    But if the overlay is impenetrable, then we close the CM on
                    any king of click (except for right click), therefore
                    enforcing the rightclick to be handled via the other
                    (the beneath one) event listener.
                */
                this._overlay.addEventListener("mousedown", (event) => {
                    if (event.which !== 3) {
                        this.close();
                    }
                });
            }

            /*
                This event might only be triggered if the overlay is
                impenetrable and if it has been right-clicked. The CM is not yet
                closed, so we have to do it here preventing the native CM from
                appearing and stopping event's propagation by the way. Stopping
                the event's propagation is necessary because if we don't do so
                then a CM attached to the overlay will appear (and as you know
                there might be no CM attached to the overlay, so the event will
                bubble up the DOM and will most probably trigger the `document`s
                CM opening (if there's a CM attached to `document` or
                `document.documentElement`)). The reason why don't we put these
                event listener registration directly into the `else` block is
                because the "contextmenu" event is also fired whenever the
                "menu" key is pressed (the one that you've probably never
                touched since buying your keyboard). So disabling the CM closure
                on this key press must happen for both types of CMs (whether
                its overlay is penetrable or not).
            */
            this._overlay.addEventListener("contextmenu", (event) => {
                event.stopPropagation();
                event.preventDefault();

                if (event.which !== 0) {
                    this.close();
                }
            });

            /*
                If the click happened not on the overlay but on the CM itself
                then it will bubble up to the overlay which will lead to the CM
                closure, so we have to cancel the bubbling. It's a bad idea to
                let the CM to be closed in such case because it would become
                impossible to interact with a scrollbar (that appears if the CM
                is overflowed) using a mouse.
            */
            this._cm.addEventListener("mousedown", (event) => {
                event.stopPropagation();
            });

            /*
                But it's rather a good idea to close the CM if it has been
                right-clicked. This might also be useful for mobile devises.
                Stopping the propagation is necessary to avoid the #close method
                double invocation (otherwise this event will invoke the #close,
                and then the event will bubble to the overlay which will also
                lead to the #close invocation).
            */
            this._cm.addEventListener("contextmenu", (event) => {
                event.preventDefault();
                event.stopPropagation();
                this.close();
            });

            /*
                The event listener responsible for tracking the CM closure on
                the "escape" key press. We save the callback as a `this`
                instance's property for 2 reasons: first of all it must be
                removed after the CM will become closed (check the #close method
                for explanations of why) and secondly because it's necessary for
                sub-menues proper closing.
            */
            this._keyClosureLC = (event) => {
                if (event.keyCode === 27) {
                    this.close();
                }
            };

            document.addEventListener("keydown", this._keyClosureLC);
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
                Render the CM in the top left corner of the page (because its
                position is undetermined yet).
            */
            this._render();

            /*
                Add event listeners that are responsible for hightlighting
                (which happens by focusing on) items. Split the keyboard
                navigation apart from the mouse navigation due to keep things
                simple with CSMs.
            */
            this._regKbNavEL();
            this._regMouseNavEL();

            /*
                Now it's a good time to determine where on the page a user will
                actually see the CM. We couldn't do it earlier because the
                determination is based on the CM's actual dimensions, so we had
                to render it first (albeit at a wrong position).
            */
            this._determinePosition(event);

            /*
                Set the correct CM position (the determined earlier one) and
                adjust it if necessary.
            */
            this._setAndAdjustPosition();

            /*
                Here we can finally mark the CM and the overlay as visible by
                respectively setting their class attributes. Notice, that the
                CM has in fact always been visible (as well as the overlay).
                The thing is that all the computations happen so fast, that a
                user simply isn't able to notice the CM movement from the top
                left corner to its correct (determined) position. This `visible`
                class serves simply as a mark that gives the user an ability to
                animate the appearance of the CM (for example using the CSS
                `opacity` property and transitions).
            */
            this._overlay.className = "visible";
            this._cm.className = "visible";

            /*
                Execute the opening callback.
            */
            this.options.callback.opening.call(this);
        }

        _renderOverlay() {
            /*
                Disable page scrolling via setting the <html> element's
                `overflow` CSS property to `hidden`. This denies page scrolling
                (in any form, whether the obvious mouse wheel scrolling or a
                `page down`, `arrow up` key presses, and so on). It's not
                necessary, but is rather probably desirable.
            */
            document.documentElement.style.overflow = "hidden";

            /*
                Create a div element with `data-cm-overlay` attribute the value
                of which equals the `name` of the CM (for styling purposes).
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
                elements currently presenting there).
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
                return !item.dataset.cmItemSpecial;
            });
        }

        _render() {
            /*
                Create a `div` element with `data-cm` attribute the value of
                which equals the `name` of the CM (for styling purposes).
            */
            this._cm = document.createElement("div");
            this._cm.dataset.cm = this.options.name;

            /*
                Set the necessary styles that are absolutely must be. These
                styles make the CM to be what it is.
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
                Populate the list with items (keeping the order in which they
                are defined).
            */
            this._itemElements.forEach((item) => {
                list.appendChild(item);
            });

            /*
                Insert the list into the `div[data-cm]` element.
            */
            this._cm.appendChild(list);

            /*
                Insert the prepared CM into the overlay.
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
                incrementing/decrementing this value when a key is pressed. "-1"
                also indicates that none of the items is currently selected.
            */
            this._focusedItemIndex = -1;

            /*
                This method is used with the DRY philosophy in mind. You can
                think of it as of any other `ContextMenu.prototype`s regular
                method, but it's defined here for sakes of consistency. It is
                basically just a regular method that can be (and is) shared with
                other classes that might want to use it. Pay attention that it's
                not an arrow function. It's very important. "AC" stands for
                "actual callback".
            */
            this._kbNavigationAC = function(event) {
                /*
                    Each time the "arrow up" or "arrow down" key is pressed we
                    determine the item to be focused (or rather it's index) and
                    actually focusing on the relevant item. Preventing default
                    behavior is necessary to avoid scrolling of an overflowed
                    context menu. The possibility to focus on an element (item)
                    that is not focusable (by default) is provided to us thanks
                    to giving the item the `tab-index` attribute during its
                    creation.
                */
                if (event.keyCode === 40) { // "arrow down"
                    event.preventDefault();
                    this._focusedItemIndex += this._focusedItemIndex > this._normalItems.length - 2 ? -this._normalItems.length + 1 : 1;
                    this._normalItems[this._focusedItemIndex].focus();
                }

                if (event.keyCode === 38) { // "arrow up"
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
                callback is saved (is not an anonymous arrow callback function)
                for 2 reasons: first of all is to be able to remove it later
                during the CM closing process, and the second is to be able to
                remove it after a CSM opening. Why it is necessary you can find
                more about in the CSM's source.
            */
            this._kbNavigationLC = (event) => {
                this._kbNavigationAC.call(this, event);
            }

            /*
                Register the event listener itself.
            */
            document.addEventListener("keydown", this._kbNavigationLC);
        }

        _regMouseNavEL() {
            /*
                Accessebility is a great thing, but we shouldn't forget about
                normal users as well. If a user hovers the mouse over any item
                (one of normal, i.e. excluding the special ones) it gets
                focused and the ._focusedItemIndex variable's value from this
                point holds the index of the focused item. That means that if
                the user then stops his mouse and starts navigating using a
                keyboard, then the next highlighted item is gonna be the one
                that is after/before (depending on which key was pressed) the
                one that's currently being focused (with mouse). But if the user
                moved a mouse out of any item (for example hovering a special
                item), then the previously focused item gets blurred and if
                he'll press a "key up" or "key down" the first/last item will
                become focused (instead of the next/previous one). I decided to
                listen for mouse movement on the overlay (but not on the CM) so
                there'll be more chances that moving the mouse out of an item
                will lead to blurring, than it was with the ._cm as an
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
                    The width and the height of the CM. By the way, this is the
                    reason of why it is necessary to render the CM first and
                    only then determine its position.
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
                But if it's obvious that the CM won't fit on the page, then
                either transfer it or simply force it to fit (depending on the
                "transfer" option's state) by setting its position so the CM
                will be rendered right in the corner (the case of the `transfer`
                option set to `false`) of the page.
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

        _setAndAdjustPosition() {
            /*
                Setg the `x` coordinate. We have nothing to do with it, so it's
                OK just to set it as it is (because it has been previously
                determined).
            */
            this._cm.style.left = `${this._position.x}px`;

            /*
                If the `y` coordinate is above the top screen side (because the
                CM has too many items and/or it has been transfered)...
            */
            if (this._position.y < 0) {
                /*
                    For shortness later on. Familiar approach of getting the
                    viewport's height. `cmBottom` holds the coordinate of the
                    bottom edge of the CM. `verticalSpacing` is basically just
                    an alias.
                */
                let viewportHeight = this._overlay.getBoundingClientRect().height,
                    cmBottom = this._cm.getBoundingClientRect().bottom,
                    verticalSpacing = this.options.verticalSpacing;

                /*
                    ...and if the CM doesn't fit the height of the viewport
                    (that is always the case, becase we've previosly transfered
                    it due to that reason or the CM has too many items), then we
                    shrink it, add arrows and enable a scrollbar (for now, may
                    be the scrollbar will be replaced with some other sort of
                    interaction (scrolling) in the future). This `if` condition
                    can not be combined with the previous one via the `&&`
                    because of incorrect `else` statement handling.
                */
                if (cmBottom > viewportHeight) {
                    /*
                        Set the `y` position including the `verticalSpacing` and
                        restrict the height of the CM (also including the
                        `verticalSpacing`).
                    */
                    this._cm.style.top = `${verticalSpacing}px`;
                    this._cm.style.maxHeight = `${viewportHeight - verticalSpacing * 2}px`;

                    /*
                        Prepare the "up" and "down" arrows.
                        `data-cm-item-special="arrow"` attribute may be treated
                        as "special", but we don't add it to the list of allowed
                        specials because we don't want a user to use arrows
                        anywhere else (among items for example).
                    */
                    let arrowUp = document.createElement("div");
                    arrowUp.dataset.cmItemSpecial = "arrow up";

                    let arrowDown = document.createElement("div");
                    arrowDown.dataset.cmItemSpecial = "arrow down";

                    /*
                        Insert the arrows as the first and the last elements of
                        the CM (around the actual menu that is the `ol`
                        element).
                    */
                    this._cm.insertBefore(arrowUp, this._cm.firstChild);
                    this._cm.appendChild(arrowDown);

                    /*
                        Now the the actual menu (`ol` element) is the second
                        child of the CM (`div` element). Get the height of the
                        `div` element and the height of the two arrows for
                        further calculations. Remember that the arrows may be
                        styled independently one from another, i.e. they may
                        have different heights, so it's a good practice not to
                        just multiply the height of the first (or last) one by
                        2, but to encounter heights of the both.
                    */
                    let menu = this._cm.children[1],
                        cmHeight = this._cm.getBoundingClientRect().height,
                        arrowUpHeight = arrowUp.getBoundingClientRect().height,
                        arrowDownHeight = arrowDown.getBoundingClientRect().height;

                    /*
                        Limit the actual menu's height to be the height of the
                        `div` element minus the height of the 2 arrows and
                        enable a scrollbar to be able to reach any item via
                        scrolling.
                    */
                    menu.style.maxHeight = `${cmHeight - arrowUpHeight - arrowDownHeight}px`;
                    menu.style.overflow = "auto";
                }
            } else {
                /*
                    If the CM fits on the page well, then just explicitly set
                    it's position to the earlier determined without any
                    adjustments.
                */
                this._cm.style.top = `${this._position.y}px`;
            }
        }

        close() {
            /*
                Removing the overlay (which is the core of this method) may seem
                enough to close all the nested CSMs, but if we want the closing
                transitions of an opened CSM to work, then we have to invoke the
                CSM's #close method manually.
            */
            if (this._openedCSM) {
                this._openedCSM.close();
            }

            /*
                Restore the initial <html> element's `overflow` CSS property's
                value by setting it to empty string.
            */
            document.documentElement.style.overflow = "";

            /*
                Removing the "escape" key press event listener is necessary to
                avoid document's event listeners list possuting and to prevent
                the event triggering after the CM has already been closed.
            */
            document.removeEventListener("keydown", this._keyClosureLC);

            /*
                The same applies to the keyboard navigation listener.
            */
            document.removeEventListener("keydown", this._kbNavigationLC);

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
            if (!this.options.penetrable && (cmTransDur > 0 || overlayTransDur > 0)) {
                /*
                    If the overlay becomes "invisible" faster than the CM then
                    there's no need to remove the CM first. It's enough just to
                    wait until the CM's transition is overed and then delete the
                    overlay (thereby deleting the CM itself, because it's a
                    child of the overlay). But if the overlay becomes
                    "invisible" after the CM then we have to remove the CM after
                    it became "invisible" (in order to prevent interaction with
                    it) and remove the overlay only after it itself became
                    "invisible".
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
                    (thereby removing the CM). The overlay is also removed
                    without waiting for transitions ends if the overlay is
                    impenetrable. This is due to the mechanics of the CM closing
                    events detection.
                */
                this._overlay.remove();
            }

            /*
                Execute the closure callback.
            */
            this.options.callback.closure.call(this);
        }

        static get _defaultOptions() {
            return {
                name: "",
                disabled: false,
                nativeOnAlt: true,
                penetrable: false,
                transfer: "y",
                verticalSpacing: 10,
                callback: {
                    opening() {},
                    closure() {}
                }
            };
        }
    }

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
            this._node.dataset.cmItem = this._descr.title;

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

            this._node.dataset.cmItemSpecial = this._descr;
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

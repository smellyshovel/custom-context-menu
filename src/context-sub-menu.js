/*
    Self-invoking anonymous function acts as a wrapper used to enable the strict
    mode.
*/
void function() {
    "use strict";

    /*
        When this file ("context-sub-menu.js") is linked to a page it means that
        a user will most likely use nested menues, or sub menues (CSMs) in other
        words. That means that some of the items of the root CM (the parent CM
        for all of the nested ones) might be used to call a CSM, so we need some
        other ways of interaction with those items. By the way, I also call such
        items "callers" because they are used to call nested menues. All the
        item's event listeners are registered in the #_buildFromObject method of
        the `ContextMenu.Item`s prototype. So if redefine this method to do
        something else here, then it will override the earlier-defined
        "instance" of this method, and anytime the instance of the
        `ContextMenu.Item` invokes the method, it will actually invoke this
        overridden "version" of the method.
    */
    ContextMenu.Item.prototype._buildFromObject = function() {
        /*
            The beginning is the same as in the "context-menu.js" file.
        */
        let text = document.createTextNode(this._descr.title);
        this._node = document.createElement("li");
        this._node.tabIndex = 0;

        this._node.appendChild(text);
        this._node.dataset.cmItem = this._descr.title;

        /*
            The interesting part goes here. If the `action` property of the
            description object is instance of `ContextMenu.Sub`, then it means
            that a user wants to open a nested menu using the item.
        */
        if (this._descr.action instanceof ContextMenu.Sub) {
            /*
                So in this case we must register some different from the typical
                case event listeners. These ones are described in the
                #_regSubOpenEL method. We do also assign a
                `data-cm-item-caller=""` attribute so the user may then add some
                styles to those items that are used to open CSMs.
            */
            this._node.dataset.cmItemCaller = "";
            this._regSubOpeningEL();
        } else {
            /*
                But if this file is linked to the page it doesn't yet mean that
                each of the items will serve as a caller. There also might (and
                probably will) be normal items. So if the item is not an
                instance of `ContextMenu.Sub` (but it's still an object,
                remember?) then it must be treated as usual.
            */
            this._regActionEL(this._descr.action);
        }
    };

    ContextMenu.Item.prototype._regSubOpeningEL = function() {
        /*
            `subMenu` is the CSM that is attached to the caller. `delay` is the
            amount of time before the CSM can actually be opened if the opening
            was triggered by the `mouseenter` event.
        */
        let subMenu = this._descr.action,
            delay = subMenu.options.delay.opening,
            timer = null;

        /*
            Start counting for the `delay` amount of milliseconds after a mouse
            entered the caller before the CSM will be opened. Because the
            "mousemove" event is fired continuosly multiple timers might be
            defined. That is undesired, so check if there isn't set an opening
            timer already before setting a new one. Note that `clearTimeout`
            function doesn't actually nulls the `timer` variable, that is why
            it's necessary to null it manually (see the code beneath).
        */
        this._node.addEventListener("mousemove", (event) => {
            if (!timer) {
                timer = setTimeout(() => {
                    subMenu._open(this._cm, this._node);
                }, delay);
            }
        });

        /*
            But if the mouse leaves the caller for some reason (or the "arrow
            up/down" key is pressed) then we must stop counting by clearing the
            timer to prevent the CSM from being opened even if a user just
            accidentially touched the caller with his mouse.
        */
        this._node.addEventListener("blur", (event) => {
            clearTimeout(timer);
            timer = null;
        });

        /*
            Immediately open the CSM if the user clicked (no matter which
            button) on the caller.
        */
        this._node.addEventListener("mousedown", (event) => {
            clearTimeout(timer);
            timer = null;

            subMenu._open(this._cm, this._node);
        });

        /*
            Open the CSM on "enter" or "arrow right" key press.
        */
        this._node.addEventListener("keydown", (event) => {
            clearTimeout(timer);
            timer = null;

            if (event.keyCode === 13 || event.keyCode === 39) {
                subMenu._open(this._cm, this._node, true);
            }
        });

        /*
            Behavior events listeners are also necessary to prevent a parent
            CM closure on `mousedown` and `contextmenu` events (i.e. on left &
            right clicks on the caller).
        */
        this._regBehaviorEL();
    };

    ContextMenu.Sub = class Sub {
        constructor(items, options) {
            /*
                Provide default (fallback) options values by setting the
                prototype of the `options` object to the ::_defaultOptions one.
                Thus if an option's value is `undefined` it will be taken from
                from the prototype.
            */
            Object.setPrototypeOf(options, ContextMenu.Sub._defaultOptions);

            /*
                Make `items` and `options` to be the properties of the instance
                in order to have an access to them in methods and outside. This
                also provides a possibility to dinamically add new items and
                change options.
            */
            this.items = items;
            this.options = options;
        }

        _open(parent, caller, keyTriggered) {
            /*
                If there's no opened CSM already at this point (the point of the
                CSM opening) then the `if` block below will just be skipped and
                a new one will be opened. But if there's one that has already
                been opened then we check whether the currently opening CSM is
                the same as the already opened one. If it's so then we just do
                nothing (don't open another instance of the same CSM). But if
                the already opened CSM is different from the one that is
                currently opening then we close the opened one and open this
                one.
            */
            if (parent._openedCSM) {
                if (parent._openedCSM !== this) {
                    parent._openedCSM.close();
                } else {
                    /*
                        This part only takes place if the CSM is opened and the
                        mouse returns to the caller. In such case we should
                        reset the ._focusedItemIndex property, so when "arrow
                        up" or "arrow down" key is pressed the first/last item
                        of the CSM is highlighted, but not the next/previous
                        (counting from the previously highlighted) one.
                    */
                    this._focusedItemIndex = -1;
                    return false;
                }
            }

            /*
                ._parent holds the CM/CSM interaction with an item of which led
                to opening of this instance. ._caller is the item (`li`
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
                there (in order not to create an overlay), but instead do
                something else (like, for example, save the existing overlay to
                use it as the overlay for this CSM).
            */
            ContextMenu.prototype._open.call(this);

            /*
                Autofocus on the first item if the CSM opening has been
                initiated by some key press ("enter" or "arrow right").
            */
            if (keyTriggered) {
                this._normalItems[0].focus();
                this._focusedItemIndex = 0;
            }

            /*
                Register event listeners that are responsible for tracking the
                closure of the CSM.
            */
            this._regClosureEL();

            /*
                Notify the parent CM/CSM that it has an opened CSM since now.
                Mark this CSM as opened.
            */
            this._parent._openedCSM = this;
            this._opened = true;
        }

        _regClosureEL() {
            /*
                Save the parent's key closure event listener's callback and
                remove the parent's event listener in order to prevent closure
                of all the CMs/CSMs on key responsible for the CM/CSM closure
                press and save as the ._parentKeyClosureLC to restore
                (re-register) it later during the closure (the #close method).
            */
            this._parentKeyClosureLC = this._parent._keyClosureLC;
            document.removeEventListener("keydown", this._parentKeyClosureLC);

            /*
                Attach an almost identical event listener that (unlike the CM's
                one) is also fired when the "arrow left" key is pressed. If we
                omit these manipulations then "escape" key press will close all
                the opened CMs/CSMs whilst we need only `this` CSM to be closed.
            */
            this._keyClosureLC = (event) => {
                if (event.keyCode === 27 || event.keyCode === 37) {
                    this.close(true);
                }
            };

            document.addEventListener("keydown", this._keyClosureLC);

            /*
                Assign closure delay to `delay` variable for shortness. `timer`
                is used to store the delay timer (to be able to clear it in some
                cases);
            */
            let delay = this.options.delay.closure,
                timer = null;

            /*
                Close the CSM after `delay` milliseconds if the mouse was moved
                over any of the parent's items. But if the mouse returned back
                to the caller then clear the timer thus preventing the CSM from
                being closed. Checking for `timer` is necessary because there're
                several timers are initiated if the mouse overed more than 1
                parent's item, so clearing the timer will only clear the last
                initiated one. This is also the reason of why we not just
                clearing the timer but also setting the `timer` variable to
                null - the `clearTimeout` function does not do this for us. It
                has to be done manually to have a possibility to check for the
                `timer` absense.
            */
            this._mouseClosureLC = (event) => {
                if (this._parent._normalItems.includes(event.target)) {
                    if (event.target !== this._caller) {
                        if (!timer) {
                            timer = setTimeout(() => {
                                this.close();
                            }, delay);
                        }
                    } else {
                        clearTimeout(timer);
                        timer = null;
                    }
                }
            };

            this._parent._cm.addEventListener("mouseover", this._mouseClosureLC);

            /*
                Clear the timer (and set `timer` to null as well) if the mouse
                returned back to the CSM. No need to save the callback for the
                future removal because this event listener will be removed
                automatically during the CSM closure (because there we delete
                the ._cm that is an HTML element, and all the event listeners
                assigned to an element are removed along with the element).
            */
            this._cm.addEventListener("mouseenter", (event) => {
                clearTimeout(timer);
                timer = null;
            });
        }

        _renderOverlay() {
            /*
                The thing I've talked about in the #_open. No need in second
                (third, fouth etc.) overlay. Just use the existing one (the one
                created for the root CM).
            */
            this._overlay = this._parent._overlay;
        }

        _buildItemElements() {
            /*
                There're no differences in building item elements between CM and
                CSM. So we can just invoke the #_buildItemElements method of the
                ContextMenu's prototype on `this` instance to avoid code
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

        _regKbNavEL() {
            /*
                Alright, here goes an interesting part (and a bit complicated as
                well). The first question raises: why can't we just invoke the
                relevant `ContextMenu.prototype`s method on `this` instance
                here? The reason is simple: because 2 same event listeners will
                be registered on the document. Why is this bad though? Because
                when the CSM is opened and, for example, "arrow up" key is
                pressed the first element to gain a focuse would be some
                parent's item, and only after that an item of `this` instance
                will gain it. One can argue: there may be only one item with
                focus on the page at the moment. And that's true, though that
                doen't negate the fact that the parent's item is focused too for
                some period of time, even if very-very small. The thing is that
                this time is more than enough for a browser to scroll the
                overflowed parent CM/CSM so the focused item can fall into
                sight.
            */

            /*
                So first of all we must remove the parent-defined event listener
                (and, of course, save it in order to re-register it again later
                on so after the closure of the CSM the parent CM/CSM might again
                become navigatable through a keyboard).
            */
            this._parentKbNavigationLC = this._parent._kbNavigationLC;
            document.removeEventListener("keydown", this._parentKbNavigationLC);

            /*
                ._focusedItemIndex is necessary to present as instance's
                property. You can find out why in the so-named method of the
                `ContextMenu`s prototype.
            */
            this._focusedItemIndex = -1;

            /*
                And this is why we saved the "actual callback" in the
                `ContextMenu`s source - to reuse it here, thereby saving another
                ~30 lines of copy-paste. The approach here is almost identical
                with the one used in the #_registerClosureEL method. But there
                we don't need exactly the parent's callback (because we do also
                need to track "arrow left" key presses), and here the callbacks
                are absolutely the same, so there's no reason to redefine it.
                This is why the `_kbNavigationAC` can not be a part of the
                `_kbNavigationListenerCallback` - the first one must be a
                regular function (to be able to be invoked on different objects)
                and the second one must be (or at least should be) an arrow
                function in order to invoke the regular function on `this`
                object. It's also necessary to save the parent's actual callback
                as this instance's property so the CSM of this CSM (if any)
                would be able to use it as well. The same behavior might be
                achieved via recursion/while-loop though, but I consider such
                approach a bit more elegant.
            */
            this._kbNavigationAC = this._parent._kbNavigationAC;

            this._kbNavigationLC = (event) => {
                this._kbNavigationAC.call(this, event);
            }

            document.addEventListener("keydown", this._kbNavigationLC);
        }

        _regMouseNavEL() {
            /*
                No tweaking for the mouse navigation.
            */
            ContextMenu.prototype._regMouseNavEL.call(this);
        }

        _determinePosition() {
            /*
                Determination of a CSM's position is a little different from the
                CM. Comments for all the common stuff you can find in the
                ContextMenu prototype's #_determinePosition's source.

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
                `transfer` option is set to `both` or `y`, then the CSM's bottom
                edge will be at the same height as the caller's bottom edge. If
                the `transfer` option equals `false`, then we making it fit into
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

        _setAndAdjustPosition() {
            /*
                Setting the CSM's position is identical with the CM. Notice
                also, that "setting the position" does not only mean "setting",
                but it's also "adjusting". More exactly, adjusting the `y`
                (vertical) position. It's necessary due to the fact that after
                the CM/CSM has been transfer it may then go beyond the
                viewport's top edge. Or the same may happen if the CM/CSM is
                simply overpopulated with items. So in the
                #_setAndAdjustPosition we have to make some final adjustments,
                like forcing the CM/CSM to lower its height so it won't overcome
                the top viewport's edge, or if even after the "lowering" the
                CM/CSM starts to overcome the bottom edge we must enable
                scrolling. Why don't bother the same way with the "x" though,
                you might ask? Well, browser windows (as well as monitors) are
                usually wide enough. Moreover, the width of a CM/CSM is
                typically less then its height, so it's way less probable that
                the CM/CSM might overflow the width of the viewport.
            */
            ContextMenu.prototype._setAndAdjustPosition.call(this);
        }

        close(keyTriggered) {
            /*
                Closure events may happen twice (if not more, thank timers and
                delays), so there's no need to actually close the CSM if it has
                already been closed.
            */
            if (this._opened) {

                /*
                    Recursively close all the nested CSMs.
                */
                if (this._openedCSM) {
                    this._openedCSM.close();
                }

                /*
                    Remove all the mess left and restore all the removed
                    parent's event listeners.
                */
                this._parent._cm.removeEventListener("mouseover", this._mouseClosureLC);
                document.removeEventListener("keydown", this._keyClosureLC);
                document.addEventListener("keydown", this._parentKeyClosureLC);
                document.removeEventListener("keydown", this._kbNavigationLC);
                document.addEventListener("keydown", this._parentKbNavigationLC);

                /*
                    Remove "visible" class from the CSM. First of all that will
                    trigger the transition and secondly the next variable would
                    have incorrect value without that.
                */
                this._cm.className = "";

                /*
                    Get the duration of the transition. If there's no transition
                    then the variable's value will be `0`.
                */
                let transDur = parseFloat(getComputedStyle(this._cm).transitionDuration);

                /*
                    If the CSM has the transition then its duration is more than
                    0 for sure. Such way we determine whether the transition is
                    applied to the CSM.
                */
                if (transDur > 0) {
                    /*
                        Remove the CSM after the transition ends.
                    */
                    this._cm.addEventListener("transitionend", (event) => {

                        /*
                            Stopping the event propagation is necessary to avoid
                            premature closing of the overlay (if its transition
                            takes more time than the root CM's transition).
                        */
                        event.stopPropagation();
                        this._cm.remove();
                    });
                } else {

                    /*
                        If there's no transitions applied to the CSM then we can
                        safely remove it just in time.
                    */
                    this._cm.remove();
                }

                /*
                    Finally tell the parent that it no longer has an opened CSM
                    and mark the CSM as no longer opened (closed in other words)
                    and mark the CSM itself as closed (not `_opened`).
                */
                this._parent._openedCSM = null;
                this._opened = false;

                /*
                    Focus the caller if the closure was triggered by a key (but
                    not a mouse). No need to explicitly set the
                    ._focusedItemIndex of the parent because the CSM has somehow
                    been opened, right? I.e. the ._focusedItemIndex is already
                    set correctly.
                */
                if (keyTriggered) {
                    this._caller.focus();
                }
            }
        }

        static get _defaultOptions() {
            return {
                name: "",
                delay: {
                    opening: 250,
                    closure: 250
                },
                transfer: "x",
                verticalSpacing: 10,
                callback: {
                    opening() {},
                    closure() {}
                }
            }
        }
    }
}();

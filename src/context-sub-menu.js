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
        the `ContextMenu.Item`s prototype. So if rewrite this method to do
        something else here, then it will override the earlier-defined
        "instance" of this method, and anytime the instance of the
        `ContextMenu.Item` invokes this method, it will actually invoke this
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

        /*
            The interesting part goes here. If the `action` property of the
            description object is instance of `ContextMenu.Sub`, then it means
            that a user wants to open a nested menu using the item.
        */
        if (this._descr.action instanceof ContextMenu.Sub) {
            /*
                So in this case we must register some different from the typical
                case event listeners. These ones are described in the
                #_registerSubOpenEventListener method. We do also assign a
                `data-cm-item` attribute with the value "submenu-opener" so the
                user may then add some styles to those items that are used to
                open CSMs.
            */
            this._node.dataset.cmItem = "submenu-opener";
            this._registerSubOpeningEventListener();
        } else {
            /*
                But if this file is linked to the page it doesn't yet mean that
                each of the items will serve as a caller. There also might (and
                probably will) be the normal items. So if the item is not an
                instance of `ContextMenu.Sub` (but it's still an object,
                remember?) then it must be treated as usual.
            */
            this._node.dataset.cmItem = "";
            this._registerActionEventListener(this._descr.action);
        }
    };

    ContextMenu.Item.prototype._registerSubOpeningEventListener = function() {
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
            entered the caller before the CSM will be opened.
        */
        this._node.addEventListener("mouseenter", (event) => {
            timer = setTimeout(() => {
                subMenu._open(this._cm, this._node);
            }, delay);
        });

        /*
            But if the mouse leaves the caller for some reason then we must stop
            counting by clearing the timer to prevent the CSM to be opened even
            if a user just accidentially touched the caller with his mouse.
        */
        this._node.addEventListener("mouseleave", (event) => {
            clearTimeout(timer);
        });

        /*
            We must also open the CSM if he clicked (no matter which button) on
            the caller.
        */
        this._node.addEventListener("mousedown", (event) => {
            subMenu._open(this._cm, this._node);
        });

        /*
            Open the CSM on "enter" or "arrow right" key press.
        */
        this._node.addEventListener("keydown", (event) => {
            if (event.keyCode === 13 || event.keyCode === 39) {
                subMenu._open(this._cm, this._node, true);
            }
        });

        /*
            Behavior events listeners are also necessary to prevent a parent
            CM closure on `mousedown` and `contextmenu` events (i.e. on left &
            right clicks on the caller).
        */
        this._registerBehaviorEventListener();
    };

    ContextMenu.Sub = class Sub {
        // TODO: fakeFocused for highlighting
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

        _open(parent, caller, keyTriggered) {
            /*
                If there's no opened CSM already at this point (the point of the
                CSM opening) then the `if` block below will just be skipped and
                a new one will be opened. But if there's one that has already
                been opened then we check whether the currently opening CSM is
                the same as the already opened one. If it's so then we just do
                nothing (don't open another instance of the same CSM). But if
                the already opened CSM is different from the one that is
                currently opens then we close the opened one and open this one.
            */
            if (parent._openedCSM) {
                if (parent._openedCSM !== this) {
                    parent._openedCSM.close();
                } else {
                    return false;
                }
            }

            /*
                ._parent holds the CM/CSM interaction with an item of which led
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

            /*
                Autofocus on the first item if the CSM opening has been
                initiated by some key press.
            */
            if (keyTriggered) {
                this._normalItems[0].focus();
                this._focusedItemIndex = 0;
            }

            /*
                Register event listeners that are responsible for tracking a
                closure of the CSM.
            */
            this._registerClosureEventListener();

            /*
                Notify the parent CM/CSM that it has an opened CSM since now.
            */
            this._parent._openedCSM = this;
        }

        _registerClosureEventListener() {
            /*
                Save the parent's key closure event listener's callback. If the
                parent is a CM then the callback is stored in the
                ._escKeyListenerCallback property. If the parent is a CSM then
                the callback is stored in ._keyClosureListenerCallback property.
                Remove the parent's key closure event listener's callback in
                order to prevent closure of all of the CMs/CSMs on key
                responsible for the CM/CSM closure press and save as the
                ._parentKeyClosureListenerCallback to restore (reattach) it
                during the actual closure (in the #close method).
            */
            this._parentKeyClosureListenerCallback = this._parent._escKeyListenerCallback || this._parent._keyClosureListenerCallback;
            document.removeEventListener("keydown", this._parentKeyClosureListenerCallback);

            /*
                Attach the same one for this instance so "escape" key press will
                lead only to most nested CSM closure. This also affects "arrow
                left" key presses. Save it as the ._keyClosureListenerCallback
                property to remove it during the actual closure.
            */
            this._keyClosureListenerCallback = (event) => {
                if (event.keyCode === 27 || event.keyCode === 37) {
                    event.stopPropagation();
                    this.close();
                }
            };

            document.addEventListener("keydown", this._keyClosureListenerCallback);

            /*
                Assigning closure delay to the `delay` variable for shortness.
                `timer` is used to store the delay timer (to be able to remove
                it in some cases);
            */
            let delay = this.options.delay.closure,
                timer = null;

            /*
                The CSM must also be closed if mouse enters any of the parent's
                items (except for the the ._caller).
            */
            this._mouseClosureListenerCallback = (event)  => {
                if (this._parent._normalItems.includes(event.target)) {
                    if (event.target !== this._caller) {
                        /*
                            This check is necessary because if we omit it then
                            the CSM will be closed if the mouse overed some
                            other items (more than one) and then returned back
                            to the caller, i.e. to prevent some sort of falsy
                            closing.
                        */
                        if (!timer) {
                            timer = setTimeout(() => {
                                this.close();
                            }, delay);
                        }

                    /*
                        This `else` is triggered when the mouse enters the
                        caller. So in this case we cleare the timer to avoid the
                        undesirable CSM closure.
                    */
                    } else {
                        /*
                            "Nulling" the timer is necessary to the proper work
                            of the `if (!timer)` check above. The thing is that
                            `clearTimeout` doesn't actually set the `timer`
                            variable to `null`, so this check fails if we don't
                            set the `timer`s value to `null` manually.
                        */
                        clearTimeout(timer);
                        timer = null;
                    }
                }
            };

            this._parent._cm.addEventListener("mouseover", this._mouseClosureListenerCallback);

            /*
                And the last event listener responsible for canceling the CSM
                closure if the mouse returned back to the CSM itself. This event
                listener will be removed automatically along with the CSM, so
                there's no need to save it for later manual removal.
            */
            this._cm.addEventListener("mouseenter", (event) => {
                clearTimeout(timer);
                timer = null;
            });
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
            // ContextMenu.prototype._registerNavigationEventListener.call(this);
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

        close() {
            console.log("Closing...");

            /*
                Recursively close all the nested CSMs.
            */
            if (this._openedCSM) {
                this._openedCSM.close();
            }

            /*
                Remove all the mess and restore the parent's key close event
                listener (it was previously saved and removed in the
                #_registerClosureEventListener).
            */
            this._parent._cm.removeEventListener("mouseover", this._mouseClosureListenerCallback);
            document.removeEventListener("keydown", this._keyClosureListenerCallback);
            document.addEventListener("keydown", this._parentKeyClosureListenerCallback);

            /*
                Remove the CSM DOM element itself thereby removing all the
                attached to it event listeners and other stuff.
            */
            this._cm.remove();

            /*
                Finally tell the parent that it no longer has an opened CSM.
            */
            this._parent._openedCSM = null;
            // this._caller.focus();
        }

        static get _defaultOptions() {
            // TODO: Object.create, prototype to parental to fallback to them?
            return {
                delay: {
                    opening: 250,
                    closure: 250
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

void function() {
    "use strict";

    ContextMenu.Item.prototype._buildFromObject = function() {
        let text = document.createTextNode(this.descr.title);
        this._node = document.createElement("li");

        this._node.appendChild(text);
        this._node.dataset.cmItem = "";

        if (this.descr.action instanceof ContextMenu.Sub) {
            this._registerSubOpenEventListener();
        } else {
            console.log("usual");
            this._registerActionEventListener(this.descr.action);
        }
    };

    ContextMenu.Item.prototype._registerSubOpenEventListener = function() {
        // var openDelay = item.function.params.delay.open * 1000;
        // openDelay = (!Number.isNaN(openDelay)) ? openDelay : 0;
        //
        // node.addEventListener("mouseenter", (event) => {
        //     this.timer = setTimeout(() => {
        //         if (!this.openedCSM) {
        //             // open new CSM
        //             this.openedCSM = item.function._init(this, node);
        //
        //         // if CSM is already opened but mouse entered another item
        //         // that is also opens a CSM
        //         } else if (this.openedCSM !== item.function) {
        //             // close existing CSM and open a new one
        //             this.openedCSM.close();
        //             this.openedCSM = item.function._init(this, node);
        //         }
        //     }, openDelay);
        // }, false);
        //
        // node.addEventListener("mouseleave", (event) => {
        //     clearTimeout(this.timer);
        // }, false);
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
        constructor() {
        }
    }
}();

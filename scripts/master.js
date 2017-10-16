var tile1 = document.querySelector("#tile-1");

new ContextMenu(tile1, {
    id: "tile-1",
    overlay: true,

    items: [
        {
            title: "Installation",
            function() {
                alert("OK");
            }
        },

        {
            title: "Usage",
            function() {
                alert("OK");
            }
        },
    ]
});

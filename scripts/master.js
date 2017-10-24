var tile1 = document.querySelector("#tile-1");

new ContextMenu(tile1, {
    id: "tile-1",
    transfer: true,
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

        {
            title: "Docs",
            function() {
                console.log("good");
            }
        },

        "divider",

        {
            title: "Show on GitHub",
            function() {
                window.location = "https://github.com/smellyshovel/custom-context-menu";
            }
        },

        {
            title: "Version",
            function() {
                alert("This Demo site uses the latest available stable v" + "VERSION"); // TODO: use API to get the latest version number
            }
        }
    ]
});

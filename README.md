# Custom Context Menu
Easily create Custom Context Menues on your site using this little tool. No dependencies. Less than 2kB (gzipped and minified).

## Installation
1. Using the NPM or Yarn:

  ```bash
  $ npm install custom-context-menu --save
  ```
  ```bash
  $ yarn add custom-context-menu
  ```

1. Standalone

  Download the [preferable](https://github.com/smellyshovel/custom-context-menu/releases) version of this package and include the `cm.js` file as an external script:

  ```html
  <script src="cm.js"></script>
  ```

## Usage

All you have to do in order to get your custom context menu working is just invoke the `new ContextMenu()` constructor passing to it the target element as a first argument and an object of parameters as a second one: -->

```javascript
new ContextMenu(document, {
    transfer: false, // do not transfer the Context Menu if it doesn't fit on the page. Istead, draw it right in the corner
    overlay: true, // use overlay so the user can't interact with the rest of the page while the Context Menu is opened
    defaultOnAlt: false, // pretend the default (browser's) Context Menu to be opened even if user was holding the `alt` key when invoked the Context Menu
    noRecreate: true, // do not open another Context Menu after the first one has been closed via rightclick

    items: [ // the items of your menu
        { // each item is an object
            title: "Menu Item",
            function: function() {
                alert("It's alive!");
            },

            "divider", // except of "special", ones

            {
                title: "Another Menu Item", // the text of the item displayed on the page
                function: makeSomethingAwesome // and a function that is gonna take place when the user picked an item
            }
        }
    ]
});
```

The only mandatory property that is must present in the `params` object (the second argument passed to the `ContextMenu` constructor) is `items`, that is an array of items your context menu consists of.

You can assign this invokation to the variable:

```javascript
var fallbackContextMenu = new ContextMenu(document, {
    // params
});
```

In this case you'll be able to reassign certain params and to manually close the context menu:

```javascript
fallbackContextMenu.params.transfer = true;
fallbackContextMenu.params.defaultOnAlt = true;

fallbackContextMenu.close();
```

Learn more about [`target`](#) and [`params`](#). There is also more about the [`items`](#).

## Contribution

I don't currently have any contribution manifest nor styleguides. Nevertheless, I'm open for any kind of contribution you can offer. So don't be shy to open an issue or to make a pull request :sparkles:. Also, you can always contact me if you are unsure about what you can do to make this project better.

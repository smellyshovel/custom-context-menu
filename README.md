# Custom Context Menu
Create custom styled, unlimited nested Context Menues on your site. _No dependencies. Less than 2kB (gzipped and minified)._

## Content
1. [Installation](#installation)
1. [Usage](#usage)
    * [Nested Context Menues](#nested-context-menues)
1. [Documentation](#documentation)
1. [Contribution](#contribution)

## [Installation](#installation)
1. Using the NPM or Yarn:

  ```bash
  $ npm install custom-context-menu --save
  ```
  ```bash
  $ yarn add custom-context-menu
  ```

1. Standalone

  Download the [preferable version](https://github.com/smellyshovel/custom-context-menu/releases) of this package and include the `cm.js` file as an external script:

  ```html
  <script src="cm.js"></script>
  ```

## [Usage](#usage)

All you have to do in order to get your custom context menu working is just invoke the `new ContextMenu()` constructor passing to it the target element as a first argument and an object of parameters as a second one:

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
        }

        "divider", // except of "special", ones

        {
            title: "Another Menu Item", // the text of the item displayed on the page
            function: makeSomethingAwesome // and a function that is gonna take place when the user picked an item
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

### [Nested Context Menues](#nested-context-menues)

This tool allows you to create nested context menues. _Unlimited_ amount of nested context menues to be exact. All you have to do to make one menu item open another context menu is just make it's `function` propery equal to the `ContextSubMenu` instance:

```javascript
var subMenu = new ContextSubMenu({
    // params
});

new ContextMenu(document, {
    items: [
        {
            title: "Nested Context Menu",
            function: subMenu// here is where the magic happens
        }
    ]
});
```

or you can even invoke the constructor right on the fly:

```javascript
new ContextMenu(document, {
    items: [
        {
            title: "Nested Context Menu",
            function: new ContextSubMenu({
                // params
            })
        }
    ]
});
```

The main difference between `ContextMenu` and `ContextSubMenu` constructors is that the first one takes 2 arguments, while the second one takes only one argument - the object, containing params for the submenu. This difference is due to the fact that we exactly know which element causes the submenu to be opened (we can't say the same about the "usual" context menu - the rightclick can happen anywhere on the page).

Notice also, that the `ContextSubMenu` has it's own [list of params](#) (nevertheless some of them a common).

Here is the other example. This time there is the submenu in the submenu. Take a look, everything is straitforward, just as you might have been expected:

```javascript
new ContextMenu(document, {
    items: [
        {
            title: "Nested Context Menu",
            function: new ContextSubMenu({
                items: [
                    {
                        title: "Even deeper nested Context Menu",
                        function: new ContextSubMenu({
                            // params
                        })
                    }
                ]
            })
        }
    ]
});
```

But don't forget the main rule: _do not make things more complicated than it's needed_. It's unlikely that the users of your site will thank you for the 10-level deep nesting of the context menu. By the way, ths doesn't even look pretty in the code, does it?

## [Documentation](#documentation)

You can find all the [documentation](#) at this tool's site _(not yet to be honest)_. There you can learn everything from the target elements to the styling and animation.

## [Contribution](#contribution)

I don't currently have any contribution manifest nor styleguides. Nevertheless, I'm open for any kind of contribution you can offer. So don't be shy to open an issue or to make a pull request :sparkles:. Also, you can always contact me if you are unsure about what you can do to make this project better.

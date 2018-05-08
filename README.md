# Custom Context Menu
Improve a web-interface's UX by customizing its context menus. _No
dependencies. Less than 3kB both files (gzipped and minified)._

## Contents
1. [Installation](#installation)
1. [Usage](#usage)
    * [Nested Context Menues](#nested-context-menues)
1. [Documentation](#documentation)
1. [Contribution](#contribution)

## [Installation](#installation)
1. Using NPM or Yarn

    ```bash
    $ npm install custom-context-menu --save
    ```

    ```bash
    $ yarn add custom-context-menu
    ```

1. Standalone

    You can also just download a [preferable version](https://github.com/smellyshovel/custom-context-menu/releases) of
    the package's source and use it for your taste.

## [Usage](#usage)

### 1. Link the script

Link the `src/context-menu.js` or both the `src/context-menu.js` and `src/context-sub-menu.js` if you do also wish to use sub-menus

```html
<script src="path/to/package/src/context-menu.js">
```

or

```html
<script src="path/to/package/src/context-menu.js">
<script src="path/to/package/src/context-sub-menu.js">
```

Notice also that if you are about to use sub-menus then you **must** include the `context-menu.js` **before** the `context-sub-menu.js`.

### 2. Define a new Context Menu

The defenition of a new Context Menu is rather simple. All you have to do is to invoke the `ContextMenu` constructor providing it with 3 arguments: a `target`, an array of `items` and, optionally, an object of `options`

```javascript
new ContextMenu(target, items, options);
```

#### Target

The target is a DOM element interaction with which leads to opening of the Context Menu. Or it can also be a collection of elements. All the following examples are valid

```javascript
let target = document.querySelector("a#home");
```

```javascript
let target = document.querySelectorAll("div.button");
```

```javascript
let target = document.getElementById("one-and-only");
```

The `target` might also be the `document` which is quite useful for defining a fallback Context Menu

```javascript
let target = document;
```

More on the fallback menu in the [appropriate section](#).

#### Items

The `items` array is used to define all the items of the Context Menu. Each item is either an object or a string

##### Object

Objects are used to describe normal items like those you can press to trigger some action

```javascript
let items = [
    {
        title: "Bring a beer",
        action: bringABeer
    },

    {
        title: "Make a sandwich",
        action() {
            let bread = getBread();
            let butter = getButter();
            let bacon = getBacon();

            makeSandwich(bread, butter, bacon);
        }
    }
];
```

Each normal item object must have 2 properties: a `title` which is a name of the item and an `action` which is a function that is gonna be invoked when the item is selected.

However, the `action` might also be an insance of the `ContextMenu.Sub`. In such case the item serves as the _caller_ of a sub-menu

```javascript
let items = [
    {
        title: "Check me in",
        action: new ContextMenu.Sub(items, options)
    }
];
```

More on sub-menus in the [appropriate section](#).

##### String
Strings are the special items. For example you might want to separate 2 items with a horizontal bar between them. In order to do so use the special `"separator"` item

```javascript
let items = [
    {
        title: "Bring a beer",
        action: bringABeer
    },

    "separator", // here

    {
        title: "Make a sandwich",
        action() {
            let bread = getBread();
            let butter = getButter();
            let bacon = getBacon();

            makeSandwich(bread, butter, bacon);
        }
    }
];
```

All the special items are predefined. There's currently only one special item - the `separator`, though the list is extensible and will probably become expanded in the future.

#### Options

The `options` object provides the options which define the behavior of the Context Menu. This argument is optional, i.e. you might either provide it or not.

```javascript
let options = {
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
```

The example above lists all the possible options as well as their default values. If the `options` is not provided then the defaults would be used. The same applies for the lacking options (those that you didn't specified).

##### `name`
A string holding the name of the Context Menu. It might be anything you like. The option is used purely for styling purposes in order to identify a certain Context Menu among the others.

##### `disabled`
A boolean indicating whether the Context Menu is disabled or not. If the Context Menu is disabled then right-clicking the `target` won't do anything. For example it might be useful for disabling the browser's native context menu for a certain element.

##### `nativeOnAlt`
A boolean indicating whether to show the browser's native context menu or not if the `target` has been right-clicked *and* the `alt` key was holded. **Notice**, that the `disabled` option has no influence on behavior of this one, i.e. even if the Context Menu is `disabled` but the `nativeOnAlt` is `true` then if the `target` has been right-clicked during the `alt` key holding the browser's native context menu will appear.

##### `penetrable`
A boolean indicating whether the overlay of the Context Menu is penetrable for right-clicking "through" it or not. If set to `false` then a right click on the overlay will just close the Context Menu. But if set to `true` then a new Context Menu for the appropriate target (if any) will apear right after the closure.

##### `transfer`
The option defines what to do with the Context Menu if it can't fit in the viewport. Must have one of 4 values: `"x"`, `"y"`, `"both"` or `false`. Proceed to the [demo](#) to see those in action.

##### `verticalSpacing`
The option the value of which must be an iteger represents the amount of pixels to be stepped off a top and a bottom edges of the viewport if the menu is overflowed, i.e. if it can't fit in the viewport vertically. That might be a case on having too much items or too short viewport (e.g. a very small browser window).

##### `callback`
The object with 2 properties: `opening` and `closure`, each of which is a function. The function is invoked whenever the menu is opened or closed respectively.

### Fallback menu

You may define Custom Context Menus for all the `<a>` elements on a page, for all the `<p>` and `<button>` elements. But what about the other stuff? If a user right-clicked not one of these elements, what's then?

Well, you can define a page-wide fallback Context menu, which will be used as the menu for all the elements the other Context Menus are not specified for. In order to do so you have to register a Context Menu with the `target` equal to the `document`

```javascript
let fallbackCM = new ContextMenu(document, items);
```

If you do also have a ContextMenu defined for all the `<a>` elements

```javascript
let aCM = new ContextMenu(document.querySelectorAll("a"), items);
```

then if you right-click any `<a>` element the a-element-menu will appear. But if you right-click anywhere else within the page, the fallback one will.

You may also reach identical behavior by using the `document.documentElement` instead of `document`. However, such approach might have some disatvantages, such as that if the `<html>` element's (which is represented by the `document.documentElement`) height is less than the height of the viewport then all the "differential" part of the page won't serve as a Context Menu caller.

## Sub-menus

It's quite common to combine similar items into groups and thus sub-menus are your way to go. The sub-menu is a menu within a menu.

A sub-menu must be defined as an action of some item

```javascript
let items = [
    {
        title: "Hover me!",
        action: new ContextMenu.Sub(items, options)
    }
];
```

The item that is used to open the sub-menu is called a **caller**.

The only defference in the process of creation of a sub-menu is that it doesn't accept the `target` as an argument. And this is quite expected. The thing here is that the sub-menu might only be opened using its caller, i.e. the sub-menu is not tied to any DOM element (if not counting the caller itself the element), therefore there's no need in providing a `target` to a sub-menu's constructor.

The approach of defining the `items` is absolutely similar with the normal Context Menus. However, the `options` are not

```javascript
let options = {
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
```

Here is the list of all the available for a sub-menu options. As you can see it's quite simiar with the one that is for not-a-sub-menu. It lacks the `disabled`, `nativeOnAlt` and `penetrable` options. The reason is because they are absolutely pointless for sub-menus.

But the `delay` option is available for sub-meus whilst not for normal Context Menus. The option defines how much time should pass before the sub-menu might be opened or closed after the caller has become selected. The time is specified in milliseconds.

## Some things you might wish you knew earlier

1. Context of an action

    An action when invoked gains the context of the Context Menu instance itself

    ```javascript
    let fallbackCM = new ContextMenu(document, [
        {
            title: "Luke, I'm your father",
            action() {
                console.log(this === fallbackCM); // true
            }
        }
    ]);
    ```

1. `items` and `options` are used without making copies of them

    The `items` array might change during the lifecycle of the page the Context Menu using the array is used on.

    The prototype of the options object will be substituted with the other one.

1. Use public properties of a Context Menu to dinamically add (or remove) `items` and change `options`

    After a Context Menu is initialized (the constructor is invoked) you can still make changes to the menu's `items` and `options` by modifying the corresponding properties of the instance

    ```javascript
        let awesomeCM = new ContextMenu(target, items, options);

        setTimeout(() => {
            awesomeCM.items.push(newItem);
            awesomeCM.options.transfer = false;
        }, 10000);
    ```

    The example above adds a new item to the `awesomeCM` Context Menu and changes its `transfer` option's property to `false` in 10 seconds after the Context Menu has become initialized.

## Examples

## Styling

## [Documentation](#documentation)

You can find all the [documentation](#) at this tool's site _(not yet to be honest)_. There you can learn everything from the target elements to the styling and animation.

## [Contribution](#contribution)

I don't currently have any contribution manifest nor styleguides. Nevertheless, I'm open for any kind of contribution you can offer. So don't be shy to open an issue or to make a pull request :sparkles:. Also, you can always contact me if you are unsure about what you can do to make this project better.

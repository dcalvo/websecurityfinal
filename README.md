# Web Security FA21 Final

## Setup

Perform the following actions in the root of the repository.

`yarn`

Download the extension XPIs from Apoorv and place them into a folder called `extensions/` at the root of the repository.

`yarn ts-node src/index.ts`

Wait for the script to extract, bundle, and copy over successfully processed extensions.

Each extentension that was successfully processed will be in the `readytogo/` folder with a background and content scripts folder.

## Analyzing additional extensions

The only step that must be performed to analyze additional extensions is to add them to the `extensions/` folder. Everything is run through the pipeline together, so you'll have to rerun the entire thing in order to get new extensions in `readytogo/`.

## Structure

```
repo/
├─ archives/            /* Successfully extracted XPI archives */
├─ bundled/             /* Bundling output (including partial failures) */
├─ extensions/          /* XPI archives scraped from the Mozilla store */
├─ readytogo/           /* Successfully bundled extensions, ready for DoubleX */
├─ node_modules/        /* Houses dependencies for the project and polyfills for extensions */
├─ src/
│  ├─ index.ts          /* Pipeline source code */
```

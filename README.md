# Page State Helper for client side websites

Utility hooks to help organize a site's client-side state, and easily change the view according to state through html data attributes.
Conceptually combines ideas from Bootstrap & Redux.    

[See published npm package](https://www.npmjs.com/package/web_page_state)

## Import:

- Web: `<script src="https://unpkg.com/page_state/build/bundle.min.js"></script>`
- Node: `npm i web_page_state`


## How to use?

**- HTML**

| Attribute           | Note                                                                                                                                                                                   | Example                                                                                                                                                                                                                                                           |
|---------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| data-ws-show-if     | Show element if ANY (ie OR) of the state props specified in the attribute (space separated) is true, otherwise set 'display' style to 'none'. <br>To achieve AND simply nest elements. | - Simple: `<button data-ws-show-if="isSignedIn">Sign Out</button>` <br> - OR: `<div data-ws-show-if="isIOS isAndroid">You are on iOS OR Android</div>`  <br> - AND: `<div data-ws-show-if="isSignedIn"><p data-ws-show-if="isIOS"><Welcome user on iOS</p></div>` |
| data-ws-show-if-not | Show element if ANY (ie OR) of the NEGATED state props specified in the attribute (space separated) is true, otherwise set 'display' style to 'none'                                   | `<button data-ws-show-if-not="isSignedIn">Sign In</button>`                                                                                                                                                                                                       |
| data-ws-label | Replaces the element's innerText with the prop's value                                                                                                                                 |  `<p>Welcome <span data-ws-label="user.name"></span></p>`                                                                                                                                                                                                         |
      
**- js**

| Property                  | Type                 | Description                                                                                                                                                                                                                          |
|---------------------------|----------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| pageState                 | Object                                                   | Holds the raw state.                                                                                                                                                                                                                 |
| updatePageStateWithParams | Function                                                 | Examples: <br/> `updatePageStateWithParams({countryName: "Brazil"})`                                                                                                                                                                 | 
| toastNotification         | Function                                                 | Example: `toastNotification("Copied", "Successfully copied to clipboard", false, false);`                                                                                                                                            | 
| dismissNotification       | Function                                                 | Remove previously toasted notification                                                                                                                                                                                               | 
| setUser                   | Function                                                 | Examples:<br>- On sign in: `setUser({name: "Ronen", uid: "987dkjbc987"});`  <br>- On sign out: `setUser(null);`                                                                                                                      | 
| getParam                  | Function                                                 | `getParam("user.uid");`                                                                                                                                                                                                              | 
| toggleParam                  | Function                                                 | `toggleParam("isFullScreen");`                                                                                                                                                                                                       | 
| registerListener          | Function                                                 | Returns the index / id as number of the new listener. This index can be used to remove the listener. Example: `let index = PageState.registerListener(function(newState){/* do something */}); PageState.unregisterListener(index);` | 
| unregisterListener        | Function                                                 | Use the index generated when 'registered'. Example: `let index = PageState.registerListener(function(newState){/* do something */}); PageState.unregisterListener(index);`                                                           | 

**- State's special keys - do not set directly**

// TODO: Prohibit direct setting by mistake?

| Key               | Type                                                  |
|-------------------|-------------------------------------------------------|
| user              | Object, set with `setUser`                            |
| isNotification    | boolean, semi-automatic: based on 'toastNotification' |                                               |
| notificationTitle | boolean, semi-automatic: based on 'toastNotification' |
| notificationMsg   | boolean, semi-automatic: based on 'toastNotification' |
| platform          | String, automatic                                     |
| isMobile          | boolean, automatic                                    |                |
| isIOS             | boolean, automatic                                    |                |
| isAndroid         | boolean, automatic                                    |                |
| isOffline         | boolean, automatic                                    |
| isSignedIn        | boolean, semi-automatic: based on 'user'              |


## How to use?

### When used in browser:

Place the following at the end of the body tag, and prior to using the `wsGlobals.PageState.updateStateWithProps` 

    <script src="https://unpkg.com/page_state/build/bundle.min.js"></script>

No need to initialize - it is initialized in code.

### When used in a webpack / other node client-side webpage builder:
Use `import` or `require...`
// TODO: Do we need to initialize? Check...


## Showcases

This is used on the following sites:
- [Speechnotes - Lightweight Speech Recognizing Notepad](https://speechnotes.co/)
- [TTSReader - Online Text To Speech Reader](https://ttsreader.com/)

## TODOs:

- In `data-ws-show-if-not` we let the function - if exists - override the property, which is inconsistent with the non-negated `data-ws-show-if`...
- Prohibit direct setting of reserved props / functions by mistake?
- Set/get style to the element's html set style prior to setting it to "none"

# How to contribute & publish updates to this package?
- This package is published both on GitHub and on npmjs.
- To publish an updated version - simply run `npm publish`, it will commit & push updates both to github and npm.


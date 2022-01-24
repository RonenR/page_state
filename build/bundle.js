(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
window.wsGlobals = window.wsGlobals || {};
window.wsGlobals.PageState = require("./index").PageState;


},{"./index":2}],2:[function(require,module,exports){
const resolvePath = require('object-resolve-path');

class PageState {

    static registerListener(onStateUpdate) {
        if (!onStateUpdate) {
            return;
        }
        let index = PageState.listenersAvailableIndex;
        PageState.listeners[index] = onStateUpdate;
        PageState.listenersAvailableIndex++;
        return index;
    }

    static unregisterListener(index) {
        if (!PageState.listeners.hasOwnProperty(index)) {
            return;
        }

        PageState.listeners[index] = null;
        try {
            delete PageState.listeners[index];
        } catch (e) {}
    }

    static updatePageStateWithParams(params) {
        console.log('updating state with: ', params);
        if (!params) {
            params = {};
        }

        let props = Object.getOwnPropertyNames(params);
        if (!params.isProcessing) {
            PageState.pageState.isProcessing = false;
        }

        if (props && props.length > 0) {
            for (const key of props) {
                if (params[key] !== undefined) {
                    if (key === "epochLicenseExpirationDateInSecs") {
                        let latestEpoch = Math.max(PageState.pageState[key], params[key]);
                        PageState.pageState[key] = latestEpoch;
                        try {
                            localStorage.setItem("epochLicenseExpirationDateInSecs", PageState.pageState[key]);
                            if (window.chrome && chrome.runtime && chrome.runtime.sendMessage) {
                                // Published extension:
                                chrome.runtime.sendMessage("nncconplehmbkbhkgkodmnkfaflopkji", {
                                    message: "epochLicenseExpirationDateInSecs",
                                    data: latestEpoch
                                }, function () {
                                });
                            }
                        } catch (e) {

                        }
                    } else {
                        PageState.pageState[key] = params[key];
                    }
                }
            }
        }

        console.log('new state: ', PageState.pageState);
        try {
            PageState.updateUiByState(PageState.pageState);
        } catch (e) {
            
        }
        if (PageState.listeners) {
            for (const i of Object.getOwnPropertyNames(PageState.listeners)) {
                if (PageState.listeners[i] && PageState.listeners[i] instanceof Function) {
                    PageState.listeners[i](PageState.pageState);
                } else {
                    delete PageState.listeners[i];
                }
            }
        }
    }

    static interpretLicenseState(epochToExpirationSecs) {
        const ONE_MONTH_IN_SECONDS = 3600 * 24 * 30;

        if (!epochToExpirationSecs) {
            return PageState.licenseInterpretations.NONE;
        } else if (epochToExpirationSecs < 0) {
            return PageState.licenseInterpretations.UNKNOWN;
        } else if (epochToExpirationSecs >= 3000000000) {
            return PageState.licenseInterpretations.LIFETIME;
        } else {
            let timeInSecsTillExpiration = epochToExpirationSecs - Date.now() / 1000;
            if (timeInSecsTillExpiration <= 0) {
                return PageState.licenseInterpretations.SUBSCRIPTION_OVER;
            } else if (timeInSecsTillExpiration >= ONE_MONTH_IN_SECONDS) {
                return PageState.licenseInterpretations.SUBSCRIPTION;
            } else {
                return PageState.licenseInterpretations.SUBSCRIPTION_SOON_OVER;
            }
        }
    }

    static updateUiByStatePropsDirectly(newState) {
        console.log('updateUiByStatePropsDirectly got new state: ', newState);

        let newStateHelpers = new PageState.pageStateHelpers(newState);

        let elements = document.querySelectorAll("[data-ws-show-if]");
        console.log(elements);
        for (const element of elements) {
            let attr = element.getAttribute('data-ws-show-if');
            if (!attr) {
                continue;
            }

            let conditions = attr.split(" ");

            let shouldShowEl = false;
            for (const condition of conditions) {

                let value;
                try {
                    value = resolvePath(newState,condition);
                } catch (e) {
                    value = null;
                }

                if (value) {
                    shouldShowEl = true;
                    break;
                }

                let valueFunction;
                try {
                    valueFunction = resolvePath(newStateHelpers,condition);
                } catch (e) {
                    valueFunction = null;
                }
                if (valueFunction && (valueFunction instanceof Function)) {
                    if (valueFunction()) {
                        shouldShowEl = true;
                        break;
                    }
                }
            }

            element.style.display = shouldShowEl ? "" : "none"; // TODO - get/set 'previously' set style, prior to 'none'
        }

        elements = document.querySelectorAll("[data-ws-show-if-not]");
        for (const element of elements) {
            let attr = element.getAttribute('data-ws-show-if-not');
            if (!attr) {
                continue;
            }

            let conditions = attr.split(" ");

            let shouldShowEl = false;
            for (const condition of conditions) {
                let valueFunction;
                try {
                    valueFunction = resolvePath(newStateHelpers,condition);
                } catch (e) {
                    valueFunction = null;
                }

                let value;
                try {
                    value = resolvePath(newState,condition);
                } catch (e) {
                    value = null;
                }

                // We let the function - if exists - override the property for this one, which is inconsistent with the show-if non negated...
                if (valueFunction && valueFunction instanceof Function) {
                    // If there's a function -> no need to check the direct property.
                    if (!valueFunction()) {
                        shouldShowEl = true;
                        break;
                    }
                } else if (!value) {
                    // There's no function -> check property.
                    shouldShowEl = true;
                    break;
                }
            }

            element.style.display = shouldShowEl ? "" : "none";
        }
    }

    static updateUiByState(newState) {

        PageState.updateUiByStatePropsDirectly(newState);

        let labelEls = document.querySelectorAll("[data-ws-label]");
        if (labelEls && labelEls.length > 0) {
            for (const el of labelEls) {
                if (el.getAttribute("data-ws-label") == "epochAsDate") {
                    var options = {year: 'numeric', month: 'long', day: 'numeric'};
                    el.innerText = (new Date(1000 * newState.epochLicenseExpirationDateInSecs)).toLocaleDateString("en-US", options)
                } else {
                    let value;
                    try {
                        value = resolvePath(newState,el.getAttribute("data-ws-label"));
                    } catch (e) {
                        value = "";
                    }

                    if (value===undefined || value===null) {
                        value = "";
                    }

                    el.innerText = value;
                }
            }
        }

        // TODO: Move the following to the helper functions, like isAndroid - should be: isLicenseTypeLife... etc.
        /*let licenseState = PageState.interpretLicenseState(newState.epochLicenseExpirationDateInSecs);

        if (licenseState == PageState.licenseInterpretations.NONE) {
          classesToShow.push(PageState.classNamesForUiUpdates.showWhenLicenseNone);
        } else if (licenseState == PageState.licenseInterpretations.UNKNOWN) {
          classesToShow.push(PageState.classNamesForUiUpdates.showWhenLicenseUnknown);
        } else if (licenseState == PageState.licenseInterpretations.LIFETIME) {
          classesToShow.push(PageState.classNamesForUiUpdates.showWhenLicenseLife);
        } else if (licenseState == PageState.licenseInterpretations.SUBSCRIPTION) {
          classesToShow.push(PageState.classNamesForUiUpdates.showWhenLicenseSubscriptionValid);
        } else if (licenseState == PageState.licenseInterpretations.SUBSCRIPTION_OVER) {
          classesToShow.push(PageState.classNamesForUiUpdates.showWhenLicenseExpired);
        } else if (licenseState == PageState.licenseInterpretations.SUBSCRIPTION_SOON_OVER) {
          classesToShow.push(PageState.classNamesForUiUpdates.showWhenLicenseSoonToExpire);
        }*/
    }

    static setPremiumLife() {
        PageState.updatePageStateWithParams({
            epochLicenseExpirationDateInSecs: 3000000000
        });

        if (PageState.pageState.uid) {
            let apiUrl = "https://itranscribe.app:8443/apiLicenses";
            var xhr = new XMLHttpRequest();
            xhr.open('POST',
                apiUrl + '?type=__sn_premium_life__' +
                '&uid=' + encodeURIComponent(PageState.pageState.uid));
            xhr.onload = function (e) {
                if (this.status == 200) {
                    //console.log('response', this.response); // JSON response
                } else {
                    console.log('error in xhr to: ' + apiUrl);
                }
            };
            xhr.send();
            console.log('sending req', xhr);
        }
    }

    static addOneYearToLicense() {
        let todayInSecs = (new Date()).getTime() / 1000;
        let latestExpiration = PageState.pageState.epochLicenseExpirationDateInSecs || 0;
        if (todayInSecs > latestExpiration) {
            latestExpiration = todayInSecs;
        }
        latestExpiration += (3600 * 24 * 365);
        PageState.updatePageStateWithParams({
            epochLicenseExpirationDateInSecs: latestExpiration
        });
    }

    static onMessageReceivedFromExtension(reply) {
        if (reply) {
            console.log('snx reply = ', reply);
            if (reply.version) {
                if (reply.version == 1) {
                    PageState.hasExtension = true;
                    console.log('sn extension version == 1 ', reply.version);
                    PageState.setPremiumLife(); // TODO: register life premium if signed in
                } else {
                    console.log('sn extension version: ', reply.version);
                }
            } else {
                console.log('sn extension reply does not include version: ', reply);
            }

            if (reply.licenseEpochSecsExpiration) {
                console.log('license: ', reply.licenseEpochSecsExpiration);
                if (reply.licenseEpochSecsExpiration >= 3000000000) {
                    PageState.setPremiumLife(); // TODO: register life premium if signed in
                } else if (reply.licenseEpochSecsExpiration > PageState.pageState.epochLicenseExpirationDateInSecs) {
                    PageState.updatePageStateWithParams({
                        epochLicenseExpirationDateInSecs: reply.licenseEpochSecsExpiration
                    })
                }
            } else {
                console.log('no license type from extension');
            }
        }
    }

    static setUser(user) {
        PageState.updatePageStateWithParams({user: user});
    }

    static toastNotification(title, msg, isError, isSticky) {
        let el = document.getElementById('notificationToast');

        if (!el) {
            el = document.createElement("div");
            el.setAttribute("id","notificationToast");
            el.setAttribute("data-ws-show-if", "isNotification");
            el.setAttribute("style", "position: fixed;bottom: 20px;z-index:9999999;background-color:#aaa");
            let msgEl = document.createElement("p");
            msgEl.setAttribute("data-ws-label", "notificationMsg");
            el.appendChild(msgEl);
            document.body.appendChild(el);
        }

        let titleEl = el.querySelector("[data-ws-label='notificationTitle']");
        console.log(titleEl);
        if (titleEl) {
            titleEl.style.color = isError ? "red" : "blue";
        }
        PageState.updatePageStateWithParams({
            isNotification: true,
            notificationTitle: title || "",
            notificationMsg: msg || "",
        });

        if (PageState.notificationTimeout != null) {
            clearTimeout(PageState.notificationTimeout);
        }
        if (!isSticky) {
            PageState.notificationTimeout = setTimeout(() => {
                PageState.updatePageStateWithParams({isNotification: false});
                PageState.notificationTimeout = null;
            }, 3000);
        }
    }

    static dismissNotification() {
        PageState.updatePageStateWithParams({isNotification: false});
        clearTimeout(PageState.notificationTimeout);
        PageState.notificationTimeout = null;
    }

    static getParam(keyPath) {
        if (keyPath===undefined || keyPath===null || keyPath.length==0) {
            return null;
        }
        return resolvePath(PageState.pageState, keyPath);
    }

    static init() {
        PageState.listeners = {};
        PageState.listenersAvailableIndex = 0;

        PageState.updatePageStateWithParams(PageState.pageState);
        try {
            window.addEventListener('online', () =>
                PageState.updatePageStateWithParams({isOffline: false})
            );
            window.addEventListener('offline', () =>
                PageState.updatePageStateWithParams({isOffline: true})
            );
        } catch (e) {
            
        }
    }

}

PageState.licenseInterpretations = {
    UNKNOWN: "UNKNOWN",
    NONE: "NONE",  // Queried Google (if prev was 2.0.1) and queried SN and got response none from both
    LIFETIME: "LIFETIME",  // Queried Google (if prev was 2.0.1) and this was the response
    SUBSCRIPTION: "SUBSCRIPTION",  // Queried SN - or got notified by SN - and this was the response + there's enough time till renewal
    SUBSCRIPTION_SOON_OVER: "SUBSCRIPTION_SOON_OVER", // // Queried SN - or got notified by SN - and the expiration date is soon (± a month)
    SUBSCRIPTION_OVER: "SUBSCRIPTION_OVER" // Queried SN - or got notified by SN - and the expiration date is over
}

try {
    PageState.storedMemoryEpochLicense = Number.parseFloat("" + localStorage.getItem("epochLicenseExpirationDateInSecs"));
} catch (e) {
    
}
PageState.memoryEpochLicense = isNaN(PageState.storedMemoryEpochLicense) ? -1 : PageState.storedMemoryEpochLicense;

PageState.notificationTimeout = null;

PageState.pageState = {
    platform: getMobileOperatingSystem(),  // string may include "mac" / "linux" / etc...
    isOffline: typeof window === "undefined" ? true : !window.navigator.onLine,
    user: null,
    epochLicenseExpirationDateInSecs: PageState.memoryEpochLicense  // -1 = unknown, 0 = none, 3000000000 or above = life
}

/**
 * Determine the mobile operating system.
 * This function returns one of 'iOS', 'Android', 'Windows Phone', or 'unknown'.
 *
 * @returns {String}
 */
function getMobileOperatingSystem() {
    try {
        var userAgent = navigator.userAgent || navigator.vendor || window.opera;

        // Windows Phone must come first because its UA also contains "Android"
        if (/windows phone/i.test(userAgent)) {
            return "win";
        }

        if (/android/i.test(userAgent)) {
            return "android";
        }

        // iOS detection from: http://stackoverflow.com/a/9039885/177710
        if (/iPad|iPhone|iPod/.test(userAgent)) {
            return "ios";
        }

        if (navigator.userAgent.includes("Mac") && "ontouchend" in document) {
            return "ios";
        }
    } catch (e) {
        
    }

    return "";
}

PageState.pageStateHelpers = function (state) {
    this.isSignedIn = function () {
        return Boolean(state.user)
    }

    this.isIOS = function () {
        return state.platform=="ios";
    }

    this.isAndroid = function () {
        return state.platform=="android";
    }

    this.isMobile = function () {
        let os = state.platform;
        return os=="android" || os=="ios";
    }
}

PageState.init();

exports.PageState = PageState;

},{"object-resolve-path":3}],3:[function(require,module,exports){
var Path = require('./path')
/**
 *
 * @param {Object} o
 * @param {String} path
 * @returns {*}
 */
module.exports = function (o, path) {
  if (typeof path !== 'string') {
    throw new TypeError('path must be a string')
  }
  if (typeof o !== 'object') {
    throw new TypeError('object must be passed')
  }
  var pathObj = Path.get(path)
  if (!pathObj.valid) {
    throw new Error('path is not a valid object path')
  }
  return pathObj.getValueFrom(o)
}

},{"./path":4}],4:[function(require,module,exports){
// gutted from https://github.com/Polymer/observe-js/blob/master/src/observe.js
function noop () {}
function detectEval () {
  // Don't test for eval if we're running in a Chrome App environment.
  // We check for APIs set that only exist in a Chrome App context.
  if (typeof chrome !== 'undefined' && chrome.app && chrome.app.runtime) {
    return false
  }

  // Firefox OS Apps do not allow eval. This feature detection is very hacky
  // but even if some other platform adds support for this function this code
  // will continue to work.
  if (typeof navigator != 'undefined' && navigator.getDeviceStorage) {
    return false
  }

  try {
    var f = new Function('', 'return true;')
    return f()
  } catch (ex) {
    return false
  }
}

var hasEval = detectEval()

function isIndex (s) {
  return +s === s >>> 0 && s !== ''
}

function isObject (obj) {
  return obj === Object(obj)
}

var createObject = ('__proto__' in {}) ?
  function (obj) {
    return obj
  } :
  function (obj) {
    var proto = obj.__proto__
    if (!proto)
      return obj
    var newObject = Object.create(proto)
    Object.getOwnPropertyNames(obj).forEach(function (name) {
      Object.defineProperty(newObject, name,
        Object.getOwnPropertyDescriptor(obj, name))
    })
    return newObject
  }

function parsePath (path) {
  var keys = []
  var index = -1
  var c, newChar, key, type, transition, action, typeMap, mode = 'beforePath'

  var actions = {
    push: function () {
      if (key === undefined)
        return

      keys.push(key)
      key = undefined
    },

    append: function () {
      if (key === undefined)
        key = newChar
      else
        key += newChar
    }
  }

  function maybeUnescapeQuote () {
    if (index >= path.length)
      return

    var nextChar = path[index + 1]
    if ((mode == 'inSingleQuote' && nextChar == "'") ||
      (mode == 'inDoubleQuote' && nextChar == '"')) {
      index++
      newChar = nextChar
      actions.append()
      return true
    }
  }

  while (mode) {
    index++
    c = path[index]

    if (c == '\\' && maybeUnescapeQuote(mode))
      continue

    type = getPathCharType(c)
    typeMap = pathStateMachine[mode]
    transition = typeMap[type] || typeMap['else'] || 'error'

    if (transition == 'error')
      return // parse error

    mode = transition[0]
    action = actions[transition[1]] || noop
    newChar = transition[2] === undefined ? c : transition[2]
    action()

    if (mode === 'afterPath') {
      return keys
    }
  }

  return // parse error
}

var identStart = '[\$_a-zA-Z]'
var identPart = '[\$_a-zA-Z0-9]'
var identRegExp = new RegExp('^' + identStart + '+' + identPart + '*' + '$')

function isIdent (s) {
  return identRegExp.test(s)
}

var constructorIsPrivate = {}

function Path (parts, privateToken) {
  if (privateToken !== constructorIsPrivate)
    throw Error('Use Path.get to retrieve path objects')

  for (var i = 0; i < parts.length; i++) {
    this.push(String(parts[i]))
  }

  if (hasEval && this.length) {
    this.getValueFrom = this.compiledGetValueFromFn()
  }
}

var pathCache = {}

function getPath (pathString) {
  if (pathString instanceof Path)
    return pathString

  if (pathString == null || pathString.length == 0)
    pathString = ''

  if (typeof pathString != 'string') {
    if (isIndex(pathString.length)) {
      // Constructed with array-like (pre-parsed) keys
      return new Path(pathString, constructorIsPrivate)
    }

    pathString = String(pathString)
  }

  var path = pathCache[pathString]
  if (path)
    return path

  var parts = parsePath(pathString)
  if (!parts)
    return invalidPath

  var path = new Path(parts, constructorIsPrivate)
  pathCache[pathString] = path
  return path
}

Path.get = getPath

function formatAccessor (key) {
  if (isIndex(key)) {
    return '[' + key + ']'
  } else {
    return '["' + key.replace(/"/g, '\\"') + '"]'
  }
}

Path.prototype = createObject({
  __proto__: [],
  valid: true,

  toString: function () {
    var pathString = ''
    for (var i = 0; i < this.length; i++) {
      var key = this[i]
      if (isIdent(key)) {
        pathString += i ? '.' + key : key
      } else {
        pathString += formatAccessor(key)
      }
    }

    return pathString
  },

  getValueFrom: function (obj, directObserver) {
    for (var i = 0; i < this.length; i++) {
      if (obj == null)
        return
      obj = obj[this[i]]
    }
    return obj
  },

  iterateObjects: function (obj, observe) {
    for (var i = 0; i < this.length; i++) {
      if (i)
        obj = obj[this[i - 1]]
      if (!isObject(obj))
        return
      observe(obj, this[i])
    }
  },

  compiledGetValueFromFn: function () {
    var str = ''
    var pathString = 'obj'
    str += 'if (obj != null'
    var i = 0
    var key
    for (; i < (this.length - 1); i++) {
      key = this[i]
      pathString += isIdent(key) ? '.' + key : formatAccessor(key)
      str += ' &&\n     ' + pathString + ' != null'
    }
    str += ')\n'

    var key = this[i]
    pathString += isIdent(key) ? '.' + key : formatAccessor(key)

    str += '  return ' + pathString + ';\nelse\n  return undefined;'
    return new Function('obj', str)
  },

  setValueFrom: function (obj, value) {
    if (!this.length)
      return false

    for (var i = 0; i < this.length - 1; i++) {
      if (!isObject(obj))
        return false
      obj = obj[this[i]]
    }

    if (!isObject(obj))
      return false

    obj[this[i]] = value
    return true
  }
})

function getPathCharType (char) {
  if (char === undefined)
    return 'eof'

  var code = char.charCodeAt(0)

  switch (code) {
    case 0x5B: // [
    case 0x5D: // ]
    case 0x2E: // .
    case 0x22: // "
    case 0x27: // '
    case 0x30: // 0
      return char

    case 0x5F: // _
    case 0x24: // $
      return 'ident'

    case 0x20: // Space
    case 0x09: // Tab
    case 0x0A: // Newline
    case 0x0D: // Return
    case 0xA0: // No-break space
    case 0xFEFF: // Byte Order Mark
    case 0x2028: // Line Separator
    case 0x2029: // Paragraph Separator
      return 'ws'
  }

  // a-z, A-Z
  if ((0x61 <= code && code <= 0x7A) || (0x41 <= code && code <= 0x5A))
    return 'ident'

  // 1-9
  if (0x31 <= code && code <= 0x39)
    return 'number'

  return 'else'
}

var pathStateMachine = {
  'beforePath': {
    'ws': ['beforePath'],
    'ident': ['inIdent', 'append'],
    '[': ['beforeElement'],
    'eof': ['afterPath']
  },

  'inPath': {
    'ws': ['inPath'],
    '.': ['beforeIdent'],
    '[': ['beforeElement'],
    'eof': ['afterPath']
  },

  'beforeIdent': {
    'ws': ['beforeIdent'],
    'ident': ['inIdent', 'append']
  },

  'inIdent': {
    'ident': ['inIdent', 'append'],
    '0': ['inIdent', 'append'],
    'number': ['inIdent', 'append'],
    'ws': ['inPath', 'push'],
    '.': ['beforeIdent', 'push'],
    '[': ['beforeElement', 'push'],
    'eof': ['afterPath', 'push']
  },

  'beforeElement': {
    'ws': ['beforeElement'],
    '0': ['afterZero', 'append'],
    'number': ['inIndex', 'append'],
    "'": ['inSingleQuote', 'append', ''],
    '"': ['inDoubleQuote', 'append', '']
  },

  'afterZero': {
    'ws': ['afterElement', 'push'],
    ']': ['inPath', 'push']
  },

  'inIndex': {
    '0': ['inIndex', 'append'],
    'number': ['inIndex', 'append'],
    'ws': ['afterElement'],
    ']': ['inPath', 'push']
  },

  'inSingleQuote': {
    "'": ['afterElement'],
    'eof': ['error'],
    'else': ['inSingleQuote', 'append']
  },

  'inDoubleQuote': {
    '"': ['afterElement'],
    'eof': ['error'],
    'else': ['inDoubleQuote', 'append']
  },

  'afterElement': {
    'ws': ['afterElement'],
    ']': ['inPath', 'push']
  }
}

var invalidPath = new Path('', constructorIsPrivate)
invalidPath.valid = false
invalidPath.getValueFrom = invalidPath.setValueFrom = function () {}

module.exports = Path

},{}]},{},[1]);

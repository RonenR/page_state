const resolvePath = require('object-resolve-path');

class PageState {

    static registerListener(onStateUpdate) {
        if (!onStateUpdate) {
            return;
        }
        let index = PageState.listenersAvailableIndex;
        PageState.listeners[index] = onStateUpdate;
        PageState.listenersAvailableIndex++;
        onStateUpdate(PageState.pageState);  // Send the first update upon registering.
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

    static toggleParam(keyPath) {
        if (keyPath===undefined || keyPath===null || keyPath.length==0) {
            return null;
        }

        PageState.updatePageStateWithParams({keyPath: !Boolean(PageState.getParam(keyPath))});
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

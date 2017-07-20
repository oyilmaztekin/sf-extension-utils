/*global lang */
const Application = require("sf-core/application");
const AlertView = require('sf-core/ui/alertview');
const Network = require('sf-core/device/network');
const System = require('sf-core/device/system');

/**
 * @class RauUtil
 * @since 1.0.0
 * 
 * An util class for RAU operations.
 */
function RauUtil() {};

/**
 * Checks RAU updates. If there is new update available, the update dialog will be shown to the user 
 * if silent parameter not given. This function will handle permission operations internally for Android. 
 * 
 * @param {Object} options
 * @param {Boolean} options.showProgressCheck Show dialog while checking updates.
 * @param {Boolean} options.showProgressErrorAlert Show error dialog when error accurs.
 * @param {Boolean} options.silent Update and restart without interacting with user.
 * @method checkUpdate
 * @readonly
 * @android
 * @ios
 * @static
 * @since 1.0.0
 */ 
Object.defineProperty(RauUtil, "checkUpdate", {
    value: function(options) {
        console.log("inside check update");
        options = options || {};

        if (Network.connectionType === Network.ConnectionType.None) {
            return;
        }

        //Checks if there is a valid update. If yes returns result object.
        var updateProgressAlert;
        if (options.showProgressCheck) {
            updateProgressAlert = new AlertView({
                message: lang.checkingUpdate || "Checking for updates"
            });
            // Wait until IOS-2302
            (System.OS === "Android") && (updateProgressAlert.android.cancellable = false);
            updateProgressAlert.show();
        }
        Application.checkUpdate(function(err, result) {
            if (options.showProgressCheck && updateProgressAlert) {
                updateProgressAlert.dismiss();
            }
            if (err) {
                if (typeof err === "object") {
                    try {
                        err = JSON.stringify(err, null, "\t");
                    }
                    finally {

                    }
                }
                if (options.showProgressErrorAlert) {
                    var informationAlert = new AlertView({
                        message: lang.noupdate || "No new updates were found"
                    });
                    informationAlert.addButton({
                        text: lang.ok || "OK",
                        type: AlertView.Android.ButtonType.POSITIVE,
                    });
                    informationAlert.show();
                }
            }
            else {
                console.log("update check successfull");
                //Update check is successful. We can show the meta info to inform our app user.
                result.meta = result.meta || {};
                var isMandatory = (result.meta.isMandatory && result.meta.isMandatory === true) ? true : false;
                var updateTitle = (result.meta.title) ? result.meta.title : (lang.newVersionAvailable || 'A new update is ready!');
                var updateMessage = (lang.version || "Version") + " " + result.newVersion + " " + (lang.isReadyToInstall || "is ready to install") + ".\n\n";
                updateMessage += (isMandatory) ? (lang.updateMandatory || "This update is mandatory!") :
                    (lang.updateOptional || "Do you want to update?");

                if (options.silent) {
                    startUpdate(result);
                }
                else {
                    if (isMandatory) {
                        showConfirmationDialog(
                            updateTitle,
                            updateMessage, [
                                {
                                    text: lang.updateNow || "Update now",
                                    onClick: function() {
                                        startUpdate(result);
                                    },
                                    type: AlertView.Android.ButtonType.POSITIVE
                                }
                            ]);
                    }
                    else {
                        showConfirmationDialog(
                            updateTitle,
                            updateMessage, [
                                {
                                    text: lang.updateNow || "Update now",
                                    onClick: function() {
                                        startUpdate(result);
                                    },
                                    index: AlertView.Android.ButtonType.POSITIVE
                                },
                                {
                                    text: lang.later || "Later",
                                    onClick: doNothing,
                                    index: AlertView.Android.ButtonType.NEUTRAL
                                }
                            ]);
                    }
                }
            }
        });
    },
    enumarable: true
});

function startUpdate(result) {
    if (System.OS === "iOS") {
        performUpdate(result);
    }
    else {
        if (Application.android.checkPermission(Application.android.Permissions.WRITE_EXTERNAL_STORAGE)) {
            performUpdate(result);
        }
        else {
            Application.android.requestPermissions(1002, Application.android.Permissions.WRITE_EXTERNAL_STORAGE);
            Application.android.onRequestPermissionsResult = function(e) {
                if (e.requestCode === 1002) {
                    if (e.result) {
                        performUpdate(result);
                    }
                    else {
                        showConfirmationDialog(
                            lang.permissionRequiredTitle || "Permission Required",
                            lang.permissionRequiredMessage || "You should grand permission for update. Would you want to try again?", [
                                {
                                    text: lang.tryAgain || "Try Again",
                                    onClick: function() {
                                        startUpdate(result);
                                    },
                                    index: AlertView.Android.ButtonType.POSITIVE
                                },
                                {
                                    text: lang.cancel || "Cancel",
                                    onClick: doNothing,
                                    index: AlertView.Android.ButtonType.NEUTRAL
                                }
                            ]);
                    }
                }
            };
        }
    }

}

function performUpdate(result) {
    var updateProgressAlert = new AlertView({
        title: "Warning",
        message: lang.updateIsInProgress || "Update is in progress"
    });
    (System.OS === "Android") && (updateProgressAlert.android.cancellable = false);
    updateProgressAlert.show();
    if (result.meta.redirectURL && result.meta.redirectURL.length != 0) {
        //RAU wants us to open a URL, most probably core/player updated and binary changed.
        updateProgressAlert.dismiss();
        Application.call(result.meta.redirectURL);
    }
    else {
        //There is an update waiting to be downloaded. Let's download it.
        result.download(function(err, result) {
            if (err) {
                //Download failed
                updateProgressAlert.dismiss();
                handleError(err);
            }
            else {
                //All files are received, we'll trigger an update.
                result.updateAll(function(err) {
                    if (err) {
                        //Updating the app with downloaded files failed
                        updateProgressAlert.dismiss();
                        handleError(err);
                    }
                    else {
                        //After that the app will be restarted automatically to apply the new updates
                        Application.restart();
                    }
                });
            }
        });
    }
}

function handleError(err) {
    if (typeof err === "object") {
        try {
            err = JSON.stringify(err, null, "\t");
        }
        finally {

        }
    }
}

//We will do nothing on cancel for the timebeing.
function doNothing() {
    //do nothing
}

function showConfirmationDialog(title, message, buttons) {
    var myAlertView = new AlertView({
        title: title,
        message: message
    });
    (System.OS === "Android") && (myAlertView.android.cancellable = false);

    for (var i = 0; i < buttons.length; i++) {
        myAlertView.addButton(buttons[i]);
    }

    myAlertView.show();
}

module.exports = RauUtil;

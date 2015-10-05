/******************************************************************************
 * Copyright © 2013-2015 The Nxt Core Developers.                             *
 *                                                                            *
 * See the AUTHORS.txt, DEVELOPER-AGREEMENT.txt and LICENSE.txt files at      *
 * the top-level directory of this distribution for the individual copyright  *
 * holder information and the developer policies on copyright and licensing.  *
 *                                                                            *
 * Unless otherwise agreed in a custom licensing agreement, no part of the    *
 * Nxt software, including this file, may be copied, modified, propagated,    *
 * or distributed except according to the terms contained in the LICENSE.txt  *
 * file.                                                                      *
 *                                                                            *
 * Removal or modification of this copyright notice is prohibited.            *
 *                                                                            *
 ******************************************************************************/

/**
 * @depends {lrs.js}
 */
var LRS = (function (LRS, $) {
    var level = 1;

    LRS.logConsole = function (msg, isDateIncluded, isDisplayTimeExact) {
        if (window.console) {
            try {
                var prefix = "";
                if (!isDateIncluded) {
                    prefix = new Date().format("isoDateTime") + " ";
                }
                var postfix = "";
                if (isDisplayTimeExact) {
                    postfix = " (" + LRS.timeExact() + ")";
                }
                console.log(prefix + msg + postfix);
            } catch (e) {
                // IE11 when running in compatibility mode
            }

        }
    };

    LRS.isLogConsole = function (msgLevel) {
        return msgLevel <= level;
    };

    LRS.setLogConsoleLevel = function (logLevel) {
        level = logLevel;
    };

    LRS.logProperty = function(property) {
        LRS.logConsole(property + " = " + eval(property.escapeHTML()));
    };

    LRS.logArrayContent = function(array) {
        var data = '[';
        for (var i=0; i<array.length; i++) {
            data += array[i];
            if (i < array.length - 1) {
                data += ", ";
            }
        }
        data += ']';
        LRS.logConsole(data);
    };

    LRS.timeExact = function () {
        return window.performance.now() ||
            window.performance.mozNow() ||
            window.performance.msNow() ||
            window.performance.oNow() ||
            window.performance.webkitNow() ||
            Date.now; // none found - fallback to browser default
    };

    LRS.showConsole = function () {
        LRS.console = window.open("", "console", "width=750,height=400,menubar=no,scrollbars=yes,status=no,toolbar=no,resizable=yes");
        $(LRS.console.document.head).html("<title>" + $.t("console") + "</title><style type='text/css'>body { background:black; color:white; font-family:courier-new,courier;font-size:14px; } pre { font-size:14px; } #console { padding-top:15px; }</style>");
        $(LRS.console.document.body).html("<div style='position:fixed;top:0;left:0;right:0;padding:5px;background:#efefef;color:black;'>" + $.t("console_opened") + "<div style='float:right;text-decoration:underline;color:blue;font-weight:bold;cursor:pointer;' onclick='document.getElementById(\"console\").innerHTML=\"\"'>clear</div></div><div id='console'></div>");
    };

    LRS.addToConsole = function (url, type, data, response, error) {
        if (!LRS.console) {
            return;
        }

        if (!LRS.console.document || !LRS.console.document.body) {
            LRS.console = null;
            return;
        }

        url = url.replace(/&random=[\.\d]+/, "", url);

        LRS.addToConsoleBody(url + " (" + type + ") " + new Date().toString(), "url");

        if (data) {
            if (typeof data == "string") {
                var d = LRS.queryStringToObject(data);
                LRS.addToConsoleBody(JSON.stringify(d, null, "\t"), "post");
            } else {
                LRS.addToConsoleBody(JSON.stringify(data, null, "\t"), "post");
            }
        }

        if (error) {
            LRS.addToConsoleBody(response, "error");
        } else {
            LRS.addToConsoleBody(JSON.stringify(response, null, "\t"), (response.errorCode ? "error" : ""));
        }
    };

    LRS.addToConsoleBody = function (text, type) {
        var color = "";

        switch (type) {
            case "url":
                color = "#29FD2F";
                break;
            case "post":
                color = "lightgray";
                break;
            case "error":
                color = "red";
                break;
        }
        if (LRS.isLogConsole(10)) {
            LRS.logConsole(text, true);
        }
        $(LRS.console.document.body).find("#console").append("<pre" + (color ? " style='color:" + color + "'" : "") + ">" + text.escapeHTML() + "</pre>");
    };

    LRS.queryStringToObject = function (qs) {
        qs = qs.split("&");

        if (!qs) {
            return {};
        }

        var obj = {};

        for (var i = 0; i < qs.length; ++i) {
            var p = qs[i].split('=');

            if (p.length != 2) {
                continue;
            }

            obj[p[0]] = decodeURIComponent(p[1].replace(/\+/g, " "));
        }

        if ("secretPhrase" in obj) {
            obj.secretPhrase = "***";
        }

        return obj;
    };

    return LRS;
}(LRS || {}, jQuery));
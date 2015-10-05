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
var LRS = (function (LRS, $, undefined) {
    var _password;

    LRS.multiQueue = null;

    LRS.setServerPassword = function (password) {
        _password = password;
    };

    LRS.sendOutsideRequest = function (url, data, callback, async) {
        if ($.isFunction(data)) {
            async = callback;
            callback = data;
            data = {};
        } else {
            data = data || {};
        }

        $.support.cors = true;

        $.ajax({
            url: url,
            crossDomain: true,
            dataType: "json",
            type: "GET",
            timeout: 30000,
            async: (async === undefined ? true : async),
            data: data
        }).done(function (json) {
            //why is this necessary??..
            if (json.errorCode && !json.errorDescription) {
                json.errorDescription = (json.errorMessage ? json.errorMessage : $.t("server_error_unknown"));
            }
            if (callback) {
                callback(json, data);
            }
        }).fail(function (xhr, textStatus, error) {
            if (callback) {
                callback({
                    "errorCode": -1,
                    "errorDescription": error
                }, {});
            }
        });
    };

    LRS.sendRequest = function (requestType, data, callback, async) {
        if (requestType == undefined) {
            LRS.logConsole("Undefined request type");
            return;
        }
        if (data == undefined) {
            LRS.logConsole("Undefined data for " + requestType);
            return;
        }
        if (callback == undefined) {
            LRS.logConsole("Undefined callback function for " + requestType);
            return;
        }

        $.each(data, function (key, val) {
            if (key != "secretPhrase") {
                if (typeof val == "string") {
                    data[key] = $.trim(val);
                }
            }
        });
        //feeLRD addition fields
        var lrdAdditionFields = [
            "feeLRD_approval_addition"
        ];
        for (var i = 0; i < lrdAdditionFields.length; i++) {
            var lrdAdditionField = lrdAdditionFields[i];
            if (lrdAdditionField in data && "feeLRD" in data && parseInt(data[lrdAdditionField]) >= 0) {
                data["feeLRD"] = String(parseFloat(data["feeLRD"]) + parseFloat(data[lrdAdditionField]));
                delete data[lrdAdditionField];
            }
        }
        //convert LRD to LQT...
        try {
            var lrdFields = [
                ["feeLRD", "LQT"],
                ["amountLRD", "LQT"],
                ["priceLRD", "LQT"],
                ["refundLRD", "LQT"],
                ["discountLRD", "LQT"],
                ["phasingQuorumLRD", ""],
                ["phasingMinBalanceLRD", ""],
                ["minBalanceLRD", ""]
            ];

            for (var i = 0; i < lrdFields.length; i++) {
                var lrdField = lrdFields[i][0];
                var field = lrdField.replace("LRD", "");

                if (lrdField in data) {
                    data[field + lrdFields[i][1]] = LRS.convertToLQT(data[lrdField]);
                    delete data[lrdField];
                }
            }
        } catch (err) {
            callback({
                "errorCode": 1,
                "errorDescription": err + " (" + $.t(field) + ")"
            });
            return;
        }
        // convert asset/currency decimal amount to base unit
        try {
            var currencyFields = [
                ["phasingQuorumQNTf", "phasingHoldingDecimals"],
                ["phasingMinBalanceQNTf", "phasingHoldingDecimals"],
                ["minBalanceQNTf", "create_poll_asset_decimals"],
                ["minBalanceQNTf", "create_poll_ms_decimals"]
            ];
            var toDelete = [];
            for (var i = 0; i < currencyFields.length; i++) {
                var decimalUnitField = currencyFields[i][0];
                var decimalsField = currencyFields[i][1];
                var field = decimalUnitField.replace("QNTf", "");

                if (decimalUnitField in data) {
                    data[field] = LRS.convertToQNT(parseFloat(data[decimalUnitField]), parseInt(data[decimalsField]));
                    toDelete.push(decimalUnitField);
                    toDelete.push(decimalsField);
                }
            }
            $(toDelete, function (key, value) {
                delete data[value];
            });
        } catch (err) {
            callback({
                "errorCode": 1,
                "errorDescription": err + " (" + $.t(field) + ")"
            });
            return;
        }

        if (!data.recipientPublicKey) {
            delete data.recipientPublicKey;
        }
        if (!data.referencedTransactionFullHash) {
            delete data.referencedTransactionFullHash;
        }

        //gets account id from passphrase client side, used only for login.
        if (requestType == "getAccountId") {
            var accountId = LRS.getAccountId(data.secretPhrase);

            var lrdAddress = new LrdAddress();

            if (lrdAddress.set(accountId)) {
                var accountRS = lrdAddress.toString();
            } else {
                var accountRS = "";
            }

            callback({
                "account": accountId,
                "accountRS": accountRS
            });
            return;
        }

        //check to see if secretPhrase supplied matches logged in account, if not - show error.
        if ("secretPhrase" in data) {
            var accountId = LRS.getAccountId(LRS.rememberPassword ? _password : data.secretPhrase);
            if (accountId != LRS.account) {
                callback({
                    "errorCode": 1,
                    "errorDescription": $.t("error_passphrase_incorrect")
                });
            } else {
                //ok, accountId matches..continue with the real request.
                LRS.processAjaxRequest(requestType, data, callback, async);
            }
        } else {
            LRS.processAjaxRequest(requestType, data, callback, async);
        }
    };

    LRS.processAjaxRequest = function (requestType, data, callback, async) {
        if (!LRS.multiQueue) {
            LRS.multiQueue = $.ajaxMultiQueue(8);
        }

        if (data["_extra"]) {
            var extra = data["_extra"];
            delete data["_extra"];
        } else {
            var extra = null;
        }

        var currentPage = null;
        var currentSubPage = null;

        //means it is a page request, not a global request.. Page requests can be aborted.
        if (requestType.slice(-1) == "+") {
            requestType = requestType.slice(0, -1);
            currentPage = LRS.currentPage;
        } else {
            //not really necessary... we can just use the above code..
            var plusCharacter = requestType.indexOf("+");

            if (plusCharacter > 0) {
                var subType = requestType.substr(plusCharacter);
                requestType = requestType.substr(0, plusCharacter);
                currentPage = LRS.currentPage;
            }
        }

        if (currentPage && LRS.currentSubPage) {
            currentSubPage = LRS.currentSubPage;
        }

        var type = ("secretPhrase" in data || data.doNotSign || "adminPassword" in data || requestType == "getForging" ? "POST" : "GET");
        var url = LRS.server + "/lrd?requestType=" + requestType;

        if (type == "GET") {
            if (typeof data == "string") {
                data += "&random=" + Math.random();
            } else {
                data.random = Math.random();
            }
        }

        var secretPhrase = "";

        //unknown account..
        if (type == "POST" && !LRS.isOfflineSafeRequest(requestType) && (LRS.accountInfo.errorCode && LRS.accountInfo.errorCode == 5)) {
            callback({
                "errorCode": 2,
                "errorDescription": $.t("error_new_account")
            }, data);
            return;
        }

        if (data.referencedTransactionFullHash) {
            if (!/^[a-z0-9]{64}$/.test(data.referencedTransactionFullHash)) {
                callback({
                    "errorCode": -1,
                    "errorDescription": $.t("error_invalid_referenced_transaction_hash")
                }, data);
                return;
            }
        }

        if ((!LRS.isLocalHost || data.doNotSign) && type == "POST" &&
            requestType != "startForging" && requestType != "stopForging" && requestType != "getForging") {
            if (LRS.rememberPassword) {
                secretPhrase = _password;
            } else {
                secretPhrase = data.secretPhrase;
            }

            delete data.secretPhrase;

            if (LRS.accountInfo && LRS.accountInfo.publicKey) {
                data.publicKey = LRS.accountInfo.publicKey;
            } else if (!data.doNotSign) {
                data.publicKey = LRS.generatePublicKey(secretPhrase);
                LRS.accountInfo.publicKey = data.publicKey;
            }
        } else if (type == "POST" && LRS.rememberPassword) {
            data.secretPhrase = _password;
        }

        $.support.cors = true;

        if (type == "GET") {
            var ajaxCall = LRS.multiQueue.queue;
        } else {
            var ajaxCall = $.ajax;
        }

        //workaround for 1 specific case.. ugly
        if (data.querystring) {
            data = data.querystring;
            type = "POST";
        }

        if (requestType == "broadcastTransaction" || requestType == "addPeer" || requestType == "blacklistPeer") {
            type = "POST";
        }

        var contentType;
        var processData;
        var formData = null;
        if (requestType == "uploadTaggedData") {
            // inspired by http://stackoverflow.com/questions/5392344/sending-multipart-formdata-with-jquery-ajax
            contentType = false;
            processData = false;
            // TODO works only for new browsers
            var formData = new FormData();
            for (var key in data) {
                if (!data.hasOwnProperty(key)) {
                    continue;
                }
                formData.append(key, data[key]);
            }
            var file = $('#upload_file')[0].files[0];
            if (file && file.size > LRS.constants.MAX_TAGGED_DATA_DATA_LENGTH) {
                callback({
                    "errorCode": 3,
                    "errorDescription": $.t("error_file_too_big", {
                        "size": file.size,
                        "allowed": LRS.constants.MAX_TAGGED_DATA_DATA_LENGTH
                    })
                }, data);
                return;
            }
            formData.append("file", file); // file data
            type = "POST";
        } else {
            // JQuery defaults
            contentType = "application/x-www-form-urlencoded; charset=UTF-8";
            processData = true;
        }

        ajaxCall({
            url: url,
            crossDomain: true,
            dataType: "json",
            type: type,
            timeout: 30000,
            async: (async === undefined ? true : async),
            currentPage: currentPage,
            currentSubPage: currentSubPage,
            shouldRetry: (type == "GET" ? 2 : undefined),
            traditional: true,
            data: (formData != null ? formData : data),
            contentType: contentType,
            processData: processData
        }).done(function (response, status, xhr) {
            if (LRS.console) {
                LRS.addToConsole(this.url, this.type, this.data, response);
            }
            addAddressData(data);
            if (secretPhrase && response.unsignedTransactionBytes && !data.doNotSign && !response.errorCode && !response.error) {
                var publicKey = LRS.generatePublicKey(secretPhrase);
                var signature = LRS.signBytes(response.unsignedTransactionBytes, converters.stringToHexString(secretPhrase));

                if (!LRS.verifySignature(signature, response.unsignedTransactionBytes, publicKey, callback)) {
                    return;
                }
                addMissingData(data);
                if (file) {
                    var r = new FileReader();
                    r.onload = function (e) {
                        data.filebytes = e.target.result;
                        data.filename = file.name;
                        LRS.verifyAndSignTransactionBytes(response.unsignedTransactionBytes, signature, requestType, data, callback, response, extra);
                    };
                    r.readAsArrayBuffer(file);
                } else {
                    LRS.verifyAndSignTransactionBytes(response.unsignedTransactionBytes, signature, requestType, data, callback, response, extra);
                }
            } else {
                if (response.errorCode || response.errorDescription || response.errorMessage || response.error) {
                    response.errorDescription = LRS.translateServerError(response);
                    delete response.fullHash;
                    if (!response.errorCode) {
                        response.errorCode = -1;
                    }
                    callback(response, data);
                } else {
                    if (response.broadcasted == false) {
                        addMissingData(data);
                        if (response.unsignedTransactionBytes && !LRS.verifyTransactionBytes(converters.hexStringToByteArray(response.unsignedTransactionBytes), requestType, data)) {
                            callback({
                                "errorCode": 1,
                                "errorDescription": $.t("error_bytes_validation_server")
                            }, data);
                            return;
                        }
                        LRS.showRawTransactionModal(response);
                    } else {
                        if (extra) {
                            data["_extra"] = extra;
                        }
                        callback(response, data);
                        if (data.referencedTransactionFullHash && !response.errorCode) {
                            $.growl($.t("info_referenced_transaction_hash"), {
                                "type": "info"
                            });
                        }
                    }
                }
            }
        }).fail(function (xhr, textStatus, error) {
            if (LRS.console) {
                LRS.addToConsole(this.url, this.type, this.data, error, true);
            }

            if ((error == "error" || textStatus == "error") && (xhr.status == 404 || xhr.status == 0)) {
                if (type == "POST") {
                    $.growl($.t("error_server_connect"), {
                        "type": "danger",
                        "offset": 10
                    });
                }
            }

            if (error != "abort") {
                if (error == "timeout") {
                    error = $.t("error_request_timeout");
                }
                callback({
                    "errorCode": -1,
                    "errorDescription": error
                }, {});
            }
        });
    };

    LRS.verifyAndSignTransactionBytes = function (transactionBytes, signature, requestType, data, callback, response, extra) {
        var byteArray = converters.hexStringToByteArray(transactionBytes);
        if (!LRS.verifyTransactionBytes(byteArray, requestType, data)) {
            callback({
                "errorCode": 1,
                "errorDescription": $.t("error_bytes_validation_server")
            }, data);
            return;
        }
        var payload = transactionBytes.substr(0, 192) + signature + transactionBytes.substr(320);
        if (data.broadcast == "false") {
            response.transactionBytes = payload;
            response.transactionJSON.signature = signature;
            LRS.showRawTransactionModal(response);
        } else {
            if (extra) {
                data["_extra"] = extra;
            }
            LRS.broadcastTransactionBytes(payload, callback, response, data);
        }
    };

    LRS.verifyTransactionBytes = function (byteArray, requestType, data) {
        var transaction = {};
        transaction.type = byteArray[0];
        transaction.version = (byteArray[1] & 0xF0) >> 4;
        transaction.subtype = byteArray[1] & 0x0F;
        transaction.timestamp = String(converters.byteArrayToSignedInt32(byteArray, 2));
        transaction.deadline = String(converters.byteArrayToSignedShort(byteArray, 6));
        transaction.publicKey = converters.byteArrayToHexString(byteArray.slice(8, 40));
        transaction.recipient = String(converters.byteArrayToBigInteger(byteArray, 40));
        transaction.amountLQT = String(converters.byteArrayToBigInteger(byteArray, 48));
        transaction.feeLQT = String(converters.byteArrayToBigInteger(byteArray, 56));

        var refHash = byteArray.slice(64, 96);
        transaction.referencedTransactionFullHash = converters.byteArrayToHexString(refHash);
        if (transaction.referencedTransactionFullHash == "0000000000000000000000000000000000000000000000000000000000000000") {
            transaction.referencedTransactionFullHash = "";
        }
        //transaction.referencedTransactionId = converters.byteArrayToBigInteger([refHash[7], refHash[6], refHash[5], refHash[4], refHash[3], refHash[2], refHash[1], refHash[0]], 0);

        transaction.flags = 0;

        if (transaction.version > 0) {
            transaction.flags = converters.byteArrayToSignedInt32(byteArray, 160);
            transaction.ecBlockHeight = String(converters.byteArrayToSignedInt32(byteArray, 164));
            transaction.ecBlockId = String(converters.byteArrayToBigInteger(byteArray, 168));
        }

        if (transaction.publicKey != LRS.accountInfo.publicKey && transaction.publicKey != data.publicKey) {
            return false;
        }

        if (transaction.deadline !== data.deadline) {
            return false;
        }

        if (transaction.recipient !== data.recipient) {
            if (data.recipient == LRS.constants.GENESIS && transaction.recipient == "0") {
                //ok
            } else {
                return false;
            }
        }

        if (transaction.amountLQT !== data.amountLQT || transaction.feeLQT !== data.feeLQT) {
            return false;
        }

        if ("referencedTransactionFullHash" in data) {
            if (transaction.referencedTransactionFullHash !== data.referencedTransactionFullHash) {
                return false;
            }
        } else if (transaction.referencedTransactionFullHash !== "") {
            return false;
        }

        if (transaction.version > 0) {
            //has empty attachment, so no attachmentVersion byte...
            if (requestType == "sendMoney" || requestType == "sendMessage") {
                var pos = 176;
            } else {
                var pos = 177;
            }
        } else {
            var pos = 160;
        }
        return LRS.verifyTransactionTypes(byteArray, transaction, requestType, data, pos);
    };

    LRS.verifyTransactionTypes = function (byteArray, transaction, requestType, data, pos) {
        switch (requestType) {
            case "sendMoney":
                if (transaction.type !== 0 || transaction.subtype !== 0) {
                    return false;
                }
                break;
            case "sendMessage":
                if (transaction.type !== 1 || transaction.subtype !== 0) {
                    return false;
                }
                break;
            case "setAlias":
                if (transaction.type !== 1 || transaction.subtype !== 1) {
                    return false;
                }
                var aliasLength = parseInt(byteArray[pos], 10);
                pos++;
                transaction.aliasName = converters.byteArrayToString(byteArray, pos, aliasLength);
                pos += aliasLength;
                var uriLength = converters.byteArrayToSignedShort(byteArray, pos);
                pos += 2;
                transaction.aliasURI = converters.byteArrayToString(byteArray, pos, uriLength);
                pos += uriLength;
                if (transaction.aliasName !== data.aliasName || transaction.aliasURI !== data.aliasURI) {
                    return false;
                }
                break;
            case "createPoll":
                if (transaction.type !== 1 || transaction.subtype !== 2) {
                    return false;
                }
                var nameLength = converters.byteArrayToSignedShort(byteArray, pos);
                pos += 2;
                transaction.name = converters.byteArrayToString(byteArray, pos, nameLength);
                pos += nameLength;
                var descriptionLength = converters.byteArrayToSignedShort(byteArray, pos);
                pos += 2;
                transaction.description = converters.byteArrayToString(byteArray, pos, descriptionLength);
                pos += descriptionLength;
                transaction.finishHeight = converters.byteArrayToSignedInt32(byteArray, pos);
                pos += 4;
                var nr_options = byteArray[pos];
                pos++;

                for (var i = 0; i < nr_options; i++) {
                    var optionLength = converters.byteArrayToSignedShort(byteArray, pos);
                    pos += 2;
                    transaction["option" + (i < 10 ? "0" + i : i)] = converters.byteArrayToString(byteArray, pos, optionLength);
                    pos += optionLength;
                }
                transaction.votingModel = String(byteArray[pos]);
                pos++;
                transaction.minNumberOfOptions = String(byteArray[pos]);
                pos++;
                transaction.maxNumberOfOptions = String(byteArray[pos]);
                pos++;
                transaction.minRangeValue = String(byteArray[pos]);
                pos++;
                transaction.maxRangeValue = String(byteArray[pos]);
                pos++;
                transaction.minBalance = String(converters.byteArrayToBigInteger(byteArray, pos));
                pos += 8;
                transaction.minBalanceModel = String(byteArray[pos]);
                pos++;
                transaction.holding = String(converters.byteArrayToBigInteger(byteArray, pos));
                pos += 8;

                if (transaction.name !== data.name || transaction.description !== data.description ||
                    transaction.minNumberOfOptions !== data.minNumberOfOptions || transaction.maxNumberOfOptions !== data.maxNumberOfOptions) {
                    return false;
                }

                for (var i = 0; i < nr_options; i++) {
                    if (transaction["option" + (i < 10 ? "0" + i : i)] !== data["option" + (i < 10 ? "0" + i : i)]) {
                        return false;
                    }
                }

                if (("option" + (i < 10 ? "0" + i : i)) in data) {
                    return false;
                }
                break;
            case "castVote":
                if (transaction.type !== 1 || transaction.subtype !== 3) {
                    return false;
                }
                transaction.poll = String(converters.byteArrayToBigInteger(byteArray, pos));
                pos += 8;
                var voteLength = byteArray[pos];
                pos++;
                transaction.votes = [];

                for (var i = 0; i < voteLength; i++) {
                    transaction["vote" + (i < 10 ? "0" + i : i)] = byteArray[pos];
                    pos++;
                }
                if (transaction.poll !== data.poll) {
                    return false;
                }
                break;
            case "hubAnnouncement":
                if (transaction.type !== 1 || transaction.subtype != 4) {
                    return false;
                }
                var minFeePerByte = String(converters.byteArrayToBigInteger(byteArray, pos));
                pos += 8;
                var numberOfUris = parseInt(byteArray[pos], 10);
                pos++;
                var uris = [];

                for (var i = 0; i < numberOfUris; i++) {
                    var uriLength = parseInt(byteArray[pos], 10);
                    pos++;
                    uris[i] = converters.byteArrayToString(byteArray, pos, uriLength);
                    pos += uriLength;
                }
                return false;
                break;
            case "setAccountInfo":
                if (transaction.type !== 1 || transaction.subtype != 5) {
                    return false;
                }
                var nameLength = parseInt(byteArray[pos], 10);
                pos++;
                transaction.name = converters.byteArrayToString(byteArray, pos, nameLength);
                pos += nameLength;
                var descriptionLength = converters.byteArrayToSignedShort(byteArray, pos);
                pos += 2;
                transaction.description = converters.byteArrayToString(byteArray, pos, descriptionLength);
                pos += descriptionLength;
                if (transaction.name !== data.name || transaction.description !== data.description) {
                    return false;
                }
                break;
            case "sellAlias":
                if (transaction.type !== 1 || transaction.subtype !== 6) {
                    return false;
                }
                var aliasLength = parseInt(byteArray[pos], 10);
                pos++;
                transaction.alias = converters.byteArrayToString(byteArray, pos, aliasLength);
                pos += aliasLength;
                transaction.priceLQT = String(converters.byteArrayToBigInteger(byteArray, pos));
                pos += 8;
                if (transaction.alias !== data.aliasName || transaction.priceLQT !== data.priceLQT) {
                    return false;
                }
                break;
            case "buyAlias":
                if (transaction.type !== 1 && transaction.subtype !== 7) {
                    return false;
                }
                var aliasLength = parseInt(byteArray[pos], 10);
                pos++;
                transaction.alias = converters.byteArrayToString(byteArray, pos, aliasLength);
                pos += aliasLength;
                if (transaction.alias !== data.aliasName) {
                    return false;
                }
                break;
            case "deleteAlias":
                if (transaction.type !== 1 && transaction.subtype !== 8) {
                    return false;
                }
                var aliasLength = parseInt(byteArray[pos], 10);
                pos++;
                transaction.alias = converters.byteArrayToString(byteArray, pos, aliasLength);
                pos += aliasLength;
                if (transaction.alias !== data.aliasName) {
                    return false;
                }
                break;
            case "approveTransaction":
                if (transaction.type !== 1 && transaction.subtype !== 9) {
                    return false;
                }
                var fullHashesLength = byteArray[pos];
                pos++;
                transaction.transactionFullHash = converters.byteArrayToHexString(byteArray.slice(pos, pos + 32));
                pos += 32;
                if (transaction.transactionFullHash !== data.transactionFullHash) {
                    return false;
                }
                transaction.revealedSecretLength = converters.byteArrayToSignedInt32(byteArray, pos);
                pos += 4;
                if (transaction.revealedSecretLength > 0) {
                    transaction.revealedSecret = converters.byteArrayToHexString(byteArray.slice(pos, pos + transaction.revealedSecretLength));
                    pos += transaction.revealedSecretLength;
                }
                if (transaction.revealedSecret !== data.revealedSecret &&
                    transaction.revealedSecret !== converters.byteArrayToHexString(LRS.getUtf8Bytes(data.revealedSecretText))) {
                    return false;
                }
                break;
            case "issueAsset":
                if (transaction.type !== 2 || transaction.subtype !== 0) {
                    return false;
                }
                var nameLength = byteArray[pos];
                pos++;
                transaction.name = converters.byteArrayToString(byteArray, pos, nameLength);
                pos += nameLength;
                var descriptionLength = converters.byteArrayToSignedShort(byteArray, pos);
                pos += 2;
                transaction.description = converters.byteArrayToString(byteArray, pos, descriptionLength);
                pos += descriptionLength;
                transaction.quantityQNT = String(converters.byteArrayToBigInteger(byteArray, pos));
                pos += 8;
                transaction.decimals = String(byteArray[pos]);
                pos++;
                if (transaction.name !== data.name || transaction.description !== data.description || transaction.quantityQNT !== data.quantityQNT || transaction.decimals !== data.decimals) {
                    return false;
                }
                break;
            case "transferAsset":
                if (transaction.type !== 2 || transaction.subtype !== 1) {
                    return false;
                }
                transaction.asset = String(converters.byteArrayToBigInteger(byteArray, pos));
                pos += 8;
                transaction.quantityQNT = String(converters.byteArrayToBigInteger(byteArray, pos));
                pos += 8;
                if (transaction.asset !== data.asset || transaction.quantityQNT !== data.quantityQNT) {
                    return false;
                }
                break;
            case "placeAskOrder":
            case "placeBidOrder":
                if (transaction.type !== 2) {
                    return false;
                } else if (requestType == "placeAskOrder" && transaction.subtype !== 2) {
                    return false;
                } else if (requestType == "placeBidOrder" && transaction.subtype !== 3) {
                    return false;
                }
                transaction.asset = String(converters.byteArrayToBigInteger(byteArray, pos));
                pos += 8;
                transaction.quantityQNT = String(converters.byteArrayToBigInteger(byteArray, pos));
                pos += 8;
                transaction.priceLQT = String(converters.byteArrayToBigInteger(byteArray, pos));
                pos += 8;
                if (transaction.asset !== data.asset || transaction.quantityQNT !== data.quantityQNT || transaction.priceLQT !== data.priceLQT) {
                    return false;
                }
                break;
            case "cancelAskOrder":
            case "cancelBidOrder":
                if (transaction.type !== 2) {
                    return false;
                } else if (requestType == "cancelAskOrder" && transaction.subtype !== 4) {
                    return false;
                } else if (requestType == "cancelBidOrder" && transaction.subtype !== 5) {
                    return false;
                }
                transaction.order = String(converters.byteArrayToBigInteger(byteArray, pos));
                pos += 8;
                if (transaction.order !== data.order) {
                    return false;
                }
                break;
            case "dividendPayment":
                if (transaction.type !== 2 || transaction.subtype !== 6) {
                    return false;
                }
                transaction.asset = String(converters.byteArrayToBigInteger(byteArray, pos));
                pos += 8;
                transaction.height = String(converters.byteArrayToSignedInt32(byteArray, pos));
                pos += 4;
                transaction.amountLQTPerQNT = String(converters.byteArrayToBigInteger(byteArray, pos));
                pos += 8;
                if (transaction.asset !== data.asset ||
                    transaction.height !== data.height ||
                    transaction.amountLQTPerQNT !== data.amountLQTPerQNT) {
                    return false;
                }
                break;
            case "dgsListing":
                if (transaction.type !== 3 && transaction.subtype != 0) {
                    return false;
                }
                var nameLength = converters.byteArrayToSignedShort(byteArray, pos);
                pos += 2;
                transaction.name = converters.byteArrayToString(byteArray, pos, nameLength);
                pos += nameLength;
                var descriptionLength = converters.byteArrayToSignedShort(byteArray, pos);
                pos += 2;
                transaction.description = converters.byteArrayToString(byteArray, pos, descriptionLength);
                pos += descriptionLength;
                var tagsLength = converters.byteArrayToSignedShort(byteArray, pos);
                pos += 2;
                transaction.tags = converters.byteArrayToString(byteArray, pos, tagsLength);
                pos += tagsLength;
                transaction.quantity = String(converters.byteArrayToSignedInt32(byteArray, pos));
                pos += 4;
                transaction.priceLQT = String(converters.byteArrayToBigInteger(byteArray, pos));
                pos += 8;
                if (transaction.name !== data.name || transaction.description !== data.description || transaction.tags !== data.tags || transaction.quantity !== data.quantity || transaction.priceLQT !== data.priceLQT) {
                    return false;
                }
                break;
            case "dgsDelisting":
                if (transaction.type !== 3 && transaction.subtype !== 1) {
                    return false;
                }
                transaction.goods = String(converters.byteArrayToBigInteger(byteArray, pos));
                pos += 8;
                if (transaction.goods !== data.goods) {
                    return false;
                }
                break;
            case "dgsPriceChange":
                if (transaction.type !== 3 && transaction.subtype !== 2) {
                    return false;
                }
                transaction.goods = String(converters.byteArrayToBigInteger(byteArray, pos));
                pos += 8;
                transaction.priceLQT = String(converters.byteArrayToBigInteger(byteArray, pos));
                pos += 8;
                if (transaction.goods !== data.goods || transaction.priceLQT !== data.priceLQT) {
                    return false;
                }
                break;
            case "dgsQuantityChange":
                if (transaction.type !== 3 && transaction.subtype !== 3) {
                    return false;
                }
                transaction.goods = String(converters.byteArrayToBigInteger(byteArray, pos));
                pos += 8;
                transaction.deltaQuantity = String(converters.byteArrayToSignedInt32(byteArray, pos));
                pos += 4;
                if (transaction.goods !== data.goods || transaction.deltaQuantity !== data.deltaQuantity) {
                    return false;
                }
                break;
            case "dgsPurchase":
                if (transaction.type !== 3 && transaction.subtype !== 4) {
                    return false;
                }
                transaction.goods = String(converters.byteArrayToBigInteger(byteArray, pos));
                pos += 8;
                transaction.quantity = String(converters.byteArrayToSignedInt32(byteArray, pos));
                pos += 4;
                transaction.priceLQT = String(converters.byteArrayToBigInteger(byteArray, pos));
                pos += 8;
                transaction.deliveryDeadlineTimestamp = String(converters.byteArrayToSignedInt32(byteArray, pos));
                pos += 4;
                if (transaction.goods !== data.goods || transaction.quantity !== data.quantity || transaction.priceLQT !== data.priceLQT || transaction.deliveryDeadlineTimestamp !== data.deliveryDeadlineTimestamp) {
                    return false;
                }
                break;
            case "dgsDelivery":
                if (transaction.type !== 3 && transaction.subtype !== 5) {
                    return false;
                }
                transaction.purchase = String(converters.byteArrayToBigInteger(byteArray, pos));
                pos += 8;
                var encryptedGoodsLength = converters.byteArrayToSignedShort(byteArray, pos);
                var goodsLength = converters.byteArrayToSignedInt32(byteArray, pos);
                transaction.goodsIsText = goodsLength < 0; // ugly hack??
                if (goodsLength < 0) {
                    goodsLength &= LRS.constants.MAX_INT_JAVA;
                }
                pos += 4;
                transaction.goodsData = converters.byteArrayToHexString(byteArray.slice(pos, pos + encryptedGoodsLength));
                pos += encryptedGoodsLength;
                transaction.goodsNonce = converters.byteArrayToHexString(byteArray.slice(pos, pos + 32));
                pos += 32;
                transaction.discountLQT = String(converters.byteArrayToBigInteger(byteArray, pos));
                pos += 8;
                var goodsIsText = (transaction.goodsIsText ? "true" : "false");
                if (goodsIsText != data.goodsIsText) {
                    return false;
                }
                if (transaction.purchase !== data.purchase || transaction.goodsData !== data.goodsData || transaction.goodsNonce !== data.goodsNonce || transaction.discountLQT !== data.discountLQT) {
                    return false;
                }
                break;
            case "dgsFeedback":
                if (transaction.type !== 3 && transaction.subtype !== 6) {
                    return false;
                }
                transaction.purchase = String(converters.byteArrayToBigInteger(byteArray, pos));
                pos += 8;
                if (transaction.purchase !== data.purchase) {
                    return false;
                }
                break;
            case "dgsRefund":
                if (transaction.type !== 3 && transaction.subtype !== 7) {
                    return false;
                }
                transaction.purchase = String(converters.byteArrayToBigInteger(byteArray, pos));
                pos += 8;
                transaction.refundLQT = String(converters.byteArrayToBigInteger(byteArray, pos));
                pos += 8;
                if (transaction.purchase !== data.purchase || transaction.refundLQT !== data.refundLQT) {
                    return false;
                }
                break;
            case "leaseBalance":
                if (transaction.type !== 4 && transaction.subtype !== 0) {
                    return false;
                }
                transaction.period = String(converters.byteArrayToSignedShort(byteArray, pos));
                pos += 2;
                if (transaction.period !== data.period) {
                    return false;
                }
                break;
            case "issueCurrency":
                if (transaction.type !== 5 && transaction.subtype !== 0) {
                    return false;
                }
                var nameLength = byteArray[pos];
                pos++;
                transaction.name = converters.byteArrayToString(byteArray, pos, nameLength);
                pos += nameLength;
                var codeLength = byteArray[pos];
                pos++;
                transaction.code = converters.byteArrayToString(byteArray, pos, codeLength);
                pos += codeLength;
                var descriptionLength = converters.byteArrayToSignedShort(byteArray, pos);
                pos += 2;
                transaction.description = converters.byteArrayToString(byteArray, pos, descriptionLength);
                pos += descriptionLength;
                transaction.type = String(byteArray[pos]);
                pos++;
                transaction.initialSupply = String(converters.byteArrayToBigInteger(byteArray, pos));
                pos += 8;
                transaction.reserveSupply = String(converters.byteArrayToBigInteger(byteArray, pos));
                pos += 8;
                transaction.maxSupply = String(converters.byteArrayToBigInteger(byteArray, pos));
                pos += 8;
                transaction.issuanceHeight = String(converters.byteArrayToSignedInt32(byteArray, pos));
                pos += 4;
                transaction.minReservePerUnitLQT = String(converters.byteArrayToBigInteger(byteArray, pos));
                pos += 8;
                transaction.minDifficulty = String(byteArray[pos]);
                pos++;
                transaction.maxDifficulty = String(byteArray[pos]);
                pos++;
                transaction.ruleset = String(byteArray[pos]);
                pos++;
                transaction.algorithm = String(byteArray[pos]);
                pos++;
                transaction.decimals = String(byteArray[pos]);
                pos++;
                if (transaction.name !== data.name || transaction.code !== data.code || transaction.description !== data.description ||
                    transaction.type != data.type || transaction.initialSupply !== data.initialSupply || transaction.reserveSupply !== data.reserveSupply ||
                    transaction.maxSupply !== data.maxSupply || transaction.issuanceHeight !== data.issuanceHeight ||
                    transaction.ruleset !== data.ruleset || transaction.algorithm !== data.algorithm || transaction.decimals !== data.decimals) {
                    return false;
                }
                if (transaction.minReservePerUnitLQT !== "0" && transaction.minReservePerUnitLQT !== data.minReservePerUnitLQT) {
                    return false;
                }
                if (transaction.minDifficulty !== "0" && transaction.minDifficulty !== data.minDifficulty) {
                    return false;
                }
                if (transaction.maxDifficulty !== "0" && transaction.maxDifficulty !== data.maxDifficulty) {
                    return false;
                }
                break;
            case "currencyReserveIncrease":
                if (transaction.type !== 5 && transaction.subtype !== 1) {
                    return false;
                }
                transaction.currency = String(converters.byteArrayToBigInteger(byteArray, pos));
                pos += 8;
                transaction.amountPerUnitLQT = String(converters.byteArrayToBigInteger(byteArray, pos));
                pos += 8;
                if (transaction.currency !== data.currency || transaction.amountPerUnitLQT !== data.amountPerUnitLQT) {
                    return false;
                }
                break;
            case "currencyReserveClaim":
                if (transaction.type !== 5 && transaction.subtype !== 2) {
                    return false;
                }
                transaction.currency = String(converters.byteArrayToBigInteger(byteArray, pos));
                pos += 8;
                transaction.units = String(converters.byteArrayToBigInteger(byteArray, pos));
                pos += 8;
                if (transaction.currency !== data.currency || transaction.units !== data.units) {
                    return false;
                }
                break;
            case "transferCurrency":
                if (transaction.type !== 5 && transaction.subtype !== 3) {
                    return false;
                }
                transaction.currency = String(converters.byteArrayToBigInteger(byteArray, pos));
                pos += 8;
                transaction.units = String(converters.byteArrayToBigInteger(byteArray, pos));
                pos += 8;
                if (transaction.currency !== data.currency || transaction.units !== data.units) {
                    return false;
                }
                break;
            case "publishExchangeOffer":
                if (transaction.type !== 5 && transaction.subtype !== 4) {
                    return false;
                }
                transaction.currency = String(converters.byteArrayToBigInteger(byteArray, pos));
                pos += 8;
                transaction.buyRateLQT = String(converters.byteArrayToBigInteger(byteArray, pos));
                pos += 8;
                transaction.sellRateLQT = String(converters.byteArrayToBigInteger(byteArray, pos));
                pos += 8;
                transaction.totalBuyLimit = String(converters.byteArrayToBigInteger(byteArray, pos));
                pos += 8;
                transaction.totalSellLimit = String(converters.byteArrayToBigInteger(byteArray, pos));
                pos += 8;
                transaction.initialBuySupply = String(converters.byteArrayToBigInteger(byteArray, pos));
                pos += 8;
                transaction.initialSellSupply = String(converters.byteArrayToBigInteger(byteArray, pos));
                pos += 8;
                transaction.expirationHeight = String(converters.byteArrayToSignedInt32(byteArray, pos));
                pos += 4;
                if (transaction.currency !== data.currency || transaction.buyRateLQT !== data.buyRateLQT || transaction.sellRateLQT !== data.sellRateLQT ||
                    transaction.totalBuyLimit !== data.totalBuyLimit || transaction.totalSellLimit !== data.totalSellLimit ||
                    transaction.initialBuySupply !== data.initialBuySupply || transaction.initialSellSupply !== data.initialSellSupply || transaction.expirationHeight !== data.expirationHeight) {
                    return false;
                }
                break;
            case "currencyBuy":
                if (transaction.type !== 5 && transaction.subtype !== 5) {
                    return false;
                }
                transaction.currency = String(converters.byteArrayToBigInteger(byteArray, pos));
                pos += 8;
                transaction.rateLQT = String(converters.byteArrayToBigInteger(byteArray, pos));
                pos += 8;
                transaction.units = String(converters.byteArrayToBigInteger(byteArray, pos));
                pos += 8;
                if (transaction.currency !== data.currency || transaction.rateLQT !== data.rateLQT || transaction.units !== data.units) {
                    return false;
                }
                break;
            case "currencySell":
                if (transaction.type !== 5 && transaction.subtype !== 6) {
                    return false;
                }
                transaction.currency = String(converters.byteArrayToBigInteger(byteArray, pos));
                pos += 8;
                transaction.rateLQT = String(converters.byteArrayToBigInteger(byteArray, pos));
                pos += 8;
                transaction.units = String(converters.byteArrayToBigInteger(byteArray, pos));
                pos += 8;
                if (transaction.currency !== data.currency || transaction.rateLQT !== data.rateLQT || transaction.units !== data.units) {
                    return false;
                }
                break;
            case "currencyMint":
                if (transaction.type !== 5 && transaction.subtype !== 7) {
                    return false;
                }
                transaction.currency = String(converters.byteArrayToBigInteger(byteArray, pos));
                pos += 8;
                transaction.nonce = String(converters.byteArrayToBigInteger(byteArray, pos));
                pos += 8;
                transaction.units = String(converters.byteArrayToBigInteger(byteArray, pos));
                pos += 8;
                transaction.counter = String(converters.byteArrayToBigInteger(byteArray, pos));
                pos += 8;
                if (transaction.currency !== data.currency || transaction.nonce !== data.nonce || transaction.units !== data.units ||
                    transaction.counter !== data.counter) {
                    return false;
                }
                break;
            case "deleteCurrency":
                if (transaction.type !== 5 && transaction.subtype !== 8) {
                    return false;
                }
                transaction.currency = String(converters.byteArrayToBigInteger(byteArray, pos));
                pos += 8;
                if (transaction.currency !== data.currency) {
                    return false;
                }
                break;
            case "uploadTaggedData":
                if (transaction.type !== 6 && transaction.subtype !== 0) {
                    return false;
                }
                var serverHash = converters.byteArrayToHexString(byteArray.slice(pos, pos + 32));
                pos += 32;
                var sha256 = CryptoJS.algo.SHA256.create();
                var utfBytes = LRS.getUtf8Bytes(data.name);
                sha256.update(converters.byteArrayToWordArrayEx(utfBytes));
                utfBytes = LRS.getUtf8Bytes(data.description);
                sha256.update(converters.byteArrayToWordArrayEx(utfBytes));
                utfBytes = LRS.getUtf8Bytes(data.tags);
                sha256.update(converters.byteArrayToWordArrayEx(utfBytes));
                utfBytes = LRS.getUtf8Bytes(data.type);
                sha256.update(converters.byteArrayToWordArrayEx(utfBytes));
                utfBytes = LRS.getUtf8Bytes(data.channel);
                sha256.update(converters.byteArrayToWordArrayEx(utfBytes));
                var isText = [];
                if (data.isText == "true") {
                    isText.push(1);
                } else {
                    isText.push(0);
                }
                sha256.update(converters.byteArrayToWordArrayEx(isText));
                var utfBytes = LRS.getUtf8Bytes(data.filename);
                sha256.update(converters.byteArrayToWordArrayEx(utfBytes));
                var dataBytes = new Int8Array(data.filebytes);
                sha256.update(converters.byteArrayToWordArrayEx(dataBytes));
                var hashWords = sha256.finalize();
                var calculatedHash = converters.wordArrayToByteArrayEx(hashWords);
                if (serverHash !== converters.byteArrayToHexString(calculatedHash)) {
                    return false;
                }
                break;
            case "extendTaggedData":
                if (transaction.type !== 6 && transaction.subtype !== 1) {
                    return false;
                }
                transaction.taggedDataId = String(converters.byteArrayToBigInteger(byteArray, pos));
                pos += 8;
                if (transaction.taggedDataId !== data.transaction) {
                    return false;
                }
                break;
            default:
                //invalid requestType..
                return false;
        }

        var position = 1;

        //non-encrypted message
        if ((transaction.flags & position) != 0 ||
            ((requestType == "sendMessage" && data.message && !(data.messageIsPrunable === "true")))) {
            var attachmentVersion = byteArray[pos];
            pos++;
            var messageLength = converters.byteArrayToSignedInt32(byteArray, pos);
            transaction.messageIsText = messageLength < 0; // ugly hack??
            if (messageLength < 0) {
                messageLength &= LRS.constants.MAX_INT_JAVA;
            }
            pos += 4;
            if (transaction.messageIsText) {
                transaction.message = converters.byteArrayToString(byteArray, pos, messageLength);
            } else {
                var slice = byteArray.slice(pos, pos + messageLength);
                transaction.message = converters.byteArrayToHexString(slice);
            }
            pos += messageLength;
            var messageIsText = (transaction.messageIsText ? "true" : "false");
            if (messageIsText != data.messageIsText) {
                return false;
            }
            if (transaction.message !== data.message) {
                return false;
            }
        } else if (data.message && !(data.messageIsPrunable === "true")) {
            return false;
        }

        position <<= 1;

        //encrypted note
        if ((transaction.flags & position) != 0) {
            var attachmentVersion = byteArray[pos];
            pos++;
            var encryptedMessageLength = converters.byteArrayToSignedInt32(byteArray, pos);
            transaction.messageToEncryptIsText = encryptedMessageLength < 0;
            if (encryptedMessageLength < 0) {
                encryptedMessageLength &= LRS.constants.MAX_INT_JAVA;
            }
            pos += 4;
            transaction.encryptedMessageData = converters.byteArrayToHexString(byteArray.slice(pos, pos + encryptedMessageLength));
            pos += encryptedMessageLength;
            transaction.encryptedMessageNonce = converters.byteArrayToHexString(byteArray.slice(pos, pos + 32));
            pos += 32;
            var messageToEncryptIsText = (transaction.messageToEncryptIsText ? "true" : "false");
            if (messageToEncryptIsText != data.messageToEncryptIsText) {
                return false;
            }
            if (transaction.encryptedMessageData !== data.encryptedMessageData || transaction.encryptedMessageNonce !== data.encryptedMessageNonce) {
                return false;
            }
        } else if (data.encryptedMessageData && !(data.encryptedMessageIsPrunable === "true")) {
            return false;
        }

        position <<= 1;

        if ((transaction.flags & position) != 0) {
            var attachmentVersion = byteArray[pos];
            pos++;
            var recipientPublicKey = converters.byteArrayToHexString(byteArray.slice(pos, pos + 32));
            if (recipientPublicKey != data.recipientPublicKey) {
                return false;
            }
            pos += 32;
        } else if (data.recipientPublicKey) {
            return false;
        }

        position <<= 1;

        if ((transaction.flags & position) != 0) {
            var attachmentVersion = byteArray[pos];
            pos++;
            var encryptedToSelfMessageLength = converters.byteArrayToSignedInt32(byteArray, pos);
            transaction.messageToEncryptToSelfIsText = encryptedToSelfMessageLength < 0;
            if (encryptedToSelfMessageLength < 0) {
                encryptedToSelfMessageLength &= LRS.constants.MAX_INT_JAVA;
            }
            pos += 4;
            transaction.encryptToSelfMessageData = converters.byteArrayToHexString(byteArray.slice(pos, pos + encryptedToSelfMessageLength));
            pos += encryptedToSelfMessageLength;
            transaction.encryptToSelfMessageNonce = converters.byteArrayToHexString(byteArray.slice(pos, pos + 32));
            pos += 32;
            var messageToEncryptToSelfIsText = (transaction.messageToEncryptToSelfIsText ? "true" : "false");
            if (messageToEncryptToSelfIsText != data.messageToEncryptToSelfIsText) {
                return false;
            }
            if (transaction.encryptToSelfMessageData !== data.encryptToSelfMessageData || transaction.encryptToSelfMessageNonce !== data.encryptToSelfMessageNonce) {
                return false;
            }
        } else if (data.encryptToSelfMessageData) {
            return false;
        }

        position <<= 1;

        if ((transaction.flags & position) != 0) {
            var attachmentVersion = byteArray[pos];
            pos++;
            if (String(converters.byteArrayToSignedInt32(byteArray, pos)) !== data.phasingFinishHeight) {
                return false;
            }
            pos += 4;
            if (byteArray[pos] != (parseInt(data.phasingVotingModel) & 0xFF)) {
                return false;
            }
            pos++;
            if (String(converters.byteArrayToBigInteger(byteArray, pos)) !== data.phasingQuorum) {
                return false;
            }
            pos += 8;
            var minBalance = String(converters.byteArrayToBigInteger(byteArray, pos));
            if (minBalance !== "0" && minBalance !== data.phasingMinBalance) {
                return false;
            }
            pos += 8;
            var whiteListLength = byteArray[pos];
            pos++;
            for (var i = 0; i < whiteListLength; i++) {
                var accountId = LRS.convertNumericToRSAccountFormat(converters.byteArrayToBigInteger(byteArray, pos));
                pos += 8;
                if (String(accountId) !== data.phasingWhitelisted[i]) {
                    return false;
                }
            }
            var holdingId = String(converters.byteArrayToBigInteger(byteArray, pos));
            if (holdingId !== "0" && holdingId !== data.phasingHolding) {
                return false;
            }
            pos += 8;
            if (String(byteArray[pos]) !== data.phasingMinBalanceModel) {
                return false;
            }
            pos++;
            var linkedFullHashesLength = byteArray[pos];
            pos++;
            for (var i = 0; i < linkedFullHashesLength; i++) {
                var fullHash = converters.byteArrayToHexString(byteArray.slice(pos, pos + 32));
                pos += 32;
                if (fullHash !== data.phasingLinkedFullHash[i]) {
                    return false;
                }
            }
            var hashedSecretLength = byteArray[pos];
            pos++;
            if (hashedSecretLength > 0 && converters.byteArrayToHexString(byteArray.slice(pos, pos + hashedSecretLength)) !== data.phasingHashedSecret) {
                return false;
            }
            pos += hashedSecretLength;
            var algorithm = String(byteArray[pos]);
            if (algorithm !== "0" && algorithm !== data.phasingHashedSecretAlgorithm) {
                return false;
            }
            pos++;
        }

        position <<= 1;

        if ((transaction.flags & position) != 0) {
            var attachmentVersion = byteArray[pos];
            pos++;
            var serverHash = converters.byteArrayToHexString(byteArray.slice(pos, pos + 32));
            pos += 32;
            var sha256 = CryptoJS.algo.SHA256.create();
            var isText = [];
            if (data.messageIsText == "true") {
                isText.push(1);
            } else {
                isText.push(0);
            }
            sha256.update(converters.byteArrayToWordArrayEx(isText));
            var utfBytes = LRS.getUtf8Bytes(data.message);
            sha256.update(converters.byteArrayToWordArrayEx(utfBytes));
            var hashWords = sha256.finalize();
            var calculatedHash = converters.wordArrayToByteArrayEx(hashWords);
            if (serverHash !== converters.byteArrayToHexString(calculatedHash)) {
                return false;
            }
        }
        position <<= 1;

        if ((transaction.flags & position) != 0) {
            var attachmentVersion = byteArray[pos];
            pos++;
            var serverHash = converters.byteArrayToHexString(byteArray.slice(pos, pos + 32));
            pos += 32;
            var sha256 = CryptoJS.algo.SHA256.create();
            if (data.messageToEncryptIsText == "true") {
                sha256.update(converters.byteArrayToWordArrayEx([1]));
            } else {
                sha256.update(converters.byteArrayToWordArrayEx([0]));
            }
            sha256.update(converters.byteArrayToWordArrayEx([1])); // compression
            sha256.update(converters.byteArrayToWordArrayEx(converters.hexStringToByteArray(data.encryptedMessageData)));
            sha256.update(converters.byteArrayToWordArrayEx(converters.hexStringToByteArray(data.encryptedMessageNonce)));
            var hashWords = sha256.finalize();
            var calculatedHash = converters.wordArrayToByteArrayEx(hashWords);
            if (serverHash !== converters.byteArrayToHexString(calculatedHash)) {
                return false;
            }
        }

        return true;
    };

    LRS.broadcastTransactionBytes = function (transactionData, callback, originalResponse, originalData) {
        $.ajax({
            url: LRS.server + "/lrd?requestType=broadcastTransaction",
            crossDomain: true,
            dataType: "json",
            type: "POST",
            timeout: 30000,
            async: true,
            data: {
                "transactionBytes": transactionData,
                "prunableAttachmentJSON": JSON.stringify(originalResponse.transactionJSON.attachment)
            }
        }).done(function (response, status, xhr) {
            if (LRS.console) {
                LRS.addToConsole(this.url, this.type, this.data, response);
            }

            if (response.errorCode) {
                if (!response.errorDescription) {
                    response.errorDescription = (response.errorMessage ? response.errorMessage : "Unknown error occurred.");
                }
                callback(response, originalData);
            } else if (response.error) {
                response.errorCode = 1;
                response.errorDescription = response.error;
                callback(response, originalData);
            } else {
                if ("transactionBytes" in originalResponse) {
                    delete originalResponse.transactionBytes;
                }
                originalResponse.broadcasted = true;
                originalResponse.transaction = response.transaction;
                originalResponse.fullHash = response.fullHash;
                callback(originalResponse, originalData);
                if (originalData.referencedTransactionFullHash) {
                    $.growl($.t("info_referenced_transaction_hash"), {
                        "type": "info"
                    });
                }
            }
        }).fail(function (xhr, textStatus, error) {
            if (LRS.console) {
                LRS.addToConsole(this.url, this.type, this.data, error, true);
            }

            if (error == "timeout") {
                error = $.t("error_request_timeout");
            }
            callback({
                "errorCode": -1,
                "errorDescription": error
            }, {});
        });
    };

    function addAddressData(data) {
        if (typeof data == "object" && ("recipient" in data)) {
            if (/^LRD\-/i.test(data.recipient)) {
                data.recipientRS = data.recipient;
                var address = new LrdAddress();
                if (address.set(data.recipient)) {
                    data.recipient = address.account_id();
                }
            } else {
                var address = new LrdAddress();
                if (address.set(data.recipient)) {
                    data.recipientRS = address.toString();
                }
            }
        }
    }

    function addMissingData(data) {
        if (!("amountLQT" in data)) {
            data.amountLQT = "0";
        }
        if (!("recipient" in data)) {
            data.recipient = LRS.constants.GENESIS;
            data.recipientRS = LRS.constants.GENESIS_RS;
        }
    }

    return LRS;
}(LRS || {}, jQuery));
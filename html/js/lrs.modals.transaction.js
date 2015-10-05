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
 * @depends {lrs.modals.js}
 */
var LRS = (function (LRS, $, undefined) {
    $('body').on("click", ".show_transaction_modal_action", function (e) {
        e.preventDefault();

        var transactionId = $(this).data("transaction");
        var infoModal = $('#transaction_info_modal');
        var isModalVisible = false;
        if (infoModal && infoModal.data('bs.modal')) {
            isModalVisible = infoModal.data('bs.modal').isShown;
        }
        LRS.showTransactionModal(transactionId, isModalVisible);
    });

    LRS.showTransactionModal = function (transaction, isModalVisible) {
        if (LRS.fetchingModalData) {
            return;
        }

        LRS.fetchingModalData = true;

        $("#transaction_info_output_top, #transaction_info_output_bottom, #transaction_info_bottom").html("").hide();
        $("#transaction_info_callout").hide();
        $("#transaction_info_table").hide();
        $("#transaction_info_table").find("tbody").empty();

        try {
            if (typeof transaction != "object") {
                LRS.sendRequest("getTransaction", {
                    "transaction": transaction
                }, function (response, input) {
                    response.transaction = input.transaction;
                    LRS.processTransactionModalData(response, isModalVisible);
                });
            } else {
                LRS.processTransactionModalData(transaction, isModalVisible);
            }
        } catch (e) {
            LRS.fetchingModalData = false;
            throw e;
        }
    };

    LRS.processTransactionModalData = function (transaction, isModalVisible) {
        try {
            var async = false;

            var transactionDetails = $.extend({}, transaction);
            delete transactionDetails.attachment;
            if (transactionDetails.referencedTransaction == "0") {
                delete transactionDetails.referencedTransaction;
            }
            delete transactionDetails.transaction;

            if (!transactionDetails.confirmations) {
                transactionDetails.confirmations = "/";
            }
            if (!transactionDetails.block) {
                transactionDetails.block = "unconfirmed";
            }
            if (transactionDetails.timestamp) {
                transactionDetails.transactionTime = LRS.formatTimestamp(transactionDetails.timestamp);
            }
            if (transactionDetails.blockTimestamp) {
                transactionDetails.blockGenerationTime = LRS.formatTimestamp(transactionDetails.blockTimestamp);
            }
            if (transactionDetails.height == LRS.constants.MAX_INT_JAVA) {
                transactionDetails.height = "unknown";
            } else {
                transactionDetails.height_formatted_html = "<a href='#' class='block show_block_modal_action' data-block='" + String(transactionDetails.height).escapeHTML() + "'>" + String(transactionDetails.height).escapeHTML() + "</a>";
                delete transactionDetails.height;
            }
            $("#transaction_info_modal_transaction").html(String(transaction.transaction).escapeHTML());

            $("#transaction_info_tab_link").tab("show");

            $("#transaction_info_details_table").find("tbody").empty().append(LRS.createInfoTable(transactionDetails, true));
            $("#transaction_info_table").find("tbody").empty();

            var incorrect = false;
            if (transaction.senderRS == LRS.accountRS) {
                $("#transaction_info_modal_send_money").attr('disabled','disabled');
                $("#transaction_info_modal_transfer_currency").attr('disabled','disabled');
                $("#transaction_info_modal_send_message").attr('disabled','disabled');
            } else {
                $("#transaction_info_modal_send_money").removeAttr('disabled');
                $("#transaction_info_modal_transfer_currency").removeAttr('disabled');
                $("#transaction_info_modal_send_message").removeAttr('disabled');
            }
            if (transaction.senderRS in LRS.contacts) {
                var accountButton = LRS.contacts[transaction.senderRS].name.escapeHTML();
                $("#transaction_info_modal_add_as_contact").attr('disabled','disabled');
            } else {
                var accountButton = transaction.senderRS;
                $("#transaction_info_modal_add_as_contact").removeAttr('disabled');
            }
            var approveTransactionButton = $("#transaction_info_modal_approve_transaction");
            if (!transaction.attachment || !transaction.block ||
                !transaction.attachment.phasingFinishHeight ||
                transaction.attachment.phasingFinishHeight <= LRS.lastBlockHeight) {
                approveTransactionButton.attr('disabled', 'disabled');
            } else {
                approveTransactionButton.removeAttr('disabled');
                approveTransactionButton.data("transaction", transaction.transaction);
                approveTransactionButton.data("fullhash", transaction.fullHash);
                approveTransactionButton.data("timestamp", transaction.timestamp);
                approveTransactionButton.data("minBalanceFormatted", "");
                approveTransactionButton.data("votingmodel", transaction.attachment.phasingVotingModel);
            }
            var extendDataButton = $("#transaction_info_modal_extend_data");
            if (transaction.type == LRS.subtype.TaggedDataUpload.type && transaction.subtype == LRS.subtype.TaggedDataUpload.subtype) {
                extendDataButton.removeAttr('disabled');
                extendDataButton.data("transaction", transaction.transaction);
            } else {
                extendDataButton.attr('disabled','disabled');
            }

            $("#transaction_info_actions").show();
            $("#transaction_info_actions_tab").find("button").data("account", accountButton);

            if (transaction.attachment && transaction.attachment.phasingFinishHeight) {
                var finishHeight = transaction.attachment.phasingFinishHeight;
                var phasingDetails = {};
                phasingDetails.finishHeight = finishHeight;
                phasingDetails.finishIn = ((finishHeight - LRS.lastBlockHeight) > 0) ? (finishHeight - LRS.lastBlockHeight) + " " + $.t("blocks") : $.t("finished");
                var votingModel = LRS.getVotingModelName(parseInt(transaction.attachment.phasingVotingModel));
                phasingDetails.votingModel = $.t(votingModel);

                switch (votingModel) {
                    case 'ASSET':
                        LRS.sendRequest("getAsset", { "asset": transaction.attachment.phasingHolding }, function(response) {
                            phasingDetails.quorum = LRS.convertToQNTf(transaction.attachment.phasingQuorum, response.decimals);
                            phasingDetails.minBalance = LRS.convertToQNTf(transaction.attachment.phasingMinBalance, response.decimals);
                        }, false);
                        break;
                      
                    case 'CURRENCY':
                        LRS.sendRequest("getCurrency", { "currency": transaction.attachment.phasingHolding }, function(response) {
                            phasingDetails.quorum = LRS.convertToQNTf(transaction.attachment.phasingQuorum, response.decimals);
                            phasingDetails.minBalance = LRS.convertToQNTf(transaction.attachment.phasingMinBalance, response.decimals);
                        }, false);
                        break;
                      
                    default:
                        phasingDetails.quorum = transaction.attachment.phasingQuorum;
                        phasingDetails.minBalance = transaction.attachment.phasingMinBalance;
                }

                var phasingTransactionLink = "<a href='#' class='show_transaction_modal_action' data-transaction='" + String(transaction.attachment.phasingHolding).escapeHTML() + "'>" + transaction.attachment.phasingHolding + "</a>";
                if (LRS.constants.VOTING_MODELS[votingModel] == LRS.constants.VOTING_MODELS.ASSET) {
                    phasingDetails.asset_formatted_html = phasingTransactionLink;
                } else if (LRS.constants.VOTING_MODELS[votingModel] == LRS.constants.VOTING_MODELS.CURRENCY) {
                    phasingDetails.currency_formatted_html = phasingTransactionLink;
                }
                var minBalanceModel = LRS.getMinBalanceModelName(parseInt(transaction.attachment.phasingMinBalanceModel));
                phasingDetails.minBalanceModel = $.t(minBalanceModel);
                var rows = "";
                if (transaction.attachment.phasingWhitelist && transaction.attachment.phasingWhitelist.length > 0) {
                    rows = "<table class='table table-striped'><thead><tr>" +
                    "<th>" + $.t("Account") + "</th>" +
                    "</tr></thead><tbody>";
                    for (i = 0; i < transaction.attachment.phasingWhitelist.length; i++) {
                        var account = LRS.convertNumericToRSAccountFormat(transaction.attachment.phasingWhitelist[i]);
                        rows += "<tr><td><a href='#' data-user='" + String(account).escapeHTML() + "' class='show_account_modal_action'>" + LRS.getAccountTitle(account) + "</a></td></tr>";
                    }
                    rows += "</tbody></table>";
                } else {
                    rows = "-";
                }
                phasingDetails.whitelist_formatted_html = rows;
                if (transaction.attachment.phasingLinkedFullHashes && transaction.attachment.phasingLinkedFullHashes.length > 0) {
                    rows = "<table class='table table-striped'><tbody>";
                    for (i = 0; i < transaction.attachment.phasingLinkedFullHashes.length; i++) {
                        rows += "<tr><td>" + transaction.attachment.phasingLinkedFullHashes[i] + "</td></tr>";
                    }
                    rows += "</tbody></table>";
                } else {
                    rows = "-";
                }
                phasingDetails.full_hash_formatted_html = rows;
                if (transaction.attachment.phasingHashedSecret) {
                    phasingDetails.hashedSecret = transaction.attachment.phasingHashedSecret;
                    phasingDetails.hashAlgorithm = LRS.getHashAlgorithm(transaction.attachment.phasingHashedSecretAlgorithm);
                }
                $("#phasing_info_details_table").find("tbody").empty().append(LRS.createInfoTable(phasingDetails, true));
                $("#phasing_info_details_link").show();
            } else {
                $("#phasing_info_details_link").hide();
            }

            if (transaction.type == 0) {
                switch (transaction.subtype) {
                    case 0:
                        var data = {
                            "type": $.t("ordinary_payment"),
                            "amount": transaction.amountLQT,
                            "fee": transaction.feeLQT,
                            "recipient": transaction.recipientRS ? transaction.recipientRS : transaction.recipient,
                            "sender": transaction.senderRS ? transaction.senderRS : transaction.sender
                        };

                        $("#transaction_info_table").find("tbody").append(LRS.createInfoTable(data));
                        $("#transaction_info_table").show();

                        break;
                    default:
                        incorrect = true;
                        break;
                }
            } else if (transaction.type == 1) {
                switch (transaction.subtype) {
                    case 0:
                        var message;

                        var $output = $("#transaction_info_output_top");

                        if (transaction.attachment) {
                            if (transaction.attachment.message) {
                                if (!transaction.attachment["version.Message"] && !transaction.attachment["version.PrunablePlainMessage"]) {
                                    try {
                                        message = converters.hexStringToString(transaction.attachment.message);
                                    } catch (err) {
                                        //legacy
                                        if (transaction.attachment.message.indexOf("feff") === 0) {
                                            message = LRS.convertFromHex16(transaction.attachment.message);
                                        } else {
                                            message = LRS.convertFromHex8(transaction.attachment.message);
                                        }
                                    }
                                } else {
                                    message = String(transaction.attachment.message);
                                }
                                $output.html("<div style='color:#999999;padding-bottom:10px'><i class='fa fa-unlock'></i> " + $.t("public_message") + "</div><div style='padding-bottom:10px'>" + String(message).escapeHTML().nl2br() + "</div>");
                            }

                            if (transaction.attachment.encryptedMessage || (transaction.attachment.encryptToSelfMessage && LRS.account == transaction.sender)) {
                                $output.append("<div id='transaction_info_decryption_form'></div><div id='transaction_info_decryption_output' style='display:none;padding-bottom:10px;'></div>");

                                if (LRS.account == transaction.recipient || LRS.account == transaction.sender) {
                                    var fieldsToDecrypt = {};

                                    if (transaction.attachment.encryptedMessage) {
                                        fieldsToDecrypt.encryptedMessage = $.t("encrypted_message");
                                    }
                                    if (transaction.attachment.encryptToSelfMessage && LRS.account == transaction.sender) {
                                        fieldsToDecrypt.encryptToSelfMessage = $.t("note_to_self");
                                    }

                                    LRS.tryToDecrypt(transaction, fieldsToDecrypt, (transaction.recipient == LRS.account ? transaction.sender : transaction.recipient), {
                                        "noPadding": true,
                                        "formEl": "#transaction_info_decryption_form",
                                        "outputEl": "#transaction_info_decryption_output"
                                    });
                                } else {
                                    $output.append("<div style='padding-bottom:10px'>" + $.t("encrypted_message_no_permission") + "</div>");
                                }
                            }
                        } else {
                            $output.append("<div style='padding-bottom:10px'>" + $.t("message_empty") + "</div>");
                        }
                        var hash = transaction.attachment.messageHash ? ("<tr><td><strong>" + $.t("hash") + "</strong>:&nbsp;</td><td>" + transaction.attachment.messageHash + "</td></tr>") : "";
                        $output.append("<table>" +
                            "<tr><td><strong>" + $.t("from") + "</strong>:&nbsp;</td><td>" + LRS.getAccountLink(transaction, "sender") + "</td></tr>" +
                            "<tr><td><strong>" + $.t("to") + "</strong>:&nbsp;</td><td>" + LRS.getAccountLink(transaction, "recipient") + "</td></tr>" +
                            hash +
                        "</table>");
                        $output.show();

                        break;
                    case 1:
                        var data = {
                            "type": $.t("alias_assignment"),
                            "alias": transaction.attachment.alias,
                            "data_formatted_html": transaction.attachment.uri.autoLink()
                        };
                        data["sender"] = transaction.senderRS ? transaction.senderRS : transaction.sender;
                        $("#transaction_info_table").find("tbody").append(LRS.createInfoTable(data));
                        $("#transaction_info_table").show();

                        break;
                    case 2:
                        var data = {
                            "type": $.t("poll_creation"),
                            "name": transaction.attachment.name,
                            "description": transaction.attachment.description,
                            "finish_height": transaction.attachment.finishHeight,
                            "min_number_of_options": transaction.attachment.minNumberOfOptions,
                            "max_number_of_options": transaction.attachment.maxNumberOfOptions,
                            "min_range_value": transaction.attachment.minRangeValue,
                            "max_range_value": transaction.attachment.maxRangeValue,
                            "min_balance": transaction.attachment.minBalance,
                            "min_balance_model": transaction.attachment.minBalanceModel
                        };

                        if (transaction.attachment.votingModel == -1) {
                            data["voting_model"] = $.t("vote_by_none");
                        } else if (transaction.attachment.votingModel == 0) {
                            data["voting_model"] = $.t("vote_by_account");
                        } else if (transaction.attachment.votingModel == 1) {
                            data["voting_model"] = $.t("vote_by_balance");
                        } else if (transaction.attachment.votingModel == 2) {
                            data["voting_model"] = $.t("vote_by_asset");
                            data["asset_id"] = transaction.attachment.holding;
                        } else if (transaction.attachment.votingModel == 3) {
                            data["voting_model"] = $.t("vote_by_currency");
                            data["currency_id"] = transaction.attachment.holding;
                        } else if (transaction.attachment.votingModel == 4) {
                            data["voting_model"] = $.t("vote_by_transaction");
                        } else if (transaction.attachment.votingModel == 5) {
                            data["voting_model"] = $.t("vote_by_hash");
                        } else {
                            data["voting_model"] = transaction.attachment.votingModel;
                        }


                        for (var i = 0; i < transaction.attachment.options.length; i++) {
                            data["option_" + i] = transaction.attachment.options[i];
                        }

                        if (transaction.sender != LRS.account) {
                            data["sender"] = LRS.getAccountTitle(transaction, "sender");
                        }

                        data["sender"] = transaction.senderRS ? transaction.senderRS : transaction.sender;
                        $("#transaction_info_table").find("tbody").append(LRS.createInfoTable(data));
                        $("#transaction_info_table").show();

                        break;
                    case 3:
                        var vote = "";
                        var votes = transaction.attachment.vote;
                        if (votes && votes.length > 0) {
                            for (var i = 0; i < votes.length; i++) {
                                if (votes[i] == -128) {
                                    vote += "N/A";
                                } else {
                                    vote += votes[i];
                                }
                                if (i < votes.length - 1) {
                                    vote += " , ";
                                }
                            }
                        }
                        var data = {
                            "type": $.t("vote_casting"),
                            "poll_formatted_html": "<a href='#' class='show_transaction_modal_action' data-transaction='" + transaction.attachment.poll + "'>" + transaction.attachment.poll + "</a>",
                            "vote": vote
                        };
                        data["sender"] = transaction.senderRS ? transaction.senderRS : transaction.sender;
                        $("#transaction_info_table").find("tbody").append(LRS.createInfoTable(data));
                        $("#transaction_info_table").show();

                        break;
                    case 4:
                        var data = {
                            "type": $.t("hub_announcement")
                        };

                        $("#transaction_info_table").find("tbody").append(LRS.createInfoTable(data));
                        $("#transaction_info_table").show();

                        break;
                    case 5:
                        var data = {
                            "type": $.t("account_info"),
                            "name": transaction.attachment.name,
                            "description": transaction.attachment.description
                        };

                        $("#transaction_info_table").find("tbody").append(LRS.createInfoTable(data));
                        $("#transaction_info_table").show();

                        break;
                    case 6:
                        if (transaction.attachment.priceLQT == "0") {
                            if (transaction.sender == transaction.recipient) {
                                var type = $.t("alias_sale_cancellation");
                            } else {
                                var type = $.t("alias_transfer");
                            }
                        } else {
                            var type = $.t("alias_sale");
                        }

                        var data = {
                            "type": type,
                            "alias_name": transaction.attachment.alias
                        };

                        if (type == $.t("alias_sale")) {
                            data["price"] = transaction.attachment.priceLQT
                        }

                        if (type != $.t("alias_sale_cancellation")) {
                            data["recipient"] = transaction.recipientRS ? transaction.recipientRS : transaction.recipient;
                        }

                        data["sender"] = transaction.senderRS ? transaction.senderRS : transaction.sender;

                        if (type == $.t("alias_sale")) {
                            var message = "";
                            var messageStyle = "info";

                            LRS.sendRequest("getAlias", {
                                "aliasName": transaction.attachment.alias
                            }, function (response) {
                                LRS.fetchingModalData = false;

                                if (!response.errorCode) {
                                    if (transaction.recipient != response.buyer || transaction.attachment.priceLQT != response.priceLQT) {
                                        message = $.t("alias_sale_info_outdated");
                                        messageStyle = "danger";
                                    } else if (transaction.recipient == LRS.account) {
                                        message = $.t("alias_sale_direct_offer", {
                                            "lrd": LRS.formatAmount(transaction.attachment.priceLQT)
                                        }) + " <a href='#' data-alias='" + String(transaction.attachment.alias).escapeHTML() + "' data-toggle='modal' data-target='#buy_alias_modal'>" + $.t("buy_it_q") + "</a>";
                                    } else if (typeof transaction.recipient == "undefined") {
                                        message = $.t("alias_sale_indirect_offer", {
                                            "lrd": LRS.formatAmount(transaction.attachment.priceLQT)
                                        }) + " <a href='#' data-alias='" + String(transaction.attachment.alias).escapeHTML() + "' data-toggle='modal' data-target='#buy_alias_modal'>" + $.t("buy_it_q") + "</a>";
                                    } else if (transaction.senderRS == LRS.accountRS) {
                                        if (transaction.attachment.priceLQT != "0") {
                                            message = $.t("your_alias_sale_offer") + " <a href='#' data-alias='" + String(transaction.attachment.alias).escapeHTML() + "' data-toggle='modal' data-target='#cancel_alias_sale_modal'>" + $.t("cancel_sale_q") + "</a>";
                                        }
                                    } else {
                                        message = $.t("error_alias_sale_different_account");
                                    }
                                }
                            }, false);

                            if (message) {
                                $("#transaction_info_bottom").html("<div class='callout callout-bottom callout-" + messageStyle + "'>" + message + "</div>").show();
                            }
                        }

                        $("#transaction_info_table").find("tbody").append(LRS.createInfoTable(data));
                        $("#transaction_info_table").show();

                        break;
                    case 7:
                        var data = {
                            "type": $.t("alias_buy"),
                            "alias_name": transaction.attachment.alias,
                            "price": transaction.amountLQT,
                            "recipient": transaction.recipientRS ? transaction.recipientRS : transaction.recipient,
                            "sender": transaction.senderRS ? transaction.senderRS : transaction.sender
                        };

                        $("#transaction_info_table").find("tbody").append(LRS.createInfoTable(data));
                        $("#transaction_info_table").show();

                        break;
                    case 8:
                        var data = {
                            "type": $.t("alias_deletion"),
                            "alias_name": transaction.attachment.alias,
                            "sender": transaction.senderRS ? transaction.senderRS : transaction.sender
                        };

                        $("#transaction_info_table").find("tbody").append(LRS.createInfoTable(data));
                        $("#transaction_info_table").show();

                        break;
                    case 9:
                        var data = {
                            "type": $.t("transaction_approval")
                        };
                        for (i = 0; i < transaction.attachment.transactionFullHashes.length; i++) {
                            var transactionBytes = converters.hexStringToByteArray(transaction.attachment.transactionFullHashes[i]);
                            var transactionId = converters.byteArrayToBigInteger(transactionBytes, 0).toString().escapeHTML();
                            data[$.t("transaction") + (i + 1) + "_formatted_html"] = "<a href='#' class='show_transaction_modal_action' data-transaction='" + transactionId + "'>" + transactionId + "</a>";
                        }

                        $("#transaction_info_table").find("tbody").append(LRS.createInfoTable(data));
                        $("#transaction_info_table").show();

                        break;
                    default:
                        incorrect = true;
                        break;
                }
            } else if (transaction.type == 2) {
                switch (transaction.subtype) {
                    case 0:
                        var data = {
                            "type": $.t("asset_issuance"),
                            "name": transaction.attachment.name,
                            "quantity": [transaction.attachment.quantityQNT, transaction.attachment.decimals],
                            "decimals": transaction.attachment.decimals,
                            "description": transaction.attachment.description
                        };
                        data["sender"] = transaction.senderRS ? transaction.senderRS : transaction.sender;
                        $("#transaction_info_callout").html("<a href='#' data-goto-asset='" + String(transaction.transaction).escapeHTML() + "'>Click here</a> to view this asset in the Asset Exchange.").show();

                        $("#transaction_info_table").find("tbody").append(LRS.createInfoTable(data));
                        $("#transaction_info_table").show();

                        break;
                    case 1:
                        async = true;

                        LRS.sendRequest("getAsset", {
                            "asset": transaction.attachment.asset
                        }, function (asset, input) {
                            var data = {
                                "type": $.t("asset_transfer"),
                                "asset_name": asset.name,
                                "quantity": [transaction.attachment.quantityQNT, asset.decimals]
                            };

                            data["sender"] = transaction.senderRS ? transaction.senderRS : transaction.sender;
                            data["recipient"] = transaction.recipientRS ? transaction.recipientRS : transaction.recipient;

                            $("#transaction_info_table").find("tbody").append(LRS.createInfoTable(data));
                            $("#transaction_info_table").show();

                            $("#transaction_info_modal").modal("show");
                            LRS.fetchingModalData = false;
                        });

                        break;
                    case 2:
                    case 3:
                        async = true;
                        LRS.sendRequest("getAsset", {
                            "asset": transaction.attachment.asset
                        }, function (asset, input) {
                            LRS.formatAssetOrder(asset, transaction, isModalVisible)
                        });
                        break;
                    case 4:
                        async = true;

                        LRS.sendRequest("getTransaction", {
                            "transaction": transaction.attachment.order
                        }, function (transaction, input) {
                            if (transaction.attachment.asset) {
                                LRS.sendRequest("getAsset", {
                                    "asset": transaction.attachment.asset
                                }, function (asset) {
                                    var data = {
                                        "type": $.t("ask_order_cancellation"),
                                        "order_formatted_html": "<a href='#' class='show_transaction_modal_action' data-transaction='" + String(transaction.transaction).escapeHTML() + "'>" + transaction.transaction + "</a>",
                                        "asset_name": asset.name,
                                        "quantity": [transaction.attachment.quantityQNT, asset.decimals],
                                        "price_formatted_html": LRS.formatOrderPricePerWholeQNT(transaction.attachment.priceLQT, asset.decimals) + " LRD",
                                        "total_formatted_html": LRS.formatAmount(LRS.calculateOrderTotalLQT(transaction.attachment.quantityQNT, transaction.attachment.priceLQT)) + " LRD"
                                    };
                                    data["sender"] = transaction.senderRS ? transaction.senderRS : transaction.sender;
                                    $("#transaction_info_table").find("tbody").append(LRS.createInfoTable(data));
                                    $("#transaction_info_table").show();
                                    $("#transaction_info_modal").modal("show");
                                    LRS.fetchingModalData = false;
                                });
                            } else {
                                LRS.fetchingModalData = false;
                            }
                        });

                        break;
                    case 5:
                        async = true;
                        LRS.sendRequest("getTransaction", {
                            "transaction": transaction.attachment.order
                        }, function (transaction) {
                            if (transaction.attachment.asset) {
                                LRS.sendRequest("getAsset", {
                                    "asset": transaction.attachment.asset
                                }, function (asset) {
                                    var data = {
                                        "type": $.t("bid_order_cancellation"),
                                        "order_formatted_html": "<a href='#' class='show_transaction_modal_action' data-transaction='" + String(transaction.transaction).escapeHTML() + "'>" + transaction.transaction + "</a>",
                                        "asset_name": asset.name,
                                        "quantity": [transaction.attachment.quantityQNT, asset.decimals],
                                        "price_formatted_html": LRS.formatOrderPricePerWholeQNT(transaction.attachment.priceLQT, asset.decimals) + " LRD",
                                        "total_formatted_html": LRS.formatAmount(LRS.calculateOrderTotalLQT(transaction.attachment.quantityQNT, transaction.attachment.priceLQT)) + " LRD"
                                    };
                                    data["sender"] = transaction.senderRS ? transaction.senderRS : transaction.sender;
                                    $("#transaction_info_table").find("tbody").append(LRS.createInfoTable(data));
                                    $("#transaction_info_table").show();
                                    $("#transaction_info_modal").modal("show");
                                    LRS.fetchingModalData = false;
                                });
                            } else {
                                LRS.fetchingModalData = false;
                            }
                        });

                        break;
                    case 6:
                        async = true;

                        LRS.sendRequest("getTransaction", {
                            "transaction": transaction.transaction
                        }, function (transaction) {
                            if (transaction.attachment.asset) {
                                LRS.sendRequest("getAsset", {
                                    "asset": transaction.attachment.asset
                                }, function (asset) {
                                    var data = {
                                        "type": $.t("dividend_payment"),
                                        "asset_name": asset.name,
                                        "amount_per_share": LRS.formatOrderPricePerWholeQNT(transaction.attachment.amountLQTPerQNT, asset.decimals) + " LRD",
                                        "height": transaction.attachment.height
                                    };
                                    data["sender"] = transaction.senderRS ? transaction.senderRS : transaction.sender;
                                    $("#transaction_info_table").find("tbody").append(LRS.createInfoTable(data));
                                    $("#transaction_info_table").show();

                                    $("#transaction_info_modal").modal("show");
                                    LRS.fetchingModalData = false;
                                });
                            } else {
                                LRS.fetchingModalData = false;
                            }
                        });
                        break;
                    default:
                        incorrect = true;
                        break;
                }
            } else if (transaction.type == 3) {
                switch (transaction.subtype) {
                    case 0:
                        var data = {
                            "type": $.t("marketplace_listing"),
                            "name": transaction.attachment.name,
                            "description": transaction.attachment.description,
                            "price": transaction.attachment.priceLQT,
                            "quantity_formatted_html": LRS.format(transaction.attachment.quantity),
                            "seller": LRS.getAccountFormatted(transaction, "sender")
                        };

                        $("#transaction_info_table").find("tbody").append(LRS.createInfoTable(data));
                        $("#transaction_info_table").show();

                        break;
                    case 1:
                        async = true;

                        LRS.sendRequest("getDGSGood", {
                            "goods": transaction.attachment.goods
                        }, function (goods) {
                            var data = {
                                "type": $.t("marketplace_removal"),
                                "item_name": goods.name,
                                "seller": LRS.getAccountFormatted(goods, "seller")
                            };

                            $("#transaction_info_table").find("tbody").append(LRS.createInfoTable(data));
                            $("#transaction_info_table").show();

                            $("#transaction_info_modal").modal("show");
                            LRS.fetchingModalData = false;
                        });

                        break;
                    case 2:
                        async = true;

                        LRS.sendRequest("getDGSGood", {
                            "goods": transaction.attachment.goods
                        }, function (goods) {
                            var data = {
                                "type": $.t("marketplace_item_price_change"),
                                "item_name": goods.name,
                                "new_price_formatted_html": LRS.formatAmount(transaction.attachment.priceLQT) + " LRD",
                                "seller": LRS.getAccountFormatted(goods, "seller")
                            };

                            $("#transaction_info_table").find("tbody").append(LRS.createInfoTable(data));
                            $("#transaction_info_table").show();

                            $("#transaction_info_modal").modal("show");
                            LRS.fetchingModalData = false;
                        });

                        break;
                    case 3:
                        async = true;

                        LRS.sendRequest("getDGSGood", {
                            "goods": transaction.attachment.goods
                        }, function (goods) {
                            var data = {
                                "type": $.t("marketplace_item_quantity_change"),
                                "item_name": goods.name,
                                "delta_quantity": transaction.attachment.deltaQuantity,
                                "seller": LRS.getAccountFormatted(goods, "seller")
                            };

                            $("#transaction_info_table").find("tbody").append(LRS.createInfoTable(data));
                            $("#transaction_info_table").show();

                            $("#transaction_info_modal").modal("show");
                            LRS.fetchingModalData = false;
                        });

                        break;
                    case 4:
                        async = true;

                        LRS.sendRequest("getDGSGood", {
                            "goods": transaction.attachment.goods
                        }, function (goods) {
                            var data = {
                                "type": $.t("marketplace_purchase"),
                                "item_name": goods.name,
                                "price": transaction.attachment.priceLQT,
                                "quantity_formatted_html": LRS.format(transaction.attachment.quantity),
                                "buyer": LRS.getAccountFormatted(transaction, "sender"),
                                "seller": LRS.getAccountFormatted(goods, "seller")
                            };

                            $("#transaction_info_table tbody").append(LRS.createInfoTable(data));
                            $("#transaction_info_table").show();

                            LRS.sendRequest("getDGSPurchase", {
                                "purchase": transaction.transaction
                            }, function (purchase) {
                                var callout = "";

                                if (purchase.errorCode) {
                                    if (purchase.errorCode == 4) {
                                        if (transactionDetails.block == "unconfirmed") {
                                            callout = $.t("unconfirmed_transaction");
                                        } else {
                                            callout = $.t("incorrect_purchase");
                                        }
                                    } else {
                                        callout = String(purchase.errorDescription).escapeHTML();
                                    }
                                } else {
                                    if (LRS.account == transaction.recipient || LRS.account == transaction.sender) {
                                        if (purchase.pending) {
                                            if (LRS.account == transaction.recipient) {
                                                callout = "<a href='#' data-toggle='modal' data-target='#dgs_delivery_modal' data-purchase='" + String(transaction.transaction).escapeHTML() + "'>" + $.t("deliver_goods_q") + "</a>";
                                            } else {
                                                callout = $.t("waiting_on_seller");
                                            }
                                        } else {
                                            if (purchase.refundLQT) {
                                                callout = $.t("purchase_refunded");
                                            } else {
                                                callout = $.t("purchase_delivered");
                                            }
                                        }
                                    }
                                }

                                if (callout) {
                                    $("#transaction_info_bottom").html("<div class='callout " + (purchase.errorCode ? "callout-danger" : "callout-info") + " callout-bottom'>" + callout + "</div>").show();
                                }

                                $("#transaction_info_modal").modal("show");
                                LRS.fetchingModalData = false;
                            });
                        });

                        break;
                    case 5:
                        async = true;

                        LRS.sendRequest("getDGSPurchase", {
                            "purchase": transaction.attachment.purchase
                        }, function (purchase) {
                            LRS.sendRequest("getDGSGood", {
                                "goods": purchase.goods
                            }, function (goods) {
                                var data = {
                                    "type": $.t("marketplace_delivery"),
                                    "item_name": goods.name,
                                    "price": purchase.priceLQT
                                };

                                data["quantity_formatted_html"] = LRS.format(purchase.quantity);

                                if (purchase.quantity != "1") {
                                    var orderTotal = LRS.formatAmount(new BigInteger(String(purchase.quantity)).multiply(new BigInteger(String(purchase.priceLQT))));
                                    data["total_formatted_html"] = orderTotal + " LRD";
                                }

                                if (transaction.attachment.discountLQT) {
                                    data["discount"] = transaction.attachment.discountLQT;
                                }

                                data["buyer"] = LRS.getAccountFormatted(purchase, "buyer");
                                data["seller"] = LRS.getAccountFormatted(purchase, "seller");

                                if (transaction.attachment.goodsData) {
                                    if (LRS.account == purchase.seller || LRS.account == purchase.buyer) {
                                        LRS.tryToDecrypt(transaction, {
                                            "goodsData": {
                                                "title": $.t("data"),
                                                "nonce": "goodsNonce"
                                            }
                                        }, (purchase.buyer == LRS.account ? purchase.seller : purchase.buyer));
                                    } else {
                                        data["data"] = $.t("encrypted_goods_data_no_permission");
                                    }
                                }

                                $("#transaction_info_table").find("tbody").append(LRS.createInfoTable(data));
                                $("#transaction_info_table").show();

                                var callout;

                                if (LRS.account == purchase.buyer) {
                                    if (purchase.refundLQT) {
                                        callout = $.t("purchase_refunded");
                                    } else if (!purchase.feedbackNote) {
                                        callout = $.t("goods_received") + " <a href='#' data-toggle='modal' data-target='#dgs_feedback_modal' data-purchase='" + String(transaction.attachment.purchase).escapeHTML() + "'>" + $.t("give_feedback_q") + "</a>";
                                    }
                                } else if (LRS.account == purchase.seller && purchase.refundLQT) {
                                    callout = $.t("purchase_refunded");
                                }

                                if (callout) {
                                    $("#transaction_info_bottom").append("<div class='callout callout-info callout-bottom'>" + callout + "</div>").show();
                                }

                                $("#transaction_info_modal").modal("show");
                                LRS.fetchingModalData = false;
                            });
                        });

                        break;
                    case 6:
                        async = true;

                        LRS.sendRequest("getDGSPurchase", {
                            "purchase": transaction.attachment.purchase
                        }, function (purchase) {
                            LRS.sendRequest("getDGSGood", {
                                "goods": purchase.goods
                            }, function (goods) {
                                var data = {
                                    "type": $.t("marketplace_feedback"),
                                    "item_name": goods.name,
                                    "buyer": LRS.getAccountFormatted(purchase, "buyer"),
                                    "seller": LRS.getAccountFormatted(purchase, "seller")
                                };

                                $("#transaction_info_table").find("tbody").append(LRS.createInfoTable(data));
                                $("#transaction_info_table").show();

                                if (purchase.seller == LRS.account || purchase.buyer == LRS.account) {
                                    LRS.sendRequest("getDGSPurchase", {
                                        "purchase": transaction.attachment.purchase
                                    }, function (purchase) {
                                        var callout;

                                        if (purchase.buyer == LRS.account) {
                                            if (purchase.refundLQT) {
                                                callout = $.t("purchase_refunded");
                                            }
                                        } else {
                                            if (!purchase.refundLQT) {
                                                callout = "<a href='#' data-toggle='modal' data-target='#dgs_refund_modal' data-purchase='" + String(transaction.attachment.purchase).escapeHTML() + "'>" + $.t("refund_this_purchase_q") + "</a>";
                                            } else {
                                                callout = $.t("purchase_refunded");
                                            }
                                        }

                                        if (callout) {
                                            $("#transaction_info_bottom").append("<div class='callout callout-info callout-bottom'>" + callout + "</div>").show();
                                        }

                                        $("#transaction_info_modal").modal("show");
                                        LRS.fetchingModalData = false;
                                    });

                                } else {
                                    $("#transaction_info_modal").modal("show");
                                    LRS.fetchingModalData = false;
                                }
                            });
                        });

                        break;
                    case 7:
                        async = true;

                        LRS.sendRequest("getDGSPurchase", {
                            "purchase": transaction.attachment.purchase
                        }, function (purchase) {
                            LRS.sendRequest("getDGSGood", {
                                "goods": purchase.goods
                            }, function (goods) {
                                var data = {
                                    "type": $.t("marketplace_refund"),
                                    "item_name": goods.name
                                };

                                var orderTotal = new BigInteger(String(purchase.quantity)).multiply(new BigInteger(String(purchase.priceLQT)));

                                data["order_total_formatted_html"] = LRS.formatAmount(orderTotal) + " LRD";

                                data["refund"] = transaction.attachment.refundLQT;

                                data["buyer"] = LRS.getAccountFormatted(purchase, "buyer");
                                data["seller"] = LRS.getAccountFormatted(purchase, "seller");

                                $("#transaction_info_table").find("tbody").append(LRS.createInfoTable(data));
                                $("#transaction_info_table").show();

                                $("#transaction_info_modal").modal("show");
                                LRS.fetchingModalData = false;
                            });
                        });

                        break;
                    default:
                        incorrect = true;
                        break
                }
            } else if (transaction.type == 4) {
                switch (transaction.subtype) {
                    case 0:
                        var data = {
                            "type": $.t("balance_leasing"),
                            "period": transaction.attachment.period,
                            "lessee": transaction.recipientRS ? transaction.recipientRS : transaction.recipient
                        };

                        $("#transaction_info_table").find("tbody").append(LRS.createInfoTable(data));
                        $("#transaction_info_table").show();

                        break;

                    default:
                        incorrect = true;
                        break;
                }
            }
            else if (transaction.type == 5) {
                async = true;
                var currency = null;
                var id = (transaction.subtype == 0 ? transaction.transaction : transaction.attachment.currency);
                LRS.sendRequest("getCurrency", {
                    "currency": id
                }, function (response) {
                    if (!response.errorCode) {
                        currency = response;
                    }
                }, null, false);

                switch (transaction.subtype) {
                    case 0:
                        var minReservePerUnitLQT = new BigInteger(transaction.attachment.minReservePerUnitLQT).multiply(new BigInteger("" + Math.pow(10, transaction.attachment.decimals)));
                        var data = {
                            "type": $.t("currency_issuance"),
                            "name": transaction.attachment.name,
                            "code": transaction.attachment.code,
                            "currency_type": transaction.attachment.type,
                            "description_formatted_html": transaction.attachment.description.autoLink(),
                            "initial_units": [transaction.attachment.initialSupply, transaction.attachment.decimals],
                            "reserve_units": [transaction.attachment.reserveSupply, transaction.attachment.decimals],
                            "max_units": [transaction.attachment.maxSupply, transaction.attachment.decimals],
                            "decimals": transaction.attachment.decimals,
                            "issuance_height": transaction.attachment.issuanceHeight,
                            "min_reserve_per_unit_formatted_html": LRS.formatAmount(minReservePerUnitLQT) + " LRD",
                            "minDifficulty": transaction.attachment.minDifficulty,
                            "maxDifficulty": transaction.attachment.maxDifficulty,
                            "algorithm": transaction.attachment.algorithm
                        };
                        if (currency) {
                            data["current_units"] = LRS.convertToQNTf(currency.currentSupply, currency.decimals);
                            var currentReservePerUnitLQT = new BigInteger(currency.currentReservePerUnitLQT).multiply(new BigInteger("" + Math.pow(10, currency.decimals)));
                            data["current_reserve_per_unit_formatted_html"] = LRS.formatAmount(currentReservePerUnitLQT) + " LRD";
                        } else {
                            data["status"] = "Currency Deleted or not Issued";
                        }
                        break;
                    case 1:
                        if (currency) {
                            var amountPerUnitLQT = new BigInteger(transaction.attachment.amountPerUnitLQT).multiply(new BigInteger("" + Math.pow(10, currency.decimals)));
                            var resSupply = currency.reserveSupply;
                            var data = {
                                "type": $.t("reserve_increase"),
                                "code": currency.code,
                                "reserve_units": [resSupply, currency.decimals],
                                "amount_per_unit_formatted_html": LRS.formatAmount(amountPerUnitLQT) + " LRD",
                                "reserved_amount_formatted_html": LRS.formatAmount(LRS.calculateOrderTotalLQT(amountPerUnitLQT, LRS.convertToQNTf(resSupply, currency.decimals))) + " LRD"
                            };
                        } else {
                            data = LRS.getUnknownCurrencyData(transaction);
                        }
                        break;
                    case 2:
                        if (currency) {
                            var currentReservePerUnitLQT = new BigInteger(currency.currentReservePerUnitLQT).multiply(new BigInteger("" + Math.pow(10, currency.decimals)));
                            var data = {
                                "type": $.t("reserve_claim"),
                                "code": currency.code,
                                "units": [transaction.attachment.units, currency.decimals],
                                "claimed_amount_formatted_html": LRS.formatAmount(LRS.convertToQNTf(LRS.calculateOrderTotalLQT(currentReservePerUnitLQT, transaction.attachment.units), currency.decimals)) + " LRD"
                            };
                        } else {
                            data = LRS.getUnknownCurrencyData(transaction);
                        }
                        break;
                    case 3:
                        if (currency) {
                            var data = {
                                "type": $.t("currency_transfer"),
                                "code": currency.code,
                                "units": [transaction.attachment.units, currency.decimals]
                            };
                        } else {
                            data = LRS.getUnknownCurrencyData(transaction);
                        }
                        break;
                    case 4:
                        if (currency) {
                            data = LRS.formatCurrencyOffer(currency, transaction);
                        } else {
                            data = LRS.getUnknownCurrencyData(transaction);
                        }
                        break;
                    case 5:
                        if (currency) {
                            data = LRS.formatCurrencyExchange(currency, transaction, "buy");
                        } else {
                            data = LRS.getUnknownCurrencyData(transaction);
                        }
                        break;
                    case 6:
                        if (currency) {
                            data = LRS.formatCurrencyExchange(currency, transaction, "sell");
                        } else {
                            data = LRS.getUnknownCurrencyData(transaction);
                        }
                        break;
                    case 7:
                        if (currency) {
                            var data = {
                                "type": $.t("mint_currency"),
                                "code": currency.code,
                                "units": [transaction.attachment.units, currency.decimals],
                                "counter": transaction.attachment.counter,
                                "nonce": transaction.attachment.nonce
                            };
                        } else {
                            data = LRS.getUnknownCurrencyData(transaction);
                        }
                        break;
                    case 8:
                        if (currency) {
                            var data = {
                                "type": $.t("delete_currency"),
                                "code": currency.code
                            };
                        } else {
                            data = LRS.getUnknownCurrencyData(transaction);
                        }
                        break;
                    default:
                        incorrect = true;
                        break;
                }
                if (!incorrect) {
                    if (transaction.sender != LRS.account) {
                        data["sender"] = transaction.senderRS ? transaction.senderRS : transaction.sender;
                    }

                    $("#transaction_info_callout").html("");
                    if (currency != null && LRS.isExchangeable(currency.type)) {
                        $("#transaction_info_callout").append("<a href='#' data-goto-currency='" + String(currency.code).escapeHTML() + "'>" + $.t('exchange_booth') + "</a><br/>");
                    }
                    if (currency != null && LRS.isReservable(currency.type)) {
                        $("#transaction_info_callout").append("<a href='#' data-toggle='modal' data-target='#currency_founders_modal' data-currency='" + String(currency.currency).escapeHTML() + "' data-name='" + String(currency.name).escapeHTML() + "' data-code='" + String(currency.code).escapeHTML() + "' data-ressupply='" + String(currency.reserveSupply).escapeHTML() + "' data-initialsupply='" + String(currency.initialSupply).escapeHTML() + "' data-decimals='" + String(currency.decimals).escapeHTML() + "' data-minreserve='" + String(currency.minReservePerUnitLQT).escapeHTML() + "' data-issueheight='" + String(currency.issuanceHeight).escapeHTML() + "'>View Founders</a><br/>");
                    }
                    if (currency != null) {
                        $("#transaction_info_callout").append("<a href='#' data-toggle='modal' data-target='#currency_distribution_modal' data-code='" + String(currency.code).escapeHTML() + "'  data-i18n='Currency Distribution'>Currency Distribution</a>");
                    }
                    $("#transaction_info_callout").show();

                    $("#transaction_info_table").find("tbody").append(LRS.createInfoTable(data));
                    $("#transaction_info_table").show();

                    if (!isModalVisible) {
                        $("#transaction_info_modal").modal("show");
                    }
                    LRS.fetchingModalData = false;
                }
            } else if (transaction.type == 6) {
                switch (transaction.subtype) {
                    case 0:
                        var data = LRS.getTaggedData(transaction.attachment, 0);
                        $("#transaction_info_table").find("tbody").append(LRS.createInfoTable(data));
                        $("#transaction_info_table").show();

                        break;
                    case 1:
                        var data = LRS.getTaggedData(transaction.attachment, 1);
                        $("#transaction_info_table").find("tbody").append(LRS.createInfoTable(data));
                        $("#transaction_info_table").show();

                        break;

                    default:
                        incorrect = true;
                        break;
                }
            }

            if (!(transaction.type == 1 && transaction.subtype == 0)) {
                if (transaction.attachment) {
                    if (transaction.attachment.message) {
                        if (!transaction.attachment["version.Message"] && !transaction.attachment["version.PrunablePlainMessage"]) {
                            try {
                                message = converters.hexStringToString(transaction.attachment.message);
                            } catch (err) {
                                //legacy
                                if (transaction.attachment.message.indexOf("feff") === 0) {
                                    message = LRS.convertFromHex16(transaction.attachment.message);
                                } else {
                                    message = LRS.convertFromHex8(transaction.attachment.message);
                                }
                            }
                        } else {
                            message = String(transaction.attachment.message);
                        }

                        $("#transaction_info_output_bottom").append("<div style='padding-left:5px;'><label><i class='fa fa-unlock'></i> " + $.t("public_message") + "</label><div>" + String(message).escapeHTML().nl2br() + "</div></div>");
                    }

                    if (transaction.attachment.encryptedMessage || (transaction.attachment.encryptToSelfMessage && LRS.account == transaction.sender)) {
                        if (transaction.attachment.message) {
                            $("#transaction_info_output_bottom").append("<div style='height:5px'></div>");
                        }

                        if (LRS.account == transaction.sender || LRS.account == transaction.recipient) {
                            var fieldsToDecrypt = {};

                            if (transaction.attachment.encryptedMessage) {
                                fieldsToDecrypt.encryptedMessage = $.t("encrypted_message");
                            }
                            if (transaction.attachment.encryptToSelfMessage && LRS.account == transaction.sender) {
                                fieldsToDecrypt.encryptToSelfMessage = $.t("note_to_self");
                            }

                            LRS.tryToDecrypt(transaction, fieldsToDecrypt, (transaction.recipient == LRS.account ? transaction.sender : transaction.recipient), {
                                "formEl": "#transaction_info_output_bottom",
                                "outputEl": "#transaction_info_output_bottom"
                            });
                        } else {
                            $("#transaction_info_output_bottom").append("<div style='padding-left:5px;'><label><i class='fa fa-lock'></i> " + $.t("encrypted_message") + "</label><div>" + $.t("encrypted_message_no_permission") + "</div></div>");
                        }
                    }

                    $("#transaction_info_output_bottom").show();
                }
            }

            if (incorrect) {
                $.growl($.t("error_unknown_transaction_type"), {
                    "type": "danger"
                });

                LRS.fetchingModalData = false;
                return;
            }

            if (!async) {
                if (!isModalVisible) {
                    $("#transaction_info_modal").modal("show");
                }
                LRS.fetchingModalData = false;
            }
        } catch (e) {
            LRS.fetchingModalData = false;
            throw e;
        }
    };

    LRS.formatAssetOrder = function (asset, transaction, isModalVisible) {
        var data = {
            "type": (transaction.subtype == 2 ? $.t("ask_order_placement") : $.t("bid_order_placement")),
            "asset_name": asset.name,
            "quantity": [transaction.attachment.quantityQNT, asset.decimals],
            "price_formatted_html": LRS.formatOrderPricePerWholeQNT(transaction.attachment.priceLQT, asset.decimals) + " LRD",
            "total_formatted_html": LRS.formatAmount(LRS.calculateOrderTotalLQT(transaction.attachment.quantityQNT, transaction.attachment.priceLQT)) + " LRD"
        };
        data["sender"] = transaction.senderRS ? transaction.senderRS : transaction.sender;
        var rows = "";
        var params;
        if (transaction.subtype == 2) {
            params = {"askOrder": transaction.transaction};
        } else {
            params = {"bidOrder": transaction.transaction};
        }
        var transactionField = (transaction.subtype == 2 ? "bidOrder" : "askOrder");
        LRS.sendRequest("getOrderTrades", params, function (response) {
            var tradeQuantity = BigInteger.ZERO;
            var tradeTotal = BigInteger.ZERO;
            if (response.trades && response.trades.length > 0) {
                rows = "<table class='table table-striped'><thead><tr>" +
                "<th>" + $.t("Date") + "</th>" +
                "<th>" + $.t("Quantity") + "</th>" +
                "<th>" + $.t("Price") + "</th>" +
                "<th>" + $.t("Total") + "</th>" +
                "<tr></thead><tbody>";
                for (var i = 0; i < response.trades.length; i++) {
                    var trade = response.trades[i];
                    tradeQuantity = tradeQuantity.add(new BigInteger(trade.quantityQNT));
                    tradeTotal = tradeTotal.add(new BigInteger(trade.quantityQNT).multiply(new BigInteger(trade.priceLQT)));
                    rows += "<tr>" +
                    "<td><a href='#' class='show_transaction_modal_action' data-transaction='" + String(trade[transactionField]).escapeHTML() + "'>" + LRS.formatTimestamp(trade.timestamp) + "</a>" +
                    "<td>" + LRS.formatQuantity(trade.quantityQNT, asset.decimals) + "</td>" +
                    "<td>" + LRS.calculateOrderPricePerWholeQNT(trade.priceLQT, asset.decimals) + "</td>" +
                    "<td>" + LRS.formatAmount(LRS.calculateOrderTotalLQT(trade.quantityQNT, trade.priceLQT)) +
                    "</td>" +
                    "</tr>";
                }
                rows += "</tbody></table>";
                data["trades_formatted_html"] = rows;
            } else {
                data["trades"] = $.t("no_matching_trade");
            }
            data["quantity_traded"] = [tradeQuantity, asset.decimals];
            data["total_traded"] = LRS.formatAmount(tradeTotal, false, true) + " LRD";
        }, null, false);

        var infoTable = $("#transaction_info_table");
        infoTable.find("tbody").append(LRS.createInfoTable(data));
        infoTable.show();
        if (!isModalVisible) {
            $("#transaction_info_modal").modal("show");
        }
        LRS.fetchingModalData = false;
    };

    LRS.formatCurrencyExchange = function (currency, transaction, type) {
        var rateUnitsStr = " [ " + currency.code + " / LRD ]";
        var data = {
            "type": type == "sell" ? $.t("sell_currency") : $.t("buy_currency"),
            "code": currency.code,
            "units": [transaction.attachment.units, currency.decimals],
            "rate": LRS.calculateOrderPricePerWholeQNT(transaction.attachment.rateLQT, currency.decimals) + rateUnitsStr,
            "total_formatted_html": LRS.formatAmount(LRS.calculateOrderTotalLQT(transaction.attachment.units, transaction.attachment.rateLQT)) + " LRD"
        };
        var rows = "";
        LRS.sendRequest("getExchangesByExchangeRequest", {
            "transaction": transaction.transaction
        }, function (response) {
            var exchangedUnits = BigInteger.ZERO;
            var exchangedTotal = BigInteger.ZERO;
            if (response.exchanges && response.exchanges.length > 0) {
                rows = "<table class='table table-striped'><thead><tr>" +
                "<th>" + $.t("Date") + "</th>" +
                "<th>" + $.t("Units") + "</th>" +
                "<th>" + $.t("Rate") + "</th>" +
                "<th>" + $.t("Total") + "</th>" +
                "<tr></thead><tbody>";
                for (var i = 0; i < response.exchanges.length; i++) {
                    var exchange = response.exchanges[i];
                    exchangedUnits = exchangedUnits.add(new BigInteger(exchange.units));
                    exchangedTotal = exchangedTotal.add(new BigInteger(exchange.units).multiply(new BigInteger(exchange.rateLQT)));
                    rows += "<tr>" +
                    "<td><a href='#' class='show_transaction_modal_action' data-transaction='" + String(exchange.offer).escapeHTML() + "'>" + LRS.formatTimestamp(exchange.timestamp) + "</a>" +
                    "<td>" + LRS.formatQuantity(exchange.units, exchange.decimals) + "</td>" +
                    "<td>" + LRS.calculateOrderPricePerWholeQNT(exchange.rateLQT, exchange.decimals) + "</td>" +
                    "<td>" + LRS.formatAmount(LRS.calculateOrderTotalLQT(exchange.units, exchange.rateLQT)) +
                    "</td>" +
                    "</tr>";
                }
                rows += "</tbody></table>";
                data["exchanges_formatted_html"] = rows;
            } else {
                data["exchanges"] = $.t("no_matching_exchange_offer");
            }
            data["units_exchanged"] = [exchangedUnits, currency.decimals];
            data["total_exchanged"] = LRS.formatAmount(exchangedTotal, false, true) + " [LRD]";
        }, null, false);
        return data;
    };

    LRS.formatCurrencyOffer = function (currency, transaction) {
        var rateUnitsStr = " [ " + currency.code + " / LRD ]";
        var buyOffer;
        var sellOffer;
        LRS.sendRequest("getOffer", {
            "offer": transaction.transaction
        }, function (response) {
            buyOffer = response.buyOffer;
            sellOffer = response.sellOffer;
        }, null, false);
        var data = {};
        if (buyOffer && sellOffer) {
            data = {
                "type": $.t("exchange_offer"),
                "code": currency.code,
                "buy_supply_formatted_html": LRS.formatQuantity(buyOffer.supply, currency.decimals) + " (initial: " + LRS.formatQuantity(transaction.attachment.initialBuySupply, currency.decimals) + ")",
                "buy_limit_formatted_html": LRS.formatQuantity(buyOffer.limit, currency.decimals) + " (initial: " + LRS.formatQuantity(transaction.attachment.totalBuyLimit, currency.decimals) + ")",
                "buy_rate_formatted_html": LRS.calculateOrderPricePerWholeQNT(transaction.attachment.buyRateLQT, currency.decimals) + rateUnitsStr,
                "sell_supply_formatted_html": LRS.formatQuantity(sellOffer.supply, currency.decimals) + " (initial: " + LRS.formatQuantity(transaction.attachment.initialSellSupply, currency.decimals) + ")",
                "sell_limit_formatted_html": LRS.formatQuantity(sellOffer.limit, currency.decimals) + " (initial: " + LRS.formatQuantity(transaction.attachment.totalSellLimit, currency.decimals) + ")",
                "sell_rate_formatted_html": LRS.calculateOrderPricePerWholeQNT(transaction.attachment.sellRateLQT, currency.decimals) + rateUnitsStr,
                "expiration_height": transaction.attachment.expirationHeight
            };
        } else {
            data["offer"] = $.t("no_matching_exchange_offer");
        }
        var rows = "";
        LRS.sendRequest("getExchangesByOffer", {
            "offer": transaction.transaction
        }, function (response) {
            var exchangedUnits = BigInteger.ZERO;
            var exchangedTotal = BigInteger.ZERO;
            if (response.exchanges && response.exchanges.length > 0) {
                rows = "<table class='table table-striped'><thead><tr>" +
                "<th>" + $.t("Date") + "</th>" +
                "<th>" + $.t("Type") + "</th>" +
                "<th>" + $.t("Units") + "</th>" +
                "<th>" + $.t("Rate") + "</th>" +
                "<th>" + $.t("Total") + "</th>" +
                "<tr></thead><tbody>";
                for (var i = 0; i < response.exchanges.length; i++) {
                    var exchange = response.exchanges[i];
                    exchangedUnits = exchangedUnits.add(new BigInteger(exchange.units));
                    exchangedTotal = exchangedTotal.add(new BigInteger(exchange.units).multiply(new BigInteger(exchange.rateLQT)));
                    var exchangeType = exchange.seller == transaction.sender ? "Buy" : "Sell";
                    if (exchange.seller == exchange.buyer) {
                        exchangeType = "Same";
                    }
                    rows += "<tr>" +
                    "<td><a href='#' class='show_transaction_modal_action' data-transaction='" + String(exchange.transaction).escapeHTML() + "'>" + LRS.formatTimestamp(exchange.timestamp) + "</a>" +
                    "<td>" + exchangeType + "</td>" +
                    "<td>" + LRS.formatQuantity(exchange.units, exchange.decimals) + "</td>" +
                    "<td>" + LRS.calculateOrderPricePerWholeQNT(exchange.rateLQT, exchange.decimals) + "</td>" +
                    "<td>" + LRS.formatAmount(LRS.calculateOrderTotalLQT(exchange.units, exchange.rateLQT)) +
                    "</td>" +
                    "</tr>";
                }
                rows += "</tbody></table>";
                data["exchanges_formatted_html"] = rows;
            } else {
                data["exchanges"] = $.t("no_matching_exchange_request");
            }
            data["units_exchanged"] = [exchangedUnits, currency.decimals];
            data["total_exchanged"] = LRS.formatAmount(exchangedTotal, false, true) + " [LRD]";
        }, null, false);
        return data;
    };

    LRS.getUnknownCurrencyData = function (transaction) {
        if (!transaction) {
            return {};
        }
        var data = {
            "status": "Currency Deleted or not Issued",
            "type": transaction.type,
            "subType": transaction.subtype
        };
        return data;
    };

    LRS.getTaggedData = function (attachment, subtype) {
        var data = {
            "type": $.t(LRS.transactionTypes[6].subTypes[subtype].i18nKeyTitle)
        };
        if (attachment.hash) {
            data["hash"] = attachment.hash;
        }
        if (attachment.taggedData) {
            data["taggedData"] = attachment.taggedData;
        }
        if (attachment.data) {
            data["name"] = attachment.name;
            data["description"] = attachment.description;
            data["tags"] = attachment.tags;
            data["mime_type"] = attachment.type;
            data["channel"] = attachment.channel;
            data["is_text"] = attachment.isText;
            data["filename"] = attachment.filename;
            if (attachment.isText == "true") {
                data["data_size"] = LRS.getUtf8Bytes(attachment.data).length;
            } else {
                data["data_size"] = converters.hexStringToByteArray(attachment.data).length;
            }
        }
        return data;
    };

    $(document).on("click", ".approve_transaction_btn", function (e) {
        e.preventDefault();
        var approveTransactionModal = $('#approve_transaction_modal');
        approveTransactionModal.find('.at_transaction_full_hash_display').text($(this).data("transaction"));
        approveTransactionModal.find('.at_transaction_timestamp').text(LRS.formatTimestamp($(this).data("timestamp")));
        $("#approve_transaction_button").data("transaction", $(this).data("transaction"));
        approveTransactionModal.find('#at_transaction_full_hash').val($(this).data("fullhash"));

        var mbFormatted = $(this).data("minBalanceFormatted");
        var minBalanceWarning = $('#at_min_balance_warning');
        if (mbFormatted && mbFormatted != "") {
            minBalanceWarning.find('.at_min_balance_amount').html(mbFormatted);
            minBalanceWarning.show();
        } else {
            minBalanceWarning.hide();
        }
        var revealSecretDiv = $("#at_revealed_secret_div");
        if ($(this).data("votingmodel") == LRS.constants.VOTING_MODELS.HASH) {
            revealSecretDiv.show();
        } else {
            revealSecretDiv.hide();
        }
    });

    $("#approve_transaction_button").on("click", function (e) {
        $('.tr_transaction_' + $(this).data("transaction") + ':visible .approve_transaction_btn').attr('disabled', true);
    });

    $("#transaction_info_modal").on("hide.bs.modal", function (e) {
        LRS.removeDecryptionForm($(this));
        $("#transaction_info_output_bottom, #transaction_info_output_top, #transaction_info_bottom").html("").hide();
    });

    return LRS;
}(LRS || {}, jQuery));

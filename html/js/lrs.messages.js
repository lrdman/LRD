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
var LRS = (function(LRS, $) {
	var _messages = {};
	var _latestMessages = {};

	LRS.pages.messages = function(callback) {
		_messages = {};

		$(".content.content-stretch:visible").width($(".page:visible").width());

		LRS.sendRequest("getBlockchainTransactions+", {
			"account": LRS.account,
			"firstIndex": 0,
			"lastIndex": 75,
			"type": 1,
			"subtype": 0
		}, function(response) {
			if (response.transactions && response.transactions.length) {
				for (var i = 0; i < response.transactions.length; i++) {
					var otherUser = (response.transactions[i].recipient == LRS.account ? response.transactions[i].sender : response.transactions[i].recipient);

					if (!(otherUser in _messages)) {
						_messages[otherUser] = [];
					}

					_messages[otherUser].push(response.transactions[i]);
				}
				
				displayMessageSidebar(callback);
			} else {
				$("#no_message_selected").hide();
				$("#no_messages_available").show();
				$("#messages_sidebar").empty();
				LRS.pageLoaded(callback);
			}
		});
	};

	LRS.setup.messages = function() {
		var options = {
			"id": 'sidebar_messages',
			"titleHTML": '<i class="fa fa-envelope"></i> <span data-i18n="messages">Messages</span>',
			"page": 'messages',
			"desiredPosition": 90
		};
		LRS.addSimpleSidebarMenuItem(options);
	};

	function displayMessageSidebar(callback) {
		var activeAccount = false;

      var messagesSidebar = $("#messages_sidebar");
      var $active = messagesSidebar.find("a.active");

		if ($active.length) {
			activeAccount = $active.data("account");
		}

		var rows = "";
		var sortedMessages = [];

		for (var otherUser in _messages) {
			if (!_messages.hasOwnProperty(otherUser)) {
				continue;
			}
			_messages[otherUser].sort(function(a, b) {
				if (a.timestamp > b.timestamp) {
					return 1;
				} else if (a.timestamp < b.timestamp) {
					return -1;
				} else {
					return 0;
				}
			});

			var otherUserRS = (otherUser == _messages[otherUser][0].sender ? _messages[otherUser][0].senderRS : _messages[otherUser][0].recipientRS);

			sortedMessages.push({
				"timestamp": _messages[otherUser][_messages[otherUser].length - 1].timestamp,
				"user": otherUser,
				"userRS": otherUserRS
			});
		}

		sortedMessages.sort(function(a, b) {
			if (a.timestamp < b.timestamp) {
				return 1;
			} else if (a.timestamp > b.timestamp) {
				return -1;
			} else {
				return 0;
			}
		});

		for (var i = 0; i < sortedMessages.length; i++) {
			var sortedMessage = sortedMessages[i];

			var extra = "";

			if (sortedMessage.user in LRS.contacts) {
				extra = " data-contact='" + LRS.getAccountTitle(sortedMessage, "user") + "' data-context='messages_sidebar_update_context'";
			}

			rows += "<a href='#' class='list-group-item' data-account='" + LRS.getAccountFormatted(sortedMessage, "user") + "' data-account-id='" + LRS.getAccountFormatted(sortedMessage.user) + "'" + extra + "><h4 class='list-group-item-heading'>" + LRS.getAccountTitle(sortedMessage, "user") + "</h4><p class='list-group-item-text'>" + LRS.formatTimestamp(sortedMessage.timestamp) + "</p></a>";
		}

		messagesSidebar.empty().append(rows);

		if (activeAccount) {
			messagesSidebar.find("a[data-account=" + activeAccount + "]").addClass("active").trigger("click");
		}

		LRS.pageLoaded(callback);
	}

	LRS.incoming.messages = function(transactions) {
		if (LRS.hasTransactionUpdates(transactions)) {
			if (transactions.length) {
				for (var i=0; i<transactions.length; i++) {
					var trans = transactions[i];
					if (trans.confirmed && trans.type == 1 && trans.subtype == 0 && trans.senderRS != LRS.accountRS) {
						if (trans.height >= LRS.lastBlockHeight - 3 && !_latestMessages[trans.transaction]) {
							_latestMessages[trans.transaction] = trans;
							$.growl($.t("you_received_message", {
								"account": LRS.getAccountFormatted(trans, "sender"),
								"name": LRS.getAccountTitle(trans, "sender")
							}), {
								"type": "success"
							});
						}
					}
				}
			}

			if (LRS.currentPage == "messages") {
				LRS.loadPage("messages");
			}
		}
	};

	$("#messages_sidebar").on("click", "a", function(e) {
		e.preventDefault();

		$("#messages_sidebar").find("a.active").removeClass("active");
		$(this).addClass("active");

		var otherUser = $(this).data("account-id");

		$("#no_message_selected, #no_messages_available").hide();

		$("#inline_message_recipient").val(otherUser);
		$("#inline_message_form").show();

		var last_day = "";
		var output = "<dl class='chat'>";

		var messages = _messages[otherUser];
		if (messages) {
			for (var i = 0; i < messages.length; i++) {
				var decoded = false;
				var extra = "";
				var type = "";

				if (!messages[i].attachment) {
					decoded = $.t("message_empty");
				} else if (messages[i].attachment.encryptedMessage) {
					try {
						decoded = LRS.tryToDecryptMessage(messages[i]);
						extra = "decrypted";
					} catch (err) {
						if (err.errorCode && err.errorCode == 1) {
							decoded = $.t("error_decryption_passphrase_required");
							extra = "to_decrypt";
						} else {
							decoded = $.t("error_decryption_unknown");
						}
					}
				} else if (messages[i].attachment.message) {
					if (!messages[i].attachment["version.Message"] && !messages[i].attachment["version.PrunablePlainMessage"]) {
						try {
							decoded = converters.hexStringToString(messages[i].attachment.message);
						} catch (err) {
							//legacy
							if (messages[i].attachment.message.indexOf("feff") === 0) {
								decoded = LRS.convertFromHex16(messages[i].attachment.message);
							} else {
								decoded = LRS.convertFromHex8(messages[i].attachment.message);
							}
						}
					} else {
						decoded = String(messages[i].attachment.message);
					}
				} else if (messages[i].attachment.messageHash || messages[i].attachment.encryptedMessageHash) {
					decoded = $.t("message_pruned");
				} else {
					decoded = $.t("message_empty");
				}

				if (decoded !== false) {
					if (!decoded) {
						decoded = $.t("message_empty");
					}
					decoded = String(decoded).escapeHTML().nl2br();

					if (extra == "to_decrypt") {
						decoded = "<i class='fa fa-warning'></i> " + decoded;
					} else if (extra == "decrypted") {
						if (type == "payment") {
							decoded = "<strong>+" + LRS.formatAmount(messages[i].amountLQT) + " LRD</strong><br />" + decoded;
						}

						decoded = "<i class='fa fa-lock'></i> " + decoded;
					}
				} else {
					decoded = "<i class='fa fa-warning'></i> " + $.t("error_could_not_decrypt_message");
					extra = "decryption_failed";
				}

				var day = LRS.formatTimestamp(messages[i].timestamp, true);

				if (day != last_day) {
					output += "<dt><strong>" + day + "</strong></dt>";
					last_day = day;
				}

				output += "<dd class='" + (messages[i].recipient == LRS.account ? "from" : "to") + (extra ? " " + extra : "") + "'><p>" + decoded + "</p></dd>";
			}
		}
		output += "</dl>";

		$("#message_details").empty().append(output);
      var splitter = $('#messages_page').find('.content-splitter-right-inner');
      splitter.scrollTop(splitter[0].scrollHeight);
	});

	$("#messages_sidebar_context").on("click", "a", function(e) {
		e.preventDefault();

		var account = LRS.getAccountFormatted(LRS.selectedContext.data("account"));
		var option = $(this).data("option");

		LRS.closeContextMenu();

		if (option == "add_contact") {
			$("#add_contact_account_id").val(account).trigger("blur");
			$("#add_contact_modal").modal("show");
		} else if (option == "send_lrd") {
			$("#send_money_recipient").val(account).trigger("blur");
			$("#send_money_modal").modal("show");
		} else if (option == "account_info") {
			LRS.showAccountModal(account);
		}
	});

	$("#messages_sidebar_update_context").on("click", "a", function(e) {
		e.preventDefault();

		var account = LRS.getAccountFormatted(LRS.selectedContext.data("account"));
		var option = $(this).data("option");

		LRS.closeContextMenu();

		if (option == "update_contact") {
			$("#update_contact_modal").modal("show");
		} else if (option == "send_lrd") {
			$("#send_money_recipient").val(LRS.selectedContext.data("contact")).trigger("blur");
			$("#send_money_modal").modal("show");
		}

	});

	$("body").on("click", "a[data-goto-messages-account]", function(e) {
		e.preventDefault();
		
		var account = $(this).data("goto-messages-account");
		LRS.goToPage("messages", function(){ $('#message_sidebar').find('a[data-account=' + account + ']').trigger('click'); });
	});

	LRS.forms.sendMessage = function($modal) {
		var data = LRS.getFormData($modal.find("form:first"));
		var converted = $modal.find("input[name=converted_account_id]").val();
		if (converted) {
			data.recipient = converted;
		}
		return {
			"data": data
		};
	};

	$("#inline_message_form").submit(function(e) {
		e.preventDefault();
      var passpharse = $("#inline_message_password").val();
      var data = {
			"recipient": $.trim($("#inline_message_recipient").val()),
			"feeLRD": "1",
			"deadline": "1440",
			"secretPhrase": $.trim(passpharse)
		};

		if (!LRS.rememberPassword) {
			if (passpharse == "") {
				$.growl($.t("error_passphrase_required"), {
					"type": "danger"
				});
				return;
			}

			var accountId = LRS.getAccountId(data.secretPhrase);

			if (accountId != LRS.account) {
				$.growl($.t("error_passphrase_incorrect"), {
					"type": "danger"
				});
				return;
			}
		}

		data.message = $.trim($("#inline_message_text").val());

		var $btn = $("#inline_message_submit");

		$btn.button("loading");

		var requestType = "sendMessage";

		if ($("#inline_message_encrypt").is(":checked")) {
			data.encrypt_message = true;
		}

		if (data.message) {
			try {
				data = LRS.addMessageData(data, "sendMessage");
			} catch (err) {
				$.growl(String(err.message).escapeHTML(), {
					"type": "danger"
				});
				return;
			}
		} else {
			data["_extra"] = {
				"message": data.message
			};
		}

		LRS.sendRequest(requestType, data, function(response) {
			if (response.errorCode) {
				$.growl(LRS.translateServerError(response).escapeHTML(), {
					type: "danger"
				});
			} else if (response.fullHash) {
				$.growl($.t("success_message_sent"), {
					type: "success"
				});

				$("#inline_message_text").val("");

				if (data["_extra"].message && data.encryptedMessageData) {
					LRS.addDecryptedTransaction(response.transaction, {
						"encryptedMessage": String(data["_extra"].message)
					});
				}

				LRS.addUnconfirmedTransaction(response.transaction, function(alreadyProcessed) {
					if (!alreadyProcessed) {
						$("#message_details").find("dl.chat").append("<dd class='to tentative" + (data.encryptedMessageData ? " decrypted" : "") + "'><p>" + (data.encryptedMessageData ? "<i class='fa fa-lock'></i> " : "") + (!data["_extra"].message ? $.t("message_empty") : String(data["_extra"].message).escapeHTML()) + "</p></dd>");
                  var splitter = $('#messages_page').find('.content-splitter-right-inner');
                  splitter.scrollTop(splitter[0].scrollHeight);
					}
				});

				//leave password alone until user moves to another page.
			} else {
				//TODO
				$.growl($.t("error_send_message"), {
					type: "danger"
				});
			}
			$btn.button("reset");
		});
	});

	LRS.forms.sendMessageComplete = function(response, data) {
		data.message = data._extra.message;
		if (!(data["_extra"] && data["_extra"].convertedAccount)) {
			$.growl($.t("success_message_sent") + " <a href='#' data-account='" + LRS.getAccountFormatted(data, "recipient") + "' data-toggle='modal' data-target='#add_contact_modal' style='text-decoration:underline'>" + $.t("add_recipient_to_contacts_q") + "</a>", {
				"type": "success"
			});
		} else {
			$.growl($.t("success_message_sent"), {
				"type": "success"
			});
		}
	};

	$("#message_details").on("click", "dd.to_decrypt", function() {
		$("#messages_decrypt_modal").modal("show");
	});

	LRS.forms.decryptMessages = function($modal) {
		var data = LRS.getFormData($modal.find("form:first"));
		var success = false;

		try {
			var messagesToDecrypt = [];
			for (var otherUser in _messages) {
				if (!_messages.hasOwnProperty(otherUser)) {
					continue;
				}
				for (var key in _messages[otherUser]) {
					if (!_messages[otherUser].hasOwnProperty(key)) {
						continue;
					}
					var message = _messages[otherUser][key];
					if (message.attachment && message.attachment.encryptedMessage) {
						messagesToDecrypt.push(message);
					}
				}
			}
			success = LRS.decryptAllMessages(messagesToDecrypt, data.secretPhrase);
		} catch (err) {
			if (err.errorCode && err.errorCode <= 2) {
				return {
					"error": err.message.escapeHTML()
				};
			} else {
				return {
					"error": $.t("error_messages_decrypt")
				};
			}
		}

		if (data.rememberPassword) {
			LRS.setDecryptionPassword(data.secretPhrase);
		}

		$("#messages_sidebar").find("a.active").trigger("click");

		if (success) {
			$.growl($.t("success_messages_decrypt"), {
				"type": "success"
			});
		} else {
			$.growl($.t("error_messages_decrypt"), {
				"type": "danger"
			});
		}

		return {
			"stop": true
		};
	};

    $('#upload_file').bind('change', function () {
        // Mimics the server side SizeBasedFee calculation
        var size = this.files[0].size;
        size += LRS.getUtf8Bytes($('#tagged_data_name').val()).length;
        size += LRS.getUtf8Bytes($('#tagged_data_description').val()).length;
        size += LRS.getUtf8Bytes($('#tagged_data_tags').val()).length;
        size += LRS.getUtf8Bytes($('#tagged_data_type').val()).length;
        size += LRS.getUtf8Bytes($('#tagged_data_channel').val()).length;
        size += LRS.getUtf8Bytes(this.files[0].name).length;
        var dataFee = parseInt(new BigInteger("" + size).divide(new BigInteger("1024")).toString()) * 0.1;
        $('#upload_data_fee').val(1 + dataFee);
        $('#upload_data_fee_label').html(String(1 + dataFee) + " LRD");
    });

    $("#extend_data_modal").on("show.bs.modal", function (e) {
        var $invoker = $(e.relatedTarget);
        var transaction = $invoker.data("transaction");
        $("#extend_data_transaction").val(transaction);
        LRS.sendRequest("getTransaction", {
            "transaction": transaction
        }, function (response) {
            var fee = LRS.convertToLRD(String(response.feeLQT).escapeHTML());
            $('#extend_data_fee').val(fee);
            $('#extend_data_fee_label').html(String(fee) + " LRD");
        })
    });


	return LRS;
}(LRS || {}, jQuery));
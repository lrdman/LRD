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
var LRS = (function(LRS, $, undefined) {
	$("body").on("click", ".show_block_modal_action", function(event) {
		event.preventDefault();
		if (LRS.fetchingModalData) {
			return;
		}
		LRS.fetchingModalData = true;
		var blockHeight = $(this).data("block");
		LRS.sendRequest("getBlock+", {
			"height": blockHeight,
			"includeTransactions": "true"
		}, function(response) {
			LRS.showBlockModal(response);
		});
	});

	LRS.showBlockModal = function(block) {
		$("#block_info_modal_block").html(String(block.block).escapeHTML());
		$("#block_info_transactions_tab_link").tab("show");

		var blockDetails = $.extend({}, block);
		delete blockDetails.transactions;
		delete blockDetails.previousBlockHash;
		delete blockDetails.nextBlockHash;
		delete blockDetails.generationSignature;
		delete blockDetails.payloadHash;
		delete blockDetails.block;
		if (blockDetails.timestamp) {
            blockDetails.blockGenerationTime = LRS.formatTimestamp(blockDetails.timestamp);
        }
		var detailsTable = $("#block_info_details_table");
		detailsTable.find("tbody").empty().append(LRS.createInfoTable(blockDetails));
		detailsTable.show();
		var transactionsTable = $("#block_info_transactions_table");
        if (block.transactions.length) {
			$("#block_info_transactions_none").hide();
			transactionsTable.show();
			block.transactions.sort(function(a, b) {
				return a.timestamp - b.timestamp;
			});
			var rows = "";
			for (var i = 0; i < block.transactions.length; i++) {
				var transaction = block.transactions[i];
				if (transaction.amountLQT) {
					transaction.amount = new BigInteger(transaction.amountLQT);
					transaction.fee = new BigInteger(transaction.feeLQT);
                    rows += "<tr>" +
                        "<td><a href='#' class='show_transaction_modal_action' data-transaction='" + String(transaction.transaction).escapeHTML() + "'>" + LRS.formatTimestamp(transaction.timestamp) + "</a></td>" +
                        "<td>" + LRS.getTransactionIconHTML(transaction.type, transaction.subtype) + "</td>" +
                        "<td>" + LRS.formatAmount(transaction.amount) + "</td>" +
                        "<td>" + LRS.formatAmount(transaction.fee) + "</td>" +
                        "<td>" + LRS.getAccountTitle(transaction, "recipient") + "</td>" +
                        "<td>" + LRS.getAccountTitle(transaction, "sender") + "</td>" +
                        "</tr>";
                }
			}
			transactionsTable.find("tbody").empty().append(rows);
			$("#block_info_modal").modal("show");
			LRS.fetchingModalData = false;
		} else {
			$("#block_info_transactions_none").show();
			transactionsTable.hide();
			$("#block_info_modal").modal("show");
			LRS.fetchingModalData = false;
		}
	};

	return LRS;
}(LRS || {}, jQuery));
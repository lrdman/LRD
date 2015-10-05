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
	$("#account_details_modal").on("show.bs.modal", function(e) {
		$("#account_details_modal_qr_code").empty().qrcode({
			"text": LRS.accountRS,
			"width": 128,
			"height": 128
		});

		$("#account_details_modal_balance").show();

		if (LRS.accountInfo.errorCode && LRS.accountInfo.errorCode != 5) {
			$("#account_balance_table").hide();
			//todo
			$("#account_balance_warning").html(String(LRS.accountInfo.errorDescription).escapeHTML()).show();
		} else {
			$("#account_balance_warning").hide();

			if (LRS.accountInfo.errorCode && LRS.accountInfo.errorCode == 5) {
				$("#account_balance_balance, #account_balance_unconfirmed_balance, #account_balance_effective_balance, #account_balance_guaranteed_balance, #account_balance_forged_balance").html("0 LRD");
				$("#account_balance_public_key").html(String(LRS.publicKey).escapeHTML());
				$("#account_balance_account_rs").html(String(LRS.accountRS).escapeHTML());
				$("#account_balance_account").html(String(LRS.account).escapeHTML());
			} else {
				$("#account_balance_balance").html(LRS.formatAmount(new BigInteger(LRS.accountInfo.balanceLQT)) + " LRD");
				$("#account_balance_unconfirmed_balance").html(LRS.formatAmount(new BigInteger(LRS.accountInfo.unconfirmedBalanceLQT)) + " LRD");
				$("#account_balance_effective_balance").html(LRS.formatAmount(LRS.accountInfo.effectiveBalanceLRD) + " LRD");
				$("#account_balance_guaranteed_balance").html(LRS.formatAmount(new BigInteger(LRS.accountInfo.guaranteedBalanceLQT)) + " LRD");
				$("#account_balance_forged_balance").html(LRS.formatAmount(new BigInteger(LRS.accountInfo.forgedBalanceLQT)) + " LRD");

				$("#account_balance_public_key").html(String(LRS.accountInfo.publicKey).escapeHTML());
				$("#account_balance_account_rs").html(String(LRS.accountInfo.accountRS).escapeHTML());
				$("#account_balance_account").html(String(LRS.account).escapeHTML());

				if (!LRS.accountInfo.publicKey) {
					$("#account_balance_public_key").html("/");
                    var warning = LRS.publicKey != 'undefined' ? $.t("public_key_not_announced_warning", { "public_key": LRS.publicKey }) : $.t("no_public_key_warning");
					$("#account_balance_warning").html(warning + " " + $.t("public_key_actions")).show();
				}
			}
		}
	});

	$("#account_details_modal ul.nav li").click(function(e) {
		e.preventDefault();

		var tab = $(this).data("tab");

		$(this).siblings().removeClass("active");
		$(this).addClass("active");

		$(".account_details_modal_content").hide();

		var content = $("#account_details_modal_" + tab);

		content.show();
	});

	$("#account_details_modal").on("hidden.bs.modal", function(e) {
		$(this).find(".account_details_modal_content").hide();
		$(this).find("ul.nav li.active").removeClass("active");
		$("#account_details_balance_nav").addClass("active");
		$("#account_details_modal_qr_code").empty();
	});

	return LRS;
}(LRS || {}, jQuery));
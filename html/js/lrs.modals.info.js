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
	$("#lrs_modal").on("show.bs.modal", function(e) {
		if (LRS.fetchingModalData) {
			return;
		}

		LRS.fetchingModalData = true;

		LRS.sendRequest("getState", {}, function(state) {
			for (var key in state) {
				var el = $("#lrs_node_state_" + key);
				if (el.length) {
					if (key.indexOf("number") != -1) {
						el.html(LRS.formatAmount(state[key]));
					} else if (key.indexOf("Memory") != -1) {
						el.html(LRS.formatVolume(state[key]));
					} else if (key == "time") {
						el.html(LRS.formatTimestamp(state[key]));
					} else {
						el.html(String(state[key]).escapeHTML());
					}
				}
			}

			$("#lrs_update_explanation").show();
			$("#lrs_modal_state").show();

			LRS.fetchingModalData = false;
		});
	});

	$("#lrs_modal").on("hide.bs.modal", function(e) {
		$("body").off("dragover.lrs, drop.lrs");

		$("#lrs_update_drop_zone, #lrs_update_result, #lrs_update_hashes, #lrs_update_hash_progress").hide();

		$(this).find("ul.nav li.active").removeClass("active");
		$("#lrs_modal_state_nav").addClass("active");

		$(".lrs_modal_content").hide();
	});

	$("#lrs_modal ul.nav li").click(function(e) {
		e.preventDefault();

		var tab = $(this).data("tab");

		$(this).siblings().removeClass("active");
		$(this).addClass("active");

		$(".lrs_modal_content").hide();

		var content = $("#lrs_modal_" + tab);

		content.show();
	});

	return LRS;
}(LRS || {}, jQuery));
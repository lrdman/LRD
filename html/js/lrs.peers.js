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

	LRS.connectPeer = function(peer) {
		LRS.sendRequest("addPeer", {"peer": peer}, function(response) {
			if (response.errorCode || response.error || response.state != 1) {
				$.growl($.t("failed_connect_peer"), {
					"type": "danger"
				});
			} else {
				$.growl($.t("success_connect_peer"), {
					"type": "success"
				});
			}
			LRS.loadPage("peers");
		});
	};
	
	LRS.pages.peers = function() {
		LRS.sendRequest("getPeers+", {
			"active": "true",
			"includePeerInfo": "true"
		}, function(response) {
			if (response.peers && response.peers.length) {
				var rows = "";
				var uploaded = 0;
				var downloaded = 0;
				var connected = 0;
				var upToDate = 0;
				var activePeers = 0;
				
				for (var i = 0; i < response.peers.length; i++) {
					var peer = response.peers[i];

					if (!peer) {
						continue;
					}

					activePeers++;
					upToDate++;
					downloaded += peer.downloadedVolume;
					uploaded += peer.uploadedVolume;
					if (peer.state == 1) {
						connected++;
					}

					var versionToCompare = (!LRS.isTestNet ? LRS.normalVersion.versionNr : LRS.state.version);

					if (LRS.versionCompare(peer.version, versionToCompare) >= 0) {
						upToDate++;
					}

					rows += "<tr>";
					rows += "<td>";
					rows += (peer.state == 1 ? "<i class='fa fa-check-circle' style='color:#5cb85c' title='Connected'></i>" : "<i class='fa fa-times-circle' style='color:#f0ad4e' title='Disconnected'></i>");
					rows += "&nbsp;&nbsp;" + (peer.announcedAddress ? String(peer.announcedAddress).escapeHTML() : "No name") + "</td>";
					rows += "<td" + (peer.weight > 0 ? " style='font-weight:bold'" : "") + ">" + LRS.formatWeight(peer.weight) + "</td>";
					rows += "<td>" + LRS.formatVolume(peer.downloadedVolume) + "</td>";
					rows += "<td>" + LRS.formatVolume(peer.uploadedVolume) + "</td>";
					rows += "<td>" + (peer.application && peer.version ? String(peer.application).escapeHTML() + " " + String(peer.version).escapeHTML() : "?") + "</td>";
					rows += "<td>" + (peer.platform ? String(peer.platform).escapeHTML() : "?") + "</td>";

					rows += "<td style='text-align:right;'>";
					rows += "<a class='btn btn-xs btn-default' href='#' ";
					if (LRS.needsAdminPassword) {
						rows += "data-toggle='modal' data-target='#connect_peer_modal' data-peer='" + String(peer.announcedAddress).escapeHTML() + "'>";
					} else {
						rows += "onClick='LRS.connectPeer(\"" + String(peer.announcedAddress).escapeHTML() + "\");'>";
					}
					rows += $.t("connect") + "</a>";
					rows += "<a class='btn btn-xs btn-default' href='#' ";
					rows += "data-toggle='modal' data-target='#blacklist_peer_modal' data-peer='" + String(peer.announcedAddress).escapeHTML() + "'>" + $.t("blacklist") + "</a>";
					rows += "</td>";
					rows += "</tr>";
				}

				$("#peers_uploaded_volume").html(LRS.formatVolume(uploaded)).removeClass("loading_dots");
				$("#peers_downloaded_volume").html(LRS.formatVolume(downloaded)).removeClass("loading_dots");
				$("#peers_connected").html(connected).removeClass("loading_dots");
				$("#peers_up_to_date").html(upToDate + '/' + activePeers).removeClass("loading_dots");

				LRS.dataLoaded(rows);
				
				
			} else {
				$("#peers_uploaded_volume, #peers_downloaded_volume, #peers_connected, #peers_up_to_date").html("0").removeClass("loading_dots");
				LRS.dataLoaded();
			}
		});
	};

	LRS.incoming.peers = function() {
		LRS.loadPage("peers");
	};
	
	LRS.forms.addPeerComplete = function(response) {
		var message = "success_add_peer";
		var growlType = "success";
		if (response.state == 1) {
			message = "success_connect_peer";
		} else if (!response.isNewlyAdded) {
			message = "peer_already_added";
			growlType = "danger";
		}
		
		$.growl($.t(message), {
			"type": growlType
		});
		LRS.loadPage("peers");
	};
	
	LRS.forms.blacklistPeerComplete = function(response) {
		var message;
		var type;
		if (response.errorCode) {
			message = response.errorDescription;
			type = "danger";
		} else {
			message = $.t("success_blacklist_peer");
			type = "success";
		}
		$.growl(message, {
			"type": type
		});
		LRS.loadPage("peers");
	};

	$("#add_peer_modal").on("show.bs.modal", function() {
		showAdminPassword("add");
	});

	$("#connect_peer_modal").on("show.bs.modal", function(e) {
		var $invoker = $(e.relatedTarget);
		$("#connect_peer_address").html($invoker.data("peer"));
		$("#connect_peer_field_id").val($invoker.data("peer"));
		showAdminPassword("connect");
	});
	
	$("#blacklist_peer_modal").on("show.bs.modal", function(e) {
		var $invoker = $(e.relatedTarget);
		$("#blacklist_peer_address").html($invoker.data("peer"));
		$("#blacklist_peer_field_id").val($invoker.data("peer"));
		showAdminPassword("blacklist");
	});

	function showAdminPassword(action) {
		if (!LRS.needsAdminPassword) {
			$("#" + action + "_peer_admin_password_wrapper").hide();
		} else {
			if (LRS.settings.admin_password != "") {
				$("#" + action + "_peer_admin_password").val(LRS.settings.admin_password);
			}
		}
	}

	return LRS;
}(LRS || {}, jQuery));
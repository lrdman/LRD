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
var LRS = (function(LRS, $, undefined) {
	LRS.normalVersion = {};
	LRS.betaVersion = {};
	LRS.isOutdated = false;

	LRS.checkAliasVersions = function() {
		if (LRS.downloadingBlockchain) {
			$("#lrs_update_explanation span").hide();
			$("#lrs_update_explanation_blockchain_sync").show();
			return;
		}
		if (LRS.isTestNet) {
			$("#lrs_update_explanation span").hide();
			$("#lrs_update_explanation_testnet").show();
			return;
		}

		//Get latest version nr+hash of normal version
		LRS.sendRequest("getAlias", {
			"aliasName": "lrsversion"
		}, function(response) {
			if (response.aliasURI && (response = response.aliasURI.split(" "))) {
				LRS.normalVersion.versionNr = response[0];
				LRS.normalVersion.hash = response[1];

				if (LRS.betaVersion.versionNr) {
					LRS.checkForNewVersion();
				}
			}
		});

		//Get latest version nr+hash of beta version
		LRS.sendRequest("getAlias", {
			"aliasName": "lrsbetaversion"
		}, function(response) {
			if (response.aliasURI && (response = response.aliasURI.split(" "))) {
				LRS.betaVersion.versionNr = response[0];
				LRS.betaVersion.hash = response[1];

				if (LRS.normalVersion.versionNr) {
					LRS.checkForNewVersion();
				}
			}
		});

		if (LRS.inApp) {
			//user uses an old version which does not supply the platform / version
			if (LRS.appPlatform == "" || LRS.appVersion == "" || version_compare(LRS.appVersion, "2.0.0", "<")) {
				$("#secondary_dashboard_message").removeClass("alert-success").addClass("alert-danger").html("Download LRD Wallet application <a href='http://libertyreserved.is/dl/lrd.zip' target='_blank'>here</a>. You must install it manually due to changes in the LRS startup procedure.").show();
			}
		}
	}

	LRS.checkForNewVersion = function() {
		var installVersusNormal, installVersusBeta, normalVersusBeta;

		if (LRS.normalVersion && LRS.normalVersion.versionNr) {
			installVersusNormal = LRS.versionCompare(LRS.state.version, LRS.normalVersion.versionNr);
		}
		if (LRS.betaVersion && LRS.betaVersion.versionNr) {
			installVersusBeta = LRS.versionCompare(LRS.state.version, LRS.betaVersion.versionNr);
		}

		$("#lrs_update_explanation > span").hide();

		$("#lrs_update_explanation_wait").attr("style", "display: none !important");

		$(".lrs_new_version_nr").html(LRS.normalVersion.versionNr).show();
		$(".lrs_beta_version_nr").html(LRS.betaVersion.versionNr).show();

		if (installVersusNormal == -1 && installVersusBeta == -1) {
			LRS.isOutdated = true;
			$("#lrs_update").html("Outdated!").show();
			$("#lrs_update_explanation_new_choice").show();
		} else if (installVersusBeta == -1) {
			LRS.isOutdated = false;
			$("#lrs_update").html("New Beta").show();
			$("#lrs_update_explanation_new_beta").show();
		} else if (installVersusNormal == -1) {
			LRS.isOutdated = true;
			$("#lrs_update").html("Outdated!").show();
			$("#lrs_update_explanation_new_release").show();
		} else {
			LRS.isOutdated = false;
			$("#lrs_update_explanation_up_to_date").show();
		}
	}

	LRS.versionCompare = function(v1, v2) {
		if (v2 == undefined) {
			return -1;
		} else if (v1 == undefined) {
			return -1;
		}

		//https://gist.github.com/TheDistantSea/8021359 (based on)
		var v1last = v1.slice(-1);
		var v2last = v2.slice(-1);

		if (v1last == 'e') {
			v1 = v1.substring(0, v1.length - 1);
		} else {
			v1last = '';
		}

		if (v2last == 'e') {
			v2 = v2.substring(0, v2.length - 1);
		} else {
			v2last = '';
		}

		var v1parts = v1.split('.');
		var v2parts = v2.split('.');

		function isValidPart(x) {
			return /^\d+$/.test(x);
		}

		if (!v1parts.every(isValidPart) || !v2parts.every(isValidPart)) {
			return NaN;
		}

		v1parts = v1parts.map(Number);
		v2parts = v2parts.map(Number);

		for (var i = 0; i < v1parts.length; ++i) {
			if (v2parts.length == i) {
				return 1;
			}
			if (v1parts[i] == v2parts[i]) {
				continue;
			} else if (v1parts[i] > v2parts[i]) {
				return 1;
			} else {
				return -1;
			}
		}

		if (v1parts.length != v2parts.length) {
			return -1;
		}

		if (v1last && v2last) {
			return 0;
		} else if (v1last) {
			return 1;
		} else if (v2last) {
			return -1;
		} else {
			return 0;
		}
	}

	LRS.supportsUpdateVerification = function() {
		if ((typeof File !== 'undefined') && !File.prototype.slice) {
			if (File.prototype.webkitSlice) {
				File.prototype.slice = File.prototype.webkitSlice;
			}

			if (File.prototype.mozSlice) {
				File.prototype.slice = File.prototype.mozSlice;
			}
		}

		// Check for the various File API support.
		if (!window.File || !window.FileReader || !window.FileList || !window.Blob || !File.prototype.slice || !window.Worker) {
			return false;
		}

		return true;
	}

	LRS.verifyClientUpdate = function(e) {
		e.stopPropagation();
		e.preventDefault();

		var files = null;

		if (e.originalEvent.target.files && e.originalEvent.target.files.length) {
			files = e.originalEvent.target.files;
		} else if (e.originalEvent.dataTransfer.files && e.originalEvent.dataTransfer.files.length) {
			files = e.originalEvent.dataTransfer.files;
		}

		if (!files) {
			return;
		}

		$("#lrs_update_hash_progress").css("width", "0%");
		$("#lrs_update_hash_progress").show();

		var worker = new Worker("js/crypto/sha256worker.js");

		worker.onmessage = function(e) {
			if (e.data.progress) {
				$("#lrs_update_hash_progress").css("width", e.data.progress + "%");
			} else {
				$("#lrs_update_hash_progress").hide();
				$("#lrs_update_drop_zone").hide();

				if (e.data.sha256 == LRS.downloadedVersion.hash) {
					$("#lrs_update_result").html($.t("success_hash_verification")).attr("class", " ");
				} else {
					$("#lrs_update_result").html($.t("error_hash_verification")).attr("class", "incorrect");
				}

				$("#lrs_update_hash_version").html(LRS.downloadedVersion.versionNr);
				$("#lrs_update_hash_download").html(e.data.sha256);
				$("#lrs_update_hash_official").html(LRS.downloadedVersion.hash);
				$("#lrs_update_hashes").show();
				$("#lrs_update_result").show();

				LRS.downloadedVersion = {};

				$("body").off("dragover.lrs, drop.lrs");
			}
		};

		worker.postMessage({
			file: files[0]
		});
	}

	LRS.downloadClientUpdate = function(version) {
		if (version == "release") {
			LRS.downloadedVersion = LRS.normalVersion;
		} else {
			LRS.downloadedVersion = LRS.betaVersion;
		}

		if (LRS.inApp) {
			parent.postMessage({
				"type": "update",
				"update": {
					"type": version,
					"version": LRS.downloadedVersion.versionNr,
					"hash": LRS.downloadedVersion.hash
				}
			}, "*");
			$("#lrs_modal").modal("hide");
		} else {
			$("#lrs_update_iframe").attr("src", "https://github.com/lrdman/LRD/downloads/lrd.zip");
			$("#lrs_update_explanation").hide();
			$("#lrs_update_drop_zone").show();

			$("body").on("dragover.lrs", function(e) {
				e.preventDefault();
				e.stopPropagation();

				if (e.originalEvent && e.originalEvent.dataTransfer) {
					e.originalEvent.dataTransfer.dropEffect = "copy";
				}
			});

			$("body").on("drop.lrs", function(e) {
				LRS.verifyClientUpdate(e);
			});

			$("#lrs_update_drop_zone").on("click", function(e) {
				e.preventDefault();

				$("#lrs_update_file_select").trigger("click");

			});

			$("#lrs_update_file_select").on("change", function(e) {
				LRS.verifyClientUpdate(e);
			});
		}

		return false;
	}

	return LRS;
}(LRS || {}, jQuery));
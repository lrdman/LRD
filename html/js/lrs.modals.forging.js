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
var LRS = (function(LRS, $) {
	LRS.forms.startForgingComplete = function(response, data) {
		if ("deadline" in response) {
            setForgingIndicatorStatus(LRS.constants.FORGING);
			forgingIndicator.find("span").html($.t(LRS.constants.FORGING)).attr("data-i18n", "forging");
			LRS.forgingStatus = LRS.constants.FORGING;
            LRS.isAccountForging = true;
			$.growl($.t("success_start_forging"), {
				type: "success"
			});
		} else {
            LRS.isAccountForging = false;
			$.growl($.t("error_start_forging"), {
				type: 'danger'
			});
		}
	};

	LRS.forms.stopForgingComplete = function(response, data) {
		if ($("#stop_forging_modal").find(".show_logout").css("display") == "inline") {
			LRS.logout();
			return;
		}
        if (response.foundAndStopped || (response.stopped && response.stopped > 0)) {
            LRS.isAccountForging = false;
            if (!response.forgersCount || response.forgersCount == 0) {
                setForgingIndicatorStatus(LRS.constants.NOT_FORGING);
                forgingIndicator.find("span").html($.t(LRS.constants.NOT_FORGING)).attr("data-i18n", "forging");
            }
            $.growl($.t("success_stop_forging"), {
				type: 'success'
			});
		} else {
			$.growl($.t("error_stop_forging"), {
				type: 'danger'
			});
		}
	};

	var forgingIndicator = $("#forging_indicator");
	forgingIndicator.click(function(e) {
		e.preventDefault();

		if (LRS.downloadingBlockchain) {
			$.growl($.t("error_forging_blockchain_downloading"), {
				"type": "danger"
			});
		} else if (LRS.state.isScanning) {
			$.growl($.t("error_forging_blockchain_rescanning"), {
				"type": "danger"
			});
		} else if (!LRS.accountInfo.publicKey) {
			$.growl($.t("error_forging_no_public_key"), {
				"type": "danger"
			});
		} else if (LRS.accountInfo.effectiveBalanceLRD == 0) {
			if (LRS.lastBlockHeight >= LRS.accountInfo.currentLeasingHeightFrom && LRS.lastBlockHeight <= LRS.accountInfo.currentLeasingHeightTo) {
				$.growl($.t("error_forging_lease"), {
					"type": "danger"
				});
			} else {
				$.growl($.t("error_forging_effective_balance"), {
					"type": "danger"
				});
			}
		} else if (LRS.isAccountForging) {
			$("#stop_forging_modal").modal("show");
		} else {
			$("#start_forging_modal").modal("show");
		}
	});

	forgingIndicator.hover(
		function() {
            LRS.updateForgingStatus();
        }
	);

    LRS.getForgingTooltip = function(data) {
        if (!data || data.account == LRS.accountInfo.account) {
            LRS.isAccountForging = true;
            return $.t("forging_tooltip", {"balance": LRS.accountInfo.effectiveBalanceLRD});
        }
        return $.t("forging_another_account_tooltip", {"accountRS": data.accountRS });
    };

    LRS.updateForgingTooltip = function(tooltip) {
        $("#forging_status").attr('title', tooltip).tooltip('fixTitle');
    };

    function setForgingIndicatorStatus(status) {
        var forgingIndicator = $("#forging_indicator");
        forgingIndicator.removeClass(LRS.constants.FORGING);
        forgingIndicator.removeClass(LRS.constants.NOT_FORGING);
        forgingIndicator.removeClass(LRS.constants.UNKNOWN);
        forgingIndicator.addClass(status);
        return forgingIndicator;
    }

    LRS.updateForgingStatus = function(secretPhrase) {
        var status = LRS.forgingStatus;
        var tooltip = $("#forging_status").attr('title');
        if (!LRS.accountInfo.publicKey) {
            status = LRS.constants.NOT_FORGING;
            tooltip = $.t("error_forging_no_public_key");
        } else if (LRS.isLeased) {
            status = LRS.constants.NOT_FORGING;
            tooltip = $.t("error_forging_lease");
        } else if (LRS.accountInfo.effectiveBalanceLRD == 0) {
            status = LRS.constants.NOT_FORGING;
            tooltip = $.t("error_forging_effective_balance");
        } else if (LRS.downloadingBlockchain) {
            status = LRS.constants.NOT_FORGING;
            tooltip = $.t("error_forging_blockchain_downloading");
        } else if (LRS.state.isScanning) {
            status = LRS.constants.NOT_FORGING;
            tooltip = $.t("error_forging_blockchain_rescanning");
        } else if (LRS.needsAdminPassword && LRS.settings.admin_password == "" && (!secretPhrase || !LRS.isLocalHost)) {
            // do not change forging status
        } else {
            var params = {};
            if (LRS.needsAdminPassword && LRS.settings.admin_password != "") {
                params["adminPassword"] = LRS.settings.admin_password;
            }
            if (secretPhrase && LRS.needsAdminPassword && LRS.settings.admin_password == "") {
                params["secretPhrase"] = secretPhrase;
            }
            LRS.sendRequest("getForging", params, function (response) {
                LRS.isAccountForging = false;
                if ("account" in response) {
                    status = LRS.constants.FORGING;
                    tooltip = LRS.getForgingTooltip(response);
                    LRS.isAccountForging = true;
                } else if ("generators" in response) {
                    if (response.generators.length == 0) {
                        status = LRS.constants.NOT_FORGING;
                        tooltip = $.t("not_forging_not_started_tooltip");
                    } else {
                        status = LRS.constants.FORGING;
                        if (response.generators.length == 1) {
                            tooltip = LRS.getForgingTooltip(response.generators[0]);
                        } else {
                            tooltip = $.t("forging_more_than_one_tooltip", { "generators": response.generators.length });
                            for (var i=0; i< response.generators.length; i++) {
                                if (response.generators[i].account == LRS.accountInfo.account) {
                                    LRS.isAccountForging = true;
                                }
                            }
                            if (LRS.isAccountForging) {
                                tooltip += ", " + $.t("forging_current_account_true");
                            } else {
                                tooltip += ", " + $.t("forging_current_account_false");
                            }
                        }
                    }
                } else {
                    status = LRS.constants.UNKNOWN;
                    tooltip = response.errorDescription;
                }
            }, false);
        }
        var forgingIndicator = setForgingIndicatorStatus(status);
        if (status == LRS.constants.NOT_FORGING) {
            LRS.isAccountForging = false;
        }
        forgingIndicator.find("span").html($.t(status)).attr("data-i18n", status);
        forgingIndicator.show();
        LRS.forgingStatus = status;
        LRS.updateForgingTooltip(tooltip);
    };

	return LRS;
}(LRS || {}, jQuery));
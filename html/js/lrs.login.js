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
	LRS.newlyCreatedAccount = false;

	LRS.allowLoginViaEnter = function() {
		$("#login_account_other").keypress(function(e) {
			if (e.which == '13') {
				e.preventDefault();
				var account = $("#login_account_other").val();
				LRS.login(false,account);
			}
		});
		$("#login_password").keypress(function(e) {
			if (e.which == '13') {
				e.preventDefault();
				var password = $("#login_password").val();
				LRS.login(true,password);
			}
		});
	};

	LRS.showLoginOrWelcomeScreen = function() {
		if (LRS.hasLocalStorage && localStorage.getItem("logged_in")) {
			LRS.showLoginScreen();
		} else {
			LRS.showWelcomeScreen();
		}
	};

	LRS.showLoginScreen = function() {
		$("#account_phrase_custom_panel, #account_phrase_generator_panel, #welcome_panel, #custom_passphrase_link").hide();
		$("#account_phrase_custom_panel :input:not(:button):not([type=submit])").val("");
		$("#account_phrase_generator_panel :input:not(:button):not([type=submit])").val("");
        $("#login_account_other").mask("LRD-****-****-****-*****");
        
		$("#login_panel").show();
		setTimeout(function() {
			$("#login_password").focus()
		}, 10);
	};

	LRS.showWelcomeScreen = function() {
		$("#login_panel, #account_phrase_generator_panel, #account_phrase_custom_panel, #welcome_panel, #custom_passphrase_link").hide();
		$("#welcome_panel").show();
	};

	LRS.registerUserDefinedAccount = function() {
		$("#account_phrase_generator_panel, #login_panel, #welcome_panel, #custom_passphrase_link").hide();
		$("#account_phrase_custom_panel :input:not(:button):not([type=submit])").val("");
		$("#account_phrase_generator_panel :input:not(:button):not([type=submit])").val("");
		$("#account_phrase_custom_panel").show();
		$("#registration_password").focus();
	};

	LRS.registerAccount = function() {
		$("#login_panel, #welcome_panel").hide();
		$("#account_phrase_generator_panel").show();
		$("#account_phrase_generator_panel .step_3 .callout").hide();

		var $loading = $("#account_phrase_generator_loading");
		var $loaded = $("#account_phrase_generator_loaded");

		if (window.crypto || window.msCrypto) {
			$loading.find("span.loading_text").html($.t("generating_passphrase_wait"));
		}

		$loading.show();
		$loaded.hide();

		if (typeof PassPhraseGenerator == "undefined") {
			$.when(
				$.getScript("js/crypto/3rdparty/seedrandom.js"),
				$.getScript("js/crypto/passphrasegenerator.js")
			).done(function() {
				$loading.hide();
				$loaded.show();

				PassPhraseGenerator.generatePassPhrase("#account_phrase_generator_panel");
			}).fail(function(jqxhr, settings, exception) {
				alert($.t("error_word_list"));
			});
		} else {
			$loading.hide();
			$loaded.show();

			PassPhraseGenerator.generatePassPhrase("#account_phrase_generator_panel");
		}
	};

	LRS.verifyGeneratedPassphrase = function() {
		var password = $.trim($("#account_phrase_generator_panel .step_3 textarea").val());

		if (password != PassPhraseGenerator.passPhrase) {
			$("#account_phrase_generator_panel .step_3 .callout").show();
		} else {
			LRS.newlyCreatedAccount = true;
			LRS.login(true,password);
			PassPhraseGenerator.reset();
			$("#account_phrase_generator_panel textarea").val("");
			$("#account_phrase_generator_panel .step_3 .callout").hide();
		}
	};

	$("#account_phrase_custom_panel form").submit(function(event) {
		event.preventDefault();

		var password = $("#registration_password").val();
		var repeat = $("#registration_password_repeat").val();

		var error = "";

		if (password.length < 35) {
			error = $.t("error_passphrase_length");
		} else if (password.length < 50 && (!password.match(/[A-Z]/) || !password.match(/[0-9]/))) {
			error = $.t("error_passphrase_strength");
		} else if (password != repeat) {
			error = $.t("error_passphrase_match");
		}

		if (error) {
			$("#account_phrase_custom_panel .callout").first().removeClass("callout-info").addClass("callout-danger").html(error);
		} else {
			$("#registration_password, #registration_password_repeat").val("");
			LRS.login(true,password);
		}
	});
	
	LRS.listAccounts = function() {
		$('#login_account').empty();
		if (LRS.getCookie("savedLrdAccounts") && LRS.getCookie("savedLrdAccounts")!=""){
			$('#login_account_container').show();
			$('#login_account_container_other').hide();
			var accounts = LRS.getCookie("savedLrdAccounts").split(";");
			$.each(accounts, function(index, account) {
				if (account != ''){
					$('#login_account')
					.append($("<li></li>")
						.append($("<a></a>")
							.attr("href","#")
							.attr("style","display: inline-block;width: 360px;")
							.attr("onClick","LRS.login(false,'"+account+"')")
							.text(account))
						.append($('<button aria-hidden="true" data-dismiss="modal" class="close" type="button">×</button>')
							.attr("onClick","LRS.removeAccount('"+account+"')")
							.attr("style","margin-right:5px"))
					);
				}
			});
			var otherHTML = "<li><a href='#' style='display: inline-block;width: 380px;' ";
			otherHTML += "data-i18n='other'>Other</a></li>";
			var $otherHTML = $(otherHTML);
			$otherHTML.click(function(e) {
				$('#login_account_container').hide();
				$('#login_account_container_other').show();
			});
			$otherHTML.appendTo($('#login_account'));
		}
		else{
			$('#login_account_container').hide();
			$('#login_account_container_other').show();
		}
	};
	
	LRS.switchAccount = function(account) {
		LRS.setDecryptionPassword("");
		LRS.setPassword("");
		var url = window.location.pathname;    
		url += '?account='+account;
		window.location.href = url;
	};
	
	$("#loginButtons").on('click',function(e) {
		e.preventDefault();
		if ($(this).data( "login-type" ) == "password") {
            LRS.listAccounts();
			$('#login_password').parent().hide();
			$('#remember_password_container').hide();
			$(this).html('<input type="hidden" name="loginType" id="accountLogin" value="account" autocomplete="off" /><i class="fa fa-male"></i>');
			$(this).data( "login-type","account");
        }
        else {
            $('#login_account_container').hide();
			$('#login_account_container_other').hide();
			$('#login_password').parent().show();
			$('#remember_password_container').show();
			$(this).html('<input type="hidden" name="loginType" id="accountLogin" value="passwordLogin" autocomplete="off" /><i class="fa fa-key"></i>');
			$(this).data( "login-type","password");
        }
	});
	
	LRS.removeAccount = function(account) {
		var accounts = LRS.getCookie("savedLrdAccounts").replace(account+';','');
		if (accounts == '')
			LRS.deleteCookie('savedLrdAccounts');
		else 
			LRS.setCookie("savedLrdAccounts",accounts,30);
		LRS.listAccounts();
	};

	LRS.login = function(passLogin, password, callback) {
		if (passLogin){
			if (!password.length) {
				$.growl($.t("error_passphrase_required_login"), {
					"type": "danger",
					"offset": 10
				});
				return;
			} else if (!LRS.isTestNet && password.length < 12 && $("#login_check_password_length").val() == 1) {
				$("#login_check_password_length").val(0);
				$("#login_error .callout").html($.t("error_passphrase_login_length"));
				$("#login_error").show();
				return;
			}

			$("#login_password, #registration_password, #registration_password_repeat").val("");
			$("#login_check_password_length").val(1);
		}

		LRS.sendRequest("getBlockchainStatus", {}, function(response) {
			if (response.errorCode) {
				$.growl($.t("error_server_connect"), {
					"type": "danger",
					"offset": 10
				});

				return;
			}
			
			LRS.state = response;
			if (passLogin) {
				var accountRequest = "getAccountId";
				var requestVariable = {secretPhrase: password};
			}
			else {
				var accountRequest = "getAccount";
				var requestVariable = {account: password};
			}

			//this is done locally..
			LRS.sendRequest(accountRequest, requestVariable, function(response) {
				if (!response.errorCode) {
					LRS.account = String(response.account).escapeHTML();
					LRS.accountRS = String(response.accountRS).escapeHTML();
					if (passLogin) {
                        LRS.publicKey = LRS.getPublicKey(converters.stringToHexString(password));
                    } else {
                        LRS.publicKey = String(response.publicKey).escapeHTML();
                    }
				}
				if (!passLogin && response.errorCode == 5) {
					LRS.account = String(response.account).escapeHTML();
					LRS.accountRS = String(response.accountRS).escapeHTML();
				}
				if (!LRS.account) {
					$.growl($.t("error_find_account_id"), {
						"type": "danger",
						"offset": 10
					});
					return;
				} else if (!LRS.accountRS) {
					$.growl($.t("error_generate_account_id"), {
						"type": "danger",
						"offset": 10
					});
					return;
				}

				LRS.sendRequest("getAccountPublicKey", {
					"account": LRS.account
				}, function(response) {
					if (response && response.publicKey && response.publicKey != LRS.generatePublicKey(password) && passLogin) {
						$.growl($.t("error_account_taken"), {
							"type": "danger",
							"offset": 10
						});
						return;
					}

					if ($("#remember_password").is(":checked") && passLogin) {
						LRS.rememberPassword = true;
						$("#remember_password").prop("checked", false);
						LRS.setPassword(password);
						$(".secret_phrase, .show_secret_phrase").hide();
						$(".hide_secret_phrase").show();
					}
					if ($("#disable_all_plugins").length == 1 && !($("#disable_all_plugins").is(":checked"))) {
                        LRS.disablePluginsDuringSession = false;
                    } else {
                        LRS.disablePluginsDuringSession = true;
                    }

					$("#account_id").html(String(LRS.accountRS).escapeHTML()).css("font-size", "12px");

					var passwordNotice = "";

					if (password.length < 35 && passLogin) {
						passwordNotice = $.t("error_passphrase_length_secure");
					} else if (passLogin && password.length < 50 && (!password.match(/[A-Z]/) || !password.match(/[0-9]/))) {
						passwordNotice = $.t("error_passphrase_strength_secure");
					}

					if (passwordNotice) {
						$.growl("<strong>" + $.t("warning") + "</strong>: " + passwordNotice, {
							"type": "danger"
						});
					}

					if (LRS.state) {
						LRS.checkBlockHeight();
					}

					LRS.getAccountInfo(true, function() {
						if (LRS.accountInfo.currentLeasingHeightFrom) {
							LRS.isLeased = (LRS.lastBlockHeight >= LRS.accountInfo.currentLeasingHeightFrom && LRS.lastBlockHeight <= LRS.accountInfo.currentLeasingHeightTo);
						} else {
							LRS.isLeased = false;
						}
						LRS.updateForgingTooltip($.t("forging_unknown_tooltip"));
						LRS.updateForgingStatus(passLogin ? password : null);
						if (LRS.isLocalHost && passLogin) {
							var forgingIndicator = $("#forging_indicator");
							LRS.sendRequest("startForging", {
								"secretPhrase": password
							}, function (response) {
								if ("deadline" in response) {
									forgingIndicator.addClass("forging");
									forgingIndicator.find("span").html($.t("forging")).attr("data-i18n", "forging");
									LRS.forgingStatus = LRS.constants.FORGING;
									LRS.updateForgingTooltip(LRS.getForgingTooltip);
								} else {
									forgingIndicator.removeClass("forging");
									forgingIndicator.find("span").html($.t("not_forging")).attr("data-i18n", "not_forging");
									LRS.forgingStatus = LRS.constants.NOT_FORGING;
									LRS.updateForgingTooltip(response.errorDescription);
								}
								forgingIndicator.show();
							});
						}
					});

					//LRS.getAccountAliases();

					LRS.unlock();

					if (LRS.isOutdated) {
						$.growl($.t("lrs_update_available"), {
							"type": "danger"
						});
					}

					if (!LRS.downloadingBlockchain) {
						LRS.checkIfOnAFork();
					}
					if(navigator.userAgent.indexOf('Safari') != -1 && navigator.userAgent.indexOf('Chrome') == -1) {
						// Don't use account based DB in Safari due to a buggy indexedDB implementation (2015-02-24)
						LRS.createDatabase("LRS_USER_DB");
						$.growl($.t("lrs_safari_no_account_based_db"), {
							"type": "danger"
						});
					} else {
						LRS.createDatabase("LRS_USER_DB_" + String(LRS.account));
					}

					LRS.setupClipboardFunctionality();

					if (callback) {
						callback();
					}
					
					if (passLogin) {
						LRS.checkLocationHash(password);
						$(window).on("hashchange", LRS.checkLocationHash);
					}

					$.each(LRS.pages, function(key, value) {
						if(key in LRS.setup) {
							LRS.setup[key]();
						}
					});
					
					//setTimeout(function () { LRS.loadPlugins(); }, 1500);
					
					$(".sidebar .treeview").tree();
					$('#dashboard_link a').addClass("ignore").click();

					if ($("#remember_account").is(":checked") || LRS.newlyCreatedAccount) {
						var accountExists = 0;
						if (LRS.getCookie("savedLrdAccounts")) {
							var accounts = LRS.getCookie("savedLrdAccounts").split(";");
							$.each(accounts, function(index, account) {
								if (account == LRS.accountRS) {
                                    accountExists = 1;
                                }
							});
						}
						if (!accountExists){
							if (LRS.getCookie("savedLrdAccounts") && LRS.getCookie("savedLrdAccounts") != ""){
								var accounts = LRS.getCookie("savedLrdAccounts") + LRS.accountRS + ";";
								LRS.setCookie("savedLrdAccounts",accounts,30);
							} else {
                                LRS.setCookie("savedLrdAccounts", LRS.accountRS + ";", 30);
                            }
						}
					}

					$("[data-i18n]").i18n();
					
					/* Add accounts to dropdown for quick switching */
					$("#account_id_dropdown .dropdown-menu .switchAccount").remove();
					if (LRS.getCookie("savedLrdAccounts") && LRS.getCookie("savedLrdAccounts")!=""){
						$("#account_id_dropdown .dropdown-menu").append("<li class='switchAccount' style='padding-left:2px;'><b>Switch Account to</b></li>");
						var accounts = LRS.getCookie("savedLrdAccounts").split(";");
						$.each(accounts, function(index, account) {
							if (account != ''){
								$('#account_id_dropdown .dropdown-menu')
								.append($("<li class='switchAccount'></li>")
									.append($("<a></a>")
										.attr("href","#")
										.attr("style","font-size: 85%;")
										.attr("onClick","LRS.switchAccount('"+account+"')")
										.text(account))
								);
							}
						});
					}

					LRS.getInitialTransactions();
					LRS.updateApprovalRequests();
				});
			});
		});
	};

	$("#logout_button_container").on("show.bs.dropdown", function(e) {
		
		if (LRS.forgingStatus != LRS.constants.FORGING) {
			//e.preventDefault();
			$(this).find("[data-i18n='logout_stop_forging']").hide();
		}
	});

	LRS.initPluginWarning = function() {
		if (LRS.activePlugins) {
			var html = "";
			html += "<div style='font-size:13px;'>";
			html += "<div style='background-color:#e6e6e6;padding:12px;'>";
			html += "<span data-i18n='following_plugins_detected'>";
			html += "The following active plugins have been detected:</span>";
			html += "</div>";
			html += "<ul class='list-unstyled' style='padding:11px;border:1px solid #e0e0e0;margin-top:8px;'>";
			$.each(LRS.plugins, function(pluginId, pluginDict) {
				if (pluginDict["launch_status"] == LRS.constants.PL_PAUSED) {
					html += "<li style='font-weight:bold;'>" + pluginDict["manifest"]["name"] + "</li>";
				}
			});
			html += "</ul>";
			html += "</div>";

			$('#lockscreen_active_plugins_overview').popover({
				"html": true,
				"content": html,
				"trigger": "hover"
			});

			html = "";
			html += "<div style='font-size:13px;padding:5px;'>";
			html += "<p data-i18n='plugin_security_notice_full_access'>";
			html += "Plugins are not sandboxed or restricted in any way and have full accesss to your client system including your Lrd passphrase.";
			html += "</p>";
			html += "<p data-i18n='plugin_security_notice_trusted_sources'>";
			html += "Make sure to only run plugins downloaded from trusted sources, otherwise ";
			html += "you can loose your LRD! In doubt don't run plugins with accounts ";
			html += "used to store larger amounts of LRD now or in the future.";
			html += "</p>";
			html += "</div>";

			$('#lockscreen_active_plugins_security').popover({
				"html": true,
				"content": html,
				"trigger": "hover"
			});

			$("#lockscreen_active_plugins_warning").show();
		} else {
			$("#lockscreen_active_plugins_warning").hide();
		}
	};

	LRS.showLockscreen = function() {
		LRS.listAccounts();
		if (LRS.hasLocalStorage && localStorage.getItem("logged_in")) {
			LRS.showLoginScreen();
		} else {
			LRS.showWelcomeScreen();
		}

		$("#center").show();
	};

	LRS.unlock = function() {
		if (LRS.hasLocalStorage && !localStorage.getItem("logged_in")) {
			localStorage.setItem("logged_in", true);
		}
		$("#lockscreen").hide();
		$("body, html").removeClass("lockscreen");
		$("#login_error").html("").hide();
		$(document.documentElement).scrollTop(0);
	};

	LRS.logout = function(stopForging) {
		if (stopForging && LRS.forgingStatus == LRS.constants.FORGING) {
			$("#stop_forging_modal .show_logout").show();
			$("#stop_forging_modal").modal("show");
		} else {
			LRS.setDecryptionPassword("");
			LRS.setPassword("");
			//window.location.reload();
			window.location.href = window.location.pathname;    
		}
	};

	$("#logout_clear_user_data_confirm_btn").click(function(e) {
		e.preventDefault();
		if (LRS.database) {
			indexedDB.deleteDatabase(LRS.database.name);
		}
		if (LRS.legacyDatabase) {
			indexedDB.deleteDatabase(LRS.legacyDatabase.name);
		}
		if (LRS.hasLocalStorage) {
			localStorage.removeItem("logged_in");
			localStorage.removeItem("settings")
		}
		var cookies = document.cookie.split(";");
		for (var i = 0; i < cookies.length; i++) {
			LRS.deleteCookie(cookies[i].split("=")[0]);
		}

		LRS.logout();
	});

	LRS.setPassword = function(password) {
		LRS.setEncryptionPassword(password);
		LRS.setServerPassword(password);
	};
	return LRS;
}(LRS || {}, jQuery));
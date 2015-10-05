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
 * @depends {3rdparty/jquery-2.1.0.js}
 * @depends {3rdparty/bootstrap.js}
 * @depends {3rdparty/big.js}
 * @depends {3rdparty/jsbn.js}
 * @depends {3rdparty/jsbn2.js}
 * @depends {3rdparty/pako.js}
 * @depends {3rdparty/webdb.js}
 * @depends {3rdparty/ajaxmultiqueue.js}
 * @depends {3rdparty/growl.js}
 * @depends {3rdparty/zeroclipboard.js}
 * @depends {crypto/curve25519.js}
 * @depends {crypto/curve25519_.js}
 * @depends {crypto/passphrasegenerator.js}
 * @depends {crypto/sha256worker.js}
 * @depends {crypto/3rdparty/cryptojs/aes.js}
 * @depends {crypto/3rdparty/cryptojs/sha256.js}
 * @depends {crypto/3rdparty/jssha256.js}
 * @depends {crypto/3rdparty/seedrandom.js}
 * @depends {util/converters.js}
 * @depends {util/extensions.js}
 * @depends {util/lrdaddress.js}
 */
var LRS = (function(LRS, $, undefined) {
	"use strict";

	LRS.server = "";
	LRS.state = {};
	LRS.blocks = [];
	LRS.account = "";
	LRS.accountRS = "";
	LRS.publicKey = "";
	LRS.accountInfo = {};

	LRS.database = null;
	LRS.databaseSupport = false;
	LRS.databaseFirstStart = false;

	// Legacy database, don't use this for data storage
	LRS.legacyDatabase = null;
	LRS.legacyDatabaseWithData = false;

	LRS.serverConnect = false;
	LRS.peerConnect = false;

	LRS.settings = {};
	LRS.contacts = {};

	LRS.isTestNet = false;
	LRS.isLocalHost = false;
	LRS.forgingStatus = LRS.constants.UNKNOWN;
	LRS.isAccountForging = false;
	LRS.isLeased = false;
	LRS.needsAdminPassword = true;

	LRS.lastBlockHeight = 0;
	LRS.downloadingBlockchain = false;

	LRS.rememberPassword = false;
	LRS.selectedContext = null;

	LRS.currentPage = "dashboard";
	LRS.currentSubPage = "";
	LRS.pageNumber = 1;
	//LRS.itemsPerPage = 50;  /* Now set in lrs.settings.js */

	LRS.pages = {};
	LRS.incoming = {};
	LRS.setup = {};

	if (!_checkDOMenabled()) {
		LRS.hasLocalStorage = false;
	} else {
	LRS.hasLocalStorage = true;
   }
	
	LRS.inApp = false;
	LRS.appVersion = "";
	LRS.appPlatform = "";
	LRS.assetTableKeys = [];

	var stateInterval;
	var stateIntervalSeconds = 30;
	var isScanning = false;

	LRS.init = function() {
		LRS.sendRequest("getState", {
			"includeCounts": "false"
		}, function (response) {
			var isTestnet = false;
			var isOffline = false;
			var peerPort = 0;
			for (var key in response) {
				if (key == "isTestnet") {
					isTestnet = response[key];
				}
				if (key == "isOffline") {
					isOffline = response[key];
				}
				if (key == "peerPort") {
					peerPort = response[key];
				}
				if (key == "needsAdminPassword") {
					LRS.needsAdminPassword = response[key];
				}
			}
			
			if (!isTestnet) {
				$(".testnet_only").hide();
			} else {
				LRS.isTestNet = true;
				var testnetWarningDiv = $("#testnet_warning");
				var warningText = testnetWarningDiv.text() + " The testnet peer port is " + peerPort + (isOffline ? ", the peer is working offline." : ".");
                LRS.logConsole(warningText);
				testnetWarningDiv.text(warningText);
				$(".testnet_only, #testnet_login, #testnet_warning").show();
			}
			LRS.loadServerConstants();
			LRS.loadTransactionTypeConstants();
			LRS.initializePlugins();
            LRS.printEnvInfo();
		});
		
		if (!LRS.server) {
			var hostName = window.location.hostname.toLowerCase();
			LRS.isLocalHost = hostName == "localhost" || hostName == "127.0.0.1" || LRS.isPrivateIP(hostName);
            LRS.logProperty("LRS.isLocalHost");
		}

		if (!LRS.isLocalHost) {
			$(".remote_warning").show();
		}

		try {
			window.localStorage;
		} catch (err) {
			LRS.hasLocalStorage = false;
		}
		if(!(navigator.userAgent.indexOf('Safari') != -1 && navigator.userAgent.indexOf('Chrome') == -1)) {
			// Not Safari
			// Don't use account based DB in Safari due to a buggy indexedDB implementation (2015-02-24)
			LRS.createLegacyDatabase();
		}

		if (LRS.getCookie("remember_passphrase")) {
			$("#remember_password").prop("checked", true);
		}

		LRS.getSettings();

		LRS.getState(function() {
			setTimeout(function() {
				//LRS.checkAliasVersions();
			}, 5000);
		});

		$("body").popover({
			"selector": ".show_popover",
			"html": true,
			"trigger": "hover"
		});

		LRS.showLockscreen();

		if (window.parent) {
			var match = window.location.href.match(/\?app=?(win|mac|lin)?\-?([\d\.]+)?/i);

			if (match) {
				LRS.inApp = true;
				if (match[1]) {
					LRS.appPlatform = match[1];
				}
				if (match[2]) {
					LRS.appVersion = match[2];
				}

				if (!LRS.appPlatform || LRS.appPlatform == "mac") {
					var macVersion = navigator.userAgent.match(/OS X 10_([0-9]+)/i);
					if (macVersion && macVersion[1]) {
						macVersion = parseInt(macVersion[1]);

						if (macVersion < 9) {
							$(".modal").removeClass("fade");
						}
					}
				}

				$("#show_console").hide();

				parent.postMessage("loaded", "*");

				window.addEventListener("message", receiveMessage, false);
			}
		}

		LRS.setStateInterval(30);

		if (!LRS.isTestNet) {
			setInterval(LRS.checkAliasVersions, 1000 * 60 * 60);
		}

		LRS.allowLoginViaEnter();

		LRS.automaticallyCheckRecipient();

		$("#dashboard_table, #transactions_table").on("mouseenter", "td.confirmations", function() {
			$(this).popover("show");
		}).on("mouseleave", "td.confirmations", function() {
			$(this).popover("destroy");
			$(".popover").remove();
		});

		_fix();

		$(window).on("resize", function() {
			_fix();

			if (LRS.currentPage == "asset_exchange") {
				LRS.positionAssetSidebar();
			}
		});
		
		$("[data-toggle='tooltip']").tooltip();

		$("#dgs_search_account_top, #dgs_search_account_center").mask("LRD-****-****-****-*****", {
			"unmask": false
		});
		
		if (LRS.getUrlParameter("account")){
			LRS.login(false,LRS.getUrlParameter("account"));
		}

		/*
		$("#asset_exchange_search input[name=q]").addClear({
			right: 0,
			top: 4,
			onClear: function(input) {
				$("#asset_exchange_search").trigger("submit");
			}
		});

		$("#id_search input[name=q], #alias_search input[name=q]").addClear({
			right: 0,
			top: 4
		});*/
	};

	function _fix() {
		var height = $(window).height() - $("body > .header").height();
		//$(".wrapper").css("min-height", height + "px");
		var content = $(".wrapper").height();

		$(".content.content-stretch:visible").width($(".page:visible").width());

		if (content > height) {
			$(".left-side, html, body").css("min-height", content + "px");
		} else {
			$(".left-side, html, body").css("min-height", height + "px");
		}
	}

	LRS.setStateInterval = function(seconds) {
		if (seconds == stateIntervalSeconds && stateInterval) {
			return;
		}

		if (stateInterval) {
			clearInterval(stateInterval);
		}

		stateIntervalSeconds = seconds;

		stateInterval = setInterval(function() {
			LRS.getState();
			LRS.updateForgingStatus();
		}, 1000 * seconds);
	};

	var _firstTimeAfterLoginRun = false;

	LRS.getState = function(callback) {
		LRS.sendRequest("getBlockchainStatus", {}, function(response) {
			if (response.errorCode) {
				LRS.serverConnect = false;
				//todo
			} else {
				var firstTime = !("lastBlock" in LRS.state);
				var previousLastBlock = (firstTime ? "0" : LRS.state.lastBlock);

				LRS.state = response;
				LRS.serverConnect = true;

				if (firstTime) {
					$("#lrs_version").html(LRS.state.version).removeClass("loading_dots");
					LRS.getBlock(LRS.state.lastBlock, LRS.handleInitialBlocks);
				} else if (LRS.state.isScanning) {
					//do nothing but reset LRS.state so that when isScanning is done, everything is reset.
					isScanning = true;
				} else if (isScanning) {
					//rescan is done, now we must reset everything...
					isScanning = false;
					LRS.blocks = [];
					LRS.tempBlocks = [];
					LRS.getBlock(LRS.state.lastBlock, LRS.handleInitialBlocks);
					if (LRS.account) {
						LRS.getInitialTransactions();
						LRS.getAccountInfo();
					}
				} else if (previousLastBlock != LRS.state.lastBlock) {
					LRS.tempBlocks = [];
					if (LRS.account) {
						LRS.getAccountInfo();
					}
					LRS.getBlock(LRS.state.lastBlock, LRS.handleNewBlocks);
					if (LRS.account) {
						LRS.getNewTransactions();
						LRS.updateApprovalRequests();
					}
				} else {
					if (LRS.account) {
						LRS.getUnconfirmedTransactions(function(unconfirmedTransactions) {
							LRS.handleIncomingTransactions(unconfirmedTransactions, false);
						});
					}
				}
				if (LRS.account && !_firstTimeAfterLoginRun) {
					//Executed ~30 secs after login, can be used for tasks needing this condition state
					_firstTimeAfterLoginRun = true;
				}

				if (callback) {
					callback();
				}
			}
			/* Checks if the client is connected to active peers */
			LRS.checkConnected();
			//only done so that download progress meter updates correctly based on lastFeederHeight
			if (LRS.downloadingBlockchain) {
				LRS.updateBlockchainDownloadProgress();
			}
		});
	};

	$("#logo, .sidebar-menu").on("click", "a", function(e, data) {
		if ($(this).hasClass("ignore")) {
			$(this).removeClass("ignore");
			return;
		}

		e.preventDefault();

		if ($(this).data("toggle") == "modal") {
			return;
		}

		var page = $(this).data("page");

		if (page == LRS.currentPage) {
			if (data && data.callback) {
				data.callback();
			}
			return;
		}

		$(".page").hide();

		$(document.documentElement).scrollTop(0);

		$("#" + page + "_page").show();

		$(".content-header h1").find(".loading_dots").remove();

		if ($(this).attr("id") && $(this).attr("id") == "logo") {
			var $newActiveA = $("#dashboard_link a");
		} else {
			var $newActiveA = $(this);
		}
		var $newActivePageLi = $newActiveA.closest("li.treeview");
		var $currentActivePageLi = $("ul.sidebar-menu > li.active");

		$("ul.sidebar-menu > li.active").each(function(key, elem) {
			if ($newActivePageLi.attr("id") != $(elem).attr("id")) {
				$(elem).children("a").first().addClass("ignore").click();
			}
		});

		$("ul.sidebar-menu > li.sm_simple").removeClass("active");
		if ($newActiveA.parent("li").hasClass("sm_simple")) {
			$newActiveA.parent("li").addClass("active");
		}

		$("ul.sidebar-menu li.sm_treeview_submenu").removeClass("active");
		if($(this).parent("li").hasClass("sm_treeview_submenu")) {
			$(this).closest("li").addClass("active");
		}

		if (LRS.currentPage != "messages") {
			$("#inline_message_password").val("");
		}

		//LRS.previousPage = LRS.currentPage;
		LRS.currentPage = page;
		LRS.currentSubPage = "";
		LRS.pageNumber = 1;
		LRS.showPageNumbers = false;

		if (LRS.pages[page]) {
			LRS.pageLoading();
			LRS.resetNotificationState(page);
			if (data) {
				if (data.callback) {
					var callback = data.callback;	
				} else {
					var callback = data;
				}
			} else {
				var callback = undefined;
			}
			if (data && data.subpage) {
				var subpage = data.subpage;
			} else {
				var subpage = undefined;
			}
			LRS.pages[page](callback, subpage);
		}
	});

	$("button.goto-page, a.goto-page").click(function(event) {
		event.preventDefault();
		LRS.goToPage($(this).data("page"), undefined, $(this).data("subpage"));
	});

	LRS.loadPage = function(page, callback, subpage) {
		LRS.pageLoading();
		LRS.pages[page](callback, subpage);
	};

	LRS.goToPage = function(page, callback, subpage) {
		var $link = $("ul.sidebar-menu a[data-page=" + page + "]");

		if ($link.length > 1) {
			if ($link.last().is(":visible")) {
				$link = $link.last();
			} else {
				$link = $link.first();
			}
		}

		if ($link.length == 1) {
			$link.trigger("click", [{
				"callback": callback,
				"subpage": subpage
			}]);
			LRS.resetNotificationState(page);
		} else {
			LRS.currentPage = page;
			LRS.currentSubPage = "";
			LRS.pageNumber = 1;
			LRS.showPageNumbers = false;

			$("ul.sidebar-menu a.active").removeClass("active");
			$(".page").hide();
			$("#" + page + "_page").show();
			if (LRS.pages[page]) {
				LRS.pageLoading();
				LRS.resetNotificationState(page);
				LRS.pages[page](callback, subpage);
			}
		}
	};

	LRS.pageLoading = function() {
		LRS.hasMorePages = false;

		var $pageHeader = $("#" + LRS.currentPage + "_page .content-header h1");
		$pageHeader.find(".loading_dots").remove();
		$pageHeader.append("<span class='loading_dots'><span>.</span><span>.</span><span>.</span></span>");
	};

	LRS.pageLoaded = function(callback) {
		var $currentPage = $("#" + LRS.currentPage + "_page");

		$currentPage.find(".content-header h1 .loading_dots").remove();

		if ($currentPage.hasClass("paginated")) {
			LRS.addPagination();
		}

		if (callback) {
			callback();
		}
	};

	LRS.addPagination = function(section) {
		var firstStartNr = 1;
		var firstEndNr = LRS.itemsPerPage;
		var currentStartNr = (LRS.pageNumber-1) * LRS.itemsPerPage + 1;
		var currentEndNr = LRS.pageNumber * LRS.itemsPerPage;

		var prevHTML = '<span style="display:inline-block;width:48px;text-align:right;">';
		var firstHTML = '<span style="display:inline-block;min-width:48px;text-align:right;vertical-align:top;margin-top:4px;">';
		var currentHTML = '<span style="display:inline-block;min-width:48px;text-align:left;vertical-align:top;margin-top:4px;">';
		var nextHTML = '<span style="display:inline-block;width:48px;text-align:left;">';

		if (LRS.pageNumber > 1) {
			prevHTML += "<a href='#' data-page='" + (LRS.pageNumber - 1) + "' title='" + $.t("previous") + "' style='font-size:20px;'>";
			prevHTML += "<i class='fa fa-arrow-circle-left'></i></a>";
		} else {
			prevHTML += '&nbsp;';
		}

		if (LRS.hasMorePages) {
			currentHTML += currentStartNr + "-" + currentEndNr + "&nbsp;";
			nextHTML += "<a href='#' data-page='" + (LRS.pageNumber + 1) + "' title='" + $.t("next") + "' style='font-size:20px;'>";
			nextHTML += "<i class='fa fa-arrow-circle-right'></i></a>";
		} else {
			if (LRS.pageNumber > 1) {
				currentHTML += currentStartNr + "+";
			} else {
				currentHTML += "&nbsp;";
			}
			nextHTML += "&nbsp;";
		}
		if (LRS.pageNumber > 1) {
			firstHTML += "&nbsp;<a href='#' data-page='1'>" + firstStartNr + "-" + firstEndNr + "</a>&nbsp;|&nbsp;";
		} else {
			firstHTML += "&nbsp;";
		}

		prevHTML += '</span>';
		firstHTML += '</span>'; 
		currentHTML += '</span>';
		nextHTML += '</span>';

		var output = prevHTML + firstHTML + currentHTML + nextHTML;
		var $paginationContainer = $("#" + LRS.currentPage + "_page .data-pagination");

		if ($paginationContainer.length) {
			$paginationContainer.html(output);
		}
	};

	$(".data-pagination").on("click", "a", function(e) {
		e.preventDefault();

		LRS.goToPageNumber($(this).data("page"));
	});

	LRS.goToPageNumber = function(pageNumber) {
		/*if (!pageLoaded) {
			return;
		}*/
		LRS.pageNumber = pageNumber;

		LRS.pageLoading();

		LRS.pages[LRS.currentPage]();
	};

		

	LRS.initUserDBSuccess = function() {
		LRS.database.select("data", [{
			"id": "asset_exchange_version"
		}], function(error, result) {
			if (!result || !result.length) {
				LRS.database.delete("assets", [], function(error, affected) {
					if (!error) {
						LRS.database.insert("data", {
							"id": "asset_exchange_version",
							"contents": 2
						});
					}
				});
			}
		});

		LRS.database.select("data", [{
			"id": "closed_groups"
		}], function(error, result) {
			if (result && result.length) {
				LRS.closedGroups = result[0].contents.split("#");
			} else {
				LRS.database.insert("data", {
					id: "closed_groups",
					contents: ""
				});
			}
		});

		LRS.databaseSupport = true;
        LRS.logConsole("Browser database initialized");
		LRS.loadContacts();
		LRS.getSettings();
		LRS.updateNotifications();
		LRS.setUnconfirmedNotifications();
		LRS.setPhasingNotifications();
	}

	LRS.initUserDBWithLegacyData = function() {
		var legacyTables = ["contacts", "assets", "data"];
		$.each(legacyTables, function(key, table) {
			LRS.legacyDatabase.select(table, null, function(error, results) {
				if (!error && results && results.length >= 0) {
					LRS.database.insert(table, results, function(error, inserts) {});
				}
			});
		});
		setTimeout(function(){ LRS.initUserDBSuccess(); }, 1000);
	}

	LRS.initUserDBFail = function() {
		LRS.database = null;
		LRS.databaseSupport = false;
		LRS.getSettings();
		LRS.updateNotifications();
		LRS.setUnconfirmedNotifications();
		LRS.setPhasingNotifications();
	}

	LRS.createLegacyDatabase = function() {
		var schema = {}
		var versionLegacyDB = 2;

		// Legacy DB before switching to account based DBs, leave schema as is
		schema["contacts"] = {
			id: {
				"primary": true,
				"autoincrement": true,
				"type": "NUMBER"
			},
			name: "VARCHAR(100) COLLATE NOCASE",
			email: "VARCHAR(200)",
			account: "VARCHAR(25)",
			accountRS: "VARCHAR(25)",
			description: "TEXT"
		}
		schema["assets"] = {
			account: "VARCHAR(25)",
			accountRS: "VARCHAR(25)",
			asset: {
				"primary": true,
				"type": "VARCHAR(25)"
			},
			description: "TEXT",
			name: "VARCHAR(10)",
			decimals: "NUMBER",
			quantityQNT: "VARCHAR(15)",
			groupName: "VARCHAR(30) COLLATE NOCASE"
		}
		schema["data"] = {
			id: {
				"primary": true,
				"type": "VARCHAR(40)"
			},
			contents: "TEXT"
		}
		if (versionLegacyDB = LRS.constants.DB_VERSION) {
			try {
				LRS.legacyDatabase = new WebDB("LRS_USER_DB", schema, versionLegacyDB, 4, function(error, db) {
					if (!error) {
						LRS.legacyDatabase.select("data", [{
							"id": "settings"
						}], function(error, result) {
							if (result && result.length > 0) {
								LRS.legacyDatabaseWithData = true;
							}
						});
					}
				});
			} catch (err) {
                LRS.logConsole("error creating database " + err.message);
			}		
		}
	};

	LRS.createDatabase = function(dbName) {
		var schema = {}

		schema["contacts"] = {
			id: {
				"primary": true,
				"autoincrement": true,
				"type": "NUMBER"
			},
			name: "VARCHAR(100) COLLATE NOCASE",
			email: "VARCHAR(200)",
			account: "VARCHAR(25)",
			accountRS: "VARCHAR(25)",
			description: "TEXT"
		}
		schema["assets"] = {
			account: "VARCHAR(25)",
			accountRS: "VARCHAR(25)",
			asset: {
				"primary": true,
				"type": "VARCHAR(25)"
			},
			description: "TEXT",
			name: "VARCHAR(10)",
			decimals: "NUMBER",
			quantityQNT: "VARCHAR(15)",
			groupName: "VARCHAR(30) COLLATE NOCASE"
		}
		schema["polls"] = {
			account: "VARCHAR(25)",
			accountRS: "VARCHAR(25)",
			name: "VARCHAR(100)",
			description: "TEXT",
			poll: "VARCHAR(25)",
			finishHeight: "VARCHAR(25)"
		}
		schema["data"] = {
			id: {
				"primary": true,
				"type": "VARCHAR(40)"
			},
			contents: "TEXT"
		}

		LRS.assetTableKeys = ["account", "accountRS", "asset", "description", "name", "position", "decimals", "quantityQNT", "groupName"];
		LRS.pollsTableKeys = ["account", "accountRS", "poll", "description", "name", "finishHeight"];


		try {
			LRS.database = new WebDB(dbName, schema, LRS.constants.DB_VERSION, 4, function(error, db) {
				if (!error) {
					LRS.database.select("data", [{
						"id": "settings"
					}], function(error, result) {
						if (result && result.length > 0) {
							LRS.databaseFirstStart = false;
							LRS.initUserDBSuccess();
						} else {
							LRS.databaseFirstStart = true;
							if (LRS.databaseFirstStart && LRS.legacyDatabaseWithData) {
								LRS.initUserDBWithLegacyData();
							} else {
								LRS.initUserDBSuccess();
							}
						}
					});
				} else {
					LRS.initUserDBFail();
				}
			});
		} catch (err) {
			LRS.initUserDBFail();
		}
	};
	
	/* Display connected state in Sidebar */
	LRS.checkConnected = function() {
		LRS.sendRequest("getPeers+", {
			"state": "CONNECTED"
		}, function(response) {
			if (response.peers && response.peers.length) {
				LRS.peerConnect = true;
				$("#connected_indicator").addClass("connected");
				$("#connected_indicator span").html($.t("Connected")).attr("data-i18n", "connected");
				$("#connected_indicator").show();
			} else {
				LRS.peerConnect = false;
				$("#connected_indicator").removeClass("connected");
				$("#connected_indicator span").html($.t("Not Connected")).attr("data-i18n", "not_connected");
				$("#connected_indicator").show();
			}
		});
	};

	LRS.getAccountInfo = function(firstRun, callback) {
		LRS.sendRequest("getAccount", {
			"account": LRS.account
		}, function(response) {
			var previousAccountInfo = LRS.accountInfo;

			LRS.accountInfo = response;

			if (response.errorCode) {
				$("#account_balance, #account_balance_sidebar, #account_nr_assets, #account_assets_balance, #account_currencies_balance, #account_nr_currencies, #account_purchase_count, #account_pending_sale_count, #account_completed_sale_count, #account_message_count, #account_alias_count").html("0");
				
				if (LRS.accountInfo.errorCode == 5) {
					if (LRS.downloadingBlockchain) {
						if (LRS.newlyCreatedAccount) {
							$("#dashboard_message").addClass("alert-success").removeClass("alert-danger").html($.t("status_new_account", {
								"account_id": String(LRS.accountRS).escapeHTML(),
								"public_key": String(LRS.publicKey).escapeHTML()
							}) + "<br /><br />" + $.t("status_blockchain_downloading")).show();
						} else {
							$("#dashboard_message").addClass("alert-success").removeClass("alert-danger").html($.t("status_blockchain_downloading")).show();
						}
					} else if (LRS.state && LRS.state.isScanning) {
						$("#dashboard_message").addClass("alert-danger").removeClass("alert-success").html($.t("status_blockchain_rescanning")).show();
					} else {
                        if (LRS.publicKey == "") {
                            $("#dashboard_message").addClass("alert-success").removeClass("alert-danger").html($.t("status_new_account_no_pk_v2", {
                                "account_id": String(LRS.accountRS).escapeHTML()
                            })).show();
                        } else {
                            $("#dashboard_message").addClass("alert-success").removeClass("alert-danger").html($.t("status_new_account", {
                                "account_id": String(LRS.accountRS).escapeHTML(),
                                "public_key": String(LRS.publicKey).escapeHTML()
                            })).show();
                        }
					}
				} else {
					$("#dashboard_message").addClass("alert-danger").removeClass("alert-success").html(LRS.accountInfo.errorDescription ? LRS.accountInfo.errorDescription.escapeHTML() : $.t("error_unknown")).show();
				}
			} else {
				if (LRS.accountRS && LRS.accountInfo.accountRS != LRS.accountRS) {
					$.growl("Generated Reed Solomon address different from the one in the blockchain!", {
						"type": "danger"
					});
					LRS.accountRS = LRS.accountInfo.accountRS;
				}

				if (LRS.downloadingBlockchain) {
					$("#dashboard_message").addClass("alert-success").removeClass("alert-danger").html($.t("status_blockchain_downloading")).show();
				} else if (LRS.state && LRS.state.isScanning) {
					$("#dashboard_message").addClass("alert-danger").removeClass("alert-success").html($.t("status_blockchain_rescanning")).show();
				} else if (!LRS.accountInfo.publicKey) {
                    var warning = LRS.publicKey != 'undefined' ? $.t("public_key_not_announced_warning", { "public_key": LRS.publicKey }) : $.t("no_public_key_warning");
					$("#dashboard_message").addClass("alert-danger").removeClass("alert-success").html(warning + " " + $.t("public_key_actions")).show();
				} else {
					$("#dashboard_message").hide();
				}

				//only show if happened within last week
				var showAssetDifference = (!LRS.downloadingBlockchain || (LRS.blocks && LRS.blocks[0] && LRS.state && LRS.state.time - LRS.blocks[0].timestamp < 60 * 60 * 24 * 7));

				if (LRS.databaseSupport) {
					LRS.database.select("data", [{
						"id": "asset_balances"
					}], function(error, asset_balance) {
						if (asset_balance && asset_balance.length) {
							var previous_balances = asset_balance[0].contents;

							if (!LRS.accountInfo.assetBalances) {
								LRS.accountInfo.assetBalances = [];
							}

							var current_balances = JSON.stringify(LRS.accountInfo.assetBalances);

							if (previous_balances != current_balances) {
								if (previous_balances != "undefined" && typeof previous_balances != "undefined") {
									previous_balances = JSON.parse(previous_balances);
								} else {
									previous_balances = [];
								}
								LRS.database.update("data", {
									contents: current_balances
								}, [{
									id: "asset_balances"
								}]);
								if (showAssetDifference) {
									LRS.checkAssetDifferences(LRS.accountInfo.assetBalances, previous_balances);
								}
							}
						} else {
							LRS.database.insert("data", {
								id: "asset_balances",
								contents: JSON.stringify(LRS.accountInfo.assetBalances)
							});
						}
					});
				} else if (showAssetDifference && previousAccountInfo && previousAccountInfo.assetBalances) {
					var previousBalances = JSON.stringify(previousAccountInfo.assetBalances);
					var currentBalances = JSON.stringify(LRS.accountInfo.assetBalances);

					if (previousBalances != currentBalances) {
						LRS.checkAssetDifferences(LRS.accountInfo.assetBalances, previousAccountInfo.assetBalances);
					}
				}

				$("#account_balance, #account_balance_sidebar").html(LRS.formatStyledAmount(response.unconfirmedBalanceLQT));
				$("#account_forged_balance").html(LRS.formatStyledAmount(response.forgedBalanceLQT));

				if (response.assetBalances) {
                    var assets = [];
                    var assetBalances = response.assetBalances;
                    var assetBalancesMap = {};
                    for (var i = 0; i < assetBalances.length; i++) {
                        if (assetBalances[i].balanceQNT != "0") {
                            assets.push(assetBalances[i].asset);
                            assetBalancesMap[assetBalances[i].asset] = assetBalances[i].balanceQNT;
                        }
                    }
                    LRS.sendRequest("getLastTrades", {
                        "assets": assets
                    }, function(response) {
                        if (response.trades && response.trades.length) {
                            var assetTotal = 0;
                            for (i=0; i < response.trades.length; i++) {
                                var trade = response.trades[i];
                                assetTotal += assetBalancesMap[trade.asset] * trade.priceLQT / 100000000;
                            }
                            $("#account_assets_balance").html(LRS.formatStyledAmount(new Big(assetTotal).toFixed(8)));
                            $("#account_nr_assets").html(response.trades.length);
                        } else {
                            $("#account_assets_balance").html(0);
                            $("#account_nr_assets").html(0);
                        }
                    });
                } else {
                    $("#account_assets_balance").html(0);
                    $("#account_nr_assets").html(0);
                }

				if (response.accountCurrencies) {
                    var currencies = [];
                    var currencyBalances = response.accountCurrencies;
                    var currencyBalancesMap = {};
                    for (var i = 0; i < currencyBalances.length; i++) {
                        if (currencyBalances[i].units != "0") {
                            currencies.push(currencyBalances[i].currency);
                            currencyBalancesMap[currencyBalances[i].currency] = currencyBalances[i].units;
                        }
                    }
                    LRS.sendRequest("getLastExchanges", {
                        "currencies": currencies
                    }, function(response) {
                        if (response.exchanges && response.exchanges.length) {
                            var currencyTotal = 0;
                            for (i=0; i < response.exchanges.length; i++) {
                                var exchange = response.exchanges[i];
                                currencyTotal += currencyBalancesMap[exchange.currency] * exchange.rateLQT / 100000000;
                            }
                            $("#account_currencies_balance").html(LRS.formatStyledAmount(new Big(currencyTotal).toFixed(8)));
                            $("#account_nr_currencies").html(response.exchanges.length);
                        } else {
                            $("#account_currencies_balance").html(0);
                            $("#account_nr_currencies").html(0);
                        }
                    });
                } else {
                    $("#account_currencies_balance").html(0);
                    $("#account_nr_currencies").html(0);
                }

				/* Display message count in top and limit to 100 for now because of possible performance issues*/
				LRS.sendRequest("getBlockchainTransactions+", {
					"account": LRS.account,
					"type": 1,
					"subtype": 0,
					"firstIndex": 0,
					"lastIndex": 99
				}, function(response) {
					if (response.transactions && response.transactions.length) {
						if (response.transactions.length > 99)
							$("#account_message_count").empty().append("99+");
						else
							$("#account_message_count").empty().append(response.transactions.length);
					} else {
						$("#account_message_count").empty().append("0");
					}
				});	
				
				/***  ******************   ***/
				
				LRS.sendRequest("getAliasCount+", {
					"account":LRS.account
				}, function(response) {
					if (response.numberOfAliases != null) {
						$("#account_alias_count").empty().append(response.numberOfAliases);
					}
				});
				
				LRS.sendRequest("getDGSPurchaseCount+", {
					"buyer": LRS.account
				}, function(response) {
					if (response.numberOfPurchases != null) {
						$("#account_purchase_count").empty().append(response.numberOfPurchases);
					}
				});

				LRS.sendRequest("getDGSPendingPurchases+", {
					"seller": LRS.account
				}, function(response) {
					if (response.purchases && response.purchases.length) {
						$("#account_pending_sale_count").empty().append(response.purchases.length);
					} else {
						$("#account_pending_sale_count").empty().append("0");
					}
				});

				LRS.sendRequest("getDGSPurchaseCount+", {
					"seller": LRS.account,
					"completed": true
				}, function(response) {
					if (response.numberOfPurchases != null) {
						$("#account_completed_sale_count").empty().append(response.numberOfPurchases);
					}
				});

				if (LRS.lastBlockHeight) {
					var isLeased = LRS.lastBlockHeight >= LRS.accountInfo.currentLeasingHeightFrom;
					if (isLeased != LRS.IsLeased) {
						var leasingChange = true;
						LRS.isLeased = isLeased;
					}
				} else {
					var leasingChange = false;
				}

				if (leasingChange ||
					(response.currentLeasingHeightFrom != previousAccountInfo.currentLeasingHeightFrom) ||
					(response.lessors && !previousAccountInfo.lessors) ||
					(!response.lessors && previousAccountInfo.lessors) ||
					(response.lessors && previousAccountInfo.lessors && response.lessors.sort().toString() != previousAccountInfo.lessors.sort().toString())) {
					LRS.updateAccountLeasingStatus();
				}

				if (response.name) {
					$("#account_name").html(response.name.escapeHTML()).removeAttr("data-i18n");
				}
			}

			if (firstRun) {
				$("#account_balance, #account_balance_sidebar, #account_assets_balance, #account_nr_assets, #account_currencies_balance, #account_nr_currencies, #account_purchase_count, #account_pending_sale_count, #account_completed_sale_count, #account_message_count, #account_alias_count").removeClass("loading_dots");
			}

			if (callback) {
				callback();
			}
		});
	};

	LRS.updateAccountLeasingStatus = function() {
		var accountLeasingLabel = "";
		var accountLeasingStatus = "";
		var nextLesseeStatus = "";
		if (LRS.accountInfo.nextLeasingHeightFrom < LRS.constants.MAX_INT_JAVA) {
			nextLesseeStatus = $.t("next_lessee_status", {
				"start": String(LRS.accountInfo.nextLeasingHeightFrom).escapeHTML(),
				"end": String(LRS.accountInfo.nextLeasingHeightTo).escapeHTML(),
				"account": String(LRS.convertNumericToRSAccountFormat(LRS.accountInfo.nextLessee)).escapeHTML()
			})
		}

		if (LRS.lastBlockHeight >= LRS.accountInfo.currentLeasingHeightFrom) {
			accountLeasingLabel = $.t("leased_out");
			accountLeasingStatus = $.t("balance_is_leased_out", {
				"blocks": String(LRS.accountInfo.currentLeasingHeightTo - LRS.lastBlockHeight).escapeHTML(),
				"end": String(LRS.accountInfo.currentLeasingHeightTo).escapeHTML(),
				"account": String(LRS.accountInfo.currentLesseeRS).escapeHTML()
			});
			$("#lease_balance_message").html($.t("balance_leased_out_help"));
		} else if (LRS.lastBlockHeight < LRS.accountInfo.currentLeasingHeightTo) {
			accountLeasingLabel = $.t("leased_soon");
			accountLeasingStatus = $.t("balance_will_be_leased_out", {
				"blocks": String(LRS.accountInfo.currentLeasingHeightFrom - LRS.lastBlockHeight).escapeHTML(),
				"start": String(LRS.accountInfo.currentLeasingHeightFrom).escapeHTML(),
				"end": String(LRS.accountInfo.currentLeasingHeightTo).escapeHTML(),
				"account": String(LRS.accountInfo.currentLesseeRS).escapeHTML()
			});
			$("#lease_balance_message").html($.t("balance_leased_out_help"));
		} else {
			accountLeasingStatus = $.t("balance_not_leased_out");
			$("#lease_balance_message").html($.t("balance_leasing_help"));
		}
		if (nextLesseeStatus != "") {
			accountLeasingStatus += "<br>" + nextLesseeStatus;
		}

		//no reed solomon available? do it myself? todo
		if (LRS.accountInfo.lessors) {
			if (accountLeasingLabel) {
				accountLeasingLabel += ", ";
				accountLeasingStatus += "<br /><br />";
			}

			accountLeasingLabel += $.t("x_lessor", {
				"count": LRS.accountInfo.lessors.length
			});
			accountLeasingStatus += $.t("x_lessor_lease", {
				"count": LRS.accountInfo.lessors.length
			});

			var rows = "";

			for (var i = 0; i < LRS.accountInfo.lessorsRS.length; i++) {
				var lessor = LRS.accountInfo.lessorsRS[i];
				var lessorInfo = LRS.accountInfo.lessorsInfo[i];
				var blocksLeft = lessorInfo.currentHeightTo - LRS.lastBlockHeight;
				var blocksLeftTooltip = "From block " + lessorInfo.currentHeightFrom + " to block " + lessorInfo.currentHeightTo;
				var nextLessee = "Not set";
				var nextTooltip = "Next lessee not set";
				if (lessorInfo.nextLesseeRS == LRS.accountRS) {
					nextLessee = "You";
					nextTooltip = "From block " + lessorInfo.nextHeightFrom + " to block " + lessorInfo.nextHeightTo;
				} else if (lessorInfo.nextHeightFrom < LRS.constants.MAX_INT_JAVA) {
					nextLessee = "Not you";
					nextTooltip = "Account " + LRS.getAccountTitle(lessorInfo.nextLesseeRS) +" from block " + lessorInfo.nextHeightFrom + " to block " + lessorInfo.nextHeightTo;
				}
				rows += "<tr>" +
					"<td><a href='#' data-user='" + String(lessor).escapeHTML() + "' class='show_account_modal_action'>" + LRS.getAccountTitle(lessor) + "</a></td>" +
					"<td>" + String(lessorInfo.effectiveBalanceLRD).escapeHTML() + "</td>" +
					"<td><label>" + String(blocksLeft).escapeHTML() + " <i class='fa fa-question-circle show_popover' data-toggle='tooltip' title='" + blocksLeftTooltip + "' data-placement='right' style='color:#4CAA6E'></i></label></td>" +
					"<td><label>" + String(nextLessee).escapeHTML() + " <i class='fa fa-question-circle show_popover' data-toggle='tooltip' title='" + nextTooltip + "' data-placement='right' style='color:#4CAA6E'></i></label></td>" +
				"</tr>";
			}

			$("#account_lessor_table tbody").empty().append(rows);
			$("#account_lessor_container").show();
			$("#account_lessor_table [data-toggle='tooltip']").tooltip();
		} else {
			$("#account_lessor_table tbody").empty();
			$("#account_lessor_container").hide();
		}

		if (accountLeasingLabel) {
			$("#account_leasing").html(accountLeasingLabel).show();
		} else {
			$("#account_leasing").hide();
		}

		if (accountLeasingStatus) {
			$("#account_leasing_status").html(accountLeasingStatus).show();
		} else {
			$("#account_leasing_status").hide();
		}
	};

	LRS.checkAssetDifferences = function(current_balances, previous_balances) {
		var current_balances_ = {};
		var previous_balances_ = {};

		if (previous_balances && previous_balances.length) {
			for (var k in previous_balances) {
				previous_balances_[previous_balances[k].asset] = previous_balances[k].balanceQNT;
			}
		}

		if (current_balances && current_balances.length) {
			for (var k in current_balances) {
				current_balances_[current_balances[k].asset] = current_balances[k].balanceQNT;
			}
		}

		var diff = {};

		for (var k in previous_balances_) {
			if (!(k in current_balances_)) {
				diff[k] = "-" + previous_balances_[k];
			} else if (previous_balances_[k] !== current_balances_[k]) {
				var change = (new BigInteger(current_balances_[k]).subtract(new BigInteger(previous_balances_[k]))).toString();
				diff[k] = change;
			}
		}

		for (k in current_balances_) {
			if (!(k in previous_balances_)) {
				diff[k] = current_balances_[k]; // property is new
			}
		}

		var nr = Object.keys(diff).length;

		if (nr == 0) {
			return;
		} else if (nr <= 3) {
			for (k in diff) {
				LRS.sendRequest("getAsset", {
					"asset": k,
					"_extra": {
						"asset": k,
						"difference": diff[k]
					}
				}, function(asset, input) {
					if (asset.errorCode) {
						return;
					}
					asset.difference = input["_extra"].difference;
					asset.asset = input["_extra"].asset;

					if (asset.difference.charAt(0) != "-") {
						var quantity = LRS.formatQuantity(asset.difference, asset.decimals)

						if (quantity != "0") {
							if (parseInt(quantity) == 1) {
								$.growl($.t("you_received_assets", {
									"name": String(asset.name).escapeHTML()
								}), {
									"type": "success"
								});
							} else {
								$.growl($.t("you_received_assets_plural", {
									"name": String(asset.name).escapeHTML(),
									"count": quantity
								}), {
									"type": "success"
								});
							}
							LRS.loadAssetExchangeSidebar();
						}
					} else {
						asset.difference = asset.difference.substring(1);

						var quantity = LRS.formatQuantity(asset.difference, asset.decimals)

						if (quantity != "0") {
							if (parseInt(quantity) == 1) {
								$.growl($.t("you_sold_assets", {
									"name": String(asset.name).escapeHTML()
								}), {
									"type": "success"
								});
							} else {
								$.growl($.t("you_sold_assets_plural", {
									"name": String(asset.name).escapeHTML(),
									"count": quantity
								}), {
									"type": "success"
								});
							} 
							LRS.loadAssetExchangeSidebar();
						}
					}
				});
			}
		} else {
			$.growl($.t("multiple_assets_differences"), {
				"type": "success"
			});
		}
	};

	LRS.checkLocationHash = function(password) {
		if (window.location.hash) {
			var hash = window.location.hash.replace("#", "").split(":")

			if (hash.length == 2) {
				if (hash[0] == "message") {
					var $modal = $("#send_message_modal");
				} else if (hash[0] == "send") {
					var $modal = $("#send_money_modal");
				} else if (hash[0] == "asset") {
					LRS.goToAsset(hash[1]);
					return;
				} else {
					var $modal = "";
				}

				if ($modal) {
					var account_id = String($.trim(hash[1]));
					$modal.find("input[name=recipient]").val(account_id.unescapeHTML()).trigger("blur");
					if (password && typeof password == "string") {
						$modal.find("input[name=secretPhrase]").val(password);
					}
					$modal.modal("show");
				}
			}

			window.location.hash = "#";
		}
	};

	LRS.updateBlockchainDownloadProgress = function() {
		var lastNumBlocks = 5000;
		$('#downloading_blockchain .last_num_blocks').html($.t('last_num_blocks', { "blocks": lastNumBlocks }));
		
		if (!LRS.serverConnect || !LRS.peerConnect) {
			$("#downloading_blockchain .db_active").hide();
			$("#downloading_blockchain .db_halted").show();
		} else {
			$("#downloading_blockchain .db_halted").hide();
			$("#downloading_blockchain .db_active").show();

			var percentageTotal = 0;
			var blocksLeft = undefined;
			var percentageLast = 0;
			if (LRS.state.lastBlockchainFeederHeight && LRS.state.numberOfBlocks <= LRS.state.lastBlockchainFeederHeight) {
				percentageTotal = parseInt(Math.round((LRS.state.numberOfBlocks / LRS.state.lastBlockchainFeederHeight) * 100), 10);
				blocksLeft = LRS.state.lastBlockchainFeederHeight - LRS.state.numberOfBlocks;
				if (blocksLeft <= lastNumBlocks && LRS.state.lastBlockchainFeederHeight > lastNumBlocks) {
					percentageLast = parseInt(Math.round(((lastNumBlocks - blocksLeft) / lastNumBlocks) * 100), 10);
				}
			}
			if (!blocksLeft || blocksLeft < parseInt(lastNumBlocks / 2)) {
				$("#downloading_blockchain .db_progress_total").hide();
			} else {
				$("#downloading_blockchain .db_progress_total").show();
				$("#downloading_blockchain .db_progress_total .progress-bar").css("width", percentageTotal + "%");
				$("#downloading_blockchain .db_progress_total .sr-only").html($.t("percent_complete", {
					"percent": percentageTotal
				}));
			}
			if (!blocksLeft || blocksLeft >= (lastNumBlocks * 2) || LRS.state.lastBlockchainFeederHeight <= lastNumBlocks) {
				$("#downloading_blockchain .db_progress_last").hide();
			} else {
				$("#downloading_blockchain .db_progress_last").show();
				$("#downloading_blockchain .db_progress_last .progress-bar").css("width", percentageLast + "%");
				$("#downloading_blockchain .db_progress_last .sr-only").html($.t("percent_complete", {
					"percent": percentageLast
				}));
			}
			if (blocksLeft) {
				$("#downloading_blockchain .blocks_left_outer").show();
				$("#downloading_blockchain .blocks_left").html($.t("blocks_left", { "numBlocks": blocksLeft }));
			}
		}
	};

	LRS.checkIfOnAFork = function() {
		if (!LRS.downloadingBlockchain) {
			var onAFork = true;

			if (LRS.blocks && LRS.blocks.length >= 10) {
				for (var i = 0; i < 10; i++) {
					if (LRS.blocks[i].generator != LRS.account) {
						onAFork = false;
						break;
					}
				}
			} else {
				onAFork = false;
			}

			if (onAFork) {
				$.growl($.t("fork_warning"), {
					"type": "danger"
				});
			}
		}
	};

    LRS.printEnvInfo = function() {
        LRS.logProperty("navigator.userAgent");
        LRS.logProperty("navigator.platform");
        LRS.logProperty("navigator.appVersion");
        LRS.logProperty("navigator.appName");
        LRS.logProperty("navigator.appCodeName");
        LRS.logProperty("navigator.hardwareConcurrency");
        LRS.logProperty("navigator.maxTouchPoints");
        LRS.logProperty("navigator.languages");
        LRS.logProperty("navigator.language");
        LRS.logProperty("navigator.cookieEnabled");
        LRS.logProperty("navigator.onLine");
        LRS.logProperty("LRS.isTestNet");
        LRS.logProperty("LRS.needsAdminPassword");
    };

	$("#id_search").on("submit", function(e) {
		e.preventDefault();

		var id = $.trim($("#id_search input[name=q]").val());

		if (/LRD\-/i.test(id)) {
			LRS.sendRequest("getAccount", {
				"account": id
			}, function(response, input) {
				if (!response.errorCode) {
					response.account = input.account;
					LRS.showAccountModal(response);
				} else {
					$.growl($.t("error_search_no_results"), {
						"type": "danger"
					});
				}
			});
		} else {
			if (!/^\d+$/.test(id)) {
				$.growl($.t("error_search_invalid"), {
					"type": "danger"
				});
				return;
			}
			LRS.sendRequest("getTransaction", {
				"transaction": id
			}, function(response, input) {
				if (!response.errorCode) {
					response.transaction = input.transaction;
					LRS.showTransactionModal(response);
				} else {
					LRS.sendRequest("getAccount", {
						"account": id
					}, function(response, input) {
						if (!response.errorCode) {
							response.account = input.account;
							LRS.showAccountModal(response);
						} else {
							LRS.sendRequest("getBlock", {
								"block": id,
                                "includeTransactions": "true"
							}, function(response, input) {
								if (!response.errorCode) {
									response.block = input.block;
									LRS.showBlockModal(response);
								} else {
									$.growl($.t("error_search_no_results"), {
										"type": "danger"
									});
								}
							});
						}
					});
				}
			});
		}
	});

	return LRS;
}(LRS || {}, jQuery));

$(document).ready(function() {
	LRS.init();
});

function receiveMessage(event) {
	if (event.origin != "file://") {
		return;
	}
	//parent.postMessage("from iframe", "file://");
}

function _checkDOMenabled() {
	var storage;
	var fail;
	var uid;
	try {
	  uid = new Date;
	  (storage = window.localStorage).setItem(uid, uid);
	  fail = storage.getItem(uid) != uid;
	  storage.removeItem(uid);
	  fail && (storage = false);
	} catch (exception) {}
	return storage;
}
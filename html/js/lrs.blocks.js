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
	LRS.blocksPageType = null;
	LRS.tempBlocks = [];
	var trackBlockchain = false;

	LRS.averageBlockGenerationTime = null;


	LRS.getBlock = function(blockID, callback, pageRequest) {
		LRS.sendRequest("getBlock" + (pageRequest ? "+" : ""), {
			"block": blockID
		}, function(response) {
			if (response.errorCode && response.errorCode == -1) {
				setTimeout(function (){ LRS.getBlock(blockID, callback, pageRequest); }, 2500);
			} else {
				if (LRS.blocks.length >= 2) {
					var max = Math.min(LRS.blocks.length-1, 10);
					var diffSum = 0;
					for (var i=1; i<=max; i++) {
						diffSum += (LRS.blocks[i-1].timestamp - LRS.blocks[i].timestamp);
					}
					LRS.averageBlockGenerationTime = Math.round(diffSum/max);
				}
				if (callback) {
					response.block = blockID;
					callback(response);
				}
			}
		}, true);
	}

	LRS.handleInitialBlocks = function(response) {
		if (response.errorCode) {
			LRS.dataLoadFinished($("#dashboard_blocks_table"));
			return;
		}

		LRS.blocks.push(response);

		if (LRS.blocks.length < 10 && response.previousBlock) {
			LRS.getBlock(response.previousBlock, LRS.handleInitialBlocks);
		} else {
			LRS.checkBlockHeight(LRS.blocks[0].height);

			if (LRS.state) {
				//if no new blocks in 6 hours, show blockchain download progress..
				var timeDiff = LRS.state.time - LRS.blocks[0].timestamp;
				if (timeDiff > 60 * 60 * 18) {
					if (timeDiff > 60 * 60 * 24 * 14) {
						LRS.setStateInterval(30);
					} else if (timeDiff > 60 * 60 * 24 * 7) {
						//second to last week
						LRS.setStateInterval(15);
					} else {
						//last week
						LRS.setStateInterval(10);
					}
					LRS.downloadingBlockchain = true;
					if (LRS.inApp) {
						parent.postMessage("downloadingBlockchain", "*");
					}
					$("#lrs_update_explanation span").hide();
					$("#lrs_update_explanation_wait").attr("style", "display: none !important");
					$("#downloading_blockchain, #lrs_update_explanation_blockchain_sync").show();
					$("#show_console").hide();
					LRS.updateBlockchainDownloadProgress();
				} else {
					//continue with faster state intervals if we still haven't reached current block from within 1 hour
					if (timeDiff < 60 * 60) {
						LRS.setStateInterval(30);
						trackBlockchain = false;
					} else {
						LRS.setStateInterval(10);
						trackBlockchain = true;
					}
				}
			}

			var rows = "";

			for (var i = 0; i < LRS.blocks.length; i++) {
				var block = LRS.blocks[i];

				rows += "<tr><td><a href='#' data-block='" + String(block.height).escapeHTML() + "' data-blockid='" + String(block.block).escapeHTML() + "' class='block show_block_modal_action'" + (block.numberOfTransactions > 0 ? " style='font-weight:bold'" : "") + ">" + String(block.height).escapeHTML() + "</a></td><td data-timestamp='" + String(block.timestamp).escapeHTML() + "'>" + LRS.formatTimestamp(block.timestamp) + "</td><td>" + LRS.formatAmount(block.totalAmountLQT) + " + " + LRS.formatAmount(block.totalFeeLQT) + "</td><td>" + LRS.formatAmount(block.numberOfTransactions) + "</td></tr>";
			}
			
			var block = LRS.blocks[0];			
			$("#lrs_current_block_time").empty().append(LRS.formatTimestamp(block.timestamp));
			$(".lrs_current_block").empty().append(String(block.height).escapeHTML());

			$("#dashboard_blocks_table tbody").empty().append(rows);
			LRS.dataLoadFinished($("#dashboard_blocks_table"));
		}
	}

	LRS.handleNewBlocks = function(response) {
		if (LRS.downloadingBlockchain) {
			//new round started...
			if (LRS.tempBlocks.length == 0 && LRS.state.lastBlock != response.block) {
				return;
			}
		}

		//we have all blocks 	
		if (response.height - 1 == LRS.lastBlockHeight || LRS.tempBlocks.length == 99) {
			var newBlocks = [];

			//there was only 1 new block (response)
			if (LRS.tempBlocks.length == 0) {
				//remove oldest block, add newest block
				LRS.blocks.unshift(response);
				newBlocks.push(response);
			} else {
				LRS.tempBlocks.push(response);
				//remove oldest blocks, add newest blocks
				[].unshift.apply(LRS.blocks, LRS.tempBlocks);
				newBlocks = LRS.tempBlocks;
				LRS.tempBlocks = [];
			}

			if (LRS.blocks.length > 100) {
				LRS.blocks = LRS.blocks.slice(0, 100);
			}

			LRS.checkBlockHeight(LRS.blocks[0].height);

			LRS.incoming.updateDashboardBlocks(newBlocks);
		} else {
			LRS.tempBlocks.push(response);
			LRS.getBlock(response.previousBlock, LRS.handleNewBlocks);
		}
	}

	LRS.checkBlockHeight = function(blockHeight) {
		if (blockHeight) {
			LRS.lastBlockHeight = blockHeight;
		}

		//no checks needed at the moment
	}

	//we always update the dashboard page..
	LRS.incoming.updateDashboardBlocks = function(newBlocks) {
		var newBlockCount = newBlocks.length;

		if (newBlockCount > 10) {
			newBlocks = newBlocks.slice(0, 10);
			newBlockCount = newBlocks.length;
		}

		if (LRS.downloadingBlockchain) {
			if (LRS.state) {
				var timeDiff = LRS.state.time - LRS.blocks[0].timestamp;
				if (timeDiff < 60 * 60 * 18) {
					if (timeDiff < 60 * 60) {
						LRS.setStateInterval(30);
					} else {
						LRS.setStateInterval(10);
						trackBlockchain = true;
					}
					LRS.downloadingBlockchain = false;
					if (LRS.inApp) {
						parent.postMessage("downloadedBlockchain", "*");
					}
					$("#dashboard_message").hide();
					$("#downloading_blockchain, #lrs_update_explanation_blockchain_sync").hide();
					$("#lrs_update_explanation_wait").removeAttr("style");
					if (LRS.settings["console_log"] && !LRS.inApp) {
						$("#show_console").show();
					}
					//todo: update the dashboard blocks!
					$.growl($.t("success_blockchain_up_to_date"), {
						"type": "success"
					});
					//LRS.checkAliasVersions();
					LRS.checkIfOnAFork();
				} else {
					if (timeDiff > 60 * 60 * 24 * 14) {
						LRS.setStateInterval(30);
					} else if (timeDiff > 60 * 60 * 24 * 7) {
						//second to last week
						LRS.setStateInterval(15);
					} else {
						//last week
						LRS.setStateInterval(10);
					}

					LRS.updateBlockchainDownloadProgress();
				}
			}
		} else if (trackBlockchain) {
			var timeDiff = LRS.state.time - LRS.blocks[0].timestamp;

			//continue with faster state intervals if we still haven't reached current block from within 1 hour
			if (timeDiff < 60 * 60) {
				LRS.setStateInterval(30);
				trackBlockchain = false;
			} else {
				LRS.setStateInterval(10);
			}
		}

		var rows = "";

		for (var i = 0; i < newBlockCount; i++) {
			var block = newBlocks[i];

			rows += "<tr><td><a href='#' data-block='" + String(block.height).escapeHTML() + "' data-blockid='" + String(block.block).escapeHTML() + "' class='block show_block_modal_action'" + (block.numberOfTransactions > 0 ? " style='font-weight:bold'" : "") + ">" + String(block.height).escapeHTML() + "</a></td><td data-timestamp='" + String(block.timestamp).escapeHTML() + "'>" + LRS.formatTimestamp(block.timestamp) + "</td><td>" + LRS.formatAmount(block.totalAmountLQT) + " + " + LRS.formatAmount(block.totalFeeLQT) + "</td><td>" + LRS.formatAmount(block.numberOfTransactions) + "</td></tr>";
		}

		if (newBlockCount == 1) {
			$("#dashboard_blocks_table tbody tr:last").remove();
		} else if (newBlockCount == 10) {
			$("#dashboard_blocks_table tbody").empty();
		} else {
			$("#dashboard_blocks_table tbody tr").slice(10 - newBlockCount).remove();
		}

		var block = LRS.blocks[0];			
		$("#lrs_current_block_time").empty().append(LRS.formatTimestamp(block.timestamp));
		$(".lrs_current_block").empty().append(String(block.height).escapeHTML());
		
		$("#dashboard_blocks_table tbody").prepend(rows);

		//update number of confirmations... perhaps we should also update it in tne LRS.transactions array
		$("#dashboard_table tr.confirmed td.confirmations").each(function() {
			if ($(this).data("incoming")) {
				$(this).removeData("incoming");
				return true;
			}

			var confirmations = parseInt($(this).data("confirmations"), 10);

			var nrConfirmations = confirmations + newBlocks.length;

			if (confirmations <= 10) {
				$(this).data("confirmations", nrConfirmations);
				$(this).attr("data-content", $.t("x_confirmations", {
					"x": LRS.formatAmount(nrConfirmations, false, true)
				}));

				if (nrConfirmations > 10) {
					nrConfirmations = '10+';
				}
				$(this).html(nrConfirmations);
			} else {
				$(this).attr("data-content", $.t("x_confirmations", {
					"x": LRS.formatAmount(nrConfirmations, false, true)
				}));
			}
		});
	}

	LRS.pages.blocks = function() {
		if (LRS.blocksPageType == "forged_blocks") {
			$("#forged_fees_total_box, #forged_blocks_total_box").show();
			$("#blocks_transactions_per_hour_box, #blocks_generation_time_box").hide();

			LRS.sendRequest("getAccountBlocks+", {
				"account": LRS.account,
				"firstIndex": LRS.pageNumber * LRS.itemsPerPage - LRS.itemsPerPage,
				"lastIndex": LRS.pageNumber * LRS.itemsPerPage
			}, function(response) {
				if (response.blocks && response.blocks.length) {
					if (response.blocks.length > LRS.itemsPerPage) {
						LRS.hasMorePages = true;
						response.blocks.pop();
					}
					LRS.blocksPageLoaded(response.blocks);
				} else {
					LRS.blocksPageLoaded([]);
				}
			});
		} else {
			$("#forged_fees_total_box, #forged_blocks_total_box").hide();
			$("#blocks_transactions_per_hour_box, #blocks_generation_time_box").show();
			
			LRS.sendRequest("getBlocks+", {
				"firstIndex": LRS.pageNumber * LRS.itemsPerPage - LRS.itemsPerPage,
				"lastIndex": LRS.pageNumber * LRS.itemsPerPage
			}, function(response) {
				if (response.blocks && response.blocks.length) {
					if (response.blocks.length > LRS.itemsPerPage) {
						LRS.hasMorePages = true;
						response.blocks.pop();
					}
					LRS.blocksPageLoaded(response.blocks);
				} else {
					LRS.blocksPageLoaded([]);
				}
			});
		}
	}

	LRS.incoming.blocks = function() {
		LRS.loadPage("blocks");
	}

	LRS.blocksPageLoaded = function(blocks) {
		var rows = "";
		var totalAmount = new BigInteger("0");
		var totalFees = new BigInteger("0");
		var totalTransactions = 0;

		for (var i = 0; i < blocks.length; i++) {
			var block = blocks[i];

			totalAmount = totalAmount.add(new BigInteger(block.totalAmountLQT));

			totalFees = totalFees.add(new BigInteger(block.totalFeeLQT));

			totalTransactions += block.numberOfTransactions;

			rows += "<tr><td><a href='#' data-block='" + String(block.height).escapeHTML() + "' data-blockid='" + String(block.block).escapeHTML() + "' class='block show_block_modal_action'" + (block.numberOfTransactions > 0 ? " style='font-weight:bold'" : "") + ">" + String(block.height).escapeHTML() + "</a></td><td>" + LRS.formatTimestamp(block.timestamp) + "</td><td>" + LRS.formatAmount(block.totalAmountLQT) + "</td><td>" + LRS.formatAmount(block.totalFeeLQT) + "</td><td>" + LRS.formatAmount(block.numberOfTransactions) + "</td><td>" + (block.generator != LRS.constants.GENESIS ? "<a href='#' data-user='" + LRS.getAccountFormatted(block, "generator") + "' class='user_info'>" + LRS.getAccountTitle(block, "generator") + "</a>" : $.t("genesis")) + "</td><td>" + LRS.formatVolume(block.payloadLength) + "</td><td>" + Math.round(block.baseTarget / 153722867 * 100).pad(4) + " %</td></tr>";
		}

		if (LRS.blocksPageType == "forged_blocks") {
			LRS.sendRequest("getAccountBlockCount+", {
				"account": LRS.account
			}, function(response) {
				if (response.numberOfBlocks && response.numberOfBlocks > 0) {
					$("#forged_blocks_total").html(response.numberOfBlocks).removeClass("loading_dots");
                    var avgFee = new Big(LRS.accountInfo.forgedBalanceLQT).div(response.numberOfBlocks).div(new Big("100000000")).toFixed(2);
                    $("#blocks_average_fee").html(LRS.formatStyledAmount(LRS.convertToLQT(avgFee))).removeClass("loading_dots");
				} else {
					$("#forged_blocks_total").html(0).removeClass("loading_dots");
					$("#blocks_average_fee").html(0).removeClass("loading_dots");
				}
			});
			$("#forged_fees_total").html(LRS.formatStyledAmount(LRS.accountInfo.forgedBalanceLQT)).removeClass("loading_dots");
			$("#blocks_average_amount").removeClass("loading_dots");
			$("#blocks_average_amount").parent().parent().css('visibility', 'hidden');
			$("#blocks_page .ion-stats-bars").parent().css('visibility', 'hidden');
		} else {
			if (blocks.length) {
				var startingTime = blocks[blocks.length - 1].timestamp;
				var endingTime = blocks[0].timestamp;
				var time = endingTime - startingTime;
			} else {
				var startingTime = endingTime = time = 0;
			}

			if (blocks.length) {
				var averageFee = new Big(totalFees.toString()).div(new Big("100000000")).div(new Big(String(blocks.length))).toFixed(2);
				var averageAmount = new Big(totalAmount.toString()).div(new Big("100000000")).div(new Big(String(blocks.length))).toFixed(2);
			} else {
				var averageFee = 0;
				var averageAmount = 0;
			}

			averageFee = LRS.convertToLQT(averageFee);
			averageAmount = LRS.convertToLQT(averageAmount);
			
			if (time == 0) {
				$("#blocks_transactions_per_hour").html("0").removeClass("loading_dots");
			} else {
				$("#blocks_transactions_per_hour").html(Math.round(totalTransactions / (time / 60) * 60)).removeClass("loading_dots");
			}
			$("#blocks_average_generation_time").html(Math.round(time / LRS.itemsPerPage) + "s").removeClass("loading_dots");
			$("#blocks_average_fee").html(LRS.formatStyledAmount(averageFee)).removeClass("loading_dots");
			$("#blocks_average_amount").parent().parent().css('visibility', 'visible');
			$("#blocks_page .ion-stats-bars").parent().css('visibility', 'visible');
			$("#blocks_average_amount").html(LRS.formatStyledAmount(averageAmount)).removeClass("loading_dots");
		}

		LRS.dataLoaded(rows);
	}

	$("#blocks_page_type .btn").click(function(e) {
		//	$("#blocks_page_type li a").click(function(e) {
		e.preventDefault();

		LRS.blocksPageType = $(this).data("type");

		$("#blocks_average_amount, #blocks_average_fee, #blocks_transactions_per_hour, #blocks_average_generation_time, #forged_blocks_total, #forged_fees_total").html("<span>.</span><span>.</span><span>.</span></span>").addClass("loading_dots");
		$("#blocks_table tbody").empty();
		$("#blocks_table").parent().addClass("data-loading").removeClass("data-empty");

		LRS.loadPage("blocks");
	});

	$("#goto_forged_blocks").click(function(e) {
		e.preventDefault();

		$("#blocks_page_type").find(".btn:last").button("toggle");
		LRS.blocksPageType = "forged_blocks";
		LRS.goToPage("blocks");
	});

	return LRS;
}(LRS || {}, jQuery));
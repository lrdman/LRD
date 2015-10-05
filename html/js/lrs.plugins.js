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

	LRS.plugins = {};
    LRS.disablePluginsDuringSession = true;
	LRS.activePlugins = false;
    LRS.numRunningPlugins = 0;

	LRS.checkForPluginManifest = function(pluginId) {
		var manifest = undefined;
		jQuery.ajaxSetup({ async: false });
    	$.ajax({
    		url: 'plugins/' + pluginId + '/manifest.json',
            cache: false,
    		success: function(data){
    			manifest = data;
    		}
		});
    	jQuery.ajaxSetup({ async: true });
    	return manifest;
	};

	LRS.checkPluginValidity = function(pluginId, manifest) {
		var plugin = LRS.plugins[pluginId];
		if (!manifest.pluginVersion) {
    		plugin['validity'] = LRS.constants.PV_UNKNOWN_MANIFEST_VERSION;
    		plugin['validity_msg'] = $.t('pv_unknown_manifest_version_msg', 'Unknown plugin manifest version');
    		return false;
    	}
    	if (manifest.pluginVersion != LRS.constants.PLUGIN_VERSION) {
    		plugin['validity'] = LRS.constants.PV_INCOMPATIBLE_MANIFEST_VERSION;
    		plugin['validity_msg'] = $.t('pv_incompatible_manifest_version_msg', 'Incompatible plugin manifest version');
    		return false;
    	}

    	var invalidManifestFileMsg = $.t('pv_invalid_manifest_file_msg', 'Invalid plugin manifest file');
    	var mandatoryManifestVars = ["name", "myVersion", "shortDescription", "infoUrl", "startPage", "lrsVersion"];
    	for (var i=0; i<mandatoryManifestVars.length; i++) {
    		var mvv = mandatoryManifestVars[i];
    		if (!manifest[mvv] || (manifest[mvv] && manifest[mvv].length == 0)) {
    			plugin['validity'] = LRS.constants.PV_INVALID_MANIFEST_FILE;
    			plugin['validity_msg'] = invalidManifestFileMsg;
    			console.log("Attribute '" + mvv + "' missing for '" + pluginId + "' plugin manifest file.");
    			return false;
    		}
    	}

    	var lengthRestrictions = [
    		["name", 20],
    		["myVersion", 16],
    		["shortDescription", 200],
    		["infoUrl", 200],
    		["startPage", 50],
    		["lrsVersion", 20]
    	];
    	for (i=0; i<lengthRestrictions.length; i++) {
    		if (manifest[lengthRestrictions[i][0]].length > lengthRestrictions[i][1]) {
    			plugin['validity'] = LRS.constants.PV_INVALID_MANIFEST_FILE;
    			plugin['validity_msg'] = invalidManifestFileMsg;
    			console.log("'" + lengthRestrictions[i][0] + "' attribute too long in '" + pluginId + "' plugin manifest file.");
    			return false;
    		}
    	}

    	if (!(manifest["infoUrl"].substr(0, 7) == 'http://' || manifest["infoUrl"].substr(0, 8) == 'https://')) {
    		plugin['validity'] = LRS.constants.PV_INVALID_MANIFEST_FILE;
    		plugin['validity_msg'] = invalidManifestFileMsg;
    		console.log("'infoUrl' attribute in '" + pluginId + "' plugin manifest file is not a valid URL.");
    		return false;
    	}

    	if (manifest["lrsVersion"].split('.').length != 3 || !(/^[\d\.]+$/.test(manifest["lrsVersion"]))) {
    		plugin['validity'] = LRS.constants.PV_INVALID_MANIFEST_FILE;
    		plugin['validity_msg'] = invalidManifestFileMsg;
    		console.log("'lrsVersion' attribute in '" + pluginId + "' plugin manifest file is not in correct format ('x.y.z', no additions).");
    		return false;
    	}

    	if (manifest["deactivated"] != undefined && typeof(manifest["deactivated"]) != "boolean") {
    		plugin['validity'] = LRS.constants.PV_INVALID_MANIFEST_FILE;
    		plugin['validity_msg'] = invalidManifestFileMsg;
    		console.log("'deactivated' attribute in '" + pluginId + "' plugin manifest file must be boolean type.");
    		return false;
    	}

    	if (manifest["sidebarOptOut"] != undefined && typeof(manifest["sidebarOptOut"]) != "boolean") {
    		plugin['validity'] = LRS.constants.PV_INVALID_MANIFEST_FILE;
    		plugin['validity_msg'] = invalidManifestFileMsg;
    		console.log("'sidebarOptOut' attribute in '" + pluginId + "' plugin manifest file must be boolean type.");
    		return false;
    	}

    	var pluginPath = 'plugins/' + pluginId + '/';
    	var notFound = undefined;
    	var mandatoryFiles = [
    		pluginPath + 'html/pages/' + pluginId + '.html',
    		pluginPath + 'html/modals/' + pluginId + '.html',
    		pluginPath + 'js/lrs.' + pluginId + '.js',
    		pluginPath + 'css/' + pluginId + '.css'
    	];
    	jQuery.ajaxSetup({ async: false });
    	for (i=0; i<mandatoryFiles.length; i++) {
			$.ajax({
    			url: mandatoryFiles[i],
    			type: 'HEAD',
                cache: false,
    			success: function(data) {
    				//nothing to do
    			},
    			error: function(data) {
                    LRS.logConsole(data.statusText + " error loading plugin file " + this.url);
    				notFound = this.url;
    			}
			});
    	}
    	jQuery.ajaxSetup({ async: true });

    	if (notFound) {
    		plugin['validity'] = LRS.constants.PV_INVALID_MISSING_FILES;
    		plugin['validity_msg'] = $.t('pv_invalid_missing_files_msg', 'Missing plugin files');
    		console.log("File '" + notFound + "' of plugin '" + pluginId + "' missing.");
    		return false;
    	}

    	plugin['validity'] = LRS.constants.PV_VALID;
    	plugin['validity_msg'] = $.t('pv_valid_msg', 'Plugin is valid');
    	return true;
	};

	LRS.checkPluginLRSCompatibility = function(pluginId) {
		var plugin = LRS.plugins[pluginId];
		var pluginLRSVersion = plugin.manifest["lrsVersion"];
		var pvList = pluginLRSVersion.split('.');
		var currentLRSVersion = LRS.state.version.replace(/[a-zA-Z]/g,'');
		var cvList = currentLRSVersion.split('.');
        var versionCompare = LRS.versionCompare(pluginLRSVersion, currentLRSVersion);
		if (versionCompare == 0) {
        	plugin['lrs_compatibility'] = LRS.constants.PNC_COMPATIBLE;
    		plugin['lrs_compatibility_msg'] = $.t('pnc_compatible_msg', 'Plugin compatible with LRS version');
        } else {
            if (versionCompare == 1) {
				plugin['lrs_compatibility'] = LRS.constants.PNC_COMPATIBILITY_CLIENT_VERSION_TOO_OLD;
                plugin['lrs_compatibility_msg'] = $.t('pnc_compatibility_build_for_newer_client_msg', 'Plugin build for newer client version');
			} else {
                if (pvList[0] == cvList[0] && pvList[1] == cvList[1]) {
                    plugin['lrs_compatibility'] = LRS.constants.PNC_COMPATIBILITY_MINOR_RELEASE_DIFF;
                    plugin['lrs_compatibility_msg'] = $.t('pnc_compatibility_minor_release_diff_msg', 'Plugin build for another minor release version');
                } else {
                    plugin['lrs_compatibility'] = LRS.constants.PNC_COMPATIBILITY_MAJOR_RELEASE_DIFF;
                    plugin['lrs_compatibility_msg'] = $.t('pnc_compatibility_minor_release_diff_msg', 'Plugin build for another major release version');      
                }
            }
		}
	};

	LRS.determinePluginLaunchStatus = function(pluginId) {
		var plugin = LRS.plugins[pluginId];
		if (!((300 <= plugin['validity'] && plugin['validity'] < 400) || (300 <= plugin['lrs_compatibility'] && plugin['validity'] < 400))) {
			if (plugin['manifest']['deactivated']) {
				plugin['launch_status'] = LRS.constants.PL_DEACTIVATED;
				plugin['launch_status_msg'] = $.t('plugin_deactivated', 'Deactivated');
			} else {
				plugin['launch_status'] = LRS.constants.PL_PAUSED;
				plugin['launch_status_msg'] = $.t('plugin_paused', 'Paused');
				LRS.activePlugins = true;
			}
		}
	};

	LRS.initializePlugins = function() {
		LRS.sendRequest("getPlugins", {}, function (response) {
			if(response.plugins && response.plugins.length >= 0) {
				for (var i=0; i<response.plugins.length; i++) {
					var manifest = LRS.checkForPluginManifest(response.plugins[i]);
					if (manifest) {
						LRS.plugins[response.plugins[i]] = {
							'validity': LRS.constants.PV_NOT_VALID,
							'validity_msg': $.t('pv_not_valid_msg', 'Plugin invalid'),
							'lrs_compatibility': LRS.constants.PNC_COMPATIBILITY_UNKNOWN,
							'lrs_compatibility_msg': $.t('pnc_compatible_unknown_msg', 'Plugin compatibility with LRS version unknown'),
							'launch_status': LRS.constants.PL_HALTED,
							'launch_status_msg': $.t('plugin_halted', 'Halted'),
							'manifest': undefined
						};
						if (LRS.checkPluginValidity(response.plugins[i], manifest)) {
							LRS.plugins[response.plugins[i]]['manifest'] = manifest;
							LRS.checkPluginLRSCompatibility(response.plugins[i]);
							LRS.determinePluginLaunchStatus(response.plugins[i]);
						}
					}
				}
			}
            LRS.initPluginWarning();
            $('#login_password').prop("disabled", false);
		});
	};

    LRS.pages.plugins = function() {
        var msg;
        if (LRS.numRunningPlugins == 1) {
            msg = $.t('one_plugin_active_and_running_msg');
        } else {
            msg = $.t('plugins_active_and_running_msg', {
                'num': String(LRS.numRunningPlugins)
            });
        }
        $('#plugins_page_msg').html(msg);
        LRS.dataLoaded();
    };

    LRS.loadPlugin = function(pluginId) {
        var plugin = LRS.plugins[pluginId];
        var manifest = LRS.plugins[pluginId]['manifest'];
        var pluginPath = 'plugins/' + pluginId + '/';
        async.series([
            function(callback){
                LRS.asyncLoadPageHTML(pluginPath + 'html/pages/' + pluginId + '.html');
                callback(null);
            },
            function(callback){
                LRS.asyncLoadPageHTML(pluginPath + 'html/modals/' + pluginId + '.html');
                callback(null);
            },
            function(callback){
                $.getScript(pluginPath + 'js/lrs.' + pluginId + '.js').done(function() {
                    if (!manifest['sidebarOptOut']) {
                        var sidebarId = 'sidebar_plugins';
                        var options = {
                            "titleHTML": manifest['name'].escapeHTML(),
                            "type": 'PAGE',
                            "page": manifest['startPage']
                        };
                        LRS.appendMenuItemToTSMenuItem(sidebarId, options);
                        $(".sidebar .treeview").tree();
                    }
                    var cssURL = pluginPath + 'css/' + pluginId + '.css';
                    if (document.createStyleSheet) {
                        document.createStyleSheet(cssURL);
                    } else {
                        $('<link rel="stylesheet" type="text/css" href="' + cssURL + '" />').appendTo('head');
                    }
                    plugin['launch_status'] = LRS.constants.PL_RUNNING;
                    plugin['launch_status_msg'] = $.t('plugin_running', 'Running');
                    if(manifest['startPage'] && manifest['startPage'] in LRS.setup) {
                        LRS.setup[manifest['startPage']]();
                    }
                    LRS.numRunningPlugins += 1;
                    callback(null);
                }).fail(function() {
                    plugin['launch_status'] = LRS.constants.PL_HALTED;
                    plugin['launch_status_msg'] = $.t('plugin_halted', 'Halted');
                    plugin['validity'] = LRS.constants.PV_INVALID_JAVASCRIPT_FILE;
                    plugin['validity_msg'] = $.t('plugin_invalid_javascript_file', 'Invalid javascript file');
                    callback(null);
                })
            }
        ])
    };

	return LRS;
}(LRS || {}, jQuery));
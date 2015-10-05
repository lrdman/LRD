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
var LRS = (function (LRS, $, undefined) {
    LRS.constants = {
        'DB_VERSION': 2,

        'PLUGIN_VERSION': 1,
        'MAX_SHORT_JAVA': 32767,
        'MAX_INT_JAVA': 2147483647,
        'MIN_PRUNABLE_MESSAGE_LENGTH': 28,

        //Plugin launch status numbers
        'PL_RUNNING': 1,
        'PL_PAUSED': 2,
        'PL_DEACTIVATED': 3,
        'PL_HALTED': 4,

        //Plugin validity status codes
        'PV_VALID': 100,
        'PV_NOT_VALID': 300,
        'PV_UNKNOWN_MANIFEST_VERSION': 301,
        'PV_INCOMPATIBLE_MANIFEST_VERSION': 302,
        'PV_INVALID_MANIFEST_FILE': 303,
        'PV_INVALID_MISSING_FILES': 304,
        'PV_INVALID_JAVASCRIPT_FILE': 305,

        //Plugin LRS compatibility status codes
        'PNC_COMPATIBLE': 100,
        'PNC_COMPATIBILITY_MINOR_RELEASE_DIFF': 101,
        'PNC_COMPATIBILITY_WARNING': 200,
        'PNC_COMPATIBILITY_MAJOR_RELEASE_DIFF': 202,
        'PNC_NOT_COMPATIBLE': 300,
        'PNC_COMPATIBILITY_UNKNOWN': 301,
        'PNC_COMPATIBILITY_CLIENT_VERSION_TOO_OLD': 302,

        'VOTING_MODELS': {},
        'MIN_BALANCE_MODELS': {},
        "HASH_ALGORITHMS": {},
        "PHASING_HASH_ALGORITHMS": {},
        "MINTING_HASH_ALGORITHMS": {},

        'SERVER': {},
        'MAX_TAGGED_DATA_DATA_LENGTH': 0,
        'GENESIS': '',
        'GENESIS_RS': '',
        'EPOCH_BEGINNING': 0,
        'FORGING': 'forging',
        'NOT_FORGING': 'not_forging',
        'UNKNOWN': 'unknown'
    };

    LRS.loadAlgorithmList = function (algorithmSelect, isPhasingHash) {
        var hashAlgorithms;
        if (isPhasingHash) {
            hashAlgorithms = LRS.constants.PHASING_HASH_ALGORITHMS;
        } else {
            hashAlgorithms = LRS.constants.HASH_ALGORITHMS;
        }
        for (var key in hashAlgorithms) {
            if (hashAlgorithms.hasOwnProperty(key)) {
                algorithmSelect.append($("<option />").val(hashAlgorithms[key]).text(key));
            }
        }
    };

    LRS.loadServerConstants = function () {
        LRS.sendRequest("getConstants", {}, function (response) {
            if (response.genesisAccountId) {
                LRS.constants.SERVER = response;
                LRS.constants.VOTING_MODELS = response.votingModels;
                LRS.constants.MIN_BALANCE_MODELS = response.minBalanceModels;
                LRS.constants.HASH_ALGORITHMS = response.hashAlgorithms;
                LRS.constants.PHASING_HASH_ALGORITHMS = response.phasingHashAlgorithms;
                LRS.constants.MINTING_HASH_ALGORITHMS = response.mintingHashAlgorithms;
                LRS.constants.MAX_TAGGED_DATA_DATA_LENGTH = response.maxTaggedDataDataLength;
                LRS.constants.GENESIS = response.genesisAccountId;
                LRS.constants.GENESIS_RS = LRS.convertNumericToRSAccountFormat(response.genesisAccountId);
                LRS.constants.EPOCH_BEGINNING = response.epochBeginning;
            }
        });
    };

    function getKeyByValue(map, value) {
        for (var key in map) {
            if (map.hasOwnProperty(key)) {
                if (value === map[key]) {
                    return key;
                }
            }
        }
        return null;
    }

    LRS.getVotingModelName = function (code) {
        return getKeyByValue(LRS.constants.VOTING_MODELS, code);
    };

    LRS.getVotingModelCode = function (name) {
        return LRS.constants.VOTING_MODELS[name];
    };

    LRS.getMinBalanceModelName = function (code) {
        return getKeyByValue(LRS.constants.MIN_BALANCE_MODELS, code);
    };

    LRS.getMinBalanceModelCode = function (name) {
        return LRS.constants.MIN_BALANCE_MODELS[name];
    };

    LRS.getHashAlgorithm = function (code) {
        return getKeyByValue(LRS.constants.HASH_ALGORITHMS, code);
    };

    // TODO receive from the server list of APIs which are safe for offline execution
    LRS.isOfflineSafeRequest = function(requestType) {
        return requestType == "addPeer" || requestType == "blacklistPeer" || requestType == "signTransaction" ||
            requestType == "decodeToken" || requestType == "generateToken" ||
            requestType == "decodeFileToken" || requestType == "generateFileToken" || requestType == "hash" ||
            requestType == "parseTransaction" || requestType == "calculateFullHash";
    };

    return LRS;
}(LRS || {}, jQuery));
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

package lrd.http;

import lrd.Account;
import lrd.Asset;
import lrd.LrdException;
import org.json.simple.JSONObject;
import org.json.simple.JSONStreamAware;

import javax.servlet.http.HttpServletRequest;

public final class GetAssetAccountCount extends APIServlet.APIRequestHandler {

    static final GetAssetAccountCount instance = new GetAssetAccountCount();

    private GetAssetAccountCount() {
        super(new APITag[] {APITag.AE}, "asset", "height");
    }

    @Override
    JSONStreamAware processRequest(HttpServletRequest req) throws LrdException {

        Asset asset = ParameterParser.getAsset(req);
        int height = ParameterParser.getHeight(req);

        JSONObject response = new JSONObject();
        response.put("numberOfAccounts", Account.getAssetAccountCount(asset.getId(), height));
        return response;

    }

}

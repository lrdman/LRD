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

import lrd.Order;
import lrd.db.DbIterator;
import org.json.simple.JSONArray;
import org.json.simple.JSONObject;
import org.json.simple.JSONStreamAware;

import javax.servlet.http.HttpServletRequest;

public final class GetAccountCurrentBidOrders extends APIServlet.APIRequestHandler {

    static final GetAccountCurrentBidOrders instance = new GetAccountCurrentBidOrders();

    private GetAccountCurrentBidOrders() {
        super(new APITag[] {APITag.ACCOUNTS, APITag.AE}, "account", "asset", "firstIndex", "lastIndex");
    }

    @Override
    JSONStreamAware processRequest(HttpServletRequest req) throws ParameterException {

        long accountId = ParameterParser.getAccount(req).getId();
        long assetId = ParameterParser.getUnsignedLong(req, "asset", false);
        int firstIndex = ParameterParser.getFirstIndex(req);
        int lastIndex = ParameterParser.getLastIndex(req);

        DbIterator<Order.Bid> bidOrders;
        if (assetId == 0) {
            bidOrders = Order.Bid.getBidOrdersByAccount(accountId, firstIndex, lastIndex);
        } else {
            bidOrders = Order.Bid.getBidOrdersByAccountAsset(accountId, assetId, firstIndex, lastIndex);
        }
        JSONArray orders = new JSONArray();
        try {
            while (bidOrders.hasNext()) {
                orders.add(JSONData.bidOrder(bidOrders.next()));
            }
        } finally {
            bidOrders.close();
        }
        JSONObject response = new JSONObject();
        response.put("bidOrders", orders);
        return response;
    }

}
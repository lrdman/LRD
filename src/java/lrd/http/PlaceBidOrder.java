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
import lrd.Attachment;
import lrd.LrdException;
import org.json.simple.JSONStreamAware;

import javax.servlet.http.HttpServletRequest;

import static lrd.http.JSONResponses.NOT_ENOUGH_FUNDS;

public final class PlaceBidOrder extends CreateTransaction {

    static final PlaceBidOrder instance = new PlaceBidOrder();

    private PlaceBidOrder() {
        super(new APITag[] {APITag.AE, APITag.CREATE_TRANSACTION}, "asset", "quantityQNT", "priceLQT");
    }

    @Override
    JSONStreamAware processRequest(HttpServletRequest req) throws LrdException {

        Asset asset = ParameterParser.getAsset(req);
        long priceLQT = ParameterParser.getPriceLQT(req);
        long quantityQNT = ParameterParser.getQuantityQNT(req);
        long feeLQT = ParameterParser.getFeeLQT(req);
        Account account = ParameterParser.getSenderAccount(req);

        try {
            if (Math.addExact(feeLQT, Math.multiplyExact(priceLQT, quantityQNT)) > account.getUnconfirmedBalanceLQT()) {
                return NOT_ENOUGH_FUNDS;
            }
        } catch (ArithmeticException e) {
            return NOT_ENOUGH_FUNDS;
        }

        Attachment attachment = new Attachment.ColoredCoinsBidOrderPlacement(asset.getId(), quantityQNT, priceLQT);
        return createTransaction(req, account, attachment);
    }

}

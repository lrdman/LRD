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
import lrd.Lrd;
import lrd.LrdException;
import lrd.Transaction;
import org.json.simple.JSONStreamAware;

import javax.servlet.http.HttpServletRequest;

public class DividendPayment extends CreateTransaction {

    static final DividendPayment instance = new DividendPayment();

    private DividendPayment() {
        super(new APITag[] {APITag.AE, APITag.CREATE_TRANSACTION}, "asset", "height", "amountLQTPerQNT");
    }

    @Override
    JSONStreamAware processRequest(final HttpServletRequest request)
            throws LrdException
    {
        final int height = ParameterParser.getHeight(request);
        final long amountLQTPerQNT = ParameterParser.getAmountLQTPerQNT(request);
        final Account account = ParameterParser.getSenderAccount(request);
        final Asset asset = ParameterParser.getAsset(request);
        Transaction assetCreation = Lrd.getBlockchain().getTransaction(asset.getId());
        int creationHeight = assetCreation.getHeight();
        if (assetCreation.getPhasing() != null) {
            creationHeight = assetCreation.getPhasing().getFinishHeight();
        }
        if (creationHeight >= height) {
            return JSONResponses.ASSET_NOT_ISSUED_YET;
        }
        final Attachment attachment = new Attachment.ColoredCoinsDividendPayment(asset.getId(), height, amountLQTPerQNT);
        return this.createTransaction(request, account, attachment);
    }

}

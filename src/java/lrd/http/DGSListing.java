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
import lrd.Attachment;
import lrd.Constants;
import lrd.LrdException;
import lrd.util.Convert;
import org.json.simple.JSONStreamAware;

import javax.servlet.http.HttpServletRequest;

import static lrd.http.JSONResponses.INCORRECT_DGS_LISTING_DESCRIPTION;
import static lrd.http.JSONResponses.INCORRECT_DGS_LISTING_NAME;
import static lrd.http.JSONResponses.INCORRECT_DGS_LISTING_TAGS;
import static lrd.http.JSONResponses.MISSING_NAME;

public final class DGSListing extends CreateTransaction {

    static final DGSListing instance = new DGSListing();

    private DGSListing() {
        super(new APITag[] {APITag.DGS, APITag.CREATE_TRANSACTION},
                "name", "description", "tags", "quantity", "priceLQT");
    }

    @Override
    JSONStreamAware processRequest(HttpServletRequest req) throws LrdException {

        String name = Convert.emptyToNull(req.getParameter("name"));
        String description = Convert.nullToEmpty(req.getParameter("description"));
        String tags = Convert.nullToEmpty(req.getParameter("tags"));
        long priceLQT = ParameterParser.getPriceLQT(req);
        int quantity = ParameterParser.getGoodsQuantity(req);

        if (name == null) {
            return MISSING_NAME;
        }
        name = name.trim();
        if (name.length() > Constants.MAX_DGS_LISTING_NAME_LENGTH) {
            return INCORRECT_DGS_LISTING_NAME;
        }

        if (description.length() > Constants.MAX_DGS_LISTING_DESCRIPTION_LENGTH) {
            return INCORRECT_DGS_LISTING_DESCRIPTION;
        }

        if (tags.length() > Constants.MAX_DGS_LISTING_TAGS_LENGTH) {
            return INCORRECT_DGS_LISTING_TAGS;
        }

        Account account = ParameterParser.getSenderAccount(req);
        Attachment attachment = new Attachment.DigitalGoodsListing(name, description, tags, quantity, priceLQT);
        return createTransaction(req, account, attachment);

    }

}

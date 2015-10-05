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

import lrd.Block;
import lrd.Lrd;
import org.json.simple.JSONArray;
import org.json.simple.JSONObject;
import org.json.simple.JSONStreamAware;

import javax.servlet.http.HttpServletRequest;
import java.util.List;

public final class PopOff extends APIServlet.APIRequestHandler {

    static final PopOff instance = new PopOff();

    private PopOff() {
        super(new APITag[] {APITag.DEBUG}, "numBlocks", "height");
    }

    @Override
    JSONStreamAware processRequest(HttpServletRequest req) {

        int numBlocks = 0;
        try {
            numBlocks = Integer.parseInt(req.getParameter("numBlocks"));
        } catch (NumberFormatException ignored) {}
        int height = 0;
        try {
            height = Integer.parseInt(req.getParameter("height"));
        } catch (NumberFormatException ignored) {}

        List<? extends Block> blocks;
        try {
            Lrd.getBlockchainProcessor().setGetMoreBlocks(false);
            if (numBlocks > 0) {
                blocks = Lrd.getBlockchainProcessor().popOffTo(Lrd.getBlockchain().getHeight() - numBlocks);
            } else if (height > 0) {
                blocks = Lrd.getBlockchainProcessor().popOffTo(height);
            } else {
                return JSONResponses.missing("numBlocks", "height");
            }
        } finally {
            Lrd.getBlockchainProcessor().setGetMoreBlocks(true);
        }
        JSONArray blocksJSON = new JSONArray();
        blocks.forEach(block -> blocksJSON.add(JSONData.block(block, true)));
        JSONObject response = new JSONObject();
        response.put("blocks", blocksJSON);
        return response;
    }

    @Override
    final boolean requirePost() {
        return true;
    }

    @Override
    boolean requirePassword() {
        return true;
    }

    @Override
    final boolean allowRequiredBlockParameters() {
        return false;
    }

}
